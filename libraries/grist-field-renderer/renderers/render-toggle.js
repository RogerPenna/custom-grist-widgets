/**
 * Renderizador de Toggle Switch (Estilo iOS) para campos Booleanos.
 */
export function renderToggle(options) {
    const { container, cellValue, fieldStyle } = options;
    const widgetOptions = fieldStyle?.widgetOptions || {};
    const isOn = !!cellValue;
    
    const onColor = widgetOptions.onColor || '#198754';
    const offColor = widgetOptions.offColor || '#ced4da';
    const showLabels = widgetOptions.showLabels !== false;

    container.innerHTML = '';
    container.classList.add('grf-toggle-container');

    const wrapper = document.createElement('div');
    wrapper.className = 'grf-toggle-wrapper';
    
    const switchEl = document.createElement('div');
    switchEl.className = `grf-toggle-switch ${isOn ? 'on' : 'off'}`;
    switchEl.style.backgroundColor = isOn ? onColor : offColor;
    
    const knob = document.createElement('div');
    knob.className = 'grf-toggle-knob';
    switchEl.appendChild(knob);

    wrapper.appendChild(switchEl);

    if (showLabels) {
        const label = document.createElement('span');
        label.className = 'grf-toggle-label';
        label.textContent = isOn ? 'Sim' : 'Não';
        wrapper.appendChild(label);
    }

    container.appendChild(wrapper);
}