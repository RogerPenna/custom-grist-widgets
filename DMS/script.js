// DMS/script.js
import '../libraries/grist-config-manager/editors/table-manifest.js?v=1.0.0';
import { GristTableLens } from '../libraries/grist-table-lens/grist-table-lens.js?v=1.0.0';
import { open as openConfigManager } from '../libraries/grist-config-manager/ConfigManagerComponent.js?v=1.0.0';
import { openDrawer } from '../libraries/grist-drawer-component/drawer-component.js?v=1.0.0';
import { GristLauncherUtils } from '../libraries/grist-launcher-utils.js?v=1.0.0';
import { GristRestApi } from '../libraries/grist-rest-api.js?v=1.0.0';
import { subscribe } from '../libraries/grist-event-bus/grist-event-bus.js?v=1.0.0';

document.addEventListener('DOMContentLoaded', async () => {
    // Carrega o arquivo SVG e o injeta no DOM para os ícones funcionarem
    async function loadIcons() {
        try {
            const response = await fetch('../libraries/icons/icons.svg');
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            const svgText = await response.text();
            const div = document.createElement('div');
            div.style.display = 'none';
            div.innerHTML = svgText;
            document.body.insertBefore(div, document.body.firstChild);
        } catch (error) {
            console.error('Falha ao carregar o arquivo de ícones:', error);
        }
    }
    await loadIcons();

    let currentConfig = null;
    let currentConfigId = null;
    let isInitialized = false;
    let tableLens = null;
    
    // State variables
    let allDocuments = [];
    let allVersions = [];
    let selectedDoc = null;
    let activeFolder = '/';
    let currentDocVersions = [];

    // DOM Elements for Configurator & Sidebar
    const btnToggleSidebar = document.getElementById('btn-toggle-sidebar');
    const dmsSidebar = document.getElementById('dms-sidebar');
    const btnOpenTypesConfig = document.getElementById('btn-open-types-config');
    const dmsDocGridContainer = document.getElementById('dms-doc-grid-container');
    const dmsTypesConfigContainer = document.getElementById('dms-types-config-container');
    
    const typeSearchInput = document.getElementById('type-search-input');
    const btnNewType = document.getElementById('btn-new-type');
    const chkSelectAllTypes = document.getElementById('chk-select-all-types');
    const typeSortSelect = document.getElementById('type-sort-select');
    const btnBulkDeleteTypes = document.getElementById('btn-bulk-delete-types');
    const dmsTypesCardsList = document.getElementById('dms-types-cards-list');
    
    // Wizard Modal Elements
    const modalDocTypeWizard = document.getElementById('modal-doc-type-wizard');
    const btnWizardClose = document.getElementById('btn-wizard-close');
    const btnWizardCancel = document.getElementById('btn-wizard-cancel');
    const formDocTypeWizard = document.getElementById('form-doc-type-wizard');
    const wizardTitle = document.getElementById('wizard-title');
    const wizardTabButtons = document.querySelectorAll('.wizard-tab-btn');
    
    // Wizard Form Conditional Groups
    const typeVersionToggle = document.getElementById('type-version-toggle');
    const versionSettingsGroup = document.getElementById('version-settings-group');
    const typeVersionRevision = document.getElementById('type-version-revision');
    const groupInitialVersion = document.getElementById('group-initial-version');
    const groupRevisionPattern = document.getElementById('group-revision-pattern');
    
    const typeExpirationToggle = document.getElementById('type-expiration-toggle');
    const expirationSettingsGroup = document.getElementById('expiration-settings-group');
    const typeExpirationNotify = document.getElementById('type-expiration-notify');
    const expirationNotifyGroup = document.getElementById('expiration-notify-group');

    // Subtype Editor DOM & States
    const typeSubtypesList = document.getElementById('type-subtypes-list');
    const btnAddSubtype = document.getElementById('btn-add-subtype');
    const modalSubtypeEditor = document.getElementById('modal-subtype-editor');
    const btnSubtypeClose = document.getElementById('btn-subtype-close');
    const btnSubtypeCancel = document.getElementById('btn-subtype-cancel');
    const formSubtypeEditor = document.getElementById('form-subtype-editor');
    const subtypeWizardTitle = document.getElementById('subtype-wizard-title');
    
    const subCodeInput = document.getElementById('sub-code');
    const subNameInput = document.getElementById('sub-name');
    const subOverrideToggle = document.getElementById('sub-override-toggle');
    const subtypeOverrideSettings = document.getElementById('subtype-override-settings');
    
    const subApprovalSelect = document.getElementById('sub-approval-select');
    const subVersionToggle = document.getElementById('sub-version-toggle');
    const subVersionSettingsGroup = document.getElementById('sub-version-settings-group');
    const subVersionFormat = document.getElementById('sub-version-format');
    const subVersionRevision = document.getElementById('sub-version-revision');
    const subGroupInitialVersion = document.getElementById('sub-group-initial-version');
    const subGroupRevisionPattern = document.getElementById('sub-group-revision-pattern');
    const subVersionInitial = document.getElementById('sub-version-initial');
    const subVersionPattern = document.getElementById('sub-version-pattern');
    const subVersionKeep = document.getElementById('sub-version-keep');
    const subVersionReader = document.getElementById('sub-version-reader');
    
    const subExpirationToggle = document.getElementById('sub-expiration-toggle');
    const subExpirationSettingsGroup = document.getElementById('sub-expiration-settings-group');
    const subExpirationVal = document.getElementById('sub-expiration-val');
    const subExpirationUnit = document.getElementById('sub-expiration-unit');
    const subExpirationEdit = document.getElementById('sub-expiration-edit');
    const subExpirationNotify = document.getElementById('sub-expiration-notify');
    const subExpirationNotifyGroup = document.getElementById('sub-expiration-notify-group');
    const subExpirationNotifyDays = document.getElementById('sub-expiration-notify-days');
    const subExpirationNotifyRecipients = document.getElementById('sub-expiration-notify-recipients');

    const typeControlledCopyToggle = document.getElementById('type-controlled-copy-toggle');
    const controlledCopySettingsGroup = document.getElementById('controlled-copy-settings-group');
    const typeControlledCopyType = document.getElementById('type-controlled-copy-type');
    const typeControlledCopyFormat = document.getElementById('type-controlled-copy-format');

    const subControlledCopyToggle = document.getElementById('sub-controlled-copy-toggle');
    const subControlledCopySettingsGroup = document.getElementById('sub-controlled-copy-settings-group');
    const subControlledCopyType = document.getElementById('sub-controlled-copy-type');
    const subControlledCopyFormat = document.getElementById('sub-controlled-copy-format');

    let activeSubtypes = [];
    let editingSubtypeIndex = null;

    // Configurator state
    let allDocTypes = [];
    let allSubTypes = [];
    let editingTypeId = null;
    let activeViewMode = 'docs'; // 'docs' or 'types'

    // DOM Elements
    const treeViewEl = document.getElementById('dms-tree-view');
    const docListEl = document.getElementById('dms-doc-list');
    const currentFolderTitle = document.getElementById('current-folder-title');
    const docCountBadge = document.getElementById('doc-count-badge');
    const previewPanel = document.getElementById('dms-preview-panel');
    const previewDocTitle = document.getElementById('preview-doc-title');
    const btnClosePreview = document.getElementById('btn-close-preview');
    const previewTabButtons = document.querySelectorAll('.preview-tab-btn');
    const tabContentView = document.getElementById('preview-tab-content-view');
    const tabContentHistory = document.getElementById('preview-tab-content-history');
    
    // Preview targets
    const viewerPlaceholder = document.getElementById('viewer-placeholder');
    const pdfViewerContainer = document.getElementById('pdf-viewer-container');
    const pdfIframe = document.getElementById('pdf-iframe');
    const mdViewerContainer = document.getElementById('md-viewer-container');
    const versionHistoryList = document.getElementById('version-history-list');
    
    // Modals & Flows
    const btnNewDoc = document.getElementById('btn-new-doc');
    const modalNewDoc = document.getElementById('modal-new-doc');
    const btnNewDocClose = document.getElementById('btn-new-doc-close');
    const btnNewDocCancel = document.getElementById('btn-new-doc-cancel');
    const formNewDoc = document.getElementById('form-new-doc');
    
    const btnCreateVersion = document.getElementById('btn-create-version');
    const modalVersionFlow = document.getElementById('modal-version-flow');
    const btnModalClose = document.getElementById('btn-modal-close');
    const btnModalCancel = document.getElementById('btn-modal-cancel');
    const formVersionFlow = document.getElementById('form-version-flow');
    const verSourceTypeSelect = document.getElementById('ver-source-type-select');

    // Markdown Converter
    const mdConverter = new showdown.Converter();

    // Event Bus subscriptions
    subscribe('data-changed', async () => {
        console.log("[DMS] Evento 'data-changed' recebido. Atualizando dados...");
        if (tableLens && typeof tableLens.clearTableRecordsCache === 'function') {
            tableLens.clearTableRecordsCache();
        }
        await loadDmsData();
    });

    // Initialize Grist
    grist.ready({ requiredAccess: 'full' });
    tableLens = new GristTableLens(grist);

    grist.onOptions(async (options) => {
        if (options?.configId !== currentConfigId || !isInitialized) {
            isInitialized = true;
            currentConfigId = options?.configId || null;
            await loadDmsData();
        }
    });

    grist.onRecords(async () => {
        if (isInitialized) await loadDmsData();
    });

    // Setup Close Buttons
    btnClosePreview.onclick = () => {
        previewPanel.classList.add('collapsed');
        selectedDoc = null;
        renderDocList();
    };

    // Setup Tabs
    previewTabButtons.forEach(btn => {
        btn.onclick = () => {
            previewTabButtons.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            if (btn.dataset.tab === 'view') {
                tabContentView.style.display = 'block';
                tabContentHistory.style.display = 'none';
            } else {
                tabContentView.style.display = 'none';
                tabContentHistory.style.display = 'block';
                renderVersionHistory();
            }
        };
    });

    // Sidebar Collapse / Expand Toggle
    if (btnToggleSidebar && dmsSidebar) {
        btnToggleSidebar.onclick = (e) => {
            e.stopPropagation();
            dmsSidebar.classList.toggle('collapsed');
            
            const svg = btnToggleSidebar.querySelector('svg');
            if (dmsSidebar.classList.contains('collapsed')) {
                btnToggleSidebar.title = "Exibir Barra Lateral";
                svg.style.transform = "rotate(180deg)";
            } else {
                btnToggleSidebar.title = "Ocultar Barra Lateral";
                svg.style.transform = "none";
            }
        };
    }

    // Toggle Main View (Documents list vs Document Types Configurator)
    if (btnOpenTypesConfig) {
        btnOpenTypesConfig.onclick = async () => {
            if (activeViewMode === 'docs') {
                activeViewMode = 'types';
                dmsDocGridContainer.style.display = 'none';
                dmsTypesConfigContainer.style.display = 'flex';
                currentFolderTitle.innerHTML = `⚙️ Configuração de Tipos`;
                btnOpenTypesConfig.classList.add('active');
                btnOpenTypesConfig.innerHTML = `
                    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>
                        <polyline points="9 22 9 12 15 12 15 22"></polyline>
                    </svg>
                    <span>Voltar aos Documentos</span>
                `;
                
                previewPanel.classList.add('collapsed');
                selectedDoc = null;
                
                await loadDocTypesData();
            } else {
                switchToDocsView();
            }
        };
    }

    function switchToDocsView() {
        activeViewMode = 'docs';
        dmsDocGridContainer.style.display = 'flex';
        dmsTypesConfigContainer.style.display = 'none';
        currentFolderTitle.textContent = activeFolder;
        btnOpenTypesConfig.classList.remove('active');
        btnOpenTypesConfig.innerHTML = `
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="12" cy="12" r="3"></circle>
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
            </svg>
            <span>Tipos de Documento</span>
        `;
        renderDocList();
    }

    // Carregar dados de Tipos de Documento
    async function loadDocTypesData() {
        if (!dmsTypesCardsList) return;
        dmsTypesCardsList.innerHTML = '<div class="loading-placeholder">Carregando tipos de documentos...</div>';
        
        try {
            allDocTypes = await tableLens.fetchTableRecords('DMS_DocTypes');
            allSubTypes = await tableLens.fetchTableRecords('DMS_SubTypes');
            renderDocTypesList();
        } catch (e) {
            console.error("Erro ao carregar tipos de documento:", e);
            dmsTypesCardsList.innerHTML = `<div class="status-placeholder" style="color: red;">❌ Erro ao carregar tipos: ${e.message}</div>`;
        }
    }

    // Renderizar cards de tipos de documentos
    function renderDocTypesList() {
        dmsTypesCardsList.innerHTML = '';
        
        const query = (typeSearchInput?.value || '').toLowerCase().trim();
        let filteredTypes = allDocTypes.filter(t => {
            return (t.Name || '').toLowerCase().includes(query) || (t.Code || '').toLowerCase().includes(query);
        });
        
        const sortVal = typeSortSelect?.value || 'name';
        if (sortVal === 'name') {
            filteredTypes.sort((a, b) => (a.Name || '').localeCompare(b.Name || ''));
        } else if (sortVal === 'date') {
            filteredTypes.sort((a, b) => {
                const dateA = new Date(a.CreatedAt || 0);
                const dateB = new Date(b.CreatedAt || 0);
                return dateB - dateA;
            });
        }
        
        if (filteredTypes.length === 0) {
            dmsTypesCardsList.innerHTML = '<div class="status-placeholder">Nenhum tipo de documento cadastrado ou encontrado.</div>';
            return;
        }

        const typeFoldersMap = {};
        allDocuments.forEach(doc => {
            const docTypeVal = Array.isArray(doc.DocType) ? doc.DocType[1] : doc.DocType;
            if (docTypeVal && doc.Path) {
                if (!typeFoldersMap[docTypeVal]) {
                    typeFoldersMap[docTypeVal] = new Set();
                }
                typeFoldersMap[docTypeVal].add(doc.Path);
            }
        });

        filteredTypes.forEach(t => {
            const card = document.createElement('div');
            card.className = 'type-card';
            card.dataset.id = t.id;

            const dateStr = t.CreatedAt ? new Date(t.CreatedAt).toLocaleDateString('pt-BR') : 'Sem data';

            const foldersSet = typeFoldersMap[t.id] || new Set();
            if (t.AssociatedFolders) {
                try {
                    const parsed = JSON.parse(t.AssociatedFolders);
                    if (Array.isArray(parsed)) {
                        parsed.forEach(f => foldersSet.add(f));
                    }
                } catch(e) {
                    t.AssociatedFolders.split(',').forEach(f => {
                        if (f.trim()) foldersSet.add(f.trim());
                    });
                }
            }

            let foldersHtml = '';
            if (foldersSet.size > 0) {
                foldersHtml = '<div class="type-card-folders">';
                Array.from(foldersSet).slice(0, 3).forEach(f => {
                    foldersHtml += `
                        <span class="folder-association-tag">
                            <svg viewBox="0 0 24 24" width="10" height="10" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2 2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path>
                            </svg>
                            <span>${f}</span>
                        </span>
                    `;
                });
                if (foldersSet.size > 3) {
                    foldersHtml += `<span class="folder-association-tag" title="${Array.from(foldersSet).slice(3).join(', ')}">+${foldersSet.size - 3} mais</span>`;
                }
                foldersHtml += '</div>';
            } else {
                foldersHtml = `
                    <div class="type-card-folders">
                        <span class="folder-association-tag" style="font-style: italic; opacity: 0.6;">Nenhuma pasta associada</span>
                    </div>
                `;
            }

            let indicatorsHtml = '';
            const hasExpiration = !!t.Expires;
            const hasVersioning = !!t.Versioned;
            const hasApproval = !!t.RequireApproval;

            if (hasExpiration || hasVersioning || hasApproval) {
                indicatorsHtml = '<div class="type-card-indicators">';
                if (hasExpiration) {
                    indicatorsHtml += `
                        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" title="Possui expiração: ${t.ExpirationValue} ${t.ExpirationUnit}">
                            <circle cx="12" cy="12" r="10"></circle>
                            <polyline points="12 6 12 12 16 14"></polyline>
                        </svg>
                    `;
                }
                if (hasVersioning) {
                    indicatorsHtml += `
                        <span class="dms-type-icon-text" title="Possui versionamento. Formato: ${t.VersionFormat}, Inicial: ${t.VersionInitial || '1'}">V.X</span>
                    `;
                }
                if (hasApproval) {
                    indicatorsHtml += `
                        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" title="Possui fluxo de aprovação">
                            <polyline points="20 6 9 17 4 12"></polyline>
                        </svg>
                    `;
                }
                indicatorsHtml += '</div>';
            } else {
                indicatorsHtml = `<span style="font-size: 11px; color: var(--text-muted); font-style: italic;">Sem configs extras</span>`;
            }

            const typeHasDocuments = allDocuments.some(doc => {
                const docTypeVal = Array.isArray(doc.DocType) ? doc.DocType[1] : doc.DocType;
                return Number(docTypeVal) === t.id;
            });

            // Obter sub-tipos cadastrados para este tipo
            const parentSubtypes = allSubTypes.filter(s => {
                const parentId = Array.isArray(s.DocType) ? s.DocType[1] : s.DocType;
                return Number(parentId) === t.id;
            });
            
            let subtypesHtml = '';
            if (parentSubtypes.length > 0) {
                subtypesHtml = '<div class="type-card-subtypes" style="display: flex; flex-wrap: wrap; gap: 4px; margin-top: 6px;">';
                parentSubtypes.forEach(sub => {
                    const titleStr = sub.InheritSettings ? `${sub.Name} (Herda configs)` : `${sub.Name} (Configs exclusivas)`;
                    const styleStr = sub.InheritSettings 
                        ? 'font-size: 10px; padding: 1px 6px; border-radius: 4px; border: 1px solid var(--border-color); background: #f1f5f9; color: var(--text-muted); cursor: help;' 
                        : 'font-size: 10px; padding: 1px 6px; border-radius: 4px; border: 1px solid #bae6fd; background: #e0f2fe; color: #0369a1; cursor: help;';
                    subtypesHtml += `<span class="subtype-tag" style="${styleStr}" title="${titleStr}">${sub.Code}</span>`;
                });
                subtypesHtml += '</div>';
            }
 
            card.innerHTML = `
                <div class="type-card-left">
                    <input type="checkbox" class="type-card-checkbox" data-id="${t.id}">
                    <div class="type-card-info">
                        <div class="type-card-title">
                            <span>${t.Name}</span>
                            <span class="type-card-sigla">${t.Code}</span>
                        </div>
                        ${foldersHtml}
                        ${subtypesHtml}
                    </div>
                </div>
                <div class="type-card-right">
                    <div style="display: flex; flex-direction: column; align-items: flex-end; gap: 4px;">
                        <span class="type-card-date">${dateStr}</span>
                        ${indicatorsHtml}
                    </div>
                    <div class="kebab-menu-container">
                        <button class="btn-kebab" title="Mais opções">
                            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                                <circle cx="12" cy="12" r="1"></circle>
                                <circle cx="12" cy="5" r="1"></circle>
                                <circle cx="12" cy="19" r="1"></circle>
                            </svg>
                        </button>
                        <div class="kebab-dropdown">
                            <div class="kebab-item btn-kebab-edit" data-id="${t.id}">
                                ✏️ Editar
                            </div>
                            <div class="kebab-item btn-kebab-import" data-id="${t.id}">
                                📥 Importar Lote
                            </div>
                            <div class="kebab-item danger btn-kebab-delete ${typeHasDocuments ? 'disabled' : ''}" data-id="${t.id}" title="${typeHasDocuments ? 'Não é possível remover tipos com documentos publicados.' : ''}">
                                🗑️ Remover
                            </div>
                        </div>
                    </div>
                </div>
            `;

            const btnKebab = card.querySelector('.btn-kebab');
            const dropdown = card.querySelector('.kebab-dropdown');
            btnKebab.onclick = (e) => {
                e.stopPropagation();
                document.querySelectorAll('.kebab-dropdown.show').forEach(d => {
                    if (d !== dropdown) d.classList.remove('show');
                });
                dropdown.classList.toggle('show');
            };

            card.querySelector('.btn-kebab-edit').onclick = (e) => {
                e.stopPropagation();
                dropdown.classList.remove('show');
                openDocTypeWizard(t.id);
            };

            card.querySelector('.btn-kebab-import').onclick = (e) => {
                e.stopPropagation();
                dropdown.classList.remove('show');
                alert(`Funcionalidade de importação em lote para o tipo '${t.Name}' será implementada em etapas posteriores.`);
            };

            const btnDel = card.querySelector('.btn-kebab-delete');
            btnDel.onclick = async (e) => {
                e.stopPropagation();
                dropdown.classList.remove('show');
                if (btnDel.classList.contains('disabled')) return;
                
                if (confirm(`Tem certeza que deseja excluir o Tipo de Documento "${t.Name}"?`)) {
                    try {
                        await tableLens.deleteRecord('DMS_DocTypes', t.id);
                        await loadDocTypesData();
                    } catch(err) {
                        alert("Erro ao excluir: " + err.message);
                    }
                }
            };

            dmsTypesCardsList.appendChild(card);
        });
    }

    // Fechar kebabs ao clicar fora
    document.addEventListener('click', () => {
        document.querySelectorAll('.kebab-dropdown.show').forEach(d => d.classList.remove('show'));
    });

    // Filtros e eventos
    if (typeSearchInput) {
        typeSearchInput.oninput = () => { renderDocTypesList(); };
    }

    if (typeSortSelect) {
        typeSortSelect.onchange = () => { renderDocTypesList(); };
    }

    if (chkSelectAllTypes) {
        chkSelectAllTypes.onchange = () => {
            const checkboxes = dmsTypesCardsList.querySelectorAll('.type-card-checkbox');
            checkboxes.forEach(c => {
                c.checked = chkSelectAllTypes.checked;
            });
            toggleBulkDeleteButton();
        };
    }

    function toggleBulkDeleteButton() {
        if (!btnBulkDeleteTypes) return;
        const checkedBoxes = dmsTypesCardsList.querySelectorAll('.type-card-checkbox:checked');
        if (checkedBoxes.length > 0) {
            btnBulkDeleteTypes.style.display = 'block';
            btnBulkDeleteTypes.textContent = `Excluir Selecionados (${checkedBoxes.length})`;
        } else {
            btnBulkDeleteTypes.style.display = 'none';
        }
    }

    dmsTypesCardsList.addEventListener('change', (e) => {
        if (e.target.classList.contains('type-card-checkbox')) {
            toggleBulkDeleteButton();
            const totalBoxes = dmsTypesCardsList.querySelectorAll('.type-card-checkbox');
            const checkedBoxes = dmsTypesCardsList.querySelectorAll('.type-card-checkbox:checked');
            chkSelectAllTypes.checked = (totalBoxes.length === checkedBoxes.length);
        }
    });

    if (btnBulkDeleteTypes) {
        btnBulkDeleteTypes.onclick = async () => {
            const checkedBoxes = dmsTypesCardsList.querySelectorAll('.type-card-checkbox:checked');
            const idsToDelete = Array.from(checkedBoxes).map(c => parseInt(c.dataset.id));
            
            const typesWithDocs = idsToDelete.filter(id => {
                return allDocuments.some(doc => {
                    const docTypeVal = Array.isArray(doc.DocType) ? doc.DocType[1] : doc.DocType;
                    return Number(docTypeVal) === id;
                });
            });

            if (typesWithDocs.length > 0) {
                const names = allDocTypes.filter(t => typesWithDocs.includes(t.id)).map(t => t.Name).join(', ');
                alert(`Alguns tipos selecionados possuem documentos publicados e não podem ser excluídos: ${names}`);
                return;
            }

            if (confirm(`Tem certeza que deseja excluir em lote os ${idsToDelete.length} tipos de documentos selecionados?`)) {
                btnBulkDeleteTypes.disabled = true;
                btnBulkDeleteTypes.textContent = "Excluindo...";
                
                try {
                    for (const id of idsToDelete) {
                        await tableLens.deleteRecord('DMS_DocTypes', id);
                    }
                    chkSelectAllTypes.checked = false;
                    await loadDocTypesData();
                } catch(err) {
                    alert("Erro na exclusão em lote: " + err.message);
                } finally {
                    btnBulkDeleteTypes.disabled = false;
                    toggleBulkDeleteButton();
                }
            }
        };
    }

    // Abas do Wizard
    wizardTabButtons.forEach(btn => {
        btn.onclick = () => {
            wizardTabButtons.forEach(b => {
                b.classList.remove('active');
                b.style.borderBottomColor = 'transparent';
                b.style.color = 'var(--text-muted)';
            });
            
            btn.classList.add('active');
            btn.style.borderBottomColor = 'var(--primary-color)';
            btn.style.color = 'var(--primary-color)';
            
            const tab = btn.dataset.tab;

            // Ocultar todos os conteúdos de abas
            document.querySelectorAll('.wizard-tab-content').forEach(content => {
                content.style.display = 'none';
            });
            
            // Exibir o conteúdo correspondente
            const contentEl = document.getElementById(`wizard-tab-content-${tab}`);
            if (contentEl) {
                contentEl.style.display = 'flex';
            }
        };
    });

    // Formulários Condicionais do Wizard
    if (typeVersionToggle) {
        typeVersionToggle.onchange = () => {
            versionSettingsGroup.style.display = (typeVersionToggle.value === 'true') ? 'flex' : 'none';
        };
    }

    if (typeVersionRevision) {
        typeVersionRevision.onchange = () => {
            if (typeVersionRevision.value === 'true') {
                groupInitialVersion.style.display = 'none';
                groupRevisionPattern.style.display = 'block';
            } else {
                groupInitialVersion.style.display = 'block';
                groupRevisionPattern.style.display = 'none';
            }
        };
    }

    if (typeExpirationToggle) {
        typeExpirationToggle.onchange = () => {
            expirationSettingsGroup.style.display = (typeExpirationToggle.value === 'true') ? 'flex' : 'none';
        };
    }

    if (typeExpirationNotify) {
        typeExpirationNotify.onchange = () => {
            expirationNotifyGroup.style.display = (typeExpirationNotify.value === 'true') ? 'flex' : 'none';
        };
    }

    if (typeControlledCopyToggle) {
        typeControlledCopyToggle.onchange = () => {
            controlledCopySettingsGroup.style.display = (typeControlledCopyToggle.value === 'true') ? 'flex' : 'none';
        };
    }

    // Abrir Wizard
    async function openDocTypeWizard(id = null) {
        editingTypeId = id;
        activeSubtypes = []; // Reset sub-tipos em memória
        
        wizardTabButtons[0].click();
        formDocTypeWizard.reset();
        
        versionSettingsGroup.style.display = 'none';
        groupInitialVersion.style.display = 'block';
        groupRevisionPattern.style.display = 'none';
        expirationSettingsGroup.style.display = 'none';
        expirationNotifyGroup.style.display = 'none';
        
        typeControlledCopyToggle.value = 'false';
        controlledCopySettingsGroup.style.display = 'none';
        typeControlledCopyType.value = 'Both';
        typeControlledCopyFormat.value = 'Both';
        
        const siglaInput = document.getElementById('type-code-sigla');
        siglaInput.removeAttribute('readonly');
        siglaInput.style.opacity = '1';

        if (id !== null) {
            wizardTitle.textContent = "Editar Tipo de Documento";
            const t = allDocTypes.find(item => item.id === id);
            if (t) {
                document.getElementById('type-name').value = t.Name || '';
                siglaInput.value = t.Code || '';
                siglaInput.setAttribute('readonly', 'true');
                siglaInput.style.opacity = '0.6';
                document.getElementById('type-description').value = t.Description || '';
                
                // Carregar sub-tipos cadastrados para este tipo no Grist
                try {
                    const allSubList = await tableLens.fetchTableRecords('DMS_SubTypes');
                    activeSubtypes = allSubList.filter(s => {
                        const parentId = Array.isArray(s.DocType) ? s.DocType[1] : s.DocType;
                        return Number(parentId) === id;
                    }).map(s => {
                        return {
                            id: s.id,
                            Code: s.Code,
                            Name: s.Name,
                            InheritSettings: !!s.InheritSettings,
                            RequireApproval: !!s.RequireApproval,
                            Versioned: !!s.Versioned,
                            VersionFormat: s.VersionFormat || 'Numeric',
                            VersionHasRevision: !!s.VersionHasRevision,
                            VersionInitial: s.VersionInitial || '1',
                            VersionRevisionPattern: s.VersionRevisionPattern || '1.1.1.1.1',
                            VersionAllowKeepCurrent: !!s.VersionAllowKeepCurrent,
                            VersionReaderAccessPast: !!s.VersionReaderAccessPast,
                            Expires: !!s.Expires,
                            ExpirationValue: s.ExpirationValue || 12,
                            ExpirationUnit: s.ExpirationUnit || 'Months',
                            ExpirationAllowEdit: !!s.ExpirationAllowEdit,
                            ExpirationNotify: !!s.ExpirationNotify,
                            ExpirationNotifyDaysBefore: s.ExpirationNotifyDaysBefore || 30,
                            ExpirationNotifyRecipients: s.ExpirationNotifyRecipients || '',
                            ControlledCopy: !!s.ControlledCopy,
                            ControlledCopyType: s.ControlledCopyType || 'Both',
                            ControlledCopyFormat: s.ControlledCopyFormat || 'Both'
                        };
                    });
                } catch (errSub) {
                    console.error("Erro ao carregar sub-tipos do Grist:", errSub);
                    activeSubtypes = [];
                }

                document.getElementById('type-approval-select').value = String(!!t.RequireApproval);
                document.getElementById('type-version-toggle').value = String(!!t.Versioned);
                
                if (t.Versioned) {
                    versionSettingsGroup.style.display = 'flex';
                    document.getElementById('type-version-format').value = t.VersionFormat || 'Numeric';
                    document.getElementById('type-version-revision').value = String(!!t.VersionHasRevision);
                    if (t.VersionHasRevision) {
                        groupInitialVersion.style.display = 'none';
                        groupRevisionPattern.style.display = 'block';
                        document.getElementById('type-version-pattern').value = t.VersionRevisionPattern || '1.1.1.1.1';
                    } else {
                        groupInitialVersion.style.display = 'block';
                        groupRevisionPattern.style.display = 'none';
                        document.getElementById('type-version-initial').value = t.VersionInitial || '1';
                    }
                    document.getElementById('type-version-keep').value = String(!!t.VersionAllowKeepCurrent);
                    document.getElementById('type-version-reader').value = String(!!t.VersionReaderAccessPast);
                }

                document.getElementById('type-expiration-toggle').value = String(!!t.Expires);
                if (t.Expires) {
                    expirationSettingsGroup.style.display = 'flex';
                    document.getElementById('type-expiration-val').value = t.ExpirationValue || 12;
                    document.getElementById('type-expiration-unit').value = t.ExpirationUnit || 'Months';
                    document.getElementById('type-expiration-edit').value = String(!!t.ExpirationAllowEdit);
                    document.getElementById('type-expiration-notify').value = String(!!t.ExpirationNotify);
                    if (t.ExpirationNotify) {
                        expirationNotifyGroup.style.display = 'flex';
                        document.getElementById('type-expiration-notify-days').value = t.ExpirationNotifyDaysBefore || 30;
                        document.getElementById('type-expiration-notify-recipients').value = t.ExpirationNotifyRecipients || '';
                    }
                }

                typeControlledCopyToggle.value = String(!!t.ControlledCopy);
                if (t.ControlledCopy) {
                    controlledCopySettingsGroup.style.display = 'flex';
                    typeControlledCopyType.value = t.ControlledCopyType || 'Both';
                    typeControlledCopyFormat.value = t.ControlledCopyFormat || 'Both';
                } else {
                    controlledCopySettingsGroup.style.display = 'none';
                }
            }
        } else {
            wizardTitle.textContent = "Novo Tipo de Documento";
        }

        renderActiveSubtypes();
        modalDocTypeWizard.style.display = 'flex';
    }

    if (btnNewType) {
        btnNewType.onclick = () => { openDocTypeWizard(); };
    }

    btnWizardClose.onclick = btnWizardCancel.onclick = () => {
        modalDocTypeWizard.style.display = 'none';
    };

    if (formDocTypeWizard) {
        formDocTypeWizard.onsubmit = async (e) => {
            e.preventDefault();
            const btnSubmit = formDocTypeWizard.querySelector('button[type="submit"]');
            btnSubmit.disabled = true;
            btnSubmit.textContent = "Salvando...";

            const name = document.getElementById('type-name').value;
            const siglaInput = document.getElementById('type-code-sigla');
            const code = siglaInput.value.toUpperCase().trim();
            const description = document.getElementById('type-description').value;

            // Converter a lista de sub-tipos ativos em uma lista de strings (Códigos) para salvar no DocType
            const subTypesList = activeSubtypes.map(s => s.Code);
            const subTypesJson = JSON.stringify(subTypesList);

            const requireApproval = document.getElementById('type-approval-select').value === 'true';

            const versioned = document.getElementById('type-version-toggle').value === 'true';
            let versionFormat = 'Numeric';
            let versionHasRevision = false;
            let versionInitial = '1';
            let versionRevisionPattern = '1.1.1.1.1';
            let versionAllowKeepCurrent = true;
            let versionReaderAccessPast = true;

            if (versioned) {
                versionFormat = document.getElementById('type-version-format').value;
                versionHasRevision = document.getElementById('type-version-revision').value === 'true';
                if (versionHasRevision) {
                    versionRevisionPattern = document.getElementById('type-version-pattern').value;
                    versionInitial = '1.0';
                } else {
                    versionInitial = document.getElementById('type-version-initial').value;
                }
                versionAllowKeepCurrent = document.getElementById('type-version-keep').value === 'true';
                versionReaderAccessPast = document.getElementById('type-version-reader').value === 'true';
            }

            const expires = document.getElementById('type-expiration-toggle').value === 'true';
            let expirationValue = 12;
            let expirationUnit = 'Months';
            let expirationAllowEdit = true;
            let expirationNotify = false;
            let expirationNotifyDaysBefore = 30;
            let expirationNotifyRecipients = '';

            if (expires) {
                expirationValue = parseInt(document.getElementById('type-expiration-val').value) || 12;
                expirationUnit = document.getElementById('type-expiration-unit').value;
                expirationAllowEdit = document.getElementById('type-expiration-edit').value === 'true';
                expirationNotify = document.getElementById('type-expiration-notify').value === 'true';
                if (expirationNotify) {
                    expirationNotifyDaysBefore = parseInt(document.getElementById('type-expiration-notify-days').value) || 30;
                    expirationNotifyRecipients = document.getElementById('type-expiration-notify-recipients').value;
                }
            }

            const controlledCopy = typeControlledCopyToggle.value === 'true';
            let controlledCopyType = 'Both';
            let controlledCopyFormat = 'Both';

            if (controlledCopy) {
                controlledCopyType = typeControlledCopyType.value;
                controlledCopyFormat = typeControlledCopyFormat.value;
            }

            const record = {
                Name: name,
                Code: code,
                Description: description,
                SubTypes: subTypesJson,
                RequireApproval: requireApproval,
                Versioned: versioned,
                VersionFormat: versionFormat,
                VersionHasRevision: versionHasRevision,
                VersionInitial: versionInitial,
                VersionRevisionPattern: versionRevisionPattern,
                VersionAllowKeepCurrent: versionAllowKeepCurrent,
                VersionReaderAccessPast: versionReaderAccessPast,
                Expires: expires,
                ExpirationValue: expirationValue,
                ExpirationUnit: expirationUnit,
                ExpirationAllowEdit: expirationAllowEdit,
                ExpirationNotify: expirationNotify,
                ExpirationNotifyDaysBefore: expirationNotifyDaysBefore,
                ExpirationNotifyRecipients: expirationNotifyRecipients,
                ControlledCopy: controlledCopy,
                ControlledCopyType: controlledCopyType,
                ControlledCopyFormat: controlledCopyFormat,
                CreatedAt: editingTypeId ? undefined : new Date().toISOString()
            };

            try {
                let savedTypeId = editingTypeId;
                if (editingTypeId !== null) {
                    await tableLens.updateRecord('DMS_DocTypes', editingTypeId, record);
                } else {
                    const duplicate = allDocTypes.find(t => t.Code === code);
                    if (duplicate) {
                        alert(`A Sigla "${code}" já está cadastrada para o tipo "${duplicate.Name}". Use uma sigla diferente.`);
                        btnSubmit.disabled = false;
                        btnSubmit.textContent = "💾 Salvar Tipo de Documento";
                        return;
                    }
                    const response = await tableLens.addRecord('DMS_DocTypes', record);
                    savedTypeId = response.id || response;
                }

                // Sincronizar sub-tipos no Grist
                const existingSubtypes = await tableLens.fetchTableRecords('DMS_SubTypes');
                const parentSubtypes = existingSubtypes.filter(s => {
                    const parentId = Array.isArray(s.DocType) ? s.DocType[1] : s.DocType;
                    return Number(parentId) === savedTypeId;
                });

                // 1. Remover sub-tipos que não estão mais na lista ativa
                for (const oldSub of parentSubtypes) {
                    if (!activeSubtypes.some(s => s.Code === oldSub.Code)) {
                        await tableLens.deleteRecords('DMS_SubTypes', [oldSub.id]);
                    }
                }

                // 2. Adicionar ou Atualizar os sub-tipos ativos
                for (const sub of activeSubtypes) {
                    const subRecord = {
                        DocType: savedTypeId,
                        Code: sub.Code,
                        Name: sub.Name,
                        InheritSettings: sub.InheritSettings,
                        RequireApproval: sub.RequireApproval,
                        Versioned: sub.Versioned,
                        VersionFormat: sub.VersionFormat,
                        VersionHasRevision: sub.VersionHasRevision,
                        VersionInitial: sub.VersionInitial,
                        VersionRevisionPattern: sub.VersionRevisionPattern,
                        VersionAllowKeepCurrent: sub.VersionAllowKeepCurrent,
                        VersionReaderAccessPast: sub.VersionReaderAccessPast,
                        Expires: sub.Expires,
                        ExpirationValue: sub.ExpirationValue,
                        ExpirationUnit: sub.ExpirationUnit,
                        ExpirationAllowEdit: sub.ExpirationAllowEdit,
                        ExpirationNotify: sub.ExpirationNotify,
                        ExpirationNotifyDaysBefore: sub.ExpirationNotifyDaysBefore,
                        ExpirationNotifyRecipients: sub.ExpirationNotifyRecipients,
                        ControlledCopy: sub.ControlledCopy,
                        ControlledCopyType: sub.ControlledCopyType,
                        ControlledCopyFormat: sub.ControlledCopyFormat,
                        CreatedAt: sub.id ? undefined : new Date().toISOString()
                    };

                    const match = parentSubtypes.find(s => s.Code === sub.Code);
                    if (match) {
                        await tableLens.updateRecord('DMS_SubTypes', match.id, subRecord);
                    } else {
                        await tableLens.addRecord('DMS_SubTypes', subRecord);
                    }
                }

                modalDocTypeWizard.style.display = 'none';
                await loadDocTypesData();
            } catch (err) {
                alert("Erro ao gravar tipo de documento: " + err.message);
            } finally {
                btnSubmit.disabled = false;
                btnSubmit.textContent = "💾 Salvar Tipo de Documento";
            }
        };
    }

    // Toggle sub-type override fields
    if (subOverrideToggle) {
        subOverrideToggle.onchange = () => {
            subtypeOverrideSettings.style.display = subOverrideToggle.checked ? 'flex' : 'none';
        };
    }

    if (subVersionToggle) {
        subVersionToggle.onchange = () => {
            subVersionSettingsGroup.style.display = (subVersionToggle.value === 'true') ? 'flex' : 'none';
        };
    }

    if (subVersionRevision) {
        subVersionRevision.onchange = () => {
            if (subVersionRevision.value === 'true') {
                subGroupInitialVersion.style.display = 'none';
                subGroupRevisionPattern.style.display = 'block';
            } else {
                subGroupInitialVersion.style.display = 'block';
                subGroupRevisionPattern.style.display = 'none';
            }
        };
    }

    if (subExpirationToggle) {
        subExpirationToggle.onchange = () => {
            subExpirationSettingsGroup.style.display = (subExpirationToggle.value === 'true') ? 'flex' : 'none';
        };
    }

    if (subExpirationNotify) {
        subExpirationNotify.onchange = () => {
            subExpirationNotifyGroup.style.display = (subExpirationNotify.value === 'true') ? 'flex' : 'none';
        };
    }

    if (subControlledCopyToggle) {
        subControlledCopyToggle.onchange = () => {
            subControlledCopySettingsGroup.style.display = (subControlledCopyToggle.value === 'true') ? 'flex' : 'none';
        };
    }

    // Open Subtype Editor
    function openSubtypeEditor(index = null) {
        editingSubtypeIndex = index;
        formSubtypeEditor.reset();
        
        // Reset override fields
        subOverrideToggle.checked = false;
        subtypeOverrideSettings.style.display = 'none';
        subVersionSettingsGroup.style.display = 'none';
        subGroupInitialVersion.style.display = 'block';
        subGroupRevisionPattern.style.display = 'none';
        subExpirationSettingsGroup.style.display = 'none';
        subExpirationNotifyGroup.style.display = 'none';
        
        subControlledCopyToggle.value = 'false';
        subControlledCopySettingsGroup.style.display = 'none';
        subControlledCopyType.value = 'Both';
        subControlledCopyFormat.value = 'Both';

        subCodeInput.removeAttribute('readonly');
        subCodeInput.style.opacity = '1';

        if (index !== null) {
            subtypeWizardTitle.textContent = "Editar Sub-tipo";
            const sub = activeSubtypes[index];
            if (sub) {
                subCodeInput.value = sub.Code || '';
                subCodeInput.setAttribute('readonly', 'true');
                subCodeInput.style.opacity = '0.6';
                subNameInput.value = sub.Name || '';
                
                subOverrideToggle.checked = !sub.InheritSettings;
                if (!sub.InheritSettings) {
                    subtypeOverrideSettings.style.display = 'flex';
                    
                    subApprovalSelect.value = String(!!sub.RequireApproval);
                    subVersionToggle.value = String(!!sub.Versioned);
                    
                    if (sub.Versioned) {
                        subVersionSettingsGroup.style.display = 'flex';
                        subVersionFormat.value = sub.VersionFormat || 'Numeric';
                        subVersionRevision.value = String(!!sub.VersionHasRevision);
                        if (sub.VersionHasRevision) {
                            subGroupInitialVersion.style.display = 'none';
                            subGroupRevisionPattern.style.display = 'block';
                            subVersionPattern.value = sub.VersionRevisionPattern || '1.1.1.1.1';
                        } else {
                            subGroupInitialVersion.style.display = 'block';
                            subGroupRevisionPattern.style.display = 'none';
                            subVersionInitial.value = sub.VersionInitial || '1';
                        }
                        subVersionKeep.value = String(!!sub.VersionAllowKeepCurrent);
                        subVersionReader.value = String(!!sub.VersionReaderAccessPast);
                    }
                    
                    subExpirationToggle.value = String(!!sub.Expires);
                    if (sub.Expires) {
                        subExpirationSettingsGroup.style.display = 'flex';
                        subExpirationVal.value = sub.ExpirationValue || 12;
                        subExpirationUnit.value = sub.ExpirationUnit || 'Months';
                        subExpirationEdit.value = String(!!sub.ExpirationAllowEdit);
                        subExpirationNotify.value = String(!!sub.ExpirationNotify);
                        if (sub.ExpirationNotify) {
                            subExpirationNotifyGroup.style.display = 'flex';
                            subExpirationNotifyDays.value = sub.ExpirationNotifyDaysBefore || 30;
                            subExpirationNotifyRecipients.value = sub.ExpirationNotifyRecipients || '';
                        }
                    }

                    subControlledCopyToggle.value = String(!!sub.ControlledCopy);
                    if (sub.ControlledCopy) {
                        subControlledCopySettingsGroup.style.display = 'flex';
                        subControlledCopyType.value = sub.ControlledCopyType || 'Both';
                        subControlledCopyFormat.value = sub.ControlledCopyFormat || 'Both';
                    } else {
                        subControlledCopySettingsGroup.style.display = 'none';
                    }
                }
            }
        } else {
            subtypeWizardTitle.textContent = "Novo Sub-tipo";
        }
        
        modalSubtypeEditor.style.display = 'flex';
    }

    if (btnAddSubtype) {
        btnAddSubtype.onclick = () => { openSubtypeEditor(); };
    }

    if (btnSubtypeClose && btnSubtypeCancel) {
        btnSubtypeClose.onclick = btnSubtypeCancel.onclick = () => {
            modalSubtypeEditor.style.display = 'none';
        };
    }

    // Submit Subtype Form
    if (formSubtypeEditor) {
        formSubtypeEditor.onsubmit = (e) => {
            e.preventDefault();
            
            const code = subCodeInput.value.toUpperCase().trim();
            const name = subNameInput.value.trim();
            
            if (editingSubtypeIndex === null) {
                // Check duplicate Code
                if (activeSubtypes.some(s => s.Code === code)) {
                    alert(`O Código de sub-tipo "${code}" já foi adicionado a este tipo.`);
                    return;
                }
            }

            const inheritSettings = !subOverrideToggle.checked;
            
            // Build subtype object
            const subtypeObj = {
                Code: code,
                Name: name,
                InheritSettings: inheritSettings,
                RequireApproval: false,
                Versioned: false,
                VersionFormat: 'Numeric',
                VersionHasRevision: false,
                VersionInitial: '1',
                VersionRevisionPattern: '1.1.1.1.1',
                VersionAllowKeepCurrent: true,
                VersionReaderAccessPast: true,
                Expires: false,
                ExpirationValue: 12,
                ExpirationUnit: 'Months',
                ExpirationAllowEdit: true,
                ExpirationNotify: false,
                ExpirationNotifyDaysBefore: 30,
                ExpirationNotifyRecipients: '',
                ControlledCopy: false,
                ControlledCopyType: 'Both',
                ControlledCopyFormat: 'Both'
            };

            if (!inheritSettings) {
                subtypeObj.RequireApproval = subApprovalSelect.value === 'true';
                subtypeObj.Versioned = subVersionToggle.value === 'true';
                if (subtypeObj.Versioned) {
                    subtypeObj.VersionFormat = subVersionFormat.value;
                    subtypeObj.VersionHasRevision = subVersionRevision.value === 'true';
                    if (subtypeObj.VersionHasRevision) {
                        subtypeObj.VersionRevisionPattern = subVersionPattern.value;
                        subtypeObj.VersionInitial = '1.0';
                    } else {
                        subtypeObj.VersionInitial = subVersionInitial.value;
                    }
                    subtypeObj.VersionAllowKeepCurrent = subVersionKeep.value === 'true';
                    subtypeObj.VersionReaderAccessPast = subVersionReader.value === 'true';
                }
                subtypeObj.Expires = subExpirationToggle.value === 'true';
                if (subtypeObj.Expires) {
                    subtypeObj.ExpirationValue = parseInt(subExpirationVal.value) || 12;
                    subtypeObj.ExpirationUnit = subExpirationUnit.value;
                    subtypeObj.ExpirationAllowEdit = subExpirationEdit.value === 'true';
                    subtypeObj.ExpirationNotify = subExpirationNotify.value === 'true';
                    if (subtypeObj.ExpirationNotify) {
                        subtypeObj.ExpirationNotifyDaysBefore = parseInt(subExpirationNotifyDays.value) || 30;
                        subtypeObj.ExpirationNotifyRecipients = subExpirationNotifyRecipients.value;
                    }
                }

                subtypeObj.ControlledCopy = subControlledCopyToggle.value === 'true';
                if (subtypeObj.ControlledCopy) {
                    subtypeObj.ControlledCopyType = subControlledCopyType.value;
                    subtypeObj.ControlledCopyFormat = subControlledCopyFormat.value;
                }
            }

            if (editingSubtypeIndex !== null) {
                // Manter o ID caso exista
                subtypeObj.id = activeSubtypes[editingSubtypeIndex].id;
                activeSubtypes[editingSubtypeIndex] = subtypeObj;
            } else {
                activeSubtypes.push(subtypeObj);
            }

            modalSubtypeEditor.style.display = 'none';
            renderActiveSubtypes();
        };
    }

    // Render subtypes list in main wizard
    function renderActiveSubtypes() {
        if (!typeSubtypesList) return;
        typeSubtypesList.innerHTML = '';
        
        if (activeSubtypes.length === 0) {
            typeSubtypesList.innerHTML = '<div style="font-size:12px; color:var(--text-muted); font-style:italic; padding:6px 0;">Nenhum sub-tipo adicionado ainda.</div>';
            return;
        }

        activeSubtypes.forEach((sub, index) => {
            const row = document.createElement('div');
            row.style.display = 'flex';
            row.style.alignItems = 'center';
            row.style.justifyContent = 'space-between';
            row.style.background = 'white';
            row.style.border = '1px solid var(--border-color)';
            row.style.borderRadius = '4px';
            row.style.padding = '6px 10px';
            row.style.fontSize = '13px';

            const left = document.createElement('div');
            left.style.display = 'flex';
            left.style.alignItems = 'center';
            left.style.gap = '8px';
            
            const badge = document.createElement('span');
            badge.className = 'type-card-sigla';
            badge.style.fontSize = '10px';
            badge.style.padding = '1px 4px';
            badge.textContent = sub.Code;
            
            const nameSpan = document.createElement('span');
            nameSpan.style.fontWeight = '500';
            nameSpan.textContent = sub.Name;

            const modeSpan = document.createElement('span');
            modeSpan.style.fontSize = '11px';
            modeSpan.style.color = 'var(--text-muted)';
            modeSpan.textContent = sub.InheritSettings ? '(Herda configs)' : '(Configs exclusivas)';

            left.appendChild(badge);
            left.appendChild(nameSpan);
            left.appendChild(modeSpan);

            const right = document.createElement('div');
            right.style.display = 'flex';
            right.style.gap = '6px';

            const btnEdit = document.createElement('button');
            btnEdit.type = 'button';
            btnEdit.className = 'btn btn-secondary btn-sm';
            btnEdit.style.padding = '2px 6px';
            btnEdit.textContent = '✏️';
            btnEdit.onclick = () => { openSubtypeEditor(index); };

            const btnDel = document.createElement('button');
            btnDel.type = 'button';
            btnDel.className = 'btn btn-secondary btn-sm';
            btnDel.style.padding = '2px 6px';
            btnDel.style.color = '#ef4444';
            btnDel.textContent = '🗑️';
            btnDel.onclick = () => {
                activeSubtypes.splice(index, 1);
                renderActiveSubtypes();
            };

            right.appendChild(btnEdit);
            right.appendChild(btnDel);

            row.appendChild(left);
            row.appendChild(right);
            typeSubtypesList.appendChild(row);
        });
    }

    // Modal Events
    async function populateNewDocDropdowns() {
        try {
            const docTypes = await tableLens.fetchTableRecords('DMS_DocTypes');
            const sectors = await tableLens.fetchTableRecords('DMS_Sectors');
            
            const typeSelect = document.getElementById('new-doc-type');
            const subtypeSelect = document.getElementById('new-doc-subtype');
            const sectorSelect = document.getElementById('new-doc-sector');
            
            typeSelect.innerHTML = '<option value="">-- Selecione o Tipo --</option>';
            docTypes.forEach(t => {
                if (t.Code && t.Name) {
                    typeSelect.innerHTML += `<option value="${t.id}" data-code="${t.Code}">${t.Code} - ${t.Name}</option>`;
                }
            });
            
            subtypeSelect.innerHTML = '<option value="">Selecione o Tipo primeiro...</option>';
            subtypeSelect.disabled = true;

            typeSelect.onchange = async () => {
                const typeId = parseInt(typeSelect.value);
                if (!typeId) {
                    subtypeSelect.innerHTML = '<option value="">Selecione o Tipo primeiro...</option>';
                    subtypeSelect.disabled = true;
                    return;
                }

                try {
                    const allSubList = await tableLens.fetchTableRecords('DMS_SubTypes');
                    const filteredSubtypes = allSubList.filter(s => {
                        const parentId = Array.isArray(s.DocType) ? s.DocType[1] : s.DocType;
                        return Number(parentId) === typeId;
                    });

                    if (filteredSubtypes.length === 0) {
                        subtypeSelect.innerHTML = '<option value="">Sem sub-tipos cadastrados</option>';
                        subtypeSelect.disabled = true;
                    } else {
                        subtypeSelect.innerHTML = '<option value="">-- Selecione o Sub-tipo --</option>';
                        filteredSubtypes.forEach(sub => {
                            subtypeSelect.innerHTML += `<option value="${sub.id}" data-code="${sub.Code}">${sub.Code} - ${sub.Name}</option>`;
                        });
                        subtypeSelect.disabled = false;
                    }
                } catch(err) {
                    console.error("Erro ao buscar sub-tipos para dropdown:", err);
                    subtypeSelect.innerHTML = '<option value="">Erro ao carregar</option>';
                }
            };

            sectorSelect.innerHTML = '<option value="">-- Selecione o Setor --</option>';
            sectors.forEach(s => {
                if (s.Code && s.Name) {
                    sectorSelect.innerHTML += `<option value="${s.id}" data-code="${s.Code}">${s.Code} - ${s.Name}</option>`;
                }
            });
        } catch (e) {
            console.error("Erro ao carregar tipos e setores para dropdowns:", e);
        }
    }

    btnNewDoc.onclick = async () => {
        document.getElementById('new-doc-path').value = activeFolder;
        await populateNewDocDropdowns();
        modalNewDoc.style.display = 'flex';
    };
    btnNewDocClose.onclick = btnNewDocCancel.onclick = () => { modalNewDoc.style.display = 'none'; };
    formNewDoc.onsubmit = handleNewDocSubmit;

    btnModalClose.onclick = btnModalCancel.onclick = () => { modalVersionFlow.style.display = 'none'; };
    formVersionFlow.onsubmit = handleVersionFlowSubmit;

    // Garantir que a tabela DMS_DocTypes possua todos os campos de configuração ISO necessários
    async function ensureDocTypesSchemaUpdated() {
        try {
            // Usar fetchTable para descobrir as colunas atuais sem precisar de API Key
            const tableData = await grist.docApi.fetchTable('DMS_DocTypes');
            const existingColumns = Object.keys(tableData).filter(k => k !== 'id');
            
            const requiredColumns = [
                { id: "Description", type: "Text" },
                { id: "SubTypes", type: "Text" },
                { id: "RequireApproval", type: "Bool" },
                { id: "Versioned", type: "Bool" },
                { id: "VersionFormat", type: "Text" },
                { id: "VersionHasRevision", type: "Bool" },
                { id: "VersionInitial", type: "Text" },
                { id: "VersionRevisionPattern", type: "Text" },
                { id: "VersionAllowKeepCurrent", type: "Bool" },
                { id: "VersionReaderAccessPast", type: "Bool" },
                { id: "Expires", type: "Bool" },
                { id: "ExpirationValue", type: "Int" },
                { id: "ExpirationUnit", type: "Text" },
                { id: "ExpirationAllowEdit", type: "Bool" },
                { id: "ExpirationNotify", type: "Bool" },
                { id: "ExpirationNotifyDaysBefore", type: "Int" },
                { id: "ExpirationNotifyRecipients", type: "Text" },
                { id: "AssociatedFolders", type: "Text" },
                { id: "ControlledCopy", type: "Bool" },
                { id: "ControlledCopyType", type: "Text" },
                { id: "ControlledCopyFormat", type: "Text" },
                { id: "CreatedAt", type: "DateTime" }
            ];

            const missingColumns = requiredColumns.filter(col => !existingColumns.includes(col.id));

            if (missingColumns.length > 0) {
                console.log("[DMS] Detectadas colunas de configuração ausentes em DMS_DocTypes. Criando via REST API...", missingColumns);
                
                // Inicializar API Rest
                await GristRestApi.init(grist);
                // Requerer autorização (no localhost é automático, no servidor remoto solicitará a API Key)
                await GristRestApi.requireApiKey();

                for (const col of missingColumns) {
                    await GristRestApi.createColumn('DMS_DocTypes', col.id, { type: col.type });
                }
                console.log("[DMS] Todas as colunas ausentes de DMS_DocTypes foram criadas com sucesso!");
            }
        } catch (e) {
            console.error("DMS: Falha ao verificar ou atualizar o esquema de DMS_DocTypes:", e);
        }
    }

    // Garantir que a tabela DMS_Documents possua a coluna SubType
    async function ensureDocumentsSchemaUpdated() {
        try {
            const tableData = await grist.docApi.fetchTable('DMS_Documents');
            const existingColumns = Object.keys(tableData).filter(k => k !== 'id');
            
            if (!existingColumns.includes('SubType')) {
                console.log("[DMS] Detectada coluna SubType ausente em DMS_Documents. Criando via REST API...");
                await GristRestApi.init(grist);
                await GristRestApi.requireApiKey();
                await GristRestApi.createColumn('DMS_Documents', 'SubType', { type: 'Ref:DMS_SubTypes' });
                console.log("[DMS] Coluna SubType de DMS_Documents criada com sucesso!");
            }
        } catch (e) {
            console.error("DMS: Falha ao verificar ou atualizar o esquema de DMS_Documents:", e);
        }
    }

    // Resolve as regras (Aprovação, Versionamento, Expiração) para um documento levando em conta overrides de sub-tipo
    async function resolveDocRules(doc) {
        const typeCol = currentConfig.mapping?.docTypeField || 'DocType';
        const docTypeId = Array.isArray(doc[typeCol]) ? doc[typeCol][1] : doc[typeCol];
        const docSubtypeId = Array.isArray(doc.SubType) ? doc.SubType[1] : doc.SubType;

        const defaultRules = {
            RequireApproval: false,
            Versioned: false,
            VersionFormat: 'Numeric',
            VersionHasRevision: false,
            VersionInitial: '1',
            VersionRevisionPattern: '1.1.1.1.1',
            VersionAllowKeepCurrent: true,
            VersionReaderAccessPast: true,
            Expires: false,
            ExpirationValue: 12,
            ExpirationUnit: 'Months',
            ExpirationAllowEdit: true,
            ExpirationNotify: false,
            ExpirationNotifyDaysBefore: 30,
            ExpirationNotifyRecipients: '',
            ControlledCopy: false,
            ControlledCopyType: 'Both',
            ControlledCopyFormat: 'Both'
        };

        if (!docTypeId) return defaultRules;

        try {
            const docTypes = await tableLens.fetchTableRecords('DMS_DocTypes');
            const parentType = docTypes.find(t => t.id === Number(docTypeId));
            if (!parentType) return defaultRules;

            if (docSubtypeId) {
                const subTypes = await tableLens.fetchTableRecords('DMS_SubTypes');
                const subRecord = subTypes.find(s => s.id === Number(docSubtypeId));
                
                if (subRecord && !subRecord.InheritSettings) {
                    return {
                        RequireApproval: !!subRecord.RequireApproval,
                        Versioned: !!subRecord.Versioned,
                        VersionFormat: subRecord.VersionFormat || 'Numeric',
                        VersionHasRevision: !!subRecord.VersionHasRevision,
                        VersionInitial: subRecord.VersionInitial || '1',
                        VersionRevisionPattern: subRecord.VersionRevisionPattern || '1.1.1.1.1',
                        VersionAllowKeepCurrent: !!subRecord.VersionAllowKeepCurrent,
                        VersionReaderAccessPast: !!subRecord.VersionReaderAccessPast,
                        Expires: !!subRecord.Expires,
                        ExpirationValue: subRecord.ExpirationValue || 12,
                        ExpirationUnit: subRecord.ExpirationUnit || 'Months',
                        ExpirationAllowEdit: !!subRecord.ExpirationAllowEdit,
                        ExpirationNotify: !!subRecord.ExpirationNotify,
                        ExpirationNotifyDaysBefore: subRecord.ExpirationNotifyDaysBefore || 30,
                        ExpirationNotifyRecipients: subRecord.ExpirationNotifyRecipients || '',
                        ControlledCopy: !!subRecord.ControlledCopy,
                        ControlledCopyType: subRecord.ControlledCopyType || 'Both',
                        ControlledCopyFormat: subRecord.ControlledCopyFormat || 'Both'
                    };
                }
            }

            return {
                RequireApproval: !!parentType.RequireApproval,
                Versioned: !!parentType.Versioned,
                VersionFormat: parentType.VersionFormat || 'Numeric',
                VersionHasRevision: !!parentType.VersionHasRevision,
                VersionInitial: parentType.VersionInitial || '1',
                VersionRevisionPattern: parentType.VersionRevisionPattern || '1.1.1.1.1',
                VersionAllowKeepCurrent: !!parentType.VersionAllowKeepCurrent,
                VersionReaderAccessPast: !!parentType.VersionReaderAccessPast,
                Expires: !!parentType.Expires,
                ExpirationValue: parentType.ExpirationValue || 12,
                ExpirationUnit: parentType.ExpirationUnit || 'Months',
                ExpirationAllowEdit: !!parentType.ExpirationAllowEdit,
                ExpirationNotify: !!parentType.ExpirationNotify,
                ExpirationNotifyDaysBefore: parentType.ExpirationNotifyDaysBefore || 30,
                ExpirationNotifyRecipients: parentType.ExpirationNotifyRecipients || '',
                ControlledCopy: !!parentType.ControlledCopy,
                ControlledCopyType: parentType.ControlledCopyType || 'Both',
                ControlledCopyFormat: parentType.ControlledCopyFormat || 'Both'
            };
        } catch (err) {
            console.error("Erro ao resolver regras do documento:", err);
            return defaultRules;
        }
    }

    // Garantir que a tabela DMS_SubTypes possua todos os campos de override necessários
    async function ensureSubTypesSchemaUpdated() {
        try {
            // Usar fetchTable para descobrir as colunas atuais sem precisar de API Key
            const tableData = await grist.docApi.fetchTable('DMS_SubTypes');
            const existingColumns = Object.keys(tableData).filter(k => k !== 'id');
            
            const requiredColumns = [
                { id: "DocType", type: "Ref:DMS_DocTypes" },
                { id: "Code", type: "Text" },
                { id: "Name", type: "Text" },
                { id: "InheritSettings", type: "Bool" },
                { id: "RequireApproval", type: "Bool" },
                { id: "Versioned", type: "Bool" },
                { id: "VersionFormat", type: "Text" },
                { id: "VersionHasRevision", type: "Bool" },
                { id: "VersionInitial", type: "Text" },
                { id: "VersionRevisionPattern", type: "Text" },
                { id: "VersionAllowKeepCurrent", type: "Bool" },
                { id: "VersionReaderAccessPast", type: "Bool" },
                { id: "Expires", type: "Bool" },
                { id: "ExpirationValue", type: "Int" },
                { id: "ExpirationUnit", type: "Text" },
                { id: "ExpirationAllowEdit", type: "Bool" },
                { id: "ExpirationNotify", type: "Bool" },
                { id: "ExpirationNotifyDaysBefore", type: "Int" },
                { id: "ExpirationNotifyRecipients", type: "Text" },
                { id: "ControlledCopy", type: "Bool" },
                { id: "ControlledCopyType", type: "Text" },
                { id: "ControlledCopyFormat", type: "Text" },
                { id: "CreatedAt", type: "DateTime" }
            ];

            const missingColumns = requiredColumns.filter(col => !existingColumns.includes(col.id));

            if (missingColumns.length > 0) {
                console.log("[DMS] Detectadas colunas de configuração ausentes em DMS_SubTypes. Criando via REST API...", missingColumns);
                
                await GristRestApi.init(grist);
                await GristRestApi.requireApiKey();

                for (const col of missingColumns) {
                    await GristRestApi.createColumn('DMS_SubTypes', col.id, { type: col.type });
                }
                console.log("[DMS] Todas as colunas ausentes de DMS_SubTypes foram criadas com sucesso!");
            }
        } catch (e) {
            console.error("DMS: Falha ao verificar ou atualizar o esquema de DMS_SubTypes:", e);
        }
    }

    // Load DMS Data & Config
    async function loadDmsData() {
        // 1. Verificar nível de acesso do widget no Grist
        let hasAccess = true;
        try {
            await grist.docApi.listTables();
        } catch (e) {
            console.warn("DMS: Falha ao verificar acesso ao documento (Access Level = None):", e);
            hasAccess = false;
        }

        if (!hasAccess) {
            renderAccessDeniedScreen();
            return;
        }

        if (!currentConfigId) {
            renderWelcomePlaceholder();
            return;
        }

        try {
            currentConfig = await tableLens.fetchConfig(currentConfigId, { bypassCache: true });
            if (!currentConfig) {
                renderWelcomePlaceholder();
                return;
            }

            // Aplicar estilo/tema
            const styling = currentConfig.styling || {};
            const theme = styling.theme || 'glassmorphism';
            document.body.className = `theme-${theme}`;
            if (styling.sidebarWidth) {
                document.getElementById('dms-sidebar').style.width = styling.sidebarWidth;
            }

            // Mapeamentos de Tabelas
            const docsTable = currentConfig.mapping?.documentsTable || 'DMS_Documents';
            const versTable = currentConfig.mapping?.versionsTable || 'DMS_Versions';

            // Validar tabelas
            const allTableIds = await grist.docApi.listTables();
            if (!allTableIds.includes(docsTable) || !allTableIds.includes(versTable) || !allTableIds.includes('DMS_DocTypes') || !allTableIds.includes('DMS_SubTypes') || !allTableIds.includes('DMS_Sectors')) {
                renderSetupView(docsTable, versTable, allTableIds);
                return;
            }

            // Garantir colunas de configurações atualizadas
            await ensureDocTypesSchemaUpdated();
            await ensureSubTypesSchemaUpdated();
            await ensureDocumentsSchemaUpdated();

            // Carregar registros das tabelas
            allDocuments = await tableLens.fetchTableRecords(docsTable);
            allVersions = await tableLens.fetchTableRecords(versTable);

            // Garantir que a interface do DMS esteja visível e o overlay de setup esteja oculto
            document.getElementById('dms-container').style.display = 'flex';
            document.getElementById('dms-welcome-overlay').style.display = 'none';

            buildFolderTree();
            if (activeViewMode === 'types') {
                await loadDocTypesData();
            } else {
                renderDocList();
            }
            
            if (selectedDoc) {
                // Atualizar doc selecionado
                const updatedDoc = allDocuments.find(d => d.id === selectedDoc.id);
                if (updatedDoc) {
                    selectedDoc = updatedDoc;
                    loadPreview(selectedDoc);
                } else {
                    previewPanel.classList.add('collapsed');
                    selectedDoc = null;
                }
            }

            addSettingsGear();
        } catch (e) {
            console.error("DMS: Erro ao carregar dados", e);
            document.getElementById('dms-container').innerHTML = `
                <div class="status-placeholder" style="color:red; font-size:16px;">
                    ❌ Erro ao inicializar o widget:<br>${e.message}
                </div>
            `;
            addSettingsGear();
        }
    }

    function renderWelcomePlaceholder() {
        document.getElementById('dms-container').style.display = 'none';
        const overlay = document.getElementById('dms-welcome-overlay');
        overlay.style.display = 'block';
        overlay.innerHTML = `
            <div class="status-placeholder" style="padding:40px; max-width:600px; margin:50px auto; background:white; border-radius:12px; border:1px solid var(--border-color); box-shadow:var(--shadow-md); text-align:center;">
                <h2 style="font-size:22px; margin-bottom:10px; color:var(--primary-color); display:flex; align-items:center; justify-content:center; gap:8px;">
                    ⚙️ Configuração do Sistema DMS
                </h2>
                <p style="color:var(--text-muted); font-size:14px; margin-bottom:25px;">
                    O widget de Gestão de Documentos (DMS) está pronto para instalação no seu documento Grist.
                </p>
                
                <div style="background:#f1f5f9; padding:20px; border-radius:8px; border:1px solid #cbd5e1; margin-bottom:20px; text-align:left;">
                    <h4 style="margin:0 0 10px 0; font-size:14px; color:#1e293b;">🚀 Instalação Expressa (Recomendado)</h4>
                    <p style="font-size:13px; color:#475569; margin:0 0 15px 0; line-height:1.4;">
                        Cria automaticamente todas as tabelas necessárias (<code>Grf_config</code>, <code>DMS_Documents</code>, <code>DMS_Versions</code>) e ativa a configuração padrão do DMS no documento.
                    </p>
                    <button id="btn-welcome-autosetup" class="btn btn-primary" style="width:100%; font-size:14px; padding:10px;">
                        🚀 Realizar Instalação Completa (1-Clique)
                    </button>
                </div>
                
                <div style="text-align:center; margin-top:15px;">
                    <button id="btn-welcome-configure" class="btn btn-secondary" style="font-size:13px; padding:8px 16px;">
                        ⚙️ Abrir Configurador Manual
                    </button>
                </div>
            </div>
        `;
        
        const btnManual = document.getElementById('btn-welcome-configure');
        if (btnManual) {
            btnManual.onclick = openSettingsPopover;
        }

        const btnAuto = document.getElementById('btn-welcome-autosetup');
        if (btnAuto) {
            btnAuto.onclick = async (e) => {
                const btn = e.target;
                btn.disabled = true;
                btn.textContent = "⏳ Verificando tabelas...";

                try {
                    await GristRestApi.init(grist);
                    
                    btn.textContent = "⏳ Criando tabelas estruturais no Grist...";
                    const allTables = await grist.docApi.listTables();
                    const tablesToCreate = [];

                    // 1. Verificar Grf_config
                    if (!allTables.includes('Grf_config')) {
                        const requiredConfigSchema = [
                            { id: "configId", fields: { type: "Text" } },
                            { id: "widgetTitle", fields: { type: "Text" } },
                            { id: "description", fields: { type: "Text" } },
                            { id: "componentType", fields: { type: "Text" } },
                            { id: "mappingJson", fields: { type: "Text" } },
                            { id: "stylingJson", fields: { type: "Text" } },
                            { id: "actionsJson", fields: { type: "Text" } }
                        ];
                        tablesToCreate.push({ id: 'Grf_config', columns: requiredConfigSchema });
                    }

                    // 2. Verificar DMS_DocTypes
                    if (!allTables.includes('DMS_DocTypes')) {
                        const docTypesSchema = [
                            { id: "Code", fields: { type: "Text" } },
                            { id: "Name", fields: { type: "Text" } },
                            { id: "Description", fields: { type: "Text" } },
                            { id: "SubTypes", fields: { type: "Text" } },
                            { id: "RequireApproval", fields: { type: "Bool" } },
                            { id: "Versioned", fields: { type: "Bool" } },
                            { id: "VersionFormat", fields: { type: "Text" } },
                            { id: "VersionHasRevision", fields: { type: "Bool" } },
                            { id: "VersionInitial", fields: { type: "Text" } },
                            { id: "VersionRevisionPattern", fields: { type: "Text" } },
                            { id: "VersionAllowKeepCurrent", fields: { type: "Bool" } },
                            { id: "VersionReaderAccessPast", fields: { type: "Bool" } },
                            { id: "Expires", fields: { type: "Bool" } },
                            { id: "ExpirationValue", fields: { type: "Int" } },
                            { id: "ExpirationUnit", fields: { type: "Text" } },
                            { id: "ExpirationAllowEdit", fields: { type: "Bool" } },
                            { id: "ExpirationNotify", fields: { type: "Bool" } },
                            { id: "ExpirationNotifyDaysBefore", fields: { type: "Int" } },
                            { id: "ExpirationNotifyRecipients", fields: { type: "Text" } },
                            { id: "AssociatedFolders", fields: { type: "Text" } },
                            { id: "ControlledCopy", fields: { type: "Bool" } },
                            { id: "ControlledCopyType", fields: { type: "Text" } },
                            { id: "ControlledCopyFormat", fields: { type: "Text" } },
                            { id: "CreatedAt", fields: { type: "DateTime" } }
                        ];
                        tablesToCreate.push({ id: 'DMS_DocTypes', columns: docTypesSchema });
                    }
 
                    // 2.5 Verificar DMS_SubTypes
                    if (!allTables.includes('DMS_SubTypes')) {
                        const subTypesSchema = [
                            { id: "DocType", fields: { type: "Ref:DMS_DocTypes" } },
                            { id: "Code", fields: { type: "Text" } },
                            { id: "Name", fields: { type: "Text" } },
                            { id: "InheritSettings", fields: { type: "Bool" } },
                            { id: "RequireApproval", fields: { type: "Bool" } },
                            { id: "Versioned", fields: { type: "Bool" } },
                            { id: "VersionFormat", fields: { type: "Text" } },
                            { id: "VersionHasRevision", fields: { type: "Bool" } },
                            { id: "VersionInitial", fields: { type: "Text" } },
                            { id: "VersionRevisionPattern", fields: { type: "Text" } },
                            { id: "VersionAllowKeepCurrent", fields: { type: "Bool" } },
                            { id: "VersionReaderAccessPast", fields: { type: "Bool" } },
                            { id: "Expires", fields: { type: "Bool" } },
                            { id: "ExpirationValue", fields: { type: "Int" } },
                            { id: "ExpirationUnit", fields: { type: "Text" } },
                            { id: "ExpirationAllowEdit", fields: { type: "Bool" } },
                            { id: "ExpirationNotify", fields: { type: "Bool" } },
                            { id: "ExpirationNotifyDaysBefore", fields: { type: "Int" } },
                            { id: "ExpirationNotifyRecipients", fields: { type: "Text" } },
                            { id: "ControlledCopy", fields: { type: "Bool" } },
                            { id: "ControlledCopyType", fields: { type: "Text" } },
                            { id: "ControlledCopyFormat", fields: { type: "Text" } },
                            { id: "CreatedAt", fields: { type: "DateTime" } }
                        ];
                        tablesToCreate.push({ id: 'DMS_SubTypes', columns: subTypesSchema });
                    }

                    // 3. Verificar DMS_Sectors
                    if (!allTables.includes('DMS_Sectors')) {
                        const sectorsSchema = [
                            { id: "Code", fields: { type: "Text" } },
                            { id: "Name", fields: { type: "Text" } }
                        ];
                        tablesToCreate.push({ id: 'DMS_Sectors', columns: sectorsSchema });
                    }

                    // 4. Verificar DMS_Documents
                    const docsTable = 'DMS_Documents';
                    if (!allTables.includes(docsTable)) {
                        const requiredDocsSchema = [
                            { id: "Name", fields: { type: "Text" } },
                            { id: "Path", fields: { type: "Text" } },
                            { id: "DocType", fields: { type: "Ref:DMS_DocTypes" } },
                            { id: "Sector", fields: { type: "Ref:DMS_Sectors" } },
                            { id: "Number", fields: { type: "Numeric" } },
                            { id: "Code", fields: { type: "Text" } }
                        ];
                        tablesToCreate.push({ id: docsTable, columns: requiredDocsSchema });
                    }

                    // 5. Verificar DMS_Versions
                    const versTable = 'DMS_Versions';
                    if (!allTables.includes(versTable)) {
                        const requiredVersSchema = [
                            { id: "DocRef", fields: { type: "Ref:DMS_Documents" } },
                            { id: "VersionMajor", fields: { type: "Numeric" } },
                            { id: "VersionMinor", fields: { type: "Numeric" } },
                            { id: "VersionString", fields: { type: "Text" } },
                            { id: "Status", fields: { type: "Text" } },
                            { id: "SourceType", fields: { type: "Text" } },
                            { id: "SourceFile", fields: { type: "Attachments" } },
                            { id: "SourceMarkdown", fields: { type: "Text" } },
                            { id: "OfficialFile", fields: { type: "Attachments" } },
                            { id: "Justification", fields: { type: "Text" } },
                            { id: "UpdatedAt", fields: { type: "DateTime" } },
                            { id: "UpdatedBy", fields: { type: "Text" } }
                        ];
                        tablesToCreate.push({ id: versTable, columns: requiredVersSchema });
                    }

                    if (tablesToCreate.length > 0) {
                        await GristRestApi.request('/tables', {
                            method: 'POST',
                            body: JSON.stringify({ tables: tablesToCreate })
                        });
                    }

                    // Inserir Seed Records (Dados Iniciais) para Tipos e Setores
                    btn.textContent = "⏳ Inserindo dados iniciais (Tipos e Setores)...";
                    try {
                        const existingTypes = await tableLens.fetchTableRecords('DMS_DocTypes');
                        if (existingTypes.length === 0) {
                            await tableLens.addRecord('DMS_DocTypes', { Code: 'PQP', Name: 'Procedimento' });
                            await tableLens.addRecord('DMS_DocTypes', { Code: 'ITP', Name: 'Instrução de Trabalho' });
                            await tableLens.addRecord('DMS_DocTypes', { Code: 'REG', Name: 'Registro' });
                        }
                    } catch (errSeedTypes) {
                        console.warn("DMS: Falha ao inserir seeds em DMS_DocTypes:", errSeedTypes);
                    }

                    try {
                        const existingSectors = await tableLens.fetchTableRecords('DMS_Sectors');
                        if (existingSectors.length === 0) {
                            await tableLens.addRecord('DMS_Sectors', { Code: 'ADM', Name: 'Administração' });
                            await tableLens.addRecord('DMS_Sectors', { Code: 'RH', Name: 'Recursos Humanos' });
                            await tableLens.addRecord('DMS_Sectors', { Code: 'MAN', Name: 'Manutenção' });
                            await tableLens.addRecord('DMS_Sectors', { Code: 'QUA', Name: 'Qualidade' });
                        }
                    } catch (errSeedSectors) {
                        console.warn("DMS: Falha ao inserir seeds em DMS_Sectors:", errSeedSectors);
                    }

                    // 4. Registrar preset default na Grf_config
                    btn.textContent = "⏳ Registrando configuração do DMS...";
                    const defaultPresetId = 'preset-dms-default';
                    const configRecord = {
                        configId: defaultPresetId,
                        widgetTitle: "Sistema DMS",
                        description: "[DMS] Configuração Inicial do Sistema de Gestão de Documentos",
                        componentType: "DMS",
                        mappingJson: JSON.stringify({
                            documentsTable: docsTable,
                            versionsTable: versTable,
                            titleField: 'Name',
                            pathField: 'Path',
                            docTypeField: 'DocType',
                            sectorField: 'Sector',
                            numberField: 'Number',
                            codeField: 'Code',
                            docRefField: 'DocRef',
                            versionMajorField: 'VersionMajor',
                            versionMinorField: 'VersionMinor',
                            versionStringField: 'VersionString',
                            statusField: 'Status',
                            sourceTypeField: 'SourceType',
                            sourceFileField: 'SourceFile',
                            sourceMarkdownField: 'SourceMarkdown',
                            officialFileField: 'OfficialFile',
                            justificationField: 'Justification',
                            updatedAtField: 'UpdatedAt',
                            updatedByField: 'UpdatedBy'
                        }),
                        stylingJson: JSON.stringify({
                            sidebarWidth: '280px',
                            theme: 'glassmorphism'
                        }),
                        actionsJson: JSON.stringify({
                            drawerConfigId: ''
                        })
                    };

                    await tableLens.addRecord('Grf_config', configRecord);

                    // 5. Vincular a nova configuração ao widget
                    btn.textContent = "⏳ Vinculando ao widget...";
                    await grist.setOptions({ configId: defaultPresetId });

                    btn.textContent = "✅ Pronto!";
                    btn.style.background = "#10b981";

                    // Re-carregar dados e inicializar visualização diretamente sem refresh
                    currentConfigId = defaultPresetId;
                    await loadDmsData();

                } catch (err) {
                    alert("Erro na instalação automática: " + err.message);
                    btn.disabled = false;
                    btn.textContent = "❌ Tentar Instalação Completa";
                }
            };
        }
        
        addSettingsGear();
    }

    function renderAccessDeniedScreen() {
        document.getElementById('dms-container').style.display = 'none';
        const overlay = document.getElementById('dms-welcome-overlay');
        overlay.style.display = 'block';
        overlay.innerHTML = `
            <div class="status-placeholder" style="padding:40px; max-width:550px; margin:50px auto; background:white; border-radius:12px; border:1px solid var(--border-color); box-shadow:var(--shadow-md); text-align:left; color:var(--text-main);">
                <h2 style="font-size:20px; margin-top:0; margin-bottom:15px; color:#e11d48; display:flex; align-items:center; gap:8px;">
                    ⚠️ Nível de Acesso Insuficiente
                </h2>
                <p style="color:var(--text-muted); font-size:14px; margin-bottom:20px; line-height:1.5;">
                    O Grist bloqueou o acesso do widget ao documento. Para ler, gravar e criar configurações ou tabelas estruturais, este widget precisa de permissão de <b>Acesso Completo (Full Access)</b>.
                </p>
                <div style="background:#f1f5f9; padding:20px; border-radius:8px; border:1px solid #cbd5e1; margin-bottom:20px;">
                    <h4 style="margin:0 0 10px 0; font-size:14px; color:#1e293b;">Como conceder permissão:</h4>
                    <ol style="margin:0; padding-left:20px; font-size:13px; color:#475569; line-height:1.6;">
                        <li>No painel lateral direito do Grist, clique na aba <b>Widget</b>.</li>
                        <li>Localize a seção <b>Access Level</b> (Nível de Acesso).</li>
                        <li>Altere de <b>None</b> para <b>Full</b> (Acesso Completo).</li>
                        <li>Quando o Grist exibir a caixa de confirmação, clique em <b>Conceder Acesso</b> (Grant Access).</li>
                    </ol>
                </div>
                <button onclick="window.location.reload()" class="btn btn-primary" style="width:100%; font-size:14px; padding:12px;">
                    🔄 Recarregar Widget
                </button>
            </div>
        `;
    }

    function renderSetupView(docsTable, versTable, allTables) {
        const missingDocs = !allTables.includes(docsTable);
        const missingVers = !allTables.includes(versTable);
        const missingDocTypes = !allTables.includes('DMS_DocTypes');
        const missingSubTypes = !allTables.includes('DMS_SubTypes');
        const missingSectors = !allTables.includes('DMS_Sectors');
 
        let details = "";
        if (missingDocs) details += `<li>Tabela de Documentos (ID: <code>${docsTable}</code>)</li>`;
        if (missingVers) details += `<li>Tabela de Versões (ID: <code>${versTable}</code>)</li>`;
        if (missingDocTypes) details += `<li>Tabela de Tipos de Documento (ID: <code>DMS_DocTypes</code>)</li>`;
        if (missingSubTypes) details += `<li>Tabela de Sub-tipos de Documento (ID: <code>DMS_SubTypes</code>)</li>`;
        if (missingSectors) details += `<li>Tabela de Setores / Processos (ID: <code>DMS_Sectors</code>)</li>`;

        document.getElementById('dms-container').style.display = 'none';
        const overlay = document.getElementById('dms-welcome-overlay');
        overlay.style.display = 'block';
        overlay.innerHTML = `
            <div class="status-placeholder" style="padding:40px; max-width:600px; margin:50px auto; background:white; border-radius:12px; border:1px solid var(--border-color); box-shadow:var(--shadow-md);">
                <h2 style="font-size:22px; margin-bottom:10px; color:#e11d48;">🚀 Instalação das Tabelas DMS</h2>
                <p style="color:var(--text-muted); font-size:14px; margin-bottom:20px;">
                    As tabelas estruturais necessárias para o funcionamento do DMS não foram encontradas no documento atual:
                </p>
                <ul style="text-align:left; font-size:13px; color:#475569; margin-bottom:25px; padding-left:25px;">
                    ${details}
                </ul>
                <div style="background:#f1f5f9; padding:20px; border-radius:8px; border:1px solid #cbd5e1; margin-bottom:20px;">
                    <p style="font-size:13px; margin:0 0 15px 0;">O widget DMS pode criar as tabelas e colunas no formato ISO padrão automaticamente.</p>
                    <button id="btn-auto-setup" class="btn btn-primary" style="font-size:14px; padding:10px 20px;">
                        🚀 Criar Tabelas e Colunas Agora
                    </button>
                </div>
                <p style="font-size:11px; color:#94a3b8;">* Será necessária a sua API Key do Grist para aplicar as alterações de estrutura.</p>
            </div>
        `;

        document.getElementById('btn-auto-setup').onclick = async (e) => {
            const btn = e.target;
            btn.textContent = "⏳ Carregando Rest API...";
            btn.disabled = true;

            try {
                await GristRestApi.init(grist);
                const apiKey = await GristRestApi.requireApiKey();

                btn.textContent = "⚙️ Criando tabelas no Grist...";

                const tables = [];

                if (missingDocTypes) {
                    tables.push({
                        id: 'DMS_DocTypes',
                        columns: [
                            { id: "Code", fields: { type: "Text" } },
                            { id: "Name", fields: { type: "Text" } },
                            { id: "Description", fields: { type: "Text" } },
                            { id: "SubTypes", fields: { type: "Text" } },
                            { id: "RequireApproval", fields: { type: "Bool" } },
                            { id: "Versioned", fields: { type: "Bool" } },
                            { id: "VersionFormat", fields: { type: "Text" } },
                            { id: "VersionHasRevision", fields: { type: "Bool" } },
                            { id: "VersionInitial", fields: { type: "Text" } },
                            { id: "VersionRevisionPattern", fields: { type: "Text" } },
                            { id: "VersionAllowKeepCurrent", fields: { type: "Bool" } },
                            { id: "VersionReaderAccessPast", fields: { type: "Bool" } },
                            { id: "Expires", fields: { type: "Bool" } },
                            { id: "ExpirationValue", fields: { type: "Int" } },
                            { id: "ExpirationUnit", fields: { type: "Text" } },
                            { id: "ExpirationAllowEdit", fields: { type: "Bool" } },
                            { id: "ExpirationNotify", fields: { type: "Bool" } },
                            { id: "ExpirationNotifyDaysBefore", fields: { type: "Int" } },
                            { id: "ExpirationNotifyRecipients", fields: { type: "Text" } },
                            { id: "AssociatedFolders", fields: { type: "Text" } },
                            { id: "ControlledCopy", fields: { type: "Bool" } },
                            { id: "ControlledCopyType", fields: { type: "Text" } },
                            { id: "ControlledCopyFormat", fields: { type: "Text" } },
                            { id: "CreatedAt", fields: { type: "DateTime" } }
                        ]
                    });
                }

                if (missingSubTypes) {
                    tables.push({
                        id: 'DMS_SubTypes',
                        columns: [
                            { id: "DocType", fields: { type: "Ref:DMS_DocTypes" } },
                            { id: "Code", fields: { type: "Text" } },
                            { id: "Name", fields: { type: "Text" } },
                            { id: "InheritSettings", fields: { type: "Bool" } },
                            { id: "RequireApproval", fields: { type: "Bool" } },
                            { id: "Versioned", fields: { type: "Bool" } },
                            { id: "VersionFormat", fields: { type: "Text" } },
                            { id: "VersionHasRevision", fields: { type: "Bool" } },
                            { id: "VersionInitial", fields: { type: "Text" } },
                            { id: "VersionRevisionPattern", fields: { type: "Text" } },
                            { id: "VersionAllowKeepCurrent", fields: { type: "Bool" } },
                            { id: "VersionReaderAccessPast", fields: { type: "Bool" } },
                            { id: "Expires", fields: { type: "Bool" } },
                            { id: "ExpirationValue", fields: { type: "Int" } },
                            { id: "ExpirationUnit", fields: { type: "Text" } },
                            { id: "ExpirationAllowEdit", fields: { type: "Bool" } },
                            { id: "ExpirationNotify", fields: { type: "Bool" } },
                            { id: "ExpirationNotifyDaysBefore", fields: { type: "Int" } },
                            { id: "ExpirationNotifyRecipients", fields: { type: "Text" } },
                            { id: "ControlledCopy", fields: { type: "Bool" } },
                            { id: "ControlledCopyType", fields: { type: "Text" } },
                            { id: "ControlledCopyFormat", fields: { type: "Text" } },
                            { id: "CreatedAt", fields: { type: "DateTime" } }
                        ]
                    });
                }

                if (missingSectors) {
                    tables.push({
                        id: 'DMS_Sectors',
                        columns: [
                            { id: "Code", fields: { type: "Text" } },
                            { id: "Name", fields: { type: "Text" } }
                        ]
                    });
                }

                if (missingDocs) {
                    const requiredDocsSchema = [
                        { id: "Name", fields: { type: "Text" } },
                        { id: "Path", fields: { type: "Text" } },
                        { id: "DocType", fields: { type: "Ref:DMS_DocTypes" } },
                        { id: "Sector", fields: { type: "Ref:DMS_Sectors" } },
                        { id: "Number", fields: { type: "Numeric" } },
                        { id: "Code", fields: { type: "Text" } }
                    ];
                    tables.push({ id: docsTable, columns: requiredDocsSchema });
                }

                if (missingVers) {
                    const requiredVersSchema = [
                        { id: "DocRef", fields: { type: "Ref:DMS_Documents" } },
                        { id: "VersionMajor", fields: { type: "Numeric" } },
                        { id: "VersionMinor", fields: { type: "Numeric" } },
                        { id: "VersionString", fields: { type: "Text" } },
                        { id: "Status", fields: { type: "Text" } },
                        { id: "SourceType", fields: { type: "Text" } },
                        { id: "SourceFile", fields: { type: "Attachments" } },
                        { id: "SourceMarkdown", fields: { type: "Text" } },
                        { id: "OfficialFile", fields: { type: "Attachments" } },
                        { id: "Justification", fields: { type: "Text" } },
                        { id: "UpdatedAt", fields: { type: "DateTime" } },
                        { id: "UpdatedBy", fields: { type: "Text" } }
                    ];
                    tables.push({ id: versTable, columns: requiredVersSchema });
                }

                if (tables.length > 0) {
                    await GristRestApi.request('/tables', {
                        method: 'POST',
                        body: JSON.stringify({ tables })
                    });
                }

                // Inserir Seed Records (Dados Iniciais) para Tipos e Setores
                btn.textContent = "⏳ Inserindo dados iniciais (Tipos e Setores)...";
                try {
                    const existingTypes = await tableLens.fetchTableRecords('DMS_DocTypes');
                    if (existingTypes.length === 0) {
                        await tableLens.addRecord('DMS_DocTypes', { Code: 'PQP', Name: 'Procedimento' });
                        await tableLens.addRecord('DMS_DocTypes', { Code: 'ITP', Name: 'Instrução de Trabalho' });
                        await tableLens.addRecord('DMS_DocTypes', { Code: 'REG', Name: 'Registro' });
                    }
                } catch (errSeedTypes) {
                    console.warn("DMS: Falha ao inserir seeds em DMS_DocTypes:", errSeedTypes);
                }

                try {
                    const existingSectors = await tableLens.fetchTableRecords('DMS_Sectors');
                    if (existingSectors.length === 0) {
                        await tableLens.addRecord('DMS_Sectors', { Code: 'ADM', Name: 'Administração' });
                        await tableLens.addRecord('DMS_Sectors', { Code: 'RH', Name: 'Recursos Humanos' });
                        await tableLens.addRecord('DMS_Sectors', { Code: 'MAN', Name: 'Manutenção' });
                        await tableLens.addRecord('DMS_Sectors', { Code: 'QUA', Name: 'Qualidade' });
                    }
                } catch (errSeedSectors) {
                    console.warn("DMS: Falha ao inserir seeds em DMS_Sectors:", errSeedSectors);
                }

                // Registrar preset na Grf_config
                btn.textContent = "⚙️ Salvando configurações...";
                const configRecord = {
                    configId: currentConfigId,
                    widgetTitle: "Sistema DMS",
                    description: "[DMS] Configuração Inicial do Sistema",
                    componentType: "DMS",
                    mappingJson: JSON.stringify({
                        documentsTable: docsTable,
                        versionsTable: versTable,
                        titleField: 'Name',
                        pathField: 'Path',
                        docTypeField: 'DocType',
                        sectorField: 'Sector',
                        numberField: 'Number',
                        codeField: 'Code',
                        docRefField: 'DocRef',
                        versionMajorField: 'VersionMajor',
                        versionMinorField: 'VersionMinor',
                        versionStringField: 'VersionString',
                        statusField: 'Status',
                        sourceTypeField: 'SourceType',
                        sourceFileField: 'SourceFile',
                        sourceMarkdownField: 'SourceMarkdown',
                        officialFileField: 'OfficialFile',
                        justificationField: 'Justification',
                        updatedAtField: 'UpdatedAt',
                        updatedByField: 'UpdatedBy'
                    }),
                    stylingJson: JSON.stringify({
                        sidebarWidth: '280px',
                        theme: 'glassmorphism'
                    }),
                    actionsJson: JSON.stringify({
                        drawerConfigId: ''
                    })
                };

                // Procurar se a Grf_config possui colunas completas
                const configTableSchema = await tableLens.getTableSchema('Grf_config', { mode: 'raw' });
                // Caso a Grf_config já exista, podemos apenas gravar nela
                await tableLens.addRecord('Grf_config', configRecord);

                btn.textContent = "✅ Pronto!";
                btn.style.background = "#10b981";

                // Re-carregar dados e inicializar visualização diretamente sem refresh
                await loadDmsData();

            } catch (err) {
                alert(`Erro ao criar estrutura: ${err.message}`);
                btn.textContent = "❌ Tentar Novamente";
                btn.disabled = false;
                btn.style.background = "#ef4444";
            }
        };
        addSettingsGear();
    }

    // --- CONSTRUIR ARVORE DE PASTAS ---
    function buildFolderTree() {
        const pathField = currentConfig.mapping?.pathField || 'Path';
        
        // Coletar caminhos únicos e construir estrutura hierárquica
        const paths = new Set();
        paths.add('/');
        allDocuments.forEach(doc => {
            const rawPath = doc[pathField];
            if (rawPath) {
                const cleaned = '/' + rawPath.split('/').filter(p => p.trim() !== '').join('/');
                paths.add(cleaned);
                
                // Adicionar caminhos intermediários
                const parts = cleaned.split('/').filter(p => p.trim() !== '');
                let built = '';
                parts.forEach(part => {
                    built += '/' + part;
                    paths.add(built);
                });
            }
        });

        // Ordenar caminhos para garantir que pais sejam renderizados antes de filhos
        const sortedPaths = Array.from(paths).sort();
        
        // Construir representação em árvore em JSON
        const treeRoot = { name: 'Raiz', fullPath: '/', children: {} };
        sortedPaths.forEach(p => {
            if (p === '/') return;
            const parts = p.split('/').filter(part => part.trim() !== '');
            let current = treeRoot;
            let currentPath = '';
            parts.forEach(part => {
                currentPath += '/' + part;
                if (!current.children[part]) {
                    current.children[part] = { name: part, fullPath: currentPath, children: {} };
                }
                current = current.children[part];
            });
        });

        // Renderizar árvore na DOM
        treeViewEl.innerHTML = '';
        renderTreeNode(treeRoot, treeViewEl);
    }

    function renderTreeNode(node, container) {
        const nodeDiv = document.createElement('div');
        nodeDiv.className = 'tree-node';

        const itemDiv = document.createElement('div');
        itemDiv.className = 'tree-node-item';
        if (node.fullPath === activeFolder) {
            itemDiv.classList.add('selected');
        }
        itemDiv.dataset.path = node.fullPath;

        // Toggle Expand/Collapse se possuir filhos
        const hasChildren = Object.keys(node.children).length > 0;
        const toggleEl = document.createElement('span');
        toggleEl.className = 'tree-node-toggle';
        if (hasChildren) {
            toggleEl.classList.add('expanded');
        }
        itemDiv.appendChild(toggleEl);

        const iconEl = document.createElement('span');
        iconEl.className = 'tree-node-icon';
        iconEl.innerHTML = node.fullPath === '/' ? '🏠' : '📁';
        itemDiv.appendChild(iconEl);

        const nameSpan = document.createElement('span');
        nameSpan.textContent = node.name;
        itemDiv.appendChild(nameSpan);

        nodeDiv.appendChild(itemDiv);

        // Renderizar filhos recursivamente
        if (hasChildren) {
            const childrenContainer = document.createElement('div');
            childrenContainer.className = 'tree-node-children';
            Object.values(node.children).forEach(child => {
                renderTreeNode(child, childrenContainer);
            });
            nodeDiv.appendChild(childrenContainer);

            toggleEl.onclick = (e) => {
                e.stopPropagation();
                const isExpanded = toggleEl.classList.contains('expanded');
                if (isExpanded) {
                    toggleEl.classList.remove('expanded');
                    toggleEl.classList.add('collapsed');
                    childrenContainer.classList.add('hidden');
                } else {
                    toggleEl.classList.remove('collapsed');
                    toggleEl.classList.add('expanded');
                    childrenContainer.classList.remove('hidden');
                }
            };
        }

        // Selecionar Pasta
        itemDiv.onclick = () => {
            document.querySelectorAll('.tree-node-item').forEach(el => el.classList.remove('selected'));
            itemDiv.classList.add('selected');
            activeFolder = node.fullPath;
            if (activeViewMode !== 'docs') {
                switchToDocsView();
            } else {
                currentFolderTitle.textContent = activeFolder;
                renderDocList();
            }
        };

        container.appendChild(nodeDiv);
    }

    // --- RENDERIZAR GRID DE DOCUMENTOS ---
    function renderDocList() {
        const pathField = currentConfig.mapping?.pathField || 'Path';
        const titleField = currentConfig.mapping?.titleField || 'Name';
        const codeField = currentConfig.mapping?.codeField || 'Code';

        // Filtrar documentos pertencentes à pasta selecionada
        const filteredDocs = allDocuments.filter(doc => {
            const docPath = doc[pathField] || '/';
            const cleanedDocPath = '/' + docPath.split('/').filter(p => p.trim() !== '').join('/');
            return cleanedDocPath === activeFolder;
        });

        docCountBadge.textContent = `${filteredDocs.length} documentos`;

        if (filteredDocs.length === 0) {
            docListEl.innerHTML = `<tr><td colspan="6" class="status-placeholder">Nenhum documento encontrado nesta pasta.</td></tr>`;
            return;
        }

        docListEl.innerHTML = '';
        filteredDocs.forEach(doc => {
            const tr = document.createElement('tr');
            if (selectedDoc && selectedDoc.id === doc.id) {
                tr.classList.add('selected');
            }

            // Buscar Versão Ativa ("Vigente")
            const activeVer = allVersions.find(v => v[currentConfig.mapping?.docRefField || 'DocRef'] === doc.id && v[currentConfig.mapping?.statusField || 'Status'] === 'Vigente');
            const versionString = activeVer ? activeVer[currentConfig.mapping?.versionStringField || 'VersionString'] : '(s/ versão)';
            const statusLabel = activeVer ? activeVer[currentConfig.mapping?.statusField || 'Status'] : 'Inativo';
            const statusClass = activeVer ? getStatusClass(activeVer[currentConfig.mapping?.statusField || 'Status']) : 'badge-obsolete';
            const dateStr = activeVer ? formatDate(activeVer[currentConfig.mapping?.updatedAtField || 'UpdatedAt']) : '-';

            tr.innerHTML = `
                <td><b>${doc[codeField] || 'N/A'}</b></td>
                <td>${doc[titleField] || 'Sem Título'}</td>
                <td>${versionString}</td>
                <td><span class="badge ${statusClass}">${statusLabel}</span></td>
                <td>${dateStr}</td>
                <td class="actions-col">
                    <button class="btn btn-outline-primary btn-sm btn-view-doc" data-id="${doc.id}">Visualizar</button>
                    <button class="btn btn-secondary btn-sm btn-edit-meta" data-id="${doc.id}">Editar</button>
                </td>
            `;

            // Clique na linha ou no botão de visualizar
            tr.onclick = (e) => {
                if (e.target.classList.contains('btn-edit-meta')) return;
                document.querySelectorAll('#dms-doc-list tr').forEach(row => row.classList.remove('selected'));
                tr.classList.add('selected');
                selectedDoc = doc;
                loadPreview(doc);
            };

            // Editar Metadados
            tr.querySelector('.btn-edit-meta').onclick = (e) => {
                e.stopPropagation();
                const drawerConfigId = currentConfig.actions?.drawerConfigId || '';
                openDrawer(currentConfig.mapping?.documentsTable || 'DMS_Documents', doc.id, {
                    tableLens,
                    mode: 'edit',
                    configId: drawerConfigId
                });
            };

            docListEl.appendChild(tr);
        });
    }

    function getStatusClass(status) {
        if (status === 'Vigente') return 'badge-active';
        if (status === 'Em Elaboração') return 'badge-draft';
        return 'badge-obsolete';
    }

    function formatDate(dateVal) {
        if (!dateVal) return '';
        try {
            const date = new Date(dateVal);
            return date.toLocaleDateString('pt-BR');
        } catch (e) {
            return String(dateVal);
        }
    }

    // --- CARREGAR PREVIEW DE DOCUMENTO E HISTÓRICO ---
    async function loadPreview(doc) {
        previewPanel.classList.remove('collapsed');
        previewDocTitle.textContent = `${doc[currentConfig.mapping?.codeField || 'Code']} - ${doc[currentConfig.mapping?.titleField || 'Name']}`;
        
        // Filtrar versões pertencentes a este documento
        const docRefCol = currentConfig.mapping?.docRefField || 'DocRef';
        currentDocVersions = allVersions
            .filter(v => v[docRefCol] === doc.id)
            .sort((a, b) => {
                // Ordenar versões descrescente (mais recente primeiro)
                const majorA = parseFloat(a[currentConfig.mapping?.versionMajorField || 'VersionMajor']) || 0;
                const minorA = parseFloat(a[currentConfig.mapping?.versionMinorField || 'VersionMinor']) || 0;
                const majorB = parseFloat(b[currentConfig.mapping?.versionMajorField || 'VersionMajor']) || 0;
                const minorB = parseFloat(b[currentConfig.mapping?.versionMinorField || 'VersionMinor']) || 0;
                
                if (majorB !== majorA) return majorB - majorA;
                return minorB - minorA;
            });

        // Alternar para aba padrão (Oficial)
        const activeTab = document.querySelector('.preview-tab-btn.active').dataset.tab;
        if (activeTab === 'view') {
            await renderOfficialViewer();
        } else {
            renderVersionHistory();
        }
    }

    async function renderOfficialViewer() {
        viewerPlaceholder.style.display = 'none';
        pdfViewerContainer.style.display = 'none';
        mdViewerContainer.style.display = 'none';
        pdfIframe.src = '';
        mdViewerContainer.innerHTML = '';

        // Obter versão Vigente
        const statusCol = currentConfig.mapping?.statusField || 'Status';
        const activeVer = currentDocVersions.find(v => v[statusCol] === 'Vigente');
        
        if (!activeVer) {
            viewerPlaceholder.style.display = 'block';
            viewerPlaceholder.innerHTML = `
                <div class="status-placeholder">
                    ⚠️ Sem versão aprovada/vigente ativa.<br>
                    Crie uma versão na aba de Histórico.
                </div>
            `;
            return;
        }

        const sourceTypeCol = currentConfig.mapping?.sourceTypeField || 'SourceType';
        const mdCol = currentConfig.mapping?.sourceMarkdownField || 'SourceMarkdown';
        const fileCol = currentConfig.mapping?.sourceFileField || 'SourceFile';
        const officialCol = currentConfig.mapping?.officialFileField || 'OfficialFile';

        const isMarkdown = activeVer[sourceTypeCol] === 'Markdown';
        const hasPdf = !!activeVer[officialCol];

        if (hasPdf) {
            // Renderizar PDF Oficial
            pdfViewerContainer.style.display = 'block';
            viewerPlaceholder.style.display = 'block';
            viewerPlaceholder.textContent = 'Carregando documento PDF...';
            
            try {
                const downloadUrl = await getAttachmentUrl(activeVer[officialCol]);
                pdfIframe.src = downloadUrl;
                pdfIframe.onload = () => {
                    viewerPlaceholder.style.display = 'none';
                };
            } catch (err) {
                viewerPlaceholder.style.display = 'block';
                viewerPlaceholder.innerHTML = `<span style="color:red">Erro ao abrir arquivo PDF: ${err.message}</span>`;
            }
        } else if (isMarkdown) {
            // Renderizar Markdown
            mdViewerContainer.style.display = 'block';
            const rawMd = activeVer[mdCol] || '# Sem Conteúdo\nO documento está em branco.';
            mdViewerContainer.innerHTML = mdConverter.makeHtml(rawMd);
        } else {
            // Sem PDF nem Markdown (apenas arquivo fonte editable)
            viewerPlaceholder.style.display = 'block';
            viewerPlaceholder.innerHTML = `
                <div class="status-placeholder">
                    📎 Documento possui arquivo de origem carregado, mas sem PDF Oficial Vigente anexado.<br>
                    <button class="btn btn-secondary btn-sm" id="btn-preview-dl-source" style="margin-top:10px;">Download do Arquivo Fonte</button>
                </div>
            `;
            const dlBtn = document.getElementById('btn-preview-dl-source');
            if (dlBtn) {
                dlBtn.onclick = async () => {
                    const dlUrl = await getAttachmentUrl(activeVer[fileCol]);
                    window.open(dlUrl, '_blank');
                };
            }
        }
    }

    // Obter URL do Anexo no Grist
    async function getAttachmentUrl(cellValue) {
        const attachmentId = Array.isArray(cellValue) ? cellValue[1] : cellValue;
        if (!attachmentId) throw new Error("Anexo inválido ou ausente.");

        const token = await tableLens.getAccessToken();
        const baseUrl = await tableLens.getBaseUrl();
        if (!token || !baseUrl) throw new Error("Não foi possível autenticar acesso aos anexos.");

        return `${baseUrl}/attachments/${attachmentId}/download?auth=${token}`;
    }

    // --- RENDERIZAR HISTÓRICO DE VERSÕES ---
    function renderVersionHistory() {
        versionHistoryList.innerHTML = '';
        
        if (currentDocVersions.length === 0) {
            versionHistoryList.innerHTML = '<div class="loading-placeholder">Nenhuma versão cadastrada para este documento.</div>';
            return;
        }

        currentDocVersions.forEach(ver => {
            const li = document.createElement('li');
            li.className = 'version-item';

            const statusClass = getStatusClass(ver[currentConfig.mapping?.statusField || 'Status']);
            const updateDate = formatDate(ver[currentConfig.mapping?.updatedAtField || 'UpdatedAt']);
            const updateUser = ver[currentConfig.mapping?.updatedByField || 'UpdatedBy'] || 'Desconhecido';
            const isDraft = ver[currentConfig.mapping?.statusField || 'Status'] === 'Em Elaboração';
            const verString = ver[currentConfig.mapping?.versionStringField || 'VersionString'] || '0.0';

            li.innerHTML = `
                <div class="version-item-header">
                    <span class="version-tag">Versão ${verString}</span>
                    <span class="badge ${statusClass}">${ver[currentConfig.mapping?.statusField || 'Status']}</span>
                </div>
                <div class="version-meta">
                    Atualizado em <b>${updateDate}</b> por <b>${updateUser}</b>
                </div>
                <p class="version-justification">
                    <b>Motivo da Alteração:</b><br>${ver[currentConfig.mapping?.justificationField || 'Justification'] || 'Sem justificativa.'}
                </p>
                <div class="version-actions" id="ver-actions-${ver.id}">
                    <!-- Ações de Download / Edição de acordo com o tipo -->
                </div>
            `;

            const actionsDiv = li.querySelector(`#ver-actions-${ver.id}`);

            // Download Fonte
            if (ver[currentConfig.mapping?.sourceFileField || 'SourceFile']) {
                const btnDlSource = document.createElement('button');
                btnDlSource.className = 'btn btn-secondary btn-sm';
                btnDlSource.textContent = '📥 Baixar Fonte';
                btnDlSource.onclick = async () => {
                    const url = await getAttachmentUrl(ver[currentConfig.mapping?.sourceFileField || 'SourceFile']);
                    window.open(url, '_blank');
                };
                actionsDiv.appendChild(btnDlSource);
            }

            // Download PDF Oficial
            if (ver[currentConfig.mapping?.officialFileField || 'OfficialFile']) {
                const btnDlPdf = document.createElement('button');
                btnDlPdf.className = 'btn btn-secondary btn-sm';
                btnDlPdf.textContent = '📄 PDF Oficial';
                btnDlPdf.onclick = async () => {
                    const url = await getAttachmentUrl(ver[currentConfig.mapping?.officialFileField || 'OfficialFile']);
                    window.open(url, '_blank');
                };
                actionsDiv.appendChild(btnDlPdf);
            }

            // Ações de Edição exclusivas para Rascunho (Em Elaboração)
            if (isDraft) {
                // Upload/Upload de arquivos na Gaveta
                const btnUpload = document.createElement('button');
                btnUpload.className = 'btn btn-primary btn-sm';
                btnUpload.textContent = '⚙️ Anexar Arquivos (Gaveta)';
                btnUpload.onclick = () => {
                    openDrawer(currentConfig.mapping?.versionsTable || 'DMS_Versions', ver.id, {
                        tableLens,
                        mode: 'edit'
                    });
                };
                actionsDiv.appendChild(btnUpload);

                // Editor de Markdown se for Markdown
                if (ver[currentConfig.mapping?.sourceTypeField || 'SourceType'] === 'Markdown') {
                    const btnEditMd = document.createElement('button');
                    btnEditMd.className = 'btn btn-primary btn-sm';
                    btnEditMd.textContent = '📝 Editar Markdown';
                    btnEditMd.onclick = () => {
                        openMarkdownEditor(ver);
                    };
                    actionsDiv.appendChild(btnEditMd);
                }

                // Publicar Versão / Set Vigente
                const btnRelease = document.createElement('button');
                btnRelease.className = 'btn btn-success btn-sm';
                btnRelease.textContent = '🚀 Aprovar e Vigiar (Publicar)';
                btnRelease.onclick = () => handleReleaseVersion(ver);
                actionsDiv.appendChild(btnRelease);
            }

            versionHistoryList.appendChild(li);
        });
    }

    // --- EDITOR DE MARKDOWN INTERNO ---
    function openMarkdownEditor(versionRecord) {
        const mdField = currentConfig.mapping?.sourceMarkdownField || 'SourceMarkdown';
        const currentContent = versionRecord[mdField] || '';

        const modalDiv = document.createElement('div');
        modalDiv.className = 'dms-modal';
        modalDiv.innerHTML = `
            <div class="dms-modal-content" style="width: 800px; height: 90vh;">
                <div class="dms-modal-header">
                    <h3>Editor de Markdown - Versão ${versionRecord[currentConfig.mapping?.versionStringField || 'VersionString']}</h3>
                    <span class="dms-modal-close" id="btn-md-editor-close">&times;</span>
                </div>
                <div class="dms-modal-body" style="display: flex; flex: 1; padding: 10px; overflow: hidden; gap: 10px;">
                    <div style="flex: 1; display: flex; flex-direction: column;">
                        <label style="font-weight:bold; font-size:12px; margin-bottom:5px;">CÓDIGO MARKDOWN</label>
                        <textarea id="md-editor-textarea" style="flex: 1; width: 100%; border: 1px solid var(--border-color); border-radius: 6px; padding: 10px; font-family: monospace; resize: none;">${currentContent}</textarea>
                    </div>
                    <div style="flex: 1; display: flex; flex-direction: column; overflow: hidden;">
                        <label style="font-weight:bold; font-size:12px; margin-bottom:5px;">LIVE PREVIEW</label>
                        <div id="md-editor-preview" style="flex: 1; border: 1px solid var(--border-color); border-radius: 6px; padding: 10px; overflow-y: auto; background: #fafafa;" class="markdown-body"></div>
                    </div>
                </div>
                <div class="form-actions" style="margin: 0; padding: 15px 20px; background: #f8fafc;">
                    <button type="button" class="btn btn-secondary" id="btn-md-editor-cancel">Cancelar</button>
                    <button type="button" class="btn btn-success" id="btn-md-editor-save">💾 Salvar Alterações</button>
                </div>
            </div>
        `;
        document.body.appendChild(modalDiv);

        const textarea = modalDiv.querySelector('#md-editor-textarea');
        const preview = modalDiv.querySelector('#md-editor-preview');
        
        // Live preview updates
        const updatePreview = () => {
            preview.innerHTML = mdConverter.makeHtml(textarea.value);
        };
        textarea.oninput = updatePreview;
        updatePreview(); // Initial render

        modalDiv.querySelector('#btn-md-editor-close').onclick = 
        modalDiv.querySelector('#btn-md-editor-cancel').onclick = () => {
            modalDiv.remove();
        };

        modalDiv.querySelector('#btn-md-editor-save').onclick = async () => {
            const btnSave = modalDiv.querySelector('#btn-md-editor-save');
            btnSave.disabled = true;
            btnSave.textContent = 'Salvando...';
            try {
                const changes = { [mdField]: textarea.value };
                await tableLens.updateRecord(currentConfig.mapping?.versionsTable || 'DMS_Versions', versionRecord.id, changes);
                modalDiv.remove();
                await loadDmsData();
            } catch (err) {
                alert("Erro ao salvar alterações: " + err.message);
                btnSave.disabled = false;
                btnSave.textContent = '💾 Salvar Alterações';
            }
        };
    }

    // --- DIALOGO NOVO DOCUMENTO ---
    async function handleNewDocSubmit(e) {
        e.preventDefault();
        const submitBtn = formNewDoc.querySelector('button[type="submit"]');
        submitBtn.disabled = true;
        submitBtn.textContent = "Criando...";

        const title = document.getElementById('new-doc-title').value;
        const path = document.getElementById('new-doc-path').value;
        const typeSelect = document.getElementById('new-doc-type');
        const subtypeSelect = document.getElementById('new-doc-subtype');
        const sectorSelect = document.getElementById('new-doc-sector');

        const selectedTypeId = parseInt(typeSelect.value);
        const selectedSubtypeId = parseInt(subtypeSelect.value);
        const selectedSectorId = parseInt(sectorSelect.value);

        if (!selectedTypeId || !selectedSubtypeId || !selectedSectorId) {
            alert("Por favor, selecione o Tipo, Sub-tipo e o Setor do documento.");
            submitBtn.disabled = false;
            submitBtn.textContent = "Criar Documento";
            return;
        }

        const typeCode = typeSelect.options[typeSelect.selectedIndex].dataset.code;
        const subtypeCode = subtypeSelect.options[subtypeSelect.selectedIndex].dataset.code;
        const sectorCode = sectorSelect.options[sectorSelect.selectedIndex].dataset.code;

        try {
            // 1. Calcular próximo número sequencial para esta combinação de Tipo e Sub-tipo
            const typeCol = currentConfig.mapping?.docTypeField || 'DocType';
            const subtypeCol = 'SubType';
            const sectorCol = currentConfig.mapping?.sectorField || 'Sector';
            const numCol = currentConfig.mapping?.numberField || 'Number';

            const filteredDocs = allDocuments.filter(d => {
                const docTypeVal = Array.isArray(d[typeCol]) ? d[typeCol][1] : d[typeCol];
                const docSubtypeVal = Array.isArray(d[subtypeCol]) ? d[subtypeCol][1] : d[subtypeCol];
                return Number(docTypeVal) === selectedTypeId && Number(docSubtypeVal) === selectedSubtypeId;
            });
            
            let nextNum = 1;
            if (filteredDocs.length > 0) {
                const numbers = filteredDocs.map(d => parseInt(d[numCol]) || 0);
                nextNum = Math.max(...numbers) + 1;
            }

            // Código sequencial padronizado: [Tipo]-[Subtipo]-[Sequencial]
            const paddedNum = String(nextNum).padStart(4, '0');
            const code = `${typeCode}-${subtypeCode}-${paddedNum}`;

            // 2. Criar registro do Documento (Parent)
            const docsTable = currentConfig.mapping?.documentsTable || 'DMS_Documents';
            const newDoc = {
                [currentConfig.mapping?.titleField || 'Name']: title,
                [currentConfig.mapping?.pathField || 'Path']: path,
                [typeCol]: selectedTypeId,
                [subtypeCol]: selectedSubtypeId,
                [sectorCol]: selectedSectorId,
                [numCol]: nextNum,
                [currentConfig.mapping?.codeField || 'Code']: code
            };

            const response = await tableLens.addRecord(docsTable, newDoc);
            
            // Grist addRecord retorna o ID do novo registro ou o registro completo
            const newDocId = response.id || response;

            // 3. Criar Versão Inicial 1.0 em Elaboração
            const versTable = currentConfig.mapping?.versionsTable || 'DMS_Versions';
            const firstVersion = {
                [currentConfig.mapping?.docRefField || 'DocRef']: newDocId,
                [currentConfig.mapping?.versionMajorField || 'VersionMajor']: 1,
                [currentConfig.mapping?.versionMinorField || 'VersionMinor']: 0,
                [currentConfig.mapping?.versionStringField || 'VersionString']: '1.0',
                [currentConfig.mapping?.statusField || 'Status']: 'Em Elaboração',
                [currentConfig.mapping?.sourceTypeField || 'SourceType']: 'Markdown',
                [currentConfig.mapping?.sourceMarkdownField || 'SourceMarkdown']: `# ${title}\n\nEscreva a instrução ou procedimento aqui.`,
                [currentConfig.mapping?.justificationField || 'Justification']: 'Elaboração Inicial do Documento',
                [currentConfig.mapping?.updatedAtField || 'UpdatedAt']: new Date().toISOString()
            };

            await tableLens.addRecord(versTable, firstVersion);

            modalNewDoc.style.display = 'none';
            formNewDoc.reset();
            
            await loadDmsData();
            
            // Auto selecionar o documento criado
            const createdDoc = allDocuments.find(d => d[currentConfig.mapping?.codeField || 'Code'] === code);
            if (createdDoc) {
                selectedDoc = createdDoc;
                loadPreview(createdDoc);
            }

        } catch (err) {
            alert("Erro ao criar documento: " + err.message);
        } finally {
            submitBtn.disabled = false;
            submitBtn.textContent = "Criar Documento";
        }
    }

    // --- DIALOGO NOVA VERSÃO (FLOW) ---
    btnCreateVersion.onclick = () => {
        if (!selectedDoc) return;
        
        // Verificar se já possui algum rascunho em Elaboração
        const statusCol = currentConfig.mapping?.statusField || 'Status';
        const hasDraft = currentDocVersions.some(v => v[statusCol] === 'Em Elaboração');
        
        if (hasDraft) {
            alert("⚠️ Já existe uma versão em fase de 'Em Elaboração' para este documento. Conclua ou exclua o rascunho existente antes de criar um novo.");
            return;
        }

        formVersionFlow.reset();
        modalVersionFlow.style.display = 'flex';
    };

    async function handleVersionFlowSubmit(e) {
        e.preventDefault();
        const submitBtn = formVersionFlow.querySelector('button[type="submit"]');
        submitBtn.disabled = true;
        submitBtn.textContent = "Criando...";

        const incType = formVersionFlow.querySelector('input[name="ver-increment-type"]:checked').value;
        const sourceType = verSourceTypeSelect.value;
        const justification = document.getElementById('ver-justification').value;

        try {
            // Obter versão ativa atual ou a mais recente
            const statusCol = currentConfig.mapping?.statusField || 'Status';
            const majorCol = currentConfig.mapping?.versionMajorField || 'VersionMajor';
            const minorCol = currentConfig.mapping?.versionMinorField || 'VersionMinor';
            
            // O mais recente está no topo devido a ordenação descrescente
            const latestVer = currentDocVersions[0];
            
            let newMajor = 1;
            let newMinor = 0;

            if (latestVer) {
                const currentMajor = parseInt(latestVer[majorCol]) || 1;
                const currentMinor = parseInt(latestVer[minorCol]) || 0;

                if (incType === 'minor') {
                    newMajor = currentMajor;
                    newMinor = currentMinor + 1;
                } else {
                    newMajor = currentMajor + 1;
                    newMinor = 0;
                }
            }

            const verString = `${newMajor}.${newMinor}`;

            // Copiar dados da versão anterior se for markdown
            let prevMdContent = '';
            if (latestVer && latestVer[currentConfig.mapping?.sourceMarkdownField || 'SourceMarkdown']) {
                prevMdContent = latestVer[currentConfig.mapping?.sourceMarkdownField || 'SourceMarkdown'];
            } else {
                prevMdContent = `# ${selectedDoc[currentConfig.mapping?.titleField || 'Name']}\n\n`;
            }

            const versTable = currentConfig.mapping?.versionsTable || 'DMS_Versions';
            const newVersion = {
                [currentConfig.mapping?.docRefField || 'DocRef']: selectedDoc.id,
                [majorCol]: newMajor,
                [minorCol]: newMinor,
                [currentConfig.mapping?.versionStringField || 'VersionString']: verString,
                [statusCol]: 'Em Elaboração',
                [currentConfig.mapping?.sourceTypeField || 'SourceType']: sourceType,
                [currentConfig.mapping?.sourceMarkdownField || 'SourceMarkdown']: sourceType === 'Markdown' ? prevMdContent : null,
                [currentConfig.mapping?.justificationField || 'Justification']: justification,
                [currentConfig.mapping?.updatedAtField || 'UpdatedAt']: new Date().toISOString()
            };

            await tableLens.addRecord(versTable, newVersion);

            modalVersionFlow.style.display = 'none';
            await loadDmsData();
            
            // Abrir aba de histórico e exibir nova versão
            document.querySelector('.preview-tab-btn[data-tab="history"]').click();

        } catch (err) {
            alert("Erro ao criar nova versão: " + err.message);
        } finally {
            submitBtn.disabled = false;
            submitBtn.textContent = "Iniciar Elaboração";
        }
    }

    // --- LIBERAR / APROVAR VERSÃO ---
    async function handleReleaseVersion(versionRecord) {
        // Verificar se anexou o arquivo PDF oficial
        const officialCol = currentConfig.mapping?.officialFileField || 'OfficialFile';
        const hasPdf = !!versionRecord[officialCol];

        if (!hasPdf) {
            const confirmRelease = confirm("⚠️ Atenção: Não foi anexado nenhum arquivo oficial PDF para leitura de operação. Deseja publicar este documento mesmo assim?\n\n(Recomendado: Anexar PDF via Gaveta antes de liberar para atender à conformidade ISO)");
            if (!confirmRelease) return;
        }

        const confirmPublish = confirm(`Deseja aprovar e publicar oficialmente a versão ${versionRecord[currentConfig.mapping?.versionStringField || 'VersionString']}?\n\nEsta versão se tornará VIGENTE e as versões anteriores serão marcadas como OBSOLETAS.`);
        if (!confirmPublish) return;

        try {
            const versTable = currentConfig.mapping?.versionsTable || 'DMS_Versions';
            const statusCol = currentConfig.mapping?.statusField || 'Status';

            // 1. Atualizar a nova versão para "Vigente"
            await tableLens.updateRecord(versTable, versionRecord.id, {
                [statusCol]: 'Vigente',
                [currentConfig.mapping?.updatedAtField || 'UpdatedAt']: new Date().toISOString()
            });

            // 2. Marcar as outras versões deste documento como "Obsoleto"
            const otherVersions = currentDocVersions.filter(v => v.id !== versionRecord.id && v[statusCol] === 'Vigente');
            for (const other of otherVersions) {
                await tableLens.updateRecord(versTable, other.id, {
                    [statusCol]: 'Obsoleto'
                });
            }

            // 3. Atualizar a string de versão no documento principal (Parent)
            const verString = versionRecord[currentConfig.mapping?.versionStringField || 'VersionString'];
            const docsTable = currentConfig.mapping?.documentsTable || 'DMS_Documents';
            
            // Grist às vezes não possui uma coluna para armazenar a versão corrente, mas se tiver, atualizamos.
            // Para garantir conformidade com colunas flexíveis, tentamos ver se o schema do parent possui coluna "VersionString" ou similar,
            // senão ignoramos
            const parentSchema = await tableLens.getTableSchema(docsTable);
            const parentVerCol = Object.keys(parentSchema).find(k => k.toLowerCase() === 'currentversion' || k.toLowerCase() === 'version');
            if (parentVerCol) {
                await tableLens.updateRecord(docsTable, selectedDoc.id, {
                    [parentVerCol]: verString
                });
            }

            alert("🎉 Versão publicada com sucesso!");
            await loadDmsData();
            
            // Voltar para aba de visualização
            document.querySelector('.preview-tab-btn[data-tab="view"]').click();

        } catch (err) {
            alert("Erro ao publicar versão: " + err.message);
        }
    }

    // --- COORDENAÇÃO DE PRESET GEAR DE CONFIGS ---
    function addSettingsGear() {
        if (document.getElementById('settings-gear-btn')) return;
        const gearBtn = document.createElement('div');
        gearBtn.id = 'settings-gear-btn';
        gearBtn.innerHTML = '<svg class="icon" style="width:20px; height:20px;"><use href="#icon-settings"></use></svg>';
        gearBtn.onclick = openSettingsPopover;
        document.body.appendChild(gearBtn);
    }

    async function openSettingsPopover(event) {
        if (event && typeof event.stopPropagation === 'function') {
            event.stopPropagation();
        }
        await GristLauncherUtils.renderSettingsPopover({
            grist: window.grist,
            tableLens,
            currentConfigId,
            currentConfig,
            onLink: async (newId) => {
                await grist.setOptions({ configId: newId || null });
                currentConfigId = newId || null;
                await loadDmsData();
            },
            onOpenManager: () => {
                openConfigManager(grist, { initialConfigId: currentConfigId });
            }
        });
    }

    // Iniciar carregamento
    await loadDmsData();
});
