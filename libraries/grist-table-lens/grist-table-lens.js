// libraries/grist-table-lens/grist-table-lens.js
// VERSÃO SEGURA: Adiciona novas funcionalidades sem alterar as existentes.

export const GristTableLens = function(gristInstance) {
    if (!gristInstance) {
        throw new Error("GristTableLens: Instância do Grist (grist object) é obrigatória.");
    }
    const _grist = gristInstance;
    const _metaState = {
        tables: null,
        columnsAndRules: null,
        tableSchemasCache: {},
        configCache: {}
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
        if (!_metaState.columnsAndRules?.id) { return {}; }
        const allEntries = _metaState.columnsAndRules;
        const numEntries = allEntries.id.length;
        const columnsOutput = {};
        const tableEntries = [];

        for (let i = 0; i < numEntries; i++) {
            if (String(allEntries.parentId[i]) === String(numericTableId)) {
                const entry = {};
                Object.keys(allEntries).forEach(key => { entry[key] = Array.isArray(allEntries[key]) ? allEntries[key][i] : allEntries[key]; });
                if (Object.keys(entry).length > 0 && entry.id !== undefined) tableEntries.push(entry);
            }
        }
        
        if (mode === 'raw') {
            const rawOutput = {};
            tableEntries.forEach(entry => {
                if(entry.colId) rawOutput[entry.colId] = entry;
            });
            return rawOutput;
        }
        
        if (mode === 'custom' && query.columns) {
            const customOutput = {};
            tableEntries.forEach(entry => {
                if (query.columns.includes(entry.colId)) {
                    const newCol = {};
                    const desiredKeys = query.metadata?.[entry.colId] || ['id', 'colId', 'label', 'type'];
                    desiredKeys.forEach(key => { if (entry[key] !== undefined) { newCol[key] = entry[key]; } });
                    customOutput[entry.colId] = newCol;
                }
            });
            return customOutput;
        }

        const rulesDefinitionsFromMeta = new Map();
        tableEntries.forEach(entry => {
            if (entry.colId?.startsWith("gristHelper_ConditionalRule") && entry.formula) {
                let ruleStyle = {};
                if (entry.widgetOptions) { 
                    try { 
                        const ruleOpts = JSON.parse(entry.widgetOptions);
                        ruleStyle = ruleOpts;
                    } catch (e) {} 
                }
                rulesDefinitionsFromMeta.set(String(entry.id), { id: String(entry.id), helperColumnId: String(entry.colId), conditionFormula: entry.formula, style: ruleStyle });
            }
        });

        tableEntries.forEach(entry => {
            const isDataColumn = entry.type && entry.colId;
            if (isDataColumn) {
                const wopts = JSON.parse(entry.widgetOptions || '{}');
                const conditionalFormattingRules = [];
                const ruleIdList = entry.rules;
                if (Array.isArray(ruleIdList) && ruleIdList[0] === 'L') {
                    const stylesFromWidgetOptions = wopts.rulesOptions || [];
                    ruleIdList.slice(1).forEach((rId, index) => {
                        const rd = rulesDefinitionsFromMeta.get(String(rId));
                        if (rd) {
                            rd.style = stylesFromWidgetOptions[index] || {};
                            conditionalFormattingRules.push(rd);
                         }
                    });
                }
                
                columnsOutput[entry.colId] = {
                    id: entry.id,
                    colId: entry.colId,
                    label: String(entry.label || entry.colId),
                    type: entry.type,
                    widgetOptions: wopts,
                    isFormula: !!entry.isFormula,
                    formula: entry.formula,
                    rules: entry.rules,
                    displayCol: entry.displayCol,
                    conditionalFormattingRules: conditionalFormattingRules
                };
            }
        });
        return columnsOutput;
    }
    
    function _getDisplayColId(displayColIdNum, schemaToSearch) {
        if (!displayColIdNum) return null;
        const displayColSchema = Object.values(schemaToSearch).find(c => c.id === displayColIdNum);
        if (!displayColSchema) return null;
        if (displayColSchema.isFormula && displayColSchema.formula?.includes('.')) {
            const formulaParts = displayColSchema.formula.split('.');
            const finalColId = formulaParts[formulaParts.length - 1];
            const finalColExistsInTarget = Object.values(schemaToSearch).some(c => c.colId === finalColId);
            if(finalColExistsInTarget) return finalColId;
        }
        return displayColSchema.colId;
    }
    
    function _colDataToRows(colData) {
        if (!colData?.id) { return []; }
        const rows = [];
        const keys = Object.keys(colData);
        if (keys.length === 0 || !Array.isArray(colData[keys[0]])) { return []; }
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
        if (!numId) { return {}; }
        const schema = _processColumnsAndRulesForTable(numId, mode, query);
        if (!_metaState.tableSchemasCache[tableId]) { _metaState.tableSchemasCache[tableId] = {}; }
        _metaState.tableSchemasCache[tableId][cacheKey] = schema;
        return schema;
    };

    /**
     * [INALTERADO] Busca registros de uma tabela. Em caso de erro (ex: tabela não existe),
     * retorna um array vazio para manter compatibilidade com componentes antigos.
     */
    this.fetchTableRecords = async function(tableId) {
        if (!tableId) { return []; }
        try {
            const rawData = await _grist.docApi.fetchTable(tableId);
            const records = _colDataToRows(rawData);
            records.forEach(r => { r.gristHelper_tableId = tableId; });
            return records;
        } catch (error) {
            console.error(`GTL.fetchTableRecords: Erro ao buscar registros para tabela '${tableId}'. Retornando array vazio.`, error);
            return [];
        }
    };
    
    /**
     * [NOVO] Busca registros de uma tabela. Em caso de erro (ex: tabela não existe),
     * LANÇA o erro para que o chamador possa tratá-lo adequadamente.
     */
    this.fetchTableRecordsOrThrow = async function(tableId) {
        if (!tableId) {
             throw new Error("GTL.fetchTableRecordsOrThrow: tableId não foi fornecido.");
        }
        try {
            const rawData = await _grist.docApi.fetchTable(tableId);
            const records = _colDataToRows(rawData);
            records.forEach(r => { r.gristHelper_tableId = tableId; });
            return records;
        } catch (error) {
            console.error(`GTL.fetchTableRecordsOrThrow: Erro ao buscar registros para tabela '${tableId}'. Lançando o erro.`, error);
            throw error; // A MUDANÇA CRÍTICA ESTÁ AQUI
        }
    };

    /**
     * [NOVO] Encontra um único registro em uma tabela que corresponde a um filtro.
     * @param {string} tableId - O nome da tabela a ser pesquisada.
     * @param {object} filterObject - Um objeto chave/valor para filtrar. Ex: { id: 5 }
     * @returns {object|null} O primeiro registro encontrado ou null.
     */
    this.findRecord = async function(tableId, filterObject) {
        if (!tableId || !filterObject || Object.keys(filterObject).length === 0) {
            console.warn("GTL.findRecord: tableId ou filterObject inválido.", { tableId, filterObject });
            return null;
        }
        try {
            // Usa a versão segura que lança erro, para que o findRecord também seja "honesto".
            const records = await this.fetchTableRecordsOrThrow(tableId);
            const filterKeys = Object.keys(filterObject);
            const foundRecord = records.find(record => {
                return filterKeys.every(key => record[key] == filterObject[key]);
            });
            return foundRecord || null;
        } catch (error) {
            console.error(`GTL.findRecord: Erro ao tentar encontrar registro em '${tableId}' com filtro:`, filterObject, error);
            return null;
        }
    };

    this.listAllTables = async function() { await _loadGristMeta(); if (!_metaState.tables?.tableId) return []; return _metaState.tables.tableId.map((id, i) => ({ id: String(id), name: String(_metaState.tables.label?.[i] || id) })).filter(t => !t.id.startsWith('_grist_')); };

    this.fetchRecordById = async function(tableId, recordId) {
        if (!tableId || recordId === undefined) return null;
        try {
            // Atualizado para usar a nova função findRecord
            return await this.findRecord(tableId, { id: recordId });
        } catch (error) {
            console.error(`GTL.fetchRecordById: Erro ao buscar registro ${recordId} da tabela '${tableId}'.`, error);
            return null;
        }
    };
    
    this.fetchRelatedRecords = async function(primaryRecord, refColumnId) {
        if (!primaryRecord || !refColumnId) return [];
        const primaryTableId = primaryRecord.gristHelper_tableId;
        if (!primaryTableId) return [];
        const primarySchema = await this.getTableSchema(primaryTableId, { mode: 'clean' });
        const refColumnSchema = primarySchema[refColumnId];
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
        if (!colSchema.type.startsWith('Ref:') || !record) {
            return { displayValue: `[Invalid Ref]`, referencedRecord: null };
        }
        const recordId = record[colSchema.colId];
        if (typeof recordId !== 'number' || recordId <= 0) {
            return { displayValue: '(vazio)', referencedRecord: null };
        }
        let finalDisplayColId = null;
        const displayColIdNum = colSchema.displayCol;
        if (displayColIdNum) {
            const sourceTableId = record.gristHelper_tableId;
            if (sourceTableId) {
                const sourceSchema = await this.getTableSchema(sourceTableId);
                const displayColHelperSchema = Object.values(sourceSchema).find(c => c.id === displayColIdNum);
                if (displayColHelperSchema) {
                    if (displayColHelperSchema.isFormula && displayColHelperSchema.formula?.includes('.')) {
                        const formulaParts = displayColHelperSchema.formula.split('.');
                        finalDisplayColId = formulaParts[formulaParts.length - 1];
                    } else {
                        finalDisplayColId = displayColHelperSchema.colId;
                    }
                }
            }
        }
        const referencedTableId = colSchema.type.split(':')[1];
        const referencedRecord = await this.fetchRecordById(referencedTableId, recordId);
        if (!referencedRecord) {
            return { displayValue: `[Ref Inválido: ${recordId}]`, referencedRecord: null };
        }
        const displayValue = finalDisplayColId ? referencedRecord[finalDisplayColId] : `[Ref: ${recordId}]`;
        return { displayValue, referencedRecord };
    };

    this.fetchConfig = async function(configId) {
        if (!configId) {
            console.error("GTL.fetchConfig: configId não foi fornecido.");
            return null;
        }
        if (_metaState.configCache[configId]) {
            return _metaState.configCache[configId];
        }
        const configTableName = 'Grf_config';
        try {
            const configTableData = await _grist.docApi.fetchTable(configTableName);
            const configs = _colDataToRows(configTableData);
            const targetConfig = configs.find(c => c.configId === configId);
            if (!targetConfig) {
                throw new Error(`Configuração com id "${configId}" não encontrada na tabela "${configTableName}".`);
            }
            if (!targetConfig.configJson || typeof targetConfig.configJson !== 'string') {
                throw new Error(`A coluna 'configJson' para o configId "${configId}" está vazia ou não é texto.`);
            }
            const parsedConfig = JSON.parse(targetConfig.configJson);
            _metaState.configCache[configId] = parsedConfig;
            return parsedConfig;
        } catch (error) {
            console.error(`GTL.fetchConfig: Erro ao buscar ou processar a configuração "${configId}".`, error);
            if (error instanceof SyntaxError) {
                const configRecord = (await _colDataToRows(await _grist.docApi.fetchTable(configTableName))).find(c => c.configId === configId);
                console.error("Conteúdo do JSON inválido:", configRecord?.configJson);
            }
            throw error;
        }
    };
    
    this.clearConfigCache = function(configId) {
        if (configId) {
            if (_metaState.configCache[configId]) {
                delete _metaState.configCache[configId];
                console.log(`GTL: Cache para '${configId}' foi limpo.`);
            }
        } else {
            _metaState.configCache = {};
            console.log("GTL: Todo o cache de configurações foi limpo.");
        }
    };
};