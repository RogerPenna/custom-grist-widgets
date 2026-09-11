// libraries/grist-indicators-renderer/IndicatorFormulaBuilder.js
import { IndicatorsRenderer } from './IndicatorsRenderer.js';

export const IndicatorFormulaBuilder = (() => {
    let _overlay = null;
    let _onSaveCallback = null;
    let _record = null;
    let _allRecords = [];
    let _formulaData = { expression: '', alignments: {} };

    const PERIODICITY_LABELS = {
        'MONTHLY': 'Mensal',
        'BIMONTHLY': 'Bimestral',
        'QUARTERLY': 'Trimestral',
        'QUADRIMESTRAL': 'Quadrimestral',
        'SEMIANNUAL': 'Semestral',
        'ANNUAL': 'Anual'
    };

    function open(options) {
        const { record, formulaString, allRecords, config, onSave } = options;
        _record = record;
        _allRecords = allRecords.filter(r => Number(r.id) !== Number(record.id)); // Evita auto-referência
        _onSaveCallback = onSave;
        
        // Parse formula JSON or string
        _formulaData = { expression: '', alignments: {} };
        if (formulaString && formulaString.trim().startsWith('{')) {
            try {
                _formulaData = JSON.parse(formulaString);
            } catch (e) {
                _formulaData = { expression: formulaString, alignments: {} };
            }
        } else if (formulaString) {
            _formulaData = { expression: formulaString, alignments: {} };
        }

        _createDOM(config);
        _renderAlignmentSettings();
        _updatePreview();
        _overlay.style.display = 'flex';
    }

    function _createDOM(config) {
        if (_overlay) {
            document.body.removeChild(_overlay);
        }

        _overlay = document.createElement('div');
        _overlay.className = 'grf-editor-overlay';
        _overlay.style.zIndex = '10005'; // Acima do editor de dados

        const styleBlock = document.createElement('style');
        styleBlock.textContent = `
            .fb-container {
                background: #ffffff;
                width: 90%;
                max-width: 650px;
                border-radius: 12px;
                box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
                display: flex;
                flex-direction: column;
                overflow: hidden;
                font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
            }
            .fb-header {
                padding: 16px 20px;
                border-bottom: 1px solid #f1f5f9;
                display: flex;
                justify-content: space-between;
                align-items: center;
                background: #f8fafc;
            }
            .fb-header h3 { margin: 0; font-size: 16px; color: #0f172a; font-weight: 700; }
            .fb-close {
                background: none; border: none; font-size: 24px; color: #94a3b8; cursor: pointer; line-height: 1;
            }
            .fb-close:hover { color: #475569; }
            .fb-body {
                padding: 20px;
                overflow-y: auto;
                max-height: 70vh;
                display: flex;
                flex-direction: column;
                gap: 15px;
                background: #f8fafc;
            }
            .fb-label { font-size: 13px; font-weight: 600; color: #334155; margin-bottom: 5px; display: block; }
            .fb-textarea {
                width: 100%; height: 80px; font-family: monospace; font-size: 14px; padding: 10px;
                border: 1px solid #cbd5e1; border-radius: 6px; box-sizing: border-box; resize: none;
                background: #fff; color: #0f172a; outline: none; transition: border 0.15s;
            }
            .fb-textarea:focus { border-color: #3b82f6; }
            .fb-preview-box {
                padding: 10px; background: #e2e8f0; border-radius: 6px; font-size: 13px; font-weight: 500;
                color: #1e293b; border: 1px dashed #94a3b8; min-height: 24px; display: flex; align-items: center;
            }
            .fb-controls { display: flex; gap: 10px; align-items: center; }
            .fb-controls select {
                flex: 1; padding: 6px 10px; border-radius: 6px; border: 1px solid #cbd5e1; font-size: 13px; background: #fff;
            }
            .fb-keyboard { display: flex; flex-wrap: wrap; gap: 5px; }
            .fb-key {
                padding: 6px 12px; background: #fff; border: 1px solid #cbd5e1; border-radius: 4px;
                font-size: 13px; font-weight: 600; color: #334155; cursor: pointer; transition: all 0.15s;
            }
            .fb-key:hover { background: #f1f5f9; border-color: #94a3b8; }
            .fb-align-list { display: flex; flex-direction: column; gap: 10px; margin-top: 5px; }
            .fb-align-card {
                padding: 12px; background: #fff; border: 1px solid #e2e8f0; border-radius: 8px;
                box-shadow: 0 1px 3px rgba(0,0,0,0.05); display: flex; flex-direction: column; gap: 8px;
            }
            .fb-align-title { font-size: 13px; font-weight: 700; color: #1e293b; }
            .fb-align-row { display: flex; gap: 10px; align-items: center; }
            .fb-align-row select {
                padding: 4px 8px; border-radius: 4px; border: 1px solid #cbd5e1; font-size: 12px;
            }
            .fb-footer {
                padding: 16px 20px; border-top: 1px solid #f1f5f9; display: flex; justify-content: flex-end;
                gap: 10px; background: #f8fafc;
            }
        `;
        document.head.appendChild(styleBlock);

        // Populate indicator select options
        const indOptions = _allRecords.map(r => {
            const periodicityKey = config.mapping?.periodicityField ? (r[config.mapping.periodicityField] || 'MONTHLY') : 'MONTHLY';
            const periodicityLabel = PERIODICITY_LABELS[periodicityKey] || periodicityKey;
            return `<option value="${r.id}">${r.Nome || r.label || r.id} (${periodicityLabel})</option>`;
        }).join('');

        _overlay.innerHTML = `
            <div class="fb-container">
                <div class="fb-header">
                    <h3>Configurar Fórmula: ${_record.Nome}</h3>
                    <button class="fb-close">&times;</button>
                </div>
                <div class="fb-body">
                    <div>
                        <span class="fb-label">Expressão da Fórmula:</span>
                        <textarea class="fb-textarea" id="fb-expression" placeholder="Exemplo: {12} + {15} / 2">${_formulaData.expression}</textarea>
                    </div>

                    <div>
                        <span class="fb-label">Visualização Amigável:</span>
                        <div class="fb-preview-box" id="fb-preview">Fórmula vazia...</div>
                    </div>

                    <div class="fb-controls">
                        <select id="fb-select-indicator">
                            <option value="">-- Selecione um Indicador para Inserir --</option>
                            ${indOptions}
                        </select>
                        <button class="btn btn-secondary" id="fb-btn-insert" style="padding:6px 12px; font-size:13px;">Inserir</button>
                    </div>

                    <div>
                        <span class="fb-label">Teclado de Operadores:</span>
                        <div class="fb-keyboard">
                            <button class="fb-key" data-val="+">+</button>
                            <button class="fb-key" data-val="-">-</button>
                            <button class="fb-key" data-val="*">*</button>
                            <button class="fb-key" data-val="/">/</button>
                            <button class="fb-key" data-val="(">(</button>
                            <button class="fb-key" data-val=")">)</button>
                            <button class="fb-key" data-val="7">7</button>
                            <button class="fb-key" data-val="8">8</button>
                            <button class="fb-key" data-val="9">9</button>
                            <button class="fb-key" data-val="4">4</button>
                            <button class="fb-key" data-val="5">5</button>
                            <button class="fb-key" data-val="6">6</button>
                            <button class="fb-key" data-val="1">1</button>
                            <button class="fb-key" data-val="2">2</button>
                            <button class="fb-key" data-val="3">3</button>
                            <button class="fb-key" data-val="0">0</button>
                            <button class="fb-key" data-val=".">.</button>
                            <button class="fb-key" style="background:#fee2e2; border-color:#fca5a5; color:#991b1b" id="fb-btn-clear">Limpar</button>
                        </div>
                    </div>

                    <div>
                        <span class="fb-label">Configuração de Alinhamento de Período:</span>
                        <div class="fb-align-list" id="fb-align-list"></div>
                    </div>
                </div>
                <div class="fb-footer">
                    <button class="btn btn-secondary" id="fb-btn-cancel">Cancelar</button>
                    <button class="btn btn-primary" id="fb-btn-save">Salvar Fórmula</button>
                </div>
            </div>
        `;

        document.body.appendChild(_overlay);

        const textarea = _overlay.querySelector('#fb-expression');
        textarea.oninput = () => {
            _formulaData.expression = textarea.value;
            _renderAlignmentSettings();
            _updatePreview();
        };

        _overlay.querySelector('#fb-btn-insert').onclick = () => {
            const select = _overlay.querySelector('#fb-select-indicator');
            const val = select.value;
            if (!val) return;
            _insertText(`{${val}}`);
            select.value = '';
        };

        _overlay.querySelectorAll('.fb-keyboard .fb-key[data-val]').forEach(key => {
            key.onclick = () => _insertText(key.dataset.val);
        });

        _overlay.querySelector('#fb-btn-clear').onclick = () => {
            textarea.value = '';
            _formulaData.expression = '';
            _formulaData.alignments = {};
            _renderAlignmentSettings();
            _updatePreview();
        };

        _overlay.querySelector('.fb-close').onclick = _close;
        _overlay.querySelector('#fb-btn-cancel').onclick = _close;
        _overlay.querySelector('#fb-btn-save').onclick = _save;
    }

    function _insertText(text) {
        const textarea = _overlay.querySelector('#fb-expression');
        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        const currentVal = textarea.value;
        textarea.value = currentVal.substring(0, start) + text + currentVal.substring(end);
        _formulaData.expression = textarea.value;
        textarea.focus();
        textarea.selectionStart = textarea.selectionEnd = start + text.length;
        _renderAlignmentSettings();
        _updatePreview();
    }

    function _getIndicatorMap() {
        const map = {};
        _allRecords.forEach(r => {
            map[r.id] = r;
        });
        return map;
    }

    function _renderAlignmentSettings() {
        const listEl = _overlay.querySelector('#fb-align-list');
        const expr = _formulaData.expression;
        
        // Find all variables matching {number}
        const matches = [...expr.matchAll(/\{(\d+)\}/g)].map(m => m[1]);
        const uniqueIds = [...new Set(matches)];

        if (uniqueIds.length === 0) {
            listEl.innerHTML = '<p style="color:#64748b; font-size:12px; margin:0;">Nenhum indicador adicionado à fórmula ainda.</p>';
            return;
        }

        const indicatorMap = _getIndicatorMap();
        const destPeriodicity = _record.Periodicidade || 'MONTHLY';

        let html = '';
        uniqueIds.forEach(id => {
            const ind = indicatorMap[id];
            if (!ind) return;

            const origPeriodicity = ind.Periodicidade || 'MONTHLY';
            const periodicityLabel = PERIODICITY_LABELS[origPeriodicity] || origPeriodicity;
            const destPeriodicityLabel = PERIODICITY_LABELS[destPeriodicity] || destPeriodicity;

            const isHigherToLower = _comparePeriodicity(origPeriodicity, destPeriodicity) > 0;
            const isLowerToHigher = _comparePeriodicity(origPeriodicity, destPeriodicity) < 0;

            if (!_formulaData.alignments[id]) {
                _formulaData.alignments[id] = { aggregation: 'AVG', distribution: 'REPETIR' };
            }
            const align = _formulaData.alignments[id];

            html += `
                <div class="fb-align-card" data-id="${id}">
                    <div class="fb-align-title">${ind.Nome || ind.label || id}</div>
                    <div style="font-size:11px; color:#64748b;">
                        Origem: <strong>${periodicityLabel}</strong> → Destino: <strong>${destPeriodicityLabel}</strong>
                    </div>
            `;

            if (isHigherToLower) {
                // Origem mais frequente (ex: Mensal -> Destino Semestral)
                html += `
                    <div class="fb-align-row">
                        <span style="font-size:12px; color:#334155;">Consolidação (Agregação):</span>
                        <select class="fb-agg-select" data-id="${id}">
                            <option value="AVG" ${align.aggregation === 'AVG' ? 'selected' : ''}>MÉDIA</option>
                            <option value="SUM" ${align.aggregation === 'SUM' ? 'selected' : ''}>SOMA</option>
                            <option value="LAST" ${align.aggregation === 'LAST' ? 'selected' : ''}>ÚLTIMO VALOR</option>
                        </select>
                    </div>
                `;
            } else if (isLowerToHigher) {
                // Origem menos frequente (ex: Semestral -> Destino Mensal)
                html += `
                    <div class="fb-align-row">
                        <span style="font-size:12px; color:#334155;">Preenchimento (Distribuição):</span>
                        <select class="fb-dist-select" data-id="${id}">
                            <option value="REPETIR" ${align.distribution === 'REPETIR' ? 'selected' : ''}>REPETIR VALOR (Propagar)</option>
                            <option value="DISTRIBUIR" ${align.distribution === 'DISTRIBUIR' ? 'selected' : ''}>DIVIDIR IGUAL (Distribuir)</option>
                            <option value="IGNORAR" ${align.distribution === 'IGNORAR' ? 'selected' : ''}>NULO / IGNORAR</option>
                        </select>
                    </div>
                `;
            } else {
                html += `<div style="font-size:11px; color:#059669; font-weight:600; margin-top:5px;">✓ Mesma periodicidade (Alinhamento Direto)</div>`;
            }

            html += `</div>`;
        });

        listEl.innerHTML = html;

        // Add event listeners to dropdown changes
        listEl.querySelectorAll('.fb-agg-select').forEach(sel => {
            sel.onchange = (e) => {
                const id = sel.dataset.id;
                _formulaData.alignments[id].aggregation = e.target.value;
            };
        });

        listEl.querySelectorAll('.fb-dist-select').forEach(sel => {
            sel.onchange = (e) => {
                const id = sel.dataset.id;
                _formulaData.alignments[id].distribution = e.target.value;
            };
        });
    }

    function _comparePeriodicity(p1, p2) {
        const ORDER = ['ANNUAL', 'SEMIANNUAL', 'QUADRIMESTRAL', 'QUARTERLY', 'BIMONTHLY', 'MONTHLY'];
        const idx1 = ORDER.indexOf(p1);
        const idx2 = ORDER.indexOf(p2);
        return idx1 - idx2;
    }

    function _updatePreview() {
        const previewEl = _overlay.querySelector('#fb-preview');
        const expr = _formulaData.expression;
        if (!expr.trim()) {
            previewEl.innerHTML = '<span style="color:#94a3b8">Fórmula vazia...</span>';
            return;
        }

        const indicatorMap = _getIndicatorMap();
        const parsed = expr.replace(/\{(\d+)\}/g, (match, id) => {
            const ind = indicatorMap[id];
            if (ind) {
                return `<span style="background:#dbeafe; color:#1e40af; padding:2px 6px; border-radius:4px; font-weight:bold; font-size:11px; border:1px solid #bfdbfe; margin:0 2px;">${ind.Nome || ind.label || id}</span>`;
            }
            return `<span style="background:#fee2e2; color:#991b1b; padding:2px 6px; border-radius:4px; font-weight:bold; font-size:11px; border:1px solid #fca5a5; margin:0 2px;">[Erro: ID ${id}]</span>`;
        });

        previewEl.innerHTML = parsed;
    }

    function _save() {
        const expr = _formulaData.expression.trim();
        if (!expr) {
            alert("A expressão da fórmula não pode ser vazia!");
            return;
        }

        let openCount = 0;
        for (let char of expr) {
            if (char === '(') openCount++;
            if (char === ')') openCount--;
            if (openCount < 0) {
                alert("Erro de parênteses: Parênteses fechando sem ter sido aberto!");
                return;
            }
        }
        if (openCount !== 0) {
            alert("Erro de parênteses: Há parênteses abertos que não foram fechados!");
            return;
        }

        const matches = [...expr.matchAll(/\{(\d+)\}/g)].map(m => m[1]);
        const uniqueIds = [...new Set(matches)];
        const cleanAlignments = {};
        uniqueIds.forEach(id => {
            if (_formulaData.alignments[id]) {
                cleanAlignments[id] = _formulaData.alignments[id];
            } else {
                cleanAlignments[id] = { aggregation: 'AVG', distribution: 'REPETIR' };
            }
        });
        _formulaData.alignments = cleanAlignments;

        if (_onSaveCallback) {
            _onSaveCallback(JSON.stringify(_formulaData));
        }
        _close();
    }

    function _close() {
        if (_overlay) _overlay.style.display = 'none';
    }

    return { open };
})();
