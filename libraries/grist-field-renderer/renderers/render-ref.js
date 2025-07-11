// libraries/grist-field-renderer/renderers/render-ref.js
// VERSÃO DE DEPURAÇÃO

export async function renderRef(options) {
    const { container, colSchema, cellValue, tableLens, isEditing, record } = options;

    if (!container) return;
    
    // O modo de edição não é nosso foco, então o deixamos como está.
    if (isEditing) {
        container.textContent = "[Modo de Edição]";
        return;
    }
    
    // Limpa o container para nosso output de depuração.
    container.innerHTML = '';
    container.style.cssText = 'border: 2px dashed red; padding: 10px; font-family: monospace; font-size: 12px; white-space: pre-wrap; word-break: break-all; background-color: #fff8f8;';

    try {
        const debugInfo = {
            TIMESTAMP: new Date().toISOString(),
            MESSAGE: "--- DADOS DE DEPURAÇÃO PARA RENDER-REF ---",
            INPUT_colSchema: colSchema,
            INPUT_cellValue: cellValue,
        };

        if (cellValue == null || cellValue <= 0) {
            debugInfo.RESULT = "Valor vazio ou inválido, renderização interrompida.";
            container.textContent = JSON.stringify(debugInfo, null, 2);
            return;
        }

        const refTableId = colSchema.type.split(':')[1];
        debugInfo.STEP1_refTableId = refTableId;

        // Buscando os dados necessários
        const [referencedRecord, referencedSchema] = await Promise.all([
            tableLens.fetchRecordById(refTableId, cellValue),
            tableLens.getTableSchema(refTableId)
        ]);

        debugInfo.STEP2_referencedRecord = referencedRecord || "ERRO: Registro não encontrado!";
        debugInfo.STEP3_referencedSchema_All = referencedSchema; // Schema completo

        // Simulando a lógica de _getDisplayColId manualmente para ver cada passo
        debugInfo.STEP4_lookup_displayCol_ID = colSchema.displayCol;
        
        const schemaAsArray = Object.values(referencedSchema);
        const displayColInfo = schemaAsArray.find(c => c && c.id === colSchema.displayCol);
        
        debugInfo.STEP5_found_displayColInfo = displayColInfo || "FALHA: Não encontrou a coluna de display no schema!";

        let finalColIdToUse = null;
        if (displayColInfo) {
            // Tentando a lógica de "desembrulhar" a fórmula
            if (displayColInfo.isFormula && displayColInfo.formula?.includes('.')) {
                const formulaParts = displayColInfo.formula.split('.');
                const extracted = formulaParts[formulaParts.length - 1];
                debugInfo.STEP6_formula_extraction = `Extraído '${extracted}' da fórmula '${displayColInfo.formula}'.`;
                
                // Verificação de segurança
                if (referencedSchema[extracted]) {
                    finalColIdToUse = extracted;
                    debugInfo.STEP7_finalColId_from_Formula = finalColIdToUse;
                } else {
                    debugInfo.STEP7_finalColId_from_Formula = `ERRO: A coluna extraída '${extracted}' não existe no schema!`;
                    finalColIdToUse = displayColInfo.colId; // Fallback para a própria coluna helper
                }
            } else {
                finalColIdToUse = displayColInfo.colId;
                debugInfo.STEP6_formula_extraction = "Não é uma fórmula de referência, usando o colId direto.";
                debugInfo.STEP7_finalColId_direct = finalColIdToUse;
            }
        } else {
             debugInfo.STEP6_formula_extraction = "N/A - Não foi possível encontrar a coluna de display.";
        }
        
        debugInfo.FINAL_COL_ID_TO_USE = finalColIdToUse;

        if (finalColIdToUse && referencedRecord) {
            debugInfo.FINAL_VALUE = referencedRecord[finalColIdToUse] || `AVISO: a coluna '${finalColIdToUse}' não tem valor no registro.`;
        } else {
            debugInfo.FINAL_VALUE = "ERRO: Não foi possível determinar o valor final.";
        }

        container.textContent = JSON.stringify(debugInfo, null, 2);

    } catch (error) {
        container.textContent = `ERRO DURANTE A DEPURAÇÃO:\n${error.stack}`;
    }
}