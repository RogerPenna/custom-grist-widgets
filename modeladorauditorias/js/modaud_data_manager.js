// js/modaud_data_manager.js

// Cache para evitar buscar os metadados do documento repetidamente.
const _schemaCache = {
    allTables: null,
    allColumns: null,
};

/**
 * Converte dados do formato de coluna do Grist para o formato de linha (array de objetos).
 */
function mapColumnsToRows(dataAsColumns) {
    if (!dataAsColumns || typeof dataAsColumns.id === 'undefined' || dataAsColumns.id.length === 0) return [];
    const keys = Object.keys(dataAsColumns);
    const numRows = dataAsColumns.id.length;
    const dataAsRows = [];
    for (let i = 0; i < numRows; i++) {
        const row = {};
        for (const key of keys) { row[key] = dataAsColumns[key][i]; }
        dataAsRows.push(row);
    }
    return dataAsRows;
}

/**
 * Busca e armazena em cache os metadados de tabelas e colunas de todo o documento.
 */
async function _loadSchemaCache() {
    if (!_schemaCache.allTables) {
        _schemaCache.allTables = mapColumnsToRows(await grist.docApi.fetchTable('_grist_Tables'));
    }
    if (!_schemaCache.allColumns) {
        _schemaCache.allColumns = mapColumnsToRows(await grist.docApi.fetchTable('_grist_Tables_column'));
    }
}

/**
 * Busca dados de qualquer tabela.
 * @param {string} tableId - O nome da tabela.
 * @param {Object} [filters] - Filtros opcionais.
 * @returns {Promise<Array<Object>>}
 */
export async function getTableData(tableId, filters = null) {
    const dataAsColumns = await grist.docApi.fetchTable(tableId, filters);
    return mapColumnsToRows(dataAsColumns);
}

/**
 * A função principal. A partir de um nome de coluna de referência, descobre tudo o que precisa
 * para popular o dropdown de contexto.
 * @param {string} refColId - O nome da coluna de referência em Modelos_Perguntas (ex: "Referencia_Area").
 * @returns {Promise<{contextRecords: Array<Object>, displayColId: string, label: string}>}
 */
export async function getContextDataFromRefColumn(refColId) {
    await _loadSchemaCache();
    const { allTables, allColumns } = _schemaCache;

    // 1. Encontrar os metadados da tabela "Modelos_Perguntas"
    const perguntasTableMeta = allTables.find(t => t.tableId === 'Modelos_Perguntas');
    if (!perguntasTableMeta) throw new Error("Tabela 'Modelos_Perguntas' não encontrada nos metadados.");

    // 2. Encontrar os metadados da coluna de referência (ex: "Referencia_Area")
    const refColMeta = allColumns.find(c => c.parentId === perguntasTableMeta.id && c.colId === refColId);
    if (!refColMeta || !refColMeta.type.startsWith('Ref:')) {
        throw new Error(`A coluna '${refColId}' não é uma coluna de Referência válida em 'Modelos_Perguntas'.`);
    }

    // 3. Descobrir a tabela de contexto a partir do ID numérico da referência
    const contextTableNumericId = parseInt(refColMeta.type.split(':')[1], 10);
    const contextTableMeta = allTables.find(t => t.id === contextTableNumericId);
    if (!contextTableMeta) throw new Error(`Tabela de contexto referenciada por '${refColId}' não foi encontrada.`);
    const contextTableId = contextTableMeta.tableId;

    // 4. Descobrir a "Show Column" (coluna de display)
    let displayColId = 'id'; // Fallback
    if (refColMeta.displayCol) {
        const displayColMeta = allColumns.find(c => c.id === refColMeta.displayCol);
        if (displayColMeta) {
            displayColId = displayColMeta.colId;
        }
    } else {
        console.warn(`Coluna '${refColId}' não tem uma 'Show Column' configurada. Tentando adivinhar a melhor coluna de texto.`);
        // Tentativa de adivinhação mais inteligente se displayCol não estiver configurada
        const contextColumns = allColumns.filter(c => c.parentId === contextTableMeta.id);
        const bestTextColumn = contextColumns.find(c => c.type === 'Text' && !c.isFormula) || contextColumns.find(c => c.type === 'Text');
        if (bestTextColumn) {
            displayColId = bestTextColumn.colId;
        }
    }

    // 5. Buscar os dados da tabela de contexto
    const contextRecords = await getTableData(contextTableId);
    
    return {
        contextRecords,
        displayColId,
        label: refColMeta.label || refColId
    };
}