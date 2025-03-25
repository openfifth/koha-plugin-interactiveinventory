import { EventBus } from '../components/eventBus.js';

export const apiService = {
    /**
     * Helper function to create a delay using Promise
     * @param {number} ms - Milliseconds to delay
     * @returns {Promise} - Promise that resolves after the delay
     */
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    },

    /**
     * Fetches all results from a paginated API endpoint with more robust error handling
     * @param {string} endpoint - The API endpoint to fetch from
     * @param {object} options - Additional options for the request
     * @returns {Promise<Array>} - All items from all pages
     */
    async fetchAllPaginated(endpoint, options = {}) {
        const {
            pageSize = null,
            onProgress = null,
            onPageFetched = null,
            usePagination = true,
            artificialDelay = 0
        } = options;

        if (!usePagination) {
            try {
                const response = await fetch(`${endpoint}?_per_page=-1`);
                if (!response.ok) {
                    const errorText = await response.text();
                    console.error(`API Error (${response.status}):`, errorText);
                    throw new Error(`Failed to fetch from ${endpoint}: ${response.statusText}`);
                }
                return await response.json();
            } catch (error) {
                console.error('Fetch error:', error);
                EventBus.emit('message', {
                    type: 'error',
                    text: `Error fetching data: ${error.message}`
                });
                throw error;
            }
        }

        let allItems = [];
        let currentPage = 1;
        let hasMorePages = true;

        try {
            while (hasMorePages) {
                let url = `${endpoint}?_page=${currentPage}`;
                if (pageSize !== null) {
                    url += `&_per_page=${pageSize}`;
                }

                console.log(`Fetching page ${currentPage} from ${url}`);
                const response = await fetch(url);

                if (!response.ok) {
                    const errorText = await response.text();
                    console.error(`API Error (${response.status}):`, errorText);
                    throw new Error(`Failed to fetch page ${currentPage} from ${endpoint}: ${response.statusText}`);
                }

                const items = await response.json();
                console.log(`Received ${items.length} items from page ${currentPage}`);

                if (items.length === 0) {
                    hasMorePages = false;
                } else {
                    if (onPageFetched && typeof onPageFetched === 'function') {
                        onPageFetched(items, currentPage);
                    }

                    allItems = [...allItems, ...items];

                    const linkHeader = response.headers.get('Link');
                    hasMorePages = linkHeader && linkHeader.includes('rel="next"');

                    if (onProgress) {
                        const totalCountHeader = response.headers.get('X-Total-Count');
                        const totalItems = totalCountHeader ? parseInt(totalCountHeader) : null;
                        onProgress({
                            loaded: allItems.length,
                            total: totalItems,
                            page: currentPage
                        });
                    }

                    if (artificialDelay > 0 && hasMorePages) {
                        await this.delay(artificialDelay);
                    }

                    currentPage++;
                }
            }

            return allItems;
        } catch (error) {
            console.error('Pagination error:', error);
            EventBus.emit('message', {
                type: 'error',
                text: `Error fetching paginated data: ${error.message}`
            });
            throw error;
        }
    },

    /**
     * Fetches authorized values with pagination support and incremental display
     * @param {string} category - The authorized value category
     * @param {object} options - Additional options
     * @returns {Promise<object>} - Object mapping value codes to descriptions
     */
    async fetchAuthorizedValues(category, options = {}) {
        const cacheKey = `authorizedValues_${category}`;
        const cachedValues = localStorage.getItem(cacheKey);

        if (cachedValues && !options.bypassCache) {
            const parsedValues = JSON.parse(cachedValues);

            // If we have a callback for updates, call it immediately with cached values
            if (options.onValuesUpdate) {
                options.onValuesUpdate(parsedValues);
            }

            return parsedValues;
        }

        // Create a collection to store values as they arrive
        const values = {};

        // Create a promise that will resolve when all pages are fetched
        return new Promise((resolve, reject) => {
            this.fetchAllPaginated(
                `/api/v1/authorised_value_categories/${category}/authorised_values`,
                {
                    ...options,
                    // When each page is fetched, update values and notify via callback
                    onPageFetched: (pageItems, pageNum) => {
                        // Update the values object with this page's items
                        pageItems.forEach(item => {
                            values[item.value] = item.description;
                        });

                        // Notify about the update to partial results
                        if (options.onValuesUpdate) {
                            options.onValuesUpdate({ ...values });
                        }
                    }
                }
            ).then(allItems => {
                // When all items are fetched, cache the result
                localStorage.setItem(cacheKey, JSON.stringify(values));
                resolve(values);
            }).catch(error => {
                EventBus.emit('message', {
                    type: 'error',
                    text: `Error fetching authorized values for ${category}: ${error.message}`
                });
                reject(error);
            });
        });
    },

    /**
     * Performs a POST request to an API endpoint
     * @param {string} endpoint - The API endpoint
     * @param {object} data - The data to send
     * @param {object} options - Additional options
     * @returns {Promise} - The response data
     */
    async post(endpoint, data, options = {}) {
        try {
            const response = await fetch(endpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                    ...options.headers
                },
                body: JSON.stringify(data)
            });

            if (!response.ok) {
                let errorMessage = response.statusText;
                try {
                    const errorData = await response.json();
                    errorMessage = errorData?.error || errorData?.errors?.[0]?.message || errorMessage;
                } catch (e) {
                    // If response cannot be parsed as JSON, use the status text
                }
                throw new Error(`Network response was not ok: ${errorMessage}`);
            }

            return await response.json();
        } catch (error) {
            EventBus.emit('message', {
                type: 'error',
                text: `API error: ${error.message}`
            });
            throw error;
        }
    },

    /**
     * Fetches a single resource
     * @param {string} endpoint - The API endpoint
     * @param {object} options - Additional options
     * @returns {Promise} - The response data
     */
    async fetchSingle(endpoint, options = {}) {
        try {
            const response = await fetch(endpoint, {
                method: 'GET',
                headers: {
                    'Accept': 'application/json',
                    ...options.headers
                }
            });

            if (!response.ok) {
                throw new Error(`Failed to fetch from ${endpoint}`);
            }

            return await response.json();
        } catch (error) {
            EventBus.emit('message', {
                type: 'error',
                text: `Error fetching data: ${error.message}`
            });
            throw error;
        }
    }
};
