const DB_NAME = 'narrativeFlowDB';
const STORE_NAME = 'narrativeHistory';
const DB_VERSION = 3;

let dbInstance = null;
let dbInitPromise = null;

const createObjectStore = (db) => {
  if (!db.objectStoreNames.contains(STORE_NAME)) {
    console.log('Creating object store:', STORE_NAME);
    db.createObjectStore(STORE_NAME, { keyPath: 'id' });
  }
};

const cleanDataForStorage = (data) => {
  // Deep clone while removing functions and circular references
  const seen = new WeakSet();
  const clean = (obj) => {
    if (typeof obj !== 'object' || obj === null) {
      return obj;
    }

    // Handle circular references
    if (seen.has(obj)) {
      return null;
    }
    seen.add(obj);

    if (Array.isArray(obj)) {
      return obj.map(item => clean(item));
    }

    const cleaned = {};
    for (const [key, value] of Object.entries(obj)) {
      // Skip functions
      if (typeof value === 'function') {
        continue;
      }
      cleaned[key] = clean(value);
    }
    return cleaned;
  };

  return clean(data);
};

export const initDB = async () => {
  if (dbInitPromise) {
    return dbInitPromise;
  }

  if (dbInstance) {
    return dbInstance;
  }

  dbInitPromise = new Promise((resolve, reject) => {
    try {
      console.log('Opening database...');
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => {
        console.error('Error opening database:', request.error);
        dbInitPromise = null;
        reject(request.error);
      };

      request.onblocked = () => {
        console.warn('Database blocked. Please close all other tabs with this site open.');
        dbInitPromise = null;
        reject(new Error('Database blocked'));
      };

      request.onupgradeneeded = (event) => {
        console.log(`Upgrading database from version ${event.oldVersion} to ${event.newVersion}`);
        const db = event.target.result;
        createObjectStore(db);
      };

      request.onsuccess = (event) => {
        dbInstance = event.target.result;
        console.log('Database opened successfully');
        
        // Verify store exists
        if (!dbInstance.objectStoreNames.contains(STORE_NAME)) {
          console.log('Store not found, closing and recreating database...');
          dbInstance.close();
          dbInstance = null;
          dbInitPromise = null;
          
          // Delete and recreate the database
          const deleteRequest = indexedDB.deleteDatabase(DB_NAME);
          deleteRequest.onsuccess = () => {
            console.log('Database deleted, recreating...');
            // Recursively try to init again
            resolve(initDB());
          };
          return;
        }
        
        dbInstance.onclose = () => {
          console.log('Database connection closed');
          dbInstance = null;
          dbInitPromise = null;
        };
        
        dbInstance.onversionchange = () => {
          console.log('Database version changed');
          dbInstance.close();
          dbInstance = null;
          dbInitPromise = null;
        };

        resolve(dbInstance);
      };
    } catch (error) {
      console.error('Error in initDB:', error);
      dbInitPromise = null;
      reject(error);
    }
  });

  try {
    const db = await dbInitPromise;
    dbInitPromise = null;
    return db;
  } catch (error) {
    dbInitPromise = null;
    throw error;
  }
};

export const saveToDB = async (data) => {
  try {
    console.log('Saving to database...');
    const db = await initDB();
    
    if (!db.objectStoreNames.contains(STORE_NAME)) {
      throw new Error('Store not found after initialization');
    }

    // Clean the data before storing
    const cleanedData = cleanDataForStorage(data);

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      
      transaction.oncomplete = () => {
        console.log('Save transaction completed successfully');
      };

      transaction.onerror = () => {
        console.error('Save transaction error:', transaction.error);
        reject(transaction.error);
      };

      const clearRequest = store.clear();
      
      clearRequest.onsuccess = () => {
        const addRequest = store.put({ id: 1, data: cleanedData });
        
        addRequest.onsuccess = () => {
          console.log('Data saved successfully');
          resolve(addRequest.result);
        };
        
        addRequest.onerror = () => {
          console.error('Error adding data:', addRequest.error);
          reject(addRequest.error);
        };
      };

      clearRequest.onerror = () => {
        console.error('Error clearing store:', clearRequest.error);
        reject(clearRequest.error);
      };
    });
  } catch (error) {
    console.error('Error in saveToDB:', error);
    throw error;
  }
};

export const loadFromDB = async () => {
  try {
    const db = await initDB();
    
    if (!db.objectStoreNames.contains(STORE_NAME)) {
      console.log('Store not found, returning null');
      return null;
    }

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.get(1);

      transaction.oncomplete = () => {
        console.log('Load transaction completed');
      };

      transaction.onerror = () => {
        console.error('Load transaction error:', transaction.error);
        reject(transaction.error);
      };

      request.onsuccess = () => {
        const result = request.result?.data || null;
        console.log('Data loaded:', result ? 'exists' : 'null');
        resolve(result);
      };
      
      request.onerror = () => {
        console.error('Error loading data:', request.error);
        reject(request.error);
      };
    });
  } catch (error) {
    console.error('Error in loadFromDB:', error);
    return null;
  }
};

export const deleteDatabase = async () => {
  if (dbInstance) {
    dbInstance.close();
    dbInstance = null;
  }
  dbInitPromise = null;

  return new Promise((resolve, reject) => {
    const request = indexedDB.deleteDatabase(DB_NAME);
    
    request.onerror = () => {
      console.error('Error deleting database:', request.error);
      reject(request.error);
    };
    
    request.onblocked = () => {
      console.error('Database deletion blocked');
      reject(new Error('Database deletion blocked'));
    };
    
    request.onsuccess = () => {
      console.log('Database deleted successfully');
      resolve();
    };
  });
};

export const closeDB = () => {
  if (dbInstance) {
    dbInstance.close();
    dbInstance = null;
  }
  dbInitPromise = null;
}; 