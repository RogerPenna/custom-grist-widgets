import { getTableId, getAnalysesTableId, getColumnKey } from './config.js';

let allColumnsMetadataCache = null; // Cache para metadados das colunas
let analysisTableIdCache = null;
let linkingColumnNameCache = null;

/** Busca dados de uma tabela específica. */
export async function fetchTableData(tableName) {
    console.log(`API: Buscando dados da tabela "${tableName}"...`);
    try {
        const data = await grist.docApi.fetchTable(tableName);
        console.log(`API: Dados de "${tableName}" recebidos.`);
        return data;
    } catch (error) {
        console.error(`API: Erro ao buscar tabela "${tableName}":`, error);
        throw error; // Re-lança o erro para quem chamou tratar
    }
}

/** Busca e cacheia metadados de TODAS as colunas do documento. */
async function fetchAllColumnsMetadata() {
    if (allColumnsMetadataCache) return allColumnsMetadataCache;
    console.log("API: Buscando metadados de _grist_Tables_column...");
    try {
        allColumnsMetadataCache = await grist.docApi.fetchTable('_grist_Tables_column');
        if (!allColumnsMetadataCache || !allColumnsMetadataCache.id) {
            throw new Error("Metadados de coluna inválidos recebidos.");
        }
        console.log("API: Metadados de colunas recebidos e cacheados.");
        return allColumnsMetadataCache;
    } catch (error) {
         console.error("API: Erro ao buscar _grist_Tables_column:", error);
         allColumnsMetadataCache = null; // Limpa cache em caso de erro
         throw error;
    }
}

/** Encontra e cacheia o ID interno da tabela de análise e a coluna de ligação. */
export async function findAnalysisLinkingColumn() {
    if (linkingColumnNameCache) return linkingColumnNameCache; // Retorna do cache se já encontrado

    const primaryTable = getTableId();
    const analysesTable = getAnalysesTableId();

    console.log(`API: Identificando coluna de ligação ${analysesTable} -> ${primaryTable}...`);
    try {
        const columnsMeta = await fetchAllColumnsMetadata();
        const tables = await grist.docApi.fetchTable('_grist_Tables'); // Precisa da lista de tabelas

        let analysisTableMetaId = null;
        if (tables && tables.id && tables.tableId) {
            for (let i = 0; i < tables.id.length; i++) {
                if (tables.tableId[i] === analysesTable) {
                    analysisTableMetaId = tables.id[i];
                    break;
                }
            }
        }
        if (!analysisTableMetaId) {
            throw new Error(`Tabela de análise "${analysesTable}" não encontrada em _grist_Tables.`);
        }
        analysisTableIdCache = analysisTableMetaId; // Cacheia o ID interno da tabela de análise

        let foundColumn = null;
        for (let i = 0; i < columnsMeta.id.length; i++) {
            // Verifica se a coluna pertence à tabela de Análise E é referência para a tabela de Riscos
            if (columnsMeta.parentId[i] === analysisTableIdCache && columnsMeta.type[i] === `Ref:${primaryTable}`) {
                foundColumn = columnsMeta.colId[i];
                break;
            }
        }

        if (!foundColumn) {
            throw new Error(`Não foi possível encontrar a coluna em "${analysesTable}" que referencia "${primaryTable}". Verifique a configuração.`);
        }

        linkingColumnNameCache = foundColumn; // Cacheia o nome da coluna
        console.log(`API: Coluna de ligação encontrada e cacheada: "${linkingColumnNameCache}"`);
        return linkingColumnNameCache;

    } catch (error) {
        console.error("API: Erro ao identificar coluna de ligação:", error);
        linkingColumnNameCache = null; // Garante que está nulo se não encontrado
        throw error;
    }
}

/** Busca TODAS as análises e cacheia o resultado. */
let allAnalysesDataCache = null;
export async function fetchAllAnalyses() {
    if (allAnalysesDataCache) return allAnalysesDataCache;
    const analysesTable = getAnalysesTableId();
    console.log(`API: Buscando TODAS as análises de "${analysesTable}"...`);
    try {
        allAnalysesDataCache = await fetchTableData(analysesTable);
         if (!allAnalysesDataCache || !allAnalysesDataCache.id) {
             throw new Error("Dados de análise inválidos recebidos.");
         }
         console.log(`API: ${allAnalysesDataCache.id.length} análises recebidas e cacheadas.`);
         return allAnalysesDataCache;
    } catch (error) {
        allAnalysesDataCache = null; // Limpa cache em erro
        throw error;
    }
}

/**
 * Filtra as análises cacheadas para um riskId específico.
 * Requer que findAnalysisLinkingColumn e fetchAllAnalyses tenham sido chamadas com sucesso antes.
 */
export function filterAnalysesForRisk(riskId) {
    if (!linkingColumnNameCache || !allAnalysesDataCache) {
        console.error("API: Cache de coluna de ligação ou dados de análise não disponível para filtro.");
        return []; // Retorna vazio se os pré-requisitos não foram atendidos
    }

    const filteredAnalyses = [];
    const linkingColumnValues = allAnalysesDataCache[linkingColumnNameCache];
    const totalAnalyses = allAnalysesDataCache.id.length;
    const columnNames = Object.keys(allAnalysesDataCache).filter(key => Array.isArray(allAnalysesDataCache[key])); // Pega nomes das colunas dos dados

    if (!linkingColumnValues) {
        console.error(`API: Coluna de ligação "${linkingColumnNameCache}" não encontrada nos dados cacheados.`);
        return [];
    }

    console.log(`API: Filtrando ${totalAnalyses} análises cacheadas para Risco ID ${riskId}...`);
    for (let i = 0; i < totalAnalyses; i++) {
        let val = linkingColumnValues[i];
        let refId = null;

        if (typeof val === 'number') {
            refId = val;
        } else if (typeof val === 'object' && val !== null) {
            if (val.id !== undefined) refId = val.id;
            else if (val.displayValue !== undefined) refId = val.displayValue; // Fallback
        } else if (Array.isArray(val) && val.length > 0) {
            refId = val[0] === 'L' ? val[1] : val[0];
        } else {
            refId = val; // Direct fallback
        }

        if (Number(refId) === Number(riskId)) {
            const analysisRecord = {};
            columnNames.forEach(colName => {
                analysisRecord[colName] = allAnalysesDataCache[colName][i];
            });
            filteredAnalyses.push(analysisRecord);
        }
    }
    console.log(`API: Filtro concluído, ${filteredAnalyses.length} análises encontradas.`);
    return filteredAnalyses;
}

// Futuramente, adicione funções para applyUserActions (create/update/delete) aqui.
// Ex: export async function addAnalysis(analysisData) { ... }
