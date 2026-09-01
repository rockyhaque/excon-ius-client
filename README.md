# excon-ius-client

- React Router (browser router)
- Redux Toolkit + RTK Query
- Axios base query with automatic refresh
- Login + role-based protected routes (Admin/Teacher)

## Setup

```bash
cd excon-ius-client
npm install
```

Create/update `.env`:

```bash
VITE_BASE_URL=http://localhost:5000/api
```

## Run

```bash
npm run dev
```

Server CORS must allow the Vite URL. In `excon-ius-server/.env` set:

```bash
CLIENT_URL=http://localhost:5173
```

## E2E (Playwright)

Client-only. API calls are mocked, so the backend does not need to be running.

```bash
npx playwright install chromium
npm run test:e2e
```


