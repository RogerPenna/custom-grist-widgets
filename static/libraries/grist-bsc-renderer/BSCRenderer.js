// libraries/grist-bsc-renderer/BSCRenderer.js
import { CardSystem } from '../grist-card-system/CardSystem.js';
import { RelationshipLines } from '../grist-relationship-lines/RelationshipLines.js';

export const BSCRenderer = (() => {

    async function fetchFullBscStructure(modelId, lens) {
        const [modelRecord, allPerspectives, allObjectives] = await Promise.all([
            lens.findRecord('Modelos', { id: modelId }),
            lens.fetchTableRecords('Perspectivas'),
            lens.fetchTableRecords('Objetivos'),
        ]);
        if (!modelRecord) throw new Error(`Model with ID ${modelId} not found.`);

        const perspectivesForModel = allPerspectives
            .filter(p => p.ref_model === modelId)
            .sort((a, b) => (a.Ordem || a.id) - (b.Ordem || b.id))
            .map(p => ({
                ...p,
                objectives: allObjectives.filter(o => o.ref_persp === p.id)
            }));
        return { ...modelRecord, perspectives: perspectivesForModel };
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

        const actions = config.actions || {};
        const modelType = bscData.TipoModelo;
        let targetConfigId = config.perspectivesConfigId;

        if (modelType === 'Objetivos Qualidade' && config.qualityConfigId) targetConfigId = config.qualityConfigId;
        else if (modelType === 'Requisitos Partes Interessadas' && config.requirementsConfigId) targetConfigId = config.requirementsConfigId;

        if (targetConfigId) {
            try {
                let cardConfig = await tableLens.fetchConfig(targetConfigId);
                if (cardConfig) {
                    const perspectiveSchema = await tableLens.getTableSchema('Perspectivas');
                    cardConfig = patchConfigForBSC(cardConfig, perspectiveSchema);
                    
                    const cardsContainer = document.createElement('div');
                    cardsContainer.className = 'bsc-perspectives-grid';
                    
                    // Pass overrides if needed
                    const fieldConfigOverrides = {};
                    if (actions.showAddObjective !== undefined) {
                        fieldConfigOverrides['Objetivos'] = {
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
