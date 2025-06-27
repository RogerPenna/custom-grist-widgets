// custom-grist-widgets/libraries/grist-table-lens/grist-table-lens.js
const GristTableLens = function(gristInstance) {
    if (!gristInstance) {
        throw new Error("GristTableLens: Instância do Grist (grist object) é obrigatória.");
    }
    const _grist = gristInstance;
    const _metaState = {
        tables: null,
        columnsAndRules: null, // Cache para _grist_Tables_column
        tableSchemasCache: {}
    };

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
        } catch (error) {
            console.error("GTL: Falha _loadGristMeta.", error);
            _metaState.tables = null;
            _metaState.columnsAndRules = null;
            throw error;
        }
    }

    function _getNumericTableId(tableId) {
        if (!_metaState.tables?.tableId) {
             console.warn("GTL._getNumericTableId: _metaState.tables não carregado ou sem tableId.");
             return null;
        }
        const idx = _metaState.tables.tableId.findIndex(t => String(t) === String(tableId));
        return idx === -1 ? null : String(_metaState.tables.id[idx]);
    }

    function _processColumnsAndRulesForTable(numericTableId, mode = 'clean', query = {}) {
        if (!_metaState.columnsAndRules?.id) { return []; }

        const allEntries = _metaState.columnsAndRules;
        const numEntries = allEntries.id.length;
        const columnsOutput = [];
        const tableEntries = [];

        for (let i = 0; i < numEntries; i++) {
            if (String(allEntries.parentId[i]) === String(numericTableId)) {
                const entry = {};
                Object.keys(allEntries).forEach(key => { entry[key] = Array.isArray(allEntries[key]) ? allEntries[key][i] : allEntries[key]; });
                if (Object.keys(entry).length > 0 && entry.id !== undefined) tableEntries.push(entry);
            }
        }

        if (mode === 'raw') {
            return tableEntries;
        }
        
        // Custom mode and Clean mode logic would go here if we were using them.
        // For the debug widget, we are only using 'raw' mode, so this part is less critical right now.
        // But let's keep the 'clean' logic for future use.

        const rulesDefinitionsFromMeta = new Map();
        tableEntries.forEach(entry => {
            const entryNumId = String(entry.id);
            const entryColId = String(entry.colId);
            if (entryColId?.startsWith("gristHelper_ConditionalRule") && entry.formula) {
                let ruleStyle = {};
                if (entry.widgetOptions) { try { ruleStyle = JSON.parse(entry.widgetOptions); } catch (e) {} }
                rulesDefinitionsFromMeta.set(entryNumId, { id: entryNumId, helperColumnId: entryColId, conditionFormula: entry.formula, style: ruleStyle });
            }
        });

        tableEntries.forEach(entry => {
            const isDataColumn = entry.type && entry.colId && !String(entry.colId).startsWith("gristHelper_");
            if (isDataColumn) {
                const conditionalFormattingRules = [];
                const ruleIdList = entry.rules;
                if (Array.isArray(ruleIdList) && ruleIdList[0] === 'L') { ruleIdList.slice(1).forEach(rId => { const rd = rulesDefinitionsFromMeta.get(String(rId)); if (rd) { conditionalFormattingRules.push(rd); } }); }
                columnsOutput.push({ id: String(entry.colId), label: String(entry.label || entry.colId), type: entry.type, conditionalFormattingRules });
            }
        });
        return columnsOutput;
    }

    function _colDataToRows(colData) {
        if (!colData || typeof colData.id === 'undefined' || colData.id === null) { return []; }
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

    this.getTableSchema = async function(tableId, options = {}) {
        const { mode = 'clean', query = {} } = options;
        const cacheKey = query.name || mode;
        if (_metaState.tableSchemasCache[tableId]?.[cacheKey]) { return _metaState.tableSchemasCache[tableId][cacheKey]; }
        await _loadGristMeta();
        const numId = _getNumericTableId(tableId);
        if (!numId) { return []; }
        const schema = _processColumnsAndRulesForTable(numId, mode, query);
        if (!_metaState.tableSchemasCache[tableId]) { _metaState.tableSchemasCache[tableId] = {}; }
        _metaState.tableSchemasCache[tableId][cacheKey] = schema;
        return schema;
    };

    // =========================================================
    // =========== THIS IS THE FULL, CORRECT FUNCTION ==========
    // =========================================================
    this.fetchTableRecords = async function(tableId) {
        if (!tableId) {
            console.error("GTL.fetchTableRecords: tableId é obrigatório.");
            return [];
        }
        try {
            const rawData = await _grist.docApi.fetchTable(tableId);
            const records = _colDataToRows(rawData);

            // This loop is ESSENTIAL for the inline tables to work.
            // It adds the tableId to every record object.
            records.forEach(r => {
                r.gristHelper_tableId = tableId;
            });

            return records;
        } catch (error) {
            console.error(`GTL.fetchTableRecords: Erro ao buscar registros para tabela '${tableId}'.`, error);
            return [];
        }
    };
    // =========================================================

    this.getCurrentTableInfo = async function(options = {}) {
        const tableId = await _grist.selectedTable.getTableId();
        if (!tableId) { return null; }
        const schema = await this.getTableSchema(tableId, options);
        const records = await this.fetchTableRecords(tableId);
        return { tableId, schema, records };
    };

     this.listAllTables = async function() {
        await _loadGristMeta();
        if (!_metaState.tables?.tableId) return [];
        return _metaState.tables.tableId
            .map((id, i) => ({ id: String(id), name: String(_metaState.tables.label?.[i] || id) }))
            .filter(t => !t.id.startsWith('_grist_'));
    };

    this.fetchRecordById = async function(tableId, recordId) {
        if (!tableId || recordId === undefined || recordId === null) { return null; }
        try {
            const records = await this.fetchTableRecords(tableId);
            return records.find(r => r.id === recordId) || null;
        } catch (error) {
            console.error(`GTL.fetchRecordById: Erro ao buscar registro ${recordId} da tabela '${tableId}'.`, error);
            return null;
        }
    };

    this.fetchRelatedRecords = async function(primaryRecord, refColumnId) {
        if (!primaryRecord || !refColumnId) { return []; }
        
        // The gristHelper_tableId, added by our corrected fetchTableRecords, is used here.
        const primaryTableId = primaryRecord.gristHelper_tableId;
        if (!primaryTableId) {
            console.warn("GTL.fetchRelatedRecords: Não foi possível determinar o tableId do registro primário. A correção em fetchTableRecords pode estar faltando.");
            return [];
        }

        // Use 'clean' mode here to get a simple schema for finding the referenced table.
        const primarySchema = await this.getTableSchema(primaryTableId, {mode: 'clean'});
        const refColumnSchema = primarySchema.find(col => col.id === refColumnId);
        
        if (!refColumnSchema || !refColumnSchema.referencedTableId) { return []; }

        const refValue = primaryRecord[refColumnId];
        let relatedRecordIds = [];

        if (refColumnSchema.type.startsWith('Ref:') && typeof refValue === 'number' && refValue > 0) {
            relatedRecordIds = [refValue];
        } else if (refColumnSchema.type.startsWith('RefList:') && Array.isArray(refValue) && refValue[0] === 'L') {
            relatedRecordIds = refValue.slice(1).filter(id => typeof id === 'number' && id > 0);
        }

        if (relatedRecordIds.length === 0) return [];

        try {
            const allRelatedRecordsRaw = await this.fetchTableRecords(refColumnSchema.referencedTableId);
            return allRelatedRecordsRaw.filter(r => relatedRecordIds.includes(r.id));
        } catch (error) {
            console.error(`GTL.fetchRelatedRecords: Erro ao buscar registros para '${refColumnId}'.`, error);
            return [];
        }
    };
};

if (typeof window !== 'undefined') {
    window.GristTableLens = GristTableLens;
}