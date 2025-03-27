// js/utils.js

/**
 * Formata uma data (timestamp numérico ou string ISO) para DD/MM/YYYY.
 * Retorna string vazia se a data for inválida ou nula.
 */
export function formatDate(dateInput) {
    if (!dateInput) return "";
    try {
        let d;
        if (typeof dateInput === 'number') {
            d = new Date(dateInput * (dateInput > 10000000000 ? 1 : 1000)); // Auto-detecta seg/ms
        } else if (typeof dateInput === 'string') {
            d = new Date(dateInput);
        } else { return ""; }
        if (isNaN(d.getTime())) return "";
        let day = d.getDate();
        let month = d.getMonth() + 1;
        let year = d.getFullYear();
        return `${(day < 10 ? "0" : "") + day}/${(month < 10 ? "0" : "") + month}/${year}`;
    } catch (e) {
        console.warn("Erro ao formatar data:", dateInput, e);
        return "";
    }
}

/**
 * Calcula a diferença em dias entre uma data e hoje.
 * Retorna Infinity se a data for inválida ou nula.
 */
export function diffDays(dateStr) {
    if (!dateStr) return Infinity;
    try {
        let prox;
        if (typeof dateStr === 'number') {
            prox = new Date(dateStr * (dateStr > 10000000000 ? 1 : 1000));
        } else if (typeof dateStr === 'string') {
             prox = new Date(dateStr);
        } else { return Infinity; }
        if (isNaN(prox.getTime())) return Infinity;
        const hoje = new Date();
        prox.setHours(0, 0, 0, 0);
        hoje.setHours(0, 0, 0, 0);
        return (prox - hoje) / (1000 * 60 * 60 * 24);
    } catch (e) {
         console.warn("Erro ao calcular diffDays:", dateStr, e);
         return Infinity;
    }
}

/**
 * Extrai o nome do departamento de forma segura, lidando com diferentes tipos de colunas.
 */
export function getDeptName(riskRecord, deptColumnName) {
    if (!riskRecord || !deptColumnName) return "ERRO_CONF";
    let deptField = riskRecord[deptColumnName];
    if (!deptField) return "SEM DEPTO";
    // Se for lookup (objeto com displayValue) - Comum em dados Grist via onRecords
    if (typeof deptField === 'object' && deptField !== null && typeof deptField.displayValue !== 'undefined') {
        return deptField.displayValue || "SEM DEPTO";
    }
    // Se for choice list (array ['L', valor])
    if (Array.isArray(deptField) && deptField.length > 0 && deptField[0] === 'L') {
         return deptField[1] || "SEM DEPTO";
    }
    // Se for referência (número id) - Não conseguimos resolver o nome aqui facilmente
    if (typeof deptField === 'number') {
        return `DEPTO ID ${deptField}`; // Placeholder
    }
    // Valor direto (string)
    if (typeof deptField === 'string') {
         return deptField || "SEM DEPTO";
    }
    // Fallback
    try {
        return deptField.toString();
    } catch {
        return "ERRO_TIPO";
    }
}

/** Tenta analisar JSON, retorna objeto ou null se falhar. */
export function safeJsonParse(str) {
    if (!str || typeof str !== 'string') return null;
    try {
        return JSON.parse(str);
    } catch (e) {
        // console.warn("Falha ao analisar JSON:", e, str); // Opcional: logar falha
        return null;
    }
}

// Adicione outras funções utilitárias que você usa em vários módulos
