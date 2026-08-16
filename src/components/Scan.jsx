import { useState, useRef } from "react";
import { OCR_LANGUAGES, recognizeImage } from "../lib/ocr";
import { lookupWord } from "../lib/dictionary";
import { addWord, makeId } from "../lib/db";
import PropTypes from "prop-types";

export default function Scan({ onAdded }) {
  const [ocrLang, setOcrLang] = useState(OCR_LANGUAGES[0]); // default Japanese
  const [image, setImage] = useState(null);
  const [imagePreview, setImagePreview] = useState("");
  const [ocrText, setOcrText] = useState("");
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState("");
  const [error, setError] = useState("");
  const [lookupText, setLookupText] = useState("");
  const [lookupLoading, setLookupLoading] = useState(false);
  const [lookupError, setLookupError] = useState("");
  const [screenMode, setScreenMode] = useState(false);

  // Crop rectangle in rendered preview pixels
  const [crop, setCrop] = useState(null);
  const [dragging, setDragging] = useState(false);
  const dragStart = useRef(null);
  const imgRef = useRef(null);
  const [imgDims, setImgDims] = useState(null); // { w, h } natural size

  const handlePhoto = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImage(file);
    setImagePreview(URL.createObjectURL(file));
    setOcrText("");
    setError("");
    setLookupText("");
    setLookupError("");
    setCrop(null);
    setImgDims(null);
  };

  // ---- Crop drag handlers ----
  const posFromEvent = (e) => {
    const rect = imgRef.current?.getBoundingClientRect();
    if (!rect) return { x: 0, y: 0 };
    return { x: Math.max(0, e.clientX - rect.left), y: Math.max(0, e.clientY - rect.top) };
  };

  const onPointerDown = (e) => {
    const pos = posFromEvent(e);
    dragStart.current = pos;
    setCrop({ x: pos.x, y: pos.y, w: 0, h: 0 });
    setDragging(true);
    try { imgRef.current?.setPointerCapture?.(e.pointerId); } catch (_) {}
  };

  const onPointerMove = (e) => {
    if (!dragging || !dragStart.current) return;
    const pos = posFromEvent(e);
    const x = Math.min(dragStart.current.x, pos.x);
    const y = Math.min(dragStart.current.y, pos.y);
    const w = Math.abs(pos.x - dragStart.current.x);
    const h = Math.abs(pos.y - dragStart.current.y);
    setCrop({ x, y, w, h });
  };

  const onPointerUp = () => {
    setDragging(false);
    dragStart.current = null;
  };

  const handleExtract = async () => {
    if (!image) return;
    setLoading(true);
    setError("");
    setProgress("Starting engine…");

    // Map crop from rendered preview px → natural image px
    let cropNatural = null;
    if (crop && crop.w > 10 && crop.h > 10 && imgRef.current) {
      const nw = imgRef.current.naturalWidth;
      const nh = imgRef.current.naturalHeight;
      const rect = imgRef.current.getBoundingClientRect();
      if (nw && nh && rect.width && rect.height) {
        const sx = nw / rect.width;
        const sy = nh / rect.height;
        cropNatural = {
          x: crop.x * sx,
          y: crop.y * sy,
          w: crop.w * sx,
          h: crop.h * sy,
        };
      }
    }

    try {
      const { text } = await recognizeImage(image, ocrLang.tess, (p, status) => {
        setProgress(`${status} ${Math.round(p * 100)}%`);
      }, { screen: screenMode, crop: cropNatural });
      setOcrText(text);
      setLookupText(text);
      if (!text) setError("No text found — make sure the image is clear and well-lit.");
    } catch (e) {
      setError(e.message || "OCR failed. Try better lighting or a closer shot.");
    } finally {
      setLoading(false);
      setProgress("");
    }
  };

  const handleLookup = async () => {
    const txt = lookupText.trim();
    if (!txt) return;
    setLookupLoading(true);
    setLookupError("");
    try {
      const data = await lookupWord(txt, ocrLang.app);
      const entry = {
        id: makeId(),
        word: txt,
        language: ocrLang.app,
        note: "📸 scanned via camera",
        phonetic: data.phonetic || "",
        audio: data.audio || "",
        definitions: data.definitions || [],
        translation: data.translation || "",
        source: data.source || "OCR",
        level: 0,
        nextReview: Date.now(),
        createdAt: Date.now(),
      };
      await addWord(entry);
      setLookupText("");
      onAdded?.(entry);
    } catch (e) {
      setLookupError(e.message || "Lookup failed. Try editing the text.");
    } finally {
      setLookupLoading(false);
    }
  };

  return (
    <div className="scan">
      <h2 className="section-title">📸 Scan & learn</h2>

      {/* OCR language picker */}
      <div className="lang-picker">
        {OCR_LANGUAGES.slice(0, 8).map((l) => (
          <button
            key={l.tess}
            className={`lang-chip ${l.tess === ocrLang.tess ? "active" : ""}`}
            onClick={() => setOcrLang(l)}
          >
            {l.flag} {l.name}
          </button>
        ))}
      </div>

      {/* Screen mode toggle */}
      <div className="screen-toggle">
        <label className="toggle-row">
          <span>📺 Scanning a screen (phone/computer)</span>
          <button
            type="button"
            className={`toggle ${screenMode ? "on" : ""}`}
            onClick={() => setScreenMode(!screenMode)}
          >
            <span className="toggle-knob" />
          </button>
        </label>
        <p className="toggle-hint">
          {screenMode
            ? "Screen mode ON — removes moiré/refresh-line noise."
            : "Screen mode OFF — best for printed paper."}
        </p>
      </div>

      {/* Camera / Gallery buttons */}
      <div className="scan-buttons">
        <label className="btn-scan">
          📷 Take a photo
          <input
            type="file"
            accept="image/*"
            capture="environment"
            onChange={handlePhoto}
            hidden
          />
        </label>
        <label className="btn-scan">
          🖼️ From gallery
          <input
            type="file"
            accept="image/*"
            onChange={handlePhoto}
            hidden
          />
        </label>
      </div>

      {/* Image preview with crop selection */}
      {imagePreview && (
        <div className="scan-preview">
          <div className="crop-wrap">
            <img
              ref={imgRef}
              src={imagePreview}
              alt="preview"
              draggable={false}
              onLoad={() => {
                if (imgRef.current) {
                  setImgDims({ w: imgRef.current.naturalWidth, h: imgRef.current.naturalHeight });
                }
              }}
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              onPointerCancel={onPointerUp}
            />
            {crop && crop.w > 0 && crop.h > 0 && (
              <div
                className="crop-box"
                style={{
                  left: crop.x,
                  top: crop.y,
                  width: crop.w,
                  height: crop.h,
                }}
              />
            )}
          </div>
          <div className="crop-hint">
            <span>
              {crop && crop.w > 10
                ? "✅ Crop active — only the boxed area will be read."
                : "✋ Drag a box around the text you want → smaller = more accurate."}
              {imgDims && `  📷 ${imgDims.w}×${imgDims.h}px`}
            </span>
            {crop && crop.w > 0 && (
              <button className="crop-reset" onClick={() => setCrop(null)}>↺ Reset</button>
            )}
          </div>
          {/* Extract button INSIDE the preview area — always visible */}
          <button
            className="btn-add scan-extract"
            onClick={handleExtract}
            disabled={loading}
          >
            {loading ? (progress || "🔍 Reading text…") : "🔍 Extract text"}
          </button>
        </div>
      )}

      {error && <div className="error-msg">{error}</div>}

      {/* Extracted text + lookup */}
      {ocrText && (
        <div className="ocr-result">
          <p className="ocr-label">Recognized text — edit then tap a word below to look up:</p>
          <textarea
            className="ocr-textarea"
            value={ocrText}
            onChange={(e) => setOcrText(e.target.value)}
            rows={Math.min(6, Math.max(2, ocrText.split("\n").length))}
          />

          <div className="ocr-chips">
            {ocrText
              .split(/\s+/)
              .filter((w) => w.length)
              .slice(0, 30)
              .map((w, i) => (
                <button
                  key={i}
                  className={`ocr-chip ${w === lookupText ? "active" : ""}`}
                  onClick={() => { setLookupText(w); setLookupError(""); }}
                >
                  {w}
                </button>
              ))}
          </div>

          <div className="ocr-lookup">
            <input
              className="word-input"
              type="text"
              placeholder="Selected word / phrase…"
              value={lookupText}
              onChange={(e) => { setLookupText(e.target.value); setLookupError(""); }}
              onKeyDown={(e) => { if (e.key === "Enter") handleLookup(); }}
            />
            <button className="btn-add" onClick={handleLookup} disabled={lookupLoading || !lookupText.trim()}>
              {lookupLoading ? "🔍 Looking up…" : `💾 Look up & save as ${ocrLang.flag} word`}
            </button>
            {lookupError && <div className="error-msg">{lookupError}</div>}
          </div>
        </div>
      )}

      <p className="hint">
        💡 <strong>For best accuracy:</strong> bright, even light + phone flat &amp; parallel to the page.<br />
        Expect ~80–90% accuracy on real photos — <strong>edit the recognized text</strong> to fix any wrong characters before saving.<br />
        The smaller your crop box, the better the read.
      </p>
    </div>
  );
}

Scan.propTypes = {
  onAdded: PropTypes.func,
};