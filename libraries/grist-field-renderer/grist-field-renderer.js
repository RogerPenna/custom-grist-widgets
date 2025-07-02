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

    const subTable = document.createElement('table');
    const subThead = subTable.createTHead();
    const subThRow = subThead.insertRow();
    
    const relatedTableId = relatedRecords[0].gristHelper_tableId;
    const relatedSchema = await tableLens.getTableSchema(relatedTableId, {mode: 'raw'});

    const columnsToDisplay = relatedSchema.filter(c => !c.colId.startsWith('gristHelper_'));

    columnsToDisplay.forEach(col => {
        const th = document.createElement('th');
        th.textContent = col.label || col.colId;
        subThRow.appendChild(th);
    });

    const subTbody = subTable.createTBody();
    for (const relRec of relatedRecords) {
        const subTr = subTbody.insertRow();
        for (const colSchema of columnsToDisplay) { // <-- Use the filtered list here
            const td = subTr.insertCell();
            // Call renderField for each cell to get full rendering capabilities
            renderField({
                container: td,
                colSchema: colSchema,
                record: relRec,
                tableLens: tableLens,
                ruleIdToColIdMap: ruleIdToColIdMap
            });
        }
    }
    // Clear the container before adding the table
    container.innerHTML = '';
    container.appendChild(subTable);
}


/**
 * The main exported function. Renders a single field into a container.
 */
export async function renderField(options) {
    const { container, colSchema, record, tableLens, ruleIdToColIdMap, isEditing = false } = options;
    const cellValue = record ? record[colSchema.colId] : ''; // Handle empty record for "Add"
    container.innerHTML = '';
    
    // If NOT editing, use the read-only logic
    if (!isEditing) {
        const content = document.createElement('div');
        // ... (insert the full read-only rendering logic from my previous response here)
        // ... It handles RefList, Date, Markdown, etc.
        if (cellValue === null || cellValue === undefined) { content.textContent = '(vazio)'; content.style.fontStyle = 'italic'; }
        else if (colSchema.type.startsWith('RefList:')) {
            const count = Array.isArray(cellValue) && cellValue[0] === 'L' ? cellValue.length - 1 : 0;
            content.textContent = `[RefList] (${count} items)`;
            const relatedRecords = await tableLens.fetchRelatedRecords(record, colSchema.colId);
            if (relatedRecords.length > 0) { await _renderRelatedTable(content, relatedRecords, tableLens, ruleIdToColIdMap); }
        }
        else { content.textContent = String(cellValue); }
        container.appendChild(content);
        _applyStyles(container, colSchema, record, ruleIdToColIdMap);
        return;
    }

    // --- If we ARE editing, render form elements ---
    let input;
    switch (colSchema.type) {
        case 'Bool':
            input = document.createElement('input');
            input.type = 'checkbox';
            input.checked = !!cellValue;
            break;
        case 'Date':
            input = document.createElement('input');
            input.type = 'date';
            if (cellValue) {
                input.value = new Date(cellValue * 1000).toISOString().split('T')[0];
            }
            break;
        case 'Choice':
            input = document.createElement('select');
            const wopts = JSON.parse(colSchema.widgetOptions || '{}');
            (wopts.choices || []).forEach(choice => {
                const option = document.createElement('option');
                option.value = choice;
                option.textContent = choice;
                if (cellValue === choice) option.selected = true;
                input.appendChild(option);
            });
            break;
        // Add more cases for Int, Numeric, Text, etc.
        default:
            input = document.createElement('input');
            input.type = 'text';
            input.value = (cellValue === null || cellValue === undefined) ? '' : String(cellValue);
    }
    
    input.dataset.colId = colSchema.colId; // Crucial for retrieving the value
    input.style.width = '100%';
    input.style.padding = '8px';
    input.style.fontSize = '1em';
    input.style.boxSizing = 'border-box';
    container.appendChild(input);
}