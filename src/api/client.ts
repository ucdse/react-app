/**
 * 兼容性别名：
 * `axiosWithAuth` 与 `request` 指向同一个 axios 实例。
 * 该实例会自动携带 token、在 401/403 时尝试刷新并重试、并解包业务响应。
 */
export { default as axiosWithAuth } from './request'
export { ACCESS_TOKEN_KEY, REFRESH_TOKEN_KEY } from './token'
