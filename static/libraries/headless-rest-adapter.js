/**
 * grist-rest-adapter.js
 * 
 * Provides a subset of the Grist Doc API functionality using the Grist REST API.
 * This allows widgets to run in a "headless" mode outside of the Grist iframe.
 */

export const GristRestAdapter = function(config) {
    const {
        gristUrl,    // Base URL of Grist (e.g., https://docs.getgrist.com)
        docId,       // The document ID
        apiKey       // API Key (or token)
    } = config;

    if (!gristUrl || !docId) {
        throw new Error("GristRestAdapter: gristUrl and docId are required.");
    }

    const baseUrl = `${gristUrl.replace(/\/$/, '')}/api/docs/${docId}`;
    const headers = {
        'Content-Type': 'application/json'
    };
    if (apiKey) {
        headers['Authorization'] = `Bearer ${apiKey}`;
    }

    /**
     * Helper to make fetch requests
     */
    async function request(path, options = {}) {
        const url = `${baseUrl}${path}`;
        const response = await fetch(url, {
            ...options,
            headers: {
                ...headers,
                ...options.headers
            }
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Grist REST API error (${response.status}): ${errorText}`);
        }

        if (response.status === 204) return null;
        return response.json();
    }

    /**
     * Mimics grist.docApi.fetchTable
     * Grist REST API returns { records: [ { id: 1, fields: { ... } }, ... ] }
     * But the original grist.fetchTable returns a Column-oriented format: { id: [1, 2], ColA: ['val1', 'val2'] }
     * We need to convert REST response to Column-oriented format to maintain compatibility with GTL.
     */
    this.fetchTable = async function(tableId) {
        const data = await request(`/tables/${tableId}/records`);
        
        if (!data.records || data.records.length === 0) {
            return { id: [] };
        }

        // Convert to column-oriented format
        const colOriented = { id: [] };
        const firstFields = data.records[0].fields;
        Object.keys(firstFields).forEach(key => colOriented[key] = []);

        data.records.forEach(record => {
            colOriented.id.push(record.id);
            Object.entries(record.fields).forEach(([key, value]) => {
                if (!colOriented.hasOwnProperty(key)) colOriented[key] = new Array(colOriented.id.length - 1).fill(null);
                colOriented[key].push(value);
            });
        });

        return colOriented;
    };

    /**
     * Mimics grist.docApi.applyUserActions
     */
    this.applyUserActions = async function(actions) {
        const results = [];
        for (const action of actions) {
            const [type, tableId, ...args] = action;
            
            if (type === 'UpdateRecord') {
                const [recordId, fields] = args;
                await request(`/tables/${tableId}/records`, {
                    method: 'PATCH',
                    body: JSON.stringify({
                        records: [{ id: recordId, fields }]
                    })
                });
            } 
            else if (type === 'AddRecord') {
                const [ignored, fields] = args;
                await request(`/tables/${tableId}/records`, {
                    method: 'POST',
                    body: JSON.stringify({
                        records: [{ fields }]
                    })
                });
            }
            else if (type === 'BulkRemoveRecord') {
                const [recordIds] = args;
                // Grist REST API usually uses a specific endpoint for bulk delete or just DELETE with IDs
                // According to Grist API docs, DELETE /records with a list of IDs works.
                await request(`/tables/${tableId}/records`, {
                    method: 'POST', // Some versions use POST /delete, others DELETE
                    headers: { 'X-HTTP-Method-Override': 'DELETE' }, // Common pattern for Grist if DELETE body isn't supported
                    body: JSON.stringify(recordIds)
                });
            }
        }
        return results;
    };

    /**
     * Manual refresh trigger for the application
     */
    this.refresh = async function(onRecordsCallback, tableId) {
        if (!onRecordsCallback || !tableId) return;
        const rawData = await this.fetchTable(tableId);
        // Convert column-oriented back to row-oriented for onRecords compatibility
        const records = [];
        const keys = Object.keys(rawData);
        const numRows = rawData.id.length;
        for (let i = 0; i < numRows; i++) {
            const r = { id: rawData.id[i] };
            keys.forEach(k => { if (k !== 'id') r[k] = rawData[k][i]; });
            records.push(r);
        }
        onRecordsCallback(records);
    };

    // Expose docApi to match grist object structure
    this.docApi = {
        fetchTable: this.fetchTable.bind(this),
        applyUserActions: this.applyUserActions.bind(this)
    };
};
