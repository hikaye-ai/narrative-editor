import { openDB } from 'idb';

const DB_NAME = 'narrative-flow-history';
const STORE_NAME = 'changes';

export const historyDB = {
  async init() {
    const db = await openDB(DB_NAME, 1, {
      upgrade(db) {
        const store = db.createObjectStore(STORE_NAME, {
          keyPath: 'timestamp'
        });
        store.createIndex('sceneId', 'sceneId');
      }
    });
    return db;
  },

  async saveChanges(changes) {
    const db = await this.init();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    await Promise.all(changes.map(change => tx.store.put(change)));
    await tx.done;
  },

  async getChanges() {
    const db = await this.init();
    return db.getAll(STORE_NAME);
  },

  async clearChanges() {
    const db = await this.init();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    await tx.store.clear();
    await tx.done;
  }
}; 