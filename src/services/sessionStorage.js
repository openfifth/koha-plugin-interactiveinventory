const SESSION_KEY = 'koha_inventory_session';
const ITEMS_KEY = 'koha_inventory_items';
const SESSION_EXPIRY_KEY = 'koha_inventory_expiry';
const MISSING_ITEMS_KEY = 'koha_inventory_marked_missing';
const SESSION_DURATION = 24 * 60 * 60 * 1000; // 24 hours in milliseconds
const DB_NAME = 'koha_inventory_db';
const DB_VERSION = 1;
const STORE_NAME = 'inventory_data';
const CHUNK_SIZE = 1000; // Number of items per chunk

// Helper function to open a connection to IndexedDB
const openDB = () => {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onerror = (event) => {
            console.error('IndexedDB error:', event.target.error);
            reject(event.target.error);
        };

        request.onupgradeneeded = (event) => {
            const db = event.target.result;
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                db.createObjectStore(STORE_NAME, { keyPath: 'key' });
            }
        };

        request.onsuccess = (event) => {
            resolve(event.target.result);
        };
    });
};

// Helper function to split arrays into chunks
const chunkArray = (array, chunkSize) => {
    const chunks = [];
    for (let i = 0; i < array.length; i += chunkSize) {
        chunks.push(array.slice(i, i + chunkSize));
    }
    return chunks;
};

// Helper function to store data in IndexedDB
const storeData = async (key, data) => {
    try {
        const db = await openDB();

        // If data is a large array, split it into chunks
        if (Array.isArray(data) && data.length > CHUNK_SIZE) {
            console.log(`Chunking large array of ${data.length} items for key ${key}`);

            // Clear any existing chunks for this key
            await clearChunks(db, key);

            // Split the array into chunks
            const chunks = chunkArray(data, CHUNK_SIZE);

            // Store chunk metadata
            await storeInDB(db, `${key}_meta`, {
                totalChunks: chunks.length,
                totalItems: data.length,
                timestamp: Date.now()
            });

            // Store each chunk
            const promises = chunks.map((chunk, index) =>
                storeInDB(db, `${key}_chunk_${index}`, chunk)
            );

            await Promise.all(promises);
            console.log(`Successfully stored ${chunks.length} chunks for ${key}`);

            return true;
        } else {
            // For smaller data or non-array data, store directly
            return await storeInDB(db, key, data);
        }
    } catch (error) {
        console.error(`Failed to store data for key ${key}:`, error);
        // Fallback to localStorage for small data or non-critical data
        try {
            localStorage.setItem(key, JSON.stringify(data));
        } catch (e) {
            console.error(`Fallback to localStorage failed for key ${key}:`, e);
        }
    }
};

// Helper function to clear all chunks for a key
const clearChunks = async (db, key) => {
    try {
        const transaction = db.transaction([STORE_NAME], 'readwrite');
        const store = transaction.objectStore(STORE_NAME);

        // Get all keys in the store
        const allKeys = await new Promise((resolve, reject) => {
            const request = store.getAllKeys();
            request.onsuccess = () => resolve(request.result);
            request.onerror = (e) => reject(e.target.error);
        });

        // Filter keys that match the pattern for chunks of this key
        const chunkPrefix = `${key}_chunk_`;
        const relatedKeys = allKeys.filter(k =>
            k === `${key}_meta` ||
            (typeof k === 'string' && k.startsWith(chunkPrefix))
        );

        // Delete all related keys
        const promises = relatedKeys.map(k =>
            new Promise((resolve, reject) => {
                const request = store.delete(k);
                request.onsuccess = resolve;
                request.onerror = (e) => reject(e.target.error);
            })
        );

        await Promise.all(promises);
        return true;
    } catch (error) {
        console.error(`Error clearing chunks for key ${key}:`, error);
        return false;
    }
};

// Helper function for actual database storage operation
const storeInDB = (db, key, value) => {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([STORE_NAME], 'readwrite');
        const store = transaction.objectStore(STORE_NAME);

        const request = store.put({ key, value });

        request.onerror = (event) => {
            console.error(`Error storing data for key ${key}:`, event.target.error);
            reject(event.target.error);
        };

        request.onsuccess = (event) => {
            resolve(event.target.result);
        };

        transaction.oncomplete = () => {
            db.close();
        };
    });
};

// Helper function to retrieve data from IndexedDB
const getData = async (key) => {
    try {
        const db = await openDB();

        // Check if this is chunked data by looking for metadata
        const metadata = await getFromDB(db, `${key}_meta`);

        if (metadata) {
            // This is chunked data, reassemble it
            console.log(`Retrieving chunked data for ${key} (${metadata.totalChunks} chunks, ${metadata.totalItems} items)`);

            // Retrieve all chunks
            const chunks = [];
            for (let i = 0; i < metadata.totalChunks; i++) {
                const chunk = await getFromDB(db, `${key}_chunk_${i}`);
                if (chunk) {
                    chunks.push(chunk);
                } else {
                    console.error(`Missing chunk ${i} for key ${key}`);
                }
            }

            // Combine all chunks into one array
            const combinedData = chunks.flat();
            console.log(`Successfully retrieved ${combinedData.length} items for ${key}`);

            return combinedData;
        } else {
            // Regular non-chunked data
            return await getFromDB(db, key);
        }
    } catch (error) {
        console.error(`Failed to retrieve data for key ${key}:`, error);
        // Fallback to localStorage
        try {
            const data = localStorage.getItem(key);
            return data ? JSON.parse(data) : null;
        } catch (e) {
            console.error(`Fallback to localStorage failed for key ${key}:`, e);
            return null;
        }
    }
};

// Helper function for actual database retrieval operation
const getFromDB = (db, key) => {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([STORE_NAME], 'readonly');
        const store = transaction.objectStore(STORE_NAME);

        const request = store.get(key);

        request.onerror = (event) => {
            console.error(`Error retrieving data for key ${key}:`, event.target.error);
            reject(event.target.error);
        };

        request.onsuccess = (event) => {
            resolve(event.target.result ? event.target.result.value : null);
        };

        transaction.oncomplete = () => {
            db.close();
        };
    });
};

// Helper function to remove data from IndexedDB
const removeData = async (key) => {
    try {
        const db = await openDB();

        // Check if this might be chunked data
        const metadata = await getFromDB(db, `${key}_meta`);

        if (metadata) {
            // This is chunked data, clear all chunks
            await clearChunks(db, key);
            console.log(`Removed chunked data for ${key}`);
        } else {
            // Regular data, just delete the key
            await new Promise((resolve, reject) => {
                const transaction = db.transaction([STORE_NAME], 'readwrite');
                const store = transaction.objectStore(STORE_NAME);

                const request = store.delete(key);

                request.onerror = (event) => {
                    console.error(`Error removing data for key ${key}:`, event.target.error);
                    reject(event.target.error);
                };

                request.onsuccess = (event) => {
                    resolve();
                };

                transaction.oncomplete = () => {
                    db.close();
                };
            });
        }
    } catch (error) {
        console.error(`Failed to remove data for key ${key}:`, error);
        // Fallback to localStorage
        try {
            localStorage.removeItem(key);
        } catch (e) {
            console.error(`Fallback to localStorage failed for key ${key}:`, e);
        }
    }
};

const saveSession = async (sessionData) => {
    try {
        // Save core session data (without large collections) to localStorage for quick access
        const coreSessionData = { ...sessionData };

        // Extract large datasets to store separately
        const locationData = coreSessionData.response_data?.location_data;
        const rightPlaceList = coreSessionData.response_data?.right_place_list;

        // Remove large datasets from core session data
        if (coreSessionData.response_data) {
            coreSessionData.response_data.location_data = [];
            coreSessionData.response_data.right_place_list = [];
        }

        // Store core session data in localStorage
        localStorage.setItem(SESSION_KEY, JSON.stringify(coreSessionData));
        localStorage.setItem(SESSION_EXPIRY_KEY, Date.now() + SESSION_DURATION);

        // Store large datasets in IndexedDB
        if (locationData && locationData.length > 0) {
            await storeData('location_data', locationData);
        }

        if (rightPlaceList && rightPlaceList.length > 0) {
            await storeData('right_place_list', rightPlaceList);
        }
    } catch (error) {
        console.error('Error saving session:', error);
        throw error;
    }
};

const getSession = async () => {
    try {
        const expiryTime = parseInt(localStorage.getItem(SESSION_EXPIRY_KEY));
        if (!expiryTime || Date.now() > expiryTime) {
            await clearSession();
            return null;
        }

        const sessionDataStr = localStorage.getItem(SESSION_KEY);
        if (!sessionDataStr) return null;

        const sessionData = JSON.parse(sessionDataStr);

        // Retrieve large datasets from IndexedDB if needed
        if (sessionData.response_data) {
            // Retrieve location_data
            const locationData = await getData('location_data');
            if (locationData) {
                sessionData.response_data.location_data = locationData;
            }

            // Retrieve right_place_list
            const rightPlaceList = await getData('right_place_list');
            if (rightPlaceList) {
                sessionData.response_data.right_place_list = rightPlaceList;
            }
        }

        return sessionData;
    } catch (error) {
        console.error('Error retrieving session:', error);
        return null;
    }
};

const saveItems = async (items) => {
    try {
        await storeData(ITEMS_KEY, items);
    } catch (error) {
        console.error('Error saving items:', error);
        throw error;
    }
};

const getItems = async () => {
    try {
        const expiryTime = parseInt(localStorage.getItem(SESSION_EXPIRY_KEY));
        if (!expiryTime || Date.now() > expiryTime) {
            await clearSession();
            return null;
        }

        return await getData(ITEMS_KEY);
    } catch (error) {
        console.error('Error retrieving items:', error);
        return null;
    }
};

const saveMarkedMissingItems = async (barcodes) => {
    if (!Array.isArray(barcodes)) {
        console.error('Invalid barcodes array provided to saveMarkedMissingItems');
        return;
    }

    try {
        await storeData(MISSING_ITEMS_KEY, barcodes);
    } catch (error) {
        console.error('Error saving marked missing items:', error);
        throw error;
    }
};

const getMarkedMissingItems = async () => {
    try {
        const markedMissing = await getData(MISSING_ITEMS_KEY);
        return markedMissing || [];
    } catch (error) {
        console.error('Error retrieving marked missing items:', error);
        return [];
    }
};

const clearSession = async () => {
    try {
        // Remove data from localStorage
        localStorage.removeItem(SESSION_KEY);
        localStorage.removeItem(SESSION_EXPIRY_KEY);

        // Remove data from IndexedDB
        await removeData(SESSION_KEY);
        await removeData(ITEMS_KEY);
        await removeData(SESSION_EXPIRY_KEY);
        await removeData(MISSING_ITEMS_KEY);
        await removeData('location_data');
        await removeData('right_place_list');
    } catch (error) {
        console.error('Error clearing session:', error);
    }
};

const isSessionActive = () => {
    const expiryTime = parseInt(localStorage.getItem(SESSION_EXPIRY_KEY));
    return expiryTime && Date.now() < expiryTime && localStorage.getItem(SESSION_KEY);
};

// Add these methods to match the expected interface
const getItem = async (key) => {
    return await getData(key);
};

const setItem = async (key, value) => {
    await storeData(key, value);
};

const removeItem = async (key) => {
    await removeData(key);
};

export {
    clearSession, getItem, getItems, getMarkedMissingItems, getSession, isSessionActive, ITEMS_KEY,
    MISSING_ITEMS_KEY, removeItem, saveItems, saveMarkedMissingItems, saveSession, SESSION_KEY, setItem
};

