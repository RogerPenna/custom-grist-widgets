// libraries/grist-bsc-renderer/BSCRenderer.js
import { CardSystem } from '../grist-card-system/CardSystem.js';
import { RelationshipLines } from '../grist-relationship-lines/RelationshipLines.js';

export const BSCRenderer = (() => {

    async function fetchFullBscStructure(modelId, lens, tableNames = {}) {
        const modelsTable = tableNames.modelsTable || 'Modelos';
        const perspectivesTable = tableNames.perspectivesTable || 'Perspectivas';
        const objectivesTable = tableNames.objectivesTable || 'Objetivos';

        // Tenta buscar as tabelas de forma segura
        const [modelRecord, allPerspectives, allObjectives] = await Promise.all([
            lens.findRecord(modelsTable, { id: modelId }),
            lens.fetchTableRecordsOrThrow(perspectivesTable),
            lens.fetchTableRecordsOrThrow(objectivesTable),
        ]);

        if (!modelRecord) throw new Error(`Modelo ID ${modelId} não encontrado na tabela "${modelsTable}".`);
        if (!allPerspectives || allPerspectives.length === 0) console.warn(`Nenhuma perspectiva encontrada na tabela "${perspectivesTable}".`);

        // Descoberta automática de campos de relação se não fornecidos
        const refModelCol = tableNames.refModelCol || await lens.findRelationField(perspectivesTable, modelsTable) || 'ref_model';
        const refPerspCol = tableNames.refPerspCol || await lens.findRelationField(objectivesTable, perspectivesTable) || 'ref_persp';
        const relationshipField = tableNames.relationshipField || 'ref_obj';
        
        console.log(`[BSC Renderer] Usando relações: Persp->Model: ${refModelCol}, Obj->Persp: ${refPerspCol}, Dependências: ${relationshipField}`);

        const perspectivesForModel = allPerspectives
            .filter(p => p[refModelCol] === modelId)
            .sort((a, b) => (a.Ordem || a.id) - (b.Ordem || b.id))
            .map(p => {
                const objectives = allObjectives.filter(o => o[refPerspCol] === p.id);
                return {
                    ...p,
                    objectives: objectives.map(o => {
                        let relVal = o[relationshipField];
                        // Normalize RefList: ['L', id1, id2] -> [id1, id2]
                        let targetIds = [];
                        if (Array.isArray(relVal)) {
                            targetIds = relVal[0] === 'L' ? relVal.slice(1) : relVal;
                        } else if (relVal && typeof relVal === 'number') {
                            targetIds = [relVal];
                        }
                        
                        return {
                            ...o,
                            ref_objs: targetIds // Use plural to indicate multiple targets
                        };
                    })
                };
            });
        return { ...modelRecord, perspectives: perspectivesForModel, mapping: { ...tableNames, refModelCol, refPerspCol, relationshipField } };
    }

    function patchConfigForBSC(config, schema) {
        if (!config || !config.styling) return config;
        if (config.styling.cardsColorMode === 'conditional' && schema['corfundocard']) {
            const newConfig = JSON.parse(JSON.stringify(config));
            newConfig.styling.cardsColorMode = 'text-value';
            newConfig.styling.cardsColorTextField = 'corfundocard';
            if (schema['corfontecard']) {
                newConfig.styling.cardsColorFontField = 'corfontecard';
                newConfig.styling.cardsColorApplyText = true;
            }
            return newConfig;
        }
        return config;
    }

    async function renderBsc(options) {
        const { container, bscData, config, tableLens, onCardClick, onAddRecord, showRelationships } = options;
        container.innerHTML = "";

        const actions = config.actions || config || {};
        const mapping = config.mapping || config || {};
        
        const perspectivesTable = mapping.perspectivesTable || 'Perspectivas';
        const objectivesTable = mapping.objectivesTable || 'Objetivos';

        // Lógica Dinâmica de Seleção de Card
        const typeField = mapping.typeField || 'TipoModelo';
        const typeValue = bscData[typeField];
        const typeConfigMap = mapping.typeConfigMap || {};
        
        let targetConfigId = typeConfigMap[typeValue] || mapping.defaultCardConfigId || mapping.perspectivesConfigId;

        console.log(`[BSC Renderer] Tipo detectado: ${typeValue} (Campo: ${typeField}). Card ID: ${targetConfigId}`);

        if (targetConfigId) {
            try {
                let cardConfig = await tableLens.fetchConfig(targetConfigId);
                if (cardConfig) {
                    const perspectiveSchema = await tableLens.getTableSchema(perspectivesTable);
                    cardConfig = patchConfigForBSC(cardConfig, perspectiveSchema);
                    
                    const cardsContainer = document.createElement('div');
                    cardsContainer.className = 'bsc-perspectives-grid';
                    
                    // --- HELPER: BOTÃO ADICIONAR (ESTILO DISCRETO +) ---
                    const createAddBtn = (position) => {
                        const btn = document.createElement('button');
                        // Usa as classes pos-static-top/bottom da biblioteca para garantir que rolem com o conteúdo
                        btn.className = `grf-global-add-btn pos-static-${position}`;
                        btn.title = "Adicionar Perspectiva";
                        btn.innerHTML = `<svg viewBox="0 0 24 24"><path d="M12 5V19M5 12H19" stroke="currentColor"/></svg>`;
                        btn.onclick = async (e) => {
                            e.stopPropagation();
                            const refModelCol = mapping.refModelCol || await tableLens.findRelationField(perspectivesTable, 'Modelos') || 'ref_model';
                            let addConfig = {};
                            if (actions.addPerspectiveConfigId || cardConfig.addRecordConfigId) {
                                addConfig = await tableLens.fetchConfig(actions.addPerspectiveConfigId || cardConfig.addRecordConfigId);
                            }
                            window.GristDrawer.open(perspectivesTable, 'new', { 
                                ...(addConfig || {}),
                                tableLens: tableLens,
                                initialData: { [refModelCol]: bscData.id }
                            });
                        };
                        return btn;
                    };

                    // --- BOTÃO ADICIONAR PERSPECTIVA (TOP) ---
                    const showAddPersp = actions.showAddPerspective || cardConfig.showAddButtonTop;
                    if (showAddPersp) {
                        container.appendChild(createAddBtn('top'));
                    }

                    // Pass overrides if needed
                    const fieldConfigOverrides = {};
                    if (actions.showAddObjective !== undefined) {
                        // Tenta encontrar a coluna RefList na Perspectiva que aponta para Objetivos
                        const relField = Object.values(perspectiveSchema).find(c => 
                            c.type === `RefList:${objectivesTable}` || c.type === `Ref:${objectivesTable}`
                        );
                        
                        if (relField) {
                            console.log(`[BSC Renderer] Aplicando override showAddButton na coluna: ${relField.colId}`);
                            fieldConfigOverrides[relField.colId] = {
                                showAddButton: actions.showAddObjective,
                                addRecordConfigId: actions.addObjectiveConfigId
                            };
                        }
                    }

                    await CardSystem.renderCards(cardsContainer, bscData.perspectives, { 
                        ...cardConfig, 
                        tableLens,
                        tableId: perspectivesTable,
                        fieldConfig: { ...(cardConfig.fieldConfig || {}), ...fieldConfigOverrides }
                    }, perspectiveSchema);
                    
                    container.appendChild(cardsContainer);

                    // --- BOTÃO ADICIONAR PERSPECTIVA (BOTTOM) ---
                    if (cardConfig.showAddButtonBottom) {
                        container.appendChild(createAddBtn('bottom'));
                    }
                    if (showRelationships) {
                        const styling = config.styling || {};
                        const receivedConfigs = config.receivedConfigs || []; // Ensure we have configs
                        
                        let arrowColor = styling.arrowColor;
                        let arrowOutlineColor = styling.arrowOutlineColor;

                        // Resolve colors from palettes if IDs exist
                        if (styling.arrowColorPaletteId && receivedConfigs.length > 0) {
                            const palette = receivedConfigs.find(c => c.configId === styling.arrowColorPaletteId);
                            if (palette) {
                                try {
                                    const data = JSON.parse(palette.stylingJson || palette.configJson || '{}');
                                    // If we are linked to a palette, we should probably use the color that matches the saved hex 
                                    // OR if we want it to be truly dynamic, we'd need a way to know WHICH color of the palette was chosen (index/id).
                                    // Since we only save the hex, we use it. If the palette color changed, the user might need to re-select it 
                                    // UNLESS we implement index-based linking. For now, let's just make sure we HAVE a color.
                                } catch(e) {}
                            }
                        }

                        if (styling.arrowOutlineColorPaletteId && receivedConfigs.length > 0) {
                            const palette = receivedConfigs.find(c => c.configId === styling.arrowOutlineColorPaletteId);
                            // ... same logic
                        }

                        const arrowOptions = {
                            color: arrowColor,
                            size: styling.arrowThickness,
                            outline: styling.showArrowOutline,
                            outlineColor: arrowOutlineColor,
                            outlineSize: styling.arrowOutlineThickness
                        };
                        RelationshipLines.drawFromBscData(bscData, arrowOptions);
                    }
                    return;
                }
            } catch (e) {
                console.error("BSC Renderer Error:", e);
                container.innerHTML = `<p style="color:red">Error: ${e.message}</p>`;
            }
        } else {
            container.innerHTML = `<p class="setup-placeholder">Nenhuma configuração de visualização (Card Config) selecionada para este modelo.</p>`;
        }
    }

    return { renderBsc, fetchFullBscStructure };

})();
