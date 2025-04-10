import { serve } from "https://deno.land/std/http/server.ts";
import { serveFile } from "https://deno.land/std/http/file_server.ts";

// --- Configuration ---
const apiMapping = {
  "/anthropic": "https://api.anthropic.com",
  "/cerebras": "https://api.cerebras.ai",
  "/cohere": "https://api.cohere.ai",
  "/discord": "https://discord.com/api",
  "/fireworks": "https://api.fireworks.ai",
  "/gemini": "https://generativelanguage.googleapis.com",
  "/groq": "https://api.groq.com/openai",
  "/huggingface": "https://api-inference.huggingface.co",
  "/meta": "https://www.meta.ai/api",
  "/novita": "https://api.novita.ai",
  "/nvidia": "https://integrate.api.nvidia.com",
  "/oaipro": "https://api.oaipro.com",
  "/openai": "https://api.openai.com",
  "/openrouter": "https://openrouter.ai/api",
  "/portkey": "https://api.portkey.ai",
  "/reka": "https://api.reka.ai",
  "/telegram": "https://api.telegram.org",
  "/together": "https://api.together.xyz",
  "/xai": "https://api.x.ai",
};

// Directly get environment variables from Deno.env
const PROXY_DOMAIN = Deno.env.get("PROXY_DOMAIN");
const PROXY_PORT = Deno.env.get("PROXY_PORT") || "8000";

// Check environment variable
if (!PROXY_DOMAIN) {
  const errorMsg = "错误: PROXY_DOMAIN 环境变量未设置。请设置它（例如 'export PROXY_DOMAIN=myproxy.example.com'）然后重试。";
  console.error(errorMsg);
  throw new Error(errorMsg);
}

// --- Main Request Handler ---
async function main(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const pathname = url.pathname;

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

  const [prefix, rest] = extractPrefixAndRest(pathname, Object.keys(apiMapping));

  if (!prefix) {
    return new Response("Not Found: Invalid API path.", { status: 404 });
  }

  const targetUrl = `${apiMapping[prefix]}${rest}${url.search}`;

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
      statusText: response.statusText,
      headers: responseHeaders,
    });
  } catch (error) {
    console.error(`代理请求失败 for ${targetUrl}:`, error);
    return new Response("Internal Server Error: Proxy failed.", { status: 500 });
  }
}

function extractPrefixAndRest(pathname: string, prefixes: string[]): [string | null, string | null] {
  prefixes.sort((a, b) => b.length - a.length);
  for (const prefix of prefixes) {
    if (pathname.startsWith(prefix)) {
      return [prefix, pathname.slice(prefix.length)];
    }
  }
  return [null, null];
}

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
      <tr class="service-card animate__animated animate__fadeInUp" style="animation-delay: ${Object.keys(apiMapping).indexOf(proxyPath) * 0.05}s;">
        <td>
          <div class="flex items-center">
            <i class="fas fa-robot service-icon" title="${proxyPath.substring(1)}"></i>
            <code class="code flex-grow mr-2 truncate" title="${fullProxyUrl}">${fullProxyUrl}</code>
            <button class="copy-button ml-auto flex-shrink-0" onclick="copyText('${fullProxyUrl}', this)">
              <i class="far fa-copy"></i>
            </button>
          </div>
        </td>
        <td><code class="code truncate" title="${targetUrl}">${targetUrl}</code></td>
        <td><span class="status-badge">在线</span></td>
      </tr>
    `;
  }

  const htmlContent = `
  <!DOCTYPE html>
  <html lang="zh-CN">
  <head>
      <title>API Proxy Service</title>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <meta name="description" content="安全可靠的 API 代理服务，提供常用 AI 和其他 API 的代理访问点。">
      <link rel="icon" href="data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><text y=%22.9em%22 font-size=%2290%22>🔌</text></svg>">
      <link href="https://cdn.jsdelivr.net/npm/tailwindcss@2.2.19/dist/tailwind.min.css" rel="stylesheet">
      <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
      <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css">
      <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/animate.css/4.1.1/animate.min.css">
      <style>
          :root {
            --header-gradient-start: #7928CA; /* Purple */
            --header-gradient-end: #FF0080;   /* Pink */
            --status-badge-bg: #22C55E;   /* Green */
            --link-color: #3B82F6;       /* Blue */
            --link-hover-color: #6366F1;   /* Indigo */
            --code-bg: #F3F4F6;        /* Gray */
            --code-text: #4B5563;       /* Dark Gray */
            --table-hover-bg: #F9FAFB;     /* Light Gray */
            --font-family: 'Inter', sans-serif;
          }

          body {
              font-family: var(--font-family);
              background-color: #f8fafc; /* Light background */
              color: #334155; /* Darker text */
              line-height: 1.6;
              margin: 0;
              padding: 0;
              display: flex;
              flex-direction: column;
              min-height: 100vh;
          }

          .container {
              max-width: 1200px;
              margin: 2rem auto;
              padding: 0 1rem;
              flex: 1;
          }

          .header-card {
              background: linear-gradient(45deg, var(--header-gradient-start), var(--header-gradient-end));
              color: white;
              border-radius: 12px;
              box-shadow: 0 4px 8px rgba(0, 0, 0, 0.15);
              padding: 2rem;
              margin-bottom: 2rem;
              text-align: center;
          }

          .header-card h1 {
              font-size: 2.5rem;
              font-weight: 700;
              margin-bottom: 0.5rem;
              letter-spacing: -0.05em;
          }

          .header-card p {
              font-size: 1.125rem;
              opacity: 0.9;
          }

          .table-container {
              background-color: #fff;
              border-radius: 12px;
              box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px -1px rgba(0, 0, 0, 0.1);
              overflow-x: auto; /* Handle overflow on smaller screens */
          }

          table {
              width: 100%;
              border-collapse: collapse;
              table-layout: fixed; /* Prevents content from overflowing */
          }

          th, td {
              padding: 1rem;
              text-align: left;
              border-bottom: 1px solid #e5e7eb;
              word-break: break-all; /* Breaks long words */
          }

          th {
              font-weight: 600;
              color: #6b7280;
              text-transform: uppercase;
              font-size: 0.875rem;
          }

          tbody tr:hover {
              background-color: var(--table-hover-bg);
          }

          .code {
              font-family: monospace;
              background-color: var(--code-bg);
              color: var(--code-text);
              padding: 0.25rem 0.5rem;
              border-radius: 6px;
              font-size: 0.875rem;
              word-break: break-all;
          }

          .service-icon {
              width: 20px;
              height: 20px;
              margin-right: 0.5rem;
              color: #9ca3af;
              flex-shrink: 0;
          }

          .copy-button {
              background-color: #e5e7eb;
              color: #4b5563;
              border: none;
              border-radius: 0.5rem;
              padding: 0.5rem 0.75rem;
              cursor: pointer;
              transition: background-color 0.2s, transform 0.1s;
              display: inline-flex;
              align-items: center;
              font-size: 0.75rem;
          }

          .copy-button:hover {
              background-color: #d1d5db;
          }

          .copy-button:active {
              transform: scale(0.95);
          }

          .status-badge {
              display: inline-block;
              padding: 0.375rem 0.75rem;
              border-radius: 9999px;
              font-size: 0.75rem;
              font-weight: 600;
              background-color: var(--status-badge-bg);
              color: white;
          }

          .footer {
              text-align: center;
              padding: 1.5rem;
              color: #6b7280;
              font-size: 0.875rem;
              margin-top: 2rem;
              border-top: 1px solid #e5e7eb;
          }

          .footer a {
              color: var(--link-color);
              text-decoration: none;
          }

          .footer a:hover {
              text-decoration: underline;
          }

          @media (max-width: 768px) {
              .header-card {
                  padding: 1.5rem;
              }

              .header-card h1 {
                  font-size: 2rem;
              }

              th, td {
                  padding: 0.75rem;
              }
          }
      </style>
  </head>
  <body>
      <div class="container">
          <header class="header-card animate__animated animate__fadeInDown">
              <h1>API Proxy Service</h1>
              <p>安全可靠的 API 代理服务</p>
          </header>

          <main class="table-container animate__animated animate__fadeIn" style="animation-delay: 0.2s;">
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
          </main>

          <footer class="footer">
              Created by
              <a href="https://jxufe.icu/u/piter/summary" target="_blank" rel="noopener noreferrer">
                  piter
              </a>
              |
              本站由
              <a href="https://jxufe.icu" target="_blank" rel="noopener noreferrer">
                  deno
              </a>
              赞助
          </footer>
      </div>

      <script>
          function copyText(text, buttonElement) {
              if (!navigator.clipboard) {
                  try {
                      const textarea = document.createElement('textarea');
                      textarea.value = text;
                      textarea.style.position = 'fixed';
                      document.body.appendChild(textarea);
                      textarea.focus();
                      textarea.select();
                      document.execCommand('copy');
                      document.body.removeChild(textarea);
                      showCopiedFeedback(buttonElement);
                  } catch (err) {
                      console.error('Fallback: Oops, unable to copy', err);
                      alert('复制失败，请手动复制。');
                  }
                  return;
              }
              navigator.clipboard.writeText(text).then(() => {
                  showCopiedFeedback(buttonElement);
              }).catch(err => {
                  console.error('Async: Could not copy text: ', err);
                  alert('复制失败，请检查浏览器权限或手动复制。');
              });
          }

          function showCopiedFeedback(buttonElement) {
              const originalIcon = buttonElement.innerHTML;
              buttonElement.innerHTML = '<i class="fas fa-check"></i>';
              buttonElement.classList.add('copied');
              buttonElement.disabled = true;

              setTimeout(() => {
                  buttonElement.innerHTML = originalIcon;
                  buttonElement.classList.remove('copied');
                  buttonElement.disabled = false;
              }, 1200);
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
console.warn(`请通过 HTTPS 访问: https://${PROXY_DOMAIN}/ (假设端口 443 由反向代理处理)`);
console.log("可用代理路径:");
Object.keys(apiMapping).sort().forEach(p => console.log(`  - https://${PROXY_DOMAIN}${p} -> ${apiMapping[p]}`));

serve(
  async (req) => {
    try {
      console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
      const response = await main(req);
      console.log(`[${new Date().toISOString()}] ${req.method} ${req.url} - ${response.status}`);
      return response;
    } catch (e) {
      console.error("未捕获的错误:", e);
      return new Response("Internal Server Error", { status: 500 });
    }
  },
  { port: parseInt(PROXY_PORT, 10) }
);
