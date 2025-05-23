// custom-grist-widgets/libraries/grist-table-lens/grist-table-lens.js
const GristTableLens = function(gristInstance) {
    if (!gristInstance) {
        throw new Error("GristTableLens: Instância do Grist (grist object) é obrigatória.");
    }
    const _grist = gristInstance;
    const _metaState = { tables: null, columns: null, tableSchemasCache: {} };

    async function _loadGristMeta() {
        if (_metaState.tables && _metaState.columns) return;
        const p = [];
        try {
            if (!_metaState.tables) { p.push(_grist.docApi.fetchTable('_grist_Tables').then(d => _metaState.tables = d).catch(e => { console.error("GTL: Erro _grist_Tables", e); throw e; })); }
            if (!_metaState.columns) { p.push(_grist.docApi.fetchTable('_grist_Tables_column').then(d => _metaState.columns = d).catch(e => { console.error("GTL: Erro _grist_Tables_column", e); throw e; }));}
            if (p.length) { await Promise.all(p); }
        } catch (error) { console.error("GTL: Falha _loadGristMeta.", error); throw error; }
    }

    function _getNumericTableId(tableId) {
        if (!_metaState.tables?.tableId) {
             console.warn("GTL._getNumericTableId: _metaState.tables não carregado ou sem tableId.");
             return null;
        }
        const idx = _metaState.tables.tableId.findIndex(t => String(t) === String(tableId));
        return idx === -1 ? null : String(_metaState.tables.id[idx]);
    }

    function _getColumnsForTable(numericTableId) {
        if (!_metaState.columns?.colId) {
            console.warn("GTL._getColumnsForTable: _metaState.columns não carregado ou sem colId.");
            return [];
        }
        const cols = []; const m = _metaState.columns;
        const tidKey = m.parentId ? 'parentId' : 'tableId';
        const cidKey = m.colId ? 'colId' : 'columnId';

        for (let i = 0; i < m[cidKey].length; i++) {
            if (String(m[tidKey][i]) !== String(numericTableId)) continue;
            const colType = String(m.type[i]);
            let referencedTableId = null;
            if (colType.startsWith('Ref:') || colType.startsWith('RefList:')) {
                referencedTableId = colType.split(':')[1];
            }
            const isFormula = String(m.formula?.[i] ?? '').trim() !== '';
            let wopts = {}; if (m.widgetOptions?.[i]) { try { wopts = JSON.parse(m.widgetOptions[i]); } catch (e) {} }
            let choices = [];
            if (Array.isArray(wopts.choices) && wopts.choices.length) { choices = wopts.choices.slice(); }
            else if (m.choices?.[i]) { const raw = m.choices[i]; if (Array.isArray(raw)) { choices = raw[0] === 'L' ? raw.slice(1) : raw; } else if (typeof raw === 'string' && raw.startsWith('L')) { choices = raw.substring(1).split(','); } }
            let displayColIdForRef = null;
            if (m.displayCol?.[i] != null) { const dci = m.id.findIndex(idVal => String(idVal) === String(m.displayCol[i])); if (dci !== -1) displayColIdForRef = String(m[cidKey][dci]); }

            cols.push({ id: String(m[cidKey][i]), label: String(m.label[i] || m[cidKey][i]), type: colType, isFormula, widgetOptions: wopts, choices, referencedTableId, displayColId: displayColIdForRef });
        }
        return cols;
    }

    function _colDataToRows(colData) {
        if (!colData || typeof colData.id === 'undefined' || colData.id === null) { console.warn("GTL._colDataToRows: colData inválido."); return []; }
        const rows = []; const keys = Object.keys(colData);
        if (keys.length === 0 || !colData[keys[0]] || !Array.isArray(colData[keys[0]])) { console.warn("GTL._colDataToRows: colData sem chaves ou primeira chave não é array."); return []; }
        const numRows = colData.id.length; // Usa colData.id.length como referência confiável para o número de linhas
        for (let i = 0; i < numRows; i++) {
            const r = { id: colData.id[i] }; // Garante que 'id' seja uma propriedade da linha
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
        const schema = _getColumnsForTable(numId);
        _metaState.tableSchemasCache[tableId] = schema;
        return schema;
    };

    this.fetchTableRecords = async function(tableId) {
        if (!tableId) { console.error("GTL.fetchTableRecords: tableId é obrigatório."); return [];}
        try {
            const rawData = await _grist.docApi.fetchTable(tableId);
            return _colDataToRows(rawData);
        } catch (error) { console.error(`GTL.fetchTableRecords: Erro ao buscar registros para tabela '${tableId}'.`, error); return []; }
    };

    this.getCurrentTableInfo = async function() {
        const tableId = await _grist.selectedTable.getTableId();
        if (!tableId) { console.warn("GTL.getCurrentTableInfo: Nenhuma tabela selecionada."); return null; }
        const schema = await this.getTableSchema(tableId);
        const records = await this.fetchTableRecords(tableId);
        return {
            tableId, // tableId (string)
            schema,  // array de objetos de coluna
            records  // array de objetos de linha
        };
    };

     this.listAllTables = async function() {
        await _loadGristMeta();
        if (!_metaState.tables?.tableId) return [];
        return _metaState.tables.tableId
            .map((id, i) => ({ id: String(id), name: String(_metaState.tables.label?.[i] || id) }))
            .filter(t => !t.id.startsWith('_grist_'));
    };

    this.fetchRecordById = async function(tableId, recordId) {
        if (!tableId || recordId === undefined || recordId === null) {
             console.error("GTL.fetchRecordById: tableId e recordId são obrigatórios."); return null;
        }
        try {
            // console.warn(`GTL.fetchRecordById: Buscando registro ${recordId} da tabela ${tableId} (buscando tabela inteira).`);
            const records = await this.fetchTableRecords(tableId);
            return records.find(r => r.id === recordId) || null;
        } catch (error) {
            console.error(`GTL.fetchRecordById: Erro ao buscar registro ${recordId} da tabela '${tableId}'.`, error);
            return null;
        }
    };

    this.fetchRelatedRecords = async function(primaryRecord, refColumnId, options = {}) {
        if (!primaryRecord || !refColumnId) {
            console.warn("GTL.fetchRelatedRecords: primaryRecord e refColumnId são obrigatórios.");
            return [];
        }
        // Tenta obter o tableId do primaryRecord se ele tiver sido enriquecido anteriormente,
        // caso contrário, assume a tabela atualmente selecionada (pode não ser correto para todos os casos de uso profundos)
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

        if (relatedRecordIds.length === 0) {
            return [];
        }

        try {
            const allRelatedRecordsRaw = await this.fetchTableRecords(referencedTableId);
            const relatedSchema = await this.getTableSchema(referencedTableId); // Pega o schema da tabela relacionada

            const filteredRecords = allRelatedRecordsRaw.filter(r => relatedRecordIds.includes(r.id));

            let resultRecords = filteredRecords.map(r => ({ ...r, gristHelper_tableId: referencedTableId, gristHelper_schema: relatedSchema }));

            if (options.columnsForRelated && Array.isArray(options.columnsForRelated) && options.columnsForRelated.length > 0) {
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