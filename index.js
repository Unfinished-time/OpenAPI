const express = require('express');
const fs = require('fs');
const path = require('path');
const morgan = require('morgan');
const app = express();
const ini = require('ini');
const chokidar = require('chokidar');
const pluginManager = require('./core/pluginManager');
const session = require('express-session');

const configPath = './config.ini';

// 检查配置文件是否存在
if (!fs.existsSync(configPath)) {
    console.log('未检测到配置文件，正在创建...');
    require('./core/gen_config');
}

// 初始化服务状态
global._status = {
    isAvailable: true,
    lastCheck: new Date().toISOString(),
    message: "服务运行正常"
};

global._config = ini.parse(fs.readFileSync(configPath, 'utf-8'));

const port = _config.app.port;

morgan.token('remote-addr', function (req) {
    return req.headers['x-forwarded-for'] || req.connection.remoteAddress;
});

var format = '= :remote-addr - :remote-user [:date[clf]] ":method :url HTTP/:http-version" :status :res[content-length] :referrer';

// 添加一个自定义中间件来计算响应时间
const responseTimeLogger = (req, res, next) => {
    const startTime = Date.now(); // 记录请求开始时间

    res.on('finish', () => {
        const endTime = Date.now(); // 记录请求结束时间
        const elapsedTime = endTime - startTime; // 计算响应时间
        console.log(`~ [中间件] 请求响应时间: ${elapsedTime}ms`); // 输出响应时间到console
    });

    next();
};

// 响应时间
app.use(responseTimeLogger);
// 输出请求日志
app.use(morgan(format));
// 载入静态资源
app.use(express.static('public'));

// 添加 session 中间件
app.use(session({
    secret: 'icat-admin-secret',
    resave: false,
    saveUninitialized: true,
}));

// 修改服务状态检查中间件
app.use((req, res, next) => {
    // 允许访问登录页面和主页，以及已登录用户的管理页面和状态控制
    if (req.path === '/' || 
        req.path === '/login' || 
        (req.session.isLoggedIn && (req.path === '/admin' || req.path.startsWith('/status/')))) {
        return next();
    }
    
    // 如果是未登录用户访问 /admin 或 /status，重定向到登录页
    if (req.path === '/admin' || req.path.startsWith('/status/')) {
        return res.redirect('/login');
    }
    
    // 检查服务状态
    if (!global._status.isAvailable) {
        return res.status(503).send(`
            <html>
                <head>
                    <meta charset="UTF-8">
                    <meta name="viewport" content="width=device-width, initial-scale=1.0">
                    <title>服务暂时不可用 - iCat OpenAPI</title>
                    <style>
                        body {
                            font-family: "Microsoft YaHei", Arial, sans-serif;
                            background: #f5f5f5;
                            margin: 0;
                            padding: 0;
                            display: flex;
                            justify-content: center;
                            align-items: center;
                            height: 100vh;
                            color: #333;
                        }
                        .container {
                            background: white;
                            padding: 40px;
                            border-radius: 10px;
                            box-shadow: 0 2px 20px rgba(0,0,0,0.1);
                            text-align: center;
                            max-width: 500px;
                            width: 90%;
                        }
                        .icon {
                            font-size: 60px;
                            margin-bottom: 20px;
                            color: #e74c3c;
                        }
                        h1 {
                            color: #2c3e50;
                            margin: 0 0 20px 0;
                            font-size: 24px;
                        }
                        .message {
                            color: #666;
                            line-height: 1.6;
                            margin-bottom: 25px;
                        }
                        .status-code {
                            background: #f8f9fa;
                            padding: 8px 15px;
                            border-radius: 4px;
                            color: #666;
                            font-family: monospace;
                            font-size: 14px;
                            display: inline-block;
                            margin-top: 15px;
                        }
                        .refresh {
                            color: #3498db;
                            text-decoration: none;
                            margin-top: 20px;
                            display: inline-block;
                            transition: color 0.3s;
                        }
                        .refresh:hover {
                            color: #2980b9;
                        }
                    </style>
                </head>
                <body>
                    <div class="container">
                        <div class="icon">⚠️</div>
                        <h1>服务暂时不可用</h1>
                        <div class="message">
                            ${global._status.message}<br>
                            请稍后再试或联系管理员
                        </div>
                        <div class="status-code">状态码: 503</div>
                        <br>
                        <a href="javascript:location.reload()" class="refresh">点击刷新页面</a>
                    </div>
                </body>
            </html>
        `);
    }

    // 检查请求的插件状态
    const requestedPlugin = pluginManager.getPluginByPath(req.path);
    if (requestedPlugin && !requestedPlugin.enabled) {
        return res.status(403).send(`
            <html>
                <head>
                    <meta charset="UTF-8">
                    <meta name="viewport" content="width=device-width, initial-scale=1.0">
                    <title>插件已停用 - iCat OpenAPI</title>
                    <style>
                        body {
                            font-family: "Microsoft YaHei", Arial, sans-serif;
                            background: #f5f5f5;
                            margin: 0;
                            padding: 0;
                            display: flex;
                            justify-content: center;
                            align-items: center;
                            height: 100vh;
                            color: #333;
                        }
                        .container {
                            background: white;
                            padding: 40px;
                            border-radius: 10px;
                            box-shadow: 0 2px 20px rgba(0,0,0,0.1);
                            text-align: center;
                            max-width: 500px;
                            width: 90%;
                        }
                        .icon {
                            font-size: 60px;
                            margin-bottom: 20px;
                            color: #e74c3c;
                        }
                        h1 {
                            color: #2c3e50;
                            margin: 0 0 20px 0;
                            font-size: 24px;
                        }
                        .message {
                            color: #666;
                            line-height: 1.6;
                            margin-bottom: 25px;
                        }
                        .status-code {
                            background: #f8f9fa;
                            padding: 8px 15px;
                            border-radius: 4px;
                            color: #666;
                            font-family: monospace;
                            font-size: 14px;
                            display: inline-block;
                            margin-top: 15px;
                        }
                        .back-home {
                            color: #3498db;
                            text-decoration: none;
                            margin-top: 20px;
                            display: inline-block;
                            transition: color 0.3s;
                        }
                        .back-home:hover {
                            color: #2980b9;
                        }
                    </style>
                </head>
                <body>
                    <div class="container">
                        <div class="icon">🚫</div>
                        <h1>插件已停用</h1>
                        <div class="message">
                            该API插件当前处于停用状态<br>
                            请联系管理员启用插件后再试
                        </div>
                        <div class="status-code">状态码: 403</div>
                        <br>
                        <a href="/" class="back-home">返回首页</a>
                    </div>
                </body>
            </html>
        `);
    }

    next();
});

// 添加登录验证中间件
const authMiddleware = (req, res, next) => {
    if (req.session.isLoggedIn) {
        next();
    } else {
        res.redirect('/login');
    }
};

let date = new Date()

console.log('欢迎使用 iCat OpenAPI 服务核心.\n启动时间：' + date.toISOString() + ' | Node版本:' + process.version + '\n~ 正在启动服务，请稍等...');
if (_config.app.debug) {
    console.log('[DEBUG] 已启用 Debug 模式，将会输出更多日志。')
}

// 先定义基本路由
app.get('/', (req, res) => {
    let date = new Date();
    var currentYear = date.getFullYear();
    res.send(`
        <html>
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>iCat OpenAPI</title>
                <style>
                    body { 
                        font-family: "Microsoft YaHei", Arial, sans-serif; 
                        margin: 0;
                        padding: 0;
                        background: linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%);
                        min-height: 100vh;
                        display: flex;
                        justify-content: center;
                        align-items: center;
                    }
                    .container { 
                        max-width: 800px;
                        width: 90%;
                        margin: 40px auto;
                        padding: 30px;
                        background: rgba(255, 255, 255, 0.95);
                        border-radius: 15px;
                        box-shadow: 0 8px 30px rgba(0,0,0,0.1);
                        backdrop-filter: blur(10px);
                        transition: transform 0.3s ease;
                    }
                    .container:hover {
                        transform: translateY(-5px);
                    }
                    h1 { 
                        color: #2c3e50;
                        border-bottom: 2px solid #eee;
                        padding-bottom: 15px;
                        margin-bottom: 25px;
                        text-align: center;
                        font-size: 2.2em;
                    }
                    .info { 
                        color: #34495e;
                        line-height: 1.6;
                        padding: 20px;
                        background: #f8f9fa;
                        border-radius: 10px;
                        margin: 20px 0;
                    }
                    .status-box {
                        display: flex;
                        align-items: center;
                        margin: 15px 0;
                        padding: 15px;
                        background: #fff;
                        border-radius: 8px;
                        box-shadow: 0 2px 10px rgba(0,0,0,0.05);
                    }
                    .status-indicator {
                        width: 12px;
                        height: 12px;
                        border-radius: 50%;
                        margin-right: 10px;
                        animation: pulse 2s infinite;
                    }
                    @keyframes pulse {
                        0% { transform: scale(0.95); opacity: 0.5; }
                        50% { transform: scale(1); opacity: 1; }
                        100% { transform: scale(0.95); opacity: 0.5; }
                    }
                    .status-yes { 
                        color: #27ae60; 
                        font-weight: bold;
                    }
                    .status-yes .status-indicator {
                        background: #27ae60;
                    }
                    .status-no { 
                        color: #c32d2d; 
                        font-weight: bold;
                    }
                    .status-no .status-indicator {
                        background: #c32d2d;
                    }
                    .feature-list {
                        display: grid;
                        grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
                        gap: 20px;
                        margin: 25px 0;
                    }
                    .feature-item {
                        padding: 20px;
                        background: #fff;
                        border-radius: 10px;
                        box-shadow: 0 2px 15px rgba(0,0,0,0.05);
                        transition: all 0.3s ease;
                    }
                    .feature-item:hover {
                        transform: translateY(-3px);
                        box-shadow: 0 5px 20px rgba(0,0,0,0.1);
                    }
                    .feature-icon {
                        font-size: 1.5em;
                        margin-bottom: 10px;
                        color: #3498db;
                    }
                    footer { 
                        margin-top: 40px;
                        padding-top: 20px;
                        border-top: 1px solid #eee;
                        color: #7f8c8d;
                        text-align: center;
                        font-size: 0.9em;
                    }
                    .last-check {
                        font-size: 0.9em;
                        color: #666;
                        margin-top: 5px;
                    }
                    .github-link {
                        display: inline-block;
                        margin-top: 20px;
                        padding: 10px 20px;
                        background: #24292e;
                        color: white;
                        text-decoration: none;
                        border-radius: 5px;
                        transition: background 0.3s ease;
                    }
                    .github-link:hover {
                        background: #1a1e22;
                    }
                </style>
            </head>
            <body>
                <div class="container">
                    <h1>iCat OpenAPI</h1>
                    <div class="info">
                        <p>欢迎使用 iCat OpenAPI</p>
                        <div class="status-box ${_status.isAvailable ? 'status-yes' : 'status-no'}">
                            <div class="status-indicator"></div>
                            <span>服务状态：${_status.message}</span>
                        </div>
                        <div class="last-check">最后检查时间：${_status.lastCheck}</div>
                    </div>
                    
                    <div class="feature-list">
                        <div class="feature-item">
                            <div class="feature-icon">🔄</div>
                            <h3>多格式支持</h3>
                            <p>支持多种数据格式的响应，灵活适应不同需求</p>
                        </div>
                        <div class="feature-item">
                            <div class="feature-icon">⚡</div>
                            <h3>实时更新</h3>
                            <p>接口实时更新，确保服务始终可用</p>
                        </div>
                        <div class="feature-item">
                            <div class="feature-icon">🛡️</div>
                            <h3>稳定可靠</h3>
                            <p>提供稳定可靠的服务保障</p>
                        </div>
                    </div>

                    <a href="https://github.com/zatursure/OpenAPI" class="github-link">
                        此项目已在Github开源
                    </a>

                    <footer>
                        <p>${_config.app.server_name}</p>
                        <p>&copy; ${currentYear} ${_config.app.copyright} - 保留所有权利</p>
                    </footer>
                </div>
                <script>
                    // 添加简单的交互动画
                    document.querySelectorAll('.feature-item').forEach(item => {
                        item.addEventListener('mouseenter', () => {
                            item.style.transform = 'translateY(-5px)';
                        });
                        item.addEventListener('mouseleave', () => {
                            item.style.transform = 'translateY(0)';
                        });
                    });
                </script>
            </body>
        </html>
    `);
});

app.get('/login', (req, res) => {
    res.send(`
        <html>
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>登录管理面板 - iCat OpenAPI</title>
                <style>
                    body { font-family: "Microsoft YaHei", Arial, sans-serif; margin: 40px; background: #f5f5f5; }
                    .container { max-width: 400px; margin: 0 auto; padding: 20px; background: #fff; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
                    h1 { color: #2c3e50; text-align: center; }
                    .form-group { margin-bottom: 15px; }
                    input { width: 100%; padding: 8px; margin-top: 5px; border: 1px solid #ddd; border-radius: 4px; }
                    button { width: 100%; padding: 10px; background: #2c3e50; color: white; border: none; border-radius: 4px; cursor: pointer; }
                    .error { color: red; text-align: center; }
                </style>
            </head>
            <body>
                <div class="container">
                    <h1>欢迎使用管理面板</h1>
                    <form action="/login" method="POST">
                        <div class="form-group">
                            <label>用户名：</label>
                            <input type="text" name="username" required>
                        </div>
                        <div class="form-group">
                            <label>密码：</label>
                            <input type="password" name="password" required>
                        </div>
                        <button type="submit">登录</button>
                    </form>
                </div>
            </body>
        </html>
    `);
});

app.post('/login', express.urlencoded({ extended: true }), (req, res) => {
    const { username, password } = req.body;
    // 这里使用配置文件中的管理员账号密码
    if (username === _config.admin.username && password === _config.admin.password) {
        req.session.isLoggedIn = true;
        res.redirect('/admin');
    } else {
        res.send('登录失败，用户名或密码错误');
    }
});

app.get('/logout', (req, res) => {
    req.session.isLoggedIn = false;
    res.redirect('/login');
});

// 修改管理面板路由，添加验证中间件
app.get('/admin', authMiddleware, (req, res) => {
    const plugins = pluginManager.getPlugins();
    
    res.send(`
        <html>
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>管理面板 - iCat OpenAPI</title>
                <style>
                    body { 
                        font-family: "Microsoft YaHei", Arial, sans-serif; 
                        margin: 0; 
                        padding: 0; 
                        background: #f5f5f5; 
                    }
                    .navbar {
                        background: #2c3e50;
                        color: white;
                        padding: 1rem;
                        position: fixed;
                        top: 0;
                        left: 0;
                        right: 0;
                        z-index: 1000;
                        display: flex;
                        justify-content: space-between;
                        align-items: center;
                        box-shadow: 0 2px 4px rgba(0,0,0,0.1);
                    }
                    .navbar-brand {
                        font-size: 1.5em;
                        font-weight: bold;
                        color: white;
                        text-decoration: none;
                    }
                    .navbar-nav {
                        display: flex;
                        align-items: center;
                        gap: 20px;
                    }
                    .nav-link {
                        color: #ecf0f1;
                        text-decoration: none;
                        padding: 8px 15px;
                        border-radius: 4px;
                        transition: all 0.3s ease;
                    }
                    .nav-link:hover {
                        background: rgba(255,255,255,0.1);
                    }
                    .nav-link.logout {
                        background: #c0392b;
                    }
                    .nav-link.logout:hover {
                        background: #e74c3c;
                    }
                    .main-content {
                        margin-top: 80px;
                        padding: 20px;
                    }
                    .container { 
                        max-width: 1200px; 
                        margin: 0 auto; 
                        padding: 20px;
                    }
                    .card {
                        background: #fff;
                        border-radius: 8px;
                        box-shadow: 0 2px 4px rgba(0,0,0,0.1);
                        margin-bottom: 20px;
                        overflow: hidden;
                    }
                    .card-header {
                        background: #f8f9fa;
                        padding: 15px 20px;
                        border-bottom: 1px solid #eee;
                    }
                    .card-body {
                        padding: 20px;
                    }
                    .status-panel { 
                        margin: 20px 0; 
                        padding: 20px;
                    }
                    .status-yes { color: #27ae60; }
                    .status-no { color: #c32d2d; }
                    .btn { 
                        padding: 10px 20px; 
                        border: none; 
                        border-radius: 4px; 
                        cursor: pointer; 
                        margin: 5px;
                        transition: all 0.3s ease;
                    }
                    .btn:hover {
                        transform: translateY(-1px);
                    }
                    .btn-success { 
                        background: #27ae60; 
                        color: white;
                    }
                    .btn-success:hover {
                        background: #2ecc71;
                    }
                    .btn-danger { 
                        background: #c32d2d; 
                        color: white;
                    }
                    .btn-danger:hover {
                        background: #e74c3c;
                    }
                    .time-display {
                        background: #fff;
                        padding: 10px;
                        border-radius: 4px;
                        margin: 10px 0;
                        font-family: monospace;
                    }
                    .loading {
                        display: none;
                        margin-left: 10px;
                        animation: rotate 1s linear infinite;
                    }
                    .toast {
                        position: fixed;
                        top: 20px;
                        right: 20px;
                        padding: 15px 25px;
                        border-radius: 5px;
                        color: white;
                        font-weight: bold;
                        display: none;
                        opacity: 0;
                        transition: opacity 0.3s ease;
                        z-index: 1001;
                    }
                    .toast.success { background-color: #27ae60; }
                    .toast.error { background-color: #c32d2d; }
                    .plugin-list {
                        margin-top: 20px;
                    }
                    .plugin-item {
                        display: flex;
                        justify-content: space-between;
                        align-items: center;
                        padding: 20px;
                        border-bottom: 1px solid #eee;
                        transition: background-color 0.3s;
                    }
                    .plugin-item:hover {
                        background-color: #f8f9fa;
                    }
                    .plugin-info {
                        flex: 1;
                    }
                    .plugin-name {
                        font-size: 1.1em;
                        font-weight: bold;
                        color: #2c3e50;
                        margin-bottom: 5px;
                    }
                    .plugin-type {
                        font-size: 0.8em;
                        color: #666;
                    }
                    .plugin-status {
                        font-size: 0.9em;
                        padding: 5px 10px;
                        border-radius: 15px;
                        margin-right: 15px;
                    }
                    .plugin-status.enabled {
                        color: #27ae60;
                        background: rgba(39, 174, 96, 0.1);
                    }
                    .plugin-status.disabled {
                        color: #c0392b;
                        background: rgba(192, 57, 43, 0.1);
                    }
                    .switch {
                        position: relative;
                        display: inline-block;
                        width: 60px;
                        height: 34px;
                    }
                    .switch input {
                        opacity: 0;
                        width: 0;
                        height: 0;
                    }
                    .slider {
                        position: absolute;
                        cursor: pointer;
                        top: 0;
                        left: 0;
                        right: 0;
                        bottom: 0;
                        background-color: #ccc;
                        transition: .4s;
                        border-radius: 34px;
                    }
                    .slider:before {
                        position: absolute;
                        content: "";
                        height: 26px;
                        width: 26px;
                        left: 4px;
                        bottom: 4px;
                        background-color: white;
                        transition: .4s;
                        border-radius: 50%;
                    }
                    input:checked + .slider {
                        background-color: #27ae60;
                    }
                    input:checked + .slider:before {
                        transform: translateX(26px);
                    }
                    @keyframes rotate {
                        from { transform: rotate(0deg); }
                        to { transform: rotate(360deg); }
                    }
                    .status-info {
                        font-size: 1.1em;
                        color: #2c3e50;
                        padding: 10px;
                        border-radius: 6px;
                        margin: 10px 0;
                        display: flex;
                        align-items: center;
                    }
                    .status-info .label {
                        font-weight: bold;
                        margin-right: 10px;
                        min-width: 100px;
                    }
                    .status-info .value {
                        font-family: monospace;
                    }
                    .time-display {
                        background: #f8f9fa;
                        padding: 8px 12px;
                        border-radius: 4px;
                        font-family: monospace;
                        color: #2c3e50;
                    }
                    #statusMessage {
                        display: inline-flex;
                        align-items: center;
                        padding: 8px 15px;
                        border-radius: 6px;
                        margin: 10px 0;
                        font-weight: bold;
                    }
                    .status-yes { 
                        color: #27ae60;
                        background: rgba(39, 174, 96, 0.1);
                    }
                    .status-no { 
                        color: #c32d2d;
                        background: rgba(195, 45, 45, 0.1);
                    }
                </style>
            </head>
            <body>
                <nav class="navbar">
                    <a href="/admin" class="navbar-brand">iCat OpenAPI 管理面板</a>
                    <div class="navbar-nav">
                        <a href="/" class="nav-link" target="_blank">访问首页</a>
                        <a href="/logout" class="nav-link logout">退出登录</a>
                    </div>
                </nav>
                
                <div class="main-content">
                    <div class="container">
                        <!-- 系统状态 -->
                        <div class="card">
                            <div class="card-header">
                                <h2 style="margin:0">系统状态</h2>
                            </div>
                            <div class="card-body">
                                <div class="status-panel">
                                    <div class="status-info">
                                        <span class="label">当前时间：</span>
                                        <span class="value" id="currentTime"></span>
                                    </div>
                                    <div class="status-info">
                                        <span class="label">Node版本：</span>
                                        <span class="value">${process.version}</span>
                                    </div>
                                    <div class="status-info">
                                        <span class="label">运行状态：</span>
                                        <span id="statusMessage" class="${_status.isAvailable ? 'status-yes' : 'status-no'}">
                                            ${_status.message}
                                        </span>
                                    </div>
                                    <div class="controls">
                                        <button class="btn btn-success" onclick="updateStatus(true)" id="enableBtn">
                                            启用服务
                                            <span class="loading" id="enableLoading">⚪</span>
                                        </button>
                                        <button class="btn btn-danger" onclick="updateStatus(false)" id="disableBtn">
                                            停用服务
                                            <span class="loading" id="disableLoading">⚪</span>
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <!-- 插件管理的那部分 -->
                        <div class="card">
                            <div class="card-header">
                                <h2 style="margin:0">插件管理</h2>
                            </div>
                            <div class="card-body">
                                <div class="plugin-list">
                                    ${plugins.map(plugin => `
                                        <div class="plugin-item" data-plugin-name="${plugin.name}">
                                            <div class="plugin-info">
                                                <div class="plugin-name">${plugin.name} 
                                                    <span class="plugin-type">[${plugin.category}]</span>
                                                </div>
                                                <div class="plugin-description">${plugin.description}</div>
                                                <div class="plugin-details">
                                                    <span class="detail-item">版本: ${plugin.version}</span>
                                                    <span class="detail-item">路径: ${plugin.path}</span>
                                                </div>
                                            </div>
                                            <div class="plugin-controls">
                                                <span class="plugin-status ${plugin.enabled ? 'enabled' : 'disabled'}">
                                                    ${plugin.enabled ? '● 运行中' : '○ 已停用'}
                                                </span>
                                                <label class="switch" title="${plugin.enabled ? '点击停用插件' : '点击启用插件'}">
                                                    <input type="checkbox" 
                                                           ${plugin.enabled ? 'checked' : ''} 
                                                           onchange="togglePlugin('${plugin.name}', this.checked)">
                                                    <span class="slider"></span>
                                                </label>
                                            </div>
                                        </div>
                                    `).join('')}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
                <div id="toast" class="toast"></div>
                <script>
                    // 更新时间显示
                    function updateTime() {
                        const timeElement = document.getElementById('currentTime');
                        timeElement.textContent = new Date().toISOString();
                    }
                    // 初始更新
                    updateTime();
                    // 每秒更新一次
                    setInterval(updateTime, 1000);

                    // 显示提示消息
                    function showToast(message, type) {
                        const toast = document.getElementById('toast');
                        toast.textContent = message;
                        toast.className = 'toast ' + type;
                        toast.style.display = 'block';
                        // 延迟显示以获得更好的动画效果
                        setTimeout(() => toast.style.opacity = '1', 100);
                        // 增加显示时间到5秒
                        setTimeout(() => {
                            toast.style.opacity = '0';
                            // 延长淡出动画时间
                            setTimeout(() => toast.style.display = 'none', 800);
                        }, 5000);
                    }

                    // 状态更新函数
                    async function updateStatus(state) {
                        const enableBtn = document.getElementById('enableBtn');
                        const disableBtn = document.getElementById('disableBtn'); // aaa拼写错误
                        const loading = state ? 
                            document.getElementById('enableLoading') : 
                            document.getElementById('disableLoading');
                        try {
                            // 禁用按钮的加载动画
                            enableBtn.disabled = true;
                            disableBtn.disabled = true;
                            loading.style.display = 'inline-block';

                            const response = await fetch('/status/' + state);
                            // 验证响应是否为JSON格式的
                            const contentType = response.headers.get('content-type');
                            if (!contentType || !contentType.includes('application/json')) {
                                throw new Error('服务器返回的不是JSON格式数据');
                            }

                            const data = await response.json();

                            // 验证返回的数据结构
                            if (!data || typeof data.success !== 'boolean' || !data.status) {
                                throw new Error('服务器返回数据格式不正确');
                            }

                            if (data.success) {
                                const statusMsg = document.getElementById('statusMessage');
                                statusMsg.textContent = '' + (data.status.message || '未知状态');
                                statusMsg.className = data.status.isAvailable ? 'status-yes' : 'status-no';
                                showToast(state ? '服务已成功启用' : '服务已成功停用', 'success');
                                
                                // 困死啦啊啊啊啊
                                // 添加最小加载时间，确保动画效果明显
                                await new Promise(resolve => setTimeout(resolve, 1500));
                            } else {
                                throw new Error(data.message || '操作失败');
                            }
                        } catch (err) {
                            let errorMessage = '操作失败';
                            if (err instanceof SyntaxError) {
                                errorMessage = '解析服务器响应时出错';
                            } else {
                                errorMessage = err.message || '未知错误';
                            }
                            showToast(errorMessage, 'error');
                            console.error('状态更新错误:', err);
                            
                            // 错误情况下也保持加载动画一段时间
                            await new Promise(resolve => setTimeout(resolve, 600));
                        } finally {
                            // 渐变过渡效果
                            loading.style.opacity = '0';
                            await new Promise(resolve => setTimeout(resolve, 200));
                            loading.style.display = 'none';
                            loading.style.opacity = '1';
                            
                            // 延迟恢复按钮状态
                            setTimeout(() => {
                                enableBtn.disabled = false;
                                disableBtn.disabled = false;
                            }, 100);
                        }
                    }

                    // 插件开关功能
                    async function togglePlugin(name, enabled) {
                        try {
                            const response = await fetch('/status/plugin/' + name + '/' + enabled);
                            if (!response.ok) {
                                throw new Error('HTTP error! status: ' + response.status);
                            }
                            const data = await response.json();
                            
                            if (data.success) {
                                const targetPlugin = document.querySelector('[data-plugin-name="' + name + '"]');
                                
                                if (targetPlugin) {
                                    const statusSpan = targetPlugin.querySelector('.plugin-status');
                                    statusSpan.textContent = data.plugin.status;
                                    statusSpan.className = 'plugin-status ' + (enabled ? 'enabled' : 'disabled');
                                    
                                    // 确保开关状态同步
                                    const checkbox = targetPlugin.querySelector('input[type="checkbox"]');
                                    checkbox.checked = enabled;
                                    
                                    showToast('插件 ' + name + ' ' + (enabled ? '已启用' : '已停用'), 'success');
                                } else {
                                    throw new Error('无法找到插件元素');
                                }
                            } else {
                                throw new Error(data.message || '操作失败');
                            }
                        } catch (err) {
                            showToast('插件状态更新失败: ' + err.message, 'error');
                            console.error('插件状态更新错误:', err);
                            
                            // 恢复开关状态
                            const targetPlugin = document.querySelector('[data-plugin-name="' + name + '"]');
                            if (targetPlugin) {
                                const checkbox = targetPlugin.querySelector('input[type="checkbox"]');
                                checkbox.checked = !enabled;
                            }
                        }
                    }
                </script>
            </body>
        </html>
    `);
});

// 状态管理路由（没事别动）
app.get('/status/:state', (req, res) => {
    // 如果用户未登录，返回 401 错误
    if (!req.session.isLoggedIn) {
        return res.status(401).json({
            success: false,
            message: '未授权的访问'
        });
    }
    
    const newState = req.params.state.toLowerCase() === 'true';
    global._status.isAvailable = newState;
    global._status.lastCheck = new Date().toISOString();
    global._status.message = newState ? "服务运行正常" : "服务暂停使用";
    
    console.log(`~ [状态管理] 服务状态已更新为: ${newState ? '可用' : '不可用'}`);
    res.setHeader('Content-Type', 'application/json');
    res.json({
        success: true,
        status: global._status
    });
});

app.get('/status/plugin/:name/:state', (req, res) => {
    // 如果用户未登录，返回 401 错误
    if (!req.session.isLoggedIn) {
        return res.status(401).json({
            success: false,
            message: '未授权的访问'
        });
    }
    
    const { name, state } = req.params;
    const enabled = state.toLowerCase() === 'true';
    
    try {
        const result = pluginManager.setPluginState(name, enabled);
        
        if (!result) {
            return res.json({
                success: false,
                message: '插件不存在或操作失败'
            });
        }
        
        console.log(`~ [插件管理] 插件 ${name} 已${enabled ? '启用' : '停用'}`);
        
        res.json({
            success: true,
            plugin: {
                name: name,
                enabled: enabled,
                status: enabled ? '● 运行中' : '○ 已停用'
            }
        });
    } catch (err) {
        console.error('插件状态更新错误:', err);
        res.json({
            success: false,
            message: err.message || '更新插件状态时发生错误'
        });
    }
});

app.get('/404', (req, res) => {
    res.status(404).send(`
        <html>
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>404 页面未找到 - iCat OpenAPI</title>
                <style>
                    body {
                        font-family: "Microsoft YaHei", Arial, sans-serif;
                        background: #f5f5f5;
                        margin: 0;
                        padding: 0;
                        display: flex;
                        justify-content: center;
                        align-items: center;
                        height: 100vh;
                        color: #333;
                    }
                    .container {
                        background: white;
                        padding: 40px;
                        border-radius: 10px;
                        box-shadow: 0 2px 20px rgba(0,0,0,0.1);
                        text-align: center;
                        max-width: 500px;
                        width: 90%;
                    }
                    .icon {
                        font-size: 72px;
                        margin-bottom: 20px;
                    }
                    h1 {
                        color: #2c3e50;
                        margin: 0 0 20px 0;
                        font-size: 28px;
                    }
                    .message {
                        color: #666;
                        line-height: 1.6;
                        margin-bottom: 25px;
                    }
                    .back-home {
                        background: #3498db;
                        color: white;
                        text-decoration: none;
                        padding: 10px 20px;
                        border-radius: 5px;
                        transition: background 0.3s;
                        display: inline-block;
                    }
                    .back-home:hover {
                        background: #2980b9;
                    }
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="icon">404</div>
                    <h1>页面未找到</h1>
                    <div class="message">
                        抱歉，您访问的页面不存在或已被移除。<br>
                        请检查URL是否正确，或返回首页。
                    </div>
                    <a href="/" class="back-home">返回首页</a>
                </div>
            </body>
        </html>
    `);
});

// 加载所有API模块
pluginManager.loadRoutes(path.join(__dirname, '/apis'), app);

// 修改文件监听部分的代码
const watcher = chokidar.watch(path.join(__dirname, '/apis'), {
    ignoreInitial: true
});

watcher
    .on('add', (filePath) => {
        console.log(`~ [PluginManager] 侦测到文件添加: ${filePath}`);
        pluginManager.loadRoutes(path.join(__dirname, '/apis'), app);
    })
    .on('change', (filePath) => {
        console.log(`~ [PluginManager] 侦测到文件更改: ${filePath}`);
        pluginManager.reloadRoute(filePath, app);
    });

// 处理所有未匹配的路由 - 放在所有路由定义之后，app.listen之前
app.use((req, res) => {
    res.redirect('/404');
});

app.listen(port, () => {
    console.log(`* 服务运行在端口: ${port}`);
});

// 在文件开头附近添加导出
module.exports = { app };
