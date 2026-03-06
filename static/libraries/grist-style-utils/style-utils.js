// --- START OF CORRECTED style-utils.js ---

window.GristStyleUtils = (() => {

    /**
     * Calcula o estilo dinâmico de um campo com base no schema e no registro.
     * Respeita a hierarquia de prioridade do Grist.
     */
    function getDynamicStyle(record, colSchema) {
        const style = {
            backgroundColor: '',
            color: '',
            fontWeight: '',
            fontStyle: '',
            textAlign: ''
        };

        if (!record || !colSchema) {
            return style;
        }

        const wopts = colSchema.widgetOptions ? 
            (typeof colSchema.widgetOptions === 'string' ? JSON.parse(colSchema.widgetOptions) : colSchema.widgetOptions) : {};

        // NÍVEL 1: Formatação Condicional
        if (colSchema.conditionalFormattingRules?.length > 0) {
            for (const rule of colSchema.conditionalFormattingRules) {
                if (record[rule.helperColumnId] === true) {
                    const ruleStyle = rule.style || {};
                    if (ruleStyle.textColor) style.color = ruleStyle.textColor;
                    if (ruleStyle.fillColor) style.backgroundColor = ruleStyle.fillColor;
                    if (ruleStyle.fontBold) style.fontWeight = 'bold';
                    if (ruleStyle.fontItalic) style.fontStyle = 'italic';
                    return style;
                }
            }
        }

        // NÍVEL 2: Cor da Opção (para Choice e ChoiceList)
        const type = colSchema.type || '';
        if ((type === 'Choice' || type === 'ChoiceList') && wopts.choices?.length > 0) {
            const cellValue = record[colSchema.colId];
            const valueToFind = Array.isArray(cellValue) ? cellValue[1] : cellValue;
            const choice = wopts.choices.find(c => c.value === valueToFind);
            if (choice?.fillColor) style.backgroundColor = choice.fillColor;
            if (choice?.textColor) style.color = choice.textColor;
        }

        // NÍVEL 3: Formatação fixa da célula
        if (wopts.alignment) style.textAlign = wopts.alignment;
        if (!style.backgroundColor && wopts.fillColor) style.backgroundColor = wopts.fillColor;
        if (!style.color && wopts.textColor) style.color = wopts.textColor;
        if (wopts.fontBold) style.fontWeight = 'bold';
        
        return style;
    }

    // Expõe a função para o mundo exterior
    return {
        getDynamicStyle
    };

})();

// --- END OF CORRECTED style-utils.js ---