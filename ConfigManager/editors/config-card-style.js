export const CardStyleConfigEditor = (() => {
    let _mainContainer = null;

    function render(container, config, lens, tableId, allConfigs) {
        _mainContainer = container;
        container.innerHTML = `
            <div class="form-group">
                <label for="cs-style-json">Card Style JSON:</label>
                <textarea id="cs-style-json" rows="15" style="width: 100%; font-family: monospace;"></textarea>
                <p class="help-text">Paste the JSON for the card styling here. This will override all styling options.</p>
            </div>
        `;
        const textarea = container.querySelector('#cs-style-json');
        if (config && config.styling) {
            textarea.value = JSON.stringify(config.styling, null, 2);
        } else {
            textarea.value = JSON.stringify({}, null, 2);
        }
    }

    function read(container) {
        const textarea = container.querySelector('#cs-style-json');
        try {
            const styling = JSON.parse(textarea.value);
            return { styling: styling }; // Return an object with a 'styling' property
        } catch (e) {
            alert('Invalid JSON in Card Style JSON field: ' + e.message);
            throw new Error('Invalid JSON');
        }
    }

    return { render, read };
})();