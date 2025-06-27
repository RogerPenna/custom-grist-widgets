// custom-grist-widgets/libraries/grist-table-lens/grist-table-lens.js
const GristTableLens = function(gristInstance) {
    // ... (all existing code at the top is fine) ...
    if (!gristInstance) {
        throw new Error("GristTableLens: Instância do Grist (grist object) é obrigatória.");
    }
    const _grist = gristInstance;
    const _metaState = {
        tables: null,
        columnsAndRules: null, // Cache para _grist_Tables_column
        tableSchemasCache: {} // Cache will now store different modes, e.g., { 'Table1': { raw: [...], clean: [...] } }
    };

    // ... _loadGristMeta and _getNumericTableId remain the same ...
    async function _loadGristMeta() {
        if (_metaState.tables && _metaState.columnsAndRules) return;
        const p = [];
        try {
            if (!_metaState.tables) {
                p.push(_grist.docApi.fetchTable('_grist_Tables').then(d => _metaState.tables = d));
            }
            if (!_metaState.columnsAndRules) {
                p.push(_grist.docApi.fetchTable('_grist_Tables_column').then(d => _metaState.columnsAndRules = d));
            }
            await Promise.all(p);
            if (!_metaState.tables || !_metaState.columnsAndRules) {
                throw new Error("_grist_Tables ou _grist_Tables_column não puderam ser carregados.");
            }
        } catch (error) { console.error("GTL: Falha _loadGristMeta.", error); _metaState.tables = null; _metaState.columnsAndRules = null; throw error; }
    }
    function _getNumericTableId(tableId) {
        if (!_metaState.tables?.tableId) { console.warn("GTL._getNumericTableId: _metaState.tables não carregado ou sem tableId."); return null; }
        const idx = _metaState.tables.tableId.findIndex(t => String(t) === String(tableId));
        return idx === -1 ? null : String(_metaState.tables.id[idx]);
    }


    // =================================================================
    // =========== MAJOR CHANGE: _processColumnsAndRulesForTable ===========
    // =================================================================
    // It now accepts a 'mode' parameter.
    function _processColumnsAndRulesForTable(numericTableId, mode = 'clean') {
        if (!_metaState.columnsAndRules?.id) { return []; }

        const allEntries = _metaState.columnsAndRules;
        const numEntries = allEntries.id.length;
        const columnsOutput = [];
        const rulesDefinitionsFromMeta = new Map();

        const tableEntries = [];
        for (let i = 0; i < numEntries; i++) {
            if (String(allEntries.parentId[i]) === String(numericTableId)) {
                const entry = {};
                Object.keys(allEntries).forEach(key => { entry[key] = Array.isArray(allEntries[key]) ? allEntries[key][i] : allEntries[key]; });
                if (Object.keys(entry).length > 0 && entry.id !== undefined) tableEntries.push(entry);
            }
        }
        
        // If mode is 'raw', we do NO filtering. Just return the complete, unprocessed entries.
        if (mode === 'raw') {
            return tableEntries;
        }

        // --- If mode is 'clean' (the default), we proceed with the filtering logic as before ---

        tableEntries.forEach(entry => {
            const entryNumId = String(entry.id);
            const entryColId = String(entry.colId);
            if (entryColId && entryColId.startsWith("gristHelper_ConditionalRule") && entry.formula) {
                let ruleStyle = {};
                if (entry.widgetOptions) { try { ruleStyle = JSON.parse(entry.widgetOptions); } catch (e) {} }
                rulesDefinitionsFromMeta.set(entryNumId, { id: entryNumId, helperColumnId: entryColId, conditionFormula: entry.formula, style: ruleStyle });
            }
        });

        tableEntries.forEach(entry => {
            // This is the line that filters out helper columns in 'clean' mode.
            const isDataColumn = entry.type && entry.type.trim() !== "" && entry.colId && !String(entry.colId).startsWith("gristHelper_");

            if (isDataColumn) {
                const colId = String(entry.colId);
                let referencedTableId = null;
                if (entry.type.startsWith('Ref:') || entry.type.startsWith('RefList:')) { referencedTableId = entry.type.split(':')[1]; }
                const isFormula = String(entry.formula ?? '').trim() !== '';
                let wopts = {}; if (entry.widgetOptions) { try { wopts = JSON.parse(entry.widgetOptions); } catch (e) {} }
                let choices = [];
                if (Array.isArray(wopts.choices)) { choices = wopts.choices; }
                else if (entry.choices) { const raw = entry.choices; if (Array.isArray(raw)) { choices = raw[0] === 'L' ? raw.slice(1) : raw; } }
                
                let displayColIdForRef = null;
                if (entry.displayCol) {
                    const displayColEntry = tableEntries.find(e => String(e.id) === String(entry.displayCol));
                    if (displayColEntry) { displayColIdForRef = String(displayColEntry.colId); }
                }

                const conditionalFormattingRules = [];
                const ruleIdList = entry.rules;
                if (Array.isArray(ruleIdList) && ruleIdList[0] === 'L') {
                    ruleIdList.slice(1).forEach(ruleNumericId => {
                        const ruleDef = rulesDefinitionsFromMeta.get(String(ruleNumericId));
                        if (ruleDef) { conditionalFormattingRules.push(ruleDef); }
                    });
                }
                
                // This is the hand-crafted, simplified object for 'clean' mode.
                columnsOutput.push({
                    id: colId, internalId: String(entry.id), label: String(entry.label || colId), type: entry.type,
                    isFormula, formula: entry.formula ?? '', widgetOptions: wopts, choices, referencedTableId,
                    displayColId: displayColIdForRef, conditionalFormattingRules
                });
            }
        });
        return columnsOutput;
    }

    // ... _colDataToRows remains the same ...
    function _colDataToRows(colData) {
        if (!colData || typeof colData.id === 'undefined') { return []; }
        const rows = []; const keys = Object.keys(colData);
        if (keys.length === 0 || !colData[keys[0]] || !Array.isArray(colData[keys[0]])) { return []; }
        const numRows = colData.id.length;
        for (let i = 0; i < numRows; i++) {
            const r = { id: colData.id[i] };
            keys.forEach(k => { if (k !== 'id') r[k] = colData[k][i]; });
            rows.push(r);
        }
        return rows;
    }

    // =================================================================
    // =========== CHANGE: Methods now accept and pass options ===========
    // =================================================================
    this.getTableSchema = async function(tableId, options = {}) {
        const { mode = 'clean' } = options; // Default to 'clean'
        
        // Adjust cache to handle modes
        if (_metaState.tableSchemasCache[tableId] && _metaState.tableSchemasCache[tableId][mode]) {
            return _metaState.tableSchemasCache[tableId][mode];
        }
        
        await _loadGristMeta();
        const numId = _getNumericTableId(tableId);
        if (!numId) { return []; }

        // Pass the mode to the processing function
        const schema = _processColumnsAndRulesForTable(numId, mode);
        
        if (!_metaState.tableSchemasCache[tableId]) {
            _metaState.tableSchemasCache[tableId] = {};
        }
        _metaState.tableSchemasCache[tableId][mode] = schema;
        return schema;
    };

    // This function is already correct from our last fix. It fetches all columns.
this.fetchTableRecords = async function(tableId) {
    if (!tableId) {
        console.error("GTL.fetchTableRecords: tableId é obrigatório.");
        return [];
    }
    try {
        const rawData = await _grist.docApi.fetchTable(tableId);
        const records = _colDataToRows(rawData);

        // =========================================================
        // ============= ADD THIS LOOP - IT'S CRITICAL =============
        // =========================================================
        // This ensures every record knows which table it came from,
        // which is essential for fetching its related records later.
        records.forEach(r => {
            r.gristHelper_tableId = tableId;
        });
        // =========================================================

        return records;
    } catch (error) {
        console.error(`GTL.fetchTableRecords: Erro ao buscar registros para tabela '${tableId}'.`, error);
        return [];
    }
};

    // This now passes options down to getTableSchema
    this.getCurrentTableInfo = async function(options = {}) {
        const tableId = await _grist.selectedTable.getTableId();
        if (!tableId) { return null; }
        // Pass the options object directly to getTableSchema
        const schema = await this.getTableSchema(tableId, options);
        const records = await this.fetchTableRecords(tableId);
        return { tableId, schema, records };
    };

    // ... listAllTables, fetchRecordById, fetchRelatedRecords remain the same ...
    this.listAllTables = async function() { await _loadGristMeta(); if (!_metaState.tables?.tableId) return []; return _metaState.tables.tableId.map((id, i) => ({ id: String(id), name: String(_metaState.tables.label?.[i] || id) })).filter(t => !t.id.startsWith('_grist_')); };
    this.fetchRecordById = async function(tableId, recordId) { if (!tableId || recordId === undefined) { return null; } try { const records = await this.fetchTableRecords(tableId); return records.find(r => r.id === recordId) || null; } catch (error) { console.error(`GTL.fetchRecordById: Erro ao buscar registro ${recordId} da tabela '${tableId}'.`, error); return null; } };
    this.fetchRelatedRecords = async function(primaryRecord, refColumnId, options = {}) { const { columnsForRelated } = options; if (!primaryRecord || !refColumnId) { return []; } const primaryTableId = primaryRecord.gristHelper_tableId || (await _grist.selectedTable.getTableId()); if (!primaryTableId) { return []; } const refColumnSchema = (await this.getTableSchema(primaryTableId)).find(col => col.id === refColumnId); if (!refColumnSchema) { return []; } const { referencedTableId } = refColumnSchema; if (!referencedTableId) { return []; } const refValue = primaryRecord[refColumnId]; let relatedRecordIds = []; if (refColumnSchema.type.startsWith('Ref:') && typeof refValue === 'number' && refValue > 0) { relatedRecordIds = [refValue]; } else if (refColumnSchema.type.startsWith('RefList:') && Array.isArray(refValue) && refValue[0] === 'L') { relatedRecordIds = refValue.slice(1).filter(id => typeof id === 'number' && id > 0); } if (relatedRecordIds.length === 0) return []; try { const allRelatedRecordsRaw = await this.fetchTableRecords(referencedTableId); const relatedSchema = await this.getTableSchema(referencedTableId); const filteredRecords = allRelatedRecordsRaw.filter(r => relatedRecordIds.includes(r.id)); let resultRecords = filteredRecords.map(r => ({ ...r, gristHelper_tableId: referencedTableId, gristHelper_schema: relatedSchema })); if (columnsForRelated && Array.isArray(columnsForRelated) && columnsForRelated.length > 0) { resultRecords = resultRecords.map(record => { const selectedData = { id: record.id, gristHelper_tableId: record.gristHelper_tableId, gristHelper_schema: record.gristHelper_schema }; options.columnsForRelated.forEach(colId => { if (record.hasOwnProperty(colId)) { selectedData[colId] = record[colId]; } }); return selectedData; }); } return resultRecords; } catch (error) { console.error(`GTL.fetchRelatedRecords: Erro ao buscar registros para '${refColumnId}' da tabela '${referencedTableId}'.`, error); return []; } };
};

if (typeof window !== 'undefined') {
    window.GristTableLens = GristTableLens;
}