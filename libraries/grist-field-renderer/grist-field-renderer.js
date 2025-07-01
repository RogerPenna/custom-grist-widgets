// libraries/grist-field-renderer/grist-field-renderer.js

// This file now contains comprehensive logic for rendering various Grist field types.

/**
 * Applies Grist-like styling to an HTML element based on column schema and record data.
 * @private
 */
function _applyStyles(element, colSchema, record, ruleIdToColIdMap) {
    // ... This function is already correct and does not need changes.
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
                break;
            }
        }
    }
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
    // ... This function is also correct and does not need changes.
    if (!relatedRecords || relatedRecords.length === 0) return;
    const subTable = document.createElement('table');
    const subThead = subTable.createTHead(); const subThRow = subThead.insertRow();
    const relatedTableId = relatedRecords[0].gristHelper_tableId;
    const relatedSchema = await tableLens.getTableSchema(relatedTableId, {mode: 'raw'});
    relatedSchema.filter(c => !c.colId.startsWith('gristHelper_')).forEach(col => { const th = document.createElement('th'); th.textContent = col.label || col.colId; subThRow.appendChild(th); });
    const subTbody = subTable.createTBody();
    for (const relRec of relatedRecords) {
        const subTr = subTbody.insertRow();
        relatedSchema.filter(c => !c.colId.startsWith('gristHelper_')).forEach(colSchema => {
            const td = subTr.insertCell();
            renderField({ container: td, colSchema, record: relRec, tableLens, ruleIdToColIdMap });
        });
    }
    container.appendChild(subTable);
}

/**
 * The main exported function. Renders a single field into a container.
 * This function is now heavily upgraded.
 */
export async function renderField(options) {
    const { container, colSchema, record, tableLens, ruleIdToColIdMap, displayAs } = options;
    const cellValue = record[colSchema.colId];
    container.innerHTML = ''; // Clear previous content

    const content = document.createElement('div');
    content.className = 'grist-field-content';
    const wopts = JSON.parse(colSchema.widgetOptions || '{}');

    // Main logic switch based on column type
    if (cellValue === null || cellValue === undefined) {
        content.textContent = '(vazio)';
        content.style.fontStyle = 'italic';
        content.style.color = '#999';
    } 
    // =========================================================
    // =========== FEATURE: Handle RefList and ChoiceList ========
    // =========================================================
    else if (colSchema.type.startsWith('RefList:')) {
        let count = Array.isArray(cellValue) && cellValue[0] === 'L' ? cellValue.length - 1 : 0;
        let displayText = document.createElement('span');
        displayText.textContent = `[RefList] (${count} items)`;
        content.appendChild(displayText);
        const relatedRecords = await tableLens.fetchRelatedRecords(record, colSchema.colId);
        if (relatedRecords.length > 0) {
            await _renderRelatedTable(content, relatedRecords, tableLens, ruleIdToColIdMap);
        }
    } else if (colSchema.type === 'ChoiceList') {
        if (Array.isArray(cellValue) && cellValue[0] === 'L') {
            // Render as a list of styled pills/tags
            cellValue.slice(1).forEach(val => {
                const pill = document.createElement('span');
                pill.className = 'choice-pill';
                pill.textContent = val;
                pill.style.display = 'inline-block';
                pill.style.padding = '2px 8px';
                pill.style.margin = '2px';
                pill.style.borderRadius = '12px';
                pill.style.backgroundColor = '#e0e0e0';
                content.appendChild(pill);
            });
        } else {
            content.textContent = String(cellValue);
        }
    }
    // =========================================================
    // ============= FEATURE: Handle Single Reference ==========
    // =========================================================
    else if (colSchema.type.startsWith('Ref:')) {
        const referencedTableId = colSchema.type.split(':')[1];
        const referencedRecord = await tableLens.fetchRecordById(referencedTableId, cellValue);
        if (referencedRecord) {
            // Find the display column configured in Grist. This is complex.
            // The `displayCol` property on the Ref column contains the NUMERIC ID of the display column.
            const referencedSchema = await tableLens.getTableSchema(referencedTableId, {mode: 'raw'});
            const displayColSchema = referencedSchema.find(c => c.id === colSchema.displayCol);
            
            if (displayColSchema) {
                content.textContent = referencedRecord[displayColSchema.colId];
            } else {
                content.textContent = `[Ref: ${cellValue}]`; // Fallback
            }
        } else {
            content.textContent = `[Ref not found: ${cellValue}]`;
        }
    } 
    // =========================================================
    // ============= FEATURE: Handle Date and DateTime =========
    // =========================================================
    else if (colSchema.type.startsWith('Date')) {
        // Grist timestamps are in seconds, JavaScript Date needs milliseconds.
        const date = new Date(cellValue * 1000);
        if (colSchema.type === 'DateTime') {
            content.textContent = date.toLocaleString(); // e.g., "5/23/2026, 6:05:00 PM"
        } else {
            content.textContent = date.toLocaleDateString(); // e.g., "5/23/2026"
        }
    } 
    // =========================================================
    // ============== FEATURE: Handle Markdown =================
    // =========================================================
    else if (wopts.widget === 'Markdown') {
        // WARNING: Using innerHTML directly from user content is a security risk (XSS).
        // A real production app MUST use a sanitizing Markdown library like DOMPurify + Marked.
        // For this trusted environment, we'll proceed with a simple placeholder.
        console.warn("Rendering Markdown with innerHTML. Use a sanitizer in production.");
        // A very basic Markdown->HTML
        let html = String(cellValue)
            .replace(/</g, '<')
            .replace(/>/g, '>')
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
            .replace(/\*(.*?)\*/g, '<em>$1</em>')
            .replace(/\n/g, '<br>');
        content.innerHTML = html;
    }
    else {
        // Default for Text, Numeric, Choice, Int, Bool, etc.
        content.textContent = String(cellValue);
    }

    container.appendChild(content);

    // Apply all styling at the end.
    _applyStyles(container, colSchema, record, ruleIdToColIdMap);
}