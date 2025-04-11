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
          <div class="flex-container">
            <code class="code">${fullProxyUrl}</code>
            <button class="copy-button" onclick="copyText('${fullProxyUrl}', this)">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
                <path d="M4 1.5H3a2 2 0 0 0-2 2V14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V3.5a2 2 0 0 0-2-2h-1v1h1a1 1 0 0 1 1 1V14a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V3.5a1 1 0 0 1 1-1h1v-1z"/>
                <path d="M9.5 1a.5.5 0 0 1 .5.5v1a.5.5 0 0 1-.5.5h-3a.5.5 0 0 1-.5-.5v-1a.5.5 0 0 1 .5-.5h3zm-3-1A1.5 1.5 0 0 0 5 1.5v1A1.5 1.5 0 0 0 6.5 4h3A1.5 1.5 0 0 0 11 2.5v-1A1.5 1.5 0 0 0 9.5 0h-3z"/>
              </svg>
              复制
            </button>
          </div>
        </td>
        <td><code class="code">${targetUrl}</code></td>
        <td>
          <div class="status-badge">
            <span class="pulse"></span>
            在线
          </div>
        </td>
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
            :root {
                --primary: #4f46e5;
                --primary-hover: #4338ca;
                --secondary: #06b6d4;
                --success: #10b981;
                --card-bg: rgba(255, 255, 255, 0.85);
                --card-border: rgba(255, 255, 255, 0.3);
                --text-primary: #1e293b;
                --text-secondary: #64748b;
            }
            
            * {
                box-sizing: border-box;
                margin: 0;
                padding: 0;
            }
            
            body {
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                color: var(--text-primary);
                line-height: 1.6;
                min-height: 100vh;
                background-image: url('https://raw.githubusercontent.com/Nshpiter/docker-accelerate/refs/heads/main/background.jpg');
                background-size: cover;
                background-position: center;
                background-repeat: no-repeat;
                background-attachment: fixed;
                position: relative;
            }
            
            body::before {
                content: '';
                position: absolute;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                background: rgba(15, 23, 42, 0.4);
                z-index: -1;
            }
            
            .container {
                max-width: 1100px;
                margin: 0 auto;
                padding: 40px 20px;
                position: relative;
                z-index: 1;
            }
            
            header {
                background: linear-gradient(135deg, rgba(79, 70, 229, 0.85), rgba(6, 182, 212, 0.85));
                backdrop-filter: blur(10px);
                -webkit-backdrop-filter: blur(10px);
                color: white;
                padding: 30px;
                border-radius: 16px;
                text-align: center;
                margin-bottom: 30px;
                box-shadow: 0 10px 30px rgba(0, 0, 0, 0.1);
                border: 1px solid rgba(255, 255, 255, 0.2);
                position: relative;
                overflow: hidden;
            }
            
            header::before {
                content: '';
                position: absolute;
                top: -50%;
                left: -50%;
                width: 200%;
                height: 200%;
                background: radial-gradient(
                    circle,
                    rgba(255, 255, 255, 0.1) 0%,
                    rgba(255, 255, 255, 0) 60%
                );
                z-index: 0;
                animation: rotate 60s linear infinite;
            }
            
            @keyframes rotate {
                0% {
                    transform: rotate(0deg);
                }
                100% {
                    transform: rotate(360deg);
                }
            }
            
            h1 {
                margin: 0;
                font-size: 28px;
                font-weight: 700;
                position: relative;
                z-index: 1;
                text-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
                letter-spacing: 0.5px;
            }
            
            .card {
                background: var(--card-bg);
                backdrop-filter: blur(16px);
                -webkit-backdrop-filter: blur(16px);
                border-radius: 16px;
                box-shadow: 0 20px 40px rgba(0, 0, 0, 0.1);
                border: 1px solid var(--card-border);
                overflow: hidden;
                transition: all 0.3s ease;
                margin-bottom: 30px;
            }
            
            table {
                width: 100%;
                border-collapse: separate;
                border-spacing: 0;
            }
            
            th, td {
                padding: 18px 24px;
                text-align: left;
            }
            
            th {
                background-color: rgba(249, 250, 251, 0.8);
                backdrop-filter: blur(10px);
                -webkit-backdrop-filter: blur(10px);
                font-weight: 600;
                position: sticky;
                top: 0;
                z-index: 10;
                border-bottom: 1px solid rgba(229, 231, 235, 0.5);
                color: var(--text-secondary);
                letter-spacing: 0.05em;
                text-transform: uppercase;
                font-size: 12px;
            }
            
            th:first-child {
                border-top-left-radius: 16px;
            }
            
            th:last-child {
                border-top-right-radius: 16px;
            }
            
            tr:last-child td:first-child {
                border-bottom-left-radius: 16px;
            }
            
            tr:last-child td:last-child {
                border-bottom-right-radius: 16px;
            }
            
            tr:not(:last-child) td {
                border-bottom: 1px solid rgba(229, 231, 235, 0.3);
            }
            
            tr:hover {
                background-color: rgba(255, 255, 255, 0.1);
            }
            
            .flex-container {
                display: flex;
                align-items: center;
                gap: 12px;
            }
            
            .code {
                background-color: rgba(243, 244, 246, 0.8);
                padding: 8px 12px;
                border-radius: 8px;
                font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace;
                font-size: 13px;
                word-break: break-all;
                box-shadow: 0 2px 5px rgba(0, 0, 0, 0.05);
                border: 1px solid rgba(229, 231, 235, 0.5);
                color: #334155;
            }
            
            .copy-button {
                display: flex;
                align-items: center;
                gap: 6px;
                background-color: var(--primary);
                color: white;
                border: none;
                padding: 8px 12px;
                border-radius: 8px;
                cursor: pointer;
                font-size: 13px;
                font-weight: 500;
                transition: all 0.2s ease;
                box-shadow: 0 4px 12px rgba(79, 70, 229, 0.15);
            }
            
            .copy-button:hover {
                background-color: var(--primary-hover);
                transform: translateY(-2px);
                box-shadow: 0 6px 16px rgba(79, 70, 229, 0.25);
            }
            
            .copy-button:active {
                transform: translateY(0);
            }
            
            .status-badge {
                display: inline-flex;
                align-items: center;
                gap: 8px;
                background-color: rgba(16, 185, 129, 0.15);
                color: var(--success);
                padding: 6px 12px;
                border-radius: 9999px;
                font-size: 13px;
                font-weight: 600;
                border: 1px solid rgba(16, 185, 129, 0.3);
            }
            
            .pulse {
                display: inline-block;
                width: 8px;
                height: 8px;
                border-radius: 50%;
                background-color: var(--success);
                box-shadow: 0 0 0 rgba(16, 185, 129, 0.4);
                animation: pulse 2s infinite;
            }
            
            @keyframes pulse {
                0% {
                    box-shadow: 0 0 0 0 rgba(16, 185, 129, 0.7);
                }
                70% {
                    box-shadow: 0 0 0 8px rgba(16, 185, 129, 0);
                }
                100% {
                    box-shadow: 0 0 0 0 rgba(16, 185, 129, 0);
                }
            }
            
            footer {
                margin-top: 30px;
                text-align: center;
                color: white;
                font-size: 14px;
                padding: 20px;
                position: relative;
                z-index: 1;
                text-shadow: 0 1px 2px rgba(0, 0, 0, 0.2);
            }
            
            .dashboard-stats {
                display: grid;
                grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
                gap: 20px;
                margin-bottom: 30px;
            }
            
            .stat-card {
                background: linear-gradient(135deg, rgba(255, 255, 255, 0.7), rgba(255, 255, 255, 0.5));
                backdrop-filter: blur(10px);
                -webkit-backdrop-filter: blur(10px);
                border-radius: 12px;
                padding: 24px;
                text-align: center;
                box-shadow: 0 10px 20px rgba(0, 0, 0, 0.05);
                border: 1px solid rgba(255, 255, 255, 0.3);
                transition: all 0.3s ease;
            }
            
            .stat-card:hover {
                transform: translateY(-5px);
                box-shadow: 0 15px 30px rgba(0, 0, 0, 0.1);
            }
            
            .stat-icon {
                width: 40px;
                height: 40px;
                margin: 0 auto 15px;
                display: flex;
                align-items: center;
                justify-content: center;
                background: linear-gradient(135deg, var(--primary), var(--secondary));
                border-radius: 12px;
                color: white;
            }
            
            .stat-number {
                font-size: 32px;
                font-weight: 700;
                margin-bottom: 5px;
                color: var(--text-primary);
                background: linear-gradient(135deg, var(--primary), var(--secondary));
                -webkit-background-clip: text;
                -webkit-text-fill-color: transparent;
            }
            
            .stat-label {
                color: var(--text-secondary);
                font-size: 14px;
                font-weight: 500;
            }
            
            @media (max-width: 768px) {
                .container {
                    padding: 20px 15px;
                }
                
                header {
                    padding: 20px;
                }
                
                h1 {
                    font-size: 24px;
                }
                
                .card {
                    overflow-x: auto;
                }
                
                table {
                    min-width: 600px;
                }
                
                .dashboard-stats {
                    grid-template-columns: 1fr;
                }
            }
            
            .glow {
                position: absolute;
                width: 40%;
                height: 200px;
                background: radial-gradient(
                    ellipse at center,
                    rgba(79, 70, 229, 0.3) 0%,
                    rgba(0, 0, 0, 0) 70%
                );
                border-radius: 50%;
                pointer-events: none;
                z-index: -1;
                opacity: 0.6;
                filter: blur(30px);
                animation: float 10s ease-in-out infinite;
            }
            
            .glow:nth-child(2) {
                left: 60%;
                top: 20%;
                background: radial-gradient(
                    ellipse at center,
                    rgba(6, 182, 212, 0.3) 0%,
                    rgba(0, 0, 0, 0) 70%
                );
                animation-delay: -5s;
            }
            
            @keyframes float {
                0% {
                    transform: translate(0, 0);
                }
                50% {
                    transform: translate(30px, 30px);
                }
                100% {
                    transform: translate(0, 0);
                }
            }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="glow"></div>
            <div class="glow"></div>
            
            <header>
                <h1>API 代理服务中心</h1>
            </header>
            
            <div class="dashboard-stats">
                <div class="stat-card">
                    <div class="stat-icon">
                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="currentColor" viewBox="0 0 16 16">
                            <path d="M14 1a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H2a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1h12zM2 0a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V2a2 2 0 0 0-2-2H2z"/>
                            <path d="M6.854 4.646a.5.5 0 0 1 0 .708L4.207 8l2.647 2.646a.5.5 0 0 1-.708.708l-3-3a.5.5 0 0 1 0-.708l3-3a.5.5 0 0 1 .708 0zm2.292 0a.5.5 0 0 0 0 .708L11.793 8l-2.647 2.646a.5.5 0 0 0 .708.708l3-3a.5.5 0 0 0 0-.708l-3-3a.5.5 0 0 0-.708 0z"/>
                        </svg>
                    </div>
                    <div class="stat-number">${Object.keys(apiMapping).length}</div>
                    <div class="stat-label">活跃代理</div>
                </div>
                
                <div class="stat-card">
                    <div class="stat-icon">
                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="currentColor" viewBox="0 0 16 16">
                            <path d="M8 3.5a.5.5 0 0 0-1 0V9a.5.5 0 0 0 .252.434l3.5 2a.5.5 0 0 0 .496-.868L8 8.71V3.5z"/>
                            <path d="M8 16A8 8 0 1 0 8 0a8 8 0 0 0 0 16zm7-8A7 7 0 1 1 1 8a7 7 0 0 1 14 0z"/>
                        </svg>
                    </div>
                    <div class="stat-number">100%</div>
                    <div class="stat-label">正常运行时间</div>
                </div>
                
                <div class="stat-card">
                    <div class="stat-icon">
                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="currentColor" viewBox="0 0 16 16">
                            <path d="M9.669.864 8 0 6.331.864l-1.858.282-.842 1.68-1.337 1.32L2.6 6l-.306 1.854 1.337 1.32.842 1.68 1.858.282L8 12l1.669-.864 1.858-.282.842-1.68 1.337-1.32L13.4 6l.306-1.854-1.337-1.32-.842-1.68L9.669.864zm1.196 1.193.684 1.365 1.086 1.072L12.387 6l.248 1.506-1.086 1.072-.684 1.365-1.51.229L8 10.874l-1.355-.702-1.51-.229-.684-1.365-1.086-1.072L3.614 6l-.25-1.506 1.087-1.072.684-1.365 1.51-.229L8 1.126l1.356.702 1.509.229z"/>
                            <path d="M4 11.794V16l4-1 4 1v-4.206l-2.018.306L8 13.126 6.018 12.1 4 11.794z"/>
                        </svg>
                    </div>
                    <div class="stat-number">A+</div>
                    <div class="stat-label">安全评级</div>
                </div>
                
                <div class="stat-card">
                    <div class="stat-icon">
                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="currentColor" viewBox="0 0 16 16">
                            <path d="M8.186 1.113a.5.5 0 0 0-.372 0L1.846 3.5l2.404.961L10.404 2l-2.218-.887zm3.564 1.426L5.596 5 8 5.961 14.154 3.5l-2.404-.961zm3.25 1.7-6.5 2.6v7.922l6.5-2.6V4.24zM7.5 14.762V6.838L1 4.239v7.923l6.5 2.6zM7.443.184a1.5 1.5 0 0 1 1.114 0l7.129 2.852A.5.5 0 0 1 16 3.5v8.662a1 1 0 0 1-.629.928l-7.185 2.874a.5.5 0 0 1-.372 0L.63 13.09a1 1 0 0 1-.63-.928V3.5a.5.5 0 0 1 .314-.464L7.443.184z"/>
                        </svg>
                    </div>
                    <div class="stat-number">${new Date().getFullYear()}</div>
                    <div class="stat-label">年度服务</div>
                </div>
            </div>

            <div class="card">
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
            </div>

            <footer>
                <p>© ${new Date().getFullYear()} API 代理服务 | 安全、高效、可靠</p>
            </footer>
        </div>

        <script>
            function copyText(text, button) {
                navigator.clipboard.writeText(text).then(() => {
                    const originalInnerHTML = button.innerHTML;
                    button.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16"><path d="M13.854 3.646a.5.5 0 0 1 0 .708l-7 7a.5.5 0 0 1-.708 0l-3.5-3.5a.5.5 0 1 1 .708-.708L6.5 10.293l6.646-6.647a.5.5 0 0 1 .708 0z"/></svg> 已复制!';
                    button.style.backgroundColor = '#10b981';
                    
                    setTimeout(() => {
                        button.innerHTML = originalInnerHTML;
                        button.style.backgroundColor = '#4f46e5';
                    }, 1500);
                }).catch(err => {
                    console.error('复制失败:', err);
                    alert('复制失败，请手动复制');
                });
            }
            
            // 添加悬停光效果
            document.addEventListener('mousemove', (e) => {
                const glows = document.querySelectorAll('.glow');
                const x = e.clientX / window.innerWidth;
                const y = e.clientY / window.innerHeight;
                
                glows.forEach((glow, index) => {
                    const offsetX = (index % 2 === 0 ? 1 : -1) * 30;
                    const offsetY = (index % 2 === 0 ? -1 : 1) * 30;
                    
                    glow.style.transform = `translate(${x * offsetX}px, ${y * offsetY}px)`;
                });
            });
        </script>
    </body>
    </html>
    `;

  return new Response(htmlContent, {
    status: 200,
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}
