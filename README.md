# 大学生兼职众包平台（可部署到 Render）

校园兼职众包平台可运行原型：学生端 / 企业端 / 运营后台 + 真实地图（Leaflet + OpenStreetMap）、GPS 定位打卡、隐私号联系、争议仲裁、数据看板。

## 一键部署到 Render（免费）

1. 在 GitHub 新建一个**空仓库**（Private 也可以，不要勾选 README）。
2. 在本地终端（能上网的电脑）执行：

```bash
cd deploy-repo
git remote add origin https://github.com/<你的用户名>/<仓库名>.git
git branch -M main
git push -u origin main
```

3. 打开 [render.com](https://render.com) 注册并登录（可直接用 GitHub 登录）。
4. 控制台点击 **New → Blueprint**，选择刚推送的仓库，Render 会自动读取根目录的 `render.yaml`，点 **Apply**。
5. 等待状态变为 **Live**，得到 `https://<服务名>.onrender.com` 公网地址。

> 也可以不用 Blueprint：New → Web Service → 选仓库 → Root Directory 填 `website`，Build Command 填 `npm install --omit=dev`，Start Command 填 `node server.js`，环境变量加 `HOST=0.0.0.0`。

### 免费实例注意事项
- 15 分钟无访问会休眠，首次打开需等几十秒。
- 文件系统是临时的：**重启后演示数据会重置**（订单、上传图片丢失）。需要保留数据请升级付费并挂载 Disk，或改用数据库/对象存储。
- 首次打开后，学生端任务大厅点「使用我的位置」并允许定位，即会以你当前所在地为中心展示附近任务。

## 本地运行

```bash
cd website
npm install --omit=dev   # 无第三方依赖，可省略
node server.js           # http://127.0.0.1:8788
```

## 演示账号

| 角色 | 账号 / 密码 |
| --- | --- |
| 学生（已认证） | student / 123456 |
| 学生（未认证） | student2 / 123456 |
| 企业（已认证） | company / 123456 |
| 企业（未认证） | company2 / 123456 |
| 平台运营 | admin / 123456 |

## 地图说明

- 真实地图使用 **Leaflet + OpenStreetMap**（CDN 加载，无需地图 Key）。
- 「使用我的位置」调用浏览器 GPS，并用 OpenStreetMap Nominatim 反查地址，显示在任务大厅。
- 「在地图上选位置」可手动点选；企业发布任务时也可点击地图取坐标并自动填写地址。
- 若地图 CDN 加载失败（离线），自动退化为自绘示意图，不影响任务浏览与报名。

## 安全提示

这是教学演示原型：演示账号密码为明文、数据存在本地 JSON；正式使用前请改密码、启用 HTTPS（Render 自带）、定期备份 `website/data/`，不要上传真实证件与敏感信息。
