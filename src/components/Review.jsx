import { useState, useEffect } from "react";
import { getDueWords, updateWord } from "../lib/db";
import { languageFlag } from "../lib/languages";
import { canSpeak, speak } from "../lib/speech";
import PropTypes from "prop-types";

export default function Review() {
  const [cards, setCards] = useState([]);
  const [index, setIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadCards();
  }, []);

  async function loadCards() {
    setLoading(true);
    const due = await getDueWords(Date.now());
    setCards(due);
    setIndex(0);
    setRevealed(false);
    setLoading(false);
  }

  function rate(levelDelta) {
    if (!cards[index]) return;
    const card = cards[index];
    const newLevel = Math.max(0, Math.min(5, card.level + levelDelta));
    const mins = [1, 10, 60, 480, 1440, 10080]; // 1,10,60,480,1440,10080 min
    const next = Date.now() + mins[newLevel] * 60 * 1000;

    updateWord({ ...card, level: newLevel, nextReview: next });

    setRevealed(false);
    const nextIdx = index + 1;
    if (nextIdx >= cards.length) {
      loadCards();
    } else {
      setIndex(nextIdx);
    }
  }

  if (loading) return <div className="review"><p>Loading…</p></div>;

  if (!cards.length) {
    return (
      <div className="review">
        <h2 className="section-title">🔄 Review</h2>
        <div className="empty-state">
          <p>🎉 Nothing to review right now!</p>
          <button className="btn-add" onClick={loadCards}>Check again</button>
        </div>
      </div>
    );
  }

  const card = cards[index];

  return (
    <div className="review">
      <h2 className="section-title">
        🔄 Review ({index + 1} / {cards.length})
      </h2>

      <div
        className={`flashcard ${revealed ? "revealed" : ""}`}
        onClick={() => setRevealed(true)}
      >
        <div className="flashcard-front">
          <span className="fc-lang">{languageFlag(card.language)}</span>
          <span className="fc-word">{card.word}</span>
          {!revealed && <p className="fc-tap">Tap to reveal</p>}
        </div>

        {revealed && (
          <div className="flashcard-back">
            {card.phonetic && <div className="fc-phonetic">/{card.phonetic}/</div>}

            {card.translation && (
              <div className="fc-translation">{card.translation}</div>
            )}

            {card.definitions?.slice(0, 3).map((d, i) => (
              <div key={i} className="fc-def">
                <span className="fc-pos">{d.partOfSpeech}</span>
                {d.source && d.source !== "DictionaryAPI" && (
                  <span className="def-source">{d.source}</span>
                )}
                <span>{d.definition}</span>
                {d.example && <div className="fc-ex">“{d.example}”</div>}
              </div>
            ))}

            {card.note && <div className="fc-note">📝 {card.note}</div>}

            {canSpeak() && (
              <button
                className="btn-listen"
                onClick={(e) => { e.stopPropagation(); speak(card.word, card.language); }}
              >
                🔊 Listen
              </button>
            )}
          </div>
        )}
      </div>

      {revealed && (
        <div className="rating-btns">
          <button className="rate-again" onClick={() => rate(-2)}>
            😣 Again
          </button>
          <button className="rate-hard" onClick={() => rate(-1)}>
            🤔 Hard
          </button>
          <button className="rate-good" onClick={() => rate(1)}>
            👍 Good
          </button>
          <button className="rate-easy" onClick={() => rate(2)}>
            🚀 Easy
          </button>
        </div>
      )}
    </div>
  );
}

Review.propTypes = {};