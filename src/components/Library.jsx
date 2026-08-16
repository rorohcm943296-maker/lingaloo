import { useState, useEffect } from "react";
import { getAllWords, deleteWord } from "../lib/db";
import { LANGUAGES, languageFlag, languageName } from "../lib/languages";
import PropTypes from "prop-types";

export default function Library({ refresh, onSelectWord }) {
  const [words, setWords] = useState([]);
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");

  useEffect(() => {
    loadWords();
  }, [refresh]);

  async function loadWords() {
    const all = await getAllWords();
    setWords(all);
  }

  const filtered = words.filter((w) => {
    const langMatch = filter === "all" || w.language === filter;
    const searchMatch = search === "" || w.word.toLowerCase().includes(search.toLowerCase());
    return langMatch && searchMatch;
  });

  async function handleDelete(id) {
    await deleteWord(id);
    loadWords();
  }

  return (
    <div className="library">
      <h2 className="section-title">📚 My words ({words.length})</h2>

      {words.length === 0 ? (
        <div className="empty-state">
          <p>No words yet! Go to <strong>Add</strong> to start your collection.</p>
        </div>
      ) : (
        <>
          <div className="lib-toolbar">
            <input
              className="search-input"
              type="text"
              placeholder="🔍 Search words…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <select
              className="filter-select"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
            >
              <option value="all">All languages</option>
              {LANGUAGES.map((l) => (
                <option key={l.code} value={l.code}>
                  {l.flag} {l.name}
                </option>
              ))}
            </select>
          </div>

          <div className="word-list">
            {filtered.map((w) => (
              <div key={w.id} className="word-row" onClick={() => onSelectWord?.(w)}>
                <div className="word-row-top">
                  <span className="word-lang">{languageFlag(w.language)}</span>
                  <span className="word-text">{w.word}</span>
                  <span className="word-level">
                    {w.level >= 5 ? "⭐" : "●".repeat(w.level + 1)}
                  </span>
                </div>
                <div className="word-row-bot">
                  {w.definitions?.[0] && (
                    <span className="word-def">{w.definitions[0].definition}</span>
                  )}
                  {w.translation && (
                    <span className="word-trans">→ {w.translation}</span>
                  )}
                </div>
                <button
                  className="btn-del"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDelete(w.id);
                  }}
                >
                  🗑
                </button>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

Library.propTypes = {
  refresh: PropTypes.number,
  onSelectWord: PropTypes.func,
};