# Class Visual Score System

A full-stack classroom score platform with real-time leaderboard updates.

## Stack

- Server: Node.js + Express + SQLite (`node:sqlite`) + WebSocket (`ws`)
- Admin: Tailwind CSS + Apache ECharts
- Client: Tailwind CSS (classroom big-screen display)

## Folder Structure

```text
ClassScoreSystem/
├─ server/
│  ├─ data/
│  │  └─ class-score.db              # auto-created SQLite db
│  └─ src/
│     └─ index.js                    # API + DB + WebSocket
├─ admin/
│  ├─ index.html                     # teacher admin page
│  └─ main.js
├─ client/
│  ├─ index.html                     # classroom screen page
│  └─ main.js
├─ .env.example
├─ package.json
└─ README.md
```

## Features

- SQL student storage: `name`, `points`, `level`
- Score history logs: `delta`, `reason`, `note`, `time`
- Admin scoring actions: `+1`, `+2`, `-1`, and custom integer delta
- Default reasons + custom reason
- Live ECharts bar chart in admin panel
- Client ranking board with auto-scroll
- Student detail view with score history
- Auto return to main ranking after 15 seconds idle on detail panel
- Real-time updates via WebSocket
- 3-second popup animation for score updates on classroom display
- Level logic:
  - `L = floor(sqrt(points / 5))`
  - Progress % is based on current-level floor to next-level floor range

## Quick Start

1. Check Node.js version (`22+`, recommend `24.x`):

```bash
node -v
```

2. Install dependencies:

```bash
npm install
```

3. Optional environment setup:

```bash
copy .env.example .env
```

- Keep `ADMIN_PASSWORD=` empty for open admin access.
- Set `ADMIN_PASSWORD=your_password` to require admin login.

4. Start:

```bash
npm start
```

5. Open:

- Admin: `http://localhost:3000/admin`
- Client: `http://localhost:3000/client`

## Deployment Notes

- Deploy directly to your own server.
- Use PM2 in production: `pm2 start npm --name class-score -- start`
- Use Nginx/Apache reverse proxy if needed.
- Default DB path: `server/data/class-score.db`

## Main APIs

- `GET /api/config`
- `POST /api/admin/login`
- `GET /api/students`
- `GET /api/students/:id/logs`
- `POST /api/students/:id/score`
- `GET /api/summary/top`
- `WS /ws`
