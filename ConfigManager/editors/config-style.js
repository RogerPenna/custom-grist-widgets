window.StyleConfigEditor = (() => {
    let _mainContainer = null;

    async function render(container, config, lens, tableId, allConfigs = []) {
        _mainContainer = container;
        container.innerHTML = `
            <h3>Style Configuration</h3>
            <p>Define your style settings as a JSON object.</p>
            <textarea id="style-json-input" style="width: 100%; height: 300px; font-family: monospace;"></textarea>
            <p class="help-text">This JSON will be saved as your style configuration.</p>
        `;
        const textarea = container.querySelector('#style-json-input');
        textarea.value = JSON.stringify(config || {}, null, 2);
    }

    function read(container) {
        const textarea = container.querySelector('#style-json-input');
        try {
            return JSON.parse(textarea.value);
        } catch (e) {
            alert('Invalid JSON in Style Configuration: ' + e.message);
            throw e;
        }
    }

    return { render, read };
})();
