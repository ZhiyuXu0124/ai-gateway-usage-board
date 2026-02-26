# AI Gateway Usage Board | 智能网关用量看板

<div align="center">

[![React](https://img.shields.io/badge/React-18-61DAFB?logo=react)](https://react.dev/)
[![Vite](https://img.shields.io/badge/Vite-5-646CFF?logo=vite)](https://vitejs.dev/)
[![Express](https://img.shields.io/badge/Express-4-000000?logo=express)](https://expressjs.com/)
[![TailwindCSS](https://img.shields.io/badge/TailwindCSS-3-06B6D4?logo=tailwindcss)](https://tailwindcss.com/)

**双数据源 LLM API 网关用量分析与成本估算平台**

[English](#english) | 中文

</div>

---

## 功能特性

- **双数据源支持**: 同时接入 OneAPI (MySQL) 和 NewAPI (PostgreSQL) 的用量日志
- **实时费用计算**: 基于模型倍率实时计算 Token 消耗成本（支持 USD/CNY 自动转换）
- **多维度分析**: 今日概览、30日趋势、模型分布、令牌排行榜
- **飞书通知**: 每日定时推送用量日报，超额告警
- **价格配置**: 支持从 models.dev 同步最新模型定价
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
DB_HOST=your_mysql_host
DB_PORT=3306
DB_USER=your_user
DB_PASSWORD=your_password
DB_NAME=oneapi

# PostgreSQL - NewAPI
NEWAPI_PG_URL=postgresql://user:pass@host:5432/new_api

# 飞书通知 (可选)
FEISHU_WEBHOOK_URL=your_feishu_webhook
FEISHU_ALERT_THRESHOLD=150
```

### 3. 启动开发服务器

```bash
npm run dev
```

- 前端: http://localhost:5173
- 后端 API: http://localhost:3001

### 4. 生产构建

```bash
npm run build
npm run server
```

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
│   └── PriceConfig.jsx    # 价格配置页面
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

---

<a name="english"></a>

# LLM API Usage Dashboard

<div align="center">

**Dual-Data-Source LLM API Gateway Analytics & Cost Estimation Platform**

中文 | [English](#english)

</div>

---

## Features

- **Dual Data Sources**: Connect to both OneAPI (MySQL) and NewAPI (PostgreSQL) usage logs
- **Real-time Cost Calculation**: Token cost calculation based on model ratios (USD/CNY auto-conversion)
- **Multi-dimensional Analytics**: Today overview, 30-day trends, model distribution, token leaderboards
- **Feishu Notifications**: Daily scheduled usage reports with over-threshold alerts
- **Price Configuration**: Sync latest model pricing from models.dev
- **Responsive Design**: Dual themes (OneAPI Light / NewAPI Cyber Dark)

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | React 18 + Vite + TailwindCSS + Recharts |
| Backend | Express + node-cron |
| Database | MySQL2 (OneAPI) + PostgreSQL (NewAPI) |
| Deployment | LAN access supported |

## Quick Start

### 1. Install Dependencies

```bash
npm install
```

### 2. Environment Configuration

Copy the example config and fill in your actual parameters:

```bash
cp .env.example .env
```

Edit `.env`:

```env
# MySQL - OneAPI
DB_HOST=your_mysql_host
DB_PORT=3306
DB_USER=your_user
DB_PASSWORD=your_password
DB_NAME=oneapi

# PostgreSQL - NewAPI
NEWAPI_PG_URL=postgresql://user:pass@host:5432/new_api

# Feishu Notification (optional)
FEISHU_WEBHOOK_URL=your_feishu_webhook
FEISHU_ALERT_THRESHOLD=150
```

### 3. Start Development Server

```bash
npm run dev
```

- Frontend: http://localhost:5173
- Backend API: http://localhost:3001

### 4. Production Build

```bash
npm run build
npm run server
```

## Project Structure

```
.
├── server/
│   ├── index.js           # Express entry + MySQL routes
│   ├── newapi.js          # NewAPI PostgreSQL routes + cost calc
│   ├── feishu-notify.js   # Feishu scheduled notifications
│   └── model-prices.json  # Local price database
├── src/
│   ├── main.jsx           # Router config
│   ├── App.jsx            # OneAPI dashboard (light theme)
│   ├── NewApiDashboard.jsx # NewAPI dashboard (dark theme)
│   └── PriceConfig.jsx    # Price configuration page
├── .env.example           # Environment variables example
└── package.json
```

## Core Features

### Cost Calculation Formula

**OneAPI**: Fixed price ($/1M tokens)
```
Cost = (promptTokens × inputPrice + completionTokens × outputPrice) / 1_000_000
```

**NewAPI**: Ratio-based
```
Cost = (promptTokens × ratio + completionTokens × ratio × completionRatio) × BASE_PRICE × EXCHANGE_RATE
```

### Feishu Notifications

- Daily reports at 17:00
- Filter tokens exceeding threshold
- Includes: active tokens, total calls, token count, total cost
- Manual test: `GET /api/newapi/test-notify?date=2026-02-01`

## LAN Access Configuration

Modify `vite.config.js`:

```javascript
server: {
  host: '0.0.0.0',  // Allow LAN access
  port: 5173
}
```

Express listens on `0.0.0.0:3001` by default.

## License

MIT
