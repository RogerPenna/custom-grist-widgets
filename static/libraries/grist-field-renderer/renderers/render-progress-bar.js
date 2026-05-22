export function renderProgressBar(options) {
    const { container, cellValue, colSchema, record, isEditing, isLocked, fieldOptions, tableLens, receivedConfigs, tableSchema } = options;
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
    const format = (val, customSchema = null) => {
        if (val === undefined || val === null || val === '') return '';
        const schemaToUse = customSchema || colSchema;
        if (tableLens && schemaToUse) {
            try {
                let label = tableLens.formatValue(val, schemaToUse);
                if (label !== undefined && label !== null) {
                    return label.includes('%') ? label : `${label}%`;
                }
            } catch(e) {
                console.warn("Format error for column:", schemaToUse.colId, e);
            }
        }
        const numVal = Number(val);
        return isNaN(numVal) ? String(val) : `${numVal.toFixed(1)}%`;
    };

    const extLabel = format(cellValue, colSchema);
    let intLabel = '';
    if (intOpts && fieldOptions.internalBarColId && record) {
        const intColSchema = (tableSchema && tableSchema[fieldOptions.internalBarColId]) || colSchema;
        intLabel = format(record[fieldOptions.internalBarColId], intColSchema);
    }

    const isCircular = fieldOptions.progressType === 'circular';
    const isCircularShape = isCircular && (fieldOptions.circularBgMode !== 'box');
    const useCircleBg = isCircularShape && fieldOptions.useFieldBg;

    const outerContainer = document.createElement('div');
    outerContainer.className = 'grf-progress-field-container';
    
    if (fieldOptions.useFieldBg && fieldOptions.fieldBgColor && !useCircleBg) {
        const rgb = hexToRgb(fieldOptions.fieldBgColor);
        const opacity = fieldOptions.fieldOpacity ?? 1;
        outerContainer.style.setProperty('background-color', `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${opacity})`, 'important');
    }

    if (fieldOptions.fieldBorderWidth > 0 && !useCircleBg) {
        outerContainer.style.border = `${fieldOptions.fieldBorderWidth}px solid ${fieldOptions.fieldBorderColor || '#cbd5e1'}`;
        outerContainer.style.borderRadius = '4px';
    }

    if (fieldOptions.fieldShadow && !isCircularShape) {
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
        
        // Map old colorMode to new renderMode for backward compatibility
        let mode = opts.colorMode || 'solid-fixed';
        if (mode === 'solid') mode = 'solid-fixed';
        if (mode === 'dynamic' || mode === 'dynamic-gradient') mode = 'solid-dynamic';
        if (mode === 'smooth' || mode === 'static-gradient' || mode === 'gradient') mode = 'gradient-smooth';
        if (mode === 'stepped' || mode === 'steps') mode = 'gradient-steps';

        const colors = (opts.colorStops || []).map(s => s.color);
        const style = getProgressBarStyles(colors, norm, mode, opts.mainColor, false);
        
        if (style.isGradient) {
            bar.style.backgroundImage = style.background;
        } else {
            bar.style.backgroundColor = style.background;
        }
        
        if (opts.striped) bar.classList.add('grf-progress-bar-striped');
        if (opts.animated) bar.classList.add('grf-progress-bar-animated');
        
        if (opts.thickness) {
            const h = (20 * parseInt(opts.thickness, 10)) / 100;
            wrapper.style.height = `${h}px`;
        }

        const labelDiv = document.createElement('div');
        labelDiv.className = 'grf-progress-bar-label-centered';
        labelDiv.textContent = label;
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

    const useCircleBg = options.fieldOptions.useFieldBg && (options.fieldOptions.circularBgMode !== 'box');
    const isCircularShape = options.fieldOptions.circularBgMode !== 'box';

    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("viewBox", "0 0 100 100");
    svg.setAttribute("class", "grf-circular-svg");
    svg.style.width = '100%';
    svg.style.height = '100%';

    if (isCircularShape && options.fieldOptions.fieldShadow) {
        svg.style.filter = 'drop-shadow(0px 2px 4px rgba(0, 0, 0, 0.25))';
        svg.style.overflow = 'visible';
        container.style.padding = '4px';
    }

    const getStrokeWidth = (thickVal) => (8 * parseInt(thickVal || '100', 10)) / 100;
    const center = 50;
    const radius = 40;
    const strokeWidth1 = getStrokeWidth(extOpts.thickness);

    // 0. Filled Background Circle
    const bgRadius = radius + (strokeWidth1 / 2) + 2;
    if (useCircleBg && options.fieldOptions.fieldBgColor) {
        const rgb = hexToRgb(options.fieldOptions.fieldBgColor);
        const opacity = options.fieldOpacity ?? 1;
        const bgCircle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
        bgCircle.setAttribute("cx", center);
        bgCircle.setAttribute("cy", center);
        bgCircle.setAttribute("r", bgRadius);
        bgCircle.setAttribute("fill", `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${opacity})`);
        svg.appendChild(bgCircle);
    }

    // 0.1. Circular Border
    if (useCircleBg && options.fieldOptions.fieldBorderWidth > 0) {
        const borderWidth = Number(options.fieldOptions.fieldBorderWidth);
        const borderSvgWidth = borderWidth * (100 / size);
        const borderCircle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
        borderCircle.setAttribute("cx", center);
        borderCircle.setAttribute("cy", center);
        borderCircle.setAttribute("r", bgRadius);
        borderCircle.setAttribute("fill", "transparent");
        borderCircle.setAttribute("stroke", options.fieldOptions.fieldBorderColor || '#cbd5e1');
        borderCircle.setAttribute("stroke-width", borderSvgWidth);
        svg.appendChild(borderCircle);
    }

    const renderBar = (val, opts, r, sw, isInternal) => {
        const norm = calculateNormalizedValue(val, opts.min || 0, opts.max || 100);
        
        // Background track
        if (opts.showBgColor !== false) {
            svg.appendChild(createCircle(center, r, sw, opts.bgColor || '#e0e0e0'));
        }

        // Map old colorMode to new renderMode for backward compatibility
        let mode = opts.colorMode || 'solid-fixed';
        if (mode === 'solid') mode = 'solid-fixed';
        if (mode === 'dynamic' || mode === 'dynamic-gradient') mode = 'solid-dynamic';
        if (mode === 'smooth' || mode === 'static-gradient' || mode === 'gradient') mode = 'gradient-smooth';
        if (mode === 'stepped' || mode === 'steps') mode = 'gradient-steps';

        const colors = (opts.colorStops || []).map(s => s.color);
        const style = getProgressBarStyles(colors, norm, mode, opts.mainColor, true);
        
        if (!style.isGradient) {
            const circle = createCircle(center, r, sw, style.background, norm);
            if (opts.animated) circle.setAttribute('class', 'grf-circular-animated');
            svg.appendChild(circle);
        } else {
            // Gradient Mode (Smooth or Stepped)
            const maskId = 'mask-' + Math.random().toString(36).substr(2, 9);
            const svgMask = document.createElementNS("http://www.w3.org/2000/svg", "mask");
            svgMask.setAttribute("id", maskId);
            
            // Mask must have a solid white circle of exactly the progress length
            const maskCircle = createCircle(center, r, sw, "white", norm);
            maskCircle.setAttribute("stroke-linecap", "butt"); // BUTT for masks to avoid artifacts
            maskCircle.style.transition = "none";
            svgMask.appendChild(maskCircle);
            svg.appendChild(svgMask);

            const foGroup = document.createElementNS("http://www.w3.org/2000/svg", "g");
            foGroup.setAttribute("mask", `url(#${maskId})`);
            
            const fo = document.createElementNS("http://www.w3.org/2000/svg", "foreignObject");
            fo.setAttribute("x", "0"); fo.setAttribute("y", "0");
            fo.setAttribute("width", "100"); fo.setAttribute("height", "100");
            
            const div = document.createElement('div');
            div.style.width = '100%'; div.style.height = '100%';
            div.style.borderRadius = '50%';
            div.style.background = style.background;
            // Removed rotate(-90deg) to align with conic-gradient(from 0deg) starting at 12 o'clock
            
            fo.appendChild(div);
            foGroup.appendChild(fo);
            svg.appendChild(foGroup);
        }
    };

    // 1. External Bar
    renderBar(value, extOpts, radius, strokeWidth1, false);

    // 2. Internal Bar
    let innerRadius = radius; // For contrast outlines
    if (intOpts) {
        const val2 = Number(record[options.fieldOptions.internalBarColId]) || 0;
        const strokeWidth2 = getStrokeWidth(intOpts.thickness);
        innerRadius = radius - (strokeWidth1/2) - (strokeWidth2/2) - 2;
        renderBar(val2, intOpts, innerRadius, strokeWidth2, true);
    }

    // 2.5. Contrast Outlines
    const outlineColor = options.fieldOptions.circularOutline;
    const allowedOutlines = {
        'black': '#000000',
        'white': '#ffffff',
        'light-gray': '#d1d5db',
        'dark-gray': '#4b5563'
    };
    if (allowedOutlines.hasOwnProperty(outlineColor)) {
        const color = allowedOutlines[outlineColor];
        svg.appendChild(createCircle(center, radius + strokeWidth1 / 2, 0.6, color));
        svg.appendChild(createCircle(center, radius - strokeWidth1 / 2, 0.6, color));
        if (intOpts) {
            const strokeWidth2 = getStrokeWidth(intOpts.thickness);
            svg.appendChild(createCircle(center, innerRadius + strokeWidth2 / 2, 0.6, color));
            svg.appendChild(createCircle(center, innerRadius - strokeWidth2 / 2, 0.6, color));
        }
    }

    outerWrapper.appendChild(svg);

    // 3. Labels
    let extPos = extOpts.labelPosition || 'middle';
    let intPos = intOpts ? (intOpts.labelPosition || 'middle') : 'middle';

    // Automatic adjustment if both are middle to prevent overlapping
    if (intOpts && extPos === 'middle' && intPos === 'middle') {
        extPos = 'middle-upper';
        intPos = 'middle-lower';
    }

    const createLabel = (text, pos, isInt = false) => {
        if (!text || pos === 'none') return null;
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
        } else if (pos === 'middle-upper') {
             lbl.style.top = '40%'; lbl.style.left = '50%'; lbl.style.transform = 'translate(-50%, -50%)';
             lbl.style.fontSize = '9px';
        } else if (pos === 'middle-lower') {
             lbl.style.top = '60%'; lbl.style.left = '50%'; lbl.style.transform = 'translate(-50%, -50%)';
             lbl.style.fontSize = '9px';
        } else if (pos === 'above-in') {
             lbl.style.top = '33%'; lbl.style.left = '50%'; lbl.style.transform = 'translate(-50%, -50%)';
        } else if (pos === 'below-in') {
             lbl.style.top = '67%'; lbl.style.left = '50%'; lbl.style.transform = 'translate(-50%, -50%)';
        } else if (pos === 'left-in') {
             lbl.style.top = '50%'; lbl.style.left = '33%'; lbl.style.transform = 'translate(-50%, -50%)';
        } else if (pos === 'right-in') {
             lbl.style.top = '50%'; lbl.style.left = '67%'; lbl.style.transform = 'translate(-50%, -50%)';
        } else if (pos === 'above') {
             lbl.style.bottom = '100%'; lbl.style.left = '50%'; lbl.style.transform = 'translateX(-50%)'; lbl.style.marginBottom = '2px';
        } else if (pos === 'below') {
             lbl.style.top = '100%'; lbl.style.left = '50%'; lbl.style.transform = 'translateX(-50%)'; lbl.style.marginTop = '2px';
        } else if (pos === 'left') {
             lbl.style.right = '100%'; lbl.style.top = '50%'; lbl.style.transform = 'translateY(-50%)'; lbl.style.marginRight = '5px';
        } else if (pos === 'right') {
             lbl.style.left = '100%'; lbl.style.top = '50%'; lbl.style.transform = 'translateY(-50%)'; lbl.style.marginLeft = '5px';
        }
        return lbl;
    };

    const extLabelEl = createLabel(extLabel, extPos);
    if (extLabelEl) outerWrapper.appendChild(extLabelEl);

    if (intOpts && intLabel) {
        const intLabelEl = createLabel(intLabel, intPos, true);
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

function getProgressBarStyles(colors, progressValue, renderMode, defaultSolidColor = '#3498db', isCircular = false) {
    const numColors = colors.length;
    if (numColors === 0) return { background: defaultSolidColor, isGradient: false };
    if (numColors === 1) return { background: colors[0], isGradient: false };

    function interpolateColor(colors, percent) {
        if (percent <= 0) return colors[0];
        if (percent >= 100) return colors[numColors - 1];
        let factor = percent / 100;
        let i = Math.floor(factor * (numColors - 1));
        let subFactor = (factor * (numColors - 1)) - i;
        const c1 = hexToRgb(colors[i]);
        const c2 = hexToRgb(colors[i + 1]);
        const r = Math.round(c1.r + (c2.r - c1.r) * subFactor);
        const g = Math.round(c1.g + (c2.g - c1.g) * subFactor);
        const b = Math.round(c1.b + (c2.b - c1.b) * subFactor);
        return `rgb(${r}, ${g}, ${b})`;
    }

    switch(renderMode) {
        case 'solid-fixed':
            return { background: defaultSolidColor, isGradient: false };
            
        case 'solid-dynamic':
            return { background: interpolateColor(colors, progressValue), isGradient: false };
            
        case 'solid-thresholds':
            let sliceSize = 100 / numColors;
            let colorIndex = Math.min(Math.floor(progressValue / sliceSize), numColors - 1);
            return { background: colors[colorIndex], isGradient: false };
            
        case 'gradient-smooth':
            if (isCircular) {
                let smoothParts = colors.map((color, index) => {
                    let pos = index * (360 / (numColors - 1));
                    return `${color} ${pos.toFixed(1)}deg`;
                });
                return { background: `conic-gradient(from 0deg, ${smoothParts.join(', ')})`, isGradient: true };
            } else {
                let smoothParts = colors.map((color, index) => {
                    let pos = index * (100 / (numColors - 1));
                    return `${color} ${pos.toFixed(1)}%`;
                });
                return { background: `linear-gradient(90deg, ${smoothParts.join(', ')})`, isGradient: true };
            }
            
        case 'gradient-steps':
            if (isCircular) {
                let stepSlice = 360 / numColors;
                let stepParts = [];
                colors.forEach((color, index) => {
                    stepParts.push(`${color} ${(index * stepSlice).toFixed(1)}deg`, `${color} ${((index + 1) * stepSlice).toFixed(1)}deg`);
                });
                return { background: `conic-gradient(from 0deg, ${stepParts.join(', ')})`, isGradient: true };
            } else {
                let stepSlice = 100 / numColors;
                let stepParts = [];
                colors.forEach((color, index) => {
                    stepParts.push(`${color} ${(index * stepSlice).toFixed(1)}%`, `${color} ${((index + 1) * stepSlice).toFixed(1)}%`);
                });
                return { background: `linear-gradient(90deg, ${stepParts.join(', ')})`, isGradient: true };
            }
            
        default:
            return { background: defaultSolidColor, isGradient: false };
    }
}

function calculateNormalizedValue(value, min, max) {
    const range = max - min;
    const norm = range === 0 ? 0 : ((value - min) / range) * 100;
    return Math.min(100, Math.max(0, norm));
}

function hexToRgb(hex) {
    hex = hex.replace('#', '');
    if (hex.length === 3) hex = hex.split('').map(char => char + char).join('');
    const bigint = parseInt(hex, 16);
    return { r: (bigint >> 16) & 255, g: (bigint >> 8) & 255, b: bigint & 255 };
}

