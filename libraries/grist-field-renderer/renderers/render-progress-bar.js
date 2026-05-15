export function renderProgressBar(options) {
    const { container, cellValue, colSchema, isEditing, isLocked, fieldOptions, tableLens, receivedConfigs } = options;
    const value = Number(cellValue) || 0;
    
    // --- PRESET INHERITANCE ---
    let widgetOptions = { ...fieldOptions };
    if (widgetOptions.progressBarPreset && receivedConfigs) {
        const presetRecord = receivedConfigs.find(c => c.configId === widgetOptions.progressBarPreset);
        if (presetRecord) {
            try {
                const presetData = JSON.parse(presetRecord.stylingJson || presetRecord.configJson || '{}');
                // CLEAN MERGE: Only local options that are NOT default/empty should override the preset.
                // For progress bars, we treat the preset as the base and apply local overrides.
                widgetOptions = { ...presetData, ...fieldOptions };
                
                // Special handling for booleans: if local is undefined, use preset.
                if (fieldOptions.striped === undefined) widgetOptions.striped = presetData.striped;
                if (fieldOptions.animated === undefined) widgetOptions.animated = presetData.animated;
            } catch(e) { console.warn("Error parsing global progress bar preset:", e); }
        }
    }
    // --- END PRESET INHERITANCE ---

    // --- DYNAMIC COLOR PALETTE RESOLUTION ---
    // If the progress bar (or its preset) is linked to a global Color Palette, we fetch the colors now.
    if (widgetOptions.colorPaletteId && receivedConfigs) {
        const paletteRecord = receivedConfigs.find(c => c.configId === widgetOptions.colorPaletteId);
        if (paletteRecord) {
            try {
                const paletteData = JSON.parse(paletteRecord.stylingJson || paletteRecord.configJson || '{}');
                const paletteColors = paletteData.colors || [];
                if (paletteColors.length > 0) {
                    const dynamicStops = [];
                    const count = paletteColors.length;
                    paletteColors.forEach((c, i) => {
                        let val = 0;
                        if (count > 1) {
                            val = (i / (count - 1)) * 100; // Exact distribution
                        }
                        dynamicStops.push({ value: val, color: c.hex });
                    });
                    widgetOptions.colorStops = dynamicStops;
                }
            } catch(e) { console.warn("Error resolving dynamic color palette:", e); }
        }
    }
    // --- END PALETTE RESOLUTION ---

    // Formatação do label seguindo o padrão centralizado
    let formattedLabel = '';
    if (tableLens && colSchema) {
        formattedLabel = tableLens.formatValue(cellValue, colSchema);
        // Se a config do Grist já não incluir o %, nós adicionamos
        if (!formattedLabel.includes('%')) {
            formattedLabel += '%';
        }
    } else {
        formattedLabel = `${value.toFixed(1)}%`;
    }

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
        percentageLabel.textContent = formattedLabel;
        container.appendChild(percentageLabel);

        input.addEventListener('input', () => {
            const newVal = Number(input.value);
            // No modo de edição "ao vivo", simplificamos para 0 ou 1 casa para feedback rápido
            percentageLabel.textContent = `${newVal.toFixed(0)}%`;
        });

    } else {
        const progressWrapper = document.createElement('div');
        progressWrapper.className = 'grf-progress-wrapper';
        
        // Min/Max support
        const min = widgetOptions.min !== undefined ? Number(widgetOptions.min) : 0;
        const max = widgetOptions.max !== undefined ? Number(widgetOptions.max) : 100;
        const range = max - min;
        const normalizedValue = range === 0 ? 0 : ((value - min) / range) * 100;

        // Background color for the wrapper
        if (widgetOptions.bgColor) {
            progressWrapper.style.backgroundColor = widgetOptions.bgColor;
        }

        // Border radius
        if (widgetOptions.borderRadius !== undefined) {
            const br = typeof widgetOptions.borderRadius === 'number' ? `${widgetOptions.borderRadius}px` : widgetOptions.borderRadius;
            progressWrapper.style.borderRadius = br;
        }

        const progressBar = document.createElement('div');
        progressBar.className = 'grf-progress-bar';
        progressBar.style.width = `${Math.min(100, Math.max(0, normalizedValue))}%`;

        const progressLabel = document.createElement('div');
        progressLabel.className = 'grf-progress-bar-label-centered';
        progressLabel.textContent = formattedLabel;

        // Color Logic
        const colorMode = widgetOptions.colorMode || 'solid';
        let barColor = widgetOptions.mainColor || '#4caf50';

        if (colorMode === 'gradient' || colorMode === 'dynamic-gradient' || colorMode === 'static-gradient' || colorMode === 'steps') {
            const stops = widgetOptions.colorStops || [
                { value: 0, color: '#ff4d4d' },
                { value: 100, color: '#4caf50' }
            ];
            
            // Sort stops by value
            const sortedStops = [...stops].sort((a, b) => a.value - b.value);

            if (colorMode === 'gradient' || colorMode === 'dynamic-gradient') {
                // Find the two stops between which the normalizedValue falls
                let lower = sortedStops[0];
                let upper = sortedStops[sortedStops.length - 1];

                for (let i = 0; i < sortedStops.length - 1; i++) {
                    if (normalizedValue >= sortedStops[i].value) {
                        lower = sortedStops[i];
                        upper = sortedStops[i+1];
                    }
                    if (normalizedValue <= sortedStops[i+1].value) {
                        break;
                    }
                }

                if (lower === upper) {
                    barColor = lower.color;
                } else {
                    const range = upper.value - lower.value;
                    const factor = range === 0 ? 0 : (normalizedValue - lower.value) / range;
                    barColor = interpolateColor(lower.color, upper.color, factor);
                }
                progressBar.style.backgroundColor = barColor;
            } else if (colorMode === 'static-gradient') {
                // Apply a linear gradient background to the bar
                const gradientString = sortedStops.map(s => `${s.color} ${s.value}%`).join(', ');
                
                // For static gradient, we want the gradient to span the full bar (100%) 
                // but only be visible in the completed area. 
                // We achieve this by setting background-size proportional to the fill width.
                const effectiveValue = Math.min(100, Math.max(0.1, normalizedValue));
                const bgSize = (100 / effectiveValue) * 100;

                progressBar.style.backgroundImage = `linear-gradient(to right, ${gradientString})`;
                progressBar.style.backgroundSize = `${bgSize}% 100%`;
                progressBar.style.backgroundRepeat = 'no-repeat';

                // When using backgroundImage for the gradient, we should also apply the stripe gradient on top if needed
                if (widgetOptions.striped) {
                    const stripeGradient = `linear-gradient(45deg, rgba(255, 255, 255, 0.25) 25%, transparent 25%, transparent 50%, rgba(255, 255, 255, 0.25) 50%, rgba(255, 255, 255, 0.25) 75%, transparent 75%, transparent)`;
                    progressBar.style.backgroundImage = `${stripeGradient}, linear-gradient(to right, ${gradientString})`;
                    progressBar.style.backgroundSize = `1rem 1rem, ${bgSize}% 100%`;
                    progressBar.style.backgroundRepeat = 'repeat, no-repeat';
                }
            } else if (colorMode === 'steps') {
                // Find the first stop where normalizedValue <= stop.value
                const matchingStop = sortedStops.find(stop => normalizedValue <= stop.value) || sortedStops[sortedStops.length - 1];
                barColor = matchingStop.color;
                progressBar.style.backgroundColor = barColor;
            }
        } else {
            // Solid or legacy colorRules support
            if (widgetOptions.colorRules && Array.isArray(widgetOptions.colorRules) && widgetOptions.colorRules.length > 0) {
                const sortedRules = [...widgetOptions.colorRules].sort((a, b) => a.threshold - b.threshold);
                const matchingRule = sortedRules.find(rule => value <= rule.threshold);
                if (matchingRule) {
                    barColor = matchingRule.color;
                }
            }
            progressBar.style.backgroundColor = barColor;
        }

        // Apply Stripes class (for animated stripes or static pattern)
        if (widgetOptions.striped && colorMode !== 'static-gradient') {
            progressBar.classList.add('grf-progress-bar-striped');
        }

        // Apply Animation
        if (widgetOptions.animated) {
            progressBar.classList.add('grf-progress-bar-animated');
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
        progressWrapper.appendChild(progressLabel);
        container.appendChild(progressWrapper);

        if (isLocked) {
            container.closest('.drawer-field-value')?.classList.add('is-locked-style');
        }
    }
}

/**
 * Interpolates between two hex colors.
 */
function interpolateColor(color1, color2, factor) {
    const c1 = hexToRgb(color1);
    const c2 = hexToRgb(color2);
    
    const r = Math.round(c1.r + (c2.r - c1.r) * factor);
    const g = Math.round(c1.g + (c2.g - c1.g) * factor);
    const b = Math.round(c1.b + (c2.b - c1.b) * factor);
    
    return `rgb(${r}, ${g}, ${b})`;
}

function hexToRgb(hex) {
    hex = hex.replace('#', '');
    if (hex.length === 3) {
        hex = hex.split('').map(char => char + char).join('');
    }
    const bigint = parseInt(hex, 16);
    return {
        r: (bigint >> 16) & 255,
        g: (bigint >> 8) & 255,
        b: bigint & 255
    };
}
