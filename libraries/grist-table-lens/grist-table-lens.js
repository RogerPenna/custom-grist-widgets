// grist-table-lens.js
const GristTableLens = function(gristInstance) {
    if (!gristInstance) {
        throw new Error("GristTableLens: Instância do Grist (grist object) é obrigatória.");
    }
    const _grist = gristInstance;
    const _metaState = { tables: null, columns: null, tableSchemasCache: {} };

    // --- Funções Internas (adaptadas do GristDataManager original) ---
    async function _loadGristMeta() {
        if (_metaState.tables && _metaState.columns) return;
        const p = [];
        try {
            if (!_metaState.tables) { p.push(_grist.docApi.fetchTable('_grist_Tables').then(d => _metaState.tables = d)); }
            if (!_metaState.columns) { p.push(_grist.docApi.fetchTable('_grist_Tables_column').then(d => _metaState.columns = d)); }
            await Promise.all(p);
        } catch (error) {
            console.error("GristTableLens: Falha ao carregar metadados Grist.", error);
            throw error; // Re-throw para que o chamador saiba
        }
    }

    function _getNumericTableId(tableId) {
        if (!_metaState.tables || !_metaState.tables.tableId) {
            console.error("GristTableLens: _metaState.tables não carregado para _getNumericTableId.");
            return null;
        }
        const idx = _metaState.tables.tableId.findIndex(t => String(t) === String(tableId));
        return idx === -1 ? null : String(_metaState.tables.id[idx]);
    }

    function _getColumnsForTable(numericTableId) {
        if (!_metaState.columns || !_metaState.columns.colId) {
             console.warn("GristTableLens: _metaState.columns não carregado para _getColumnsForTable.");
             return [];
        }
        const cols = [];
        const m = _metaState.columns;
        const tidKey = m.parentId ? 'parentId' : 'tableId'; // Grist usa parentId em _grist_Tables_column
        const cidKey = m.colId ? 'colId' : 'columnId';

        for (let i = 0; i < m[cidKey].length; i++) {
            if (String(m[tidKey][i]) !== String(numericTableId)) continue;

            const colType = String(m.type[i]);
            let referencedTableId = null;
            if (colType.startsWith('Ref:') || colType.startsWith('RefList:')) {
                referencedTableId = colType.split(':')[1];
            }
            const rawFormula = m.formula?.[i] ?? '';
            const isFormula = String(rawFormula).trim() !== '';
            let wopts = {};
            if (m.widgetOptions?.[i]) {
                try { wopts = JSON.parse(m.widgetOptions[i]); } catch (e) { /* ignore */ }
            }
            let choices = [];
            if (Array.isArray(wopts.choices) && wopts.choices.length) {
                choices = wopts.choices.slice();
            } else if (m.choices?.[i]) { // Fallback para choices direto da coluna se não estiver em widgetOptions
                const rawChoices = m.choices[i];
                if (Array.isArray(rawChoices)) {
                    choices = rawChoices[0] === 'L' ? rawChoices.slice(1) : rawChoices;
                } else if (typeof rawChoices === 'string' && rawChoices.startsWith('L')) {
                    choices = rawChoices.substring(1).split(',');
                }
            }
            // displayColId para referências (lógica do GristDataManager original)
            let displayColIdForRef = null;
            if (m.displayCol?.[i] != null) {
                 const dispNumId = m.displayCol[i]; // Este é o ID numérico da coluna de display
                 // Precisamos encontrar o colId (string) correspondente
                 const displayColIndex = m.id.findIndex(idVal => String(idVal) === String(dispNumId));
                 if (displayColIndex !== -1) {
                     displayColIdForRef = String(m[cidKey][displayColIndex]);
                 }
            }

            cols.push({
                id: String(m[cidKey][i]),
                label: String(m.label[i] || m[cidKey][i]),
                type: colType,
                isFormula: isFormula,
                widgetOptions: wopts,
                choices: choices,
                referencedTableId: referencedTableId,
                displayColId: displayColIdForRef // Usado para colunas Ref/RefList
            });
        }
        return cols;
    }

    function _colDataToRows(colData) {
        if (!colData || typeof colData.id === 'undefined' || colData.id === null) return [];
        const rows = [];
        const keys = Object.keys(colData);
        if (keys.length === 0 || !colData[keys[0]] || !Array.isArray(colData[keys[0]])) return []; // Checagem robusta
        const numRows = colData[keys[0]].length;

        for (let i = 0; i < numRows; i++) {
            const row = {};
            keys.forEach(k => row[k] = colData[k][i]);
            rows.push(row);
        }
        return rows;
    }

    // --- API Pública do Módulo ---
    this.getTableSchema = async function(tableId) {
        if (_metaState.tableSchemasCache[tableId]) {
            return _metaState.tableSchemasCache[tableId];
        }
        await _loadGristMeta();
        const numericId = _getNumericTableId(tableId);
        if (!numericId) {
            console.warn(`GristTableLens: Schema não encontrado para tabela '${tableId}'.`);
            return [];
        }
        const schema = _getColumnsForTable(numericId);
        _metaState.tableSchemasCache[tableId] = schema;
        return schema;
    };

    this.fetchTableRecords = async function(tableId) {
        if (!tableId) throw new Error("tableId é obrigatório para fetchTableRecords");
        try {
            const rawData = await _grist.docApi.fetchTable(tableId);
            return _colDataToRows(rawData);
        } catch (error) {
            console.error(`GristTableLens: Erro ao buscar registros para tabela '${tableId}'.`, error);
            return []; // Retorna vazio em caso de erro para não quebrar o widget
        }
    };

    this.getCurrentTableInfo = async function() {
        const tableId = await _grist.selectedTable.getTableId();
        if (!tableId) {
            console.warn("GristTableLens: Nenhuma tabela selecionada.");
            return null;
        }
        const schema = await this.getTableSchema(tableId);
        const records = await this.fetchTableRecords(tableId);
        return { tableId, schema, records };
    };

    this.listAllTables = async function() {
        await _loadGristMeta();
        if (!_metaState.tables || !_metaState.tables.tableId) return [];
        return _metaState.tables.tableId
            .map((id, index) => ({
                id: String(id),
                name: String(_metaState.tables.label?.[index] || id)
            }))
            .filter(t => !t.id.startsWith('_grist_')); // Filtra tabelas do sistema
    };

    // Função para buscar uma linha específica de uma tabela (útil para Refs)
    this.fetchRecordById = async function(tableId, recordId) {
        if (!tableId || recordId === undefined || recordId === null) {
             throw new Error("tableId e recordId são obrigatórios para fetchRecordById");
        }
        // A API Grist não tem um getRecord(tableId, recordId) direto no docApi para widgets.
        // Teríamos que buscar a tabela inteira e filtrar, ou usar TableOperations se disponível.
        // Por simplicidade, vamos buscar a tabela e filtrar.
        // Para performance em tabelas grandes, TableOperations().getRecord(recordId) seria melhor.
        try {
            // Tentar usar TableOperations se o widget tiver acesso à tabela específica
            // const tableOps = _grist.getTable(tableId);
            // if (tableOps && typeof tableOps.getRecord === 'function') {
            //     return await tableOps.getRecord(recordId);
            // } else {
                // Fallback: buscar tudo e filtrar (menos eficiente)
                console.warn(`GristTableLens: Usando fetchTable para buscar registro ${recordId} da tabela ${tableId}. Considere otimizar se a tabela for grande.`);
                const records = await this.fetchTableRecords(tableId);
                return records.find(r => r.id === recordId) || null;
            // }
        } catch (error) {
            console.error(`GristTableLens: Erro ao buscar registro ${recordId} da tabela '${tableId}'.`, error);
            return null;
        }
    };
	    this.fetchRelatedRecords = async function(primaryRecord, refColumnId, options = {}) {
        if (!primaryRecord || !refColumnId) {
            console.warn("GTL.fetchRelatedRecords: primaryRecord e refColumnId são obrigatórios.");
            return [];
        }

        const refColumnSchema = (await this.getTableSchema(primaryRecord.gristHelper_tableId || (await _grist.selectedTable.getTableId())))
                                .find(col => col.id === refColumnId);

        if (!refColumnSchema) {
            console.warn(`GTL.fetchRelatedRecords: Schema da coluna de referência '${refColumnId}' não encontrado.`);
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
            // Para o caso de uma coluna RefList já estar vindo como um array de números (sem o "L")
             console.warn("GTL.fetchRelatedRecords: RefList recebida como array de números. Usando diretamente.");
             relatedRecordIds = refValue.filter(id => id > 0);
        }


        if (relatedRecordIds.length === 0) {
            return [];
        }

        try {
            // Por enquanto, buscamos a tabela relacionada inteira e filtramos.
            // Uma otimização futura seria buscar apenas os IDs necessários se a API permitir.
            const allRelatedRecords = await this.fetchTableRecords(referencedTableId);
            const relatedSchema = await this.getTableSchema(referencedTableId);

            const filteredRecords = allRelatedRecords.filter(r => relatedRecordIds.includes(r.id));

            // Se options.columnsForRelated for especificado, seleciona apenas essas colunas
            if (options.columnsForRelated && Array.isArray(options.columnsForRelated) && options.columnsForRelated.length > 0) {
                return filteredRecords.map(record => {
                    const selectedData = { id: record.id }; // Sempre inclui o ID do registro relacionado
                    options.columnsForRelated.forEach(colId => {
                        if (record.hasOwnProperty(colId)) {
                            selectedData[colId] = record[colId];
                        }
                    });
                    return selectedData;
                });
            }

            return filteredRecords.map(r => ({ ...r, gristHelper_tableId: referencedTableId, gristHelper_schema: relatedSchema })); // Adiciona info da tabela para uso posterior
        } catch (error) {
            console.error(`GTL.fetchRelatedRecords: Erro ao buscar registros relacionados para '${refColumnId}' da tabela '${referencedTableId}'.`, error);
            return [];
        }
    };
};
if (typeof window !== 'undefined') {
    window.GristTableLens = GristTableLens;
}
// export default GristTableLens; // Para quando/se usar módulos ES6
// Para usar no widget:
// window.GristTableLens = GristTableLens; // Se quiser global
// ou export default GristTableLens; // Se usar módulos ES6