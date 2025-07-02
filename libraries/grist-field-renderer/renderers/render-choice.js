// libraries/grist-field-renderer/renderers/render-choice.js
export function renderChoice(options) {
    const { container, colSchema, cellValue, isEditing, displayAs = 'dropdown' } = options;
    const wopts = JSON.parse(colSchema.widgetOptions || '{}');
    const choices = wopts.choices || [];
    const isList = colSchema.type === 'ChoiceList';

    if (!isEditing) {
        // Read-only "pills" view
        const values = isList ? (Array.isArray(cellValue) ? cellValue.slice(1) : []) : [cellValue];
        if (values.length === 0 || (values.length === 1 && values[0] === null)) {
            container.textContent = '(vazio)';
            container.className = 'grf-readonly-empty';
            return;
        }
        values.forEach(val => {
            if (val) {
                const pill = document.createElement('span');
                pill.className = 'grf-choice-pill';
                pill.textContent = val;
                container.appendChild(pill);
            }
        });
        return;
    }
    
    // Editing Mode
    if (displayAs === 'radio' && !isList) {
        choices.forEach(choice => {
            const label = document.createElement('label');
            const radio = document.createElement('input');
            radio.type = 'radio';
            radio.name = colSchema.colId + options.record.id; // Unique name per row
            radio.value = choice;
            radio.checked = (cellValue === choice);
            label.appendChild(radio);
            label.appendChild(document.createTextNode(' ' + choice));
            container.appendChild(label);
            container.appendChild(document.createElement('br'));
        });
        // This is tricky, we need a hidden input to hold the value for the save logic
        const hiddenInput = document.createElement('input');
        hiddenInput.type = 'hidden';
        hiddenInput.dataset.colId = colSchema.colId;
        hiddenInput.value = cellValue;
        container.appendChild(hiddenInput);
        container.addEventListener('change', (e) => { hiddenInput.value = e.target.value; });
    } else { // Default to dropdown/select
        const select = document.createElement('select');
        select.className = 'grf-form-input';
        select.multiple = isList;
        select.dataset.colId = colSchema.colId;
        choices.forEach(choice => {
            const option = document.createElement('option');
            option.value = choice;
            option.textContent = choice;
            if (isList) {
                if (Array.isArray(cellValue) && cellValue.includes(choice)) option.selected = true;
            } else {
                if (cellValue === choice) option.selected = true;
            }
            select.appendChild(option);
        });
        container.appendChild(select);
    }
}