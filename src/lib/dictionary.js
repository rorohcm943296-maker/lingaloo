// Dictionary lookups — no API key required.
//
// ENGLISH: cascade across three sources so slang & informal phrases work:
//   1. DictionaryAPI  (rich: phonetic, audio, examples, synonyms)
//   2. English Wiktionary  (slang, informal phrases, multi-word expressions)
//   3. Urban Dictionary    (crowd-sourced slang, current usage)
//
// OTHER LANGUAGES: English Wiktionary (English meaning) + MyMemory translation.

const FREE_DICT_URL = (w) =>
  `https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(w)}`;

// English Wiktionary indexes foreign words AND English slang/phrases,
// always returning the meaning in English.
const EN_WIKTIONARY_URL = (w) =>
  `https://en.wiktionary.org/api/rest_v1/page/definition/${encodeURIComponent(w)}`;

const URBAN_DICT_URL = (w) =>
  `https://api.urbandictionary.com/v0/define?term=${encodeURIComponent(w)}`;

const MYMEMORY_URL = (lang, w) =>
  `https://api.mymemory.translated.net/get?q=${encodeURIComponent(w)}&langpair=${lang}|en`;

// Bundled Cantonese dictionary (CC-Canto) — offline, includes slang.
// Loaded lazily on first Cantonese lookup and cached in memory.
let cantoCache = null;
async function loadCantoDict() {
  if (cantoCache) return cantoCache;
  const res = await fetch("/cantonese.json");
  if (!res.ok) throw new Error("Cantonese data failed to load");
  cantoCache = await res.json();
  return cantoCache;
}

async function lookupCanto(word) {
  const data = await loadCantoDict();
  const entry = data[word];
  if (!entry) throw new Error("not in CC-Canto");
  return {
    phonetic: entry.j || "",
    audio: "",
    definitions: entry.d.map((d) => ({
      partOfSpeech: "",
      definition: d,
      example: "",
      synonyms: [],
      source: "CC-Canto",
    })),
  };
}

async function fetchJson(url, timeoutMs = 8000) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: ctrl.signal, headers: { Accept: "application/json" } });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(t);
  }
}

// Strip HTML tags + decode entities from Wiktionary definitions
function cleanHtml(s) {
  if (!s) return "";
  const txt = s
    .replace(/<[^>]*>/g, "") // remove tags
    .replace(/\s+/g, " ") // collapse whitespace
    .replace(/\s+([,.!?;:])/g, "$1") // fix space before punctuation
    .trim();
  const el = document.createElement("textarea");
  el.innerHTML = txt;
  return el.value;
}

function dedupe(defs) {
  const seen = new Set();
  return defs.filter((d) => {
    const k = `${d.partOfSpeech}|${d.definition}`.toLowerCase();
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

async function lookupDictAPI(word) {
  const data = await fetchJson(FREE_DICT_URL(word));
  const entry = Array.isArray(data) ? data[0] : data;
  const phonetic =
    entry.phonetics?.find((p) => p.text)?.text || entry.phonetic || "";
  const audio = entry.phonetics?.find((p) => p.audio)?.audio || "";
  const definitions = [];
  for (const m of entry.meanings || []) {
    for (const d of m.definitions || []) {
      definitions.push({
        partOfSpeech: m.partOfSpeech || "",
        definition: d.definition || "",
        example: d.example || "",
        synonyms: (d.synonyms || []).slice(0, 6),
        source: "DictionaryAPI",
      });
    }
  }
  if (!definitions.length) throw new Error("no definition found");
  return { phonetic, audio, definitions };
}

async function lookupWiktionary(word, englishOnly = false) {
  const data = await fetchJson(EN_WIKTIONARY_URL(word));
  const definitions = [];

  // englishOnly=true → only the "en" (English) section: English-language
  // explanations of the foreign word. Native-language sections (e.g. a German
  // definition of a German word) are useless to a learner and are excluded.
  const sections = englishOnly
    ? [["en", data?.en]]
    : Object.entries(data || {});

  for (const [langCode, senses] of sections) {
    if (!senses) continue;
    for (const sense of senses) {
      const pos = sense.partOfSpeech || "";
      for (const d of sense.definitions || []) {
        const def = cleanHtml(d.definition);
        if (def) {
          definitions.push({
            partOfSpeech: pos,
            definition: def,
            example: "",
            synonyms: [],
            source: "Wiktionary",
          });
        }
      }
    }
  }

  if (!definitions.length) throw new Error("no English definition found");
  return { phonetic: "", audio: "", definitions };
}

async function lookupUrbanDictionary(word) {
  const data = await fetchJson(URBAN_DICT_URL(word));
  const list = (data.list || []).sort((a, b) => (b.thumbs_up || 0) - (a.thumbs_up || 0));
  const definitions = list.slice(0, 4).map((x) => ({
    partOfSpeech: "",
    definition: x.definition.replace(/\s+/g, " ").trim(),
    example: x.example?.replace(/\s+/g, " ").trim() || "",
    synonyms: [],
    source: "Urban Dictionary",
  }));
  if (!definitions.length) throw new Error("no definition found");
  return { phonetic: "", audio: "", definitions };
}

async function lookupEnglish(word) {
  const [dict, wik, urban] = await Promise.allSettled([
    lookupDictAPI(word),
    lookupWiktionary(word),
    lookupUrbanDictionary(word),
  ]);

  let phonetic = "";
  let audio = "";
  const definitions = [];
  let primary = "";

  if (dict.status === "fulfilled") {
    phonetic = dict.value.phonetic;
    audio = dict.value.audio;
    definitions.push(...dict.value.definitions);
    primary = "DictionaryAPI";
  }
  if (wik.status === "fulfilled") {
    definitions.push(...wik.value.definitions);
    if (!primary) primary = "Wiktionary";
  }
  if (urban.status === "fulfilled") {
    definitions.push(...urban.value.definitions);
    if (!primary) primary = "Urban Dictionary";
  }

  const unique = dedupe(definitions);
  if (!unique.length) throw new Error("could not find a definition — try adding it manually");

  return { phonetic, audio, definitions: unique, translation: "", source: primary };
}

async function lookupTranslation(lang, word) {
  try {
    const data = await fetchJson(MYMEMORY_URL(lang, word));
    if (data.responseStatus === 200 && data.responseData?.translatedText) {
      return data.responseData.translatedText;
    }
  } catch {
    /* ignore */
  }
  return "";
}

export async function lookupWord(word, langCode) {
  const clean = word.trim();
  if (!clean) throw new Error("empty word");

  if (langCode === "en") {
    // English dictionaries are case-sensitive — lowercase before lookup so
    // "Depraved" / "Spilled the tea" resolve correctly.
    const r = await lookupEnglish(clean.toLowerCase());
    return { word: clean, ...r };
  }

  // Cantonese: bundled CC-Canto dictionary first (offline, has slang),
  // then fall back to the general pipeline if the word isn't in it.
  if (langCode === "yue") {
    const canto = await lookupCanto(clean).catch(() => null);
    if (canto) {
      const tr = await lookupTranslation("yue", clean);
      return {
        word: clean,
        phonetic: canto.phonetic,
        audio: "",
        definitions: canto.definitions,
        translation: tr,
        source: tr ? "CC-Canto + MyMemory" : "CC-Canto",
      };
    }
  }

  // Non-English: English Wiktionary + MyMemory translation + Urban Dictionary
  // (Urban Dictionary catches slang that has entered English usage — e.g. some
  // Cantonese/Korean slang appears there even though the word is foreign).
  const [wik, tr, urban] = await Promise.allSettled([
    lookupWiktionary(clean, true),
    lookupTranslation(langCode, clean),
    lookupUrbanDictionary(clean),
  ]);

  let result = {
    phonetic: "",
    audio: "",
    definitions: [],
    translation: tr.status === "fulfilled" ? tr.value : "",
    source: "",
  };

  const sources = [];
  if (wik.status === "fulfilled") {
    result.definitions.push(...wik.value.definitions);
    sources.push("Wiktionary");
  }
  if (urban.status === "fulfilled") {
    result.definitions.push(...urban.value.definitions);
    sources.push("Urban Dictionary");
  }
  if (result.translation) sources.push("MyMemory");

  if (result.definitions.length) {
    result.definitions = dedupe(result.definitions);
    result.source = sources.join(" + ");
  } else if (result.translation) {
    result.source = "MyMemory";
  } else {
    throw new Error("could not find a definition — try adding it manually");
  }

  return { word: clean, ...result };
}
