// libraries/grist-field-renderer/renderers/render-ref.js
// VERSÃO DE DEPURAÇÃO - TENTATIVA 2

export async function renderRef(options) {
    const { container, colSchema, cellValue, tableLens, isEditing, record } = options;

    if (!container) return;
    
    if (isEditing) {
        container.textContent = "[Modo de Edição]";
        return;
    }
    
    container.innerHTML = '';
    container.style.cssText = 'border: 2px dashed blue; padding: 10px; font-family: monospace; font-size: 12px; white-space: pre-wrap; word-break: break-all; background-color: #f8f8ff;';

    try {
        const debugInfo = {
            TIMESTAMP: new Date().toISOString(),
            MESSAGE: "--- DADOS DE DEPURAÇÃO (TENTATIVA 2) ---",
            INPUT_colSchema: colSchema,
            INPUT_record: record, // Adicionado para ver a tabela de origem
        };

        if (cellValue == null || cellValue <= 0) {
            debugInfo.RESULT = "Valor vazio ou inválido.";
            container.textContent = JSON.stringify(debugInfo, null, 2);
            return;
        }

        const refTableId = colSchema.type.split(':')[1];
        debugInfo.STEP1_refTableId = refTableId;

        // ================== NOVA LÓGICA DE DEPURAÇÃO ==================

        // Passo A: Pegar o schema da tabela de ORIGEM
        const sourceTableId = record.gristHelper_tableId;
        debugInfo.STEP_A_sourceTableId = sourceTableId;
        const sourceSchema = await tableLens.getTableSchema(sourceTableId);
        debugInfo.STEP_A_sourceSchema_All = sourceSchema;

        // Passo B: Procurar a coluna de display helper DENTRO do schema de origem
        const displayColIdNum = colSchema.displayCol;
        debugInfo.STEP_B_lookup_displayCol_ID = displayColIdNum;
        const displayColHelperSchema = Object.values(sourceSchema).find(c => c.id === displayColIdNum);
        debugInfo.STEP_B_found_displayColHelperInfo = displayColHelperSchema || "FALHA: Não encontrou a coluna helper no schema de ORIGEM!";
        
        // Passo C: Extrair o nome da coluna final da fórmula
        let finalColIdToUse = null;
        if (displayColHelperSchema) {
            if (displayColHelperSchema.isFormula && displayColHelperSchema.formula?.includes('.')) {
                const formulaParts = displayColHelperSchema.formula.split('.');
                finalColIdToUse = formulaParts[formulaParts.length - 1];
                debugInfo.STEP_C_extracted_finalColId = finalColIdToUse;
            } else {
                 debugInfo.STEP_C_extraction_result = "A coluna helper encontrada não é uma fórmula de referência.";
            }
        } else {
            debugInfo.STEP_C_extraction_result = "N/A - Não foi possível encontrar a coluna helper.";
        }
        
        debugInfo.FINAL_COL_ID_TO_USE = finalColIdToUse;

        // ================== LÓGICA DE BUSCA DE DADOS ==================
        
        const referencedRecord = await tableLens.fetchRecordById(refTableId, cellValue);
        debugInfo.DATA_referencedRecord = referencedRecord || "ERRO: Registro de destino não encontrado!";

        if (finalColIdToUse && referencedRecord) {
            debugInfo.FINAL_VALUE = referencedRecord[finalColIdToUse] !== undefined ? referencedRecord[finalColIdToUse] : `AVISO: a coluna '${finalColIdToUse}' não tem valor no registro de destino.`;
        } else {
            debugInfo.FINAL_VALUE = "ERRO: Não foi possível determinar o valor final.";
        }

        container.textContent = JSON.stringify(debugInfo, null, 2);

    } catch (error) {
        container.textContent = `ERRO DURANTE A DEPURAÇÃO:\n${error.stack}`;
    }
}