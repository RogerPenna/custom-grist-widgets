export function renderProgressBar(options) {
    const { container, cellValue, colSchema, record, isEditing, isLocked, fieldOptions, tableLens, receivedConfigs } = options;
    const value = Number(cellValue) || 0;
    
    // Helper to apply presets
    const applyPreset = (baseOptions, presetId) => {
        if (!presetId || !receivedConfigs) return baseOptions;
        const presetRecord = receivedConfigs.find(c => c.configId === presetId);
        if (!presetRecord) return baseOptions;
        try {
            const presetData = JSON.parse(presetRecord.stylingJson || presetRecord.configJson || '{}');
            // Preset values only apply if the field doesn't have its own override (handled in configurator)
            // But here in renderer, we merge them.
            return { ...presetData, ...baseOptions };
        } catch(e) { console.warn("Error parsing preset:", e); return baseOptions; }
    };

    // Helper to resolve palettes
    const resolvePalette = (paletteId, stopsArray) => {
        if (paletteId && receivedConfigs) {
            const paletteRecord = receivedConfigs.find(c => c.configId === paletteId);
            if (paletteRecord) {
                try {
                    const paletteData = JSON.parse(paletteRecord.stylingJson || paletteRecord.configJson || '{}');
                    const paletteColors = paletteData.colors || [];
                    if (paletteColors.length > 0) {
                        const dynamicStops = [];
                        const count = paletteColors.length;
                        paletteColors.forEach((c, i) => {
                            let val = count > 1 ? (i / (count - 1)) * 100 : 0;
                            dynamicStops.push({ value: val, color: c.hex });
                        });
                        return dynamicStops;
                    }
                } catch(e) { console.warn("Error resolving dynamic color palette:", e); }
            }
        }
        return stopsArray;
    };

    // 1. Resolve External Bar Options
    let extOpts = { ...fieldOptions };
    extOpts = applyPreset(extOpts, fieldOptions.progressBarPreset);
    extOpts.colorStops = resolvePalette(extOpts.colorPaletteId || extOpts.colorPalette, extOpts.colorStops);

    // 2. Resolve Internal Bar Options (if enabled)
    let intOpts = null;
    if (fieldOptions.showInternalBar) {
        intOpts = {
            mainColor: fieldOptions.internalMainColor,
            bgColor: fieldOptions.internalBgColor,
            showBgColor: fieldOptions.internalShowBgColor,
            borderRadius: fieldOptions.internalBorderRadius,
            thickness: fieldOptions.internalThickness,
            colorMode: fieldOptions.internalColorMode,
            colorStops: fieldOptions.internalColorStops,
            labelPosition: fieldOptions.internalLabelPosition,
            colorPaletteId: fieldOptions.internalColorPaletteId || fieldOptions.internalColorPalette
        };
        intOpts = applyPreset(intOpts, fieldOptions.internalBarPreset);
        intOpts.colorStops = resolvePalette(intOpts.colorPaletteId, intOpts.colorStops);
    }

    // Label Formatting
    const format = (val) => {
        if (tableLens && colSchema) {
            let label = tableLens.formatValue(val, colSchema);
            return label.includes('%') ? label : `${label}%`;
        }
        return `${Number(val).toFixed(1)}%`;
    };

    const extLabel = format(cellValue);
    let intLabel = '';
    if (intOpts && fieldOptions.internalBarColId && record) {
        intLabel = format(record[fieldOptions.internalBarColId]);
    }

    const outerContainer = document.createElement('div');
    outerContainer.className = 'grf-progress-field-container';
    
    if (fieldOptions.useFieldBg && fieldOptions.fieldBgColor) {
        const rgb = hexToRgb(fieldOptions.fieldBgColor);
        const opacity = fieldOptions.fieldOpacity ?? 1;
        outerContainer.style.setProperty('background-color', `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${opacity})`, 'important');
    }

    if (fieldOptions.fieldBorderWidth > 0) {
        outerContainer.style.border = `${fieldOptions.fieldBorderWidth}px solid ${fieldOptions.fieldBorderColor || '#cbd5e1'}`;
        outerContainer.style.borderRadius = '4px';
    }

    if (fieldOptions.fieldShadow) {
        outerContainer.classList.add('grf-field-shadow');
        outerContainer.style.margin = '4px';
        outerContainer.style.width = 'calc(100% - 8px)';
        outerContainer.style.height = 'calc(100% - 8px)';
    }

    if (fieldOptions.progressType === 'circular') {
        renderCircularProgress(outerContainer, value, extLabel, extOpts, intLabel, intOpts, record, options);
    } else {
        renderLinearProgress(outerContainer, value, extLabel, extOpts, intLabel, intOpts, record, options);
    }
    
    container.appendChild(outerContainer);

    if (isLocked) {
        container.closest('.drawer-field-value')?.classList.add('is-locked-style');
    }
}

function renderLinearProgress(container, value, extLabel, extOpts, intLabel, intOpts, record, options) {
    const renderBar = (val, label, opts, isInternal) => {
        const wrapper = document.createElement('div');
        wrapper.className = 'grf-progress-wrapper';
        wrapper.style.marginBottom = isInternal ? '0' : '5px';
        wrapper.style.position = 'relative';

        const min = opts.min !== undefined ? Number(opts.min) : 0;
        const max = opts.max !== undefined ? Number(opts.max) : 100;
        const norm = calculateNormalizedValue(val, min, max);

        if (opts.showBgColor !== false && opts.bgColor) wrapper.style.backgroundColor = opts.bgColor;
        if (opts.borderRadius !== undefined) wrapper.style.borderRadius = `${opts.borderRadius}px`;

        const bar = document.createElement('div');
        bar.className = 'grf-progress-bar';
        bar.style.width = `${norm}%`;
        bar.style.backgroundColor = getBarColor(norm, opts);
        
        if (opts.striped) bar.classList.add('grf-progress-bar-striped');
        if (opts.animated) bar.classList.add('grf-progress-bar-animated');
        
        if (opts.thickness) {
            const h = (20 * parseInt(opts.thickness, 10)) / 100;
            wrapper.style.height = `${h}px`;
        }

        const labelDiv = document.createElement('div');
        labelDiv.className = 'grf-progress-bar-label-centered';
        labelDiv.textContent = label;
        // Apply position logic if needed, but linear usually centers. 
        // We'll respect pos valor for label color/shadow though.
        labelDiv.style.color = 'white';
        labelDiv.style.textShadow = '1px 1px 2px rgba(0,0,0,0.8)';

        wrapper.appendChild(bar);
        wrapper.appendChild(labelDiv);
        return wrapper;
    };

    container.appendChild(renderBar(value, extLabel, extOpts, false));
    if (intOpts) {
        const val2 = Number(record[options.fieldOptions.internalBarColId]) || 0;
        container.appendChild(renderBar(val2, intLabel, intOpts, true));
    }
}

function renderCircularProgress(container, value, extLabel, extOpts, intLabel, intOpts, record, options) {
    const size = options.fieldOptions.size || 80;
    const outerWrapper = document.createElement('div');
    outerWrapper.style.position = 'relative';
    outerWrapper.style.width = `${size}px`;
    outerWrapper.style.height = `${size}px`;
    outerWrapper.style.display = 'flex';
    outerWrapper.style.justifyContent = 'center';
    outerWrapper.style.alignItems = 'center';

    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("viewBox", "0 0 100 100");
    svg.setAttribute("class", "grf-circular-svg");
    svg.style.width = '100%';
    svg.style.height = '100%';

    const getStrokeWidth = (thickVal) => (8 * parseInt(thickVal || '100', 10)) / 100;
    const center = 50;
    const radius = 40;

    // 1. External Bar
    const strokeWidth1 = getStrokeWidth(extOpts.thickness);
    if (extOpts.showBgColor !== false) {
        svg.appendChild(createCircle(center, radius, strokeWidth1, extOpts.bgColor || '#e0e0e0'));
    }
    const norm1 = calculateNormalizedValue(value, extOpts.min || 0, extOpts.max || 100);
    const circle1 = createCircle(center, radius, strokeWidth1, getBarColor(norm1, extOpts), norm1);
    if (extOpts.animated) circle1.setAttribute('class', 'grf-circular-animated');
    svg.appendChild(circle1);

    // 2. Internal Bar
    if (intOpts) {
        const val2 = Number(record[options.fieldOptions.internalBarColId]) || 0;
        const norm2 = calculateNormalizedValue(val2, intOpts.min || 0, intOpts.max || 100);
        const strokeWidth2 = getStrokeWidth(intOpts.thickness);
        const innerRadius = radius - (strokeWidth1/2) - (strokeWidth2/2) - 2;
        
        if (intOpts.showBgColor !== false) {
            svg.appendChild(createCircle(center, innerRadius, strokeWidth2, intOpts.bgColor || '#e0e0e0'));
        }
        const circle2 = createCircle(center, innerRadius, strokeWidth2, getBarColor(norm2, intOpts), norm2);
        if (intOpts.animated) circle2.setAttribute('class', 'grf-circular-animated');
        svg.appendChild(circle2);
    }

    outerWrapper.appendChild(svg);

    // 3. Labels
    const createLabel = (text, pos, isInt = false) => {
        if (!text) return null;
        const lbl = document.createElement('div');
        lbl.className = `grf-circular-label label-${pos}`;
        lbl.textContent = text;
        
        // High contrast styling for readability on any background
        lbl.style.color = 'white';
        lbl.style.textShadow = '-1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000, 1px 1px 0 #000, 0 0 5px rgba(0,0,0,0.8)';
        lbl.style.position = 'absolute';
        lbl.style.zIndex = '100'; // Ensure it's on top of SVG circles
        lbl.style.fontSize = isInt ? '10px' : '11px';
        lbl.style.fontWeight = 'bold';
        lbl.style.pointerEvents = 'none';
        lbl.style.whiteSpace = 'nowrap';
        
        if (pos === 'middle') {
             lbl.style.top = '50%'; lbl.style.left = '50%'; lbl.style.transform = 'translate(-50%, -50%)';
        } else if (pos === 'above') {
             lbl.style.bottom = '100%'; lbl.style.left = '50%'; lbl.style.transform = 'translateX(-50%)'; lbl.style.marginBottom = '2px';
        } else if (pos === 'below' || pos === 'below') { // Supporting both 'below' and 'below' (typo fallback)
             lbl.style.top = '100%'; lbl.style.left = '50%'; lbl.style.transform = 'translateX(-50%)'; lbl.style.marginTop = '2px';
        } else if (pos === 'left') {
             lbl.style.right = '100%'; lbl.style.top = '50%'; lbl.style.transform = 'translateY(-50%)'; lbl.style.marginRight = '5px';
        } else if (pos === 'right') {
             lbl.style.left = '100%'; lbl.style.top = '50%'; lbl.style.transform = 'translateY(-50%)'; lbl.style.marginLeft = '5px';
        }
        return lbl;
    };

    const extLabelEl = createLabel(extLabel, extOpts.labelPosition || 'middle');
    if (extLabelEl) outerWrapper.appendChild(extLabelEl);

    if (intOpts && intLabel) {
        const intLabelEl = createLabel(intLabel, intOpts.labelPosition || 'above', true);
        if (intLabelEl) outerWrapper.appendChild(intLabelEl);
    }

    container.appendChild(outerWrapper);
}

function createCircle(center, radius, strokeWidth, color, percent = null) {
    const circle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
    const circumference = 2 * Math.PI * radius;
    
    circle.setAttribute("cx", center);
    circle.setAttribute("cy", center);
    circle.setAttribute("r", radius);
    circle.setAttribute("fill", "transparent");
    circle.setAttribute("stroke", color);
    circle.setAttribute("stroke-width", strokeWidth);
    circle.setAttribute("stroke-linecap", "round");
    circle.style.transition = "stroke-dashoffset 0.35s";
    circle.style.transform = "rotate(-90deg)";
    circle.style.transformOrigin = "50% 50%";

    if (percent !== null) {
        const offset = circumference - (percent / 100) * circumference;
        circle.setAttribute("stroke-dasharray", `${circumference} ${circumference}`);
        circle.setAttribute("stroke-dashoffset", offset);
    }

    return circle;
}

function calculateNormalizedValue(value, min, max) {
    const range = max - min;
    const norm = range === 0 ? 0 : ((value - min) / range) * 100;
    return Math.min(100, Math.max(0, norm));
}

function getBarColor(normalizedValue, options) {
    const colorMode = options.colorMode || 'solid';
    const mainColor = options.mainColor || '#4caf50';
    const stops = options.colorStops || [];

    if (colorMode === 'solid') return mainColor;
    
    const sortedStops = [...stops].sort((a, b) => a.value - b.value);
    if (sortedStops.length === 0) return mainColor;

    if (colorMode === 'gradient' || colorMode === 'dynamic-gradient' || colorMode === 'static-gradient') {
        let lower = sortedStops[0];
        let upper = sortedStops[sortedStops.length - 1];

        for (let i = 0; i < sortedStops.length - 1; i++) {
            if (normalizedValue >= sortedStops[i].value) {
                lower = sortedStops[i];
                upper = sortedStops[i+1];
            }
            if (normalizedValue <= sortedStops[i+1].value) break;
        }

        if (lower === upper) return lower.color;
        const range = upper.value - lower.value;
        const factor = range === 0 ? 0 : (normalizedValue - lower.value) / range;
        return interpolateColor(lower.color, upper.color, factor);
    } 
    
    if (colorMode === 'steps') {
        const matchingStop = sortedStops.find(stop => normalizedValue <= stop.value) || sortedStops[sortedStops.length - 1];
        return matchingStop.color;
    }

    // Legacy Support for colorRules (used in Drawer)
    if (options.colorRules && Array.isArray(options.colorRules) && options.colorRules.length > 0) {
        const sortedRules = [...options.colorRules].sort((a, b) => a.threshold - b.threshold);
        const matchingRule = sortedRules.find(rule => normalizedValue <= rule.threshold);
        if (matchingRule) return matchingRule.color;
    }

    return mainColor;
}

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
    if (hex.length === 3) hex = hex.split('').map(char => char + char).join('');
    const bigint = parseInt(hex, 16);
    return { r: (bigint >> 16) & 255, g: (bigint >> 8) & 255, b: bigint & 255 };
}

