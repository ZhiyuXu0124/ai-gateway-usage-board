# AI Gateway Usage Board

<div align="center">

[![React](https://img.shields.io/badge/React-18-61DAFB?logo=react)](https://react.dev/)
[![Vite](https://img.shields.io/badge/Vite-5-646CFF?logo=vite)](https://vitejs.dev/)
[![Express](https://img.shields.io/badge/Express-4-000000?logo=express)](https://expressjs.com/)
[![TailwindCSS](https://img.shields.io/badge/TailwindCSS-3-06B6D4?logo=tailwindcss)](https://tailwindcss.com/)

**Dual-Data-Source LLM API Gateway Analytics & Cost Estimation Platform**

English | [中文](README.md)

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

Edit \`.env\`:

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

# Feishu Notification (optional)
FEISHU_WEBHOOK_URL=your_feishu_webhook
FEISHU_ALERT_THRESHOLD=100
FEISHU_RETRY_MAX_ATTEMPTS=4
FEISHU_RETRY_DELAY_MS=30000
FEISHU_USER_MAPPING={"Alice":"ou_xxx","Bob":"ou_yyy"}

# Feishu Bitable (optional, daily sync for over-budget users)
FEISHU_APP_ID=cli_xxx
FEISHU_APP_SECRET=your_feishu_app_secret
FEISHU_BITABLE_APP_TOKEN=app_xxx
FEISHU_BITABLE_TABLE_ID=tbl_xxx
FEISHU_BITABLE_DATE_FIELD=Time
FEISHU_BITABLE_PERSON_FIELD=Person
FEISHU_BITABLE_COST_FIELD=Cost
FEISHU_BITABLE_REMARK_FIELD=OverBudgetNote

# Server Port
PORT=3001
```

### 3. Start Development Server

```bash
npm run dev
```

- Frontend: http://localhost:5173
- Backend API: http://localhost:3001

If Docker is already using default ports, run local development on alternate ports (and disable local Feishu push to avoid duplicate notifications):

```bash
# Backend (disable local Feishu)
FEISHU_WEBHOOK_URL='' PORT=3002 npm run server

# Frontend (proxy to 3002)
VITE_API_PROXY_TARGET=http://localhost:3002 npm run client -- --port 5174 --host 0.0.0.0
```

### 4. Production Build

```bash
npm run build
npm run server
```

### 5. One-Command Docker Compose Startup

This project can be packaged as a single image and started via Docker Compose (app container only; databases are external):

```bash
docker compose up -d --build
```

- Image name: `ai-gateway-usage-board`
- Container name: `ai-gateway-usage-board`

After startup:

- Frontend: http://localhost:5173

Notes:

- Port `3001` still listens inside the container, but is **not exposed to the host by default**
- Normal browser usage only needs `5173`
- If you need to trigger Feishu manually, use the in-container command below

Stop all services:

```bash
docker compose down
```

Notes:

- Compose does not start MySQL/PostgreSQL; provide reachable external database instances first.
- The app reads external DB config from `.env` via `env_file` in `docker-compose.yml`.
- You can override defaults in `environment` (e.g., `PORT`, `FEISHU_ALERT_THRESHOLD`).

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
├── README.md              # Chinese Documentation
├── README_EN.md           # English Documentation
├── .env.example           # Environment variables example
└── package.json
```

## Core Features

### Cost Calculation Formula

**OneAPI**: Fixed price (\$/1M tokens)
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
- If Feishu rate-limits (e.g. `11232`), the service auto-retries with configured backoff
- Supports over-budget reminder mentions (`<at>` when user-id mapping exists; fallback to text `@name`)
- When Bitable config is provided, daily records are written to fields: time/person/cost/over-budget note
- Online config page: `/newapi/feishu-config` (load/save config and trigger test push)
- Manual trigger for the running Docker container:

```bash
docker exec ai-gateway-usage-board node -e "fetch('http://127.0.0.1:3001/api/newapi/test-notify').then(r=>r.text()).then(console.log)"
```

- Manual trigger for a specific date:

```bash
docker exec ai-gateway-usage-board node -e "fetch('http://127.0.0.1:3001/api/newapi/test-notify?date=2026-02-01').then(r=>r.text()).then(console.log)"
```

## LAN Access Configuration

Modify \`vite.config.js\`:

```javascript
server: {
  host: '0.0.0.0',  // Allow LAN access
  port: 5173
}
```

Express listens on \`0.0.0.0:3001\` by default.

## License

MIT
