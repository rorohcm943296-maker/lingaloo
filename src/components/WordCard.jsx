import { languageFlag, languageName } from "../lib/languages";
import { canSpeak, speak } from "../lib/speech";
import PropTypes from "prop-types";

export default function WordCard({ word, onClose }) {
  if (!word) return null;

  const defs = word.definitions || [];

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose}>✕</button>

        <h2 className="modal-word">
          {languageFlag(word.language)} {word.word}
        </h2>

        <p className="modal-lang">{languageName(word.language)}</p>

        {word.phonetic && <div className="modal-phonetic">/{word.phonetic}/</div>}

        {word.translation && (
          <div className="modal-translation">→ {word.translation}</div>
        )}

        {canSpeak() && (
          <button className="btn-listen" onClick={() => speak(word.word, word.language)}>
            🔊 Listen
          </button>
        )}

        <div className="modal-defs">
          {defs.map((d, i) => (
            <div key={i} className="modal-def-row">
              {d.partOfSpeech && <span className="modal-pos">{d.partOfSpeech}</span>}
              {d.source && d.source !== "DictionaryAPI" && (
                <span className="def-source">{d.source}</span>
              )}
              <span className="modal-def-text">{d.definition}</span>
              {d.example && <div className="modal-ex">“{d.example}”</div>}
              {d.synonyms?.length > 0 && (
                <div className="modal-syn">
                  Synonyms: {d.synonyms.join(", ")}
                </div>
              )}
            </div>
          ))}
        </div>

        {word.note && <div className="modal-note">📝 {word.note}</div>}

        <small className="modal-source">
          Source: {word.source} · Level: {"●".repeat(word.level + 1)}
        </small>
      </div>
    </div>
  );
}

WordCard.propTypes = {
  word: PropTypes.object,
  onClose: PropTypes.func.isRequired,
};