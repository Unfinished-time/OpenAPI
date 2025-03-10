const express = require('express');
const router = express.Router();
const axios = require('axios');

const plugin_info = {
    "name": "BingWallpaper",
    "version": "v1.2",
    "avatar": "Zatursure"
}

console.log("+ 模块: " + plugin_info.name + " - " + plugin_info.version + " (作者: " + plugin_info.avatar + ") 已载入数据.")

// 缓存配置
let cachedImages = [];
let lastUpdated = null;
const CACHE_DURATION = 3600000; // 1小时缓存

// 获取必应图片数据
async function fetchBingImages() {
    try {
        const response = await axios.get('https://www.bing.com/HPImageArchive.aspx', {
            params: {
                format: 'js',
                idx: 0,
                n: 8
            }
        });
        
        cachedImages = response.data.images || [];
        lastUpdated = Date.now();
        console.log("  [BingWallpaper] 图片缓存已更新，当前数量：" + cachedImages.length);
    } catch (error) {
        console.error("  [BingWallpaper] 图片更新失败:", error.message);
    }
}

// 初始化时立即获取并启动定时器
fetchBingImages();
setInterval(fetchBingImages, CACHE_DURATION);

// 主路由处理
router.get('/BingWallpaper', (req, res) => {
    // 检查缓存有效性
    if (!cachedImages.length) {
        console.log("  [BingWallpaper] 请求失败：缓存未就绪");
        return res.status(503).json({ error: "服务正在初始化，请稍后重试" });
    }

    // 随机选择图片
    const randomIndex = Math.floor(Math.random() * cachedImages.length);
    const selected = cachedImages[randomIndex];
    
    // 处理分辨率参数
    const resolution = req.query.res || 'UHD';
    const imageUrl = `https://www.bing.com${selected.url.replace('1920x1080', resolution)}`;

    // 返回格式控制
    if (req.query.json) {
        console.log(`~ [BingWallpaper] 返回JSON数据 (分辨率: ${resolution})`);
        return res.json({
            url: imageUrl,
            copyright: selected.copyright,
            date: selected.startdate,
            resolution: resolution
        });
    }

    console.log(`  [BingWallpaper] 302重定向 (分辨率: ${resolution})`);
    res.redirect(imageUrl);
});

module.exports = router;