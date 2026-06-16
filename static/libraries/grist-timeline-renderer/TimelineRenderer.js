// libraries/grist-timeline-renderer/TimelineRenderer.js
import { publish } from '../grist-event-bus/grist-event-bus.js';

export const TimelineRenderer = (() => {

    function parseGristDate(val) {
        if (!val) return null;
        if (val instanceof Date) return val;
        if (typeof val === 'number') {
            // Grist stores dates as seconds since epoch
            if (val > 100000000000) return new Date(val); // milliseconds
            return new Date(val * 1000); // seconds
        }
        // Check if string matches ISO format or other standard formats
        const d = new Date(val);
        if (!isNaN(d.getTime())) return d;
        return null;
    }

    function formatDate(date) {
        if (!date) return '-';
        return date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
    }

    function getInitials(name) {
        if (!name) return '?';
        return name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
    }

    function injectStyles() {
        if (document.getElementById('grf-timeline-styles')) return;
        const style = document.createElement('style');
        style.id = 'grf-timeline-styles';
        style.textContent = `
            .grf-timeline-container {
                font-family: 'Inter', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
                color: #1e293b;
                background: #f8fafc;
                padding: 20px;
                border-radius: 12px;
                display: flex;
                flex-direction: column;
                gap: 20px;
                height: 100%;
                box-sizing: border-box;
                overflow: hidden;
            }
            .grf-timeline-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                border-bottom: 1px solid #e2e8f0;
                padding-bottom: 15px;
            }
            .grf-timeline-title {
                font-size: 20px;
                font-weight: 700;
                color: #0f172a;
            }
            .grf-timeline-controls {
                display: flex;
                gap: 10px;
            }
            .grf-timeline-btn {
                background: #ffffff;
                border: 1px solid #cbd5e1;
                padding: 6px 12px;
                border-radius: 6px;
                cursor: pointer;
                font-size: 14px;
                font-weight: 500;
                transition: all 0.2s;
                color: #475569;
            }
            .grf-timeline-btn:hover {
                background: #f1f5f9;
                border-color: #94a3b8;
                color: #0f172a;
            }
            .grf-timeline-btn.active {
                background: #0ea5e9;
                color: #ffffff;
                border-color: #0ea5e9;
            }
            .grf-timeline-wrapper {
                flex: 1;
                overflow: auto;
                background: #ffffff;
                border: 1px solid #e2e8f0;
                border-radius: 8px;
                position: relative;
                box-shadow: 0 1px 3px rgba(0,0,0,0.05);
            }
            .grf-timeline-grid {
                display: grid;
                position: relative;
                min-width: 800px;
            }
            .grf-timeline-scale-header {
                display: flex;
                border-bottom: 2px solid #cbd5e1;
                background: #f1f5f9;
                position: sticky;
                top: 0;
                z-index: 10;
            }
            .grf-timeline-scale-label {
                flex: 1;
                text-align: center;
                padding: 10px 5px;
                font-size: 12px;
                font-weight: 600;
                color: #475569;
                border-right: 1px solid #e2e8f0;
                box-sizing: border-box;
            }
            .grf-timeline-scale-label:last-child {
                border-right: none;
            }
            .grf-timeline-swimlanes {
                display: flex;
                flex-direction: column;
            }
            .grf-timeline-swimlane {
                border-bottom: 1px solid #f1f5f9;
                display: flex;
                min-height: 80px;
                position: relative;
            }
            .grf-timeline-swimlane-info {
                width: 180px;
                padding: 15px;
                background: #f8fafc;
                border-right: 2px solid #cbd5e1;
                font-weight: 600;
                font-size: 14px;
                color: #334155;
                display: flex;
                align-items: center;
                position: sticky;
                left: 0;
                z-index: 5;
                box-sizing: border-box;
                word-break: break-word;
            }
            .grf-timeline-swimlane-track {
                flex: 1;
                position: relative;
                padding: 15px 0;
                background: #ffffff;
            }
            .grf-timeline-card {
                position: absolute;
                height: 44px;
                background: #e0f2fe;
                border-left: 4px solid #0284c7;
                border-radius: 6px;
                box-sizing: border-box;
                padding: 6px 10px;
                cursor: pointer;
                box-shadow: 0 2px 4px rgba(0,0,0,0.04);
                transition: transform 0.2s, box-shadow 0.2s;
                overflow: hidden;
                display: flex;
                flex-direction: column;
                justify-content: space-between;
            }
            .grf-timeline-card:hover {
                transform: translateY(-2px);
                box-shadow: 0 4px 8px rgba(0,0,0,0.1);
                z-index: 100 !important;
            }
            .grf-timeline-card-title {
                font-size: 12px;
                font-weight: 600;
                white-space: nowrap;
                overflow: hidden;
                text-overflow: ellipsis;
                color: #0f172a;
            }
            .grf-timeline-card-meta {
                display: flex;
                justify-content: space-between;
                align-items: center;
                font-size: 10px;
                color: #64748b;
            }
            .grf-timeline-progress-bg {
                position: absolute;
                bottom: 0;
                left: 0;
                height: 4px;
                width: 100%;
                background: rgba(0,0,0,0.05);
            }
            .grf-timeline-progress-fill {
                height: 100%;
                background: rgba(2, 132, 199, 0.4);
            }
            .grf-timeline-card-assignee {
                width: 18px;
                height: 18px;
                border-radius: 50%;
                background: #64748b;
                color: white;
                font-size: 8px;
                display: flex;
                align-items: center;
                justify-content: center;
                font-weight: bold;
            }
            .grf-timeline-card-tooltip {
                position: absolute;
                background: #0f172a;
                color: white;
                padding: 10px;
                border-radius: 6px;
                font-size: 12px;
                z-index: 1000;
                display: none;
                pointer-events: none;
                box-shadow: 0 10px 15px -3px rgba(0,0,0,0.3);
                width: 220px;
                line-height: 1.4;
            }
            .grf-timeline-card-tooltip b {
                color: #38bdf8;
            }
            .grf-timeline-today-line {
                position: absolute;
                top: 0;
                bottom: 0;
                width: 2px;
                background: #ef4444;
                z-index: 4;
                pointer-events: none;
            }
            .grf-timeline-today-line::after {
                content: 'Hoje';
                position: absolute;
                top: 0;
                left: 4px;
                background: #ef4444;
                color: white;
                font-size: 9px;
                padding: 1px 4px;
                border-radius: 2px;
                font-weight: 700;
            }
        `;
        document.head.appendChild(style);
    }

    async function renderTimeline(options) {
        const {
            container,
            records,
            config,
            tableLens
        } = options;

        injectStyles();

        const mapping = config.mapping || config || {};
        const styling = config.styling || config || {};
        const actions = config.actions || config || {};

        const tableId = mapping.tableId || config.tableId;

        // Validation Check
        if (!mapping.titleField || !mapping.startDateField || !mapping.endDateField) {
            container.innerHTML = `
                <div class="grf-timeline-container" style="justify-content: center; align-items: center;">
                    <div style="text-align: center; max-width: 400px; padding: 30px; background: white; border-radius: 12px; box-shadow: 0 4px 12px rgba(0,0,0,0.05); border: 1px solid #e2e8f0;">
                        <span style="font-size: 48px;">📅</span>
                        <h3 style="margin: 15px 0 10px; color: #0f172a;">Configuração Necessária</h3>
                        <p style="color: #64748b; font-size: 14px; margin-bottom: 20px;">
                            Mapeie pelo menos os campos de <b>Título</b>, <b>Data de Início</b> e <b>Data de Término</b> nas configurações do widget (⚙️).
                        </p>
                    </div>
                </div>
            `;
            return;
        }

        // Process data
        let validRecords = [];
        let minDate = null;
        let maxDate = null;

        records.forEach(rec => {
            const start = parseGristDate(rec[mapping.startDateField]);
            const end = parseGristDate(rec[mapping.endDateField]);
            
            if (start && end) {
                const title = rec[mapping.titleField] || 'Sem título';
                const progress = mapping.progressField ? parseFloat(rec[mapping.progressField]) : 0;
                const status = mapping.statusField ? rec[mapping.statusField] : '';
                const assignee = mapping.assigneeField ? rec[mapping.assigneeField] : '';
                const color = mapping.colorField && rec[mapping.colorField] ? rec[mapping.colorField] : null;
                const parent = mapping.parentField ? rec[mapping.parentField] : null;

                const processed = {
                    id: rec.id,
                    title,
                    start,
                    end,
                    progress: isNaN(progress) ? 0 : (progress > 1 ? progress : progress * 100), // Handle both 0.85 and 85 formats
                    status,
                    assignee,
                    color,
                    parent,
                    raw: rec
                };

                validRecords.push(processed);

                if (!minDate || start < minDate) minDate = new Date(start);
                if (!maxDate || end > maxDate) maxDate = new Date(end);
            }
        });

        if (validRecords.length === 0) {
            container.innerHTML = `
                <div class="grf-timeline-container" style="justify-content: center; align-items: center;">
                    <div style="text-align: center; max-width: 400px; padding: 30px; background: white; border-radius: 12px; box-shadow: 0 4px 12px rgba(0,0,0,0.05); border: 1px solid #e2e8f0;">
                        <span style="font-size: 48px;">ℹ️</span>
                        <h3 style="margin: 15px 0 10px; color: #0f172a;">Sem dados</h3>
                        <p style="color: #64748b; font-size: 14px;">
                            Não foram encontrados registros com datas de início e término válidas nesta tabela.
                        </p>
                    </div>
                </div>
            `;
            return;
        }

        // Add padding to dates (1 month back and front)
        minDate.setMonth(minDate.getMonth() - 1);
        maxDate.setMonth(maxDate.getMonth() + 1);
        
        // Ensure start is set to first day of that month
        minDate.setDate(1);
        minDate.setHours(0, 0, 0, 0);
        // Ensure end is set to last day of that month
        maxDate.setMonth(maxDate.getMonth() + 1);
        maxDate.setDate(0);
        maxDate.setHours(23, 59, 59, 999);

        // Scale modes: 'month', 'week'
        let viewMode = styling.viewMode || 'month';

        // Grouping
        const groupField = styling.groupingField;
        const groups = {};

        if (groupField) {
            validRecords.forEach(rec => {
                let groupVal = rec.raw[groupField];
                // Handle refs
                if (groupVal && typeof groupVal === 'object') {
                    groupVal = groupVal.label || groupVal.Label || Object.values(groupVal)[0] || 'Outros';
                }
                const groupName = groupVal || 'Sem Grupo';
                if (!groups[groupName]) groups[groupName] = [];
                groups[groupName].push(rec);
            });
        } else {
            groups['Plano de Ação'] = validRecords;
        }

        // Render main frame
        container.innerHTML = `
            <div class="grf-timeline-container">
                <div class="grf-timeline-header">
                    <div class="grf-timeline-title">${config.widgetTitle || 'Linha do Tempo'}</div>
                    <div class="grf-timeline-controls">
                        <button class="grf-timeline-btn ${viewMode === 'month' ? 'active' : ''}" id="mode-month">Mensal</button>
                        <button class="grf-timeline-btn ${viewMode === 'week' ? 'active' : ''}" id="mode-week">Semanal</button>
                    </div>
                </div>
                <div class="grf-timeline-wrapper">
                    <div class="grf-timeline-grid" id="timeline-grid-content"></div>
                </div>
                <div class="grf-timeline-card-tooltip" id="timeline-tooltip"></div>
            </div>
        `;

        // Add event listeners for mode buttons
        container.querySelector('#mode-month').onclick = () => {
            options.config.styling = { ...(options.config.styling || {}), viewMode: 'month' };
            renderTimeline(options);
        };
        container.querySelector('#mode-week').onclick = () => {
            options.config.styling = { ...(options.config.styling || {}), viewMode: 'week' };
            renderTimeline(options);
        };

        const gridContent = container.querySelector('#timeline-grid-content');
        const tooltip = container.querySelector('#timeline-tooltip');

        // Draw headers and tracks
        const totalDurationMs = maxDate - minDate;

        // Generate scale units
        const scaleUnits = [];
        let current = new Date(minDate);

        if (viewMode === 'month') {
            while (current <= maxDate) {
                scaleUnits.push({
                    label: current.toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' }),
                    start: new Date(current),
                    end: new Date(current.getFullYear(), current.getMonth() + 1, 0, 23, 59, 59, 999)
                });
                current.setMonth(current.getMonth() + 1);
            }
        } else { // 'week'
            while (current <= maxDate) {
                const weekEnd = new Date(current);
                weekEnd.setDate(current.getDate() + 6);
                weekEnd.setHours(23, 59, 59, 999);
                scaleUnits.push({
                    label: `W${getWeekNumber(current)} (${current.getDate()}/${current.getMonth() + 1})`,
                    start: new Date(current),
                    end: weekEnd
                });
                current.setDate(current.getDate() + 7);
            }
        }

        // Draw scale header
        const scaleHeaderHtml = `
            <div class="grf-timeline-scale-header">
                <div style="width: 180px; flex-shrink: 0; background: #e2e8f0; border-right: 2px solid #cbd5e1; sticky; left: 0; z-index: 11;"></div>
                ${scaleUnits.map(unit => `<div class="grf-timeline-scale-label">${unit.label}</div>`).join('')}
            </div>
        `;

        // Draw swimlanes
        let swimlanesHtml = '<div class="grf-timeline-swimlanes">';

        Object.keys(groups).forEach((groupName, gIdx) => {
            swimlanesHtml += `
                <div class="grf-timeline-swimlane" id="swimlane-${gIdx}">
                    <div class="grf-timeline-swimlane-info">${groupName}</div>
                    <div class="grf-timeline-swimlane-track" id="track-${gIdx}"></div>
                </div>
            `;
        });
        swimlanesHtml += '</div>';

        gridContent.innerHTML = scaleHeaderHtml + swimlanesHtml;

        // Position tasks inside swimlanes
        Object.keys(groups).forEach((groupName, gIdx) => {
            const track = container.querySelector(`#track-${gIdx}`);
            const swimlaneTasks = groups[groupName];

            // Resolve overlapping by dividing track into slots (sub-tracks)
            const slots = []; // Array of arrays of tasks

            swimlaneTasks.forEach(task => {
                let slotIdx = 0;
                while (true) {
                    if (!slots[slotIdx]) {
                        slots[slotIdx] = [];
                        slots[slotIdx].push(task);
                        task.slot = slotIdx;
                        break;
                    }
                    // Check overlap in current slot
                    const overlap = slots[slotIdx].some(t => {
                        return (task.start <= t.end && task.end >= t.start);
                    });
                    if (!overlap) {
                        slots[slotIdx].push(task);
                        task.slot = slotIdx;
                        break;
                    }
                    slotIdx++;
                }
            });

            // Adjust swimlane height based on number of slots
            const slotHeight = 54; // Card height + gap
            const trackHeight = Math.max(1, slots.length) * slotHeight + 10;
            const swimlane = container.querySelector(`#swimlane-${gIdx}`);
            swimlane.style.minHeight = `${trackHeight}px`;

            swimlaneTasks.forEach(task => {
                const startPct = ((task.start - minDate) / totalDurationMs) * 100;
                const endPct = ((task.end - minDate) / totalDurationMs) * 100;
                const widthPct = Math.max(1, endPct - startPct);

                const cardEl = document.createElement('div');
                cardEl.className = 'grf-timeline-card';
                
                // Color support
                const barColor = task.color || styling.defaultColor || '#0dcaf0';
                cardEl.style.left = `${startPct}%`;
                cardEl.style.width = `${widthPct}%`;
                cardEl.style.top = `${task.slot * slotHeight + 10}px`;
                cardEl.style.backgroundColor = blendHexColor(barColor, '#ffffff', 0.85); // Light bg
                cardEl.style.borderLeftColor = barColor;

                // Progress Fill
                let progressHtml = '';
                if (styling.showProgress !== false && mapping.progressField) {
                    progressHtml = `
                        <div class="grf-timeline-progress-bg">
                            <div class="grf-timeline-progress-fill" style="width: ${task.progress}%; background-color: ${barColor}"></div>
                        </div>
                    `;
                }

                // Assignee Badge
                let assigneeBadge = '';
                if (task.assignee) {
                    let assigneeName = task.assignee;
                    if (typeof assigneeName === 'object') {
                        assigneeName = assigneeName.label || assigneeName.Label || Object.values(assigneeName)[0] || '';
                    }
                    if (assigneeName) {
                        assigneeBadge = `<div class="grf-timeline-card-assignee" title="${assigneeName}">${getInitials(assigneeName)}</div>`;
                    }
                }

                cardEl.innerHTML = `
                    <div class="grf-timeline-card-title" title="${task.title}">${task.title}</div>
                    <div class="grf-timeline-card-meta">
                        <span>${task.progress.toFixed(0)}%</span>
                        ${assigneeBadge}
                    </div>
                    ${progressHtml}
                `;

                // Hover interactions (Tooltip)
                cardEl.onmousemove = (e) => {
                    let assigneeName = task.assignee;
                    if (typeof assigneeName === 'object') {
                        assigneeName = assigneeName.label || assigneeName.Label || Object.values(assigneeName)[0] || '';
                    }
                    tooltip.style.display = 'block';
                    tooltip.style.left = `${e.pageX + 15}px`;
                    tooltip.style.top = `${e.pageY + 15}px`;
                    tooltip.innerHTML = `
                        <div style="font-weight: 700; margin-bottom: 5px;">${task.title}</div>
                        <div><b>Início:</b> ${formatDate(task.start)}</div>
                        <div><b>Término:</b> ${formatDate(task.end)}</div>
                        ${mapping.progressField ? `<div><b>Progresso:</b> ${task.progress.toFixed(0)}%</div>` : ''}
                        ${task.status ? `<div><b>Status:</b> ${task.status}</div>` : ''}
                        ${assigneeName ? `<div><b>Responsável:</b> ${assigneeName}</div>` : ''}
                    `;
                };

                cardEl.onmouseleave = () => {
                    tooltip.style.display = 'none';
                };

                // Click action (Trigger Grist Drawer)
                cardEl.onclick = (e) => {
                    e.stopPropagation();
                    console.log("[TimelineRenderer] Card clicked:", task.id, tableId);
                    publish('grf-card-clicked', {
                        tableId: tableId,
                        recordId: task.id,
                        drawerConfigId: actions.drawerConfigId
                    });
                };

                track.appendChild(cardEl);
            });
        });

        // Add today red line
        const today = new Date();
        if (today >= minDate && today <= maxDate) {
            const todayPct = ((today - minDate) / totalDurationMs) * 100;
            const todayLine = document.createElement('div');
            todayLine.className = 'grf-timeline-today-line';
            todayLine.style.left = `${todayPct}%`;
            // Calculate scale header height to offset the label
            todayLine.style.top = '40px'; 
            gridContent.appendChild(todayLine);
        }
    }

    // Helper to blend color with white/black (for soft background shades)
    function blendHexColor(color, blendColor, weight) {
        if (!color.startsWith('#')) return color;
        const c1 = color.substring(1);
        const c2 = blendColor.substring(1);
        
        const r1 = parseInt(c1.substring(0, 2), 16);
        const g1 = parseInt(c1.substring(2, 4), 16);
        const b1 = parseInt(c1.substring(4, 6), 16);

        const r2 = parseInt(c2.substring(0, 2), 16);
        const g2 = parseInt(c2.substring(2, 4), 16);
        const b2 = parseInt(c2.substring(4, 6), 16);

        const r = Math.round(r1 * (1 - weight) + r2 * weight);
        const g = Math.round(g1 * (1 - weight) + g2 * weight);
        const b = Math.round(b1 * (1 - weight) + b2 * weight);

        return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
    }

    function getWeekNumber(d) {
        const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
        const dayNum = date.getUTCDay() || 7;
        date.setUTCDate(date.getUTCDate() + 4 - dayNum);
        const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
        return Math.ceil((((date - yearStart) / 86400000) + 1) / 7);
    }

    return { renderTimeline };
})();
