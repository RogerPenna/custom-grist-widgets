import { openDrawer } from '../libraries/grist-drawer-component/drawer-component.js?v=1.4.2';

let currentRecords = [];
let STAGES = [];

import { openSelectorModal } from '../libraries/grist-modal-component/selector-modal.js';
let currentDashboardConfig = null;

// --- CARREGAMENTO DE ÍCONES ---
async function loadIcons() {
    if (document.getElementById('grist-icons-sprite')) return;
    try {
        const response = await fetch('../libraries/icons/icons.svg');
        if (!response.ok) return;
        const svgText = await response.text();
        const div = document.createElement('div');
        div.id = 'grist-icons-sprite';
        div.style.display = 'none';
        div.innerHTML = svgText;
        document.body.insertBefore(div, document.body.firstChild);
    } catch (error) {
        console.warn('Falha ao carregar ícones no Dashboard:', error);
    }
}
loadIcons();


// Helper function to invoke TableLens/DataWriter methods inside the nested iframe via postMessage RPC
function callIframe(method, args) {
    return new Promise((resolve, reject) => {
        const transactionId = Math.random().toString(36).substr(2, 9);
        const handleResponse = (e) => {
            if (e.data && e.data.action === 'table-lens-response' && e.data.transactionId === transactionId) {
                window.removeEventListener('message', handleResponse);
                if (e.data.error) reject(new Error(e.data.error));
                else resolve(e.data.result);
            }
        };
        window.addEventListener('message', handleResponse);
        
        const viewerIframe = document.querySelector('#pane-0 iframe') || document.querySelector('#pane-inventario iframe');
        if (viewerIframe && viewerIframe.contentWindow) {
            viewerIframe.contentWindow.postMessage({
                action: 'table-lens-request',
                method,
                args,
                transactionId
            }, '*');
        } else {
            window.removeEventListener('message', handleResponse);
            reject(new Error("Iframe de inventário não carregado."));
        }
    });
}

// Javascript Proxy mocks that automatically forward any method calls to the nested iframe
const mockTableLens = new Proxy({}, {
    get: (target, prop) => {
        return async (...args) => callIframe(prop, args);
    }
});

const mockDataWriter = new Proxy({}, {
    get: (target, prop) => {
        return async (...args) => callIframe(prop, args);
    }
});

let ALL_CHOICES = [];

// Register data loaded handler for early head-registered proxy listener
window.onInstrumentsDataLoaded = (data) => {
    console.log("[Dashboard Debug] onInstrumentsDataLoaded received data:", data);
    currentRecords = data.records || [];
    const rawChoices = data.choices || [];
    ALL_CHOICES = rawChoices;
    STAGES = rawChoices.filter(c => c !== "0. Em Uso" && c !== "Em Uso" && c !== "-");
    console.log("[Dashboard Debug] Resolved STAGES list:", STAGES, "Records count:", currentRecords.length);
    
    // Atualiza contadores dos chips, badge de pendências e gaveta
    updatePendencias(currentRecords);

    // Sincronização automática: varre certificados e atualiza datas de última/próxima calibração
    syncInstrumentsWithCertificates(currentRecords);

    // Safely check if the Kanban tab is active using either data-tab or data-tab-type
    const activeBtn = document.querySelector('.tab-btn.active');
    const activeTab = activeBtn ? activeBtn.getAttribute('data-tab') : '';
    const activeTabType = activeBtn ? activeBtn.getAttribute('data-tab-type') : '';
    console.log("[Dashboard Debug] Active tab detected:", activeTab, "Type:", activeTabType);
    
    if (activeTab === 'fluxo' || activeTabType === 'kanban') {
        renderKanban();
    }
};

// --- MÉTODO DE SCHUMACHER (OIML D10 / ISO 10012) ---
function isCertConform(c) {
    const val = getRecordField(c, 'IS_CONFORM', 'Is_Conform', 'CONFORME', 'Conforme');
    if (val === true || val === 1 || val === '1' || val === 'T' || val === 't' || val === 'true') return true;
    if (val && typeof val === 'object' && val.data && (val.data[0] === 84 || val.data[0] === 1)) return true;
    const status = String(getRecordField(c, 'VALIDATION_STATUS', 'STATUS', 'ID_STATUS') || '').toLowerCase();
    if (status.includes('aprov') || status === '1') return true;
    return false;
}

function calculateSchumacher(inst, allInstCerts, typeRecord) {
    const baseFreq = parseFloat(getRecordField(inst, 'CALIBRATION_FREQUENCY_MONTHS', 'CALIBRATION_FREQUENCY')) || 12;
    
    // 1. Determinar política de método (Herdar do Tipo, Schumacher, Fixo)
    const rawInstMethod = String(getRecordField(inst, 'CALIBRATION_METHOD', 'Calibration_Method') || '').trim();
    const rawTypeMethod = String(typeRecord ? getRecordField(typeRecord, 'CALIBRATION_METHOD', 'Calibration_Method') : '').trim();
    
    let isSchumacherActive = false;
    let methodSource = 'Fixo';

    if (rawInstMethod.toLowerCase().includes('schumacher')) {
        isSchumacherActive = true;
        methodSource = 'Instrumento (Forçado)';
    } else if (rawInstMethod.toLowerCase().includes('fixo')) {
        isSchumacherActive = false;
        methodSource = 'Instrumento (Fixo)';
    } else {
        // "Herdar do Tipo" ou vazio
        if (rawTypeMethod.toLowerCase().includes('schumacher')) {
            isSchumacherActive = true;
            methodSource = 'Herdado do Tipo';
        } else {
            isSchumacherActive = false;
            methodSource = 'Padrão / Fixo';
        }
    }

    if (!isSchumacherActive) {
        return {
            isSchumacherActive: false,
            suggestedMonths: baseFreq,
            effectiveMonths: baseFreq,
            observation: `Método Fixo / Padrão (${methodSource}). Intervalo mantido em ${baseFreq} meses.`,
            totalCerts: allInstCerts ? allInstCerts.length : 0,
            conformCerts: 0,
            rate: null
        };
    }

    // 2. Filtrar certificados válidos com data
    const validCerts = (allInstCerts || []).filter(c => {
        const removed = getRecordField(c, 'REMOVED', 'Removed');
        if (removed === 1 || removed === '1') return false;
        const dateVal = getRecordField(c, 'DATE', 'Date', 'CALIBRATION_DATE');
        return dateVal !== null && dateVal !== undefined && dateVal !== '';
    });

    // Ordenar do mais novo para o mais antigo
    validCerts.sort((a, b) => {
        const dateA = toSeconds(getRecordField(a, 'DATE', 'Date')) || 0;
        const dateB = toSeconds(getRecordField(b, 'DATE', 'Date')) || 0;
        return dateB - dateA;
    });

    const totalCerts = validCerts.length;
    const MIN_CERTS = 3;

    if (totalCerts < MIN_CERTS) {
        return {
            isSchumacherActive: true,
            suggestedMonths: baseFreq,
            effectiveMonths: baseFreq,
            observation: `Histórico insuficiente (${totalCerts}/${MIN_CERTS} calibrações mínimas). Mantida frequência padrão de ${baseFreq} meses.`,
            totalCerts,
            conformCerts: validCerts.filter(c => isCertConform(c)).length,
            rate: null
        };
    }

    // Confiabilidade Alvo R0 (padrão 90% = 0.90)
    let targetReliability = 0.90;
    if (typeRecord) {
        const rawTarget = getRecordField(typeRecord, 'TARGET_RELIABILITY_PERCENT', 'Target_Reliability_Percent');
        if (rawTarget && !isNaN(parseFloat(rawTarget)) && parseFloat(rawTarget) > 0) {
            targetReliability = parseFloat(rawTarget) > 1 ? parseFloat(rawTarget) / 100 : parseFloat(rawTarget);
        }
    }

    // Avaliar conformidade do histórico
    let conformCount = 0;
    for (const c of validCerts) {
        if (isCertConform(c)) {
            conformCount++;
        }
    }

    const obsReliability = conformCount / totalCerts;
    const obsPercent = Math.round(obsReliability * 100);
    const targetPercent = Math.round(targetReliability * 100);

    // Coeficiente de amortecimento k = 0.5 (evita saltos desmedidos)
    const k = 0.5;
    let adjustmentFactor = 1.0;

    if (obsReliability >= targetReliability) {
        const delta = (obsReliability - targetReliability) / (1.0 - targetReliability || 0.1);
        adjustmentFactor = 1.0 + (k * delta);
    } else {
        const delta = (obsReliability - targetReliability) / targetReliability;
        adjustmentFactor = 1.0 + (k * delta);
    }

    // Trava de segurança 1: Se a calibração mais recente foi reprovada, proíbe aumento
    const latestCert = validCerts[0];
    const latestConform = isCertConform(latestCert);
    if (!latestConform && adjustmentFactor > 1.0) {
        adjustmentFactor = 0.8; // Força redução de 20%
    }

    // Trava de segurança 2: Limite máximo de variação por ciclo (-50% a +33%)
    adjustmentFactor = Math.max(0.5, Math.min(1.33, adjustmentFactor));

    // Novo intervalo calculado preliminar
    let newFreq = baseFreq * adjustmentFactor;

    // Trava de segurança 3: Pisos e tetos absolutos (Mínimo 6 meses, Máximo 24 meses)
    const MIN_MONTHS = 6;
    const MAX_MONTHS = 24;
    newFreq = Math.max(MIN_MONTHS, Math.min(MAX_MONTHS, newFreq));

    // Arredondamento para o mês inteiro mais próximo
    const suggestedMonths = Math.round(newFreq);

    // Texto de justificativa para auditoria
    let obs = '';
    if (suggestedMonths > baseFreq) {
        obs = `Schumacher: Confiabilidade ${obsPercent}% (${conformCount}/${totalCerts} conformes, meta ${targetPercent}%). Intervalo estendido de ${baseFreq} para ${suggestedMonths} meses.`;
    } else if (suggestedMonths < baseFreq) {
        obs = `Schumacher: Confiabilidade ${obsPercent}% (${conformCount}/${totalCerts} conformes, meta ${targetPercent}%). Intervalo reduzido de ${baseFreq} para ${suggestedMonths} meses devido a não conformidade(s).`;
    } else {
        obs = `Schumacher: Confiabilidade ${obsPercent}% (${conformCount}/${totalCerts} conformes, meta ${targetPercent}%). Intervalo mantido em ${suggestedMonths} meses.`;
    }

    return {
        isSchumacherActive: true,
        suggestedMonths,
        effectiveMonths: suggestedMonths,
        observation: obs,
        totalCerts,
        conformCerts: conformCount,
        rate: obsPercent
    };
}

let isSyncingCertificates = false;
async function syncInstrumentsWithCertificates(instruments) {
    if (isSyncingCertificates || !Array.isArray(instruments) || instruments.length === 0) return;
    isSyncingCertificates = true;
    try {
        const [certs, instTypes] = await Promise.all([
            mockTableLens.fetchTableRecords('EXTERNAL_CALIBRATIONS'),
            mockTableLens.fetchTableRecords('INSTRUMENTS_TYPES').catch(() => [])
        ]);
        if (!certs || certs.length === 0) return;

        function toSeconds(val) {
            if (val === null || val === undefined || val === '') return null;
            if (typeof val === 'number') return val > 1e11 ? Math.floor(val / 1000) : Math.floor(val);
            const num = Number(val);
            if (!isNaN(num) && num > 0) return num > 1e11 ? Math.floor(num / 1000) : Math.floor(num);
            const d = new Date(val);
            return isNaN(d.getTime()) ? null : Math.floor(d.getTime() / 1000);
        }

        function addMonthsSeconds(baseSec, months) {
            if (!baseSec) return null;
            const d = new Date(baseSec * 1000);
            d.setUTCMonth(d.getUTCMonth() + (months > 0 ? months : 12));
            return Math.floor(d.getTime() / 1000);
        }

        const typesById = new Map();
        (instTypes || []).forEach(t => {
            typesById.set(Number(t.id), t);
        });

        // Mapear todos os certificados por instrumento
        const allCertsByInst = new Map();
        certs.forEach(c => {
            const rawInstId = getRecordField(c, 'ID_INSTRUMENT', 'INSTRUMENT', 'Instrumento');
            const instId = Array.isArray(rawInstId) ? rawInstId[0] : (typeof rawInstId === 'object' && rawInstId ? rawInstId.id : rawInstId);
            if (!instId) return;
            const numInstId = Number(instId);
            if (!allCertsByInst.has(numInstId)) allCertsByInst.set(numInstId, []);
            allCertsByInst.get(numInstId).push(c);
        });

        for (const inst of instruments) {
            const instCerts = allCertsByInst.get(Number(inst.id)) || [];
            if (instCerts.length === 0) continue;

            const typeRef = getRecordField(inst, 'ID_INSTRUMENT_TYPE', 'Id_Instrument_Type');
            const typeId = Array.isArray(typeRef) ? typeRef[0] : (typeof typeRef === 'object' && typeRef ? typeRef.id : typeRef);
            const typeRecord = typeId ? typesById.get(Number(typeId)) : null;

            // Calcular intervalo pelo Método de Schumacher
            const schumacherResult = calculateSchumacher(inst, instCerts, typeRecord);

            // Filtrar certificados aprovados para encontrar a última data válida
            const approvedCerts = instCerts.filter(c => {
                const status = String(getRecordField(c, 'VALIDATION_STATUS', 'STATUS', 'Status', 'ID_STATUS') || '').toLowerCase();
                if (status.includes('reprovad') || status === '2') return false;
                const sec = toSeconds(getRecordField(c, 'DATE', 'CALIBRATION_DATE', 'Data'));
                return !!sec;
            }).sort((a, b) => {
                const secA = toSeconds(getRecordField(a, 'DATE', 'CALIBRATION_DATE', 'Data')) || 0;
                const secB = toSeconds(getRecordField(b, 'DATE', 'CALIBRATION_DATE', 'Data')) || 0;
                return secB - secA;
            });

            if (approvedCerts.length === 0) continue;
            const latestCert = approvedCerts[0];
            const latestCertSec = toSeconds(getRecordField(latestCert, 'DATE', 'CALIBRATION_DATE', 'Data'));

            const currentLastCalSec = toSeconds(getRecordField(inst, 'Last_Calibration', 'LAST_CALIBRATION'));
            const currentNextCalSec = toSeconds(getRecordField(inst, 'NEXT_CALIBRATION', 'Next_Calibration'));

            const effectiveMonths = schumacherResult.effectiveMonths || parseFloat(getRecordField(inst, 'CALIBRATION_FREQUENCY_MONTHS', 'CALIBRATION_FREQUENCY')) || 12;
            const expectedNextSec = addMonthsSeconds(latestCertSec, effectiveMonths);

            const currentSchumacherFreq = getRecordField(inst, 'SCHUMACHER_FREQUENCY_MONTHS');
            const currentEffectiveFreq = getRecordField(inst, 'EFFECTIVE_FREQUENCY_MONTHS');
            const currentSchumacherObs = getRecordField(inst, 'SCHUMACHER_OBSERVATION');

            const needsFreqUpdate = currentSchumacherFreq !== schumacherResult.suggestedMonths ||
                                    currentEffectiveFreq !== schumacherResult.effectiveMonths ||
                                    currentSchumacherObs !== schumacherResult.observation;

            const needsDateUpdate = !currentLastCalSec || latestCertSec > currentLastCalSec || !currentNextCalSec || Math.abs(currentNextCalSec - expectedNextSec) > 86400;

            if (needsDateUpdate || needsFreqUpdate) {
                console.log(`[Schumacher/Sync] Atualizando instrumento ${inst.Code || inst.id}:`, {
                    método: schumacherResult.observation,
                    mesesEfetivos: effectiveMonths,
                    de: { last: currentLastCalSec, next: currentNextCalSec },
                    para: { last: latestCertSec, next: expectedNextSec }
                });

                const updatePayload = {
                    SCHUMACHER_FREQUENCY_MONTHS: schumacherResult.suggestedMonths,
                    SCHUMACHER_OBSERVATION: schumacherResult.observation,
                    EFFECTIVE_FREQUENCY_MONTHS: schumacherResult.effectiveMonths
                };

                // Atualizar estado em memória imediatamente
                inst.SCHUMACHER_FREQUENCY_MONTHS = schumacherResult.suggestedMonths;
                inst.SCHUMACHER_OBSERVATION = schumacherResult.observation;
                inst.EFFECTIVE_FREQUENCY_MONTHS = schumacherResult.effectiveMonths;

                if (needsDateUpdate) {
                    updatePayload.Last_Calibration = latestCertSec;
                    updatePayload.NEXT_CALIBRATION = expectedNextSec;
                    inst.Last_Calibration = latestCertSec;
                    inst.NEXT_CALIBRATION = expectedNextSec;
                }

                await mockDataWriter.updateRecord('INSTRUMENTS', inst.id, updatePayload)
                    .catch(e => console.warn(`[Schumacher/Sync] Falha ao atualizar instrumento ${inst.id}:`, e));
            }
        }
    } catch (err) {
        console.warn("[Sync] Erro na varredura de certificados:", err);
    } finally {
        isSyncingCertificates = false;
    }
}

// Handle any cached data received before dashboard.js loaded
if (window.cachedInstrumentsData) {
    window.onInstrumentsDataLoaded(window.cachedInstrumentsData);
}

// Tab switcher logic
const tabBtns = document.querySelectorAll('.tab-btn');
const tabPanes = document.querySelectorAll('.tab-pane');

tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
        tabBtns.forEach(b => b.classList.remove('active'));
        tabPanes.forEach(p => p.classList.remove('active'));

        btn.classList.add('active');
        const targetId = `pane-${btn.dataset.tab}`;
        const targetPane = document.getElementById(targetId);
        if (targetPane) {
            targetPane.classList.add('active');
            const lazyIframe = targetPane.querySelector('iframe[data-src]');
            if (lazyIframe && !lazyIframe.src) {
                lazyIframe.src = lazyIframe.dataset.src;
            }
        }

        if (btn.dataset.tab === 'fluxo') {
            renderKanban();
        }
    });
});

function renderKanban() {
    console.log("[Dashboard Debug] renderKanban executing. STAGES count:", STAGES.length, "Records count:", currentRecords.length);
    const board = document.getElementById('kanban-board-container');
    if (!board) {
        console.warn("[Dashboard Debug] kanban-board-container element not found in DOM.");
        return;
    }
    if (STAGES.length === 0) {
        console.warn("[Dashboard Debug] STAGES list is empty. Rendering fallback placeholder.");
        board.innerHTML = '<div style="padding:20px; text-align:center; color:#64748b; font-style:italic;">Aguardando sincronização da tabela... Certifique-se de que a aba "Inventário Geral" foi carregada.</div>';
        return;
    }

    board.innerHTML = '';

    // Create column elements
    const colContainers = {};
    STAGES.forEach(stageName => {
        const col = document.createElement('div');
        col.className = 'kanban-column';
        col.innerHTML = `
            <div class="kanban-column-header">
                <div style="display:flex;align-items:center;">
                    <span>${stageName}</span>
                    <button class="kanban-add-btn" data-stage="${stageName}" style="background:transparent;border:none;cursor:pointer;color:#64748b;display:flex;align-items:center;justify-content:center;padding:4px;border-radius:4px;margin-left:5px;">
                        <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
                    </button>
                </div>
                <span class="column-count" id="count-${stageName.replace(/[^a-zA-Z0-9]/g, '')}">0</span>
            </div>
            <div class="kanban-cards-container" data-stage="${stageName}"></div>
        `;
        board.appendChild(col);
        colContainers[stageName] = col.querySelector('.kanban-cards-container');
    });

    // Add event listeners to the new add buttons
    board.querySelectorAll('.kanban-add-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const targetStage = btn.getAttribute('data-stage');
            
            // Filter instruments that are not in the target stage
            const availableItems = currentRecords.filter(rec => {
                const currentStage = rec.METROLOGICAL_STAGE || "0. Em Uso";
                return currentStage !== targetStage;
            });
            
            openSelectorModal({
                title: `Adicionar à Coluna: ${targetStage}`,
                items: availableItems,
                searchFn: (item, query) => {
                    const code = String(item.Code || item.CODE || '').toLowerCase();
                    const resp = String(item.z_disp_ID_RESPONSIBLE || item.ID_RESPONSIBLE || '').toLowerCase();
                    const stage = String(item.METROLOGICAL_STAGE || "0. Em Uso").toLowerCase();
                    return code.includes(query) || resp.includes(query) || stage.includes(query);
                },
                renderItem: (item) => {
                    const code = item.Code || item.CODE || 'Sem Código';
                    const resp = item.z_disp_ID_RESPONSIBLE || item.ID_RESPONSIBLE || 'Sem Responsável';
                    const stage = item.METROLOGICAL_STAGE || "0. Em Uso";
                    return `<div><b>${code}</b> - <span style="color:#64748b;">${resp}</span></div><div style="font-size:11px;color:#94a3b8;margin-top:2px;">Estágio: ${stage}</div>`;
                },
                getRowBackground: (item) => {
                    const stage = item.METROLOGICAL_STAGE || "0. Em Uso";
                    if (STAGES.includes(stage)) {
                        return "#fff7ed"; // light orange
                    }
                    return "white";
                },
                onSave: async (selectedIds) => {
                    if (!selectedIds.length) return;
                    try {
                        for (const id of selectedIds) {
                            const inst = currentRecords.find(r => r.id === id);
                            if (inst) inst.METROLOGICAL_STAGE = targetStage;
                            await callIframe('updateRecord', ['INSTRUMENTS', id, { METROLOGICAL_STAGE: targetStage }]);
                        }
                        renderKanban();
                    } catch (err) {
                        console.error("Erro ao adicionar ao grupo:", err);
                    }
                }
            });
        });
    });

    // Populate columns with instrument cards
    let counts = {};
    STAGES.forEach(s => counts[s] = 0);

    currentRecords.forEach(inst => {
        let stage = inst.METROLOGICAL_STAGE || "0. Em Uso";
        if (stage === "0. Em Uso" || !STAGES.includes(stage)) {
            return;
        }

        counts[stage]++;

        const card = document.createElement('div');
        card.className = 'instrument-card';
        card.dataset.id = inst.id;

        const code = getRecordField(inst, 'Code', 'CODE', 'Tag', 'TAG') || `Instrumento #${inst.id}`;
        const serial = getRecordField(inst, 'SERIAL_NUMBER', 'Serial_Number', 'NUMERO_SERIE', 'Numero_Serie');
        const type = getRecordField(inst, 'z_disp_ID_INSTRUMENT_TYPE', 'INSTRUMENT_TYPE', 'TYPE') || 'Sem Tipo';
        const model = getRecordField(inst, 'z_disp_ID_INSTRUMENT_MODEL', 'INSTRUMENT_MODEL', 'MODEL') || 'Sem Modelo';
        const sector = getRecordField(inst, 'z_disp_ID_CURRENT_SECTOR', 'CURRENT_SECTOR', 'SECTOR', 'SETOR');
        const resp = getRecordField(inst, 'z_disp_ID_RESPONSIBLE', 'RESPONSIBLE', 'RESPONSAVEL') || 'Não Atribuído';
        const status = getRecordField(inst, 'z_disp_ID_STATUS', 'STATUS') || 'Disponível';

        // Situation mapping & tooltip
        const situationMap = {
            1: { name: 'Ativo', icon: '✅', desc: 'Em uso normal e calibrado' },
            2: { name: 'Inativo', icon: '❌', desc: 'Desativado temporariamente' },
            3: { name: 'Descartado', icon: '🪦', desc: 'Sucateado / Baixado do patrimônio' },
            4: { name: 'Danificado', icon: '💣', desc: 'Estrutura física quebrada' },
            5: { name: 'Extraviado', icon: '❓', desc: 'Perdido / Não localizado' },
            6: { name: 'Bloqueado', icon: '⛔', desc: 'Calibração reprovada; retido no almoxarifado' }
        };

        const rawSitId = getRecordField(inst, 'ID_SITUATION', 'Id_Situation', 'SITUATION_ID');
        const sitId = rawSitId !== null && rawSitId !== undefined ? parseInt(rawSitId, 10) : null;
        const rawSitIcon = getRecordField(inst, 'z_disp_ID_SITUATION', 'SITUATION', 'SITUACAO');

        let sitIcon = '✅';
        let sitTooltip = 'Situação: Ativo (Em uso normal e calibrado)';

        if (sitId && situationMap[sitId]) {
            sitIcon = situationMap[sitId].icon;
            sitTooltip = `Situação: ${situationMap[sitId].name} (${situationMap[sitId].desc})`;
        } else if (rawSitIcon) {
            sitIcon = String(rawSitIcon).trim();
            const matchedEntry = Object.values(situationMap).find(s => s.icon === sitIcon || s.name.toLowerCase() === sitIcon.toLowerCase());
            if (matchedEntry) {
                sitTooltip = `Situação: ${matchedEntry.name} (${matchedEntry.desc})`;
                sitIcon = matchedEntry.icon;
            } else {
                sitTooltip = `Situação: ${rawSitIcon}`;
            }
        }

        // Status styling & tooltip
        let statusClass = 'disponivel';
        let statusIcon = '🟢';
        let statusTooltip = 'Instrumento disponível para uso';
        const statusStr = String(status).toLowerCase();
        if (statusStr.includes('laborat') || statusStr.includes('externo')) {
            statusClass = 'laboratorio';
            statusIcon = '🔬';
            statusTooltip = 'Instrumento em laboratório externo para calibração/manutenção';
        } else if (statusStr.includes('emprest')) {
            statusClass = 'emprestado';
            statusIcon = '🔄';
            statusTooltip = 'Instrumento emprestado ou em trânsito operacional';
        } else if (statusStr.includes('manuten')) {
            statusClass = 'manutencao';
            statusIcon = '🔧';
            statusTooltip = 'Instrumento em manutenção/ajuste técnico';
        }

        // Calibration validity & expiration status
        const calInfo = getCalibrationStatus(inst);
        const lastCalRaw = getRecordField(inst, 'Last_Calibration', 'LAST_CALIBRATION', 'ULTIMA_CALIBRACAO');
        const lastCalDate = parseDateValue(lastCalRaw);
        const lastCalDisplay = lastCalDate ? formatDateDisplay(lastCalDate) : null;

        const nextCalDate = calInfo.targetDate ? formatDateDisplay(calInfo.targetDate) : (inst.NEXT_CALIBRATION ? formatDateDisplay(parseDateValue(inst.NEXT_CALIBRATION)) : null);

        let calBoxClass = 'cal-none';
        let calBoxIcon = '⚪';
        let calBoxTitle = 'Sem calibração cadastrada';
        let calBoxDays = '';
        let calBoxTooltip = 'Nenhuma data de calibração ou vencimento cadastrada.';

        if (calInfo.status === 'expired') {
            calBoxClass = 'cal-expired';
            calBoxIcon = '🔴';
            const dias = Math.abs(calInfo.daysRemaining);
            calBoxTitle = `Venceu em ${nextCalDate}`;
            calBoxDays = `${dias}d atrás`;
            calBoxTooltip = `Certificado de calibração expirado em ${nextCalDate} (${dias} dias atrás)`;
        } else if (calInfo.status === 'warning') {
            calBoxClass = 'cal-warning';
            calBoxIcon = '⚠️';
            calBoxTitle = `Vence em ${nextCalDate}`;
            calBoxDays = `Faltam ${calInfo.daysRemaining}d`;
            calBoxTooltip = `Certificado vence em breve (${calInfo.daysRemaining} dias restantes até ${nextCalDate})`;
        } else if (calInfo.status === 'ok') {
            calBoxClass = 'cal-ok';
            calBoxIcon = '🟢';
            calBoxTitle = `Válido até ${nextCalDate}`;
            calBoxDays = `${calInfo.daysRemaining}d restantes`;
            calBoxTooltip = `Certificado válido até ${nextCalDate} (${calInfo.daysRemaining} dias restantes)`;
        } else if (calInfo.status === 'inactive') {
            calBoxClass = 'cal-inactive';
            calBoxIcon = '⛔';
            calBoxTitle = 'Fora de Operação';
            calBoxDays = '';
            calBoxTooltip = 'Instrumento inativo, danificado, descartado ou extraviado.';
        }

        const effFreq = getRecordField(inst, 'EFFECTIVE_FREQUENCY_MONTHS', 'Effective_Frequency_Months');
        const schumacherObs = getRecordField(inst, 'SCHUMACHER_OBSERVATION', 'Schumacher_Observation') || '';
        const calMethod = String(getRecordField(inst, 'CALIBRATION_METHOD', 'Calibration_Method') || '').toLowerCase();
        const isSchumacherActive = calMethod.includes('schumacher') || (schumacherObs && schumacherObs.toLowerCase().startsWith('schumacher:'));

        const isLastStage = stage === STAGES[STAGES.length - 1];

        card.innerHTML = `
            <div class="card-header">
                <div class="card-tag-wrapper">
                    <span class="card-tag">${code}</span>
                    ${serial ? `<span class="card-sn" title="Número de Série: ${serial}">N/S: ${serial}</span>` : ''}
                </div>
                <div class="card-status-badges">
                    ${sitIcon ? `<span class="card-situation-icon" title="${sitTooltip}">${sitIcon}</span>` : ''}
                    <span class="card-badge-status ${statusClass}" title="${statusTooltip}">${statusIcon} ${status}</span>
                </div>
            </div>
            <div class="card-type-model" title="${type} - ${model}">
                <strong>${type}</strong>${model && model !== 'Sem Modelo' ? ` · <span class="card-model-text">${model}</span>` : ''}
            </div>
            <div class="card-meta-row">
                ${sector ? `<div class="card-meta-item" title="Setor atual: ${sector}">📍 ${sector}</div>` : ''}
                <div class="card-meta-item" title="Responsável: ${resp}">👤 ${resp}</div>
            </div>
            <div class="card-calib-box ${calBoxClass}" title="${calBoxTooltip}">
                <div class="card-calib-header">
                    <span class="card-calib-status-text">${calBoxIcon} ${calBoxTitle}</span>
                    ${calBoxDays ? `<span class="card-calib-days">${calBoxDays}</span>` : ''}
                </div>
                ${lastCalDisplay ? `
                    <div class="card-calib-sub">
                        <span>Último certificado: <strong>${lastCalDisplay}</strong></span>
                        ${isSchumacherActive ? `<span class="card-badge-schumacher" title="${schumacherObs}">⚡ Schumacher: ${effFreq || 12}m</span>` : ''}
                    </div>
                ` : (isSchumacherActive ? `
                    <div class="card-calib-sub">
                        <span></span>
                        <span class="card-badge-schumacher" title="${schumacherObs}">⚡ Schumacher: ${effFreq || 12}m</span>
                    </div>
                ` : '')}
            </div>
            ${isLastStage ? `
                <div class="card-complete-action" style="margin-top: 8px; border-top: 1px solid #f1f5f9; padding-top: 6px; text-align: right;">
                    <button class="btn-complete-flow" style="background: var(--accent); color: white; border: none; padding: 4px 8px; border-radius: 4px; font-size: 10px; font-weight: bold; cursor: pointer; display: inline-flex; align-items: center; gap: 4px; transition: opacity 0.2s;">
                        Concluir e Retornar ✓
                    </button>
                </div>
            ` : ''}
        `;

        // Card click selection - Opens Details Drawer directly on the parent window!
        card.addEventListener('click', async () => {
            document.querySelectorAll('.instrument-card').forEach(c => c.style.borderColor = '#e2e8f0');
            card.style.borderColor = 'var(--primary)';

            try {
                const mapping = currentDashboardConfig?.mapping || {};
                const drawerId = mapping.kanbanDrawerConfigId || "drawerinstruments";
                const drawerCfg = await mockTableLens.fetchConfig(drawerId);
                await openDrawer('INSTRUMENTS', inst.id, { 
                    ...drawerCfg, 
                    tableLens: mockTableLens,
                    dataWriter: mockDataWriter,
                    mode: 'view'
                });
            } catch (err) {
                console.error("[Dashboard] Erro ao abrir gaveta de detalhes:", err);
            }
        });

        if (isLastStage) {
            const btnComplete = card.querySelector('.btn-complete-flow');
            if (btnComplete) {
                btnComplete.addEventListener('click', async (e) => {
                    e.stopPropagation(); // Avoid opening the drawer!
                    btnComplete.disabled = true;
                    btnComplete.innerText = "Salvando...";
                    
                    const normalStage = ALL_CHOICES.find(c => c === '-' || c === '0. Em Uso') || '-';
                    try {
                        inst.METROLOGICAL_STAGE = normalStage;
                        inst.ID_STATUS = 1;
                        await mockDataWriter.updateRecord('INSTRUMENTS', inst.id, {
                            METROLOGICAL_STAGE: normalStage,
                            ID_STATUS: 1 // back to standard Active status
                        });
                        renderKanban();
                    } catch (err) {
                        console.error("[Dashboard] Erro ao finalizar fluxo:", err);
                        btnComplete.disabled = false;
                        btnComplete.innerText = "Concluir e Retornar ✓";
                    }
                });
            }
        }

        if (colContainers[stage]) {
            colContainers[stage].appendChild(card);
        }
    });

    // Update column counters
    STAGES.forEach(stageName => {
        const cleanName = stageName.replace(/[^a-zA-Z0-9]/g, '');
        const badge = document.getElementById(`count-${cleanName}`);
        if (badge) badge.textContent = counts[stageName];
    });

    // Initialize Sortable on each cards container
    STAGES.forEach(stageName => {
        const container = colContainers[stageName];
        new Sortable(container, {
            group: 'kanban',
            animation: 150,
            ghostClass: 'sortable-ghost',
            chosenClass: 'sortable-chosen',
            onEnd: async (evt) => {
                const itemEl = evt.item;
                const targetStage = evt.to.dataset.stage;
                const oldStage = evt.from.dataset.stage;
                const recordId = parseInt(itemEl.dataset.id, 10);
                
                if (recordId && targetStage) {
                    console.log(`[Kanban] Mover registro ${recordId} de "${oldStage}" para "${targetStage}"`);
                    
                    // 1. Atualizar imediatamente no estado local em memória para manter persistência ao alternar abas
                    const inst = currentRecords.find(r => r.id === recordId);
                    if (inst) {
                        inst.METROLOGICAL_STAGE = targetStage;
                        if (targetStage.includes("5. Enviado")) {
                            inst.ID_STATUS = 3;
                        } else {
                            inst.ID_STATUS = 1;
                        }
                    }

                    const updates = { METROLOGICAL_STAGE: targetStage };
                    if (targetStage.includes("5. Enviado")) {
                        updates.ID_STATUS = 3; // Em Laboratório Externo
                    } else {
                        updates.ID_STATUS = 1; // Disponível
                    }

                    const occurrenceData = {
                        ID_INSTRUMENT: recordId,
                        DATE: new Date().toISOString().split('T')[0] + 'T12:00:00Z',
                        REAL_DATE: new Date().toISOString().split('T')[0] + 'T12:00:00Z',
                        COMMENTS: `Estágio logístico alterado no Kanban para: ${targetStage}`,
                        ID_SITUATION: 1 // Ativo
                    };

                    try {
                        await mockDataWriter.updateRecord('INSTRUMENTS', recordId, updates);
                        try {
                            await mockDataWriter.addRecord('INSTRUMENTS_OCCURRENCES', occurrenceData);
                        } catch(e) {
                            console.warn("[Kanban] Registro de ocorrência secundária ignorado:", e.message);
                        }
                    } catch(err) {
                        console.error("[Kanban] Erro ao salvar novo estágio no Grist:", err);
                        // Reverte estado local se a gravação no Grist falhar
                        if (inst) inst.METROLOGICAL_STAGE = oldStage;
                        renderKanban();
                    }
                }
            }
        });
    });
}

function renderDashboard(configRecord = null) {
    currentDashboardConfig = configRecord || {};
    const config = currentDashboardConfig;
    const styling = config.styling || config || {};
    const mapping = config.mapping || config || {};

    // 1. Apply colors to root variables
    const root = document.documentElement;
    if (styling.primaryColor) root.style.setProperty('--primary', styling.primaryColor);
    if (styling.hoverColor) root.style.setProperty('--primary-hover', styling.hoverColor);
    if (styling.accentColor) root.style.setProperty('--accent', styling.accentColor);
    if (styling.bgCanvas) root.style.setProperty('--bg-canvas', styling.bgCanvas);

    // 2. Apply title and version
    const titleEl = document.querySelector('.header-title h1');
    if (titleEl) {
        const versionSuffix = styling.version ? ` <span style="font-size:11px; opacity:0.75; margin-left:6px;">${styling.version}</span>` : '';
        titleEl.innerHTML = (styling.title || 'Painel Metrológico') + versionSuffix;
    }

    // 3. Render dynamic tabs
    const menuItems = mapping.menuItems || [
        { label: 'Inventário Geral', icon: 'icon-dashboard', type: 'viewer', targetConfigId: 'tableinstruments' },
        { label: 'Fluxo (Kanban)', icon: 'icon-column', type: 'kanban', targetConfigId: 'kanban' },
        { label: 'Importador', icon: 'icon-download', type: 'importador', targetConfigId: 'importador' },
        { label: 'Certificados Terceiros', icon: 'icon-sheet-icon', type: 'viewer', targetConfigId: 'tableexternalcalibrations' },
        { 
            label: 'Configurações', 
            icon: 'icon-process-cogs', 
            type: 'submenu', 
            targetConfigId: 'config', 
            subItems: [
                { label: 'Colunas do Painel Geral', icon: 'icon-column', type: 'config-columns', targetConfigId: 'tableinstruments', group: 'Painel Geral' },
                { label: 'Colunas do Painel de Certificados', icon: 'icon-column', type: 'config-columns', targetConfigId: 'tableexternalcalibrations', group: 'Certificados' },
                { label: 'Estágios do Kanban', icon: 'icon-kanban', type: 'config-kanban-stages', targetConfigId: 'kanban-stages', group: 'Kanban' }
            ] 
        }
    ];

    const tabsNav = document.querySelector('.tabs-nav');
    const mainContainer = document.querySelector('main');

    if (!tabsNav || !mainContainer) return;

    // Check if the tabs structure is already identical to avoid reloading frames
    const existingButtons = Array.from(tabsNav.querySelectorAll('.tab-btn'));
    const isSameStructure = existingButtons.length === menuItems.length && menuItems.every((item, idx) => {
        const btn = existingButtons[idx];
        const labelLower = item.label.toLowerCase();
        let targetType = item.type || 'viewer';
        if (targetType !== 'submenu') {
            if (item.targetConfigId === 'kanban' || labelLower.includes('kanban') || labelLower.includes('fluxo')) {
                targetType = 'kanban';
            } else if (item.targetConfigId === 'importador' || labelLower.includes('importador')) {
                targetType = 'importador';
            }
        }
        const btnText = btn.querySelector('span') ? btn.querySelector('span').innerText : btn.innerText;
        return btnText === item.label && btn.getAttribute('data-tab-type') === targetType;
    });

    const configBtn = document.getElementById('btn-dash-config');
    if (configBtn) {
        configBtn.onclick = () => {
            const viewerIframe = document.querySelector('main .tab-pane iframe[src*="UniversalViewer"]');
            if (viewerIframe && viewerIframe.contentWindow) {
                viewerIframe.contentWindow.postMessage({
                    action: 'open-dashboard-config',
                    configId: currentDashboardConfig?.configId || ''
                }, '*');
            } else {
                alert("Nenhuma aba do tipo Visualizador foi encontrada. Crie pelo menos uma aba do tipo Visualizador para poder acessar as configurações.");
            }
        };
    }

    if (isSameStructure) {
        return;
    }

    tabsNav.innerHTML = '';
    mainContainer.innerHTML = '';

    menuItems.forEach((item, idx) => {
        const btn = document.createElement('button');
        btn.className = `tab-btn ${idx === 0 ? 'active' : ''}`;
        btn.setAttribute('data-tab', `pane-${idx}`);
        
        let tabType = item.type || 'viewer';
        const labelLower = item.label.toLowerCase();
        if (tabType !== 'submenu') {
            if (item.targetConfigId === 'kanban' || labelLower.includes('kanban') || labelLower.includes('fluxo')) {
                tabType = 'kanban';
            } else if (item.targetConfigId === 'importador' || labelLower.includes('importador')) {
                tabType = 'importador';
            }
        }
        btn.setAttribute('data-tab-type', tabType);

        if (item.icon) {
            btn.innerHTML = `<svg style="width:14px; height:14px; fill:currentColor; stroke:currentColor; stroke-width:0.5px; margin-right:6px;"><use href="#${item.icon}"></use></svg><span>${item.label}</span>`;
        } else {
            btn.innerText = item.label;
        }

        const pane = document.createElement('div');
        pane.id = `pane-${idx}`;
        pane.className = `tab-pane ${idx === 0 ? 'active' : ''}`;

        if (tabType === 'kanban') {
            pane.innerHTML = `<div class="kanban-board" id="kanban-board-container"></div>`;
        } else if (tabType === 'importador') {
            pane.innerHTML = `<iframe src="./importador-calibracoes.html"></iframe>`;
        } else if (tabType === 'submenu') {
            let subItems = Array.isArray(item.subItems) ? [...item.subItems] : [];
            
            // Garantir que os 3 itens de configuração solicitados estejam sempre presentes na aba Config
            const reqItems = [
                { label: 'Colunas do Painel Geral', icon: 'icon-column', type: 'config-columns', targetConfigId: 'tableinstruments', group: 'Painel Geral e Certificados' },
                { label: 'Colunas do Painel de Certificados', icon: 'icon-column', type: 'config-columns', targetConfigId: 'tableexternalcalibrations', group: 'Painel Geral e Certificados' },
                { label: 'Estágios do Kanban', icon: 'icon-kanban', type: 'config-kanban-stages', targetConfigId: 'kanban-stages', group: 'Fluxo Kanban' }
            ];

            reqItems.forEach(req => {
                const exists = subItems.some(s => s.targetConfigId === req.targetConfigId || s.label === req.label);
                if (!exists) {
                    subItems.unshift(req);
                }
            });
            
            // Group the items
            const grouped = {};
            subItems.forEach((sub) => {
                const g = sub.group || 'Geral';
                if (!grouped[g]) grouped[g] = [];
                grouped[g].push(sub);
            });

            let contentHtml = '';
            
            // Render groups
            const groups = Object.keys(grouped);
            const showHeaders = groups.length > 1 || (groups.length === 1 && groups[0] !== 'Sem Grupo');

            groups.forEach(groupName => {
                if (showHeaders) {
                    contentHtml += `<h3 style="grid-column: 1/-1; margin: 15px 0 5px 0; font-size: 14px; color: var(--primary); border-bottom: 2px solid var(--primary-light); padding-bottom: 5px;">${groupName}</h3>`;
                }
                
                grouped[groupName].forEach(sub => {
                    const iconSvg = sub.icon ? `<svg style="width:20px; height:20px; fill:currentColor; stroke:currentColor; stroke-width:0.5px;"><use href="#${sub.icon}"></use></svg>` : `⚙️`;
                    const isKanban = sub.type === 'config-kanban-stages' || sub.targetConfigId === 'kanban-stages';
                    const isConfigCols = sub.type === 'config-columns' || sub.targetConfigId === 'tableinstruments' || sub.targetConfigId === 'tableexternalcalibrations';
                    
                    contentHtml += `
                        <div class="submenu-card" data-config-id="${sub.targetConfigId}" data-label="${sub.label}" data-type="${sub.type || ''}" style="background: white; border: 1px solid #cbd5e1; border-radius: 8px; padding: 20px; box-shadow: var(--shadow-sm); cursor: pointer; transition: transform 0.2s, box-shadow 0.2s; display: flex; align-items: center; gap: 15px; border-left: 4px solid var(--primary);">
                            <div class="submenu-card-icon" style="background: var(--primary-light); color: var(--primary); width: 40px; height: 40px; border-radius: 8px; display: flex; align-items: center; justify-content: center; font-size: 20px;">
                                ${iconSvg}
                            </div>
                            <div style="flex:1;">
                                <div style="font-weight: 700; font-size: 14px; color: var(--text-main);">${sub.label}</div>
                                <div style="font-size: 11px; color: var(--text-sub); margin-top:2px;">${isKanban ? 'Gerenciar estágios do fluxo Kanban' : isConfigCols ? 'Configurar colunas e exibição' : 'Clique para ver / editar dados'}</div>
                            </div>
                        </div>
                    `;
                });
            });

            pane.innerHTML = `
                <div class="submenu-viewport" style="display:flex; flex-direction:column; width:100%; height:100%; min-height:0; flex:1;">
                    <div class="submenu-grid-view" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(225px, 1fr)); gap: 20px; padding: 25px; overflow-y:auto; flex:1; min-height:0; align-content:start;">
                        ${contentHtml || '<div style="grid-column:1/-1; text-align:center; color:#64748b; font-style:italic; padding:40px;">Nenhum atalho configurado para este sub-menu.</div>'}
                    </div>
                    <div class="submenu-detail-view" style="display:none; flex-direction:column; flex:1; min-height:0; width:100%; height:100%;">
                        <div class="submenu-detail-header" style="padding:10px 15px; background:#fff; border-bottom:1px solid #cbd5e1; display:flex; align-items:center; justify-content:space-between;">
                            <div style="display:flex; align-items:center; gap:10px;">
                                <button class="btn-submenu-back" style="background:var(--primary); color:#fff; border:none; padding:6px 12px; border-radius:4px; font-size:11px; font-weight:bold; cursor:pointer; display:flex; align-items:center; gap:4px;">◀ Voltar para Menu</button>
                                <span class="submenu-detail-title" style="font-weight:700; font-size:13px; color:var(--text-main);">Configuração</span>
                            </div>
                            <button id="btn-detail-config-columns" style="background:#2563eb; color:#ffffff; border:none; padding:6px 14px; border-radius:4px; font-size:11px; font-weight:bold; cursor:pointer; display:flex; align-items:center; gap:6px; box-shadow:0 2px 4px rgba(37,99,235,0.25);">
                                ⚙️ Configurar Colunas
                            </button>
                        </div>
                        <div class="submenu-detail-iframe-container" style="flex:1; min-height:0; width:100%; height:100%;">
                            <iframe src="" style="width:100%; height:100%; border:none;"></iframe>
                        </div>
                    </div>
                </div>
            `;

            const gridView = pane.querySelector('.submenu-grid-view');
            const detailView = pane.querySelector('.submenu-detail-view');
            const detailTitle = pane.querySelector('.submenu-detail-title');
            const detailIframe = pane.querySelector('.submenu-detail-iframe-container iframe');
            const backBtn = pane.querySelector('.btn-submenu-back');
            const detailConfigBtn = pane.querySelector('#btn-detail-config-columns');

            let currentActiveConfigId = '';

            const handleOpenTableConfig = (targetConfigId) => {
                if (detailIframe.contentWindow) {
                    detailIframe.contentWindow.postMessage({
                        action: 'open-table-config',
                        configId: targetConfigId
                    }, '*');
                }
            };

            const handleView = (targetConfigId, label, openConfigAfterLoad = false) => {
                currentActiveConfigId = targetConfigId;
                gridView.style.display = 'none';
                detailView.style.display = 'flex';
                detailTitle.innerText = label;
                
                const currentSrc = detailIframe.getAttribute('src');
                const targetSrc = `../UniversalViewer/index.html?configId=${targetConfigId}`;
                
                if (!currentSrc || !currentSrc.includes(targetConfigId)) {
                    detailIframe.src = targetSrc;
                    if (openConfigAfterLoad) {
                        const onLoadHandler = () => {
                            detailIframe.removeEventListener('load', onLoadHandler);
                            setTimeout(() => handleOpenTableConfig(targetConfigId), 500);
                        };
                        detailIframe.addEventListener('load', onLoadHandler);
                    }
                } else {
                    detailIframe.contentWindow.postMessage({
                        action: 'change-config',
                        configId: targetConfigId
                    }, '*');
                    if (openConfigAfterLoad) {
                        setTimeout(() => handleOpenTableConfig(targetConfigId), 300);
                    }
                }
            };

            if (detailConfigBtn) {
                detailConfigBtn.onclick = () => {
                    if (currentActiveConfigId) {
                        handleOpenTableConfig(currentActiveConfigId);
                    }
                };
            }

            pane.querySelectorAll('.submenu-card').forEach(card => {
                card.onclick = async () => {
                    const cfgId = card.dataset.configId;
                    const label = card.dataset.label;
                    const cardType = card.dataset.type;

                    if (cardType === 'config-kanban-stages' || cfgId === 'kanban-stages') {
                        await openKanbanStageManager();
                        return;
                    }

                    if (cardType === 'config-columns' || cfgId === 'tableinstruments' || cfgId === 'tableexternalcalibrations') {
                        handleView(cfgId, label, true);
                        return;
                    }

                    // Standard config card behavior (original)
                    handleView(cfgId, label, false);
                };
            });

            backBtn.onclick = () => {
                // Keep the iframe loaded, just tell it to clear data if needed
                if (detailIframe.contentWindow && detailIframe.getAttribute('src') !== '') {
                    detailIframe.contentWindow.postMessage({ action: 'change-config', configId: '' }, '*');
                }
                detailView.style.display = 'none';
                gridView.style.display = 'grid';
            };
        } else {
            pane.innerHTML = `<iframe src="../UniversalViewer/index.html?configId=${item.targetConfigId || ''}"></iframe>`;
        }

        btn.onclick = () => {
            tabsNav.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
            mainContainer.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));
            
            btn.classList.add('active');
            pane.classList.add('active');
            
            if (tabType === 'kanban') {
                renderKanban();
            } else if (tabType === 'submenu') {
                const gridView = pane.querySelector('.submenu-grid-view');
                const detailView = pane.querySelector('.submenu-detail-view');
                const detailIframe = pane.querySelector('.submenu-detail-iframe-container iframe');
                if (detailIframe) detailIframe.src = '';
                if (detailView) detailView.style.display = 'none';
                if (gridView) gridView.style.display = 'grid';
            }
        };

        tabsNav.appendChild(btn);
        mainContainer.appendChild(pane);
    });

    const firstItem = menuItems[0];
    if (firstItem && (firstItem.targetConfigId === 'kanban' || firstItem.label.toLowerCase().includes('kanban') || firstItem.label.toLowerCase().includes('fluxo'))) {
        renderKanban();
    }
}

window.onDashboardConfigLoaded = (configRecord) => {
    try {
        renderDashboard(configRecord);
    } catch(err) {
        console.error("[Dashboard] Error applying loaded configuration:", err);
    }
};

if (window.cachedDashboardConfig) {
    window.onDashboardConfigLoaded(window.cachedDashboardConfig);
}

// ==========================================================================
// PENDÊNCIAS DE CALIBRAÇÃO & SMART FILTER CHIPS
// ==========================================================================

let pendenciasData = {
    allCount: 0,
    expiredCount: 0,
    warningCount: 0,
    okCount: 0,
    inactiveCount: 0,
    expiredList: [],
    warningList: []
};

let currentDrawerFilter = 'all';

// Helper para extrair campo de forma robusta e case-insensitive, seja direto no record ou em record.fields
function getRecordField(r, ...fieldNames) {
    if (!r) return null;
    for (const fn of fieldNames) {
        if (r[fn] !== undefined && r[fn] !== null) return r[fn];
        if (r.fields && r.fields[fn] !== undefined && r.fields[fn] !== null) return r.fields[fn];
    }
    // Case-insensitive search
    const lowerMap = {};
    for (const k of Object.keys(r)) lowerMap[k.toLowerCase()] = r[k];
    if (r.fields) {
        for (const k of Object.keys(r.fields)) lowerMap[k.toLowerCase()] = r.fields[k];
    }
    for (const fn of fieldNames) {
        const val = lowerMap[fn.toLowerCase()];
        if (val !== undefined && val !== null) return val;
    }
    return null;
}

// Converter datas e timestamps (incluindo timestamps UNIX em segundos do Grist)
function parseDateValue(val) {
    if (val === null || val === undefined || val === '') return null;
    if (val instanceof Date) return isNaN(val.getTime()) ? null : val;
    if (typeof val === 'number') {
        // Grist armazena datas em segundos (< 10000000000)
        return new Date(val < 10000000000 ? val * 1000 : val);
    }
    const num = Number(val);
    if (!isNaN(num) && num > 0) {
        return new Date(num < 10000000000 ? num * 1000 : num);
    }
    const d = new Date(val);
    return isNaN(d.getTime()) ? null : d;
}

function formatDateDisplay(d) {
    if (!d) return 'S/ Data';
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    return `${day}/${month}/${year}`;
}

// --- VERIFICAÇÃO DE INSTRUMENTO FORA DE OPERAÇÃO ---
function isInstrumentOutOfService(record) {
    const sitId = getRecordField(record, 'ID_SITUATION', 'Id_Situation', 'ID_STATUS', 'SITUATION_ID', 'STATUS_ID');
    if (sitId !== undefined && sitId !== null) {
        const numId = parseInt(sitId, 10);
        // 1 = Ativo; 2 = Inativo, 3 = Descartado, 4 = Danificado, 5 = Extraviado
        if (numId > 1) return true;
    }
    const sitDisp = String(getRecordField(record, 'z_disp_ID_SITUATION', 'SITUATION', 'STATUS', 'SITUACAO', 'STATE') || '').toLowerCase();
    if (sitDisp.includes('❌') || sitDisp.includes('🪦') || sitDisp.includes('💣') || sitDisp.includes('❓')) return true;
    const outOfServiceKeywords = [
        'danificado', 'estragado', 'extraviado', 'descartado', 
        'inativo', 'fora de uso', 'perdido', 'baixado', 'obsoleto'
    ];
    return outOfServiceKeywords.some(kw => sitDisp.includes(kw));
}

// --- CÁLCULO DE STATUS DE CALIBRAÇÃO ---
function getCalibrationStatus(record) {
    if (isInstrumentOutOfService(record)) {
        return { status: 'inactive', label: 'Fora de Uso', daysRemaining: null, color: '#64748b', targetDate: null };
    }
    const nextCal = getRecordField(record, 'NEXT_CALIBRATION', 'Next_Calibration', 'PROXIMA_CALIBRACAO', 'Proxima_Calibracao');
    const targetDate = parseDateValue(nextCal);
    if (!targetDate) {
        return { status: 'none', label: 'Sem Data', daysRemaining: null, color: '#94a3b8', targetDate: null };
    }
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const target = new Date(targetDate);
    target.setHours(0, 0, 0, 0);
    const diffTime = target.getTime() - today.getTime();
    const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays <= 0) {
        return { status: 'expired', label: 'Vencida', daysRemaining: diffDays, color: '#ef4444', targetDate };
    } else if (diffDays <= 30) {
        return { status: 'warning', label: 'A Vencer', daysRemaining: diffDays, color: '#f59e0b', targetDate };
    } else {
        return { status: 'ok', label: 'Em Dia', daysRemaining: diffDays, color: '#10b981', targetDate };
    }
}

// --- ATUALIZAÇÃO DA UI DE PENDÊNCIAS E CONTADORES ---
function updatePendencias(records) {
    if (!records || !Array.isArray(records)) return;

    let allCount = records.length;
    let expiredCount = 0;
    let warningCount = 0;
    let okCount = 0;
    let inactiveCount = 0;
    let expiredList = [];
    let warningList = [];

    records.forEach(record => {
        const calInfo = getCalibrationStatus(record);
        if (calInfo.status === 'inactive') {
            inactiveCount++;
        } else if (calInfo.status === 'expired') {
            expiredCount++;
            expiredList.push({ record, calInfo });
        } else if (calInfo.status === 'warning') {
            warningCount++;
            warningList.push({ record, calInfo });
        } else if (calInfo.status === 'ok') {
            okCount++;
        }
    });

    // Ordenar listas por prazo (vencidas há mais tempo primeiro, e as que vencem logo primeiro)
    expiredList.sort((a, b) => (a.calInfo.daysRemaining || 0) - (b.calInfo.daysRemaining || 0));
    warningList.sort((a, b) => (a.calInfo.daysRemaining || 0) - (b.calInfo.daysRemaining || 0));

    pendenciasData = {
        allCount,
        expiredCount,
        warningCount,
        okCount,
        inactiveCount,
        expiredList,
        warningList
    };

    // Atualizar Contadores dos Chips
    const countAllEl = document.getElementById('count-all');
    if (countAllEl) countAllEl.innerText = allCount;
    const countExpEl = document.getElementById('count-expired');
    if (countExpEl) countExpEl.innerText = expiredCount;
    const countWarnEl = document.getElementById('count-warning');
    if (countWarnEl) countWarnEl.innerText = warningCount;
    const countOkEl = document.getElementById('count-ok');
    if (countOkEl) countOkEl.innerText = okCount;
    const countInactEl = document.getElementById('count-inactive');
    if (countInactEl) countInactEl.innerText = inactiveCount;

    // Atualizar Badge do Sino de Pendências (apenas Vencidos + A Vencer)
    const totalPendencias = expiredCount + warningCount;
    const badgeCountEl = document.getElementById('badge-pendencias-count');
    if (badgeCountEl) {
        badgeCountEl.innerText = totalPendencias;
        badgeCountEl.style.display = totalPendencias > 0 ? 'inline-block' : 'none';
    }

    // Atualizar Contadores da Gaveta
    const tabAllEl = document.getElementById('drawer-tab-all-count');
    if (tabAllEl) tabAllEl.innerText = totalPendencias;
    const tabExpEl = document.getElementById('drawer-tab-expired-count');
    if (tabExpEl) tabExpEl.innerText = expiredCount;
    const tabWarnEl = document.getElementById('drawer-tab-warning-count');
    if (tabWarnEl) tabWarnEl.innerText = warningCount;

    // Banner da Sessão (se não tiver sido dispensado na sessão atual)
    const sessionBanner = document.getElementById('session-alert-banner');
    const isDismissed = sessionStorage.getItem('pendencias_banner_dismissed') === 'true';
    if (sessionBanner && totalPendencias > 0 && !isDismissed) {
        const bannerText = document.getElementById('session-alert-text');
        if (bannerText) {
            let msg = `Atenção: Existem `;
            if (expiredCount > 0 && warningCount > 0) {
                msg += `<strong>${expiredCount}</strong> calibrações vencidas e <strong>${warningCount}</strong> a vencer nos próximos 30 dias.`;
            } else if (expiredCount > 0) {
                msg += `<strong>${expiredCount}</strong> calibrações vencidas.`;
            } else {
                msg += `<strong>${warningCount}</strong> calibrações a vencer nos próximos 30 dias.`;
            }
            bannerText.innerHTML = msg;
        }
        sessionBanner.style.display = 'flex';
    }

    renderDrawerPendenciasList();
}

// --- RENDERIZAÇÃO DOS CARDS NA GAVETA DE PENDÊNCIAS ---
function renderDrawerPendenciasList() {
    const listContainer = document.getElementById('drawer-pendencias-list');
    if (!listContainer) return;
    listContainer.innerHTML = '';

    let itemsToShow = [];
    if (currentDrawerFilter === 'all') {
        itemsToShow = [...pendenciasData.expiredList, ...pendenciasData.warningList];
    } else if (currentDrawerFilter === 'expired') {
        itemsToShow = pendenciasData.expiredList;
    } else if (currentDrawerFilter === 'warning') {
        itemsToShow = pendenciasData.warningList;
    }

    if (itemsToShow.length === 0) {
        listContainer.innerHTML = `
            <div class="pendencia-empty">
                <span>🎉 Nenhuma pendência nesta categoria!</span>
            </div>
        `;
        return;
    }

    itemsToShow.forEach(item => {
        const r = item.record;
        const cal = item.calInfo;
        const isExp = cal.status === 'expired';
        const card = document.createElement('div');
        card.className = `pendencia-card ${isExp ? 'card-expired' : 'card-warning'}`;

        const code = getRecordField(r, 'Code', 'CODE', 'Tag', 'TAG', 'Codigo') || `ID #${r.id}`;
        const type = getRecordField(r, 'z_disp_ID_INSTRUMENT_TYPE', 'TYPE', 'Type', 'DESCRIPTION', 'Description', 'Faixas') || 'Instrumento';
        const nextCalDate = formatDateDisplay(cal.targetDate);
        const days = cal.daysRemaining;
        let daysText = '';
        if (isExp) {
            const absDays = Math.abs(days);
            if (absDays === 0) {
                daysText = 'Vence hoje!';
            } else if (absDays >= 365) {
                const anos = (absDays / 365.25).toFixed(1);
                daysText = `Venceu há ${anos} anos (${absDays}d)`;
            } else {
                daysText = `Venceu há ${absDays}d`;
            }
        } else {
            daysText = days === 1 ? 'Vence amanhã' : `Vence em ${days}d`;
        }

        card.innerHTML = `
            <div class="pendencia-header">
                <span style="font-weight: 700; color: #1e293b;">${code}</span>
                <span style="font-size: 11px; font-weight: 500; color: #64748b;">📅 ${nextCalDate}</span>
            </div>
            <div class="pendencia-type">${type}</div>
            <div class="pendencia-footer">
                <span class="badge-status-pend ${isExp ? 'badge-expired' : 'badge-warning'}">
                    ${isExp ? '🔴 ' : '🟡 '}${cal.label}
                </span>
                <span style="font-weight: 600; color: ${isExp ? '#dc2626' : '#d97706'}; font-size: 11px;">
                    ${daysText}
                </span>
            </div>
        `;

        // Clique no card abre a gaveta de detalhes do instrumento
        card.addEventListener('click', async () => {
            closePendenciasDrawer();
            try {
                const mapping = currentDashboardConfig?.mapping || {};
                const drawerId = mapping.kanbanDrawerConfigId || "drawerinstruments";
                const drawerCfg = await mockTableLens.fetchConfig(drawerId);
                await openDrawer('INSTRUMENTS', r.id, { 
                    ...drawerCfg, 
                    tableLens: mockTableLens,
                    dataWriter: mockDataWriter,
                    mode: 'view'
                });
            } catch (err) {
                console.error("[Dashboard] Erro ao abrir gaveta de detalhes da pendência:", err);
            }
        });

        listContainer.appendChild(card);
    });
}

// --- COPIAR LISTA DE PENDÊNCIAS PARA ORÇAMENTO (E-MAIL) ---
function copyOrcamentoList() {
    let items = [];
    if (currentDrawerFilter === 'all') {
        items = [...(pendenciasData?.expiredList || []), ...(pendenciasData?.warningList || [])];
    } else if (currentDrawerFilter === 'expired') {
        items = pendenciasData?.expiredList || [];
    } else if (currentDrawerFilter === 'warning') {
        items = pendenciasData?.warningList || [];
    }

    if (!items || items.length === 0) {
        alert("Nenhum instrumento pendente para orçar nesta lista.");
        return;
    }

    const lines = items.map(item => {
        const r = item.record;
        const tipo = getRecordField(r, 'z_disp_ID_INSTRUMENT_TYPE', 'TYPE', 'Type', 'DESCRIPTION', 'Description') || 'Instrumento';
        const cod = getRecordField(r, 'Code', 'CODE', 'Tag', 'TAG', 'Codigo') || `ID #${r.id}`;
        const faixas = getRecordField(r, 'Faixas', 'FAIXAS', 'Bands', 'BANDS') || '';
        const fab = getRecordField(r, 'z_disp_ID_SUPPLIER', 'SUPPLIER', 'Fabricante') || '';

        const parts = [tipo, cod];
        if (faixas) parts.push(faixas);
        if (fab) parts.push(fab);
        return parts.join(' - ');
    });

    const textToCopy = lines.join('\n');

    const copySuccess = () => {
        const btn = document.getElementById('btn-copy-orcamento');
        if (btn) {
            const originalHTML = btn.innerHTML;
            btn.classList.add('copied');
            btn.innerHTML = `✅ Copiado (${lines.length})`;
            setTimeout(() => {
                btn.classList.remove('copied');
                btn.innerHTML = originalHTML;
            }, 2500);
        }
    };

    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(textToCopy).then(copySuccess).catch(() => {
            fallbackCopy(textToCopy, copySuccess);
        });
    } else {
        fallbackCopy(textToCopy, copySuccess);
    }
}

function fallbackCopy(text, onSuccess) {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();
    try {
        document.execCommand('copy');
        if (onSuccess) onSuccess();
    } catch (e) {
        prompt("Copie a lista abaixo:", text);
    } finally {
        textarea.remove();
    }
}

function openPendenciasDrawer() {
    const drawer = document.getElementById('pendencias-drawer');
    const overlay = document.getElementById('pendencias-drawer-overlay');
    if (drawer && overlay) {
        overlay.style.display = 'block';
        setTimeout(() => drawer.classList.add('open'), 10);
    }
}

function closePendenciasDrawer() {
    const drawer = document.getElementById('pendencias-drawer');
    const overlay = document.getElementById('pendencias-drawer-overlay');
    if (drawer && overlay) {
        drawer.classList.remove('open');
        setTimeout(() => { overlay.style.display = 'none'; }, 300);
    }
}

// --- ENVIA FILTRO PARA O IFRAME DO UNIVERSALVIEWER ---
function notifyIframeCalibrationFilter(filterType) {
    const viewerIframe = document.querySelector('#pane-0 iframe') || document.querySelector('#pane-inventario iframe');
    if (viewerIframe && viewerIframe.contentWindow) {
        viewerIframe.contentWindow.postMessage({
            action: 'filter-calibration-status',
            status: filterType
        }, '*');
    }
}

// --- EVENT LISTENERS DA GAVETA E DOS CHIPS ---
document.addEventListener('DOMContentLoaded', () => {
    // Abrir/fechar gaveta de pendências
    const btnOpen = document.getElementById('btn-open-pendencias');
    if (btnOpen) btnOpen.addEventListener('click', openPendenciasDrawer);

    const btnClose = document.getElementById('btn-close-pendencias');
    if (btnClose) btnClose.addEventListener('click', closePendenciasDrawer);

    const btnCopyOrcamento = document.getElementById('btn-copy-orcamento');
    if (btnCopyOrcamento) btnCopyOrcamento.addEventListener('click', copyOrcamentoList);

    const overlay = document.getElementById('pendencias-drawer-overlay');
    if (overlay) overlay.addEventListener('click', closePendenciasDrawer);

    // Abas dentro da gaveta de pendências
    document.querySelectorAll('.drawer-tab-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            document.querySelectorAll('.drawer-tab-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentDrawerFilter = btn.getAttribute('data-drawer-filter');
            renderDrawerPendenciasList();
        });
    });

    // Pílulas de filtro rápido (Chips)
    document.querySelectorAll('.chip-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.chip-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            const filterType = btn.getAttribute('data-filter');
            console.log("[Dashboard] Aplicando filtro rápido de calibração:", filterType);
            notifyIframeCalibrationFilter(filterType);
        });
    });

    // Banner de sessão
    const btnBannerView = document.getElementById('btn-banner-view');
    if (btnBannerView) {
        btnBannerView.addEventListener('click', () => {
            openPendenciasDrawer();
        });
    }

    const btnBannerDismiss = document.getElementById('btn-banner-dismiss');
    if (btnBannerDismiss) {
        btnBannerDismiss.addEventListener('click', () => {
            const banner = document.getElementById('session-alert-banner');
            if (banner) banner.style.display = 'none';
            sessionStorage.setItem('pendencias_banner_dismissed', 'true');
        });
    }
});

// ==========================================================================
// GERENCIADOR DE ESTÁGIOS DO KANBAN (METROLOGICAL_STAGE)
// ==========================================================================
export async function openKanbanStageManager() {
    let choices = [...ALL_CHOICES];
    if (choices.length === 0) {
        try {
            const schema = await callIframe('getTableSchema', ['INSTRUMENTS']);
            const stageCol = schema['METROLOGICAL_STAGE'];
            if (stageCol && stageCol.widgetOptions) {
                const wopts = typeof stageCol.widgetOptions === 'string' ? JSON.parse(stageCol.widgetOptions) : stageCol.widgetOptions;
                choices = wopts.choices || [];
            }
        } catch(e) {
            console.warn("Falha ao obter escolhas via iframe:", e);
        }
    }

    const modalId = 'kanban-stages-modal-overlay';
    const existing = document.getElementById(modalId);
    if (existing) existing.remove();

    const overlay = document.createElement('div');
    overlay.id = modalId;
    overlay.style.cssText = `
        position: fixed; top: 0; left: 0; width: 100vw; height: 100vh;
        background: rgba(15, 23, 42, 0.6); backdrop-filter: blur(3px);
        z-index: 99999; display: flex; align-items: center; justify-content: center;
        padding: 20px; box-sizing: border-box;
    `;

    let localChoices = [...choices];

    function renderModalContent() {
        let rowsHtml = '';
        localChoices.forEach((choice, idx) => {
            const isResting = choice === '-' || choice === '0. Em Uso' || choice === 'Em Uso';
            rowsHtml += `
                <div class="kanban-stage-row" data-index="${idx}" style="display: flex; align-items: center; gap: 8px; background: ${isResting ? '#f8fafc' : '#ffffff'}; border: 1px solid #e2e8f0; border-radius: 6px; padding: 8px 12px;">
                    <span style="font-size: 14px; color: #94a3b8; cursor: grab;">☰</span>
                    <input type="text" class="stage-name-input" data-index="${idx}" value="${choice.replace(/"/g, '&quot;')}" style="flex: 1; padding: 6px 10px; border: 1px solid #cbd5e1; border-radius: 4px; font-size: 13px; font-weight: 600; color: #1e293b;" ${isResting ? 'title="Estágio padrão de repouso"' : ''}>
                    ${isResting ? '<span style="font-size: 11px; background: #e2e8f0; color: #475569; padding: 2px 6px; border-radius: 4px; font-weight: bold;">Repouso</span>' : ''}
                    <div style="display: flex; gap: 4px;">
                        <button type="button" class="btn-move-up" data-index="${idx}" ${idx === 0 ? 'disabled style="opacity:0.4; cursor:not-allowed;"' : 'style="background:#f1f5f9; border:1px solid #cbd5e1; border-radius:4px; padding:4px 8px; cursor:pointer; font-size:12px;"'}>⬆</button>
                        <button type="button" class="btn-move-down" data-index="${idx}" ${idx === localChoices.length - 1 ? 'disabled style="opacity:0.4; cursor:not-allowed;"' : 'style="background:#f1f5f9; border:1px solid #cbd5e1; border-radius:4px; padding:4px 8px; cursor:pointer; font-size:12px;"'}>⬇</button>
                        <button type="button" class="btn-delete-stage" data-index="${idx}" ${isResting ? 'disabled style="opacity:0.3; cursor:not-allowed;"' : 'style="background:#fee2e2; border:1px solid #fca5a5; color:#dc2626; border-radius:4px; padding:4px 8px; cursor:pointer; font-size:12px;" title="Excluir Estágio"'}>🗑️</button>
                    </div>
                </div>
            `;
        });

        overlay.innerHTML = `
            <div style="background: #ffffff; border-radius: 10px; width: 100%; max-width: 550px; max-height: 85vh; display: flex; flex-direction: column; box-shadow: 0 20px 25px -5px rgba(0,0,0,0.2); overflow: hidden;">
                <div style="padding: 16px 20px; background: #2c5e5a; color: #ffffff; display: flex; justify-content: space-between; align-items: center;">
                    <div style="display: flex; align-items: center; gap: 10px;">
                        <span style="font-size: 20px;">📋</span>
                        <div>
                            <h3 style="margin: 0; font-size: 16px; font-weight: 700;">Estágios do Kanban (METROLOGICAL_STAGE)</h3>
                            <div style="font-size: 11px; opacity: 0.85;">Reordene, renomeie ou adicione estágios para o fluxo metrológico</div>
                        </div>
                    </div>
                    <button type="button" id="btn-close-kanban-modal" style="background: none; border: none; color: #ffffff; font-size: 24px; cursor: pointer; line-height: 1;">&times;</button>
                </div>
                <div style="padding: 16px; flex: 1; overflow-y: auto; display: flex; flex-direction: column; gap: 8px; background: #f8fafc;" id="kanban-stages-list-container">
                    ${rowsHtml}
                </div>
                <div style="padding: 12px 16px; background: #ffffff; border-top: 1px solid #e2e8f0; display: flex; justify-content: space-between; align-items: center;">
                    <button type="button" id="btn-add-kanban-stage" style="background: #f1f5f9; border: 1px solid #cbd5e1; color: #334155; padding: 8px 14px; border-radius: 6px; font-weight: 600; font-size: 12px; cursor: pointer; display: flex; align-items: center; gap: 6px;">
                        ➕ Adicionar Novo Estágio
                    </button>
                    <div style="display: flex; gap: 10px;">
                        <button type="button" id="btn-cancel-kanban-modal" style="background: #ffffff; border: 1px solid #cbd5e1; color: #64748b; padding: 8px 14px; border-radius: 6px; font-weight: 600; font-size: 12px; cursor: pointer;">
                            Cancelar
                        </button>
                        <button type="button" id="btn-save-kanban-stages" style="background: #2e7d32; border: none; color: #ffffff; padding: 8px 18px; border-radius: 6px; font-weight: 700; font-size: 12px; cursor: pointer; box-shadow: 0 2px 4px rgba(46, 125, 50, 0.3);">
                            💾 Salvar Estágios no Grist
                        </button>
                    </div>
                </div>
            </div>
        `;

        // Event Listeners inside modal
        overlay.querySelector('#btn-close-kanban-modal').onclick = () => overlay.remove();
        overlay.querySelector('#btn-cancel-kanban-modal').onclick = () => overlay.remove();

        // Update inputs in localChoices
        overlay.querySelectorAll('.stage-name-input').forEach(input => {
            input.oninput = (e) => {
                const i = parseInt(input.dataset.index, 10);
                localChoices[i] = e.target.value;
            };
        });

        // Move Up
        overlay.querySelectorAll('.btn-move-up').forEach(btn => {
            btn.onclick = () => {
                const idx = parseInt(btn.dataset.index, 10);
                if (idx > 0) {
                    const temp = localChoices[idx];
                    localChoices[idx] = localChoices[idx - 1];
                    localChoices[idx - 1] = temp;
                    renderModalContent();
                }
            };
        });

        // Move Down
        overlay.querySelectorAll('.btn-move-down').forEach(btn => {
            btn.onclick = () => {
                const idx = parseInt(btn.dataset.index, 10);
                if (idx < localChoices.length - 1) {
                    const temp = localChoices[idx];
                    localChoices[idx] = localChoices[idx + 1];
                    localChoices[idx + 1] = temp;
                    renderModalContent();
                }
            };
        });

        // Delete Stage
        overlay.querySelectorAll('.btn-delete-stage').forEach(btn => {
            btn.onclick = () => {
                const idx = parseInt(btn.dataset.index, 10);
                if (confirm(`Remover o estágio "${localChoices[idx]}"?`)) {
                    localChoices.splice(idx, 1);
                    renderModalContent();
                }
            };
        });

        // Add New Stage
        overlay.querySelector('#btn-add-kanban-stage').onclick = () => {
            const nextNum = localChoices.length;
            localChoices.push(`${nextNum}. Novo Estágio`);
            renderModalContent();
        };

        // Save Stages to Grist
        overlay.querySelector('#btn-save-kanban-stages').onclick = async () => {
            const saveBtn = overlay.querySelector('#btn-save-kanban-stages');
            saveBtn.disabled = true;
            saveBtn.innerText = 'Salvando no Grist...';

            const cleanChoices = localChoices.map(s => String(s).trim()).filter(Boolean);

            try {
                const gristApi = (window.grist && window.grist.docApi) ? window.grist.docApi : 
                                 (window.parent && window.parent.grist && window.parent.grist.docApi) ? window.parent.grist.docApi : null;
                
                if (gristApi) {
                    await gristApi.applyUserActions([
                        ['ModifyColumn', 'INSTRUMENTS', 'METROLOGICAL_STAGE', { widgetOptions: JSON.stringify({ choices: cleanChoices }) }]
                    ]);
                } else {
                    console.warn("API de docApi do Grist não acessível diretamente, enviando via postMessage");
                    window.parent.postMessage({
                        action: 'update-column-choices',
                        tableId: 'INSTRUMENTS',
                        colId: 'METROLOGICAL_STAGE',
                        choices: cleanChoices
                    }, '*');
                }

                ALL_CHOICES = cleanChoices;
                STAGES = cleanChoices.filter(c => c !== "0. Em Uso" && c !== "Em Uso" && c !== "-");
                renderKanban();

                saveBtn.innerText = '✅ Salvo com Sucesso!';
                setTimeout(() => overlay.remove(), 1000);
            } catch (err) {
                console.error("Erro ao salvar opções no Grist:", err);
                alert("Erro ao salvar estágios no Grist: " + err.message);
                saveBtn.disabled = false;
                saveBtn.innerText = '💾 Salvar Estágios no Grist';
            }
        };
    }

    renderModalContent();
    document.body.appendChild(overlay);
}


