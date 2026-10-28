@echo off
REM 局域网演示：监听所有网卡，同一 Wi-Fi/局域网内的手机、电脑可访问
cd /d %~dp0..
set HOST=0.0.0.0
set PORT=8788
echo.
echo 兼职众包平台已启动（局域网模式）
echo 本机访问:    http://127.0.0.1:8788
echo 局域网访问:  用 ipconfig 查看本机 IPv4，拼成 http://你的IP:8788
echo 首次运行如无法被其他设备访问，请在 Windows 防火墙中允许 Node.js 的入站连接。
echo 按 Ctrl+C 停止服务。
echo.
node server.js
