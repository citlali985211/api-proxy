import { serve } from "https://deno.land/std/http/server.ts";
import { serveFile } from "https://deno.land/std/http/file_server.ts";

// --- Configuration ---
const apiMapping = {
  "/anthropic": "https://api.anthropic.com",
  "/cerebras": "https://api.cerebras.ai", // Added Cerebras based on original HTML
  "/cohere": "https://api.cohere.ai",
  "/discord": "https://discord.com/api",
  "/fireworks": "https://api.fireworks.ai",
  "/gemini": "https://generativelanguage.googleapis.com",
  "/groq": "https://api.groq.com/openai",
  "/huggingface": "https://api-inference.huggingface.co",
  "/meta": "https://www.meta.ai/api",
  "/novita": "https://api.novita.ai",
  "/nvidia": "https://integrate.api.nvidia.com", // Added Nvidia based on original HTML
  "/oaipro": "https://api.oaipro.com",         // Added OAIPro based on original HTML
  "/openai": "https://api.openai.com",
  "/openrouter": "https://openrouter.ai/api",
  "/portkey": "https://api.portkey.ai",
  "/reka": "https://api.reka.ai",             // Added Reka based on original HTML
  "/telegram": "https://api.telegram.org",
  "/together": "https://api.together.xyz",
  "/xai": "https://api.x.ai",
  // Note: Removed /claude as /anthropic seems to be the intended one based on original HTML
};

// Directly get environment variables from Deno.env
const PROXY_DOMAIN = Deno.env.get("PROXY_DOMAIN");
const PROXY_PORT = Deno.env.get("PROXY_PORT") || "8000"; // Default to 8000 if not set

// Check environment variable
if (!PROXY_DOMAIN) {
  const errorMsg = "错误: PROXY_DOMAIN 环境变量未设置。请设置它（例如 'export PROXY_DOMAIN=myproxy.example.com'）然后重试。";
  console.error(errorMsg);
  // Throwing an error is better practice for critical missing configuration
  throw new Error(errorMsg);
}

// --- Main Request Handler ---
async function main(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const pathname = url.pathname;

  // --- Handle Special Paths ---
  if (pathname === "/" || pathname === "/index.html") {
    // Pass the domain to the dashboard function
    return handleDashboardPage(apiMapping, PROXY_DOMAIN);
  }

  if (pathname === "/robots.txt") {
    return new Response("User-agent: *\nDisallow: /", {
      status: 200,
      headers: { "Content-Type": "text/plain" },
    });
  }

  // Handle static file requests (if any, e.g., for custom CSS/JS not from CDN)
  // Example: If you have a public/styles.css file
  if (pathname.startsWith("/public/")) {
    // Assuming your script is run from the project root
    // Deno Deploy might require different path handling
    return serveStaticFile(request, `.${pathname}`);
  }

  // --- Proxy Logic ---
  const [prefix, rest] = extractPrefixAndRest(pathname, Object.keys(apiMapping));

  if (!prefix) {
    // If no prefix matches, return 404
    return new Response("Not Found: Invalid API path.", { status: 404 });
  }

  const targetUrl = `${apiMapping[prefix]}${rest}${url.search}`; // Append query string

  try {
    // Prepare headers for the target request
    const headers = new Headers();
    // Forward essential headers, filter others for security/simplicity
    const allowedHeaders = ["accept", "content-type", "authorization"];
    for (const [key, value] of request.headers.entries()) {
      if (allowedHeaders.includes(key.toLowerCase())) {
        headers.set(key, value);
      }
      // You might need to forward more headers depending on the specific API
      // e.g., user-agent, custom auth headers
    }
     // Add or override headers if needed
     // headers.set("X-My-Proxy-Header", "Value");


    const response = await fetch(targetUrl, {
      method: request.method,
      headers: headers,
      body: request.body, // Pass through the request body
      // redirect: 'follow' // Optional: handle redirects automatically
    });

    // Prepare headers for the response back to the client
    const responseHeaders = new Headers(response.headers);
    // Add security headers
    responseHeaders.set("X-Content-Type-Options", "nosniff");
    responseHeaders.set("X-Frame-Options", "DENY");
    responseHeaders.set("Referrer-Policy", "no-referrer");
    // Allow CORS if necessary (be careful with `*`)
    // responseHeaders.set("Access-Control-Allow-Origin", "*");
    // responseHeaders.set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
    // responseHeaders.set("Access-Control-Allow-Headers", "Content-Type, Authorization");


    // Return the response from the target API
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: responseHeaders,
    });

  } catch (error) {
    console.error(`代理请求失败 for ${targetUrl}:`, error);
    // Return a generic error to the client
    return new Response("Internal Server Error: Proxy failed.", { status: 500 });
  }
}

/** Extracts the matching prefix and the rest of the path */
function extractPrefixAndRest(pathname: string, prefixes: string[]): [string | null, string | null] {
  // Sort prefixes by length descending to match longest prefix first (e.g., /openai/v1 before /openai)
  prefixes.sort((a, b) => b.length - a.length);
  for (const prefix of prefixes) {
    if (pathname.startsWith(prefix)) {
      return [prefix, pathname.slice(prefix.length)];
    }
  }
  return [null, null]; // No matching prefix found
}

/** Generates the dashboard HTML page */
async function handleDashboardPage(
    apiMapping: { [key: string]: string },
    domain: string
): Promise<Response> {
  let tableRows = "";
  // Sort keys alphabetically for consistent order
  const sortedPaths = Object.keys(apiMapping).sort();

  for (const proxyPath of sortedPaths) {
     const targetUrl = apiMapping[proxyPath];
     const fullProxyUrl = `https://${domain}${proxyPath}`; // Construct full proxy URL

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
        <td><span class="status-badge">在线</span></td> {/* Status is hardcoded for now */}
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
      <!-- Favicon -->
      <link rel="icon" href="data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><text y=%22.9em%22 font-size=%2290%22>🔌</text></svg>">
      <!-- Base Stylesheets -->
      <link href="https://cdn.jsdelivr.net/npm/tailwindcss@2.2.19/dist/tailwind.min.css" rel="stylesheet">
      <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
      <!-- Icon Library -->
      <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css">
      <!-- Animation Library -->
      <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/animate.css/4.1.1/animate.min.css">
      <style>
          :root {
            --header-gradient-start: #4f46e5;
            --header-gradient-end: #3b82f6;
            --status-badge-bg: #10b981; /* Emerald 500 */
            --link-color: #3b82f6; /* Blue 500 */
            --link-hover-color: #2563eb; /* Blue 600 */
            --code-bg: #f3f4f6; /* Gray 100 */
            --code-text: #4b5563; /* Gray 600 */
            --table-hover-bg: #f9fafb; /* Gray 50 */
          }
          body {
              font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif;
              background-color: #f3f4f6; /* Gray 100 */
              color: #1f2937; /* Gray 800 */
              line-height: 1.6;
          }
          .container {
              max-width: 1200px;
              margin: 2rem auto;
              padding: 0 1rem;
          }
          .header-card {
              background: linear-gradient(135deg, var(--header-gradient-start) 0%, var(--header-gradient-end) 100%);
              color: white;
              border-radius: 12px; /* Slightly larger radius */
              box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05);
          }
          .table-container {
              background: white;
              border-radius: 12px;
              box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
              overflow: hidden; /* Needed for border-radius on table */
              margin-top: 2rem;
          }
          table {
              width: 100%;
              border-collapse: collapse; /* Use collapse for cleaner lines */
              table-layout: fixed; /* Helps with column widths */
          }
          th, td {
              padding: 1rem 1.25rem; /* More padding */
              text-align: left;
              border-bottom: 1px solid #e5e7eb; /* Gray 200 */
              vertical-align: middle; /* Align content vertically */
          }
          th {
              background-color: #f9fafb; /* Gray 50 */
              font-weight: 600;
              color: #374151; /* Gray 700 */
              font-size: 0.875rem; /* Smaller heading */
              text-transform: uppercase;
              letter-spacing: 0.05em;
          }
          td {
              color: var(--code-text);
          }
          tbody tr:last-child td {
              border-bottom: none; /* Remove border from last row */
          }
          tbody tr:hover {
              background-color: var(--table-hover-bg);
          }
          .code {
              font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, Courier, monospace;
              background-color: var(--code-bg);
              color: var(--code-text);
              padding: 0.25rem 0.5rem;
              border-radius: 4px;
              font-size: 0.9em;
              display: inline-block; /* Allow truncation */
              max-width: 100%; /* Prevent overflow */
              overflow: hidden;
              text-overflow: ellipsis;
              white-space: nowrap; /* Keep on one line */
          }
          .footer {
              text-align: center;
              margin-top: 2.5rem;
              padding: 1.5rem 1rem;
              color: #6b7280; /* Gray 500 */
              font-size: 0.875rem;
              display: flex;
              align-items: center;
              justify-content: center;
              flex-wrap: wrap; /* Allow wrapping on small screens */
              gap: 0.25rem 0.75rem; /* Row and column gap */
          }
          .footer a {
              color: var(--link-color);
              text-decoration: none;
              font-weight: 500;
              display: inline-flex;
              align-items: center;
              transition: color 0.2s ease-in-out;
          }
          .footer a:hover {
              color: var(--link-hover-color);
              text-decoration: underline;
          }
          .service-icon {
              width: 20px; /* Slightly smaller icon */
              height: 20px;
              margin-right: 0.75rem; /* More space */
              color: #9ca3af; /* Gray 400 */
              flex-shrink: 0;
          }
          .copy-button {
              padding: 5px 10px; /* Slightly larger button */
              background-color: #e5e7eb; /* Gray 200 */
              color: #4b5563; /* Gray 600 */
              border-radius: 6px;
              border: none;
              cursor: pointer;
              transition: all 0.2s ease-in-out;
              display: inline-flex;
              align-items: center;
              justify-content: center;
              font-size: 0.8rem; /* Smaller icon inside */
          }
          .copy-button:hover {
              background-color: #d1d5db; /* Gray 300 */
              transform: translateY(-1px);
              box-shadow: 0 1px 3px rgba(0,0,0,0.1);
          }
          .copy-button.copied {
              background-color: var(--status-badge-bg);
              color: white;
          }
          .copy-button.copied i {
              animation: bounce 0.5s ease;
          }
          @keyframes bounce {
              0%, 100% { transform: scale(1); }
              50% { transform: scale(1.2); }
          }
          .status-badge {
              display: inline-block;
              padding: 3px 10px; /* Adjusted padding */
              border-radius: 9999px; /* Pill shape */
              font-size: 0.75rem; /* Smaller text */
              font-weight: 600;
              background-color: var(--status-badge-bg);
              color: white;
              text-transform: uppercase;
              letter-spacing: 0.05em;
          }
          .header-card h1 {
            font-weight: 700; /* Bolder title */
          }
          /* Responsive adjustments */
          @media (max-width: 768px) {
              th, td {
                  padding: 0.75rem;
              }
              .header-card h1 {
                  font-size: 1.875rem; /* Slightly smaller on mobile */
              }
              table {
                 display: block; /* Allow horizontal scroll */
                 overflow-x: auto;
                 white-space: nowrap;
              }
              th, td {
                  white-space: nowrap; /* Prevent wrapping inside cells */
              }
              .code { max-width: 250px; } /* Limit code width more strictly */
          }
          /* Add a subtle animation to the table rows on load */
          .animate__fadeInUp {
             opacity: 0; /* Start invisible for animation */
          }
      </style>
  </head>
  <body>
      <div class="container">
          <header class="header-card p-6 md:p-8 rounded-lg shadow-md animate__animated animate__fadeInDown">
              <div class="flex items-center mb-3">
                  <i class="fas fa-network-wired text-3xl mr-4 opacity-80"></i>
                  <h1 class="text-2xl md:text-3xl font-bold">API Proxy Service</h1>
              </div>
              <p class="opacity-90 text-sm md:text-base">
                  <i class="fas fa-shield-alt mr-2 opacity-80"></i>安全可靠的 API 代理服务
              </p>
          </header>

          <main class="table-container animate__animated animate__fadeIn" style="animation-delay: 0.2s;">
              <table>
                  <thead>
                      <tr>
                          <th style="width: 45%;">代理地址 <i class="fas fa-random text-gray-400 ml-2"></i></th>
                          <th style="width: 40%;">源地址 <i class="fas fa-link text-gray-400 ml-2"></i></th>
                          <th style="width: 15%;">状态 <i class="fas fa-signal text-gray-400 ml-2"></i></th>
                      </tr>
                  </thead>
                  <tbody>
                      <!-- API Mappings will be injected here by Deno -->
                      ${tableRows}
                  </tbody>
              </table>
          </main>

          <footer class="footer animate__animated animate__fadeInUp" style="animation-delay: 0.4s;">
              <i class="fas fa-code mr-1"></i> Created by
              <a href="https://linux.do/u/bbb/summary" target="_blank" rel="noopener noreferrer">
                  <img src="https://img.imgdd.com/f210f3.7ac6c2d9-138b-4c9b-affc-e2acbb4b0dc8.png" alt="Linux.do Avatar" class="w-4 h-4 mx-1 inline-block align-middle" style="margin-bottom: 2px;">
                  <strong>bbb</strong>
              </a>
              <span class="hidden md:inline mx-2">|</span>
              <span>本站服务器由 <a href="https://yxvm.com/" target="_blank" rel="noopener noreferrer"><strong>YxVM</strong></a> 赞助</span>
          </footer>
      </div>

      <!-- Popup placeholder (optional, based on original HTML) -->
      <!-- You can add the popup HTML and JS here if needed -->

      <script>
          function copyText(text, buttonElement) {
              if (!navigator.clipboard) {
                  // Fallback for older browsers
                  try {
                      const textarea = document.createElement('textarea');
                      textarea.value = text;
                      textarea.style.position = 'fixed'; // Prevent scrolling to bottom
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
              buttonElement.disabled = true; // Disable button briefly

              setTimeout(() => {
                  buttonElement.innerHTML = originalIcon;
                  buttonElement.classList.remove('copied');
                  buttonElement.disabled = false; // Re-enable button
              }, 1200); // Keep feedback slightly longer
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

/** Serves static files (basic implementation) */
async function serveStaticFile(request: Request, filepath: string): Promise<Response> {
  try {
    // Security: Basic check to prevent directory traversal
    // You might want a more robust check depending on your needs
    const resolvedPath = Deno.realPathSync(filepath);
    const projectRoot = Deno.realPathSync(".");
    if (!resolvedPath.startsWith(projectRoot)) {
        return new Response("Forbidden", { status: 403 });
    }

    const file = await Deno.open(resolvedPath, { read: true });
    const stat = await file.stat();

    if (stat.isDirectory) {
       file.close();
       // Optionally serve index.html from directories, or return 404/403
       return new Response("Not Found (is directory)", { status: 404 });
    }

    // Use Deno's built-in serveFile for proper header handling (Content-Type, ETag, etc.)
    // Note: serveFile needs the request object.
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
      // Basic request logging
      console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
      const response = await main(req);
      // Basic response logging
      console.log(`[${new Date().toISOString()}] ${req.method} ${req.url} - ${response.status}`);
      return response;
    } catch (e) {
      console.error("未捕获的错误:", e);
      return new Response("Internal Server Error", { status: 500 });
    }
  },
  // Ensure port is an integer
  { port: parseInt(PROXY_PORT, 10) }
);
