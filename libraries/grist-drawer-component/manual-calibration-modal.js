// libraries/grist-drawer-component/manual-calibration-modal.js

export const ManualCalibrationModal = (() => {
    let _overlay = null;
    let _tableLens = null;
    let _dataWriter = null;
    let _tableId = 'EXTERNAL_CALIBRATIONS';
    let _recordId = null;
    let _onSavedCallback = null;

    let _instruments = [];
    let _laboratories = [];
    let _pdfFile = null;
    let _pdfUrl = null;

    // Result Points State
    let _points = [
        { refValue: '', errorValue: '', uncertainty: '', kFactor: '2.00' }
    ];
    let _selectedIndex = -1;

    async function open(options = {}) {
        _tableLens = options.tableLens || window.tableLens || window.parentTableLens;
        _dataWriter = options.dataWriter || window.dataWriter;
        _tableId = options.tableId || 'EXTERNAL_CALIBRATIONS';
        _recordId = options.recordId || null;
        _onSavedCallback = options.onSaved || null;
        _pdfFile = null;
        _pdfUrl = null;
        _selectedIndex = -1;

        _points = [
            { refValue: '', errorValue: '', uncertainty: '', kFactor: '2.00' }
        ];

        // Ensure CSS is loaded
        _injectCss();

        // Load data in parallel
        await _loadMasterData();

        // Render modal DOM
        _renderModal();
    }

    function _injectCss() {
        if (!document.getElementById('mcm-style-link')) {
            const link = document.createElement('link');
            link.id = 'mcm-style-link';
            link.rel = 'stylesheet';
            link.href = '../libraries/grist-drawer-component/manual-calibration-modal.css';
            document.head.appendChild(link);
        }
    }

    async function _loadMasterData() {
        if (!_tableLens) return;

        try {
            // Load Instruments
            const rawInst = await _tableLens.fetchTableRecords('Instruments').catch(() => []);
            _instruments = Array.isArray(rawInst) ? rawInst : [];

            // Load Suppliers/Laboratories
            const rawSupp = await _tableLens.fetchTableRecords('Fornecedores').catch(() => []);
            const allSuppliers = Array.isArray(rawSupp) ? rawSupp : [];

            // Filter ONLY Laboratories using 'Is Laboratory' (0/1) or name/type fallback
            _laboratories = allSuppliers.filter(s => {
                if (!s) return false;
                const isLabCol = s['Is Laboratory'] === 1 || s['Is Laboratory'] === '1' || s.IsLaboratory === 1 || s.isLaboratory === true;
                const tipo = (s.Tipo || s.tipo || s.TipoFornecedor || '').toLowerCase();
                const nome = (s.nome || s.Nome || s.RazaoSocial || '').toLowerCase();
                return isLabCol || tipo.includes('laborat') || nome.includes('metrologia') || nome.includes('lab');
            });

            // If filter results in empty list, fallback to all suppliers so dropdown is never broken
            if (_laboratories.length === 0) {
                _laboratories = allSuppliers;
            }
        } catch (e) {
            console.warn('[ManualCalibrationModal] Error loading master data:', e);
        }
    }

    function _renderModal() {
        if (_overlay) _overlay.remove();

        _overlay = document.createElement('div');
        _overlay.className = 'mcm-overlay';

        const todayStr = new Date().toISOString().split('T')[0];

        _overlay.innerHTML = `
            <div class="mcm-modal">
                <div class="mcm-header">
                    <div class="mcm-header-title">
                        <span>📝</span>
                        <span>Cadastro Manual de Calibração</span>
                    </div>
                    <button type="button" class="mcm-close-btn" id="mcm-close-x">✕</button>
                </div>
                
                <div class="mcm-split-container">
                    <!-- LEFT PANEL: FORM & TABS -->
                    <div class="mcm-left-panel">
                        <div class="mcm-tabs-bar">
                            <button type="button" class="mcm-tab-btn active" data-tab="dados-gerais">Dados Gerais</button>
                            <button type="button" class="mcm-tab-btn" data-tab="tabelas-resultados">Tabelas de Resultados</button>
                        </div>
                        
                        <!-- TAB 1: DADOS GERAIS -->
                        <div class="mcm-tab-content active" id="mcm-tab-dados-gerais">
                            <div class="mcm-form-grid">
                                <div class="mcm-form-group">
                                    <label>Código do Certificado</label>
                                    <input type="text" id="mcm-code" class="mcm-input" placeholder="Ex: CAL-2026.01">
                                </div>
                                <div class="mcm-form-group">
                                    <label>Data da Calibração</label>
                                    <input type="date" id="mcm-date" class="mcm-input" value="${todayStr}">
                                </div>
                                
                                <div class="mcm-form-group full-width">
                                    <label>Instrumento</label>
                                    <select id="mcm-instrument" class="mcm-select">
                                        <option value="">-- Selecione o Instrumento --</option>
                                        ${_instruments.map(i => `<option value="${i.id}">${i.Codigo || i.Código || i.id}: ${i.Nome || i.Descrição || i.Instrumento || ''}</option>`).join('')}
                                    </select>
                                </div>
                                
                                <div id="mcm-inst-summary" class="mcm-form-group full-width" style="display:none;">
                                    <div class="mcm-info-card">
                                        <h4>ℹ️ Detalhes do Instrumento Selecionado</h4>
                                        <div id="mcm-inst-details"></div>
                                    </div>
                                </div>

                                <div class="mcm-form-group full-width">
                                    <label>Laboratório (Fornecedor)</label>
                                    <select id="mcm-laboratory" class="mcm-select">
                                        <option value="">-- Selecione o Laboratório --</option>
                                        ${_laboratories.map(l => `<option value="${l.id}">${l.Nome || l.RazaoSocial || l.nome || l.id}</option>`).join('')}
                                    </select>
                                </div>

                                <div class="mcm-form-group">
                                    <label>Tipo da Calibração</label>
                                    <select id="mcm-cal-type" class="mcm-select">
                                        <option value="RBC" selected>RBC</option>
                                        <option value="Rastreado">Rastreado</option>
                                        <option value="ANFAVEA">ANFAVEA</option>
                                        <option value="RMRS">RMRS</option>
                                        <option value="Rastreado RBC">Rastreado RBC</option>
                                    </select>
                                </div>

                                <div class="mcm-form-group">
                                    <label>Quem Avaliou</label>
                                    <input type="text" id="mcm-evaluator" class="mcm-input" value="[Não Informado]" placeholder="Nome do avaliador">
                                </div>

                                <div class="mcm-form-group">
                                    <label>Validação</label>
                                    <select id="mcm-validation" class="mcm-select">
                                        <option value="Não Avaliado" selected>Não Avaliado</option>
                                        <option value="Aprovado">Aprovado</option>
                                        <option value="Reprovado">Reprovado</option>
                                        <option value="Aprovado com Restrições">Aprovado com Restrições</option>
                                    </select>
                                </div>

                                <div class="mcm-form-group full-width">
                                    <label>Observações</label>
                                    <textarea id="mcm-notes" class="mcm-textarea" placeholder="Observações adicionais do certificado..."></textarea>
                                </div>
                            </div>
                        </div>

                        <!-- TAB 2: TABELAS DE RESULTADOS -->
                        <div class="mcm-tab-content" id="mcm-tab-tabelas-resultados">
                            <div class="mcm-form-grid" style="margin-bottom:10px;">
                                <div class="mcm-form-group">
                                    <label>Nome da Tabela</label>
                                    <input type="text" id="mcm-tbl-name" class="mcm-input" value="Tabela 1 - Erro de Indicação">
                                </div>
                                <div class="mcm-form-group">
                                    <label>Faixa de Medição</label>
                                    <input type="text" id="mcm-tbl-range" class="mcm-input" placeholder="Ex: 0 a 100 mm">
                                </div>
                                <div class="mcm-form-group">
                                    <label>Modo de Erro</label>
                                    <select id="mcm-tbl-error-mode" class="mcm-select">
                                        <option value="Valor Absoluto" selected>(Valor Absoluto)</option>
                                        <option value="Porcentagem">(Porcentagem)</option>
                                    </select>
                                </div>
                                <div class="mcm-form-group">
                                    <label>Modo de Incerteza</label>
                                    <select id="mcm-tbl-uncert-mode" class="mcm-select">
                                        <option value="Valor Absoluto" selected>(Valor Absoluto)</option>
                                        <option value="Porcentagem">(Porcentagem)</option>
                                    </select>
                                </div>
                            </div>

                            <!-- TOOLBAR DE PONTOS -->
                            <div class="mcm-toolbar">
                                <button type="button" id="mcm-btn-add-pt" class="mcm-tb-btn">+ Adicionar Ponto</button>
                                <button type="button" id="mcm-btn-del-pt" class="mcm-tb-btn" disabled>🗑️ Excluir</button>
                                <button type="button" id="mcm-btn-up-pt" class="mcm-tb-btn" disabled>⬆️ Subir</button>
                                <button type="button" id="mcm-btn-down-pt" class="mcm-tb-btn" disabled>⬇️ Descera</button>
                            </div>

                            <!-- GRID DE PONTOS -->
                            <div class="mcm-grid-container">
                                <table class="mcm-points-table" id="mcm-points-tbl">
                                    <thead>
                                        <tr>
                                            <th style="width:30px;">#</th>
                                            <th>Valor de Referência</th>
                                            <th>Erro</th>
                                            <th>Incerteza</th>
                                            <th>Fator k</th>
                                        </tr>
                                    </thead>
                                    <tbody></tbody>
                                </table>
                            </div>
                        </div>
                    </div>

                    <!-- RIGHT PANEL: PDF VIEWER & UPLOADER -->
                    <div class="mcm-right-panel">
                        <div class="mcm-pdf-box">
                            <div class="mcm-pdf-header">
                                <span>📄 Documento PDF do Certificado</span>
                                <input type="file" id="mcm-pdf-input" accept="application/pdf" style="display:none;">
                                <button type="button" id="mcm-pdf-browse-btn" class="mcm-tb-btn">📁 Selecionar PDF</button>
                            </div>
                            <div id="mcm-pdf-content" style="flex:1; display:flex; flex-direction:column;">
                                <div class="mcm-pdf-upload-zone" id="mcm-upload-zone">
                                    <span style="font-size:36px; margin-bottom:10px;">📥</span>
                                    <span style="font-weight:bold; color:#2c5e5a;">Arraste o arquivo PDF do Certificado aqui</span>
                                    <span style="font-size:12px; color:#64748b; margin-top:5px;">ou clique no botão acima para selecionar</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <div class="mcm-footer">
                    <button type="button" class="mcm-btn-cancel" id="mcm-btn-cancel">Cancelar</button>
                    <button type="button" class="mcm-btn-save" id="mcm-btn-save">💾 Gravar Calibração</button>
                </div>
            </div>
        `;

        document.body.appendChild(_overlay);

        _bindEvents();
        _renderPointsTable();
    }

    function _bindEvents() {
        const closeBtn = _overlay.querySelector('#mcm-close-x');
        const cancelBtn = _overlay.querySelector('#mcm-btn-cancel');
        const saveBtn = _overlay.querySelector('#mcm-btn-save');

        closeBtn.onclick = _close;
        cancelBtn.onclick = _close;

        // Tabs
        _overlay.querySelectorAll('.mcm-tab-btn').forEach(btn => {
            btn.onclick = () => {
                _overlay.querySelectorAll('.mcm-tab-btn').forEach(b => b.classList.remove('active'));
                _overlay.querySelectorAll('.mcm-tab-content').forEach(c => c.classList.remove('active'));
                btn.classList.add('active');
                const pane = _overlay.querySelector(`#mcm-tab-${btn.dataset.tab}`);
                if (pane) pane.classList.add('active');
            };
        });

        // Instrument selection summary
        const instSelect = _overlay.querySelector('#mcm-instrument');
        const instSummary = _overlay.querySelector('#mcm-inst-summary');
        const instDetails = _overlay.querySelector('#mcm-inst-details');

        instSelect.onchange = () => {
            const val = parseInt(instSelect.value, 10);
            const inst = _instruments.find(i => i.id === val);
            if (inst) {
                instSummary.style.display = 'block';
                instDetails.innerHTML = `
                    <strong>Código:</strong> ${inst.Codigo || inst.Código || inst.id} | 
                    <strong>Descrição:</strong> ${inst.Nome || inst.Descrição || inst.Instrumento || 'N/A'} | 
                    <strong>Fabricante:</strong> ${inst.Fabricante || 'N/A'} | 
                    <strong>Erro Máx. Permitido:</strong> ${inst.ErroMaximo || inst.ErroPermitido || 'Não especificado'}
                `;
            } else {
                instSummary.style.display = 'none';
            }
        };

        // Points Toolbar
        const addPtBtn = _overlay.querySelector('#mcm-btn-add-pt');
        const delPtBtn = _overlay.querySelector('#mcm-btn-del-pt');
        const upPtBtn = _overlay.querySelector('#mcm-btn-up-pt');
        const downPtBtn = _overlay.querySelector('#mcm-btn-down-pt');

        addPtBtn.onclick = () => {
            _points.push({ refValue: '', errorValue: '', uncertainty: '', kFactor: '2.00' });
            _selectedIndex = _points.length - 1;
            _renderPointsTable();
        };

        delPtBtn.onclick = () => {
            if (_selectedIndex >= 0 && _selectedIndex < _points.length) {
                _points.splice(_selectedIndex, 1);
                _selectedIndex = -1;
                _renderPointsTable();
            }
        };

        upPtBtn.onclick = () => {
            if (_selectedIndex > 0) {
                const temp = _points[_selectedIndex];
                _points[_selectedIndex] = _points[_selectedIndex - 1];
                _points[_selectedIndex - 1] = temp;
                _selectedIndex--;
                _renderPointsTable();
            }
        };

        downPtBtn.onclick = () => {
            if (_selectedIndex >= 0 && _selectedIndex < _points.length - 1) {
                const temp = _points[_selectedIndex];
                _points[_selectedIndex] = _points[_selectedIndex + 1];
                _points[_selectedIndex + 1] = temp;
                _selectedIndex++;
                _renderPointsTable();
            }
        };

        // PDF Upload & Drag-Drop
        const pdfInput = _overlay.querySelector('#mcm-pdf-input');
        const pdfBrowseBtn = _overlay.querySelector('#mcm-pdf-browse-btn');
        const uploadZone = _overlay.querySelector('#mcm-upload-zone');

        pdfBrowseBtn.onclick = () => pdfInput.click();
        uploadZone.onclick = () => pdfInput.click();

        uploadZone.ondragover = (e) => {
            e.preventDefault();
            uploadZone.style.background = '#e0f2f1';
        };

        uploadZone.ondragleave = () => {
            uploadZone.style.background = '#f8fafc';
        };

        uploadZone.ondrop = (e) => {
            e.preventDefault();
            uploadZone.style.background = '#f8fafc';
            if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                _handlePdfFile(e.dataTransfer.files[0]);
            }
        };

        pdfInput.onchange = (e) => {
            if (e.target.files && e.target.files.length > 0) {
                _handlePdfFile(e.target.files[0]);
            }
        };

        saveBtn.onclick = _saveCalibration;
    }

    function _handlePdfFile(file) {
        if (!file || file.type !== 'application/pdf') {
            alert('Por favor, selecione um arquivo PDF válido.');
            return;
        }
        _pdfFile = file;
        _pdfUrl = URL.createObjectURL(file);

        const pdfContent = _overlay.querySelector('#mcm-pdf-content');
        pdfContent.innerHTML = `
            <iframe src="${_pdfUrl}" class="mcm-pdf-viewer"></iframe>
        `;
    }

    function _renderPointsTable() {
        const tbody = _overlay.querySelector('#mcm-points-tbl tbody');
        const delPtBtn = _overlay.querySelector('#mcm-btn-del-pt');
        const upPtBtn = _overlay.querySelector('#mcm-btn-up-pt');
        const downPtBtn = _overlay.querySelector('#mcm-btn-down-pt');

        if (!tbody) return;
        tbody.innerHTML = '';

        if (_points.length === 0) {
            tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; color:#94a3b8; padding:20px;">Nenhum ponto adicionado. Clique em "+ Adicionar Ponto".</td></tr>`;
        }

        _points.forEach((pt, idx) => {
            const tr = document.createElement('tr');
            if (idx === _selectedIndex) tr.className = 'selected';

            tr.innerHTML = `
                <td>${idx + 1}</td>
                <td class="mcm-editable-cell"><input type="text" class="mcm-cell-input" data-idx="${idx}" data-field="refValue" value="${pt.refValue}"></td>
                <td class="mcm-editable-cell"><input type="text" class="mcm-cell-input" data-idx="${idx}" data-field="errorValue" value="${pt.errorValue}"></td>
                <td class="mcm-editable-cell"><input type="text" class="mcm-cell-input" data-idx="${idx}" data-field="uncertainty" value="${pt.uncertainty}"></td>
                <td class="mcm-editable-cell"><input type="text" class="mcm-cell-input" data-idx="${idx}" data-field="kFactor" value="${pt.kFactor}"></td>
            `;

            tr.onclick = (e) => {
                if (!e.target.classList.contains('mcm-cell-input')) {
                    _selectedIndex = idx;
                    _renderPointsTable();
                }
            };

            tr.querySelectorAll('.mcm-cell-input').forEach(inp => {
                inp.onfocus = () => {
                    _selectedIndex = idx;
                    _updateToolbarState();
                };
                inp.oninput = (e) => {
                    const field = e.target.dataset.field;
                    _points[idx][field] = e.target.value;
                };
            });

            tbody.appendChild(tr);
        });

        _updateToolbarState();
    }

    function _updateToolbarState() {
        const delPtBtn = _overlay.querySelector('#mcm-btn-del-pt');
        const upPtBtn = _overlay.querySelector('#mcm-btn-up-pt');
        const downPtBtn = _overlay.querySelector('#mcm-btn-down-pt');

        const hasSel = _selectedIndex >= 0 && _selectedIndex < _points.length;
        if (delPtBtn) delPtBtn.disabled = !hasSel;
        if (upPtBtn) upPtBtn.disabled = !hasSel || _selectedIndex === 0;
        if (downPtBtn) downPtBtn.disabled = !hasSel || _selectedIndex === _points.length - 1;
    }

    async function _saveCalibration() {
        const saveBtn = _overlay.querySelector('#mcm-btn-save');
        saveBtn.disabled = true;
        saveBtn.innerText = 'Gravando...';

        try {
            const code = _overlay.querySelector('#mcm-code').value.trim();
            const date = _overlay.querySelector('#mcm-date').value;
            const instId = parseInt(_overlay.querySelector('#mcm-instrument').value, 10) || null;
            const labId = parseInt(_overlay.querySelector('#mcm-laboratory').value, 10) || null;
            const calType = _overlay.querySelector('#mcm-cal-type').value;
            const evaluator = _overlay.querySelector('#mcm-evaluator').value.trim();
            const validation = _overlay.querySelector('#mcm-validation').value;
            const notes = _overlay.querySelector('#mcm-notes').value.trim();

            const tableName = _overlay.querySelector('#mcm-tbl-name').value.trim();
            const tableRange = _overlay.querySelector('#mcm-tbl-range').value.trim();
            const errorMode = _overlay.querySelector('#mcm-tbl-error-mode').value;
            const uncertMode = _overlay.querySelector('#mcm-tbl-uncert-mode').value;

            const recordData = {
                CertificateCode: code || `CAL-${Date.now()}`,
                CALIBRATION_DATE: date,
                Instrument: instId,
                Supplier: labId,
                CalibrationType: calType,
                EvaluatedBy: evaluator,
                ValidationStatus: validation,
                Notes: notes,
                ResultTables: JSON.stringify({
                    tableName,
                    tableRange,
                    errorMode,
                    uncertMode,
                    points: _points
                })
            };

            if (_tableLens) {
                if (_recordId) {
                    await _tableLens.updateRecord(_tableId, _recordId, recordData);
                } else {
                    await _tableLens.updateRecord(_tableId, null, recordData).catch(async () => {
                        // Fallback to dataWriter
                        if (_dataWriter) {
                            await _dataWriter.addRecord(_tableId, recordData);
                        }
                    });
                }
            }

            alert('Calibração cadastrada com sucesso!');
            _close();

            if (typeof _onSavedCallback === 'function') {
                _onSavedCallback();
            }
        } catch (e) {
            console.error('[ManualCalibrationModal] Save error:', e);
            alert('Erro ao gravar calibração: ' + e.message);
        } finally {
            saveBtn.disabled = false;
            saveBtn.innerText = '💾 Gravar Calibração';
        }
    }

    function _close() {
        if (_overlay) {
            _overlay.remove();
            _overlay = null;
        }
        if (_pdfUrl) {
            URL.revokeObjectURL(_pdfUrl);
            _pdfUrl = null;
        }
    }

    return { open };
})();

if (typeof window !== 'undefined') {
    window.ManualCalibrationModal = ManualCalibrationModal;
}
