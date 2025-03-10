const express = require('express');
const router = express.Router();
const axios = require('axios');
const dns = require('dns');
const { exec } = require('child_process');
const iconv = require('iconv-lite'); // 引入 iconv-lite

const plugin_info = {
    "name": "OnlineChecker",
    "version": "v1.7",
    "avatar": "Zatursure"
};

console.log(`+ 模块: ${plugin_info.name} - ${plugin_info.version} (作者: ${plugin_info.avatar}) 已载入`);

// 检查网页直连
async function checkHttpAccess(url) {
    try {
        const response = await axios.get(url.startsWith('http') ? url : `https://${url}`, {
            timeout: 5000,
            headers: {
                'User-Agent': ' Mozilla/5.0 (Windows; U; Windows NT 6.1; en-US) AppleWebKit/534.16 (KHTML, like Gecko) Chrome/10.0.648.133 Safari/534.16'
            }
        });
        return {
            status: response.status,
            statusText: response.statusText
        };
    } catch (error) {
        return {
            error: error.message
        };
    }
}

// 检查 Ping
// 突然想起来的，这个是用来解决windows下ping命令输出乱码的问题的，不然输出的中文会是乱码

function checkPing(host) {
    return new Promise((resolve) => {
        const command = process.platform === 'win32' ? `ping -n 4 ${host}` : `ping -c 4 ${host}`;
        const childProcess = exec(command, { encoding: 'buffer' }); // 设置输出为 buffer

        let output = '';
        childProcess.stdout.on('data', (data) => {
            output += iconv.decode(data, 'gbk'); // 将 GBK 转换为 UTF-8
        });

        childProcess.on('close', (code) => {
            if (code !== 0) {
                resolve({ error: 'Ping 失败' });
            } else {
                resolve({ output });
            }
        });
    });
}

// 检查 DNS 解析
function checkDnsResolution(domain) {
    return new Promise((resolve) => {
        dns.resolve(domain, (error, addresses) => {
            if (error) {
                resolve({ error: error.message });
            } else {
                resolve({ addresses });
            }
        });
    });
}

// 检查端口开放
function checkPortOpen(host, port) {
    return new Promise((resolve) => {
        const net = require('net');
        const socket = new net.Socket();
        let result = { open: false };

        socket.setTimeout(2000); // 2秒超时
        socket.on('connect', () => {
            result.open = true;
            socket.destroy();
            resolve(result);
        });

        socket.on('timeout', () => {
            result.error = '连接超时';
            socket.destroy();
            resolve(result);
        });

        socket.on('error', (error) => {
            result.error = error.message;
            resolve(result);
        });

        socket.connect(port, host);
    });
}

// 主API路由
router.get('/', async (req, res) => {
    try {
        const { target, port } = req.query;

        // 检查参数
        if (!target) {
            return res.status(400).json({
                code: 400,
                msg: "请提供目标地址（域名或IP）"
            });
        }

        // 执行检查
        const [httpAccess, pingResult, dnsResult, portResult] = await Promise.all([
            checkHttpAccess(`http://${target}`), // 检查 HTTP 访问
            checkPing(target), // 检查 Ping
            checkDnsResolution(target), // 检查 DNS 解析
            port ? checkPortOpen(target, parseInt(port)) : { skipped: true } // 检查端口
        ]);

        // 构建响应数据
        const responseData = {
            target,
            httpAccess,
            pingResult,
            dnsResult,
            portResult
        };

        console.log(`+ [${plugin_info.name}] 成功检查目标地址: ${target}`);
        res.json({
            code: 200,
            data: responseData
        });

    } catch (error) {
        console.error(`! [${plugin_info.name}] 请求失败:`, error.message);
        res.status(500).json({
            code: 500,
            msg: error.message || "服务器内部错误"
        });
    }
});

module.exports = router;