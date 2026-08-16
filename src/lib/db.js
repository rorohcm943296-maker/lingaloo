import { openDB } from "idb";

const DB_NAME = "vocab-vault";
const DB_VERSION = 1;

let dbPromise = null;

function getDB() {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        const store = db.createObjectStore("words", { keyPath: "id" });
        store.createIndex("language", "language");
        store.createIndex("createdAt", "createdAt");
        store.createIndex("nextReview", "nextReview");
      },
    });
  }
  return dbPromise;
}

export function makeId() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export async function addWord(word) {
  const db = await getDB();
  await db.put("words", word);
  return word;
}

export async function getAllWords() {
  const db = await getDB();
  const all = await db.getAll("words");
  return all.sort((a, b) => b.createdAt - a.createdAt);
}

export async function getWord(id) {
  const db = await getDB();
  return db.get("words", id);
}

export async function updateWord(word) {
  const db = await getDB();
  await db.put("words", word);
  return word;
}

export async function deleteWord(id) {
  const db = await getDB();
  await db.delete("words", id);
}

export async function clearAll() {
  const db = await getDB();
  await db.clear("words");
}

export async function getDueWords(now) {
  const db = await getDB();
  const all = await db.getAll("words");
  return all
    .filter((w) => !w.nextReview || w.nextReview <= now)
    .sort((a, b) => (a.nextReview || 0) - (b.nextReview || 0));
}
