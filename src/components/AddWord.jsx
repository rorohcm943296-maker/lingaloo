import { useState } from "react";
import { LANGUAGES } from "../lib/languages";
import { lookupWord } from "../lib/dictionary";
import { addWord, makeId } from "../lib/db";
import PropTypes from "prop-types";

export default function AddWord({ onAdded }) {
  const [word, setWord] = useState("");
  const [langCode, setLangCode] = useState("en");
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  // manual-entry fallback fields
  const [manual, setManual] = useState(false);
  const [manualDef, setManualDef] = useState("");
  const [manualTrans, setManualTrans] = useState("");

  async function saveEntry(data, source) {
    const entry = {
      id: makeId(),
      word: word.trim(),
      language: langCode,
      note: note.trim(),
      phonetic: data.phonetic || "",
      audio: data.audio || "",
      definitions: data.definitions || [],
      translation: data.translation || "",
      source: source || data.source || "manual",
      level: 0,
      nextReview: Date.now(),
      createdAt: Date.now(),
    };
    await addWord(entry);
    setWord("");
    setNote("");
    setManualDef("");
    setManualTrans("");
    setError("");
    setManual(false);
    onAdded(entry);
  }

  const handleAdd = async () => {
    const w = word.trim();
    if (!w) return;
    setLoading(true);
    setError("");
    try {
      const data = await lookupWord(w, langCode);
      await saveEntry(data);
    } catch (e) {
      setManual(true);
    } finally {
      setLoading(false);
    }
  };

  const handleManualSave = async () => {
    const w = word.trim();
    const def = manualDef.trim();
    const tr = manualTrans.trim();
    if (!w) return;
    if (!def && !tr) {
      setError("Please type a meaning, or a translation.");
      return;
    }
    setError("");
    await saveEntry(
      {
        phonetic: "",
        audio: "",
        definitions: def ? [{ partOfSpeech: "", definition: def, example: "", synonyms: [], source: "my note" }] : [],
        translation: tr,
      },
      "manual"
    );
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !loading && !manual) {
      e.preventDefault();
      handleAdd();
    }
  };

  return (
    <div className="add-word">
      <h2 className="section-title">✨ Add a word or phrase</h2>

      <div className="lang-select-wrap">
        <select
          className="lang-select"
          value={langCode}
          onChange={(e) => setLangCode(e.target.value)}
        >
          {LANGUAGES.map((l) => (
            <option key={l.code} value={l.code}>
              {l.flag} {l.name}
            </option>
          ))}
        </select>
      </div>

      <input
        className="word-input"
        type="text"
        placeholder="Word, slang, or phrase — e.g. “spill the tea”"
        value={word}
        onChange={(e) => { setWord(e.target.value); setError(""); setManual(false); }}
        onKeyDown={handleKeyDown}
        autoFocus
        disabled={loading}
      />

      <textarea
        className="note-input"
        placeholder="Optional note or context…"
        rows={2}
        value={note}
        onChange={(e) => setNote(e.target.value)}
      />

      {!manual ? (
        <button className="btn-add" onClick={handleAdd} disabled={loading || !word.trim()}>
          {loading ? "🔍 Looking up…" : "➕ Add"}
        </button>
      ) : (
        <div className="manual-box">
          <p className="manual-title">
            🤔 No automatic definition found for “{word.trim()}”.
            <br />
            Add your own meaning below.
          </p>
          <textarea
            className="note-input"
            placeholder="Meaning / definition…"
            rows={2}
            value={manualDef}
            onChange={(e) => setManualDef(e.target.value)}
            autoFocus
          />
          <input
            className="word-input"
            type="text"
            placeholder="Translation (optional) — e.g. “hello”"
            value={manualTrans}
            onChange={(e) => setManualTrans(e.target.value)}
          />
          <button className="btn-add" onClick={handleManualSave} disabled={!manualDef.trim() && !manualTrans.trim()}>
            💾 Save with my own meaning
          </button>
        </div>
      )}

      {error && <div className="error-msg">{error}</div>}

      <p className="hint">
        💡 English words &amp; phrases: DictionaryAPI → Wiktionary → Urban Dictionary.
        <br />
        Other languages: Wiktionary + MyMemory translation. If nothing matches, you can save your own meaning.
      </p>
    </div>
  );
}

AddWord.propTypes = {
  onAdded: PropTypes.func.isRequired,
};