// js/config.js

// Nomes EXATOS das tabelas como aparecem no Grist (case-sensitive!)
export const PRIMARY_TABLE_NAME = "Riscos";
export const ANALYSIS_TABLE_NAME = "Analise_Risco";
// Nomes de colunas importantes (ajuste conforme sua estrutura)
export const ANALYSIS_INDICATOR_COLUMN = "Ultima_Analise"; // Coluna em Riscos para indicador (S/N)
export const RISK_NAME_COLUMN = "NomeRisco"; // Coluna com o nome/título do Risco
export const RISK_DEPT_COLUMN = "Departamento"; // Coluna de Departamento em Riscos
export const RISK_PROB_COLUMN = "ultprob"; // Coluna com última prob numérica em Riscos
export const RISK_IMPACT_COLUMN = "ultimpac"; // Coluna com último impacto numérico em Riscos
export const RISK_IDRISCO_COLUMN = "IDRisco"; // Coluna de ID visível (ex: RSK-0001)
export const ANALYSIS_DATE_COLUMN = "DataAnalise"; // Coluna de data em Analise_Risco
// Outras colunas que você usa frequentemente...

// Configurações da Matriz
export const MATRIX_MAX_VALUE = 5;

// Limites para cores de Próxima Análise (em dias)
export const PROX_ANALISE_LIMITS = {
    VERDE: 31,   // Acima de 30 dias
    AMARELO: 1,  // De 1 a 30 dias
    LARANJA: -29,// De 0 a -29 dias (atrasado)
    VERMELHO: -30 // -30 dias ou mais atrasado
};

// Adicione outras configurações que possam variar
