// libraries/grist-field-renderer/renderers/render-color-picker.js
export function renderColorPicker(options) {
    const { container, cellValue, isEditing, isLocked, fieldOptions } = options;
    
    // Suporte para ambos os formatos de configuração (Legado e Configurator Novo)
    const colorMode = fieldOptions?.mode || fieldOptions?.colorPickerOptions?.mode || 'picker';
    const swatchesRaw = fieldOptions?.swatches || fieldOptions?.colorPickerOptions?.swatches || '';
    
    console.log(`[renderColorPicker] mode: ${colorMode}, swatches: ${swatchesRaw}`);
    
    // Converte a string de swatches em array, limpando espaços e garantindo o #
    const swatchList = swatchesRaw.split(',')
        .map(s => s.trim())
        .filter(s => s.startsWith('#'));

    if (isEditing && !isLocked) {
        const wrapper = document.createElement('div');
        wrapper.className = 'grf-color-picker-wrapper';
        wrapper.style.display = 'flex';
        wrapper.style.flexDirection = 'column';
        wrapper.style.gap = '8px';

        // 1. O INPUT PICKER (se modo for picker ou both)
        let colorInput = null;
        if (colorMode === 'picker' || colorMode === 'both') {
            colorInput = document.createElement('input');
            colorInput.type = 'color';
            colorInput.className = 'grf-form-input';
            colorInput.dataset.colId = options.colSchema.colId;
            colorInput.value = (cellValue === null || cellValue === undefined || cellValue === '') ? '#000000' : String(cellValue);
            wrapper.appendChild(colorInput);
        }

        // 2. OS SWATCHES (se modo for swatches ou both)
        if (colorMode === 'swatches' || colorMode === 'both') {
            const swatchesContainer = document.createElement('div');
            swatchesContainer.className = 'grf-color-swatches';
            swatchesContainer.style.display = 'flex';
            swatchesContainer.style.flexWrap = 'wrap';
            swatchesContainer.style.gap = '6px';

            swatchList.forEach(color => {
                const swatch = document.createElement('div');
                swatch.className = 'grf-swatch-item';
                swatch.style.cssText = `
                    width: 24px; height: 24px; border-radius: 4px; border: 1px solid #ddd;
                    background-color: ${color}; cursor: pointer; transition: transform 0.1s;
                `;
                swatch.title = color;
                swatch.onclick = () => {
                    if (colorInput) {
                        colorInput.value = color;
                        // Dispara evento de mudança manual para o Grist capturar
                        colorInput.dispatchEvent(new Event('change', { bubbles: true }));
                    } else {
                        // Se não tem input, precisamos de um campo oculto para o Grist ler o valor
                        let hidden = wrapper.querySelector('input[type="hidden"]');
                        if (!hidden) {
                            hidden = document.createElement('input');
                            hidden.type = 'hidden';
                            hidden.dataset.colId = options.colSchema.colId;
                            wrapper.appendChild(hidden);
                        }
                        hidden.value = color;
                        hidden.dispatchEvent(new Event('change', { bubbles: true }));
                        
                        // Feedback visual de seleção no swatch (opcional)
                        swatchesContainer.querySelectorAll('.grf-swatch-item').forEach(s => s.style.outline = 'none');
                        swatch.style.outline = '2px solid #3b82f6';
                    }
                };
                swatch.onmouseover = () => swatch.style.transform = 'scale(1.1)';
                swatch.onmouseout = () => swatch.style.transform = 'scale(1.0)';
                swatchesContainer.appendChild(swatch);
            });
            wrapper.appendChild(swatchesContainer);
        }

        container.appendChild(wrapper);
    } else {
        // MODO VISUALIZAÇÃO: Quadrinho + Texto Hex
        container.style.display = 'flex';
        container.style.alignItems = 'center';
        container.style.gap = '8px';

        const colorBox = document.createElement('div');
        colorBox.className = 'grf-color-box';
        colorBox.style.backgroundColor = String(cellValue ?? '#FFFFFF');
        container.appendChild(colorBox);

        const colorText = document.createElement('span');
        colorText.style.fontFamily = 'monospace';
        colorText.textContent = String(cellValue ?? '(vazio)');
        container.appendChild(colorText);

        if (isLocked) {
            container.closest('.drawer-field-value')?.classList.add('is-locked-style');
        }
    }
}
