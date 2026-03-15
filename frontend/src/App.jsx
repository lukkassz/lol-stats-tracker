import { useState } from "react"
import SearchPage from "./components/SearchPage"
import PlayerPage from "./components/PlayerPage"
import "./App.css"

export default function App() {
  const [player, setPlayer] = useState(null)

  return (
    <div className="app">
      {!player ? (
        <SearchPage onSearch={setPlayer} />
      ) : (
        <PlayerPage player={player} onBack={() => setPlayer(null)} />
      )}
    </div>
  )
}