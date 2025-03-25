const SESSION_KEY = 'koha_inventory_session';
const ITEMS_KEY = 'koha_inventory_items';
const SESSION_EXPIRY_KEY = 'koha_inventory_expiry';
const SESSION_DURATION = 24 * 60 * 60 * 1000; // 24 hours in milliseconds

export const sessionStorage = {
    saveSession(sessionData) {
        localStorage.setItem(SESSION_KEY, JSON.stringify(sessionData));
        localStorage.setItem(SESSION_EXPIRY_KEY, Date.now() + SESSION_DURATION);
    },

    getSession() {
        const expiryTime = parseInt(localStorage.getItem(SESSION_EXPIRY_KEY));
        if (!expiryTime || Date.now() > expiryTime) {
            this.clearSession();
            return null;
        }

        const sessionData = localStorage.getItem(SESSION_KEY);
        return sessionData ? JSON.parse(sessionData) : null;
    },

    saveItems(items) {
        localStorage.setItem(ITEMS_KEY, JSON.stringify(items));
    },

    getItems() {
        const expiryTime = parseInt(localStorage.getItem(SESSION_EXPIRY_KEY));
        if (!expiryTime || Date.now() > expiryTime) {
            this.clearSession();
            return null;
        }

        const items = localStorage.getItem(ITEMS_KEY);
        return items ? JSON.parse(items) : null;
    },

    clearSession() {
        localStorage.removeItem(SESSION_KEY);
        localStorage.removeItem(ITEMS_KEY);
        localStorage.removeItem(SESSION_EXPIRY_KEY);
    },

    isSessionActive() {
        const expiryTime = parseInt(localStorage.getItem(SESSION_EXPIRY_KEY));
        return expiryTime && Date.now() < expiryTime && localStorage.getItem(SESSION_KEY);
    },

    // Add these new methods to match the expected interface
    getItem(key) {
        return localStorage.getItem(key);
    },

    setItem(key, value) {
        localStorage.setItem(key, value);
    },

    removeItem(key) {
        localStorage.removeItem(key);
    }
};
