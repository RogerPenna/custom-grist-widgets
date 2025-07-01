// libraries/grist-field-renderer/grist-field-renderer.js

// This file contains comprehensive logic for rendering various Grist field types.

/**
 * Applies Grist-like styling to an HTML element based on column schema and record data.
 * This now includes support for Choice styling.
 * @private
 */
function _applyStyles(element, colSchema, record, ruleIdToColIdMap) {
    element.style.color = ''; element.style.backgroundColor = ''; element.style.fontWeight = '';
    element.style.fontStyle = ''; element.style.textAlign = '';

    const wopts = JSON.parse(colSchema.widgetOptions || '{}');
    if (wopts.alignment) { element.style.textAlign = wopts.alignment; }

    let styleAppliedByRule = false;
    // 1. Apply Conditional Formatting Rules first, as they have top priority.
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
    
    // 2. If no rule was applied, check for Choice-specific styling.
    const cellValue = record[colSchema.colId];
    if (!styleAppliedByRule && (colSchema.type === 'Choice' || colSchema.type === 'ChoiceList') && wopts.choiceOptions) {
        const choiceStyle = wopts.choiceOptions[cellValue];
        if (choiceStyle) {
            if (choiceStyle.textColor) element.style.color = choiceStyle.textColor;
            if (choiceStyle.fillColor) element.style.backgroundColor = choiceStyle.fillColor;
            if (choiceStyle.fontBold) element.style.fontWeight = 'bold';
            if (choiceStyle.fontItalic) element.style.fontStyle = 'italic';
            styleAppliedByRule = true;
        }
    }

    // 3. If still no style, apply default column style.
    if (!styleAppliedByRule) {
        if (wopts.textColor) element.style.color = wopts.textColor;
        if (wopts.fillColor) element.style.backgroundColor = wopts.fillColor;
        if (wopts.fontBold) element.style.fontWeight = 'bold';
        if (wopts.fontItalic) element.style.fontStyle = 'italic';
    }
}

/**
 * Renders an inline table for RefList records.
 * @private
 */
async function _renderRelatedTable(container, relatedRecords, tableLens, ruleIdToColIdMap) {
    if (!relatedRecords || relatedRecords.length === 0) return;

    // Remove the placeholder text e.g., "[RefList] (2 items)"
    while (container.firstChild) {
        container.removeChild(container.firstChild);
    }
    
    const subTable = document.createElement('table');
    const subThead = subTable.createTHead(); const subThRow = subThead.insertRow();
    
    const relatedTableId = relatedRecords[0].gristHelper_tableId;
    const relatedSchema = await tableLens.getTableSchema(relatedTableId, {mode: 'raw'});

    const visibleCols = relatedSchema.filter(c => c.visibleCol > 0 && !c.colId.startsWith('gristHelper_'));
    // If no columns are "visible", show the first few as a fallback.
    const colsToDisplay = visibleCols.length > 0 ? visibleCols : relatedSchema.filter(c => !c.colId.startsWith('gristHelper_')).slice(0, 4);

    colsToDisplay.forEach(col => { const th = document.createElement('th'); th.textContent = col.label || col.colId; subThRow.appendChild(th); });

    const subTbody = subTable.createTBody();
    for (const relRec of relatedRecords) {
        const subTr = subTbody.insertRow();
        colsToDisplay.forEach(colSchema => {
            const td = subTr.insertCell();
            // Recursively call the main renderField function for sub-cells!
            renderField({ container: td, colSchema, record: relRec, tableLens, ruleIdToColIdMap });
        });
    }
    container.appendChild(subTable);
}


/**
 * The main exported function. Renders a single field into a container.
 */
export async function renderField(options) {
    const { container, colSchema, record, tableLens, ruleIdToColIdMap } = options;
    const cellValue = record[colSchema.colId];
    container.innerHTML = ''; 

    const content = document.createElement('div');
    const wopts = JSON.parse(colSchema.widgetOptions || '{}');

    if (cellValue === null || cellValue === undefined) {
        content.textContent = '(vazio)';
    } 
    else if (colSchema.type.startsWith('RefList:')) {
        const count = Array.isArray(cellValue) && cellValue[0] === 'L' ? cellValue.length - 1 : 0;
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
                pill.className = 'choice-pill';
                pill.textContent = val;
                pill.style.cssText = 'display: inline-block; padding: 2px 8px; margin: 2px; border-radius: 12px; background-color: #e0e0e0;';
                
                // Apply specific styling for this choice value
                const choiceStyle = wopts.choiceOptions?.[val];
                if (choiceStyle) {
                    if (choiceStyle.textColor) pill.style.color = choiceStyle.textColor;
                    if (choiceStyle.fillColor) pill.style.backgroundColor = choiceStyle.fillColor;
                }
                content.appendChild(pill);
            });
        } else {
            content.textContent = String(cellValue);
        }
    }
    else if (colSchema.type.startsWith('Date')) {
        const date = new Date(cellValue * 1000);
        content.textContent = colSchema.type === 'DateTime' ? date.toLocaleString() : date.toLocaleDateString();
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