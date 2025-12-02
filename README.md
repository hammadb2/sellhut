# Sell Hut Backend

A lightweight SaaS-style backend for automating acquisitions and dispositions workflows for real estate wholesaling. Built with Node.js, TypeScript, Express, Prisma (PostgreSQL), and Twilio/LLM stubs.

## Prerequisites
- Node.js 18+
- PostgreSQL database
- Redis (optional if you swap cron for BullMQ)

## Environment Variables
Create a `.env` file with:

```
DATABASE_URL=postgresql://user:password@localhost:5432/sellhut
API_KEY=dev-key
PORT=3000
OPENAI_API_KEY=your-openai-key
TWILIO_ACCOUNT_SID=...
TWILIO_AUTH_TOKEN=...
TWILIO_PHONE_NUMBER=+15555550123
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_USER=user
SMTP_PASS=pass
```

Only `DATABASE_URL`, `API_KEY`, and `PORT` are required to boot. Twilio/SMTP/LLM keys enable live sending and AI text.

## Install & Database

```bash
npm install
npx prisma generate
npx prisma migrate dev --name init --create-only # creates migration files; run without --create-only to apply
npm run prisma:seed
```

> Adjust the migrate command to point at your running Postgres instance.

## Running

```bash
npm run dev
```

The server listens on `PORT` (default 3000). Health check at `/health`.

## API Authentication
All endpoints (except webhooks) expect an `x-api-key` header matching `API_KEY`.

## Key Endpoints

### Acquisitions
- `POST /api/acquisitions/import-propstream` (multipart `file`): import PropStream CSV.
- `GET /api/properties?status=NEW&zip=46218&motivationScoreMin=50`: list properties with filters.
- `POST /api/properties/:id/score`: AI ARV + motivation scoring.
- `POST /api/leads/:id/contact` `{ sendSms?: boolean }`: generate outreach scripts and optional SMS.

### Buyers & Dispo
- `POST /api/buyers` / `GET /api/buyers` / `PATCH /api/buyers/:id` / `DELETE /api/buyers/:id`
- `POST /api/deals`: create a deal and AI marketing blurb.
- `POST /api/deals/:id/match-buyers`: create DispoMatch rows.
- `POST /api/deals/:id/send-to-buyers` `{ via: "sms" | "email" | "both" }`: push to matched buyers.

### Webhooks
- `POST /api/webhooks/twilio-sms`: Twilio SMS inbound handler to classify buyer replies.

## Example cURL

```bash
curl -X POST http://localhost:3000/api/acquisitions/import-propstream \
  -H "x-api-key: $API_KEY" \
  -F "file=@propstream.csv"

curl -X POST http://localhost:3000/api/properties/{id}/score -H "x-api-key: $API_KEY"

curl -X POST http://localhost:3000/api/leads/{leadId}/contact \
  -H "x-api-key: $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"sendSms":true}'

curl -X POST http://localhost:3000/api/deals \
  -H "x-api-key: $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"propertyId":"...","contractPrice":120000}'
```

## Notes
- Nightly cron (2 AM server time) scores NEW properties via AI.
- AI prompts and Twilio/SMTP are stubbed-friendly for local development.
