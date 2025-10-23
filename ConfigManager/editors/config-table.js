// ConfigManager/editors/config-table.js

export const TableConfigEditor = {
    render: function(container, configData, tableLens, tableId, allConfigs) {
        console.log('TableConfigEditor: render called', { configData, tableLens, tableId, allConfigs });
        container.innerHTML = `
            <div>
                <h3>Table Widget Configuration</h3>
                <p>This is a placeholder for the Table Widget specific configuration editor.</p>
                <div class="form-group">
                    <label for="table-editor-message">Message:</label>
                    <input type="text" id="table-editor-message" value="${configData.message || ''}">
                </div>
            </div>
        `;
    },
    read: function(container) {
        console.log('TableConfigEditor: read called');
        return {
            message: container.querySelector('#table-editor-message').value
        };
    }
};