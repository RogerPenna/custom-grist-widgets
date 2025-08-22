// js/modaud_grist.js

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
 * Atualiza registros na tabela Modelos_Perguntas.
 * @param {Array<Object>} updates - Array de objetos de atualização.
 * @returns {Promise<void>}
 */
export async function updateQuestions(updates) {
    const NOME_TABELA = 'Modelos_Perguntas';
    if (!updates || updates.length === 0) {
        return Promise.resolve();
    }
    
    try {
        const userActions = updates.map(u => ['UpdateRecord', NOME_TABELA, u.id, u.fields]);
        await grist.docApi.applyUserActions(userActions);
    } catch (e) {
        console.error(`Falha ao atualizar registros em '${NOME_TABELA}':`, e);
        throw e;
    }
}