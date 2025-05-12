const SESSION_KEY = 'koha_inventory_session';
const ITEMS_KEY = 'koha_inventory_items';
const SESSION_EXPIRY_KEY = 'koha_inventory_expiry';
const MISSING_ITEMS_KEY = 'koha_inventory_marked_missing';
const SESSION_DURATION = 24 * 60 * 60 * 1000; // 24 hours in milliseconds

const saveSession = (sessionData) => {
    localStorage.setItem(SESSION_KEY, JSON.stringify(sessionData));
    localStorage.setItem(SESSION_EXPIRY_KEY, Date.now() + SESSION_DURATION);
};

const getSession = () => {
    const expiryTime = parseInt(localStorage.getItem(SESSION_EXPIRY_KEY));
    if (!expiryTime || Date.now() > expiryTime) {
        clearSession();
        return null;
    }

    const sessionData = localStorage.getItem(SESSION_KEY);
    return sessionData ? JSON.parse(sessionData) : null;
};

const saveItems = (items) => {
    localStorage.setItem(ITEMS_KEY, JSON.stringify(items));
};

const getItems = () => {
    const expiryTime = parseInt(localStorage.getItem(SESSION_EXPIRY_KEY));
    if (!expiryTime || Date.now() > expiryTime) {
        clearSession();
        return null;
    }

    const items = localStorage.getItem(ITEMS_KEY);
    return items ? JSON.parse(items) : null;
};

const saveMarkedMissingItems = (barcodes) => {
    if (!Array.isArray(barcodes)) {
        console.error('Invalid barcodes array provided to saveMarkedMissingItems');
        return;
    }
    localStorage.setItem(MISSING_ITEMS_KEY, JSON.stringify(barcodes));
};

const getMarkedMissingItems = () => {
    try {
        const markedMissing = localStorage.getItem(MISSING_ITEMS_KEY);
        return markedMissing ? JSON.parse(markedMissing) : [];
    } catch (e) {
        console.error('Error retrieving marked missing items:', e);
        return [];
    }
};

const clearSession = () => {
    localStorage.removeItem(SESSION_KEY);
    localStorage.removeItem(ITEMS_KEY);
    localStorage.removeItem(SESSION_EXPIRY_KEY);
    localStorage.removeItem(MISSING_ITEMS_KEY);
};

const isSessionActive = () => {
    const expiryTime = parseInt(localStorage.getItem(SESSION_EXPIRY_KEY));
    return expiryTime && Date.now() < expiryTime && localStorage.getItem(SESSION_KEY);
};

// Add these new methods to match the expected interface
const getItem = (key) => {
    return localStorage.getItem(key);
};

const setItem = (key, value) => {
    localStorage.setItem(key, value);
};

const removeItem = (key) => {
    localStorage.removeItem(key);
};

export {
    clearSession, getItem, getItems, getMarkedMissingItems, getSession, isSessionActive, ITEMS_KEY,
    MISSING_ITEMS_KEY, removeItem, saveItems, saveMarkedMissingItems, saveSession, SESSION_KEY, setItem
};

