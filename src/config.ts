/**
 * 后端 API 配置：请求统一走前端同源的 /api，由开发代理或生产反向代理转发到后端。
 * 开发环境见 vite.config.ts 的 server.proxy；生产环境需在 Nginx 等配置 /api -> 后端地址。
 */
export const API_BASE_URL = ''
