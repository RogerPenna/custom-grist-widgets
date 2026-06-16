// libraries/grist-indicators-renderer/IndicatorsEditor.js
import { GristDataWriter } from '../grist-data-writer.js';
import { IndicatorsRenderer } from './IndicatorsRenderer.js';

export const IndicatorsEditor = (() => {
    let _modalOverlay = null;
    let _table = null;
    let _onSaveCallback = null;
    let _currentRecord = null;
    let _currentConfig = null;
    let _startYear = null;
    let _endYear = null;
    let _periodicity = null;

    function open(options) {
        const { record, config, selectedYear, periodicity, onSave } = options;
        _onSaveCallback = onSave;
        _currentRecord = record;
        _currentConfig = config;
        _startYear = parseInt(selectedYear);
        _endYear = parseInt(selectedYear);
        _periodicity = periodicity;

        _createModalDOM(record.Nome);
        _initTabulator();
        
        _modalOverlay.style.display = 'flex';
    }

    function _createModalDOM(name) {
        if (_modalOverlay) {
            document.body.removeChild(_modalOverlay);
        }

        _modalOverlay = document.createElement('div');
        _modalOverlay.className = 'grf-editor-overlay';
        
        // Generate year options
        const currentYear = new Date().getFullYear();
        const yearOptions = [];
        for (let y = currentYear - 5; y <= currentYear + 5; y++) {
            yearOptions.push(`<option value="${y}">${y}</option>`);
        }

        _modalOverlay.innerHTML = `
            <div class="grf-editor-modal">
                <div class="grf-editor-header">
                    <div class="title-area">
                        <h2>Editar Dados: ${name}</h2>
                        <div class="year-range-selector">
                            <label>De: <select id="editor-start-year">${yearOptions.join('')}</select></label>
                            <label>Até: <select id="editor-end-year">${yearOptions.join('')}</select></label>
                        </div>
                    </div>
                    <button class="grf-editor-close">&times;</button>
                </div>
                <div class="grf-editor-body">
                    <div id="tabulator-editor"></div>
                </div>
                <div class="grf-editor-footer">
                    <p class="help-text">Dica: Você pode copiar dados do Excel e colar aqui (Ctrl+V).</p>
                    <div class="actions">
                        <button class="btn btn-secondary" id="editor-cancel-btn">Cancelar</button>
                        <button class="btn btn-primary" id="editor-save-btn">Salvar Alterações</button>
                    </div>
                </div>
            </div>
        `;

        document.body.appendChild(_modalOverlay);

        const startSelect = _modalOverlay.querySelector('#editor-start-year');
        const endSelect = _modalOverlay.querySelector('#editor-end-year');
        
        startSelect.value = _startYear;
        endSelect.value = _endYear;

        startSelect.onchange = (e) => {
            _startYear = parseInt(e.target.value);
            if (_endYear < _startYear) {
                _endYear = _startYear;
                endSelect.value = _endYear;
            }
            _initTabulator();
        };

        endSelect.onchange = (e) => {
            _endYear = parseInt(e.target.value);
            if (_startYear > _endYear) {
                _startYear = _endYear;
                startSelect.value = _startYear;
            }
            _initTabulator();
        };

        _modalOverlay.querySelector('.grf-editor-close').onclick = _close;
        _modalOverlay.querySelector('#editor-cancel-btn').onclick = _close;
        _modalOverlay.querySelector('#editor-save-btn').onclick = _handleSave;
    }

    function _initTabulator() {
        const record = _currentRecord;
        const config = _currentConfig;
        const periodicity = _periodicity;

        const mapping = config.mapping || config || {};
        const resultsField = mapping.resultsField || config.resultsField;
        const targetField = mapping.targetField || config.targetField;
        
        const rawResultsJson = record[resultsField];
        const rawTargetsJson = record[targetField];
        
        const _parseJson = (val) => {
            try {
                return (typeof val === 'string' && val.trim().startsWith('{')) ? JSON.parse(val) : (typeof val === 'object' && val !== null ? val : {});
            } catch(e) { return {}; }
        };

        const resultsMaster = _parseJson(rawResultsJson);
        const targetsMaster = _parseJson(rawTargetsJson);
        const monthKeys = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

        const tableData = [];
        for (let year = _startYear; year <= _endYear; year++) {
            const yearStr = year.toString();
            const yearResultsNode = resultsMaster[yearStr] || {};
            const results = yearResultsNode.results || ( (yearResultsNode.jan !== undefined) ? yearResultsNode : (resultsMaster.jan !== undefined ? resultsMaster : {}) );
            const yearTargetsNode = targetsMaster[yearStr] || {};

            const progressiveTargets = IndicatorsRenderer.calculateProgressiveTargets(targetsMaster, yearStr);
            const fullTargetLine = progressiveTargets[yearStr] || new Array(12).fill(0);

            periodicity.months.forEach(m => {
                const resEntry = results[m];
                const tarEntry = yearTargetsNode[m];
                const monthIdx = monthKeys.indexOf(m);
                const isManual = (tarEntry && typeof tarEntry === 'object' && tarEntry.m === true);
                
                tableData.push({
                    year: year,
                    id: m,
                    month: m.toUpperCase(),
                    target: fullTargetLine[monthIdx],
                    isManualTarget: isManual,
                    result: (resEntry && typeof resEntry === 'object') ? resEntry.v : (resEntry ?? null),
                    updatedAt: (resEntry && typeof resEntry === 'object') ? resEntry.d : ""
                });
            });
        }

        _table = new Tabulator("#tabulator-editor", {
            data: tableData,
            layout: "fitColumns",
            height: "400px",
            clipboard: "paste",
            clipboardPasteAction: "update",
            clipboardPasteParser: "table",
            columns: [
                { title: "Ano", field: "year", width: 80, headerSort: false, clipboard: false, cssClass: "readonly-col" },
                { title: "Mês", field: "month", width: 100, headerSort: false, clipboard: false },
                { 
                    title: "Meta", 
                    field: "target", 
                    editor: "number", 
                    headerSort: false,
                    formatter: (cell) => {
                        const val = cell.getValue();
                        const isManual = cell.getData().isManualTarget;
                        const color = isManual ? "#007bff" : "#555";
                        const weight = isManual ? "bold" : "normal";
                        const formatted = (typeof val === 'number') ? val.toLocaleString(undefined, {maximumFractionDigits: 2}) : val;
                        return `<span style="color: ${color}; font-weight: ${weight}">${formatted}</span>`;
                    },
                    cellEdited: (cell) => {
                        cell.getRow().update({ isManualTarget: true });
                    }
                },
                { title: "Resultado", field: "result", editor: "number", headerSort: false, cellEdited: (cell) => {
                    const row = cell.getRow();
                    row.update({ updatedAt: new Date().toISOString().split('T')[0] });
                }},
                { title: "Última Atualização", field: "updatedAt", width: 150, headerSort: false, cssClass: "readonly-col", clipboard: false }
            ],
        });

        // Intercept paste to support multi-cell pasting from Excel even when an editor is active
        _table.on("tableBuilt", () => {
            _table.element.addEventListener("paste", (e) => {
                if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA") {
                    const data = (e.clipboardData || window.clipboardData).getData("text/plain");
                    if (data && (data.includes("\t") || data.includes("\n"))) {
                        e.preventDefault();
                        e.stopPropagation();
                        
                        const input = e.target;
                        const cellEl = input.closest(".tabulator-cell");
                        if (!cellEl) return;
                        
                        const field = cellEl.getAttribute("tabulator-field");
                        const rowEl = input.closest(".tabulator-row");
                        if (!rowEl) return;
                        
                        const lines = data.split(/\r?\n/).filter(line => line.length > 0);
                        let currentRowEl = rowEl;
                        
                        lines.forEach(line => {
                            if (!currentRowEl) return;
                            const row = _table.getRow(currentRowEl);
                            const values = line.split("\t");
                            
                            if (field === "target") {
                                row.update({ target: values[0], isManualTarget: true });
                                if (values.length > 1) {
                                    row.update({ result: values[1], updatedAt: new Date().toISOString().split('T')[0] });
                                }
                            } else if (field === "result") {
                                row.update({ result: values[0], updatedAt: new Date().toISOString().split('T')[0] });
                            }
                            
                            currentRowEl = currentRowEl.nextElementSibling;
                            if (currentRowEl && !currentRowEl.classList.contains("tabulator-row")) {
                                currentRowEl = null;
                            }
                        });
                        input.blur();
                    }
                }
            }, true);
        });
    }

    async function _handleSave() {
        const allData = _table.getData();
        const multiYearData = {};

        // Group rows by year
        allData.forEach(row => {
            const y = row.year.toString();
            if (!multiYearData[y]) {
                multiYearData[y] = { results: {}, targets: {} };
            }
            
            if (row.result !== null && row.result !== undefined && row.result !== "") {
                multiYearData[y].results[row.id] = { v: parseFloat(row.result), d: row.updatedAt };
            }
            if (row.target !== null && row.target !== undefined && row.target !== "" && row.isManualTarget) {
                multiYearData[y].targets[row.id] = { v: parseFloat(row.target), m: true };
            }
        });

        // Conflict detection across all updated years
        const mapping = _currentConfig.mapping || _currentConfig || {};
        const targetField = mapping.targetField || _currentConfig.targetField;
        const _parseJson = (val) => {
            try {
                return (typeof val === 'string' && val.trim().startsWith('{')) ? JSON.parse(val) : (typeof val === 'object' && val !== null ? val : {});
            } catch(e) { return {}; }
        };
        const targetsMaster = _parseJson(_currentRecord[targetField]);
        const monthKeys = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

        // Build a complete proposed targets master
        const proposedTargetsMaster = JSON.parse(JSON.stringify(targetsMaster));
        for (const yearStr of Object.keys(multiYearData)) {
            proposedTargetsMaster[yearStr] = multiYearData[yearStr].targets;
        }

        const simulatedProgressive = IndicatorsRenderer.calculateProgressiveTargets(proposedTargetsMaster);

        for (const yearStr of Object.keys(multiYearData)) {
            const yearData = multiYearData[yearStr];
            
            // Get original targets for comparison
            const oldTargets = IndicatorsRenderer.getIndicatorMetrics(_currentRecord, _currentConfig, yearStr).targetLine;
            const newTargets = simulatedProgressive[yearStr] || new Array(12).fill(0);

            const monthsWithResults = allData.filter(r => r.year.toString() === yearStr && r.result !== null && r.result !== undefined && r.result !== "");
            const conflicts = [];

            monthsWithResults.forEach(row => {
                const idx = monthKeys.indexOf(row.id);
                if (Math.abs(oldTargets[idx] - newTargets[idx]) > 0.001 && !yearData.targets[row.id]) {
                    conflicts.push({ id: row.id, name: row.month, oldVal: oldTargets[idx] });
                }
            });

            if (conflicts.length > 0) {
                const names = conflicts.map(c => c.name).join(', ');
                const userChoice = await _showConflictPrompt(`${yearStr}: ${names}`);
                
                if (userChoice === 'fix') {
                    conflicts.forEach(c => {
                        yearData.targets[c.id] = { v: c.oldVal, m: true };
                    });
                    // Re-calculate simulation if we fixed something, to keep it accurate for next years in loop
                    // though actually we fixed it in yearData.targets which is already in multiYearData
                }
            }
        }

        if (_onSaveCallback) {
            await _onSaveCallback(multiYearData);
        }
        _close();
    }

    function _showConflictPrompt(monthNames) {
        return new Promise((resolve) => {
            const promptOverlay = document.createElement('div');
            promptOverlay.className = 'grf-editor-overlay';
            promptOverlay.style.zIndex = '10001';
            promptOverlay.innerHTML = `
                <div class="grf-editor-modal" style="max-width: 400px;">
                    <div class="grf-editor-header">
                        <h2>Aviso de Recálculo</h2>
                    </div>
                    <div class="grf-editor-body">
                        <p>O recálculo das metas progressivas afetará meses que já possuem resultados: <b>${monthNames}</b>.</p>
                        <p>Deseja <b>FIXAR</b> as metas antigas para estes meses para preservar o histórico?</p>
                    </div>
                    <div class="grf-editor-footer">
                        <div class="actions">
                            <button class="btn btn-secondary" id="prompt-no-btn">NÃO</button>
                            <button class="btn btn-primary" id="prompt-yes-btn">SIM</button>
                        </div>
                    </div>
                </div>
            `;
            document.body.appendChild(promptOverlay);
            promptOverlay.style.display = 'flex';

            promptOverlay.querySelector('#prompt-yes-btn').onclick = () => {
                document.body.removeChild(promptOverlay);
                resolve('fix');
            };
            promptOverlay.querySelector('#prompt-no-btn').onclick = () => {
                document.body.removeChild(promptOverlay);
                resolve('apply');
            };
        });
    }

    function _close() {
        if (_modalOverlay) _modalOverlay.style.display = 'none';
    }

    return { open };
})();

