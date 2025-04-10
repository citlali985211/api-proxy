import { serve } from "https://deno.land/std/http/server.ts";
import { calculateHash } from "https://deno.land/std@0.177.0/crypto/mod.ts";
import { decodeBase64 } from "https://deno.land/std@0.190.0/encoding/base64.ts";

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
  '/openrouter': 'https://openrouter.ai/api',
  '/perplexity': 'https://api.perplexity.ai', // 添加 perplexity 代理
};

const username = Deno.env.get("USERNAME") || "admin";
const password = Deno.env.get("PASSWORD") || "password";

async function handleRequest(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const pathname = url.pathname;

  // 鉴权只针对根路径和 index.html
  if (pathname === '/' || pathname === '/index.html') {
    const authHeader = request.headers.get("authorization");

    if (!authHeader) {
      return new Response(
        "Authentication required",
        {
          status: 401,
          headers: {
            "WWW-Authenticate": 'Basic realm="Access to the website"',
          },
        },
      );
    }

    const [authType, authString] = authHeader.split(" ");
    if (authType !== "Basic" || !authString) {
      return new Response("Invalid authentication format", { status: 400 });
    }

    const decodedAuth = new TextDecoder().decode(decodeBase64(authString));
    const [providedUsername, providedPassword] = decodedAuth.split(":");

    if (providedUsername !== username || providedPassword !== password) {
      return new Response("Invalid credentials", { status: 401 });
    }

    return new Response('Service is running!', {
      status: 200,
      headers: { 'Content-Type': 'text/html' }
    });
  }

  if (pathname === '/robots.txt') {
    return new Response('User-agent: *\nDisallow: /', {
      status: 200,
      headers: { 'Content-Type': 'text/plain' }
    });
  }

  const [prefix, rest] = extractPrefixAndRest(pathname, Object.keys(apiMapping));
  if (!prefix) {
    return new Response('Not Found', { status: 404 });
  }

  const targetUrl = `${apiMapping[prefix]}${rest}${url.search}`;
  console.log(`Proxying to: ${targetUrl}`);

  try {
    const headers = new Headers();
    const allowedHeaders = ['accept', 'content-type', 'authorization', 'cookie']; // 添加 cookie
    for (const [key, value] of request.headers.entries()) {
      if (allowedHeaders.includes(key.toLowerCase())) {
        headers.set(key, value);
      }
    }

    let body = null;
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      body = request.body;
    }

    const response = await fetch(targetUrl, {
      method: request.method,
      headers: headers,
      body: body,
      redirect: 'manual' // 重要：处理重定向
    });

    const responseHeaders = new Headers(response.headers);
    responseHeaders.set('X-Content-Type-Options', 'nosniff');
    responseHeaders.set('X-Frame-Options', 'DENY');
    responseHeaders.set('Referrer-Policy', 'no-referrer');
    responseHeaders.set('Access-Control-Allow-Origin', '*');  // Add CORS header
    responseHeaders.set('Access-Control-Allow-Methods', '*');
    responseHeaders.set('Access-Control-Allow-Headers', '*');

    // 处理重定向
    if (response.status >= 300 && response.status < 400) {
        const redirectUrl = response.headers.get('location');
        if (redirectUrl) {
            responseHeaders.set('location', redirectUrl); // 直接返回重定向URL
        }
    }

    console.log(`Response Status: ${response.status}`);

    return new Response(response.body, {
      status: response.status,
      headers: responseHeaders
    });

  } catch (error) {
    console.error('Failed to fetch:', error);
    return new Response('Internal Server Error', { status: 500 });
  }
}

serve(handleRequest);

function extractPrefixAndRest(pathname: string, prefixes: string[]): [string | null, string | null] {
  for (const prefix of prefixes) {
    if (pathname.startsWith(prefix)) {
      return [prefix, pathname.slice(prefix.length)];
    }
  }
  return [null, null];
}
