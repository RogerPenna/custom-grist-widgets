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

    function _processColumnsAndRulesForTable(numericTableId) {
        if (!_metaState.columnsAndRules?.id) {
            console.warn("GTL._processColumnsAndRulesForTable: _metaState.columnsAndRules não carregado ou inválido.");
            return [];
        }

        const allEntries = _metaState.columnsAndRules;
        const numEntries = allEntries.id.length;
        const columnsOutput = [];
        const rulesDefinitionsFromMeta = new Map();

        const tableEntries = [];
        for (let i = 0; i < numEntries; i++) {
            if (String(allEntries.parentId[i]) === String(numericTableId)) {
                const entry = {};
                Object.keys(allEntries).forEach(key => {
                    if (Array.isArray(allEntries[key]) && allEntries[key].length > i) { // Checa se o índice é válido
                        entry[key] = allEntries[key][i];
                    } else if (!Array.isArray(allEntries[key])) { // Para propriedades que não são arrays (raro em _grist_Tables_column)
                        entry[key] = allEntries[key];
                    }
                });
                if (Object.keys(entry).length > 0) tableEntries.push(entry); // Adiciona apenas se o entry foi populado
            }
        }

        tableEntries.forEach(entry => {
            const entryNumId = String(entry.id);
            const entryColId = String(entry.colId);

            // Identifica uma regra se o colId começa com gristHelper_ConditionalRule e tem uma fórmula
            if (entryColId && entryColId.startsWith("gristHelper_ConditionalRule") && entry.formula) {
                let ruleStyle = {};
                if (entry.widgetOptions) {
                    try { ruleStyle = JSON.parse(entry.widgetOptions); }
                    catch (e) { console.warn(`GTL: JSON inválido em widgetOptions para regra ID ${entryNumId} (${entryColId})`, entry.widgetOptions); }
                }
                rulesDefinitionsFromMeta.set(entryNumId, {
                    id: entryNumId,
                    helperColumnId: entryColId,
                    conditionFormula: entry.formula,
                    style: ruleStyle
                });
            }
        });

        tableEntries.forEach(entry => {
            // Uma coluna de dados real tem um 'type' preenchido e não é um helper óbvio
            const isDataColumn = entry.type && entry.type.trim() !== "" && entry.colId && !String(entry.colId).startsWith("gristHelper_");

            if (isDataColumn) {
                const colId = String(entry.colId);
                let referencedTableId = null;
                if (entry.type.startsWith('Ref:') || entry.type.startsWith('RefList:')) {
                    referencedTableId = entry.type.split(':')[1];
                }
                const isFormula = String(entry.formula ?? '').trim() !== '';
                let wopts = {}; if (entry.widgetOptions) { try { wopts = JSON.parse(entry.widgetOptions); } catch (e) {} }
                let choices = [];
                if (Array.isArray(wopts.choices) && wopts.choices.length) { choices = wopts.choices.slice(); }
                else if (entry.choices) { const raw = entry.choices; if (Array.isArray(raw)) { choices = raw[0] === 'L' ? raw.slice(1) : raw; } else if (typeof raw === 'string' && raw.startsWith('L')) { choices = raw.substring(1).split(','); } }
                
                let displayColIdForRef = null;
                if (entry.displayCol != null && entry.displayCol !== 0) { // displayCol é o ID numérico da linha da coluna de display
                    const displayColEntry = tableEntries.find(e => String(e.id) === String(entry.displayCol));
                    if (displayColEntry) {
                        displayColIdForRef = String(displayColEntry.colId);
                    }
                }

                const conditionalFormattingRules = [];
                const ruleIdList = entry.rules; // Coluna 'rules' da linha da coluna de DADOS
                
                if (Array.isArray(ruleIdList) && ruleIdList[0] === 'L') {
                    ruleIdList.slice(1).forEach(ruleNumericId => {
                        const ruleDef = rulesDefinitionsFromMeta.get(String(ruleNumericId));
                        if (ruleDef) {
                            conditionalFormattingRules.push(ruleDef);
                        } else {
                            // console.warn(`GTL: Definição para regra ID ${ruleNumericId} (associada à coluna ${colId}) não encontrada.`);
                        }
                    });
                }

                columnsOutput.push({
                    id: colId,
                    internalId: String(entry.id),
                    label: String(entry.label || colId),
                    type: entry.type,
                    isFormula,
                    formula: entry.formula ?? '',
                    widgetOptions: wopts,
                    choices,
                    referencedTableId,
                    displayColId: displayColIdForRef,
                    conditionalFormattingRules
                });
            }
        });
        return columnsOutput;
    }

    function _colDataToRows(colData) {
        if (!colData || typeof colData.id === 'undefined' || colData.id === null) { console.warn("GTL._colDataToRows: colData inválido."); return []; }
        const rows = []; const keys = Object.keys(colData);
        if (keys.length === 0 || !colData[keys[0]] || !Array.isArray(colData[keys[0]])) { console.warn("GTL._colDataToRows: colData sem chaves ou primeira chave não é array."); return []; }
        const numRows = colData.id.length;
        for (let i = 0; i < numRows; i++) {
            const r = { id: colData.id[i] };
            keys.forEach(k => { if (k !== 'id') r[k] = colData[k][i]; });
            rows.push(r);
        }
        return rows;
    }

    this.getTableSchema = async function(tableId) {
        if (_metaState.tableSchemasCache[tableId]) return _metaState.tableSchemasCache[tableId];
        await _loadGristMeta();
        const numId = _getNumericTableId(tableId);
        if (!numId) { console.warn(`GTL.getTableSchema: numId não encontrado para tabela '${tableId}'.`); _metaState.tableSchemasCache[tableId] = []; return []; }
        const schema = _processColumnsAndRulesForTable(numId);
        _metaState.tableSchemasCache[tableId] = schema;
        return schema;
    };

    this.fetchTableRecords = async function(tableId, keepEncodedOption = false) {
        if (!tableId) { console.error("GTL.fetchTableRecords: tableId é obrigatório."); return [];}
        try {
            const rawData = await _grist.docApi.fetchTable(tableId, { keepEncoded: keepEncodedOption });
            return _colDataToRows(rawData);
        } catch (error) { console.error(`GTL.fetchTableRecords: Erro ao buscar registros para tabela '${tableId}'.`, error); return []; }
    };

    this.getCurrentTableInfo = async function(options = {}) {
        const { keepEncoded = false } = options;
        const tableId = await _grist.selectedTable.getTableId();
        if (!tableId) { console.warn("GTL.getCurrentTableInfo: Nenhuma tabela selecionada."); return null; }
        const schema = await this.getTableSchema(tableId);
        const records = await this.fetchTableRecords(tableId, keepEncoded);
        return { tableId, schema, records };
    };

     this.listAllTables = async function() {
        await _loadGristMeta();
        if (!_metaState.tables?.tableId) return [];
        return _metaState.tables.tableId
            .map((id, i) => ({ id: String(id), name: String(_metaState.tables.label?.[i] || id) }))
            .filter(t => !t.id.startsWith('_grist_'));
    };

    this.fetchRecordById = async function(tableId, recordId, options = {}) {
        const { keepEncoded = false } = options;
        if (!tableId || recordId === undefined || recordId === null) {
             console.error("GTL.fetchRecordById: tableId e recordId são obrigatórios."); return null;
        }
        try {
            const records = await this.fetchTableRecords(tableId, keepEncoded);
            return records.find(r => r.id === recordId) || null;
        } catch (error) {
            console.error(`GTL.fetchRecordById: Erro ao buscar registro ${recordId} da tabela '${tableId}'.`, error);
            return null;
        }
    };

    this.fetchRelatedRecords = async function(primaryRecord, refColumnId, options = {}) {
        const { keepEncoded = false, columnsForRelated } = options;

        if (!primaryRecord || !refColumnId) {
            console.warn("GTL.fetchRelatedRecords: primaryRecord e refColumnId são obrigatórios.");
            return [];
        }
        const primaryTableId = primaryRecord.gristHelper_tableId || (await _grist.selectedTable.getTableId());
        if (!primaryTableId) {
            console.warn("GTL.fetchRelatedRecords: Não foi possível determinar o tableId do registro primário.");
            return [];
        }

        const refColumnSchema = (await this.getTableSchema(primaryTableId)).find(col => col.id === refColumnId);

        if (!refColumnSchema) {
            console.warn(`GTL.fetchRelatedRecords: Schema da coluna de referência '${refColumnId}' não encontrado na tabela '${primaryTableId}'.`);
            return [];
        }

        const { referencedTableId } = refColumnSchema;
        if (!referencedTableId) {
            console.warn(`GTL.fetchRelatedRecords: Coluna '${refColumnId}' não é uma coluna de referência válida.`);
            return [];
        }

        const refValue = primaryRecord[refColumnId];
        let relatedRecordIds = [];

        if (refColumnSchema.type.startsWith('Ref:') && typeof refValue === 'number' && refValue > 0) {
            relatedRecordIds = [refValue];
        } else if (refColumnSchema.type.startsWith('RefList:') && Array.isArray(refValue) && refValue[0] === 'L') {
            relatedRecordIds = refValue.slice(1).filter(id => typeof id === 'number' && id > 0);
        } else if (Array.isArray(refValue) && refValue.length > 0 && refValue.every(item => typeof item === 'number')) {
             relatedRecordIds = refValue.filter(id => id > 0);
        }

        if (relatedRecordIds.length === 0) return [];

        try {
            const allRelatedRecordsRaw = await this.fetchTableRecords(referencedTableId, keepEncoded);
            const relatedSchema = await this.getTableSchema(referencedTableId);

            const filteredRecords = allRelatedRecordsRaw.filter(r => relatedRecordIds.includes(r.id));
            let resultRecords = filteredRecords.map(r => ({ ...r, gristHelper_tableId: referencedTableId, gristHelper_schema: relatedSchema }));

            if (columnsForRelated && Array.isArray(columnsForRelated) && columnsForRelated.length > 0) {
                resultRecords = resultRecords.map(record => {
                    const selectedData = { id: record.id, gristHelper_tableId: record.gristHelper_tableId, gristHelper_schema: record.gristHelper_schema };
                    options.columnsForRelated.forEach(colId => {
                        if (record.hasOwnProperty(colId)) {
                            selectedData[colId] = record[colId];
                        }
                    });
                    return selectedData;
                });
            }
            return resultRecords;
        } catch (error) {
            console.error(`GTL.fetchRelatedRecords: Erro ao buscar registros para '${refColumnId}' da tabela '${referencedTableId}'.`, error);
            return [];
        }
    };
};

if (typeof window !== 'undefined') {
    window.GristTableLens = GristTableLens;
}