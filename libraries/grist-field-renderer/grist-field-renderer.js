// libraries/grist-field-renderer/grist-field-renderer.js

/**
 * Applies Grist-like styling to an HTML element based on column schema and record data.
 * @private
 */
function _applyStyles(element, colSchema, record, ruleIdToColIdMap) {
    element.style.color = ''; element.style.backgroundColor = ''; element.style.fontWeight = '';
    element.style.fontStyle = ''; element.style.textAlign = '';

    const wopts = JSON.parse(colSchema.widgetOptions || '{}');
    if (wopts.alignment) { element.style.textAlign = wopts.alignment; }

    let styleAppliedByRule = false;
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
                break; // Apply first matching rule and stop.
            }
        }
    }
    
    // Apply default column style only if no conditional rule was applied.
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

    const subTable = document.createElement('table');
    const subThead = subTable.createTHead();
    const subThRow = subThead.insertRow();
    
    const relatedTableId = relatedRecords[0].gristHelper_tableId;
    const relatedSchema = await tableLens.getTableSchema(relatedTableId, {mode: 'raw'});

    relatedSchema
        .filter(c => !c.colId.startsWith('gristHelper_')) // Don't show helpers in sub-tables
        .forEach(col => {
            const th = document.createElement('th');
            th.textContent = col.label || col.colId;
            subThRow.appendChild(th);
        });

    const subTbody = subTable.createTBody();
    for (const relRec of relatedRecords) {
        const subTr = subTbody.insertRow();
        relatedSchema
            .filter(c => !c.colId.startsWith('gristHelper_'))
            .forEach(colSchema => {
                const td = subTr.insertCell();
                // Recursively call the main renderField function for sub-cells!
                // This allows for nested formatting and complex displays.
                renderField({
                    container: td,
                    colSchema: colSchema,
                    record: relRec,
                    tableLens: tableLens,
                    ruleIdToColIdMap: ruleIdToColIdMap
                });
            });
    }
    container.appendChild(subTable);
}


/**
 * The main exported function. Renders a single field into a container.
 * @param {object} options - The configuration for rendering.
 * @param {HTMLElement} options.container - The HTML element to render into.
 * @param {object} options.colSchema - The RAW schema object for the column.
 * @param {object} options.record - The full data record object for the row (must include helpers).
 * @param {GristTableLens} options.tableLens - An instance of the GristTableLens library.
 * @param {Map<number, string>} options.ruleIdToColIdMap - A pre-calculated map of rule IDs to column IDs.
 * @param {string} [options.displayAs] - Optional: 'radio', 'dropdown', etc., for specific renderings.
 */
export async function renderField(options) {
    const { container, colSchema, record, tableLens, ruleIdToColIdMap, displayAs } = options;
    const cellValue = record[colSchema.colId];
    container.innerHTML = ''; // Clear previous content

    let content = document.createElement('div');
    content.className = 'grist-field-content';

    // Main logic switch based on column type
    if (cellValue === null || cellValue === undefined) {
        content.textContent = '(vazio)';
        content.style.fontStyle = 'italic';
        content.style.color = '#999';
    } else if (colSchema.type.startsWith('RefList:')) {
        let count = Array.isArray(cellValue) && cellValue[0] === 'L' ? cellValue.length - 1 : 0;
        let displayText = document.createElement('span');
        displayText.textContent = `[RefList] (${count} items)`;
        content.appendChild(displayText);
        const relatedRecords = await tableLens.fetchRelatedRecords(record, colSchema.colId);
        if (relatedRecords.length > 0) {
            await _renderRelatedTable(content, relatedRecords, tableLens, ruleIdToColIdMap);
        }
    } else if (colSchema.type.startsWith('Ref:')) {
        const wopts = JSON.parse(colSchema.widgetOptions || '{}');
        const displayColId = wopts.displayCol; // This is the numeric ID
        // To properly render a Ref, we would need to fetch the related record and its display column value.
        // For simplicity in this example, we'll just show the ID. A full implementation would do a fetch here.
        content.textContent = `[Ref: ${cellValue}]`;
    } else if (colSchema.type === 'Date' || colSchema.type === 'DateTime') {
        const date = new Date(cellValue * 1000);
        const wopts = JSON.parse(colSchema.widgetOptions || '{}');
        const dateFormat = wopts.dateFormat || 'YYYY-MM-DD';
        // A full implementation would have a robust date formatting library here.
        content.textContent = date.toISOString().split('T')[0]; // Simple ISO date for now.
    } else if (colSchema.type === 'Bool') {
        content.textContent = cellValue ? '✓' : '☐';
        content.style.fontFamily = 'monospace';
    } else if (colSchema.type === 'Choice' && displayAs === 'radio') {
        // Example of the "displayAs" feature
        const wopts = JSON.parse(colSchema.widgetOptions || '{}');
        (wopts.choices || []).forEach(choice => {
            const label = document.createElement('label');
            const radio = document.createElement('input');
            radio.type = 'radio';
            radio.name = colSchema.colId + record.id;
            radio.value = choice;
            radio.checked = (cellValue === choice);
            radio.disabled = true; // Read-only view
            label.appendChild(radio);
            label.appendChild(document.createTextNode(' ' + choice));
            content.appendChild(label);
            content.appendChild(document.createElement('br'));
        });
    }
    else {
        // Default for Text, Numeric, Choice, Int, etc.
        content.textContent = String(cellValue);
    }

    container.appendChild(content);

    // Apply all styling at the end.
    _applyStyles(container, colSchema, record, ruleIdToColIdMap);
}