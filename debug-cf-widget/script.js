import { GristTableLens } from '../libraries/grist-table-lens/grist-table-lens.js';

document.addEventListener('DOMContentLoaded', async function () {
    const tableSelector = document.getElementById('tableSelector');
    const fieldSelector = document.getElementById('fieldSelector');
    const loadingMessage = document.getElementById('loadingMessage');
    const resultsContainer = document.getElementById('resultsContainer');
    const resultsTable = document.getElementById('resultsTable');
    const resultsThead = resultsTable.querySelector('thead tr');
    const resultsTbody = resultsTable.querySelector('tbody');
    const errorMessage = document.getElementById('errorMessage');

    const tableLens = new GristTableLens(grist);

    async function initialize() {
        try {
            loadingMessage.style.display = 'block';
            errorMessage.textContent = '';

            const tables = await tableLens.listAllTables();
            tableSelector.innerHTML = '<option value="">Select a table</option>';
            for (const table of tables) {
                const option = new Option(table.id, table.id);
                tableSelector.appendChild(option);
            }

            loadingMessage.style.display = 'none';
        } catch (error) {
            errorMessage.textContent = `Error initializing widget: ${error.message}`;
            loadingMessage.style.display = 'none';
        }
    }

    tableSelector.addEventListener('change', async () => {
        const tableId = tableSelector.value;
        if (!tableId) {
            fieldSelector.innerHTML = '';
            resultsContainer.style.display = 'none';
            return;
        }

        try {
            loadingMessage.style.display = 'block';
            errorMessage.textContent = '';

            const schema = await tableLens.getTableSchema(tableId);
            fieldSelector.innerHTML = '<option value="">Select a field</option>';
            for (const colId in schema) {
                const col = schema[colId];
                const option = new Option(`${col.label} (${col.colId})`, col.colId);
                fieldSelector.appendChild(option);
            }

            loadingMessage.style.display = 'none';
        } catch (error) {
            errorMessage.textContent = `Error loading table schema: ${error.message}`;
            loadingMessage.style.display = 'none';
        }
    });

    fieldSelector.addEventListener('change', async () => {
        const tableId = tableSelector.value;
        const fieldId = fieldSelector.value;

        if (!tableId || !fieldId) {
            resultsContainer.style.display = 'none';
            return;
        }

        try {
            loadingMessage.style.display = 'block';
            errorMessage.textContent = '';


            const [records, schema] = await Promise.all([
                tableLens.fetchTableRecords(tableId),
                tableLens.getTableSchema(tableId)
            ]);

            const colSchema = schema[fieldId];
            const conditionalFormattingRules = colSchema.conditionalFormattingRules || [];
            const rulesOptions = colSchema.widgetOptions?.rulesOptions || [];

            const schemaDisplay = document.getElementById('schema-display');
            schemaDisplay.textContent = JSON.stringify(colSchema, null, 2);

            resultsThead.innerHTML = '';
            resultsTbody.innerHTML = '';

            const headers = ['Record ID', fieldId];
            for (const cfRule of conditionalFormattingRules) {
                headers.push(`${cfRule.helperColumnId}`);
            }
            headers.push('CSV');
            headers.push('Applied Colors (Grist)');

            for (const header of headers) {
                const th = document.createElement('th');
                th.textContent = header;
                resultsThead.appendChild(th);
            }

            const rules = colSchema.rules.slice(1).map(String);

            for (const record of records) {
                const tr = document.createElement('tr');
                const recordIdTd = document.createElement('td');
                recordIdTd.textContent = record.id;
                tr.appendChild(recordIdTd);

                const fieldTd = document.createElement('td');
                fieldTd.textContent = record[fieldId];
                tr.appendChild(fieldTd);

                for (const cfRule of conditionalFormattingRules) {
                    const td = document.createElement('td');
                    const helperColId = cfRule.helperColumnId;
                    const ruleIndex = rules.indexOf(cfRule.id);
                    const style = rulesOptions[ruleIndex] || {};
                    const textColor = style.textColor || '#000000';
                    const fillColor = style.fillColor || '#FFFFFF';
                    const value = record[helperColId];
                    td.textContent = `Value: ${value}, Formula: ${cfRule.conditionFormula}, Text: ${textColor}, Fill: ${fillColor}`;
                    td.style.backgroundColor = fillColor;
                    td.style.color = textColor;
                    tr.appendChild(td);
                }

                let appliedTextColor = '#000000'; // Default text color
                let appliedFillColor = '#FFFFFF'; // Default fill color

                // Iterate through rules in reverse to find the last matching one
                for (let i = conditionalFormattingRules.length - 1; i >= 0; i--) {
                    const cfRule = conditionalFormattingRules[i];
                    const helperColId = cfRule.helperColumnId;
                    const value = record[helperColId]; // This is the 'Value' from the CSV

                    if (value === true) { // If this rule's condition is met
                        const ruleIndex = rules.indexOf(cfRule.id);
                        const style = rulesOptions[ruleIndex] || {};
                        appliedTextColor = style.textColor || '#000000';
                        appliedFillColor = style.fillColor || '#FFFFFF';
                        break; // Found the last matching rule, so stop
                    }
                }

                const csvTd = document.createElement('td');
                const rowData = [];
                for (const cell of tr.cells) {
                    rowData.push(cell.textContent);
                }
                const csvRow = rowData.join(',');
                csvTd.textContent = csvRow;

                const copyButton = document.createElement('button');
                copyButton.textContent = 'Copy';
                copyButton.onclick = () => {
                    const textArea = document.createElement('textarea');
                    textArea.value = csvRow;
                    document.body.appendChild(textArea);
                    textArea.select();
                    document.execCommand('copy');
                    document.body.removeChild(textArea);

                    const originalText = copyButton.textContent;
                    copyButton.textContent = originalText;
                    setTimeout(() => {
                        copyButton.textContent = originalText;
                    }, 1000);
                };
                csvTd.appendChild(copyButton);
                tr.appendChild(csvTd);

                const appliedColorsTd = document.createElement('td');
                appliedColorsTd.textContent = `Text: ${appliedTextColor}, Fill: ${appliedFillColor}`;
                appliedColorsTd.style.backgroundColor = appliedFillColor;
                appliedColorsTd.style.color = appliedTextColor;
                tr.appendChild(appliedColorsTd);

                resultsTbody.appendChild(tr);
            } // Closing brace for the for (const record of records) loop

            const downloadBtn = document.getElementById('download-json-btn');
            downloadBtn.style.display = 'block';
            downloadBtn.onclick = () => {
                const data = JSON.stringify(records, null, 2);
                const blob = new Blob([data], {type: 'application/json'});
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `${tableId}_${fieldId}.json`;
                a.click();
                URL.revokeObjectURL(url);
            };
            resultsContainer.style.display = 'block';
            loadingMessage.style.display = 'none';
        } catch (error) {
            errorMessage.textContent = `Error loading records: ${error.message}`;
            loadingMessage.style.display = 'none';
        }
    });

    grist.ready({ requiredAccess: 'full' });
    initialize();
});