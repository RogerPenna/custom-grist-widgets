// libraries/grist-table-lens/grist-table-lens.js

export const GristTableLens = function(gristInstance) {
    if (!gristInstance) {
        throw new Error("GristTableLens: Instância do Grist (grist object) é obrigatória.");
    }
    const _grist = gristInstance;
const _metaState = {
    tables: null,
    columnsAndRules: null,
    tableSchemasCache: {}, // <-- VÍRGULA ADICIONADA
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

    // ====================================================================================
    // MUDANÇA FUNDAMENTAL: A função agora retorna um OBJETO, não um ARRAY.
    // As chaves do objeto são os `colId`s textuais.
    // ====================================================================================
    function _processColumnsAndRulesForTable(numericTableId, mode = 'clean', query = {}) {
        if (!_metaState.columnsAndRules?.id) { return {}; } // MUDANÇA: Retorna objeto vazio.
        const allEntries = _metaState.columnsAndRules;
        const numEntries = allEntries.id.length;
        const columnsOutput = {}; // MUDANÇA: O output agora é um objeto/dicionário.
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
        
        // MUDANÇA: Lógica custom query adaptada para o novo formato de output (objeto).
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
                // CORREÇÃO: Usar o widgetOptions da regra, não da coluna principal
                if (entry.widgetOptions) { 
                    try { 
                        const ruleOpts = JSON.parse(entry.widgetOptions);
                        // A API do Grist armazena o estilo da regra diretamente, não dentro de um objeto.
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
                    // MUDANÇA: O Grist armazena os estilos (rulesOptions) na coluna principal, não na regra.
                    // A ordem dos estilos em `rulesOptions` corresponde à ordem dos IDs em `rules`.
                    const stylesFromWidgetOptions = wopts.rulesOptions || [];
                    ruleIdList.slice(1).forEach((rId, index) => {
                        const rd = rulesDefinitionsFromMeta.get(String(rId));
                        if (rd) {
                            // Associa o estilo correspondente da coluna principal com a regra.
                            rd.style = stylesFromWidgetOptions[index] || {};
                            conditionalFormattingRules.push(rd);
                         }
                    });
                }
                
                // MUDANÇA: Adiciona ao objeto usando o colId textual como chave.
                columnsOutput[entry.colId] = {
                    id: entry.id, // ID numérico ainda é útil para lookups (ex: displayCol)
                    colId: entry.colId,
                    label: String(entry.label || entry.colId),
                    type: entry.type,
                    widgetOptions: wopts,
                    isFormula: !!entry.isFormula, // Corrigido para usar o campo correto
                    formula: entry.formula,
                    rules: entry.rules,
                    displayCol: entry.displayCol,
                    conditionalFormattingRules: conditionalFormattingRules
                };
            }
        });
        return columnsOutput;
    }
    
    // MUDANÇA: A função foi ajustada para iterar sobre os VALORES do objeto de schema.
function _getDisplayColId(displayColIdNum, schemaToSearch) {
    // Essa função agora só é chamada para o modo de edição, mas a mantemos correta.
    if (!displayColIdNum) return null;

    const displayColSchema = Object.values(schemaToSearch).find(c => c.id === displayColIdNum);

    if (!displayColSchema) return null;

    if (displayColSchema.isFormula && displayColSchema.formula?.includes('.')) {
        const formulaParts = displayColSchema.formula.split('.');
        const finalColId = formulaParts[formulaParts.length - 1];
        // Validação de segurança
        const finalColExistsInTarget = Object.values(schemaToSearch).some(c => c.colId === finalColId);
        if(finalColExistsInTarget) return finalColId;
    }

    return displayColSchema.colId;
}
    
    function _colDataToRows(colData) { if (!colData?.id) { return []; } const rows = []; const keys = Object.keys(colData); if (keys.length === 0 || !Array.isArray(colData[keys[0]])) { return []; } const numRows = colData.id.length; for (let i = 0; i < numRows; i++) { const r = { id: colData.id[i] }; keys.forEach(k => { if (k !== 'id') r[k] = colData[k][i]; }); rows.push(r); } return rows; }

    this.getTableSchema = async function(tableId, options = {}) {
        const { mode = 'clean', query = {} } = options;
        const cacheKey = query.name || mode;
        if (_metaState.tableSchemasCache[tableId]?.[cacheKey]) { return _metaState.tableSchemasCache[tableId][cacheKey]; }
        await _loadGristMeta();
        const numId = _getNumericTableId(tableId);
        if (!numId) { return {}; } // MUDANÇA: Retorna objeto vazio.
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

        // MUDANÇA: O schema agora é um objeto. Acessamos a coluna diretamente.
        const primarySchema = await this.getTableSchema(primaryTableId, { mode: 'clean' });
        const refColumnSchema = primarySchema[refColumnId]; // Acesso direto, mais limpo e rápido!
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

    // Pega o ID do registro de destino (ex: 1)
    const recordId = record[colSchema.colId];
    if (typeof recordId !== 'number' || recordId <= 0) {
        return { displayValue: '(vazio)', referencedRecord: null };
    }

    // 1. DETERMINA A COLUNA DE DISPLAY FINAL
    let finalDisplayColId = null;
    const displayColIdNum = colSchema.displayCol;

    if (displayColIdNum) {
        // Busca o schema da tabela de ORIGEM (onde a coluna helper está).
        const sourceTableId = record.gristHelper_tableId;
        if (sourceTableId) {
            const sourceSchema = await this.getTableSchema(sourceTableId);
            const displayColHelperSchema = Object.values(sourceSchema).find(c => c.id === displayColIdNum);

            if (displayColHelperSchema) {
                // Se for uma fórmula de referência, extrai o nome da coluna final.
                if (displayColHelperSchema.isFormula && displayColHelperSchema.formula?.includes('.')) {
                    const formulaParts = displayColHelperSchema.formula.split('.');
                    finalDisplayColId = formulaParts[formulaParts.length - 1];
                } else {
                    // Se a displayCol não for uma fórmula de ref, assume que é o colId direto.
                    finalDisplayColId = displayColHelperSchema.colId;
                }
            }
        }
    }

    // 2. BUSCA O REGISTRO DE DESTINO
    const referencedTableId = colSchema.type.split(':')[1];
    const referencedRecord = await this.fetchRecordById(referencedTableId, recordId);

    if (!referencedRecord) {
        return { displayValue: `[Ref Inválido: ${recordId}]`, referencedRecord: null };
    }

    // 3. RETORNA O VALOR CORRETO
    // Se encontramos a coluna de display, usamos. Senão, fallback para o ID da referência.
    const displayValue = finalDisplayColId ? referencedRecord[finalDisplayColId] : `[Ref: ${recordId}]`;

    return { displayValue, referencedRecord };
};
    this.fetchConfig = async function(configId) {
        if (!configId) {
            console.error("GTL.fetchConfig: configId não foi fornecido.");
            return null;
        }

        // 1. Verifica o cache primeiro
        if (_metaState.configCache[configId]) {
            return _metaState.configCache[configId];
        }

        const configTableName = 'Grf_config';

        try {
            // 2. Busca todos os registros da tabela de configuração
            const configTableData = await _grist.docApi.fetchTable(configTableName);
            const configs = _colDataToRows(configTableData);

            // 3. Encontra a configuração específica pelo configId
            const targetConfig = configs.find(c => c.configId === configId);

            if (!targetConfig) {
                throw new Error(`Configuração com id "${configId}" não encontrada na tabela "${configTableName}".`);
            }

            if (!targetConfig.configJson || typeof targetConfig.configJson !== 'string') {
                throw new Error(`A coluna 'configJson' para o configId "${configId}" está vazia ou não é texto.`);
            }

            // 4. Faz o parse do JSON para um objeto JavaScript
            const parsedConfig = JSON.parse(targetConfig.configJson);

            // 5. Armazena o resultado no cache
            _metaState.configCache[configId] = parsedConfig;

            return parsedConfig;

        } catch (error) {
            console.error(`GTL.fetchConfig: Erro ao buscar ou processar a configuração "${configId}".`, error);
            // Se o erro foi de JSON.parse, é útil logar o conteúdo problemático
            if (error instanceof SyntaxError) {
                const configRecord = (await _colDataToRows(await _grist.docApi.fetchTable(configTableName))).find(c => c.configId === configId);
                console.error("Conteúdo do JSON inválido:", configRecord?.configJson);
            }
            throw error; // Re-lança o erro para que o chamador saiba que algo deu errado
        }
    };
	/**
     * Limpa o cache de configurações.
     * @param {string} [configId] - Se fornecido, limpa apenas a entrada para este ID. Senão, limpa todo o cache.
     */
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