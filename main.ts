import { serve } from "https://deno.land/std/http/server.ts";
import { serveFile } from "https://deno.land/std/http/file_server.ts";

// --- Configuration ---
const apiMapping = {
  "/xai": "https://api.x.ai",         
  "/openai": "https://api.openai.com",
  "/gemini": "https://generativelanguage.googleapis.com",
  "/perplexity": "https://api.perplexity.ai", 
};

// Directly get environment variables from Deno.env
const PROXY_DOMAIN = Deno.env.get("PROXY_DOMAIN");
const PROXY_PASSWORD = Deno.env.get("PROXY_PASSWORD");
const PROXY_PORT = Deno.env.get("PROXY_PORT") || "8000";
const AUTH_COOKIE_NAME = "api_proxy_auth_token";

// Check environment variable
if (!PROXY_DOMAIN) {
  const errorMsg = "错误: PROXY_DOMAIN 环境变量未设置。请设置它（例如 'export PROXY_DOMAIN=myproxy.example.com'）然后重试。";
  console.error(errorMsg);
  throw new Error(errorMsg);
}

// Check authentication environment variable
if (!PROXY_PASSWORD) {
  console.warn("警告: PROXY_PASSWORD 环境变量未设置。身份验证已禁用。");
}

// --- Authentication Helper Functions ---

/**
 * 根据密码哈希生成简单的身份验证令牌
 * @param {string} password
 * @returns {Promise<string>} - SHA-256 哈希的十六进制表示
 */
async function generateAuthToken(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const digest = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(digest));
  const hashHex = hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
  return hashHex;
}

/**
 * 检查当前请求是否通过 cookie 进行了身份验证
 * @param {Request} request
 * @returns {Promise<boolean>}
 */
async function isAuthenticated(request: Request): Promise<boolean> {
  if (!PROXY_PASSWORD) {
    return true; // If no password is configured, always return true
  }

  const cookies = request.headers.get("Cookie") || "";
  const tokenMatch = cookies.match(new RegExp(`${AUTH_COOKIE_NAME}=([^;]+)`));
  const receivedToken = tokenMatch ? tokenMatch[1] : null;

  if (!receivedToken) {
    return false;
  }

  const expectedToken = await generateAuthToken(PROXY_PASSWORD);
  return receivedToken === expectedToken;
}

/**
 * 生成 HTML 登录页面
 * @param {string} [errorMessage] - 可选的错误信息
 * @returns {Response} - 登录页面的 HTML 响应
 */
function generateLoginPage(errorMessage = ""): Response {
  const errorHtml = errorMessage ? `<p class="error-message">${errorMessage}</p>` : "";
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
        <title>需要登录</title>
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <meta charset="UTF-8">
        <style>
            body {
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif;
                display: flex;
                justify-content: center;
                align-items: center;
                min-height: 100vh;
                margin: 0;
                background-image: url('https://raw.githubusercontent.com/Nshpiter/docker-accelerate/refs/heads/main/background.jpg');
                background-size: cover;
                background-position: center;
                background-repeat: no-repeat;
            }
            .login-container {
                background-color: rgba(255, 255, 255, 0.95);
                padding: 30px 40px;
                border-radius: 12px;
                box-shadow: 0 6px 20px rgba(0, 0, 0, 0.15);
                text-align: center;
                max-width: 380px;
                width: 90%;
                backdrop-filter: blur(10px);
            }
            h2 {
                color: #333;
                margin-bottom: 20px;
                font-weight: 600;
            }
            p {
                color: #444;
                margin-bottom: 25px;
            }
            form {
                display: flex;
                flex-direction: column;
            }
            label {
                text-align: left;
                margin-bottom: 8px;
                color: #444;
                font-weight: bold;
                font-size: 14px;
            }
            input[type="password"] {
                padding: 12px 15px;
                margin-bottom: 18px;
                border: 1px solid #ccc;
                border-radius: 6px;
                font-size: 16px;
                box-sizing: border-box;
            }
            input:focus {
                outline: none;
                border-color: #007bff;
                box-shadow: 0 0 0 2px rgba(0, 123, 255, 0.25);
            }
            button {
                padding: 12px;
                background-color: #007bff;
                color: white;
                border: none;
                border-radius: 6px;
                cursor: pointer;
                font-size: 16px;
                font-weight: 600;
                transition: background-color 0.3s ease;
                margin-top: 10px;
            }
            button:hover {
                background-color: #0056b3;
            }
            .error-message {
                color: #dc3545;
                margin-top: 15px;
                font-weight: bold;
            }
        </style>
    </head>
    <body>
        <div class="login-container">
            <h2>需要登录</h2>
            <p>请输入密码以访问 API 代理。</p>
            <form action="/login" method="post">
                <label for="password">密码:</label>
                <input type="password" id="password" name="password" required>
                <button type="submit">登录</button>
            </form>
            ${errorHtml}
        </div>
    </body>
    </html>
    `;
  return new Response(html, {
    status: 401, // Unauthorized
    headers: { "Content-Type": "text/html; charset=UTF-8" },
  });
}

/**
 * 处理 /login 的 POST 请求
 * @param {Request} request
 * @returns {Promise<Response>}
 */
async function handleLogin(request: Request): Promise<Response> {
  if (!PROXY_PASSWORD) {
    console.error("PROXY_PASSWORD 环境变量未设置。");
    return new Response("身份验证后端配置错误。", { status: 500 });
  }

  try {
    const formData = await request.formData();
    const password = formData.get("password");

    if (password === PROXY_PASSWORD) {
      const token = await generateAuthToken(PROXY_PASSWORD);
      const cookieValue = `${AUTH_COOKIE_NAME}=${token}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=86400`;
      return new Response(null, {
        status: 302, // Found (Redirect)
        headers: {
          "Location": "/",
          "Set-Cookie": cookieValue,
        },
      });
    } else {
      console.log("登录失败: 密码无效");
      return generateLoginPage("密码无效。");
    }
  } catch (error) {
    console.error("处理登录表单时出错:", error);
    return generateLoginPage("登录过程中发生错误。");
  }
}

// --- Main Request Handler ---
async function main(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const pathname = url.pathname;

  // 检查是否访问的是 API 端点（不需要身份验证）
  const [prefix, _] = extractPrefixAndRest(pathname, Object.keys(apiMapping));
  const isApiEndpoint = prefix !== null;

  // 仅对非 API 访问进行身份验证，包括主页、登录页等
  if (!isApiEndpoint) {
    // 处理登录请求
    if (pathname === "/login" && request.method === "POST") {
      return handleLogin(request);
    }
    
    // 如果访问的是主页或索引页，且设置了密码，则需要验证
    if ((pathname === "/" || pathname === "/index.html") && PROXY_PASSWORD) {
      const authenticated = await isAuthenticated(request);
      if (!authenticated) {
        console.log(`需要身份验证: ${pathname}`);
        return generateLoginPage();
      }
      console.log(`已验证访问: ${pathname}`);
    }
  } else {
    console.log(`API 端点访问，跳过身份验证: ${pathname}`);
  }

  // --- Route Requests ---
  if (pathname === "/" || pathname === "/index.html") {
    return handleDashboardPage(apiMapping, PROXY_DOMAIN);
  }

  if (pathname === "/robots.txt") {
    return new Response("User-agent: *\nDisallow: /", {
      status: 200,
      headers: { "Content-Type": "text/plain" },
    });
  }

  if (pathname.startsWith("/public/")) {
    return serveStaticFile(request, `.${pathname}`);
  }

  // 处理 API 请求
  if (isApiEndpoint) {
    return handleApiRequest(request, prefix!, pathname);
  }

  return new Response("Not Found: Invalid path.", { status: 404 });
}

/**
 * 处理 API 代理请求
 */
async function handleApiRequest(request: Request, prefix: string, pathname: string): Promise<Response> {
  const url = new URL(request.url);
  const [_, rest] = extractPrefixAndRest(pathname, [prefix]);
  // 确保路径正确格式化
  const targetPath = rest || "";
  const targetUrl = `${apiMapping[prefix]}${targetPath}${url.search}`;

  try {
    const headers = new Headers();
    // 允许传递所有需要的 API 请求头
    for (const [key, value] of request.headers.entries()) {
      // 跳过一些可能导致问题的头部
      if (!["host", "connection", "content-length"].includes(key.toLowerCase())) {
        headers.set(key, value);
      }
    }

    console.log(`代理请求到: ${targetUrl}`);
    
    const response = await fetch(targetUrl, {
      method: request.method,
      headers: headers,
      body: request.body,
    });

    const responseHeaders = new Headers(response.headers);
    responseHeaders.set("X-Content-Type-Options", "nosniff");
    responseHeaders.set("Access-Control-Allow-Origin", "*");
    responseHeaders.set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
    responseHeaders.set("Access-Control-Allow-Headers", "Content-Type, Authorization");

    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: responseHeaders,
    });
  } catch (error) {
    console.error(`代理请求失败 for ${targetUrl}:`, error);
    return new Response("Internal Server Error: Proxy failed.", { status: 500 });
  }
}

/**
 * 从路径中提取前缀和剩余部分
 */
function extractPrefixAndRest(pathname: string, prefixes: string[]): [string | null, string | null] {
  prefixes.sort((a, b) => b.length - a.length);
  for (const prefix of prefixes) {
    if (pathname.startsWith(prefix)) {
      return [prefix, pathname.slice(prefix.length)];
    }
  }
  return [null, null];
}

/**
 * 生成并返回仪表板页面
 */
async function handleDashboardPage(
  apiMapping: { [key: string]: string },
  domain: string
): Promise<Response> {
  let tableRows = "";
  const sortedPaths = Object.keys(apiMapping).sort();

  for (const proxyPath of sortedPaths) {
    const targetUrl = apiMapping[proxyPath];
    const fullProxyUrl = `https://${domain}${proxyPath}`;

    tableRows += `
      <div class="card">
        <div class="card-header">
          <h3>${proxyPath}</h3>
          <span class="status-badge online">在线</span>
        </div>
        <div class="card-body">
          <p><strong>代理地址:</strong> <code>${fullProxyUrl}</code> <button class="copy-btn" onclick="copyToClipboard('${fullProxyUrl}')">复制</button></p>
          <p><strong>源地址:</strong> <code>${targetUrl}</code></p>
        </div>
      </div>
    `;
  }

  const htmlContent = `
    <!DOCTYPE html>
    <html lang="zh-CN">
    <head>
        <title>API 代理仪表板</title>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <meta name="description" content="安全可靠的 API 代理服务">
        <style>
            * {
                margin: 0;
                padding: 0;
                box-sizing: border-box;
            }
            body {
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                color: #ffffff;
                min-height: 100vh;
                background-image: url('https://raw.githubusercontent.com/Nshpiter/docker-accelerate/refs/heads/main/background.jpg');
                background-size: cover;
                background-position: center;
                background-attachment: fixed;
                overflow-x: hidden;
            }
            .overlay {
                background: rgba(0, 0, 0, 0.5);
                backdrop-filter: blur(15px);
                min-height: 100vh;
                padding: 20px;
                display: flex;
                flex-direction: column;
                align-items: center;
            }
            .header {
                text-align: center;
                margin-bottom: 30px;
                width: 100%;
                max-width: 1200px;
                padding: 20px;
                background: rgba(255, 255, 255, 0.1);
                border-radius: 15px;
                box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
                border: 1px solid rgba(255, 255, 255, 0.18);
                animation: fadeInDown 0.8s ease-out;
            }
            .header h1 {
                font-size: 2.5rem;
                margin-bottom: 10px;
                text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.3);
                background: linear-gradient(45deg, #00ff87, #60efff);
                -webkit-background-clip: text;
                background-clip: text;
                -webkit-text-fill-color: transparent;
            }
            .header p {
                font-size: 1.1rem;
                opacity: 0.9;
            }
            .container {
                width: 100%;
                max-width: 1200px;
                display: flex;
                flex-wrap: wrap;
                justify-content: center;
                gap: 25px;
                padding: 10px;
            }
            .card {
                background: rgba(255, 255, 255, 0.15);
                backdrop-filter: blur(10px);
                border-radius: 16px;
                overflow: hidden;
                box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
                border: 1px solid rgba(255, 255, 255, 0.18);
                width: 100%;
                min-width: 300px;
                max-width: 550px;
                transition: transform 0.3s ease, box-shadow 0.3s ease;
                animation: fadeInUp 0.8s ease-out;
            }
            .card:hover {
                transform: translateY(-10px);
                box-shadow: 0 12px 40px rgba(0, 0, 0, 0.3);
            }
            .card-header {
                padding: 15px 20px;
                background: rgba(255, 255, 255, 0.1);
                display: flex;
                justify-content: space-between;
                align-items: center;
                border-bottom: 1px solid rgba(255, 255, 255, 0.1);
            }
            .card-header h3 {
                font-size: 1.4rem;
                font-weight: 600;
            }
            .status-badge {
                padding: 5px 12px;
                border-radius: 20px;
                font-size: 0.8rem;
                font-weight: 500;
            }
            .online {
                background: #00ff87;
                color: #000;
            }
            .card-body {
                padding: 20px;
            }
            .card-body p {
                margin-bottom: 10px;
                font-size: 0.95rem;
                line-height: 1.5;
            }
            .card-body code {
                background: rgba(255, 255, 255, 0.1);
                padding: 3px 8px;
                border-radius: 5px;
                font-size: 0.9rem;
                display: inline-block;
                max-width: 100%;
                overflow-x: auto;
            }
            .copy-btn {
                background: linear-gradient(45deg, #00ff87, #60efff);
                color: #000;
                border: none;
                padding: 5px 12px;
                border-radius: 5px;
                cursor: pointer;
                font-size: 0.8rem;
                transition: transform 0.2s ease, background 0.3s ease;
                margin-left: 5px;
            }
            .copy-btn:hover {
                transform: scale(1.05);
                background: linear-gradient(45deg, #60efff, #00ff87);
            }
            .footer {
                margin-top: 40px;
                text-align: center;
                font-size: 0.9rem;
                color: rgba(255, 255, 255, 0.7);
                padding: 20px;
                background: rgba(255, 255, 255, 0.05);
                border-radius: 10px;
                width: 100%;
                max-width: 1200px;
            }

            /* 动画 */
            @keyframes fadeInDown {
                from {
                    opacity: 0;
                    transform: translateY(-20px);
                }
                to {
                    opacity: 1;
                    transform: translateY(0);
                }
            }
            @keyframes fadeInUp {
                from {
                    opacity: 0;
                    transform: translateY(20px);
                }
                to {
                    opacity: 1;
                    transform: translateY(0);
                }
            }

            /* 响应式设计 */
            @media (min-width: 768px) {
                .container {
                    justify-content: space-between;
                }
                .card {
                    width: calc(50% - 15px);
                }
            }
            @media (min-width: 1024px) {
                .card {
                    width: calc(33.33% - 20px);
                }
                .header h1 {
                    font-size: 3rem;
                }
            }
            @media (max-width: 767px) {
                .card {
                    width: 100%;
                }
                .header h1 {
                    font-size: 2rem;
                }
                .header p {
                    font-size: 1rem;
                }
            }
            @media (max-width: 480px) {
                .header {
                    padding: 15px;
                }
                .header h1 {
                    font-size: 1.8rem;
                }
                .card-header {
                    flex-direction: column;
                    align-items: flex-start;
                }
                .card-header h3 {
                    font-size: 1.2rem;
                    margin-bottom: 5px;
                }
            }
        </style>
    </head>
    <body>
        <div class="overlay">
            <div class="header">
                <h1>API 代理仪表板</h1>
                <p>安全、快速、可靠的 API 代理服务</p>
            </div>
            <div class="container">
                ${tableRows}
            </div>
            <div class="footer">
                © ${new Date().getFullYear()} API 代理服务 - 提供高效的代理解决方案
            </div>
        </div>

        <script>
            function copyToClipboard(text) {
                navigator.clipboard.writeText(text).then(() => {
                    const btn = event.target;
                    const originalText = btn.textContent;
                    btn.textContent = '已复制!';
                    btn.style.background = '#00ff87';
                    setTimeout(() => {
                        btn.textContent = originalText;
                        btn.style.background = 'linear-gradient(45deg, #00ff87, #60efff)';
                    }, 2000);
                }).catch(err => {
                    console.error('复制失败:', err);
                    alert('复制失败，请手动复制');
                });
            }
        </script>
    </body>
    </html>
    `;

  return new Response(htmlContent, {
    status: 200,
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}

/**
 * 提供静态文件服务
 */
async function serveStaticFile(request: Request, filepath: string): Promise<Response> {
  try {
    const resolvedPath = Deno.realPathSync(filepath);
    const projectRoot = Deno.realPathSync(".");
    if (!resolvedPath.startsWith(projectRoot)) {
      return new Response("Forbidden", { status: 403 });
    }

    const file = await Deno.open(resolvedPath, { read: true });
    const stat = await file.stat();

    if (stat.isDirectory) {
      file.close();
      return new Response("Not Found (is directory)", { status: 404 });
    }

    return await serveFile(request, resolvedPath);
  } catch (error) {
    if (error instanceof Deno.errors.NotFound) {
      return new Response("Not Found", { status: 404 });
    } else {
      console.error("Error serving static file:", error);
      return new Response("Internal Server Error", { status: 500 });
    }
  }
}

// --- Start the Server ---
console.log(`服务器正在启动... ${new Date().toISOString()}`);
console.log(`将在端口 ${PROXY_PORT} 上监听`);
console.log(`代理域名设置为: ${PROXY_DOMAIN}`);
console.warn(`请通过 HTTPS 访问: https://${PROXY_DOMAIN}/`);
console.log("可用代理路径:");
Object.keys(apiMapping)
  .sort()
  .forEach((p) =>
    console.log(`  - https://${PROXY_DOMAIN}${p} -> ${apiMapping[p]}`)
  );

serve(
  async (req) => {
    try {
      console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
      
      // 处理 OPTIONS 请求（对于跨域请求的预检）
      if (req.method === "OPTIONS") {
        return new Response(null, {
          status: 204,
          headers: {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,PATCH,HEAD,OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type,Authorization,X-Requested-With",
            "Access-Control-Max-Age": "86400",
          },
        });
      }
      
      const response = await main(req);
      console.log(
        `[${new Date().toISOString()}] ${req.method} ${req.url} - ${response.status}`
      );
      return response;
    } catch (e) {
      console.error("未捕获的错误:", e);
      return new Response("Internal Server Error", { status: 500 });
    }
  },
  { port: parseInt(PROXY_PORT, 10) }
);
