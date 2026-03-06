export function renderProgressBar(options) {
    const { container, cellValue, isEditing, isLocked, fieldOptions } = options;
    const value = Number(cellValue) || 0;
    const widgetOptions = fieldOptions?.widgetOptions || {};

    if (isEditing && !isLocked) {
        const input = document.createElement('input');
        input.type = 'range';
        input.min = 0;
        input.max = 100;
        input.value = value;
        input.className = 'grf-form-input';
        input.dataset.colId = options.colSchema.colId;
        container.appendChild(input);

        const percentageLabel = document.createElement('span');
        percentageLabel.className = 'grf-progress-label';
        percentageLabel.textContent = `${value}%`;
        container.appendChild(percentageLabel);

        input.addEventListener('input', () => {
            percentageLabel.textContent = `${input.value}%`;
        });

    } else {
        const progressWrapper = document.createElement('div');
        progressWrapper.className = 'grf-progress-wrapper';

        const progressBar = document.createElement('div');
        progressBar.className = 'grf-progress-bar';
        progressBar.style.width = `${value}%`;
        progressBar.textContent = `${value}%`;
        progressBar.style.color = 'white';
        progressBar.style.textShadow = '-1px -1px 0 #333, 1px -1px 0 #333, -1px 1px 0 #333, 1px 1px 0 #333';

        // Apply Stripes
        if (widgetOptions.striped) {
            progressBar.classList.add('grf-progress-bar-striped');
        }

        // Apply Main Color as a base
        progressBar.style.backgroundColor = widgetOptions.mainColor || '#4caf50'; // Default to green if no main color

        // Apply Dynamic Coloring, overriding the main color if a rule matches
        if (widgetOptions.colorRules && Array.isArray(widgetOptions.colorRules) && widgetOptions.colorRules.length > 0) {
            const sortedRules = [...widgetOptions.colorRules].sort((a, b) => a.threshold - b.threshold);
            const matchingRule = sortedRules.find(rule => value <= rule.threshold);
            if (matchingRule) {
                progressBar.style.backgroundColor = matchingRule.color;
            }
        }

        // Apply Thickness
        if (widgetOptions.thickness) {
            const percentage = parseInt(widgetOptions.thickness, 10);
            if (!isNaN(percentage)) {
                const baseHeight = 20; // Default height in px from CSS
                const newHeight = (baseHeight * percentage) / 100;
                progressWrapper.style.height = `${newHeight}px`;
            }
        }

        progressWrapper.appendChild(progressBar);
        container.appendChild(progressWrapper);

        if (isLocked) {
            container.closest('.drawer-field-value')?.classList.add('is-locked-style');
        }
    }
}
