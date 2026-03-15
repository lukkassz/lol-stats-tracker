import { useEffect, useState } from "react"
import axios from "axios"
import {
    LineChart, Line, XAxis, YAxis, Tooltip,
    ResponsiveContainer, ReferenceLine,
    BarChart, Bar, Cell
} from "recharts"

const API = "http://localhost:8000"
const DDR_VER = "14.10.1"

const TIER_COLORS = {
    IRON: "#7a7a7a", BRONZE: "#cd7f32", SILVER: "#a8a9ad",
    GOLD: "#ffd700", PLATINUM: "#00c0a0", EMERALD: "#00b050",
    DIAMOND: "#b9f2ff", MASTER: "#9d4dc0", GRANDMASTER: "#e84057", CHALLENGER: "#f4c874",
}

const QUEUE_LABELS = { solo: "Solo/Duo", flex: "Flex", aram: "ARAM", all: "All" }

function champIcon(name) {
    const fixed = name === "Nunu & Willump" ? "Nunu" : name
    return `https://ddragon.leagueoflegends.com/cdn/${DDR_VER}/img/champion/${fixed}.png`
}

function profileIcon(id) {
    return `https://ddragon.leagueoflegends.com/cdn/${DDR_VER}/img/profileicon/${id}.png`
}

function itemIcon(id) {
    if (!id) return null
    return `https://ddragon.leagueoflegends.com/cdn/${DDR_VER}/img/item/${id}.png`
}

function formatDmg(n) {
    return n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n)
}

function timeAgo(ts) {
    const h = Math.floor((Date.now() - ts) / 3600000)
    if (h < 1) return "just now"
    if (h < 24) return `${h}h ago`
    return `${Math.floor(h / 24)}d ago`
}

function buildLpChart(matches) {
    let lp = 0
    return [...matches].reverse().map((m, i) => {
        lp += m.win ? 20 : -17
        return { game: i + 1, lp, win: m.win }
    })
}

function ItemsRow({ items }) {
    return (
        <div className="items-row">
            {items.map((id, i) => {
                const src = itemIcon(id)
                return src
                    ? <img key={i} src={src} alt="" className="item-icon" />
                    : <div key={i} className="item-icon empty" />
            })}
        </div>
    )
}

function TeamRow({ player }) {
    return (
        <div className={`team-player ${player.isMe ? "team-me" : ""}`}>
            <img src={champIcon(player.champion)} alt={player.champion} className="team-champ-icon" />
            <span className="team-name">{player.summonerName}</span>
            <span className="team-kda">{player.kills}/{player.deaths}/{player.assists}</span>
            <span className="team-dmg">{formatDmg(player.damage)}</span>
            <span className="team-cs">{player.cs} ({player.csPerMin}/m)</span>
            <ItemsRow items={player.items} />
        </div>
    )
}

function MatchCard({ m }) {
    const [expanded, setExpanded] = useState(false)

    return (
        <div className={`match-card ${m.win ? "win" : "loss"}`}>
            <div className="match-main" onClick={() => setExpanded(e => !e)}>
                <div className="match-result-badge">{m.win ? "W" : "L"}</div>

                <img src={champIcon(m.champion)} alt={m.champion} className="match-champ-icon" />

                <div className="match-info">
                    <div className="match-champ-name">{m.champion}</div>
                    <div className="match-meta">{timeAgo(m.gameDate)} &middot; {m.gameDurationMin} min</div>
                </div>

                <div className="match-kda-block">
                    <div className="match-kda-score">
                        <span>{m.kills}</span>
                        <span className="slash"> / </span>
                        <span style={{ color: "#f87171" }}>{m.deaths}</span>
                        <span className="slash"> / </span>
                        <span>{m.assists}</span>
                    </div>
                    <div className="match-kda-ratio">{m.kda} KDA</div>
                </div>

                <div className="match-extra">
                    <div className="match-cs">{m.cs} CS ({m.csPerMin}/m)</div>
                    <div className="match-dmg">{formatDmg(m.damage)} dmg</div>
                </div>

                <ItemsRow items={m.items} />

                <div className="match-teams-preview">
                    <div className="teams-col">
                        {m.myTeam.map((p, i) => (
                            <img
                                key={i}
                                src={champIcon(p.champion)}
                                alt={p.champion}
                                className={`mini-icon ${p.isMe ? "mini-me" : ""}`}
                            />
                        ))}
                    </div>
                    <div className="teams-col">
                        {m.enemyTeam.map((p, i) => (
                            <img key={i} src={champIcon(p.champion)} alt={p.champion} className="mini-icon" />
                        ))}
                    </div>
                </div>

                <div className={`expand-arrow ${expanded ? "open" : ""}`}>&#x25BC;</div>
            </div>

            {expanded && (
                <div className="match-expanded">
                    <div className="team-section">
                        <div className="team-header win-label">Your Team</div>
                        {m.myTeam.map((p, i) => <TeamRow key={i} player={p} />)}
                    </div>
                    <div className="team-section">
                        <div className="team-header loss-label">Enemy Team</div>
                        {m.enemyTeam.map((p, i) => <TeamRow key={i} player={p} />)}
                    </div>
                </div>
            )}
        </div>
    )
}

export default function PlayerPage({ player, onBack }) {
    const [matches, setMatches] = useState([])
    const [champStats, setChampStats] = useState([])
    const [loading, setLoading] = useState(true)
    const [tab, setTab] = useState("matches")
    const [queue, setQueue] = useState("solo")

    useEffect(() => {
        let cancelled = false
        async function load() {
            setLoading(true)
            try {
                const [m, c] = await Promise.all([
                    axios.get(`${API}/matches/${player.puuid}?count=15&queue=${queue}`),
                    axios.get(`${API}/champion-stats/${player.puuid}?count=30&queue=${queue}`),
                ])
                if (!cancelled) {
                    setMatches(m.data.matches)
                    setChampStats(c.data.champions.slice(0, 10))
                }
            } catch (e) {
                console.error(e)
            } finally {
                if (!cancelled) setLoading(false)
            }
        }
        load()
        return () => { cancelled = true }
    }, [player.puuid, queue])

    const wins = matches.filter(m => m.win).length
    const losses = matches.length - wins
    const winrate = matches.length ? Math.round(wins / matches.length * 100) : null
    const avgKda = matches.length
        ? (matches.reduce((s, m) => s + m.kda, 0) / matches.length).toFixed(2)
        : null

    const lpData = buildLpChart(matches)
    const tier = player.rank?.tier
    const tierColor = TIER_COLORS[tier] || "#aaa"

    return (
        <div className="player-page">
            <div className="player-header">
                <button className="back-btn" onClick={onBack}>&larr; Back</button>

                <div className="player-card">
                    <div className="player-avatar-wrap">
                        <img src={profileIcon(player.profileIconId)} alt="icon" className="player-avatar" />
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
                                <span className="qs-label">Winrate (last {matches.length})</span>
                            </div>
                            <div className="qs">
                                <span className="qs-val">{avgKda}</span>
                                <span className="qs-label">Avg KDA</span>
                            </div>
                        </div>
                    )}
                </div>

                {lpData.length > 1 && (
                    <div className="lp-chart-wrap">
                        <div className="lp-chart-label">LP Trend (last {matches.length} games)</div>
                        <ResponsiveContainer width="100%" height={80}>
                            <LineChart data={lpData}>
                                <ReferenceLine y={0} stroke="#333" strokeDasharray="3 3" />
                                <Line
                                    type="monotone"
                                    dataKey="lp"
                                    stroke={lpData[lpData.length - 1]?.lp >= 0 ? "#4ade80" : "#f87171"}
                                    strokeWidth={2}
                                    dot={false}
                                />
                                <Tooltip
                                    formatter={(v) => [`${v > 0 ? "+" : ""}${v} LP`, "Trend"]}
                                    contentStyle={{ background: "#1e1e2e", border: "1px solid #333", borderRadius: 8, fontSize: 12 }}
                                />
                            </LineChart>
                        </ResponsiveContainer>
                    </div>
                )}
            </div>

            <div className="controls-row">
                <div className="queue-filters">
                    {Object.entries(QUEUE_LABELS).map(([key, label]) => (
                        <button
                            key={key}
                            className={`queue-btn ${queue === key ? "active" : ""}`}
                            onClick={() => setQueue(key)}
                        >
                            {label}
                        </button>
                    ))}
                </div>
                <div className="tabs">
                    <button className={`tab ${tab === "matches" ? "active" : ""}`} onClick={() => setTab("matches")}>
                        Match History
                    </button>
                    <button className={`tab ${tab === "champions" ? "active" : ""}`} onClick={() => setTab("champions")}>
                        Champion Stats
                    </button>
                </div>
            </div>

            {loading ? (
                <div className="loading-wrap">
                    <div className="spinner large" />
                    <p>Loading data...</p>
                </div>
            ) : matches.length === 0 ? (
                <div className="loading-wrap">
                    <p style={{ color: "var(--text-muted)" }}>No matches found for this queue.</p>
                </div>
            ) : (
                <>
                    {tab === "matches" && (
                        <div className="matches-list">
                            {matches.map(m => <MatchCard key={m.matchId} m={m} />)}
                        </div>
                    )}

                    {tab === "champions" && (
                        <div className="champions-section">
                            <div className="champ-chart">
                                <h3>Winrate per Champion</h3>
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
                                        <img src={champIcon(c.champion)} alt={c.champion} className="champ-icon" />
                                        <div className="champ-name">{c.champion}</div>
                                        <div className="champ-games">{c.games} games</div>
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
