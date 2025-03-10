const express = require('express');
const router = express.Router();
const axios = require('axios');

// 重新组织插件信息
router.plugin_info = {
    name: "IPLocateGet",
    version: "v2.1",
    author: "Zatursure",
    description: "IP地址归属地查询API，支持IPv4和IPv6地址查询，提供详细的地理位置信息",
    category: "工具类"
};

console.log(`+ 模块: ${router.plugin_info.name} - ${router.plugin_info.version} (作者: ${router.plugin_info.author}) 已载入`);
console.log(`  描述: ${router.plugin_info.description}`);
console.log(`  类型: ${router.plugin_info.category}`);

// IP 地址归属地查询服务
const IP_API_URL = {
    ipv4: 'http://ip-api.com/json/', // 支持 IPv4
    ipv6: 'http://ip-api.com/json/'  // 支持 IPv6
};

// 判断 IP 地址类型 (IPv4 或 IPv6)
function getIPType(ip) {
    if (/^(?:[0-9]{1,3}\.){3}[0-9]{1,3}$/.test(ip)) {
        return 'ipv4';
    } else if (/^([0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$/.test(ip)) {
        return 'ipv6';
    } else {
        return null;
    }
}

// 重命名原来的getIPLocation为queryIPLocation以避免命名冲突
async function queryIPLocation(ip) {
    try {
        const ipType = getIPType(ip);
        if (!ipType) {
            throw new Error('无效的 IP 地址格式');
        }

        const response = await axios.get(`${IP_API_URL[ipType]}${ip}`, {
            params: {
                fields: 'status,message,country,countryCode,region,regionName,city,zip,lat,lon,timezone,isp,org,as,query'
            }
        });

        if (response.data.status !== 'success') {
            throw new Error(response.data.message || 'IP 地址查询失败');
        }

        return response.data;
    } catch (error) {
        console.error(`! [${router.plugin_info.name}] IP 地址查询失败:`, error.message);
        throw error;
    }
}

// 创建路由处理器
const getIPLocation = async (req, res) => {
    try {
        const ip = req.query.ip || req.ip;
        const location = await queryIPLocation(ip);

        const responseData = {
            ip: location.query,
            country: location.country,
            countryCode: location.countryCode,
            region: location.regionName,
            city: location.city,
            zip: location.zip,
            latitude: location.lat,
            longitude: location.lon,
            timezone: location.timezone,
            isp: location.isp,
            org: location.org,
            as: location.as
        };

        console.log(`+ [${router.plugin_info.name}] 成功查询 IP 地址归属地: ${ip}`);
        res.json({
            code: 200,
            data: responseData
        });

    } catch (error) {
        console.error(`! [${router.plugin_info.name}] 请求失败:`, error.message);
        res.status(500).json({
            code: 500,
            msg: error.message || "服务器内部错误"
        });
    }
};

// 使用新的路由语法
router.route('/getIPLocation')
    .get(getIPLocation);

module.exports = router;