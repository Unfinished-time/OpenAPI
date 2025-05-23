# OpenAPI

## 概述

本项目是一个基于 Node.js 的 API 服务集合，包含了多个功能各异的插件，如必应壁纸获取、时间校准、网络连接检查等

通过通过这些插件，可以方便地获取各类数据和服务

## 内置API功能简介

### BingWallpaper

- **功能**：提供必应每日壁纸的随机获取服务，支持不同分辨率的图片请求，可返回图片的重定向链接或 JSON 数据。
- **特点**：图片数据会进行缓存，每小时更新一次，提高响应速度。

### 时间校准服务

- **功能**：提供网络授时服务，支持以服务器本地时间、ISO 格式时间和 Unix 时间戳三种方式返回当前时间。

### OnlineChecker

- **功能**：对目标地址（域名或 IP）进行网络连接检查，包括 HTTP 访问、Ping 测试、DNS 解析和端口开放情况。
- **特点**：可以同时进行多项检查，返回详细的检查结果。

### example

- **功能**：一个简单的示例插件，返回一个包含 “Hello World” 消息和当前时间的 JSON 响应。

### WeAvatar

- **功能**：根据用户提供的邮箱地址和图片尺寸，重定向到 WeAvatar 网站的对应头像链接。

## 使用方法

### 安装依赖

在项目根目录下，运行以下命令安装所需的依赖：

```bash
npm install
```

### 启动服务

在项目根目录下，运行以下命令启动服务：

```bash
node index.js
```

### 内置API

#### BingWallpaper

- **请求 URL**：`/BingWallpaper`
- 请求参数
  - `res`：可选，图片分辨率，默认为 `UHD`。
  - `json`：可选，若设置为任意值，则返回 JSON 数据，否则进行图片重定向。
- 示例请求
  - 获取图片重定向链接：`http://localhost:3000/BingWallpaper?res=1920x1080`
  - 获取 JSON 数据：`http://localhost:3000/BingWallpaper?res=1920x1080&json=1`

#### 时间校准服务

- **请求 URL**：`/time-aligned`
- 请求参数
  - `type`：可选，时间格式类型，可选值为 `server`（服务器本地时间）、`iso`（ISO 格式时间）、`unix`（Unix 时间戳），默认为 `unix`。
- 示例请求
  - 获取服务器本地时间：`http://localhost:3000/time-aligned?type=server`
  - 获取 ISO 格式时间：`http://localhost:3000/time-aligned?type=iso`
  - 获取 Unix 时间戳：`http://localhost:3000/time-aligned?type=unix`

#### OnlineChecker

- **请求 URL**：`/OnlineChecker`
- 请求参数
  - `target`：必需，目标地址（域名或 IP）。
  - `port`：可选，要检查的端口号。
- **示例请求**：`http://localhost:3000/OnlineChecker?target=example.com&port=80`

#### example

- **请求 URL**：`/example`
- **示例请求**：`http://localhost:3000/example`

#### WeAvatar

- **请求 URL**：`/WeAvatar`
- 请求参数
  - `email`：必需，邮箱地址。
  - `s`：必需，头像尺寸。
- **示例请求**：`http://localhost:3000/WeAvatar?email=example@example.com&s=100`

## 注意事项

- 请确保你的 Node.js 版本符合项目依赖的要求，部分依赖需要 Node.js 版本 >= 14.16.0 或 >= 18.17。
- 若遇到网络问题或 API 请求失败，请检查网络连接和目标地址的可用性。

## 贡献与反馈

如果你在使用过程中遇到问题或有任何建议，欢迎在项目的 GitHub 仓库中提交 Issues/PR。同时，也欢迎你为项目贡献代码，共同完善这个项目。