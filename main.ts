import { serve } from "https://deno.land/std@0.177.1/http/server.ts";
import { getCookies, Cookie, setCookie } from "https://deno.land/std@0.177.1/http/cookie.ts";

// --- Configuration ---
const ZLIB_BASE_URL = "z-library.sk"; // Use the appropriate base domain Z-Library resolves to
const AUTH_COOKIE_NAME = "proxy_auth_session"; // Name for the authentication cookie

// --- Get Password from Environment Variable ---
// !! IMPORTANT: Set PROXY_PASSWORD in your Deno Deploy environment variables !!
const REQUIRED_PASSWORD = Deno.env.get("PROXY_PASSWORD");
if (!REQUIRED_PASSWORD) {
  console.error("FATAL ERROR: PROXY_PASSWORD environment variable is not set!");
  console.error("Please set the PROXY_PASSWORD environment variable in your Deno Deploy project settings.");
  // Optional: Exit if password not set, otherwise auth is disabled
  // Deno.exit(1);
}

// --- Get Domain from Environment Variable ---
const PROXY_DOMAIN = Deno.env.get("PROXY_DOMAIN");

if (!PROXY_DOMAIN) {
    console.error("FATAL ERROR: PROXY_DOMAIN environment variable is not set!");
    console.error("Please set the PROXY_DOMAIN environment variable in your Deno Deploy project settings.");
    Deno.exit(1); // 可选：如果域名未设置，退出程序
}

// --- Main Request Handler ---
async function handler(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const path = url.pathname;

  // --- Uptime-Kuma Status Endpoint ---
  if (path === "/status") {
    return new Response("OK", { status: 200 });
  }

  const incomingCookies = getCookies(req.headers);

  // --- 1. Authentication Check ---
  if (REQUIRED_PASSWORD) {
      const isAuthenticated = await isValidAuthCookie(incomingCookies);

      if (!isAuthenticated) {
          if (req.method === 'POST' && path === '/auth-login') {
              return await handleLoginSubmission(req);
          }
          const attemptedUrl = path + url.search;
          return handleLoginPage(false, attemptedUrl);
      }
  } else {
      console.warn("Warning: PROXY_PASSWORD is not set. Authentication is disabled.");
  }

  // --- 2. Proxy Logic (Only if Authenticated) ---
  const lang = incomingCookies["lang"] || null; // Default to null if no lang cookie
  const targetHost = lang === 'zh' ? `zh.${ZLIB_BASE_URL}` : ZLIB_BASE_URL;
  const targetUrl = new URL(req.url);
  targetUrl.protocol = "https:";
  targetUrl.host = targetHost;
  targetUrl.port = "";

  try {
    const requestHeaders = getModifiedRequestHeaders(req.headers, targetHost, lang);
    console.log(`[Auth OK] [${new Date().toISOString()}] Requesting: ${targetUrl.toString()}`);

    const targetResponse = await fetch(targetUrl.toString(), {
      method: req.method,
      headers: requestHeaders,
      body: req.body,
      redirect: "manual", // Important: handle redirects manually
    });

    console.log(`[Auth OK] [${new Date().toISOString()}] Response Status from ${targetHost}: ${targetResponse.status}`);
    const responseHeaders = new Headers(targetResponse.headers);

    // Modify Response Headers (Location, Cookies, etc.)
    modifyResponseHeaders(responseHeaders, targetResponse, targetUrl, lang);

    return new Response(targetResponse.body, {
      status: targetResponse.status,
      statusText: targetResponse.statusText,
      headers: responseHeaders,
    });

  } catch (error) {
    console.error(`[Auth OK] [${new Date().toISOString()}] Proxy Error:`, error);
    if (error instanceof TypeError && error.message.includes('fetch failed')) {
         return new Response(`Proxy error: Could not connect to origin server (${targetHost}). Please try again later.`, { status: 502 });
    }
    return new Response("Proxy error occurred. Check logs.", { status: 500 });
  }
}

// --- Authentication Helper Functions ---

/** Checks if the authentication cookie is present and valid. */
async function isValidAuthCookie(cookies: Record<string, string>): Promise<boolean> {
    // Simple check: Does the cookie exist with the correct value?
    return cookies[AUTH_COOKIE_NAME] === "ok";
}

/** Displays the HTML login page */
function handleLoginPage(showError: boolean = false, attemptedUrl: string = "/"): Response {
    const backgroundImage = "https://raw.githubusercontent.com/Nshpiter/docker-accelerate/refs/heads/main/background.jpg";
    const errorMessage = showError ? '<p class="error-message">密码错误，请重试</p>' : '';
    const htmlContent = `
<!DOCTYPE html>
<html lang="zh">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>需要登录</title>
    <style>
        body{display:flex;justify-content:center;align-items:center;min-height:100vh;font-family:sans-serif,"Microsoft YaHei","SimHei";margin:0;background-image:url('${backgroundImage}');background-size:cover;background-position:center;background-repeat:no-repeat;}
        .login-container{background-color:rgba(255,255,255,0.85);padding:40px;border-radius:8px;box-shadow:0 4px 15px rgba(0,0,0,0.2);text-align:center;max-width:400px;width:90%;}
        h1{color:#333;margin-bottom:15px;font-size:24px;}
        p{color:#555;margin-bottom:30px;}
        label{display:block;text-align:left;margin-bottom:8px;font-weight:bold;color:#444;}
        input[type="password"]{width:calc(100% - 24px);padding:12px;margin-bottom:20px;border:1px solid #bbb;border-radius:4px;font-size:16px;background-color:rgba(255,255,255,0.9);}
        button{background-color:#007bff;color:white;padding:12px 25px;border:none;border-radius:4px;font-size:16px;font-weight:bold;cursor:pointer;width:100%;transition:background-color 0.3s ease;}
        button:hover{background-color:#0056b3;}
        .error-message{color:#dc3545;margin-bottom:15px;font-weight:bold;}
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
        status: 401, headers: { 'Content-Type': 'text/html; charset=utf-8' }
    });
}

/** Handles the submission of the login form. */
async function handleLoginSubmission(req: Request): Promise<Response> {
    if (!REQUIRED_PASSWORD) {
        console.error(`[${new Date().toISOString()}] Login submission attempt but PROXY_PASSWORD is not configured.`);
        return new Response("Authentication is not configured on the server.", { status: 500 });
    }
    try {
        const formData = await req.formData();
        const submittedPassword = formData.get("password") as string;
        const redirectTo = formData.get("redirect_to") as string || "/";

        if (submittedPassword === REQUIRED_PASSWORD) {
            const headers = new Headers();
            // --- *** START FIX *** ---
            const cookie: Cookie = {
                name: AUTH_COOKIE_NAME,
                value: "ok",
                path: "/",
                domain: PROXY_DOMAIN, // Explicitly set domain
                httpOnly: true,
                secure: true,
                sameSite: "Lax",
                maxAge: 86400 * 30, // 30 days
            };
            // --- *** END FIX *** ---
            setCookie(headers, cookie);

            // Redirect to the original destination or homepage
            headers.set("Location", redirectTo);
            return new Response(null, { status: 302, headers });

        } else {
            console.log(`[${new Date().toISOString()}] Authentication failed: Incorrect password attempt.`);
            const attemptedUrl = decodeURIComponent(redirectTo);
            return handleLoginPage(true, attemptedUrl);
        }
    } catch (error) {
         console.error(`[${new Date().toISOString()}] Error processing login form:`, error);
         return new Response("Error processing login request.", { status: 500 });
    }
}


/** Modifies response headers: Location, Set-Cookie, etc. */
function modifyResponseHeaders(responseHeaders: Headers, targetResponse: Response, targetUrl: URL, lang: string | null): void {
    // 1. Handle Redirects (Location Header)
     if (responseHeaders.has("location")) {
      const originalLocation = responseHeaders.get("location")!;
      try {
        const targetLocation = new URL(originalLocation, targetUrl);
        if (targetLocation.hostname.endsWith(ZLIB_BASE_URL)) {
          const newLocation = targetLocation.pathname + targetLocation.search + targetLocation.hash;
          responseHeaders.set("location", newLocation);
        }
      } catch (e) {
         if (originalLocation.startsWith("/")) {
            responseHeaders.set("location", originalLocation);
        } else { /* Keep external or potentially invalid ones */ }
      }
    }

    // 2. Remove problematic headers
    responseHeaders.delete("X-Frame-Options");
    responseHeaders.delete("Content-Security-Policy");
    responseHeaders.delete("Strict-Transport-Security");

    // 3. Process and Modify Set-Cookie Headers
    const originalSetCookieHeaders = targetResponse.headers.getSetCookie();
    responseHeaders.delete("Set-Cookie");

    for (const cookieString of originalSetCookieHeaders) {
        try {
            const modifiedCookieString = modifyCookieString(cookieString, PROXY_DOMAIN);
            if (modifiedCookieString) {
                responseHeaders.append("Set-Cookie", modifiedCookieString);
            }
        } catch (e) {
            console.error(`[${new Date().toISOString()}] Error processing cookie string "${cookieString}":`, e);
        }
    }

    // 4. Force Set siteLanguage Cookie (Always, if authenticated)
    const siteLanguageValue = lang === 'zh' ? 'zh' : 'en';
    const siteLanguageCookie: Cookie = {
      name: "siteLanguage", value: siteLanguageValue, path: "/",
      domain: PROXY_DOMAIN, // <<< Ensure domain is set here too
      secure: true, sameSite: "None",
      maxAge: 31536000 // 1 year
    };
    const siteLanguageCookieString = getCookieString(siteLanguageCookie);
    responseHeaders.append("Set-Cookie", siteLanguageCookieString);

    // 5. Vary Header
    if (!responseHeaders.has("Vary")) {
        responseHeaders.set("Vary", "Cookie");
    } else {
        const vary = responseHeaders.get("Vary")!;
        if (!vary.split(',').map(s => s.trim().toLowerCase()).includes('cookie')) {
            responseHeaders.set("Vary", `${vary}, Cookie`);
        }
    }
}

/** Creates modified headers for the outgoing request to Z-Library. */
function getModifiedRequestHeaders(originalHeaders: Headers, targetHost: string, lang: string | null): Headers {
  const headers = new Headers(originalHeaders);
  headers.set("Host", targetHost);
  headers.set("Referer", `https://${targetHost}/`);
  headers.set("Origin", `https://${targetHost}`);
  if (lang === 'zh') {
    headers.set("Accept-Language", "zh-CN,zh;q=0.9,en;q=0.8");
  } else {
     const originalAcceptLanguage = headers.get("Accept-Language");
     if (!originalAcceptLanguage || !originalAcceptLanguage.toLowerCase().startsWith('en')) {
        headers.set("Accept-Language", "en-US,en;q=0.9");
     }
  }
  headers.delete("via");
  headers.delete("x-forwarded-for");
  headers.delete("x-forwarded-host");
  headers.delete("x-forwarded-proto");
  headers.delete("x-real-ip");
  headers.delete("forwarded");
  return headers;
}

/** Parses a Set-Cookie string, modifies domain/attributes, and returns the new string. */
function modifyCookieString(cookieString: string, proxyDomain: string): string | null {
    if (!cookieString) return null;
    const parts = cookieString.split(';').map(part => part.trim());
    if (parts.length === 0) return null;
    const nameValueMatch = parts[0].match(/^([^=]+)=(.*)$/);
    if (!nameValueMatch) return null;
    const name = nameValueMatch[1];
    const value = nameValueMatch[2];

    if (name === AUTH_COOKIE_NAME) return null; // Ignore if Z-lib tries to set our auth cookie

    const modifiedAttributes = [`${name}=${value}`];
    let domainSet = false;

    for (let i = 1; i < parts.length; i++) {
        const attribute = parts[i];
        const lowerAttr = attribute.toLowerCase();
        if (lowerAttr.startsWith("domain=")) {
            modifiedAttributes.push(`Domain=${proxyDomain}`); // Always override
            domainSet = true;
        } else if (lowerAttr.startsWith("secure") || lowerAttr.startsWith("samesite=")) {
            // Skip, we will add them manually
        } else if (lowerAttr.startsWith("path=") || lowerAttr.startsWith("expires=") || lowerAttr.startsWith("max-age=") || lowerAttr.startsWith("httponly")) {
            modifiedAttributes.push(attribute); // Keep standard ones
        } else if(attribute) {
             modifiedAttributes.push(attribute); // Keep unknown ones
        }
    }

    if (!domainSet) modifiedAttributes.push(`Domain=${proxyDomain}`);
    modifiedAttributes.push("Secure"); // Always add Secure
    modifiedAttributes.push("SameSite=None"); // Use None for potential cross-site needs

    return [...new Set(modifiedAttributes)].join('; '); // Remove duplicates and join
}

/** Creates a Set-Cookie header string from a Cookie object. */
function getCookieString(cookie: Cookie): string {
    let parts = [`${cookie.name}=${encodeURIComponent(cookie.value)}`];
    if (cookie.expires) parts.push(`Expires=${cookie.expires.toUTCString()}`);
    if (cookie.maxAge !== undefined) parts.push(`Max-Age=${cookie.maxAge}`);
    if (cookie.domain) parts.push(`Domain=${cookie.domain}`); // <<< Use this
    if (cookie.path) parts.push(`Path=${cookie.path}`);
    if (cookie.secure) parts.push("Secure");
    if (cookie.httpOnly) parts.push("HttpOnly");
    if (cookie.sameSite) parts.push(`SameSite=${cookie.sameSite}`);
    return parts.join("; ");
}


// --- Start Server ---
console.log(`[${new Date().toISOString()}] Server starting...`);
if (REQUIRED_PASSWORD) {
    console.log(`[${new Date().toISOString()}] Authentication enabled. Access via https://${PROXY_DOMAIN}/`);
} else {
     console.warn(`[${new Date().toISOString()}] WARNING: Authentication DISABLED because PROXY_PASSWORD env var is not set. Access via https://${PROXY_DOMAIN}/`);
}
serve(handler);
