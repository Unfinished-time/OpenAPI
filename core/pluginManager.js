const fs = require('fs');
const path = require('path');
const express = require('express');
class PluginManager {
    constructor() {
        this.plugins=new Map();
        this.routes=new Map();
        this._routeStacks = new Map();
        this._loadingPlugins = new Set(); // 添加加载状态追踪
        this._debounceTimers=new Map();
    }
    loadRoutes(pluginDir, app) {
        try {
            // console.log('~ [PluginManager] 正在从目录加载插件...'); 
            if (!fs.existsSync(pluginDir)) {
                console.log('~ [PluginManager] 插件目录不存在，正在创建...'); 
                fs.mkdirSync(pluginDir, { recursive: true });
                return;
            }
            const files = fs.readdirSync(pluginDir);
            files.forEach(file => {
                if (file.endsWith('.js')) {
                    const pluginPath = path.join(pluginDir, file);
                    this.loadPlugin(pluginPath, app);
                }
            });
        } catch (error) {
            console.error('~ [PluginManager] 加载插件时出错:', error);
        }
    }

    loadPlugin(pluginPath, app) {
        try {
            delete require.cache[require.resolve(pluginPath)];
            const plugin = require(pluginPath);
            
            const pluginName = path.basename(pluginPath, '.js');
            
            this.removePluginRoutes(app, pluginName);

            this.plugins.set(pluginName, {
                name: pluginName,
                path: pluginPath,
                enabled: true,
                instance: plugin,
                description: plugin.plugin_info?.description || '暂无描述',
                version: plugin.plugin_info?.version || '1.0.0',
                category: plugin.plugin_info?.category || '未分类',
                author: plugin.plugin_info?.author || '未知'
            });

            if (this.plugins.get(pluginName).enabled) {
                const router = express.Router();
                
                try {
                    if (typeof plugin === 'function') {
                        const handler = plugin;
                        const subRouter = express.Router();
                        subRouter.all('*', (req, res, next) => {
                            try {
                                handler(req, res, next);
                            } catch (err) {
                                next(err);
                            }
                        });
                        
                        router.use('/', subRouter);
                        app.use('/', router);
                        this.routes.set(pluginName, subRouter);
                        console.log(`~ [PluginManager] 已加载插件: ${pluginName}`);
                    } else if (typeof plugin.route === 'function') {
                        const subRouter = express.Router();
                        try {
                            plugin.route(subRouter);
                            router.use('/', subRouter);
                            app.use('/', router);
                            this.routes.set(pluginName, subRouter);
                            console.log(`~ [PluginManager] 已加载插件: ${pluginName}`);
                        } catch (err) {
                            throw new Error(`插件 ${pluginName} 的route方法执行失败: ${err.message}`);
                        }
                    } else {
                        throw new Error(`插件 ${pluginName} 未提供有效的路由处理函数`);
                    }

                    if (router.stack && router.stack.length > 0) {
                        this._routeStacks.set(pluginName, router.stack);
                    }
                } catch (routeError) {
                    console.error(`~ [PluginManager] 注册路由时出错: ${routeError.message}`);
                    throw routeError;
                }
            }
        } catch (error) {
            console.error(`~ [PluginManager] 加载插件 ${path.basename(pluginPath)} 时出错:`, error);
            this.removePluginRoutes(app, path.basename(pluginPath));
        }
    }

    removePluginRoutes(app, pluginName) {
        try {
            if (app && app._router && app._router.stack) {
                app._router.stack = app._router.stack.filter(layer => {
                    const keepLayer = !(layer.name === pluginName || 
                        (layer.regexp && layer.regexp.toString().includes(pluginName)) ||
                        (layer.handle && layer.handle.name === pluginName));
                    return keepLayer;
                });
            }
            
            this._routeStacks.delete(pluginName);
            this.routes.delete(pluginName);
            console.log(`~ [PluginManager] 已移除插件路由: ${pluginName}`);
        } catch (error) {
            console.error(`~ [PluginManager] 移除插件路由时出错:`, error);
        }
    }

    reloadRoute(filePath, app) {
        const pluginName = path.basename(filePath, '.js');
        try {
            if (this.routes.has(pluginName)) {
                console.log(`~ [PluginManager] 正在重新加载插件: ${pluginName}`);
            }
            
            this.loadPlugin(filePath, app);
        } catch (error) {
            console.error(`~ [PluginManager] 重新加载插件 ${pluginName} 时出错:`, error);
        }
    }

    setPluginState(name, enabled) {
        const plugin = this.plugins.get(name);
        if (!plugin) {
            console.error(`~ [PluginManager] 未找到插件: ${name}`);
            return null;
        }

        plugin.enabled = enabled;
        
        if (enabled) {
            this.loadPlugin(plugin.path, require('../index.js').app);
        } else {
            this.removePluginRoutes(require('../index.js').app, name);
        }
        
        console.log(`~ [PluginManager] 插件 ${name} ${enabled ? '已启用' : '已停用'}`);
        
        return {
            name: plugin.name,
            enabled: plugin.enabled,
            path: plugin.path,
            description: plugin.description || '暂无描述',
            version: plugin.version || '1.0.0',
            category: plugin.category || '未分类'
        };
    }

    getPlugins() {
        return Array.from(this.plugins.values()).map(plugin => ({
            name: plugin.name,
            path: plugin.path,
            enabled: plugin.enabled,
            description: plugin.description || '暂无描述',
            version: plugin.version || '1.0.0',
            category: plugin.category || '未分类'
        }));
    }

    getPluginByPath(requestPath) {
        requestPath = requestPath.toLowerCase();
        if (!requestPath.startsWith('/')) {
            requestPath = '/' + requestPath;s
        }

        return Array.from(this.plugins.values()).find(plugin => {
            const pluginBasePath = '/' + plugin.name.toLowerCase();
            return requestPath.startsWith(pluginBasePath + '/') || 
                   requestPath === pluginBasePath;
        });
    }

    // 添加防抖函数
    _debounce(key, fn, delay = 500) {
        if (this._debounceTimers.has(key)) {
            clearTimeout(this._debounceTimers.get(key));
        }
        const timer = setTimeout(() => {
            fn();
            this._debounceTimers.delete(key);
        }, delay);
        this._debounceTimers.set(key, timer);
    }

    setupWatcher(pluginDir, app) {
        const chokidar = require('chokidar');
        let watcher = null;
        
        const initWatcher = () => {
            watcher = chokidar.watch(pluginDir, {
                ignored: [/(^|[\/\\])\../, /node_modules/],
                persistent: true,
                ignoreInitial: true,
                awaitWriteFinish: {
                    stabilityThreshold: 1000,
                    pollInterval: 100
                },
                ignorePermissionErrors: true
            });

            const handlePluginChange = (filepath) => {
                if (!filepath.endsWith('.js')) return;
                
                const pluginName = path.basename(filepath, '.js');
                
                // 防止重复加载
                if (this._loadingPlugins.has(pluginName)) {
                    console.log(`~ [PluginManager] 插件 ${pluginName} 正在加载中，跳过重复加载`);
                    return;
                }

                this._loadingPlugins.add(pluginName);
                
                try {
                    console.log(`~ [PluginManager] 正在重新加载插件: ${filepath}`);
                    this.loadPlugin(filepath, app);
                    console.log(`~ [PluginManager] 插件 ${pluginName} 重载成功`);
                } catch (error) {
                    console.error(`~ [PluginManager] 插件 ${pluginName} 重载失败:`, error);
                    // 重载失败时清理相关状态
                    this.removePluginRoutes(app, pluginName);
                    this.plugins.delete(pluginName);
                } finally {
                    this._loadingPlugins.delete(pluginName);
                }
            };

            watcher
                .on('change', (filepath) => {
                    this._debounce(filepath, () => handlePluginChange(filepath));
                })
                .on('add', (filepath) => {
                    this._debounce(filepath, () => handlePluginChange(filepath));
                })
                .on('unlink', (filepath) => {
                    if (filepath.endsWith('.js')) {
                        const pluginName = path.basename(filepath, '.js');
                        console.log(`~ [PluginManager] 检测到插件被删除: ${filepath}`);
                        this.removePluginRoutes(app, pluginName);
                        this.plugins.delete(pluginName);
                        console.log(`~ [PluginManager] 已移除插件: ${pluginName}`);
                    }
                })
                .on('error', error => {
                    console.error('~ [PluginManager] 文件监控错误:', error);
                });
        };

        initWatcher();

        // 修改退出处理，添加退出标志，防止重复输出
        let exitCalled = false;
        const handleExit = async () => {
            if (exitCalled) return;
            exitCalled = true;
            if (watcher) {
                console.log('-----Goodbye!-----');
                await watcher.close();
                watcher = null;                
            }
            process.exit(0);
        };

        // 使用 process.once 确保每个信号只注册一次
        process.once('SIGINT', handleExit);
        process.once('SIGTERM', handleExit);
        process.once('SIGQUIT', handleExit);
        console.log('~ [PluginManager] 已启用插件热重载功能');
        return watcher;
    }
}

//道观（bushi
module.exports = new PluginManager();
