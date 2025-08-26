const express = require('express');
const router = express.Router();
const axios = require('axios');
const dns = require('dns').promises;
const whois = require('whois');
const { promisify } = require('util');
const whoisLookup = promisify(whois.lookup);

const plugin_info = {
    "name": "网站信息查询",
    "version": "v1.0",
    "author": "Zatursure",
    "description": "查询指定网站的域名、DNS、SSL证书等详细信息",
    "category": "工具"
};

console.log(`+ 模块: ${plugin_info.name} - ${plugin_info.version} (作者: ${plugin_info.author}) 已载入`);

async function getDomainInfo(domain) {
    try {
        const dnsInfo = {
            a: await dns.resolve(domain, 'A').catch(() => []),
            aaaa: await dns.resolve(domain, 'AAAA').catch(() => []),
            mx: await dns.resolve(domain, 'MX').catch(() => []),
            ns: await dns.resolve(domain, 'NS').catch(() => []),
            txt: await dns.resolve(domain, 'TXT').catch(() => []),
            cname: await dns.resolve(domain, 'CNAME').catch(() => [])
        };

        const sslInfo = await new Promise((resolve) => {
            const https = require('https');
            const req = https.get(`https://${domain}`, {
                timeout: 5000,
                rejectUnauthorized: false
            }, (res) => {
                try {
                    const cert = res.socket.getPeerCertificate();
                    resolve({
                        valid: true,
                        cert: cert
                    });
                } catch (e) {
                    resolve({
                        valid: false,
                        error: '证书获取失败: ' + e.message
                    });
                }
                res.destroy();
            });

            req.on('error', (e) => {
                resolve({
                    valid: false,
                    error: '连接失败: ' + e.message
                });
            });

            req.end();
        });

        const whoisInfo = await whoisLookup(domain).catch(() => null);
        const headers = await axios.head(`https://${domain}`, {
            timeout: 5000,
            validateStatus: null
        }).then(res => res.headers).catch(() => null);

        return {
            success: true,
            data: {
                domain,
                dns: dnsInfo,
                ssl: sslInfo,
                whois: whoisInfo,
                headers,
                checkTime: new Date().toISOString()
            }
        };
    } catch (error) {
        return {
            success: false,
            error: error.message || '查询失败'
        };
    }
}

router.get('/ckDomain', async (req, res) => {
    const domain = req.query.domain;
    const domainRegex = /^([a-zA-Z0-9]([a-zA-Z0-9\-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}$/;
    if (!domain || !domainRegex.test(domain)) {
        return res.json({
            success: false,
            error: '请提供有效の域名'
        });
    }

    try {
        const result = await getDomainInfo(domain);
        res.json(result);
    } catch (error) {
        res.json({
            success: false,
            error: '查询过程中发生错误'
        });
    }
});

router.get('/ckDomain', async (req, res) => {
    const domain = req.query.domain;
    const domainRegex = /^([a-zA-Z0-9]([a-zA-Z0-9\-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}$/;
    if (!domain || !domainRegex.test(domain)) {
        return res.json({
            success: false,
            error: '请提供有效の域名'
        });
    }

    try {
        const result = await getDomainInfo(domain);
        res.json(result);
    } catch (error) {
        res.json({
            success: false,
            error: '查询过程中发生错误'
        });
    }
});
//导出路由
module.exports = router;
