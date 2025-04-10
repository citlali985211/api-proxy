import { serve } from "https://deno.land/std/http/server.ts";
import { getCookies, setCookie } from "https://deno.land/std/http/cookie.ts";
import { serveFile } from "https://deno.land/std/http/file_server.ts";

// --- Configuration ---
const apiMapping = {
  '/discord': 'https://discord.com/api',
  '/telegram': 'https://api.telegram.org',
  '/openai': 'https://api.openai.com',
  '/claude': 'https://api.anthropic.com',
  '/gemini': 'https://generativelanguage.googleapis.com',
  '/meta': 'https://www.meta.ai/api',
  '/groq': 'https://api.groq.com/openai',
  '/xai': 'https://api.x.ai',
  '/cohere': 'https://api.cohere.ai',
  '/huggingface': 'https://api-inference.huggingface.co',
  '/together': 'https://api.together.xyz',
  '/novita': 'https://api.novita.ai',
  '/portkey': 'https://api.portkey.ai',
  '/fireworks': 'https://api.fireworks.ai',
  '/openrouter': 'https://openrouter.ai/api'
};

const AUTH_COOKIE_NAME = "proxy_auth_session";

// 直接从 Deno.env 获取环境变量
const REQUIRED_PASSWORD = Deno.env.get("PROXY_PASSWORD");
const PROXY_DOMAIN = Deno.env.get("PROXY_DOMAIN");
const PROXY_PORT = Deno.env.get("PROXY_PORT") || "8000";

// 检查环境变量
if (!REQUIRED_PASSWORD) {
  console.warn("警告: PROXY_PASSWORD 未设置，认证将被禁用。");
}
if (!PROXY_DOMAIN) {
  console.error("错误: PROXY_DOMAIN 未设置，请在环境变量中配置！");
  Deno.exit(1); // 如果域名未设置，退出程序
}

// --- 主请求处理函数 ---
async function main(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const pathname = url.pathname;
  const cookies = getCookies(request.headers);

  // --- 1. 认证检查 ---
  if (REQUIRED_PASSWORD) {
    const isAuthenticated = cookies[AUTH_COOKIE_NAME] === "ok";
    if (!isAuthenticated) {
      if (request.method === "POST" && pathname === "/auth-login") {
        return await handleLoginSubmission(request);
      }
      const attemptedUrl = pathname + url.search;
      return handleLoginPage(false, attemptedUrl);
    }
  }

  // --- 2. 处理特殊路径 ---
  if (pathname === "/" || pathname === "/index.html") {
    return handleDashboardPage(); // 返回仪表盘页面
  }

  if (pathname === "/robots.txt") {
    return new Response("User-agent: *\nDisallow: /", {
      status: 200,
      headers: { "Content-Type": "text/plain" }
    });
  }

  // 处理静态文件请求
  if (pathname.startsWith("/public/")) {
    return serveStaticFile(request, `.${pathname}`);
  }

  // --- 3. 代理逻辑 ---
  const [prefix, rest] = extractPrefixAndRest(pathname, Object.keys(apiMapping));
  if (!prefix) {
    return new Response("Not Found", { status: 404 });
  }

  const targetUrl = `${apiMapping[prefix]}${rest}`;

  try {
    const headers = new Headers();
    const allowedHeaders = ["accept", "content-type", "authorization"];
    for (const [key, value] of request.headers.entries()) {
      if (allowedHeaders.includes(key.toLowerCase())) {
        headers.set(key, value);
      }
    }

    const response = await fetch(targetUrl, {
      method: request.method,
      headers: headers,
      body: request.body
    });

    const responseHeaders = new Headers(response.headers);
    responseHeaders.set("X-Content-Type-Options", "nosniff");
    responseHeaders.set("X-Frame-Options", "DENY");
    responseHeaders.set("Referrer-Policy", "no-referrer");

    return new Response(response.body, {
      status: response.status,
      headers: responseHeaders
    });

  } catch (error) {
    console.error("代理请求失败:", error);
    return new Response("Internal Server Error", { status: 500 });
  }
}

// --- 认证相关函数 ---

/** 处理登录页面 */
function handleLoginPage(showError = false, attemptedUrl = "/") {
  const errorMessage = showError ? '<p class="error-message">密码错误，请重试</p>' : '';
  const htmlContent = `
<!DOCTYPE html>
<html lang="zh">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>需要登录</title>
    <style>
        body { display: flex; justify-content: center; align-items: center; min-height: 100vh; font-family: sans-serif, "Microsoft YaHei"; margin: 0; background: #f0f2f5; }
        .login-container { background: rgba(255, 255, 255, 0.9); padding: 40px; border-radius: 8px; box-shadow: 0 4px 15px rgba(0, 0, 0, 0.2); text-align: center; max-width: 400px; width: 90%; }
        h1 { color: #333; margin-bottom: 15px; font-size: 24px; }
        p { color: #555; margin-bottom: 30px; }
        label { display: block; text-align: left; margin-bottom: 8px; font-weight: bold; color: #444; }
        input[type="password"] { width: calc(100% - 24px); padding: 12px; margin-bottom: 20px; border: 1px solid #bbb; border-radius: 4px; font-size: 16px; }
        button { background: #007bff; color: white; padding: 12px 25px; border: none; border-radius: 4px; font-size: 16px; cursor: pointer; width: 100%; }
        button:hover { background: #0056b3; }
        .error-message { color: #dc3545; margin-bottom: 15px; font-weight: bold; }
    </style>
</head>
<body>
    <div class="login-container">
        <h1>需要登录</h1>
        <p>请输入密码以访问代理服务</p>
        ${errorMessage}
        <form method="POST" action="/auth-login">
            <label for="password">密码:</label>
            <input type="password" id="password" name="password" required autofocus>
            <input type="hidden" name="redirect_to" value="${encodeURIComponent(attemptedUrl)}">
            <button type="submit">登录</button>
        </form>
    </div>
</body>
</html>`;
  return new Response(htmlContent, {
    status: 401,
    headers: { "Content-Type": "text/html; charset=utf-8" }
  });
}

/** 处理登录表单提交 */
async function handleLoginSubmission(req) {
  if (!REQUIRED_PASSWORD) {
    return new Response("服务器未配置密码认证", { status: 500 });
  }

  try {
    const formData = await req.formData();
    const submittedPassword = formData.get("password");
    const redirectTo = formData.get("redirect_to") || "/";

    if (submittedPassword === REQUIRED_PASSWORD) {
      const headers = new Headers();
      setCookie(headers, {
        name: AUTH_COOKIE_NAME,
        value: "ok",
        path: "/",
        domain: PROXY_DOMAIN,
        httpOnly: true,
        secure: true,
        sameSite: "Lax",
        maxAge: 86400 * 30 // 30 天有效期
      });

      headers.set("Location", decodeURIComponent(redirectTo));
      return new Response(null, { status: 302, headers });
    } else {
      console.log("认证失败: 密码错误");
      return handleLoginPage(true, decodeURIComponent(redirectTo));
    }
  } catch (error) {
    console.error("处理登录表单时出错:", error);
    return new Response("登录处理失败", { status: 500 });
  }
}

/** 提取前缀和剩余路径 */
function extractPrefixAndRest(pathname, prefixes) {
  for (const prefix of prefixes) {
    if (pathname.startsWith(prefix)) {
      return [prefix, pathname.slice(prefix.length)];
    }
  }
  return [null, null];
}

/** 生成仪表盘页面 */
async function handleDashboardPage(): Promise<Response> {
  try {
    const htmlContent = await Deno.readTextFile("./public/index.html");
    return new Response(htmlContent, {
      status: 200,
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
  } catch (error) {
    console.error("读取 index.html 文件失败:", error);
    return new Response("Internal Server Error", { status: 500 });
  }
}

async function serveStaticFile(request: Request, filepath: string): Promise<Response> {
  try {
    return await serveFile(request, filepath);
  } catch {
    return new Response("Not Found", { status: 404 });
  }
}

// --- 启动服务器 ---
console.log(`服务器启动于 ${new Date().toISOString()}`);
if (REQUIRED_PASSWORD) {
  console.log(`认证已启用，访问: https://${PROXY_DOMAIN}:${PROXY_PORT}/`);
} else {
  console.warn(`认证已禁用，因为 PROXY_PASSWORD 未设置。访问: https://${PROXY_DOMAIN}:${PROXY_PORT}/`);
}

serve(async (req) => {
  try {
    return await (async () => await main(req))();
  } catch (e) {
    console.error(e);
    return new Response("Internal Server Error", { status: 500 });
  }
}, { port: parseInt(PROXY_PORT) });
