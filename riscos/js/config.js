// js/config.js

let activeConfig = null;

export function setWidgetConfig(config) {
    activeConfig = config;
}

export function getTableId() {
    return activeConfig?.mapping?.tableId || "Riscos";
}

export function getAnalysesTableId() {
    return activeConfig?.mapping?.analysesTableId || "Analise_Risco";
}

export function getColumnKey(defaultKey, mappingKey) {
    if (activeConfig && activeConfig.mapping && activeConfig.mapping[mappingKey]) {
        return activeConfig.mapping[mappingKey];
    }
    return defaultKey;
}

// Configurações da Matriz
export const MATRIX_MAX_VALUE = 5;

// Limites para cores de Próxima Análise (em dias)
export const PROX_ANALISE_LIMITS = {
    VERDE: 31,   // Acima de 30 dias
    AMARELO: 1,  // De 1 a 30 dias
    LARANJA: -29,// De 0 a -29 dias (atrasado)
    VERMELHO: -30 // -30 dias ou mais atrasado
};
