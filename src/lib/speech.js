// Browser-native text-to-speech for pronunciation — no network, no CORS, no API key.
// Uses the Web Speech API built into every modern browser.

const SPEECH_LANG = {
  en: "en-US", es: "es-ES", fr: "fr-FR", de: "de-DE", it: "it-IT",
  pt: "pt-PT", ru: "ru-RU", ja: "ja-JP", zh: "zh-CN", yue: "zh-HK", ko: "ko-KR",
  ar: "ar-SA", nl: "nl-NL", pl: "pl-PL", tr: "tr-TR", hi: "hi-IN",
  vi: "vi-VN", el: "el-GR", sv: "sv-SE", no: "nb-NO", da: "da-DK",
  fi: "fi-FI", cs: "cs-CZ", ro: "ro-RO", he: "he-IL", th: "th-TH", id: "id-ID",
};

export function canSpeak() {
  return typeof window !== "undefined" && "speechSynthesis" in window;
}

export function speak(word, langCode) {
  if (!canSpeak()) return false;
  try {
    const u = new SpeechSynthesisUtterance(word);
    u.lang = SPEECH_LANG[langCode] || langCode;
    u.rate = 0.85; // slightly slower for learners
    speechSynthesis.cancel();
    speechSynthesis.speak(u);
    return true;
  } catch {
    return false;
  }
}
