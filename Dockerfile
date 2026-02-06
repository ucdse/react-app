# 构建阶段
FROM node:24-slim AS builder

WORKDIR /app

# 复制 package 文件
COPY package.json package-lock.json ./

# 安装依赖
RUN npm ci

# 复制源代码
COPY . .

# 构建应用
RUN npm run build

# 运行阶段
FROM nginx:alpine

ENV BACKEND_HOST=flask-app
ENV BACKEND_PORT=5000

# 复制构建产物到 nginx 目录
COPY --from=builder /app/dist /usr/share/nginx/html

# 复制 nginx 模板与自定义入口脚本
COPY nginx.conf /etc/nginx/default.conf.template
COPY docker-entrypoint.d/40-envsubst-backend.sh /docker-entrypoint.d/40-envsubst-backend.sh
RUN chmod +x /docker-entrypoint.d/40-envsubst-backend.sh

# 暴露端口
EXPOSE 80

# 启动 nginx
CMD ["nginx", "-g", "daemon off;"]
