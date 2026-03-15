# LoL Stats Tracker

A web application for tracking League of Legends player statistics. Search any player by Riot ID and view their rank, match history, champion stats, items, damage, and more.

![Python](https://img.shields.io/badge/Python-3.10+-blue)
![React](https://img.shields.io/badge/React-18-61dafb)
![FastAPI](https://img.shields.io/badge/FastAPI-0.115-009688)

## Features

- **Player Search** — Look up any player by Riot ID (Name#TAG)
- **Rank Display** — Solo/Duo and Flex queue ranks with LP, wins, and losses
- **Match History** — Recent matches with KDA, CS/min, damage dealt, and full item builds
- **Expandable Match Details** — View all 10 players per match with individual stats and items
- **Champion Stats** — Winrate, average KDA, and games played per champion with visual charts
- **Queue Filtering** — Filter matches by Solo/Duo, Flex, ARAM, or view all queues
- **LP Trend Chart** — Visual LP progression over recent games

## Tech Stack

| Layer    | Technology                     |
|----------|--------------------------------|
| Backend  | Python, FastAPI, httpx         |
| Frontend | React 18, Vite, Recharts       |
| API      | Riot Games API (Account, Summoner, League, Match v5) |
| Assets   | Data Dragon (champion/item icons) |

## Prerequisites

- Python 3.10+
- Node.js 18+
- [Riot Games API Key](https://developer.riotgames.com/)

## Setup

### Backend

```bash
cd backend
python -m venv venv

# Windows
venv\Scripts\activate
# macOS/Linux
source venv/bin/activate

pip install -r requirements.txt
```

Create a `.env` file in the `backend/` directory:

```env
RIOT_API_KEY=RGAPI-your-key-here
REGION=euw1
MASS_REGION=europe
```

> **Note:** Development API keys expire every 24 hours. Regenerate at [developer.riotgames.com](https://developer.riotgames.com/).

Start the server:

```bash
uvicorn main:app --reload
```

The API will be available at `http://localhost:8000`.

### Frontend

```bash
cd frontend
npm install
npm run dev
```

The app will be available at `http://localhost:5173`.

## API Endpoints

| Method | Endpoint                          | Description                        |
|--------|-----------------------------------|------------------------------------|
| GET    | `/player/{name}/{tag}`            | Player profile, rank, and level    |
| GET    | `/matches/{puuid}?count=15&queue=solo` | Match history with full details |
| GET    | `/champion-stats/{puuid}?count=30&queue=solo` | Per-champion statistics   |

**Queue options:** `solo`, `flex`, `aram`, `all`

## Project Structure

```
lol-stats-tracker/
├── backend/
│   ├── main.py              # FastAPI application
│   ├── requirements.txt     # Python dependencies
│   └── .env.example         # Environment variables template
├── frontend/
│   ├── src/
│   │   ├── App.jsx           # Root component
│   │   ├── App.css           # Global styles
│   │   └── components/
│   │       ├── SearchPage.jsx  # Player search UI
│   │       └── PlayerPage.jsx  # Stats display UI
│   ├── package.json
│   └── vite.config.js
└── README.md
```

## Configuration

| Variable      | Default   | Description                                    |
|---------------|-----------|------------------------------------------------|
| `RIOT_API_KEY` | —        | Your Riot Games API key (required)             |
| `REGION`       | `euw1`   | Game server (`eun1`, `na1`, `kr`, etc.)        |
| `MASS_REGION`  | `europe` | Routing region (`americas`, `asia`, `europe`)  |

## License

MIT
