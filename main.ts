import { serve } from "https://deno.land/std/http/server.ts";
import { serveFile } from "https://deno.land/std/http/file_server.ts";

// --- Configuration ---
const apiMapping = {
  "/discord": "https://discord.com/api",
  "/telegram": "https://api.telegram.org",
  "/openai": "https://api.openai.com",
  "/claude": "https://api.anthropic.com",
  "/gemini": "https://generativelanguage.googleapis.com",
  "/meta": "https://www.meta.ai/api",
  "/groq": "https://api.groq.com/openai",
  "/xai": "https://api.x.ai",
  "/cohere": "https://api.cohere.ai",
  "/huggingface": "https://api-inference.huggingface.co",
  "/together": "https://api.together.xyz",
  "/novita": "https://api.novita.ai",
  "/portkey": "https://api.portkey.ai",
  "/fireworks": "https://api.fireworks.ai",
  "/openrouter": "https://openrouter.ai/api",
};

// 直接从 Deno.env 获取环境变量
// const REQUIRED_PASSWORD = Deno.env.get("PROXY_PASSWORD"); // 注释掉密码相关代码
const PROXY_DOMAIN = Deno.env.get("PROXY_DOMAIN");
const PROXY_PORT = Deno.env.get("PROXY_PORT") || "8000";

// 检查环境变量
// if (!REQUIRED_PASSWORD) {
//   console.warn("警告: PROXY_PASSWORD 未设置，认证将被禁用。");
// }
if (!PROXY_DOMAIN) {
  console.error("错误: PROXY_DOMAIN 未设置，请在环境变量中配置！");
  throw new Error("PROXY_DOMAIN 未设置，请在环境变量中配置！"); // 替换为抛出错误
}

// --- 主请求处理函数 ---
async function main(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const pathname = url.pathname;

  // --- 2. 处理特殊路径 ---
  if (pathname === "/" || pathname === "/index.html") {
    return handleDashboardPage(); // 返回仪表盘页面
  }

  if (pathname === "/robots.txt") {
    return new Response("User-agent: *\nDisallow: /", {
      status: 200,
      headers: { "Content-Type": "text/plain" },
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
      body: request.body,
    });

    const responseHeaders = new Headers(response.headers);
    responseHeaders.set("X-Content-Type-Options", "nosniff");
    responseHeaders.set("X-Frame-Options", "DENY");
    responseHeaders.set("Referrer-Policy", "no-referrer");

    return new Response(response.body, {
      status: response.status,
      headers: responseHeaders,
    });
  } catch (error) {
    console.error("代理请求失败:", error);
    return new Response("Internal Server Error", { status: 500 });
  }
}

/** 提取前缀和剩余路径 */
function extractPrefixAndRest(pathname: string, prefixes: string[]): [string | null, string | null] {
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
// if (REQUIRED_PASSWORD) {
//   console.log(`认证已启用，访问: https://${PROXY_DOMAIN}:${PROXY_PORT}/`);
// } else {
console.warn(`认证已禁用，访问: https://${PROXY_DOMAIN}:${PROXY_PORT}/`);
// }

serve(
  async (req) => {
    try {
      return await (async () => await main(req))();
    } catch (e) {
      console.error(e);
      return new Response("Internal Server Error", { status: 500 });
    }
  },
  { port: parseInt(PROXY_PORT) },
);
