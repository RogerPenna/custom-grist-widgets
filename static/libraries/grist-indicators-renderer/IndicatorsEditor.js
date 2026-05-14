// libraries/grist-indicators-renderer/IndicatorsEditor.js
import { GristDataWriter } from '../grist-data-writer.js';
import { IndicatorsRenderer } from './IndicatorsRenderer.js';

export const IndicatorsEditor = (() => {
    let _modalOverlay = null;
    let _table = null;
    let _onSaveCallback = null;
    let _currentRecord = null;
    let _currentConfig = null;
    let _currentYear = null;

    function open(options) {
        const { record, config, selectedYear, periodicity, onSave } = options;
        _onSaveCallback = onSave;
        _currentRecord = record;
        _currentConfig = config;
        _currentYear = selectedYear;

        _createModalDOM(record.Nome, selectedYear);
        _initTabulator(record, config, selectedYear, periodicity);
        
        _modalOverlay.style.display = 'flex';
    }

    function _createModalDOM(name, year) {
        if (_modalOverlay) {
            document.body.removeChild(_modalOverlay);
        }

        _modalOverlay = document.createElement('div');
        _modalOverlay.className = 'grf-editor-overlay';
        _modalOverlay.innerHTML = `
            <div class="grf-editor-modal">
                <div class="grf-editor-header">
                    <h2>Editar Dados: ${name} (${year})</h2>
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

        _modalOverlay.querySelector('.grf-editor-close').onclick = _close;
        _modalOverlay.querySelector('#editor-cancel-btn').onclick = _close;
        _modalOverlay.querySelector('#editor-save-btn').onclick = _handleSave;
    }

    function _initTabulator(record, config, year, periodicity) {
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

        const yearResultsNode = resultsMaster[year] || {};
        const results = yearResultsNode.results || ( (yearResultsNode.jan !== undefined) ? yearResultsNode : (resultsMaster.jan !== undefined ? resultsMaster : {}) );
        
        const yearTargetsNode = targetsMaster[year] || {};

        // Get full calculated target line for the year
        const progressiveTargets = IndicatorsRenderer.calculateProgressiveTargets(targetsMaster, year);
        const fullTargetLine = progressiveTargets[year] || new Array(12).fill(0);
        const monthKeys = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

        const tableData = periodicity.months.map(m => {
            const resEntry = results[m];
            const tarEntry = yearTargetsNode[m];
            const monthIdx = monthKeys.indexOf(m);
            const isManual = (tarEntry && typeof tarEntry === 'object' && tarEntry.m === true);
            
            return {
                id: m,
                month: m.toUpperCase(),
                target: fullTargetLine[monthIdx],
                isManualTarget: isManual,
                result: (resEntry && typeof resEntry === 'object') ? resEntry.v : (resEntry ?? null),
                updatedAt: (resEntry && typeof resEntry === 'object') ? resEntry.d : ""
            };
        });

        _table = new Tabulator("#tabulator-editor", {
            data: tableData,
            layout: "fitColumns",
            clipboard: true,
            clipboardPasteAction: "replace",
            columns: [
                { title: "Mês", field: "month", width: 100, headerSort: false },
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
                        // Trigger a preview of the new interpolation if needed? 
                        // For now, simple manual marking is enough as Save handles the rest.
                    }
                },
                { title: "Resultado", field: "result", editor: "number", headerSort: false, cellEdited: (cell) => {
                    const row = cell.getRow();
                    row.update({ updatedAt: new Date().toISOString().split('T')[0] });
                }},
                { title: "Última Atualização", field: "updatedAt", width: 150, headerSort: false, cssClass: "readonly-col" }
            ],
        });
    }

    async function _handleSave() {
        const rows = _table.getData();
        const mapping = _currentConfig.mapping || _currentConfig || {};
        const resultsField = mapping.resultsField || _currentConfig.resultsField;
        const targetField = mapping.targetField || _currentConfig.targetField;

        // Parse existing data - Robustly handle non-JSON or legacy numeric values
        const _parseJson = (val) => {
            try {
                return (typeof val === 'string' && val.trim().startsWith('{')) ? JSON.parse(val) : (typeof val === 'object' && val !== null ? val : {});
            } catch(e) { return {}; }
        };

        let resultsMaster = _parseJson(_currentRecord[resultsField]);
        let targetsMaster = _parseJson(_currentRecord[targetField]);

        // 1. Prepare proposed changes
        const newYearResults = {};
        const newYearTargets = {};
        rows.forEach(row => {
            if (row.result !== null && row.result !== undefined && row.result !== "") {
                newYearResults[row.id] = { v: parseFloat(row.result), d: row.updatedAt };
            }
            if (row.target !== null && row.target !== undefined && row.target !== "" && row.isManualTarget) {
                newYearTargets[row.id] = { v: parseFloat(row.target), m: true };
            }
        });

        // 2. Conflict Detection: Recalculate and compare
        const oldTargets = IndicatorsRenderer.getIndicatorMetrics(_currentRecord, _currentConfig, _currentYear).targetLine;
        
        // Simulate new targets master
        const simulatedTargetsMaster = JSON.parse(JSON.stringify(targetsMaster));
        simulatedTargetsMaster[_currentYear] = newYearTargets;
        const simulatedProgressive = IndicatorsRenderer.calculateProgressiveTargets(simulatedTargetsMaster);
        const newTargets = simulatedProgressive[_currentYear] || new Array(12).fill(0);

        // Check months with results
        const monthsWithResults = rows.filter(r => r.result !== null && r.result !== undefined && r.result !== "");
        const monthKeys = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
        const conflicts = [];

        monthsWithResults.forEach(row => {
            const idx = monthKeys.indexOf(row.id);
            if (Math.abs(oldTargets[idx] - newTargets[idx]) > 0.001 && !newYearTargets[row.id]) {
                conflicts.push({ id: row.id, name: row.month, oldVal: oldTargets[idx] });
            }
        });

        if (conflicts.length > 0) {
            const names = conflicts.map(c => c.name).join(', ');
            const userChoice = await _showConflictPrompt(names);
            
            if (userChoice === 'fix') {
                conflicts.forEach(c => {
                    newYearTargets[c.id] = { v: c.oldVal, m: true };
                });
            }
        }

        if (_onSaveCallback) {
            await _onSaveCallback({ results: newYearResults, targets: newYearTargets });
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
