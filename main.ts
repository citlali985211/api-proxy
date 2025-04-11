import { serve } from "https://deno.land/std/http/server.ts";
import { serveFile } from "https://deno.land/std/http/file_server.ts";

// --- Configuration ---
const apiMapping = {
  "/groq": "https://api.groq.com/openai",
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
                background-color: #f5f5f5;
                margin: 0;
            }
            .login-container {
                background-color: white;
                padding: 30px 40px;
                border-radius: 12px;
                box-shadow: 0 6px 20px rgba(0, 0, 0, 0.15);
                text-align: center;
                max-width: 380px;
                width: 90%;
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
  const targetUrl = `${apiMapping[prefix]}${rest}${url.search}`;

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
      <tr>
        <td>
          <div class="flex items-center">
            <code class="code">${fullProxyUrl}</code>
            <button class="copy-button" onclick="copyText('${fullProxyUrl}', this)">
              复制
            </button>
          </div>
        </td>
        <td><code class="code">${targetUrl}</code></td>
        <td><span class="status-badge">在线</span></td>
      </tr>
    `;
  }

  const htmlContent = `
    <!DOCTYPE html>
    <html lang="zh-CN">
    <head>
        <title>API 代理服务</title>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <meta name="description" content="安全可靠的 API 代理服务">
        <style>
            body {
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                background-color: #f8fafc;
                color: #334155;
                line-height: 1.6;
                padding: 20px;
                margin: 0;
            }
            
            .container {
                max-width: 1000px;
                margin: 0 auto;
            }
            
            header {
                background: linear-gradient(45deg, #4f46e5, #06b6d4);
                color: white;
                padding: 20px;
                border-radius: 10px;
                text-align: center;
                margin-bottom: 30px;
            }
            
            h1 {
                margin: 0;
                font-size: 24px;
            }
            
            table {
                width: 100%;
                background-color: white;
                border-radius: 10px;
                box-shadow: 0 1px 3px rgba(0,0,0,0.1);
                border-collapse: collapse;
                overflow: hidden;
            }
            
            th, td {
                padding: 15px;
                text-align: left;
                border-bottom: 1px solid #e5e7eb;
            }
            
            th {
                background-color: #f9fafb;
                font-weight: 600;
            }
            
            .code {
                background-color: #f3f4f6;
                padding: 4px 8px;
                border-radius: 4px;
                font-family: monospace;
                word-break: break-all;
            }
            
            .copy-button {
                background-color: #4f46e5;
                color: white;
                border: none;
                padding: 5px 10px;
                border-radius: 4px;
                cursor: pointer;
                margin-left: 10px;
                font-size: 12px;
            }
            
            .copy-button:hover {
                background-color: #4338ca;
            }
            
            .status-badge {
                background-color: #10b981;
                color: white;
                padding: 4px 8px;
                border-radius: 9999px;
                font-size: 12px;
                font-weight: 500;
            }
            
            footer {
                margin-top: 30px;
                text-align: center;
                font-size: 14px;
                color: #6b7280;
            }
            
            @media (max-width: 768px) {
                table {
                    display: block;
                    overflow-x: auto;
                }
            }
        </style>
    </head>
    <body>
        <div class="container">
            <header>
                <h1>API 代理服务</h1>
            </header>

            <table>
                <thead>
                    <tr>
                        <th>代理地址</th>
                        <th>源地址</th>
                        <th>状态</th>
                    </tr>
                </thead>
                <tbody>
                    ${tableRows}
                </tbody>
            </table>

            <footer>
                © ${new Date().getFullYear()} API 代理服务
            </footer>
        </div>

        <script>
            function copyText(text, button) {
                navigator.clipboard.writeText(text).then(() => {
                    const originalText = button.textContent;
                    button.textContent = '已复制!';
                    button.style.backgroundColor = '#10b981';
                    
                    setTimeout(() => {
                        button.textContent = originalText;
                        button.style.backgroundColor = '#4f46e5';
                    }, 1500);
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
