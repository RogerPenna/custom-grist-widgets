// libraries/grist-gantt-renderer/GanttRenderer.js
import { publish } from '../grist-event-bus/grist-event-bus.js';

export const GanttRenderer = (() => {

    function parseGristDate(val) {
        if (!val) return null;
        if (val instanceof Date) return val;
        if (typeof val === 'number') {
            if (val > 100000000000) return new Date(val); // milliseconds
            return new Date(val * 1000); // seconds
        }
        const d = new Date(val);
        if (!isNaN(d.getTime())) return d;
        return null;
    }

    function formatDate(date) {
        if (!date) return '-';
        return date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
    }

    function injectStyles() {
        if (document.getElementById('grf-gantt-styles')) return;
        const style = document.createElement('style');
        style.id = 'grf-gantt-styles';
        style.textContent = `
            .grf-gantt-container {
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
            .grf-gantt-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                border-bottom: 1px solid #e2e8f0;
                padding-bottom: 15px;
            }
            .grf-gantt-title {
                font-size: 20px;
                font-weight: 700;
                color: #0f172a;
            }
            .grf-gantt-controls {
                display: flex;
                gap: 10px;
            }
            .grf-gantt-btn {
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
            .grf-gantt-btn:hover {
                background: #f1f5f9;
                border-color: #94a3b8;
                color: #0f172a;
            }
            .grf-gantt-btn.active {
                background: #0ea5e9;
                color: #ffffff;
                border-color: #0ea5e9;
            }
            .grf-gantt-wrapper {
                flex: 1;
                overflow-y: auto;
                overflow-x: hidden;
                background: #ffffff;
                border: 1px solid #e2e8f0;
                border-radius: 8px;
                box-shadow: 0 1px 3px rgba(0,0,0,0.05);
            }
            .grf-gantt-body {
                overflow-x: auto;
                display: flex;
                flex-direction: column;
            }
            .grf-gantt-row {
                display: flex;
                min-width: max-content;
                border-bottom: 1px solid #f1f5f9;
                min-height: 44px;
                align-items: stretch;
            }
            .grf-gantt-row.header {
                background: #f1f5f9;
                border-bottom: 2px solid #cbd5e1;
                position: sticky;
                top: 0;
                z-index: 10;
                min-height: 48px;
            }
            .grf-gantt-col-left {
                width: 320px;
                flex-shrink: 0;
                border-right: 2px solid #e2e8f0;
                position: sticky;
                left: 0;
                z-index: 5;
                background: inherit;
                box-sizing: border-box;
                display: flex;
                align-items: center;
                padding: 5px 15px;
            }
            .grf-gantt-col-left.header {
                font-weight: 700;
                color: #475569;
                font-size: 13px;
                background: #f1f5f9;
            }
            .grf-gantt-col-right {
                flex: 1;
                position: relative;
                box-sizing: border-box;
                background: inherit;
            }
            .grf-gantt-col-right.header {
                display: flex;
                background: #f1f5f9;
            }
            .grf-gantt-scale-unit {
                flex: 1;
                text-align: center;
                font-size: 11px;
                font-weight: 600;
                color: #475569;
                border-right: 1px solid #e2e8f0;
                display: flex;
                align-items: center;
                justify-content: center;
                box-sizing: border-box;
            }
            .grf-gantt-scale-unit:last-child {
                border-right: none;
            }
            .grf-gantt-task-name {
                font-size: 13px;
                font-weight: 600;
                white-space: nowrap;
                overflow: hidden;
                text-overflow: ellipsis;
                color: #1e293b;
            }
            .grf-gantt-task-name.parent {
                font-weight: 700;
                color: #0f172a;
            }
            .grf-gantt-bar-container {
                position: absolute;
                top: 0;
                bottom: 0;
                left: 0;
                right: 0;
                display: flex;
                align-items: center;
            }
            .grf-gantt-bar {
                position: absolute;
                height: 24px;
                border-radius: 4px;
                cursor: pointer;
                box-sizing: border-box;
                box-shadow: 0 1px 3px rgba(0,0,0,0.05);
                transition: transform 0.1s, box-shadow 0.1s;
                display: flex;
                align-items: center;
                padding: 0;
                overflow: visible; /* to show label on the right */
            }
            .grf-gantt-bar:hover {
                transform: scaleY(1.05);
                box-shadow: 0 4px 6px rgba(0,0,0,0.1);
                z-index: 100 !important;
            }
            .grf-gantt-bar.parent {
                background: #334155 !important;
                height: 8px !important;
                border-radius: 2px !important;
                border: none !important;
            }
            .grf-gantt-bar.parent::before {
                content: '';
                position: absolute;
                left: 0; top: 100%;
                border-left: 6px solid #334155;
                border-bottom: 6px solid transparent;
            }
            .grf-gantt-bar.parent::after {
                content: '';
                position: absolute;
                right: 0; top: 100%;
                border-right: 6px solid #334155;
                border-bottom: 6px solid transparent;
            }
            .grf-gantt-bar-fill {
                height: 100%;
                border-radius: 3px 0 0 3px;
                background: rgba(255, 255, 255, 0.35);
            }
            .grf-gantt-bar-label {
                position: absolute;
                left: 105%;
                font-size: 11px;
                font-weight: 500;
                color: #64748b;
                white-space: nowrap;
                pointer-events: none;
            }
            .grf-gantt-tooltip {
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
            .grf-gantt-tooltip b {
                color: #38bdf8;
            }
            .grf-gantt-today-line {
                position: absolute;
                top: 0;
                bottom: 0;
                width: 2px;
                background: #ef4444;
                z-index: 4;
                pointer-events: none;
            }
            .grf-gantt-today-line::after {
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

    async function renderGantt(options) {
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
                <div class="grf-gantt-container" style="justify-content: center; align-items: center;">
                    <div style="text-align: center; max-width: 400px; padding: 30px; background: white; border-radius: 12px; box-shadow: 0 4px 12px rgba(0,0,0,0.05); border: 1px solid #e2e8f0;">
                        <span style="font-size: 48px;">📊</span>
                        <h3 style="margin: 15px 0 10px; color: #0f172a;">Configuração Necessária</h3>
                        <p style="color: #64748b; font-size: 14px; margin-bottom: 20px;">
                            Mapeie os campos de <b>Título</b>, <b>Data de Início</b> e <b>Data de Término</b> nas configurações do widget (⚙️) para exibir o Gantt.
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
                    progress: isNaN(progress) ? 0 : (progress > 1 ? progress : progress * 100),
                    status,
                    assignee,
                    color,
                    parent,
                    children: [],
                    raw: rec
                };

                validRecords.push(processed);

                if (!minDate || start < minDate) minDate = new Date(start);
                if (!maxDate || end > maxDate) maxDate = new Date(end);
            }
        });

        if (validRecords.length === 0) {
            container.innerHTML = `
                <div class="grf-gantt-container" style="justify-content: center; align-items: center;">
                    <div style="text-align: center; max-width: 400px; padding: 30px; background: white; border-radius: 12px; box-shadow: 0 4px 12px rgba(0,0,0,0.05); border: 1px solid #e2e8f0;">
                        <span style="font-size: 48px;">ℹ️</span>
                        <h3 style="margin: 15px 0 10px; color: #0f172a;">Sem dados</h3>
                        <p style="color: #64748b; font-size: 14px;">
                            Não foram encontrados registros com datas válidas nesta tabela.
                        </p>
                    </div>
                </div>
            `;
            return;
        }

        // Add padding to dates (1 month back and front)
        minDate.setMonth(minDate.getMonth() - 1);
        maxDate.setMonth(maxDate.getMonth() + 1);
        
        minDate.setDate(1);
        minDate.setHours(0, 0, 0, 0);
        maxDate.setMonth(maxDate.getMonth() + 1);
        maxDate.setDate(0);
        maxDate.setHours(23, 59, 59, 999);

        // Scale modes: 'month', 'week', 'day'
        let viewMode = styling.viewMode || 'week';

        // Build Tree hierarchy if parentField is mapped
        let displayList = [];
        const taskMap = {};
        validRecords.forEach(t => taskMap[t.id] = t);

        const roots = [];
        validRecords.forEach(task => {
            let parentId = null;
            if (task.parent) {
                if (typeof task.parent === 'object') {
                    parentId = task.parent.id || task.parent.rowId;
                } else {
                    parentId = task.parent;
                }
            }

            if (parentId && taskMap[parentId]) {
                taskMap[parentId].children.push(task);
            } else {
                roots.push(task);
            }
        });

        // Flatten the tree with pre-order traversal
        const visited = new Set();
        function flatten(nodes, level = 0) {
            const list = [];
            nodes.forEach(node => {
                if (visited.has(node.id)) return;
                visited.add(node.id);
                node.level = level;
                list.push(node);
                if (node.children && node.children.length > 0) {
                    list.push(...flatten(node.children, level + 1));
                }
            });
            return list;
        }

        if (mapping.parentField) {
            displayList = flatten(roots);
        } else {
            displayList = validRecords;
        }

        // Render main frame
        container.innerHTML = `
            <div class="grf-gantt-container">
                <div class="grf-gantt-header">
                    <div class="grf-gantt-title">${config.widgetTitle || 'Gráfico de Gantt'}</div>
                    <div class="grf-gantt-controls">
                        <button class="grf-gantt-btn ${viewMode === 'month' ? 'active' : ''}" id="gt-mode-month">Mensal</button>
                        <button class="grf-gantt-btn ${viewMode === 'week' ? 'active' : ''}" id="gt-mode-week">Semanal</button>
                    </div>
                </div>
                <div class="grf-gantt-wrapper">
                    <div class="grf-gantt-body" id="gantt-body-content"></div>
                </div>
                <div class="grf-gantt-tooltip" id="gantt-tooltip"></div>
            </div>
        `;

        // Add event listeners for mode buttons
        container.querySelector('#gt-mode-month').onclick = () => {
            options.config.styling = { ...(options.config.styling || {}), viewMode: 'month' };
            renderGantt(options);
        };
        container.querySelector('#gt-mode-week').onclick = () => {
            options.config.styling = { ...(options.config.styling || {}), viewMode: 'week' };
            renderGantt(options);
        };

        const bodyContent = container.querySelector('#gantt-body-content');
        const tooltip = container.querySelector('#gantt-tooltip');

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

        // Draw header row
        const headerRow = document.createElement('div');
        headerRow.className = 'grf-gantt-row header';

        const leftHeader = document.createElement('div');
        leftHeader.className = 'grf-gantt-col-left header';
        leftHeader.innerText = 'Ação / Projeto';

        const rightHeader = document.createElement('div');
        rightHeader.className = 'grf-gantt-col-right header';
        rightHeader.style.minWidth = `${scaleUnits.length * 100}px`;
        rightHeader.innerHTML = scaleUnits.map(unit => `<div class="grf-gantt-scale-unit">${unit.label}</div>`).join('');

        headerRow.appendChild(leftHeader);
        headerRow.appendChild(rightHeader);
        bodyContent.appendChild(headerRow);

        // Draw each task row
        displayList.forEach((task, index) => {
            const rowEl = document.createElement('div');
            rowEl.className = 'grf-gantt-row';
            rowEl.style.backgroundColor = index % 2 === 0 ? '#ffffff' : '#f8fafc';

            const leftCol = document.createElement('div');
            leftCol.className = 'grf-gantt-col-left';
            leftCol.style.paddingLeft = `${15 + (task.level || 0) * 16}px`;

            const isParent = task.children && task.children.length > 0;

            const nameEl = document.createElement('div');
            nameEl.className = `grf-gantt-task-name ${isParent ? 'parent' : ''}`;
            nameEl.innerText = (isParent ? '📁 ' : '📄 ') + task.title;
            leftCol.appendChild(nameEl);

            const rightCol = document.createElement('div');
            rightCol.className = 'grf-gantt-col-right';
            rightCol.style.minWidth = `${scaleUnits.length * 100}px`;

            // Draw task bar
            const startPct = ((task.start - minDate) / totalDurationMs) * 100;
            const endPct = ((task.end - minDate) / totalDurationMs) * 100;
            const widthPct = Math.max(0.5, endPct - startPct);

            const barContainer = document.createElement('div');
            barContainer.className = 'grf-gantt-bar-container';

            const barEl = document.createElement('div');
            barEl.className = `grf-gantt-bar ${isParent ? 'parent' : ''}`;
            barEl.style.left = `${startPct}%`;
            barEl.style.width = `${widthPct}%`;

            const barColor = task.color || styling.defaultColor || '#ffc107';

            if (!isParent) {
                barEl.style.backgroundColor = blendHexColor(barColor, '#ffffff', 0.85);
                barEl.style.border = `1px solid ${barColor}`;

                if (styling.showProgress !== false && mapping.progressField) {
                    const progressFill = document.createElement('div');
                    progressFill.className = 'grf-gantt-bar-fill';
                    progressFill.style.width = `${task.progress}%`;
                    progressFill.style.backgroundColor = barColor;
                    barEl.appendChild(progressFill);
                }
            }

            // Assignee Label on the right
            let labelText = '';
            if (task.assignee) {
                let assigneeName = task.assignee;
                if (typeof assigneeName === 'object') {
                    assigneeName = assigneeName.label || assigneeName.Label || Object.values(assigneeName)[0] || '';
                }
                if (assigneeName) labelText = `[${assigneeName}]`;
            }
            if (!isParent && mapping.progressField) {
                labelText += ` ${task.progress.toFixed(0)}%`;
            }

            if (labelText) {
                const labelEl = document.createElement('div');
                labelEl.className = 'grf-gantt-bar-label';
                labelEl.innerText = labelText;
                barEl.appendChild(labelEl);
            }

            // Tooltip events
            barEl.onmousemove = (e) => {
                let assigneeName = task.assignee;
                if (typeof assigneeName === 'object') {
                    assigneeName = assigneeName.label || assigneeName.Label || Object.values(assigneeName)[0] || '';
                }
                tooltip.style.display = 'block';
                // Adjust coordinates relative to wrapper for scrolling safety
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

            barEl.onmouseleave = () => {
                tooltip.style.display = 'none';
            };

            // Click event to open Grist Drawer
            barEl.onclick = (e) => {
                e.stopPropagation();
                console.log("[GanttRenderer] Row clicked:", task.id, tableId);
                publish('grf-card-clicked', {
                    tableId: tableId,
                    recordId: task.id,
                    drawerConfigId: actions.drawerConfigId
                });
            };

            barContainer.appendChild(barEl);
            rightCol.appendChild(barContainer);

            rowEl.appendChild(leftCol);
            rowEl.appendChild(rightCol);
            bodyContent.appendChild(rowEl);
        });

        // Add today red line
        const today = new Date();
        if (today >= minDate && today <= maxDate) {
            const todayPct = ((today - minDate) / totalDurationMs) * 100;
            const todayLine = document.createElement('div');
            todayLine.className = 'grf-gantt-today-line';
            todayLine.style.left = `${todayPct}%`;
            // Positioning it correctly offset from the left sidebar
            todayLine.style.left = `calc(320px + ${todayPct}% * (100% - 320px) / 100)`;
            // Wait, inside grf-gantt-body, the left side is absolute/sticky so todayLine can be drawn inside grf-gantt-col-right
            // That is cleaner! Let's append it to all grf-gantt-col-right rows or overlay it on the whole body!
            // Overlaying on the scrollable container: we can absolute-position it inside grf-gantt-body
            todayLine.style.left = `calc(320px + ${todayPct * (scaleUnits.length * 100) / 100}px)`;
            todayLine.style.top = '48px';
            bodyContent.appendChild(todayLine);
        }
    }

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

    return { renderGantt };
})();
