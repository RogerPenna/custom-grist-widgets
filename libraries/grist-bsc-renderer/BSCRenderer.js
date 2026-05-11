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
            lens.fetchTableRecords(perspectivesTable),
            lens.fetchTableRecords(objectivesTable),
        ]);

        if (!modelRecord) throw new Error(`Modelo ID ${modelId} não encontrado na tabela "${modelsTable}".`);
        if (!allPerspectives || allPerspectives.length === 0) console.warn(`Nenhuma perspectiva encontrada na tabela "${perspectivesTable}".`);

        // Descoberta automática de campos de relação se não fornecidos
        const refModelCol = tableNames.refModelCol || await lens.findRelationField(perspectivesTable, modelsTable) || 'ref_model';
        const refPerspCol = tableNames.refPerspCol || await lens.findRelationField(objectivesTable, perspectivesTable) || 'ref_persp';
        
        console.log(`[BSC Renderer] Usando relações: Persp->Model: ${refModelCol}, Obj->Persp: ${refPerspCol}`);

        const perspectivesForModel = allPerspectives
            .filter(p => p[refModelCol] === modelId)
            .sort((a, b) => (a.Ordem || a.id) - (b.Ordem || b.id))
            .map(p => ({
                ...p,
                objectives: allObjectives.filter(o => o[refPerspCol] === p.id)
            }));
        return { ...modelRecord, perspectives: perspectivesForModel, mapping: { ...tableNames, refModelCol, refPerspCol } };
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
                    
                    // Pass overrides if needed
                    const fieldConfigOverrides = {};
                    if (actions.showAddObjective !== undefined) {
                        fieldConfigOverrides[objectivesTable] = {
                            showAddButton: actions.showAddObjective,
                            addRecordConfigId: actions.addObjectiveConfigId
                        };
                    }

                    await CardSystem.renderCards(cardsContainer, bscData.perspectives, { 
                        ...cardConfig, 
                        tableLens,
                        fieldConfig: { ...(cardConfig.fieldConfig || {}), ...fieldConfigOverrides }
                    }, perspectiveSchema);
                    
                    container.appendChild(cardsContainer);
                    if (showRelationships) RelationshipLines.drawFromBscData(bscData);
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
