from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import httpx
import os
from dotenv import load_dotenv

load_dotenv()

app = FastAPI(title="LoL Stats Tracker API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:5174"],
    allow_methods=["*"],
    allow_headers=["*"],
)

REGION = os.getenv("REGION", "euw1")
MASS_REGION = os.getenv("MASS_REGION", "europe")

QUEUE_MAP = {
    "solo": 420,
    "flex": 440,
    "aram": 450,
    "all": None,
}


def get_headers():
    key = os.getenv("RIOT_API_KEY")
    if not key:
        raise HTTPException(status_code=500, detail="RIOT_API_KEY not configured")
    return {"X-Riot-Token": key}


@app.get("/player/{game_name}/{tag_line}")
async def get_player(game_name: str, tag_line: str):
    headers = get_headers()
    async with httpx.AsyncClient() as client:
        r = await client.get(
            f"https://{MASS_REGION}.api.riotgames.com/riot/account/v1/accounts"
            f"/by-riot-id/{game_name}/{tag_line}",
            headers=headers,
        )
        if r.status_code in (401, 403):
            raise HTTPException(status_code=403, detail="API key expired or invalid")
        if r.status_code != 200:
            raise HTTPException(status_code=404, detail="Player not found")
        account = r.json()
        puuid = account["puuid"]

        r2 = await client.get(
            f"https://{REGION}.api.riotgames.com/lol/summoner/v4/summoners/by-puuid/{puuid}",
            headers=headers,
        )
        if r2.status_code != 200:
            raise HTTPException(status_code=404, detail="Summoner not found")
        summoner = r2.json()

        r3 = await client.get(
            f"https://{REGION}.api.riotgames.com/lol/league/v4/entries/by-puuid/{puuid}",
            headers=headers,
        )
        league_data = r3.json() if r3.status_code == 200 else []

        solo = next((q for q in league_data if q["queueType"] == "RANKED_SOLO_5x5"), None)
        flex = next((q for q in league_data if q["queueType"] == "RANKED_FLEX_SR"), None)

        def rank_info(q):
            if not q:
                return None
            return {
                "tier": q["tier"],
                "rank": q["rank"],
                "lp": q["leaguePoints"],
                "wins": q["wins"],
                "losses": q["losses"],
            }

        return {
            "gameName": game_name,
            "tagLine": tag_line,
            "puuid": puuid,
            "summonerLevel": summoner.get("summonerLevel"),
            "profileIconId": summoner.get("profileIconId"),
            "rank": rank_info(solo),
            "rankFlex": rank_info(flex),
        }


@app.get("/matches/{puuid}")
async def get_matches(puuid: str, count: int = 10, queue: str = "solo"):
    headers = get_headers()
    queue_id = QUEUE_MAP.get(queue)

    async with httpx.AsyncClient() as client:
        url = (
            f"https://{MASS_REGION}.api.riotgames.com/lol/match/v5/matches"
            f"/by-puuid/{puuid}/ids?count={count}"
        )
        if queue_id is not None:
            url += f"&queue={queue_id}"

        r = await client.get(url, headers=headers)
        if r.status_code != 200:
            raise HTTPException(status_code=502, detail="Failed to fetch match IDs")
        match_ids = r.json()

        matches = []
        for match_id in match_ids:
            r2 = await client.get(
                f"https://{MASS_REGION}.api.riotgames.com/lol/match/v5/matches/{match_id}",
                headers=headers,
            )
            if r2.status_code != 200:
                continue
            data = r2.json()
            participants = data["info"]["participants"]

            me = next((p for p in participants if p["puuid"] == puuid), None)
            if not me:
                continue

            duration_min = round(data["info"]["gameDuration"] / 60, 1)

            def player_items(p):
                return [p.get(f"item{i}", 0) for i in range(7)]

            def build_player(p):
                cs = p["totalMinionsKilled"] + p.get("neutralMinionsKilled", 0)
                return {
                    "champion": p["championName"],
                    "summonerName": p.get("riotIdGameName", p.get("summonerName", "?")),
                    "kills": p["kills"],
                    "deaths": p["deaths"],
                    "assists": p["assists"],
                    "cs": cs,
                    "csPerMin": round(cs / max(duration_min, 1), 1),
                    "damage": p.get("totalDamageDealtToChampions", 0),
                    "items": player_items(p),
                    "isMe": p["puuid"] == puuid,
                }

            def build_team(team_id):
                return [build_player(p) for p in participants if p["teamId"] == team_id]

            my_team_id = me["teamId"]
            enemy_team_id = 200 if my_team_id == 100 else 100
            my_cs = me["totalMinionsKilled"] + me.get("neutralMinionsKilled", 0)

            matches.append({
                "matchId": match_id,
                "champion": me["championName"],
                "win": me["win"],
                "kills": me["kills"],
                "deaths": me["deaths"],
                "assists": me["assists"],
                "kda": round((me["kills"] + me["assists"]) / max(me["deaths"], 1), 2),
                "cs": my_cs,
                "csPerMin": round(my_cs / max(duration_min, 1), 1),
                "damage": me.get("totalDamageDealtToChampions", 0),
                "items": player_items(me),
                "gameDurationMin": duration_min,
                "gameDate": data["info"]["gameCreation"],
                "queueId": data["info"]["queueId"],
                "myTeam": build_team(my_team_id),
                "enemyTeam": build_team(enemy_team_id),
            })

        return {"matches": matches}


@app.get("/champion-stats/{puuid}")
async def get_champion_stats(puuid: str, count: int = 30, queue: str = "solo"):
    matches_data = await get_matches(puuid, count=count, queue=queue)

    stats: dict = {}
    for m in matches_data["matches"]:
        champ = m["champion"]
        if champ not in stats:
            stats[champ] = {"games": 0, "wins": 0, "kills": 0, "deaths": 0, "assists": 0}
        s = stats[champ]
        s["games"] += 1
        s["wins"] += 1 if m["win"] else 0
        s["kills"] += m["kills"]
        s["deaths"] += m["deaths"]
        s["assists"] += m["assists"]

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
            "avgKda": round((s["kills"] + s["assists"]) / max(s["deaths"], 1), 2),
        })

    result.sort(key=lambda x: x["games"], reverse=True)
    return {"champions": result}


@app.get("/")
async def root():
    return {"status": "ok", "message": "LoL Stats Tracker API"}
