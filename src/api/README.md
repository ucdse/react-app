# API Module Notes

本目录负责前端与后端通信的统一封装，目标是：

- 调用方式统一（业务层尽量只关心 `xxxAPI` 函数）
- token 处理统一（自动带 token、过期后自动刷新与重试）
- 错误处理统一（网络错误与业务码错误转为可读信息）

## File Responsibilities

- `request.ts`：主请求实例与拦截器（鉴权、刷新 token、失败重试、错误提示），并内置响应解包与错误标准化工具。
- `client.ts`：`request` 的兼容导出别名（`axiosWithAuth`）。
- `endpoints.ts`：集中管理接口路径常量。
- `token.ts`：读写/清理本地 token。
- `auth.ts`：认证相关 API（登录、注册）与对应 DTO/VO。
- `user.ts`：用户信息相关 API（当前用户信息、登出）与类型定义。
- `index.ts`：本目录对外统一出口。

## Request Flow

1. 页面调用 `auth.ts` / `user.ts` 中的业务 API。
2. `request.ts` 的请求拦截器注入 access token（缺失时尝试静默刷新）。
3. 响应拦截器执行业务码解包（`{ code, msg, data } -> data`）。
4. 若 401/403 且可重试：触发一次刷新，其它失败请求排队等待。
5. 刷新成功：队列请求继续；刷新失败：清理 token 并跳转登录页。
