// libraries/grist-indicators-renderer/IndicatorsEditor.js
import { GristDataWriter } from '../grist-data-writer.js';

export const IndicatorsEditor = (() => {
    let _modalOverlay = null;
    let _table = null;
    let _onSaveCallback = null;

    function open(options) {
        const { record, config, selectedYear, periodicity, onSave } = options;
        _onSaveCallback = onSave;

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
        const rawJson = record[resultsField];
        
        let masterData = {};
        try {
            masterData = typeof rawJson === 'string' ? JSON.parse(rawJson) : (rawJson || {});
        } catch (e) {}

        const yearNode = masterData[year] || {};
        const results = yearNode.results || ( (yearNode.jan !== undefined) ? yearNode : (masterData.jan !== undefined ? masterData : {}) );
        const targets = yearNode.targets || {};

        const tableData = periodicity.months.map(m => {
            const resEntry = results[m];
            return {
                id: m,
                month: m.toUpperCase(),
                target: targets[m] ?? null,
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
                { title: "Meta", field: "target", editor: "number", headerSort: false },
                { title: "Resultado", field: "result", editor: "number", headerSort: false, cellEdited: (cell) => {
                    // Update timestamp on result edit
                    const row = cell.getRow();
                    row.update({ updatedAt: new Date().toISOString().split('T')[0] });
                }},
                { title: "Última Atualização", field: "updatedAt", width: 150, headerSort: false, cssClass: "readonly-col" }
            ],
        });
    }

    async function _handleSave() {
        const data = _table.getData();
        const results = {};
        const targets = {};

        data.forEach(row => {
            if (row.result !== null && row.result !== undefined && row.result !== "") {
                results[row.id] = { v: parseFloat(row.result), d: row.updatedAt };
            }
            if (row.target !== null && row.target !== undefined && row.target !== "") {
                targets[row.id] = parseFloat(row.target);
            }
        });

        if (_onSaveCallback) {
            await _onSaveCallback({ results, targets });
        }
        _close();
    }

    function _close() {
        if (_modalOverlay) _modalOverlay.style.display = 'none';
    }

    return { open };
})();
