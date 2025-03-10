// 引入必要的模块
const express = require('express');
const router = express.Router();

/**
 * 插件信息配置
 * name: 插件名称
 * version: 插件版本
 * author: 插件作者
 * description: 插件描述
 * category: 插件分类
 */
const plugin_info = {
    "name": "example",
    "version": "v1.0",
    "author": "Zatursure",
    "description": "一个简单的示例插件",
    "category": "示例"
};

// 输出插件加载信息
console.log(`+ 模块: ${plugin_info.name} - ${plugin_info.version} (作者: ${plugin_info.author}) 已载入`);

/**
 * 示例路由处理
 * 路径: /example
 * 方法: GET
 * 功能: 返回一个简单的 Hello World 消息
 * 
 * 返回数据格式:
 * {
 *   code: 状态码 (200表示成功)
 *   msg: 返回消息
 *   time: 响应时间
 * }
 */
router.get('/example', (req, res) => {
    // 构建响应数据
    const response = {
        code: 200,
        msg: "Hello World",
        time: new Date().toLocaleString() // 添加当前时间戳
    };
    
    // 记录请求处理日志
    console.log(`+ [${plugin_info.name}] 请求已处理`);
    // 发送JSON格式响应
    res.json(response);
});

// 导出路由模块
module.exports = router;
