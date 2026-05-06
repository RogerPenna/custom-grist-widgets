// libraries/grist-data-writer.js

export const GristDataWriter = function(grist) {
    /**
     * Updates a single record with a set of changes.
     * @param {string} tableId - The ID of the table to update.
     * @param {number} recordId - The ID of the record to update.
     * @param {object} changes - An object of {columnId: newValue} pairs.
     */
    this.updateRecord = async function(tableId, recordId, changes) {
        if (!tableId || !recordId || !changes) {
            throw new Error("updateRecord requires tableId, recordId, and changes.");
        }
        return grist.docApi.applyUserActions([
            ['UpdateRecord', tableId, recordId, changes]
        ]);
    };

    /**
     * Adds a new record to a table.
     * @param {string} tableId - The ID of the table to add to.
     * @param {object} newRecord - An object of {columnId: value} pairs for the new record.
     */
    this.addRecord = async function(tableId, newRecord) {
        if (!tableId || !newRecord) {
            throw new Error("addRecord requires tableId and a newRecord object.");
        }
        // Grist expects values in an array, in the same order as the column IDs.
        const columnIds = Object.keys(newRecord);
        const values = columnIds.map(cid => newRecord[cid]);

        return grist.docApi.applyUserActions([
            ['AddRecord', tableId, null, newRecord]
        ]);
    };

    /**
     * Updates multiple records in a single transaction.
     * @param {string} tableId - The ID of the table to update.
     * @param {Array<{id: number, fields: object}>} updates - Array of update objects.
     */
    this.updateRecords = async function(tableId, updates) {
        if (!tableId || !Array.isArray(updates) || updates.length === 0) {
            throw new Error("updateRecords requires tableId and an array of updates.");
        }
        const actions = updates.map(u => ['UpdateRecord', tableId, u.id, u.fields]);
        return grist.docApi.applyUserActions(actions);
    };

    /**
     * Adds multiple records in a single transaction.
     * @param {string} tableId - The ID of the table.
     * @param {Array<object>} records - Array of objects with field values.
     */
    this.addRecords = async function(tableId, records) {
        if (!tableId || !Array.isArray(records) || records.length === 0) {
            throw new Error("addRecords requires tableId and an array of records.");
        }
        const actions = records.map(r => ['AddRecord', tableId, null, r]);
        return grist.docApi.applyUserActions(actions);
    };

    /**
     * Deletes one or more records.
     * @param {string} tableId - The ID of the table to delete from.
     * @param {number[]} recordIds - An array of record IDs to delete.
     */
    this.deleteRecords = async function(tableId, recordIds) {
        if (!tableId || !recordIds || recordIds.length === 0) {
            throw new Error("deleteRecords requires tableId and an array of recordIds.");
        }
        // The action is 'BulkRemoveRecord'.
        return grist.docApi.applyUserActions([
            ['BulkRemoveRecord', tableId, recordIds]
        ]);
    };
};