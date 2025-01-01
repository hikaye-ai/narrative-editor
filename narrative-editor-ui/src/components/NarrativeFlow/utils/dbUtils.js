const DB_NAME = 'narrativeFlowDB';
const DB_VERSION = 1;
const STORE_NAME = 'flowState';

// Initialize the database
export const initDB = () => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);

    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };
  });
};

// Save state to IndexedDB
export const saveState = async (state) => {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    
    const request = store.put({
      id: 'currentState',
      data: state,
      timestamp: Date.now()
    });

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
};

// Load state from IndexedDB
export const loadState = async () => {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.get('currentState');

    request.onsuccess = () => resolve(request.result?.data || null);
    request.onerror = () => reject(request.error);
  });
}; 