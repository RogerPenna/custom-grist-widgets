// libraries/grist-field-renderer/grist-field-renderer.js

/**
 * Applies Grist-like styling, now including Choice-specific styles.
 * @private
 */
function _applyStyles(element, colSchema, record, ruleIdToColIdMap) {
    element.style.color = ''; element.style.backgroundColor = ''; element.style.fontWeight = '';
    element.style.fontStyle = ''; element.style.textAlign = '';

    const wopts = JSON.parse(colSchema.widgetOptions || '{}');
    if (wopts.alignment) { element.style.textAlign = wopts.alignment; }

    let styleAppliedByRule = false;
    // 1. Conditional Formatting has the highest priority.
    if (colSchema.rules && Array.isArray(colSchema.rules) && colSchema.rules[0] === 'L') {
        const ruleOptions = wopts.rulesOptions || [];
        const ruleIdList = colSchema.rules.slice(1);
        for (let i = 0; i < ruleIdList.length; i++) {
            const ruleNumId = ruleIdList[i];
            const helperColId = ruleIdToColIdMap.get(ruleNumId);
            if (helperColId && record[helperColId] === true) {
                const style = ruleOptions[i];
                if (style) {
                     if (style.textColor) element.style.color = style.textColor;
                     if (style.fillColor) element.style.backgroundColor = style.fillColor;
                     if (style.fontBold) element.style.fontWeight = 'bold';
                     if (style.fontItalic) element.style.fontStyle = 'italic';
                }
                styleAppliedByRule = true;
                break;
            }
        }
    }
    
    // 2. If no rule, check for Choice-specific styling.
    const cellValue = record[colSchema.colId];
    if (!styleAppliedByRule && (colSchema.type === 'Choice') && wopts.choiceOptions) {
        const choiceStyle = wopts.choiceOptions[cellValue];
        if (choiceStyle) {
            if (choiceStyle.textColor) element.style.color = choiceStyle.textColor;
            if (choiceStyle.fillColor) element.style.backgroundColor = choiceStyle.fillColor;
        }
    }
}

/**
 * Renders an inline table for RefList records. This is now corrected to work in the drawer.
 * @private
 */
async function _renderRelatedTable(container, relatedRecords, tableLens, ruleIdToColIdMap) {
    if (!relatedRecords || relatedRecords.length === 0) return;
    
    // Clear the placeholder text e.g., "[RefList] (2 items)"
    container.innerHTML = '';
    
    const subTable = document.createElement('table');
    const subThead = subTable.createTHead(); const subThRow = subThead.insertRow();
    
    const relatedTableId = relatedRecords[0].gristHelper_tableId;
    const relatedSchema = await tableLens.getTableSchema(relatedTableId, {mode: 'raw'});

    const visibleCols = relatedSchema.filter(c => c.visibleCol > 0 && !c.colId.startsWith('gristHelper_'));
    const colsToDisplay = visibleCols.length > 0 ? visibleCols : relatedSchema.filter(c => !c.colId.startsWith('gristHelper_')).slice(0, 4);

    colsToDisplay.forEach(col => { const th = document.createElement('th'); th.textContent = col.label || col.colId; subThRow.appendChild(th); });

    const subTbody = subTable.createTBody();
    for (const relRec of relatedRecords) {
        const subTr = subTbody.insertRow();
        colsToDisplay.forEach(colSchema => {
            const td = subTr.insertCell();
            // This is the key fix: We recursively call the main renderField function.
            // This ensures that nested fields (like a Ref inside the sub-table) are also rendered correctly.
            renderField({ container: td, colSchema, record: relRec, tableLens, ruleIdToColIdMap });
        });
    }
    container.appendChild(subTable);
}


/**
 * The main exported function. Renders a single field into a container.
 */
export async function renderField(options) {
    const { container, colSchema, record, tableLens, ruleIdToColIdMap, displayAs } = options;
    const cellValue = record[colSchema.colId];
    container.innerHTML = ''; 

    const content = document.createElement('div');
    const wopts = JSON.parse(colSchema.widgetOptions || '{}');

    if (cellValue === null || cellValue === undefined) {
        content.textContent = '(vazio)';
    } 
    else if (colSchema.type.startsWith('RefList:')) {
        let count = Array.isArray(cellValue) && cellValue[0] === 'L' ? cellValue.length - 1 : 0;
        content.textContent = `[RefList] (${count} items)`;
        const relatedRecords = await tableLens.fetchRelatedRecords(record, colSchema.colId);
        if (relatedRecords.length > 0) {
            await _renderRelatedTable(content, relatedRecords, tableLens, ruleIdToColIdMap);
        }
    }
    else if (colSchema.type.startsWith('Ref:')) {
        const { displayValue } = await tableLens.resolveReference(colSchema, record);
        content.textContent = displayValue;
    }
    else if (colSchema.type === 'ChoiceList') {
        if (Array.isArray(cellValue) && cellValue[0] === 'L') {
            cellValue.slice(1).forEach(val => {
                const pill = document.createElement('span');
                pill.style.cssText = 'display: inline-block; padding: 2px 8px; margin: 2px; border-radius: 12px;';
                pill.textContent = val;
                // **THE FIX**: Apply styles to each pill based on its value.
                const choiceStyle = wopts.choiceOptions?.[val];
                if (choiceStyle) {
                    pill.style.color = choiceStyle.textColor || '#000';
                    pill.style.backgroundColor = choiceStyle.fillColor || '#e0e0e0';
                } else {
                    pill.style.backgroundColor = '#e0e0e0';
                }
                content.appendChild(pill);
            });
        }
    }
    else if (colSchema.type.startsWith('Date')) {
        const date = new Date(cellValue * 1000);
        content.textContent = colSchema.type === 'DateTime' ? date.toLocaleString() : date.toLocaleDateString();
    } 
    else if (colSchema.type === 'Bool') {
        if (displayAs === 'switch') {
            content.innerHTML = `<label class="switch"><input type="checkbox" ${cellValue ? 'checked' : ''} disabled><span class="slider round"></span></label>`;
        } else { // Default to checkmark
            content.textContent = cellValue ? '✓' : '☐';
            content.style.fontSize = '1.2em';
        }
    }
    else if (colSchema.type === 'Numeric' || colSchema.type === 'Int') {
        if (wopts.numMode === 'currency') {
            // A more robust implementation would get currency from options.
            content.textContent = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(cellValue);
        } else {
            content.textContent = Number(cellValue).toFixed(wopts.decimals || 2);
        }
    }
    else if (wopts.widget === 'Markdown') {
        let html = String(cellValue).replace(/</g, '<').replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>').replace(/\*(.*?)\*/g, '<em>$1</em>').replace(/\n/g, '<br>');
        content.innerHTML = html;
    }
    else {
        content.textContent = String(cellValue);
    }

    container.appendChild(content);
    _applyStyles(container, colSchema, record, ruleIdToColIdMap);
}