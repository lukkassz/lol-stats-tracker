import { useEffect, useState } from "react"
import axios from "axios"
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts"

const API = "http://localhost:8000"

const TIER_COLORS = {
    IRON: "#7a7a7a", BRONZE: "#cd7f32", SILVER: "#a8a9ad",
    GOLD: "#ffd700", PLATINUM: "#00c0a0", EMERALD: "#00b050",
    DIAMOND: "#b9f2ff", MASTER: "#9d4dc0", GRANDMASTER: "#e84057", CHALLENGER: "#f4c874",
}

function getChampionIcon(name) {
    // Data Dragon CDN – zawsze aktualne ikony championów
    const fixed = name === "Nunu & Willump" ? "Nunu" : name
    return `https://ddragon.leagueoflegends.com/cdn/14.10.1/img/champion/${fixed}.png`
}

function getProfileIcon(id) {
    return `https://ddragon.leagueoflegends.com/cdn/14.10.1/img/profileicon/${id}.png`
}

export default function PlayerPage({ player, onBack }) {
    const [matches, setMatches] = useState([])
    const [champStats, setChampStats] = useState([])
    const [loading, setLoading] = useState(true)
    const [tab, setTab] = useState("matches")

    useEffect(() => {
        async function load() {
            setLoading(true)
            try {
                const [m, c] = await Promise.all([
                    axios.get(`${API}/matches/${player.puuid}?count=10`),
                    axios.get(`${API}/champion-stats/${player.puuid}?count=30`),
                ])
                setMatches(m.data.matches)
                setChampStats(c.data.champions.slice(0, 8))
            } catch (e) {
                console.error(e)
            } finally {
                setLoading(false)
            }
        }
        load()
    }, [player.puuid])

    const winrate = matches.length
        ? Math.round(matches.filter(m => m.win).length / matches.length * 100)
        : null

    const avgKda = matches.length
        ? (matches.reduce((s, m) => s + m.kda, 0) / matches.length).toFixed(2)
        : null

    const tier = player.rank?.tier
    const tierColor = tier ? (TIER_COLORS[tier] || "#aaa") : "#aaa"

    return (
        <div className="player-page">
            {/* Header */}
            <div className="player-header">
                <button className="back-btn" onClick={onBack}>← Wróć</button>

                <div className="player-card">
                    <div className="player-avatar-wrap">
                        <img
                            src={getProfileIcon(player.profileIconId)}
                            alt="icon"
                            className="player-avatar"
                        />
                        <span className="player-level">{player.summonerLevel}</span>
                    </div>

                    <div className="player-info">
                        <h2 className="player-name">
                            {player.gameName}
                            <span className="player-tag">#{player.tagLine}</span>
                        </h2>

                        {player.rank ? (
                            <div className="player-rank" style={{ color: tierColor }}>
                                <span className="rank-tier">{player.rank.tier} {player.rank.rank}</span>
                                <span className="rank-lp">{player.rank.lp} LP</span>
                                <span className="rank-wr">
                                    {player.rank.wins}W / {player.rank.losses}L &nbsp;
                                    ({Math.round(player.rank.wins / (player.rank.wins + player.rank.losses) * 100)}%)
                                </span>
                            </div>
                        ) : (
                            <p className="unranked">Unranked</p>
                        )}
                    </div>

                    {matches.length > 0 && (
                        <div className="player-quick-stats">
                            <div className="qs">
                                <span className="qs-val" style={{ color: winrate >= 50 ? "#4ade80" : "#f87171" }}>
                                    {winrate}%
                                </span>
                                <span className="qs-label">Winrate (last 10)</span>
                            </div>
                            <div className="qs">
                                <span className="qs-val">{avgKda}</span>
                                <span className="qs-label">Avg KDA</span>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Tabs */}
            <div className="tabs">
                <button className={`tab ${tab === "matches" ? "active" : ""}`} onClick={() => setTab("matches")}>
                    Historia meczów
                </button>
                <button className={`tab ${tab === "champions" ? "active" : ""}`} onClick={() => setTab("champions")}>
                    Statystyki championów
                </button>
            </div>

            {loading ? (
                <div className="loading-wrap">
                    <div className="spinner large" />
                    <p>Ładowanie danych z Riot API…</p>
                </div>
            ) : (
                <>
                    {/* MATCHES TAB */}
                    {tab === "matches" && (
                        <div className="matches-list">
                            {matches.map(m => (
                                <div key={m.matchId} className={`match-row ${m.win ? "win" : "loss"}`}>
                                    <div className="match-result">{m.win ? "W" : "L"}</div>
                                    <img src={getChampionIcon(m.champion)} alt={m.champion} className="champ-icon" />
                                    <div className="match-champ">{m.champion}</div>
                                    <div className="match-kda">
                                        <span className="kda-score">
                                            {m.kills} / <span style={{ color: "#f87171" }}>{m.deaths}</span> / {m.assists}
                                        </span>
                                        <span className="kda-ratio">{m.kda} KDA</span>
                                    </div>
                                    <div className="match-cs">{m.cs} CS</div>
                                    <div className="match-time">{m.gameDurationMin} min</div>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* CHAMPIONS TAB */}
                    {tab === "champions" && (
                        <div className="champions-section">
                            <div className="champ-chart">
                                <h3>Winrate per champion (ostatnie 30 meczów)</h3>
                                <ResponsiveContainer width="100%" height={260}>
                                    <BarChart data={champStats} margin={{ top: 10, right: 20, left: 0, bottom: 5 }}>
                                        <XAxis dataKey="champion" tick={{ fill: "#aaa", fontSize: 12 }} />
                                        <YAxis domain={[0, 100]} tick={{ fill: "#aaa", fontSize: 12 }} unit="%" />
                                        <Tooltip
                                            formatter={(v) => [`${v}%`, "Winrate"]}
                                            contentStyle={{ background: "#1e1e2e", border: "1px solid #333", borderRadius: 8 }}
                                        />
                                        <Bar dataKey="winrate" radius={[6, 6, 0, 0]}>
                                            {champStats.map((entry, i) => (
                                                <Cell key={i} fill={entry.winrate >= 50 ? "#4ade80" : "#f87171"} />
                                            ))}
                                        </Bar>
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>

                            <div className="champ-table">
                                {champStats.map(c => (
                                    <div key={c.champion} className="champ-row">
                                        <img src={getChampionIcon(c.champion)} alt={c.champion} className="champ-icon" />
                                        <div className="champ-name">{c.champion}</div>
                                        <div className="champ-games">{c.games} gier</div>
                                        <div className="champ-wr" style={{ color: c.winrate >= 50 ? "#4ade80" : "#f87171" }}>
                                            {c.winrate}%
                                        </div>
                                        <div className="champ-kda">{c.avgKills}/{c.avgDeaths}/{c.avgAssists}</div>
                                        <div className="champ-kda-ratio">{c.avgKda} KDA</div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </>
            )}
        </div>
    )
}