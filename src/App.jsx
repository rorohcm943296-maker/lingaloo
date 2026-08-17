import { useState, useCallback } from "react";
import AddWord from "./components/AddWord";
import Library from "./components/Library";
import Review from "./components/Review";
import WordCard from "./components/WordCard";
import "./App.css";

const TABS = [
  { id: "add", icon: "➕", label: "Add" },
  { id: "library", icon: "📚", label: "Library" },
  { id: "review", icon: "🔄", label: "Review" },
];

export default function App() {
  const [tab, setTab] = useState("add");
  const [selectedWord, setSelectedWord] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const refresh = useCallback(() => setRefreshKey((k) => k + 1), []);

  return (
    <div className="app">
      <header className="app-header">
        <h1>Lingaloo <span className="version-badge">v31</span></h1>
        <p>Collect words, learn smarter</p>
      </header>

      <main className="app-main">
        {tab === "add" && (
          <AddWord
            onAdded={(w) => {
              setSelectedWord(w);
              refresh();
            }}
          />
        )}
        {tab === "library" && <Library refresh={refreshKey} onSelectWord={setSelectedWord} />}
        {tab === "review" && <Review />}
      </main>

      <nav className="tab-bar">
        {TABS.map((t) => (
          <button
            key={t.id}
            className={`tab-btn ${tab === t.id ? "active" : ""}`}
            onClick={() => setTab(t.id)}
          >
            <span className="tab-icon">{t.icon}</span>
            <span className="tab-label">{t.label}</span>
          </button>
        ))}
      </nav>

      {selectedWord && <WordCard word={selectedWord} onClose={() => setSelectedWord(null)} />}
    </div>
  );
}