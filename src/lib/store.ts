import { load, type Store } from "@tauri-apps/plugin-store";

const STORE_FILE = "pr-pilot.json";

let storePromise: Promise<Store> | null = null;

/**
 * Lazily loads and caches the singleton Tauri store instance backed by
 * {@link STORE_FILE}.
 */
function getStore() {
  if (!storePromise) {
    storePromise = load(STORE_FILE, { autoSave: false, defaults: {} });
  }
  return storePromise;
}

/**
 * Reads a value from the persistent store.
 */
export async function getStoreValue<T>(key: string) {
  const store = await getStore();
  return store.get<T>(key);
}

/**
 * Writes a value to the persistent store and saves it to disk immediately.
 */
export async function setStoreValue<T>(key: string, value: T) {
  const store = await getStore();
  await store.set(key, value);
  await store.save();
}
