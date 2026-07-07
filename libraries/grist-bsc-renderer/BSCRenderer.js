// libraries/grist-bsc-renderer/BSCRenderer.js
import { CardSystem } from '../grist-card-system/CardSystem.js';
import { RelationshipLines } from '../grist-relationship-lines/RelationshipLines.js?v=1.0.5';

export const BSCRenderer = (() => {

    async function fetchFullBscStructure(modelId, lens, tableNames = {}) {
        const modelsTable = tableNames.modelsTable || 'Modelos';
        const perspectivesTable = tableNames.perspectivesTable || 'Perspectivas';
        const objectivesTable = tableNames.objectivesTable || 'Objetivos';
        const relTable = tableNames.relTable;

        // Tenta buscar as tabelas de forma segura
        const [modelRecord, allPerspectives, allObjectives, allRelationships] = await Promise.all([
            lens.findRecord(modelsTable, { id: modelId }),
            lens.fetchTableRecordsOrThrow(perspectivesTable),
            lens.fetchTableRecordsOrThrow(objectivesTable),
            relTable ? lens.fetchTableRecordsOrThrow(relTable).catch(e => {
                console.warn(`[BSC Renderer] Erro ao buscar tabela de relacionamentos "${relTable}":`, e);
                return [];
            }) : Promise.resolve([])
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

        // Normalização das conexões causa/efeito
        const relCauseCol = tableNames.relCauseCol || 'ID_Causa';
        const relEffectCol = tableNames.relEffectCol || 'ID_Efeito';
        const relWeightCol = tableNames.relWeightCol || 'Peso';

        const normalizedRelationships = [];
        if (relTable && allRelationships && allRelationships.length > 0) {
            allRelationships.forEach(r => {
                let causeVal = r[relCauseCol];
                let effectVal = r[relEffectCol];
                let weightVal = r[relWeightCol];

                let causeId = null;
                if (Array.isArray(causeVal)) {
                    causeId = causeVal[0] === 'L' ? causeVal[1] : (typeof causeVal[0] === 'number' ? causeVal[0] : causeVal[1]);
                } else if (typeof causeVal === 'number') {
                    causeId = causeVal;
                } else if (causeVal && typeof causeVal === 'string') {
                    causeId = parseInt(causeVal, 10) || null;
                }

                let effectId = null;
                if (Array.isArray(effectVal)) {
                    effectId = effectVal[0] === 'L' ? effectVal[1] : (typeof effectVal[0] === 'number' ? effectVal[0] : effectVal[1]);
                } else if (typeof effectVal === 'number') {
                    effectId = effectVal;
                } else if (effectVal && typeof effectVal === 'string') {
                    effectId = parseInt(effectVal, 10) || null;
                }

                let weight = 1;
                if (typeof weightVal === 'number') {
                    weight = weightVal;
                } else if (weightVal && !isNaN(parseFloat(weightVal))) {
                    weight = parseFloat(weightVal);
                }

                if (causeId && effectId) {
                    normalizedRelationships.push({
                        causeId,
                        effectId,
                        weight
                    });
                }
            });
        } else {
            // Fallback para o modelo antigo (RefList nos Objetivos)
            allObjectives.forEach(o => {
                let relVal = o[relationshipField];
                let targetIds = [];
                if (Array.isArray(relVal)) {
                    targetIds = relVal[0] === 'L' ? relVal.slice(1) : relVal;
                } else if (relVal && typeof relVal === 'number') {
                    targetIds = [relVal];
                } else if (relVal && typeof relVal === 'string') {
                    targetIds = [parseInt(relVal, 10)].filter(Boolean);
                }
                
                targetIds.forEach(targetId => {
                    if (targetId && targetId > 0) {
                        normalizedRelationships.push({
                            causeId: targetId,
                            effectId: o.id,
                            weight: 1
                        });
                    }
                });
            });
        }

        return { 
            ...modelRecord, 
            perspectives: perspectivesForModel, 
            relationships: normalizedRelationships,
            mapping: { ...tableNames, refModelCol, refPerspCol, relationshipField } 
        };
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
                            arrowWeightMultiplier: styling.arrowWeightMultiplier !== undefined ? styling.arrowWeightMultiplier : 1,
                            outline: styling.showArrowOutline,
                            outlineColor: arrowOutlineColor,
                            outlineSize: styling.arrowOutlineThickness,
                            connDistanceType: styling.connDistanceType || 'relative',
                            connDistanceFixed: styling.connDistanceFixed !== undefined ? styling.connDistanceFixed : 20
                        };
                        RelationshipLines.drawFromBscData(bscData, arrowOptions);
                    } else {
                        RelationshipLines.clear();
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
