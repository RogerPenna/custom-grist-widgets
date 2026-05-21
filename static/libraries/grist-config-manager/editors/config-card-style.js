export const CardStyleConfigEditor = (() => {
    let _mainContainer = null;

    function render(container, config, lens, tableId, allConfigs) {
        _mainContainer = container;
        
        const stylingJson = config.styling ? JSON.stringify(config.styling, null, 2) : "{}";
        const actionsJson = config.actions ? JSON.stringify(config.actions, null, 2) : "{}";

        container.innerHTML = `
            <div class="form-group">
                <label for="cs-style-json">Card Styling JSON (O "Como"):</label>
                <textarea id="cs-style-json" rows="12" style="width: 100%; font-family: monospace;"></textarea>
                <p class="help-text">Visual, fontes, cores e bordas do card.</p>
            </div>
            <div class="form-group" style="margin-top: 20px;">
                <label for="cs-actions-json">Card Actions JSON (O "O que faz"):</label>
                <textarea id="cs-actions-json" rows="12" style="width: 100%; font-family: monospace;"></textarea>
                <p class="help-text">Botões, grupos de ícones, links de navegação e gaveta lateral.</p>
            </div>
        `;
        container.querySelector('#cs-style-json').value = stylingJson;
        container.querySelector('#cs-actions-json').value = actionsJson;
    }

    function read(container) {
        const styleTextarea = container.querySelector('#cs-style-json');
        const actionsTextarea = container.querySelector('#cs-actions-json');
        try {
            const styling = JSON.parse(styleTextarea.value);
            const actions = JSON.parse(actionsTextarea.value);
            return {
                mapping: {},
                styling: styling,
                actions: actions
            };
        } catch (e) {
            alert('Invalid JSON in Preset fields: ' + e.message);
            throw new Error('Invalid JSON');
        }
    }

    return { render, read };
})();