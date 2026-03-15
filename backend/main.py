from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import httpx
import os
from dotenv import load_dotenv

load_dotenv()

app = FastAPI(title="LoL Stats Tracker API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:5174", "https://*.vercel.app"],
    allow_methods=["*"],
    allow_headers=["*"],
)

REGION = "euw1"          # serwer gracza (zmień na swój: eun1, na1, kr, ...)
MASS_REGION = "europe"   # region do Match API (europe / americas / asia)

def get_headers():
    return {"X-Riot-Token": os.getenv("RIOT_API_KEY")}


# ──────────────────────────────────────────────
# 1. Pobierz dane gracza po Riot ID (Nick#Tag)
# ──────────────────────────────────────────────
@app.get("/player/{game_name}/{tag_line}")
async def get_player(game_name: str, tag_line: str):
    try:
        async with httpx.AsyncClient() as client:
            # Krok 1: pobierz PUUID przez Riot Account API
            account_url = (
                f"https://{MASS_REGION}.api.riotgames.com/riot/account/v1/accounts/by-riot-id"
                f"/{game_name}/{tag_line}"
            )
            r = await client.get(account_url, headers=get_headers())
            print(f"[DEBUG] Krok 1 - status: {r.status_code}, url: {account_url}")
            if r.status_code in (401, 403):
                raise HTTPException(status_code=403, detail=f"Klucz API nieprawidłowy lub wygasł (HTTP {r.status_code})")
            if r.status_code != 200:
                raise HTTPException(status_code=404, detail=f"Gracz nie znaleziony (Riot zwrócił {r.status_code})")
            account = r.json()
            puuid = account["puuid"]

            # Krok 2: pobierz dane summonera (poziom, ikona)
            summoner_url = (
                f"https://{REGION}.api.riotgames.com/lol/summoner/v4/summoners/by-puuid/{puuid}"
            )
            r2 = await client.get(summoner_url, headers=get_headers())
            print(f"[DEBUG] Krok 2 - status: {r2.status_code}")
            if r2.status_code in (401, 403):
                raise HTTPException(status_code=403, detail=f"Klucz API nieprawidłowy lub wygasł (HTTP {r2.status_code})")
            if r2.status_code != 200:
                raise HTTPException(status_code=404, detail="Nie znaleziono summonera")
            summoner = r2.json()

            # Krok 3: pobierz rank (przez PUUID)
            league_url = (
                f"https://{REGION}.api.riotgames.com/lol/league/v4/entries/by-puuid/{puuid}"
            )
            r3 = await client.get(league_url, headers=get_headers())
            print(f"[DEBUG] Krok 3 - status: {r3.status_code}")
            if r3.status_code != 200:
                raise HTTPException(status_code=502, detail="Błąd pobierania rangi")
            league_data = r3.json()

            # Znajdź Solo Queue
            solo_queue = next(
                (q for q in league_data if q["queueType"] == "RANKED_SOLO_5x5"),
                None
            )

            return {
                "gameName": game_name,
                "tagLine": tag_line,
                "puuid": puuid,
                "summonerLevel": summoner.get("summonerLevel"),
                "profileIconId": summoner.get("profileIconId"),
                "rank": {
                    "tier": solo_queue["tier"] if solo_queue else None,
                    "rank": solo_queue["rank"] if solo_queue else None,
                    "lp": solo_queue["leaguePoints"] if solo_queue else None,
                    "wins": solo_queue["wins"] if solo_queue else None,
                    "losses": solo_queue["losses"] if solo_queue else None,
                } if solo_queue else None,
            }
    except HTTPException:
        raise
    except Exception as e:
        print(f"[ERROR] {type(e).__name__}: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"{type(e).__name__}: {e}")


# ──────────────────────────────────────────────
# 2. Ostatnie mecze gracza
# ──────────────────────────────────────────────
@app.get("/matches/{puuid}")
async def get_matches(puuid: str, count: int = 10):
    """
    Zwraca listę ostatnich meczów (domyślnie 10).
    Przykład: GET /matches/{puuid}?count=10
    """
    async with httpx.AsyncClient() as client:
        # Pobierz listę ID meczów
        ids_url = (
            f"https://{MASS_REGION}.api.riotgames.com/lol/match/v5/matches/by-puuid"
            f"/{puuid}/ids?count={count}&queue=420"  # 420 = Solo Queue
        )
        r = await client.get(ids_url, headers=get_headers())
        match_ids = r.json()

        matches = []
        for match_id in match_ids:
            match_url = (
                f"https://{MASS_REGION}.api.riotgames.com/lol/match/v5/matches/{match_id}"
            )
            r2 = await client.get(match_url, headers=get_headers())
            data = r2.json()

            # Znajdź dane konkretnego gracza w tym meczu
            participant = next(
                (p for p in data["info"]["participants"] if p["puuid"] == puuid),
                None
            )
            if not participant:
                continue

            matches.append({
                "matchId": match_id,
                "champion": participant["championName"],
                "win": participant["win"],
                "kills": participant["kills"],
                "deaths": participant["deaths"],
                "assists": participant["assists"],
                "kda": round(
                    (participant["kills"] + participant["assists"])
                    / max(participant["deaths"], 1), 2
                ),
                "cs": participant["totalMinionsKilled"] + participant.get("neutralMinionsKilled", 0),
                "gameDurationMin": round(data["info"]["gameDuration"] / 60, 1),
                "gameDate": data["info"]["gameCreation"],
            })

        return {"matches": matches}


# ──────────────────────────────────────────────
# 3. Statystyki per champion
# ──────────────────────────────────────────────
@app.get("/champion-stats/{puuid}")
async def get_champion_stats(puuid: str, count: int = 30):
    """
    Zwraca winrate i średnie KDA per champion z ostatnich meczów.
    Przykład: GET /champion-stats/{puuid}?count=30
    """
    matches_data = await get_matches(puuid, count=count)
    matches = matches_data["matches"]

    stats: dict = {}
    for m in matches:
        champ = m["champion"]
        if champ not in stats:
            stats[champ] = {"games": 0, "wins": 0, "kills": 0, "deaths": 0, "assists": 0}

        stats[champ]["games"] += 1
        stats[champ]["wins"] += 1 if m["win"] else 0
        stats[champ]["kills"] += m["kills"]
        stats[champ]["deaths"] += m["deaths"]
        stats[champ]["assists"] += m["assists"]

    result = []
    for champ, s in stats.items():
        g = s["games"]
        result.append({
            "champion": champ,
            "games": g,
            "winrate": round(s["wins"] / g * 100, 1),
            "avgKills": round(s["kills"] / g, 1),
            "avgDeaths": round(s["deaths"] / g, 1),
            "avgAssists": round(s["assists"] / g, 1),
            "avgKda": round(
                (s["kills"] + s["assists"]) / max(s["deaths"], 1), 2
            ),
        })

    result.sort(key=lambda x: x["games"], reverse=True)
    return {"champions": result}


@app.get("/debug")
async def debug():
    key = os.getenv("RIOT_API_KEY")
    import httpx
    async with httpx.AsyncClient() as client:
        r = await client.get(
            "https://europe.api.riotgames.com/riot/account/v1/accounts/by-riot-id/Caps/EUW",
            headers={"X-Riot-Token": key}
        )
    return {"key_loaded": bool(key), "key_prefix": key[:12] if key else None, "riot_status": r.status_code}

@app.get("/")
async def root():
    return {"message": "LoL Stats Tracker API działa!"}