/* אחסון מקומי במכשיר (IndexedDB). משותף לדף ול-Service Worker.
   inbox – הקלטות שהתקבלו וממתינות לסיכום (כולל הקובץ עצמו)
   calls – סיכומים ותמלולים שמורים (בלי הקובץ)
   kv    – הגדרות */
'use strict';

const CS_DB_NAME = 'call-summary';
const CS_DB_VERSION = 1;

function csOpen() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(CS_DB_NAME, CS_DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains('inbox')) db.createObjectStore('inbox', { keyPath: 'id' });
      if (!db.objectStoreNames.contains('calls')) db.createObjectStore('calls', { keyPath: 'id' });
      if (!db.objectStoreNames.contains('kv')) db.createObjectStore('kv');
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function csRequest(store, mode, make) {
  return csOpen().then(
    (db) =>
      new Promise((resolve, reject) => {
        const tx = db.transaction(store, mode);
        const req = make(tx.objectStore(store));
        let value;
        req.onsuccess = () => {
          value = req.result;
        };
        tx.oncomplete = () => {
          db.close();
          resolve(value);
        };
        tx.onerror = tx.onabort = () => {
          db.close();
          reject(tx.error || req.error);
        };
      })
  );
}

const csStore = {
  get: (store, key) => csRequest(store, 'readonly', (s) => s.get(key)),
  all: (store) => csRequest(store, 'readonly', (s) => s.getAll()),
  put: (store, value, key) => csRequest(store, 'readwrite', (s) => (key === undefined ? s.put(value) : s.put(value, key))),
  del: (store, key) => csRequest(store, 'readwrite', (s) => s.delete(key)),
  clear: (store) => csRequest(store, 'readwrite', (s) => s.clear()),
};

function csNewId(prefix) {
  return prefix + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}
