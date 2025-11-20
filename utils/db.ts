
import { Message } from '../types';

const DB_NAME = 'OmniLearnDB';
const STORE_NAME = 'chats';
const DB_VERSION = 1;

/**
 * Opens the IndexedDB database.
 */
export const initDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
  });
};

/**
 * Saves the entire chat history to IndexedDB.
 * Using 'readwrite' transaction to overwrite the existing history key.
 */
export const saveHistory = async (messages: Message[]) => {
  try {
    const db = await initDB();
    return new Promise<void>((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      // We store the entire array under a single key 'history' for simplicity
      const request = store.put(messages, 'history');

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
    });
  } catch (error) {
    console.error('Failed to save history to IndexedDB', error);
  }
};

/**
 * Retrieves the chat history from IndexedDB.
 */
export const getHistory = async (): Promise<Message[]> => {
  try {
    const db = await initDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.get('history');

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result || []);
    });
  } catch (error) {
    console.error('Failed to load history from IndexedDB', error);
    return [];
  }
};
