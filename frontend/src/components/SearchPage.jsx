import { useState } from "react"
import axios from "axios"

const API = "http://localhost:8000"

const TIER_ORDER = ["IRON", "BRONZE", "SILVER", "GOLD", "PLATINUM", "EMERALD", "DIAMOND", "MASTER", "GRANDMASTER", "CHALLENGER"]
const TIER_COLORS = {
    IRON: "#7a7a7a", BRONZE: "#cd7f32", SILVER: "#a8a9ad",
    GOLD: "#ffd700", PLATINUM: "#00c0a0", EMERALD: "#00b050",
    DIAMOND: "#b9f2ff", MASTER: "#9d4dc0", GRANDMASTER: "#e84057", CHALLENGER: "#f4c874",
}

export default function SearchPage({ onSearch }) {
    const [input, setInput] = useState("")
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState("")

    async function handleSearch(e) {
        e.preventDefault()
        const parts = input.trim().split("#")
        if (parts.length !== 2) {
            setError("Wpisz w formacie Nick#TAG  (np. Faker#KR1)")
            return
        }
        const [name, tag] = parts
        setError("")
        setLoading(true)
        try {
            const res = await axios.get(`${API}/player/${encodeURIComponent(name)}/${encodeURIComponent(tag)}`)
            onSearch(res.data)
        } catch (err) {
            const msg = err?.response?.data?.detail
            if (err?.response?.status === 403) {
                setError(msg || "Klucz API wygasł – skontaktuj się z administratorem.")
            } else {
                setError(msg || "Nie znaleziono gracza. Sprawdź nick i tag.")
            }
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="search-page">
            <div className="search-hero">
                <div className="search-logo">
                    <span className="logo-icon">⚔</span>
                    <h1>LoL Stats Tracker</h1>
                    <p>Sprawdź statystyki dowolnego gracza na EUW</p>
                </div>

                <form className="search-form" onSubmit={handleSearch}>
                    <div className="search-input-wrap">
                        <input
                            type="text"
                            placeholder="Nick#TAG  (np. Faker#KR1)"
                            value={input}
                            onChange={e => setInput(e.target.value)}
                            className="search-input"
                            autoFocus
                        />
                        <button type="submit" className="search-btn" disabled={loading}>
                            {loading ? <span className="spinner" /> : "Szukaj"}
                        </button>
                    </div>
                    {error && <p className="search-error">{error}</p>}
                </form>

                <div className="tier-preview">
                    {TIER_ORDER.slice(3).map(t => (
                        <span key={t} className="tier-pill" style={{ color: TIER_COLORS[t], borderColor: TIER_COLORS[t] + "55" }}>
                            {t}
                        </span>
                    ))}
                </div>
            </div>
        </div>
    )
}