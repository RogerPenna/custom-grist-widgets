// libraries/grist-table-lens/grist-table-lens.js

export const GristTableLens = function(gristInstance) {
    if (!gristInstance) {
        throw new Error("GristTableLens: Instância do Grist (grist object) é obrigatória.");
    }
    const _grist = gristInstance;
    const _metaState = {
        tables: null,
        columnsAndRules: null,
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
        if (!_metaState.tables?.tableId) return null;
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

        if (mode === 'custom' && query.columns) {
            tableEntries.forEach(entry => {
                if (query.columns.includes(entry.colId)) {
                    const newCol = {};
                    const desiredKeys = query.metadata?.[entry.colId] || ['id', 'colId', 'label', 'type'];
                    desiredKeys.forEach(key => { if (entry[key] !== undefined) { newCol[key] = entry[key]; } });
                    columnsOutput.push(newCol);
                }
            });
            return columnsOutput;
        }

        const rulesDefinitionsFromMeta = new Map();
        tableEntries.forEach(entry => {
            if (entry.colId?.startsWith("gristHelper_ConditionalRule") && entry.formula) {
                let ruleStyle = {};
                if (entry.widgetOptions) { try { ruleStyle = JSON.parse(entry.widgetOptions); } catch (e) {} }
                rulesDefinitionsFromMeta.set(String(entry.id), { id: String(entry.id), helperColumnId: String(entry.colId), conditionFormula: entry.formula, style: ruleStyle });
            }
        });

        tableEntries.forEach(entry => {
            const isDataColumn = entry.type && entry.colId && !String(entry.colId).startsWith("gristHelper_");
            if (isDataColumn) {
                const wopts = JSON.parse(entry.widgetOptions || '{}');
                const conditionalFormattingRules = [];
                const ruleIdList = entry.rules;
                if (Array.isArray(ruleIdList) && ruleIdList[0] === 'L') {
                    ruleIdList.slice(1).forEach(rId => {
                        const rd = rulesDefinitionsFromMeta.get(String(rId));
                        if (rd) { conditionalFormattingRules.push(rd); }
                    });
                }
                columnsOutput.push({
                    id: String(entry.colId),
                    label: String(entry.label || entry.colId),
                    type: entry.type,
                    widgetOptions: wopts,
                    isFormula: !!entry.formula,
                    formula: entry.formula,
                    rules: entry.rules,
                    displayCol: entry.displayCol,
                    conditionalFormattingRules,
                });
            }
        });
        return columnsOutput;
    }

    function _getDisplayColId(colSchema, referencedSchema) {
        if (!colSchema.displayCol) return null;
        const displayColSchema = referencedSchema.find(c => c.id === colSchema.displayCol);
        return displayColSchema ? displayColSchema.colId : null;
    }
    
    function _colDataToRows(colData) { if (!colData?.id) { return []; } const rows = []; const keys = Object.keys(colData); if (keys.length === 0 || !Array.isArray(colData[keys[0]])) { return []; } const numRows = colData.id.length; for (let i = 0; i < numRows; i++) { const r = { id: colData.id[i] }; keys.forEach(k => { if (k !== 'id') r[k] = colData[k][i]; }); rows.push(r); } return rows; }

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

    this.fetchTableRecords = async function(tableId) {
        if (!tableId) { return []; }
        try {
            const rawData = await _grist.docApi.fetchTable(tableId);
            const records = _colDataToRows(rawData);
            records.forEach(r => { r.gristHelper_tableId = tableId; });
            return records;
        } catch (error) {
            console.error(`GTL.fetchTableRecords: Erro ao buscar registros para tabela '${tableId}'.`, error);
            return [];
        }
    };

    this.listAllTables = async function() { await _loadGristMeta(); if (!_metaState.tables?.tableId) return []; return _metaState.tables.tableId.map((id, i) => ({ id: String(id), name: String(_metaState.tables.label?.[i] || id) })).filter(t => !t.id.startsWith('_grist_')); };

    this.fetchRecordById = async function(tableId, recordId) {
        if (!tableId || recordId === undefined) return null;
        try {
            const records = await this.fetchTableRecords(tableId);
            return records.find(r => r.id === recordId) || null;
        } catch (error) {
            console.error(`GTL.fetchRecordById: Erro ao buscar registro ${recordId} da tabela '${tableId}'.`, error);
            return null;
        }
    };
    
    this.fetchRelatedRecords = async function(primaryRecord, refColumnId) {
        if (!primaryRecord || !refColumnId) return [];
        const primaryTableId = primaryRecord.gristHelper_tableId;
        if (!primaryTableId) return [];

        const primarySchema = await this.getTableSchema(primaryTableId, {mode: 'raw'});
        const refColumnSchema = primarySchema.find(col => col.colId === refColumnId);
        if (!refColumnSchema || !refColumnSchema.type.startsWith('RefList:')) return [];

        const referencedTableId = refColumnSchema.type.split(':')[1];
        if (!referencedTableId) return [];

        const refValue = primaryRecord[refColumnId];
        if (!Array.isArray(refValue) || refValue[0] !== 'L') return [];
        
        const relatedRecordIds = refValue.slice(1).filter(id => typeof id === 'number' && id > 0);
        if (relatedRecordIds.length === 0) return [];

        try {
            const allRelatedRecords = await this.fetchTableRecords(referencedTableId);
            const idSet = new Set(relatedRecordIds);
            return allRelatedRecords.filter(r => idSet.has(r.id));
        } catch (error) {
            console.error(`GTL.fetchRelatedRecords: Erro ao buscar registros para '${refColumnId}'.`, error);
            return [];
        }
    };
    
    this.resolveReference = async function(colSchema, record) {
        if (!colSchema.type.startsWith('Ref:') || !record) return { displayValue: `[Invalid Ref]`, referencedRecord: null };
        const recordId = record[colSchema.colId];
        if (typeof recordId !== 'number' || recordId <= 0) return { displayValue: '(empty)', referencedRecord: null };

        const referencedTableId = colSchema.type.split(':')[1];
        const referencedRecord = await this.fetchRecordById(referencedTableId, recordId);

        if (!referencedRecord) return { displayValue: `[Ref not found: ${recordId}]`, referencedRecord: null };

        const referencedSchema = await this.getTableSchema(referencedTableId, { mode: 'raw' });
        const displayColId = _getDisplayColId(colSchema, referencedSchema);
        
        const displayValue = displayColId ? referencedRecord[displayColId] : `[Ref: ${recordId}]`;

        return { displayValue, referencedRecord };
    };
};