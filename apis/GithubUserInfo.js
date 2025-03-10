const express = require('express');
const router = express.Router();
const axios = require('axios');

const plugin_info = {
    "name": "GithubUserInfo",
    "version": "v1.0",
    "avatar": "Zatursure"
};

console.log(`+ 模块: ${plugin_info.name} - ${plugin_info.version} (作者: ${plugin_info.avatar}) 已载入`);

// GitHub API 配置
const GITHUB_API_URL = 'https://api.github.com/users';

// 获取 GitHub 用户信息
async function getGitHubUserInfo(username) {
    try {
        const response = await axios.get(`${GITHUB_API_URL}/${username}`, {
            headers: {
                'User-Agent': 'GitHubUserInfoAPI/1.0', // GitHub API 要求 User-Agent
                'Accept': 'application/vnd.github.v3+json'
            }
        });
        return response.data;
    } catch (error) {
        console.error(`! [${plugin_info.name}] GitHub API 请求失败:`, error.message);
        throw error;
    }
}

// 主API路由
router
  .route('/GithubUserInfo')
  .get(async (req, res, next) => {
    try {
        const { username } = req.query;

        if (!username) {
            return res.status(400).json({
                code: 400,
                msg: "请提供 GitHub 用户名"
            });
        }

        const userInfo = await getGitHubUserInfo(username);
        
        const responseData = {
            username: userInfo.login,
            name: userInfo.name,
            bio: userInfo.bio,
            public_repos: userInfo.public_repos,
            followers: userInfo.followers,
            following: userInfo.following,
            avatar_url: userInfo.avatar_url,
            html_url: userInfo.html_url,
            created_at: userInfo.created_at,
            updated_at: userInfo.updated_at
        };

        console.log(`+ [${plugin_info.name}] 成功获取用户信息: ${username}`);
        res.json({
            code: 200,
            data: responseData
        });

    } catch (error) {
        next(error);
    }
  })
  .all((req, res) => {
    res.status(405).json({
        code: 405,
        msg: "方法不允许"
    });
  });

// 错误处理中间件
router.use((error, req, res, next) => {
    if (error.response && error.response.status === 404) {
        console.error(`! [${plugin_info.name}] 用户未找到: ${req.query.username}`);
        return res.status(404).json({
            code: 404,
            msg: "用户未找到"
        });
    }

    console.error(`! [${plugin_info.name}] 请求失败:`, error.message);
    res.status(500).json({
        code: 500,
        msg: "服务器内部错误"
    });
});

module.exports = router;