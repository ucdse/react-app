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

# 复制 nginx 模板（由官方 entrypoint 自动 envsubst 到 conf.d）
COPY nginx.conf /etc/nginx/templates/default.conf.template

# 暴露端口
EXPOSE 80

# 启动 nginx
CMD ["nginx", "-g", "daemon off;"]
