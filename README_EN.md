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

# Server Port
PORT=3001
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

### 5. One-Command Docker Compose Startup

This project can be packaged as a single image and started via Docker Compose (app container only; databases are external):

```bash
docker compose up -d --build
```

After startup:

- Frontend: http://localhost:5173
- Backend API: http://localhost:3001

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
- Manual test: \`GET /api/newapi/test-notify?date=2026-02-01\`

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
