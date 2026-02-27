# AI Gateway Usage Board | 智能网关用量看板

<div align="center">

[![React](https://img.shields.io/badge/React-18-61DAFB?logo=react)](https://react.dev/)
[![Vite](https://img.shields.io/badge/Vite-5-646CFF?logo=vite)](https://vitejs.dev/)
[![Express](https://img.shields.io/badge/Express-4-000000?logo=express)](https://expressjs.com/)
[![TailwindCSS](https://img.shields.io/badge/TailwindCSS-3-06B6D4?logo=tailwindcss)](https://tailwindcss.com/)

**双数据源 LLM API 网关用量分析与成本估算平台**

[English](README_EN.md) | 中文

</div>

---

## 功能特性

- **双数据源支持**: 同时接入 OneAPI (MySQL) 和 NewAPI (PostgreSQL) 的用量日志
- **实时费用计算**: 基于模型倍率实时计算 Token 消耗成本（支持 USD/CNY 自动转换）
- **多维度分析**: 今日概览、30日趋势、模型分布、令牌排行榜
- **飞书通知**: 每日定时推送用量日报，超额告警
- **价格配置**: 支持从 models.dev 同步最新模型定价
- **个人查询页**: 支持输入个人令牌（兼容 `sk-` 前缀）后查看个人用量详情
- **响应式设计**: 双主题设计（OneAPI 清爽白 / NewAPI 赛博黑）

## 技术栈

| 层级 | 技术 |
|------|------|
| 前端 | React 18 + Vite + TailwindCSS + Recharts |
| 后端 | Express + node-cron |
| 数据库 | MySQL2 (OneAPI) + PostgreSQL (NewAPI) |
| 部署 | 支持局域网访问配置 |

## 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 环境配置

复制示例配置文件并填写实际参数：

```bash
cp .env.example .env
```

编辑 `.env` 文件：

```env
# MySQL - OneAPI
DB_HOST=localhost
DB_PORT=3306
DB_USER=your_mysql_user
DB_PASSWORD=your_mysql_password
DB_NAME=oneapi

# PostgreSQL - NewAPI
NEWAPI_DB_HOST=localhost
NEWAPI_DB_PORT=5432
NEWAPI_DB_USER=your_pg_user
NEWAPI_DB_PASSWORD=your_pg_password
NEWAPI_DB_NAME=new_api

# 飞书通知 (可选)
FEISHU_WEBHOOK_URL=your_feishu_webhook
FEISHU_ALERT_THRESHOLD=100

# 服务端口
PORT=3001
```

### 3. 启动开发服务器

```bash
npm run dev
```

- 前端: http://localhost:5173
- 后端 API: http://localhost:3001
- 个人查询页: http://localhost:5173/personal

### 4. 生产构建

```bash
npm run build
npm run server
```

### 5. Docker Compose 一键启动

项目已支持打包为单镜像并通过 Docker Compose 一键启动（仅应用容器，数据库使用外部实例）：

```bash
docker compose up -d --build
```

启动后访问：

- 前端: http://localhost:5173
- 后端 API: http://localhost:3001

停止服务：

```bash
docker compose down
```

说明：

- 数据库不会在 Compose 中启动，需先准备可访问的 MySQL 与 PostgreSQL。
- 应用通过 `docker-compose.yml` 的 `env_file: .env` 读取外部数据库连接配置。
- 可在 `docker-compose.yml` 的 `environment` 中覆盖默认值（如 `PORT`、`FEISHU_ALERT_THRESHOLD`）。

## 项目结构

```
.
├── server/
│   ├── index.js           # Express 入口 + MySQL 路由
│   ├── newapi.js          # NewAPI PostgreSQL 路由 + 费用计算
│   ├── feishu-notify.js   # 飞书定时通知
│   └── model-prices.json  # 本地价格数据库
├── src/
│   ├── main.jsx           # 路由配置
│   ├── App.jsx            # OneAPI 看板（浅色主题）
│   ├── NewApiDashboard.jsx # NewAPI 看板（深色主题）
│   ├── PersonalTokenPage.jsx # 个人令牌查询与详情页（受限访问）
│   └── PriceConfig.jsx    # 价格配置页面
├── README.md              # 中文文档
├── README_EN.md           # English Documentation
├── .env.example           # 环境变量示例
└── package.json
```

## 核心功能说明

### 费用计算公式

**OneAPI**: 使用固定价格（$/1M tokens）
```
费用 = (promptTokens × inputPrice + completionTokens × outputPrice) / 1_000_000
```

**NewAPI**: 使用倍率制
```
费用 = (promptTokens × ratio + completionTokens × ratio × completionRatio) × BASE_PRICE × EXCHANGE_RATE
```

### 飞书通知

- 每日 17:00 自动发送用量日报
- 筛选当日消耗超过阈值的令牌
- 包含：活跃令牌数、总调用次数、Token 总量、总费用
- 支持手动测试：`GET /api/newapi/test-notify?date=2026-02-01`

### 个人令牌查询页（新增）

- 入口路由：`/personal`
- 详情路由：`/personal/detail`
- 访问限制：在 `/personal` 路径下会隐藏主导航，只允许「查看个人详情」或「返回 Token 输入页」
- 令牌兼容规则：支持输入 `sk-xxxx` 或 `xxxx`；后端会自动处理前缀差异

后端相关接口：

- `GET /api/newapi/verify-token?token=...`：校验令牌是否存在，返回 `valid/hasUsage/tokenName/tokenId`
- `GET /api/newapi/user-overview?token=...`：个人总览（费用、请求、Token）
- `GET /api/newapi/user-daily-overview?token=...&date=YYYY-MM-DD`：个人当日明细
- `GET /api/newapi/user-trend?token=...&days=30`：个人趋势

> 说明：NewAPI 的 `tokens.key` 默认不带 `sk-` 前缀，本项目已做兼容映射。

## 局域网访问配置

修改 `vite.config.js`：

```javascript
server: {
  host: '0.0.0.0',  // 允许局域网访问
  port: 5173
}
```

Express 默认监听 `0.0.0.0:3001`。

## License

MIT
