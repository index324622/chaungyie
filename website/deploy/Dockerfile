FROM node:20-alpine

WORKDIR /app

# 无第三方依赖，只需运行时代码
COPY package.json ./
COPY server.js ./
COPY public ./public

ENV NODE_ENV=production \
    PORT=8788 \
    HOST=0.0.0.0

EXPOSE 8788
VOLUME ["/app/data"]

CMD ["node", "server.js"]
