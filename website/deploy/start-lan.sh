#!/usr/bin/env bash
# 局域网演示：监听所有网卡
cd "$(dirname "$0")/.."
HOST=0.0.0.0 PORT=8788 node server.js
