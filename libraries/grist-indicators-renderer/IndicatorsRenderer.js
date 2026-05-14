import { CardSystem } from '../grist-card-system/CardSystem.js';

export const IndicatorsRenderer = (() => {
    console.log("IndicatorsRenderer v1.0.2 loading...");
    const MONTH_KEYS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

    const PERIODICITY_CONFIG = {
        'MONTHLY': { months: MONTH_KEYS, label: 'Mensal' },
        'BIMONTHLY': { months: ['fev', 'abr', 'jun', 'ago', 'out', 'dez'], label: 'Bimestral' },
        'QUARTERLY': { months: ['mar', 'jun', 'set', 'dez'], label: 'Trimestral' },
        'QUADRIMESTRAL': { months: ['abr', 'ago', 'dez'], label: 'Quadrimestral' },
        'SEMIANNUAL': { months: ['jun', 'dez'], label: 'Semestral' },
        'ANNUAL': { months: ['dez'], label: 'Anual' }
    };

    function calculatePerformance(value, target, direction) {
        if (!target || target === 0) return (value === 0 || value === undefined) ? 1 : 0;
        if (direction === 'LESS_IS_BETTER') {
            if (value === 0) return 2; // 200% cap for 0 result in lower-better
            return target / value;
        }
        return value / target;
    }

    function getStatusEmoji(performance) {
        const p = performance * 100;
        if (p > 100) return "🔵";
        if (p < 50) return "🔴";
        if (p < 70) return "🟠";
        if (p < 80) return "🟡";
        if (p < 90) return "🟢";
        if (p <= 100) return "🟩";
        return "❓";
    }

    function calculateProgressiveTargets(targetsJson, selectedYear) {
        const allAnchors = [];
        const yearsInJson = Object.keys(targetsJson).sort();
        
        // Collect all anchors from all years
        yearsInJson.forEach(year => {
            MONTH_KEYS.forEach((m, i) => {
                const entry = targetsJson[year][m];
                if (entry && (entry.m === true || entry.manual === true)) {
                    allAnchors.push({
                        time: parseInt(year) * 12 + i,
                        val: typeof entry === 'object' ? entry.v : entry
                    });
                }
            });
        });

        // Fallback: If no anchors at all, return empty line for selectedYear
        if (allAnchors.length === 0) {
            const result = {};
            result[selectedYear] = new Array(12).fill(0);
            return result;
        }

        // Sort anchors chronologically
        allAnchors.sort((a, b) => a.time - b.time);

        const result = {};
        const targetYearNum = parseInt(selectedYear);
        
        // We calculate at least the selectedYear, plus any year present in JSON
        const yearsToCalculate = new Set([...yearsInJson, selectedYear]);
        
        yearsToCalculate.forEach(year => {
            const yearNum = parseInt(year);
            result[year] = new Array(12).fill(0);
            
            for (let i = 0; i < 12; i++) {
                const currentTime = yearNum * 12 + i;
                
                const nextIdx = allAnchors.findIndex(a => a.time >= currentTime);
                const prevIdx = nextIdx === -1 ? allAnchors.length - 1 : nextIdx - 1;

                if (nextIdx === 0) {
                    // Before or at the first anchor
                    result[year][i] = allAnchors[0].val;
                } else if (nextIdx === -1) {
                    // After the last anchor
                    result[year][i] = allAnchors[allAnchors.length - 1].val;
                } else {
                    // Between two anchors -> linear interpolation
                    const start = allAnchors[prevIdx];
                    const end = allAnchors[nextIdx];
                    
                    const steps = end.time - start.time;
                    const elapsed = currentTime - start.time;
                    result[year][i] = start.val + ((end.val - start.val) / steps) * elapsed;
                }
            }
        });

        return result;
    }

    function consolidateYearData(yearData, type, monthsToConsider) {
        // yearData can be legacy {"jan": 10} or new {"jan": {"v": 10, "d": "..."}}
        const values = monthsToConsider.map(m => {
            const entry = yearData[m];
            if (entry === null || entry === undefined) return null;
            return (typeof entry === 'object') ? entry.v : entry;
        }).filter(v => v !== null && v !== undefined);

        if (values.length === 0) return 0;

        if (type === 'SUM') {
            return values.reduce((a, b) => a + b, 0);
        } else if (type === 'AVG') {
            return values.reduce((a, b) => a + b, 0) / values.length;
        } else { // LAST
            return values[values.length - 1];
        }
    }

    function getIndicatorMetrics(record, config, selectedYear) {
        const mapping = config.mapping || config || {};
        const resultsField = mapping.resultsField || config.resultsField;
        const targetField = mapping.targetField || config.targetField;
        
        const rawResultsJson = record[resultsField];
        const rawTargetsJson = record[targetField];

        const _parseJson = (val) => {
            try {
                return (typeof val === 'string' && val.trim().startsWith('{')) ? JSON.parse(val) : (typeof val === 'object' && val !== null ? val : {});
            } catch(e) { return {}; }
        };

        let resultsData = _parseJson(rawResultsJson);
        let targetsData = _parseJson(rawTargetsJson);

        // Master JSON detection for results
        let yearResultsNode = resultsData[selectedYear] || {};
        let results = yearResultsNode.results || {};
        if (!yearResultsNode.results && (yearResultsNode.jan !== undefined || resultsData.jan !== undefined)) {
            results = yearResultsNode.jan !== undefined ? yearResultsNode : resultsData;
        }

        const rawPeriodicity = record[mapping.periodicityField || config.periodicityField];
        const periodicityKey = mapping.periodicityMap?.[rawPeriodicity] || 'MONTHLY';
        const periodicity = PERIODICITY_CONFIG[periodicityKey] || PERIODICITY_CONFIG.MONTHLY;

        const rawDirection = record[mapping.directionField || config.directionField];
        const direction = mapping.directionMap?.[rawDirection] || 'MORE_IS_BETTER';

        const rawConsolidation = record[mapping.consolidationField || config.consolidationField];
        const consolidationType = mapping.consolidationMap?.[rawConsolidation] || 'SUM';

        // Progressive Goals Calculation - Pass selectedYear to ensure it's generated
        const progressiveTargets = calculateProgressiveTargets(targetsData, selectedYear);
        
        // Safe fallback: If not in JSON, use the raw targetField only if it's a number
        let fallbackTarget = 0;
        if (typeof rawTargetsJson === 'number') fallbackTarget = rawTargetsJson;
        else if (typeof rawTargetsJson === 'string' && !rawTargetsJson.trim().startsWith('{')) {
            const parsed = parseFloat(rawTargetsJson);
            if (!isNaN(parsed)) fallbackTarget = parsed;
        }

        const targetLine = progressiveTargets[selectedYear] || new Array(12).fill(fallbackTarget);

        const consolidatedValue = consolidateYearData(results, consolidationType, periodicity.months);
        
        // Calculate cumulative and monthly arrays for SUM visualization
        const monthlyValues = MONTH_KEYS.map(m => {
            const entry = results[m];
            if (entry === null || entry === undefined) return null;
            return (typeof entry === 'object') ? entry.v : entry;
        });

        let runningSum = 0;
        const cumulativeResults = monthlyValues.map(v => {
            if (v !== null && v !== undefined) {
                runningSum += v;
                return runningSum;
            }
            return null;
        });

        const lastMonthWithDataIdx = monthlyValues.map((v, i) => v !== null ? i : -1).filter(i => i !== -1).pop();
        const lastMonthValue = lastMonthWithDataIdx !== undefined ? monthlyValues[lastMonthWithDataIdx] : null;

        const numPeriods = periodicity.months.length;
        const lastMonthIdx = MONTH_KEYS.indexOf(periodicity.months[numPeriods - 1]);
        const yearlyTarget = targetLine[lastMonthIdx] || 0;
        const monthlyTargetValue = yearlyTarget / numPeriods;

        // Calculate specific targets for each month based on interpolation
        // For SUM indicators, targetLine represents the cumulative target.
        // The specific target for month i is targetLine[i] - targetLine[i-1].
        // FALLBACK: If the targetLine is flat (no progressive anchors), we use the average.
        const isFlatLine = targetLine.every(v => Math.abs(v - targetLine[0]) < 0.0001);
        const specificMonthlyTargets = targetLine.map((val, i) => {
            if (consolidationType !== 'SUM') return val;
            if (isFlatLine) return monthlyTargetValue;
            const prevVal = i > 0 ? targetLine[i - 1] : 0;
            return val - prevVal;
        });

        let targetForPerformance = yearlyTarget;
        if (consolidationType === 'SUM' && lastMonthWithDataIdx !== undefined) {
            targetForPerformance = targetLine[lastMonthWithDataIdx];
        }

        const performance = calculatePerformance(consolidatedValue, targetForPerformance, direction);
        const status = getStatusEmoji(performance);

        // Calculate Monthly Snapshot (Latest Month vs its specific target)
        // This is exactly what the individual monthly chips show.
        let lastMonthPerformance = performance;
        let lastMonthStatus = status;
        if (lastMonthWithDataIdx !== undefined) {
            const specificTarget = specificMonthlyTargets[lastMonthWithDataIdx];
            lastMonthPerformance = calculatePerformance(lastMonthValue, specificTarget, direction);
            lastMonthStatus = getStatusEmoji(lastMonthPerformance);
        }

        // Unified Persistence Metrics (What should be saved to Grist columns)
        // Fixed to ensure the Grist table column matches the Gauge and the monthly chips
        const persistValue = (lastMonthValue !== null) ? lastMonthValue : consolidatedValue;
        const persistPerformance = (lastMonthValue !== null) ? lastMonthPerformance : performance;
        const persistStatus = (lastMonthValue !== null) ? lastMonthStatus : status;

        const chartMin = record[mapping.chartMinField || config.chartMinField];
        const chartMax = record[mapping.chartMaxField || config.chartMaxField];

        // Goal Limits Calculation
        const useUpper = record[mapping.useUpperLimitField];
        const useLower = record[mapping.useLowerLimitField];
        const upperPct = record[mapping.upperLimitValueField] || 0;
        const lowerPct = record[mapping.lowerLimitValueField] || 0;

        const upperLimitLine = targetLine.map(v => (useUpper && v) ? v * (1 + upperPct / 100) : null);
        const lowerLimitLine = targetLine.map(v => (useLower && v) ? v * (1 - lowerPct / 100) : null);

        return {
            consolidatedValue,
            performance,
            status,
            results,
            cumulativeResults,
            monthlyValues,
            lastMonthValue,
            lastMonthWithDataIdx,
            lastMonthPerformance,
            lastMonthStatus,
            persistValue,
            persistPerformance,
            persistStatus,
            consolidationType,
            numPeriods,
            yearlyTarget,
            monthlyTargetValue,
            specificMonthlyTargets,
            targetsJson: targetsData[selectedYear] || {},
            targetLine,
            upperLimitLine,
            lowerLimitLine,
            periodicity,
            direction,
            chartRange: (chartMin !== undefined && chartMax !== undefined) ? [chartMin, chartMax] : null
        };
    }

    // --- TOOLTIP & GAUGE HELPERS ---
    let tooltipEl = null;

    function getStatusColor(statusEmoji) {
        switch(statusEmoji) {
            case '🔵': return '#3b82f6';
            case '🔴': return '#ef4444';
            case '🟠': return '#f97316';
            case '🟡': return '#eab308';
            case '🟢': return '#22c55e';
            case '🟩': return '#16a34a';
            default: return '#94a3b8';
        }
    }

    function renderGauge(container, value, title, statusEmoji) {
        if (!window.Plotly) return;
        const color = getStatusColor(statusEmoji);
        const data = [
            {
                type: "indicator",
                mode: "gauge+number",
                value: value * 100,
                title: { text: title, font: { size: 12, color: '#64748b' } },
                number: { suffix: "%", font: { size: 28, color: '#1e293b' }, valueformat: ".1f" },
                gauge: {
                    axis: { range: [0, 150], tickwidth: 1, tickcolor: "#cbd5e1" },
                    bar: { color: color },
                    bgcolor: "white",
                    borderwidth: 1,
                    bordercolor: "#e2e8f0",
                    steps: [
                        { range: [0, 50], color: "rgba(239, 68, 68, 0.05)" },
                        { range: [50, 80], color: "rgba(234, 179, 8, 0.05)" },
                        { range: [80, 100], color: "rgba(34, 197, 94, 0.05)" },
                        { range: [100, 150], color: "rgba(59, 130, 246, 0.05)" }
                    ],
                    threshold: {
                        line: { color: "#1e293b", width: 3 },
                        thickness: 0.75,
                        value: 100
                    }
                }
            }
        ];

        const layout = {
            width: 280,
            height: 180,
            margin: { t: 40, r: 30, l: 30, b: 10 },
            paper_bgcolor: "transparent",
            font: { color: "#334155", family: "inherit" }
        };

        Plotly.newPlot(container, data, layout, { staticPlot: true, responsive: true });
    }

    function showTooltip(e, record, metrics) {
        if (!tooltipEl) {
            tooltipEl = document.createElement('div');
            tooltipEl.className = 'indicator-tooltip';
            document.body.appendChild(tooltipEl);
        }
        
        const card = e.currentTarget;
        const rect = card.getBoundingClientRect();
        
        tooltipEl.style.display = 'flex';
        
        // Position tooltip
        let top = rect.top - 230;
        let left = rect.left + rect.width / 2 - 140;
        
        if (top < 0) top = rect.bottom + 10;
        if (left < 0) left = 10;
        if (left + 280 > window.innerWidth) left = window.innerWidth - 290;

        tooltipEl.style.top = top + 'px';
        tooltipEl.style.left = left + 'px';

        tooltipEl.innerHTML = `
            <div class="tooltip-header">${record.Nome || 'Indicador'}</div>
            <div id="tooltip-gauge-container" class="tooltip-gauge-container" style="height: 180px;"></div>
        `;
        
        const valueToDisplay = metrics.lastMonthPerformance; // Snapshot performance of the latest month
        const statusToDisplay = metrics.lastMonthStatus;
        
        renderGauge(document.getElementById('tooltip-gauge-container'), valueToDisplay, 'Desempenho Atual', statusToDisplay);
    }

    function hideTooltip() {
        if (tooltipEl) tooltipEl.style.display = 'none';
    }
    // --- END TOOLTIP HELPERS ---

    function getFullTimelineMetrics(record, config) {
        const mapping = config.mapping || config || {};
        const resultsField = mapping.resultsField || config.resultsField;
        const targetField = mapping.targetField || config.targetField;

        const _parseJson = (val) => {
            try {
                return (typeof val === 'string' && val.trim().startsWith('{')) ? JSON.parse(val) : (typeof val === 'object' && val !== null ? val : {});
            } catch(e) { return {}; }
        };

        const resultsData = _parseJson(record[resultsField]);
        const targetsData = _parseJson(record[targetField]);

        const allYears = Array.from(new Set([
            ...Object.keys(resultsData),
            ...Object.keys(targetsData)
        ])).filter(y => !isNaN(parseInt(y))).sort();

        if (allYears.length === 0) return null;

        const firstYear = allYears[0];
        const lastYear = allYears[allYears.length - 1];
        
        // Use current year as anchor for progressive targets if none specified
        const currentYear = new Date().getFullYear().toString();
        const progressiveTargets = calculateProgressiveTargets(targetsData, currentYear);

        const rawConsolidation = record[mapping.consolidationField || config.consolidationField];
        const consolidationType = mapping.consolidationMap?.[rawConsolidation] || 'SUM';

        const xValues = [];
        const resultY = [];
        const cumulativeY = []; // NEW
        const targetY = [];
        const upperY = [];
        const lowerY = [];

        // Goal Limits Setup
        const useUpper = record[mapping.useUpperLimitField];
        const useLower = record[mapping.useLowerLimitField];
        const upperPct = record[mapping.upperLimitValueField] || 0;
        const lowerPct = record[mapping.lowerLimitValueField] || 0;

        let runningSum = 0;
        let hasStarted = false;

        allYears.forEach(year => {
            const yearResults = resultsData[year]?.results || (resultsData[year]?.jan !== undefined ? resultsData[year] : {});
            const yearTargets = progressiveTargets[year] || new Array(12).fill(0);

            // Reset running sum at start of year if consolidation is YTD? 
            // Usually SUM indicators are year-to-date, so they reset each year.
            runningSum = 0;
            hasStarted = false;

            MONTH_KEYS.forEach((m, i) => {
                const date = new Date(parseInt(year), i, 1);
                xValues.push(date);

                const resEntry = yearResults[m];
                const resVal = (resEntry && typeof resEntry === 'object') ? resEntry.v : (resEntry ?? null);
                resultY.push(resVal);

                if (resVal !== null && resVal !== undefined) {
                    runningSum += resVal;
                    hasStarted = true;
                    cumulativeY.push(runningSum);
                } else {
                    cumulativeY.push(null);
                }

                const tarVal = yearTargets[i];
                targetY.push(tarVal);

                upperY.push((useUpper && tarVal) ? tarVal * (1 + upperPct / 100) : null);
                lowerY.push((useLower && tarVal) ? tarVal * (1 - lowerPct / 100) : null);
            });
        });

        const chartMin = record[mapping.chartMinField || config.chartMinField];
        const chartMax = record[mapping.chartMaxField || config.chartMaxField];

        return { xValues, resultY, cumulativeY, consolidationType, targetY, upperY, lowerY, chartRange: (chartMin !== undefined && chartMax !== undefined) ? [chartMin, chartMax] : null };
    }

    /**
     * Helper para formatar valores numéricos usando o TableLens.
     * Tenta encontrar o esquema da coluna de resultados para saber a precisão.
     */
    async function formatMetricValue(value, tableLens, tableId, config, forceField = null) {
        if (value === null || value === undefined) return '-';
        
        // Failsafe imediato: se tableLens não existe, usa toLocaleString direto
        if (!tableLens) return value.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 });

        const mapping = config.mapping || config || {};
        const fieldToUse = forceField || mapping.resultsField || config.resultsField;
        
        let colSchema = null;
        if (tableId && fieldToUse) {
            try {
                const schema = await tableLens.getTableSchema(tableId);
                colSchema = schema[fieldToUse];
            } catch (e) {
                console.warn("GTL: Erro ao buscar schema para formatar.", e);
            }
        }

        // Se não encontrou o schema, usa um padrão numérico
        if (!colSchema) {
            colSchema = { type: 'Numeric', widgetOptions: { numDecimalPlaces: 1 } };
        }

        let formatted = tableLens.formatValue(value, colSchema);
        
        // SLEDGEHAMMER FALLBACK: se o valor formatado parece bruto (ex: 120.0000001)
        // ou se String(value) é igual ao formatted (indicando que formatValue apenas fez String(v))
        if (typeof value === 'number' && (formatted.includes('.') && formatted.split('.')[1]?.length > 4)) {
            return value.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
        }
        if (typeof value === 'number' && formatted === String(value)) {
            return value.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
        }

        return formatted;
    }

    async function renderIndicatorDetails(container, record, config, selectedYear, tableLens = null) {
        const metrics = getIndicatorMetrics(record, config, selectedYear);
        const timelineMetrics = getFullTimelineMetrics(record, config);
        const isSum = metrics.consolidationType === 'SUM';

        const consolidatedStr = await formatMetricValue(metrics.consolidatedValue, tableLens, config.tableId, config);
        const lastMonthStr = isSum ? await formatMetricValue(metrics.lastMonthValue, tableLens, config.tableId, config) : '';
        const performanceStr = (metrics.performance * 100).toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + '%';

        // Single, ultra-compact horizontal summary bar
        container.innerHTML = `
            <div class="indicator-summary-bar" style="display:flex; align-items:center; justify-content: space-around; padding:5px 10px; background:#f1f5f9; border-radius:6px; margin-bottom:8px; font-size:12px; border:1px solid #e2e8f0;">
                ${isSum ? `
                    <div class="metric-box">
                        <span class="label" style="color:#64748b; font-weight:600;">Lançamento (Último Mês):</span>
                        <b class="last-month-value" style="color:#0f172a; margin-left:4px;">${lastMonthStr}</b>
                    </div>
                ` : ''}
                <div class="metric-box">
                    <span class="label" style="color:#64748b; font-weight:600;">${isSum ? 'Soma Acumulada' : 'Valor Consolidado'} (${selectedYear}):</span>
                    <b class="consolidated-value" style="color:#0f172a; margin-left:4px;">${consolidatedStr}</b>
                </div>
                <div class="metric-box">
                    <span class="label" style="color:#64748b; font-weight:600;">${isSum ? 'Atingimento (YTD)' : 'Atingimento'}:</span>
                    <b class="performance-value" style="color:#0f172a; margin-left:4px;">${performanceStr}</b>
                </div>
                <div class="metric-box">
                    <span class="label" style="color:#64748b; font-weight:600;">Status ${isSum ? '<small style="font-weight:400;">(Acumulado)</small>' : ''}:</span>
                    <span class="status-value" style="margin-left:4px; font-size:14px;">${metrics.status}</span>
                </div>
            </div>
            <div id="plotly-chart" style="width:100%; height:calc(100vh - 160px); min-height:450px;"></div>
        `;
        if (timelineMetrics) {
            renderChart('plotly-chart', timelineMetrics, selectedYear, metrics.direction, metrics, container, tableLens, config);
        }
    }

    function createMonotoneCubicSpline(x, y) {
        const n = x.length;
        if (n < 2) return (tx) => y[0];

        const delta = new Array(n - 1);
        for (let i = 0; i < n - 1; i++) {
            delta[i] = (y[i + 1] - y[i]) / (x[i + 1] - x[i]);
        }

        const m = new Array(n);
        m[0] = delta[0];
        for (let i = 1; i < n - 1; i++) {
            if (delta[i - 1] * delta[i] <= 0) {
                m[i] = 0;
            } else {
                const hi = x[i + 1] - x[i];
                const hprev = x[i] - x[i - 1];
                const common = hi + hprev;
                m[i] = 3 * common / ((common + hi) / delta[i - 1] + (common + hprev) / delta[i]);
            }
        }
        m[n - 1] = delta[n - 2];

        return (tx) => {
            let i = 0;
            while (i < n - 2 && tx > x[i + 1]) i++;

            const h = x[i + 1] - x[i];
            const t = (tx - x[i]) / h;
            const t2 = t * t;
            const t3 = t2 * t;

            const h00 = 2 * t3 - 3 * t2 + 1;
            const h10 = t3 - 2 * t2 + t;
            const h01 = -2 * t3 + 3 * t2;
            const h11 = t3 - t2;

            return h00 * y[i] + h10 * h * m[i] + h01 * y[i + 1] + h11 * h * m[i + 1];
        };
    }

    async function renderChart(elementId, timeline, selectedYear, direction, yearlyMetrics, container, tableLens = null, config = {}) {
        const { xValues, resultY, cumulativeY, consolidationType, targetY, upperY, lowerY, chartRange } = timeline;
        const mapping = config.mapping || config || {};
        const isSum = consolidationType === 'SUM';
        const periodicity = yearlyMetrics.periodicity;
        const numPeriods = periodicity.months.length;

        // Pre-calculate targets for comparison in SUM mode
        const yearlyTargetsCache = {};
        const getYearlyTarget = (year) => {
            if (yearlyTargetsCache[year] !== undefined) return yearlyTargetsCache[year];
            const decIdx = xValues.findIndex(d => d.getFullYear() === year && d.getMonth() === 11);
            yearlyTargetsCache[year] = (decIdx !== -1) ? targetY[decIdx] : (targetY[targetY.length - 1] || 0);
            return yearlyTargetsCache[year];
        };

        const monthlyTargetsForTimeline = xValues.map((date, i) => getYearlyTarget(date.getFullYear()) / numPeriods);
        const progressiveTargetsForTimeline = xValues.map((date, i) => {
            const mTarget = monthlyTargetsForTimeline[i];
            const monthIdx = date.getMonth();
            const periodsSoFar = periodicity.months.filter(m => MONTH_KEYS.indexOf(m) <= monthIdx).length;
            return mTarget * periodsSoFar;
        });

        const traces = [];
        const shapes = [];

        // Pre-calculate formatted texts with failsafe
        const resultText = await Promise.all(resultY.map(v => formatMetricValue(v, tableLens, config.tableId, config, mapping.resultsField)));
        const cumulativeText = isSum ? await Promise.all(cumulativeY.map(v => formatMetricValue(v, tableLens, config.tableId, config, mapping.resultsField))) : [];
        const targetText = await Promise.all(targetY.map(v => formatMetricValue(v, tableLens, config.tableId, config, mapping.targetField)));
        const upperText = await Promise.all(upperY.map(v => formatMetricValue(v, tableLens, config.tableId, config, mapping.resultsField)));
        const lowerText = await Promise.all(lowerY.map(v => formatMetricValue(v, tableLens, config.tableId, config, mapping.resultsField)));

        // --- Monthly Bars (Only for SUM) ---
        if (isSum) {
            traces.push({
                x: xValues, y: resultY,
                type: 'bar', name: 'Mensal (Lançamento)',
                marker: { color: 'rgba(31, 119, 180, 0.3)', line: { color: '#1F77B4', width: 1 } },
                text: resultText,
                hovertemplate: '<b>Lançamento do Mês</b><br>Data: %{x}<br>Valor: %{text}<extra></extra>'
            });
        }

        // --- Resultado / Acumulado com Monotonic Cubic Spline ---
        const activeY = isSum ? cumulativeY : resultY;
        const activeText = isSum ? cumulativeText : resultText;
        const lineName = isSum ? 'Acumulado (YTD)' : 'Resultado';
        const lineColor = '#1F77B4';

        const segments = [];
        let currentSegment = null;
        xValues.forEach((x, i) => {
            if (activeY[i] !== null && activeY[i] !== undefined) {
                if (!currentSegment) currentSegment = { x: [], y: [] };
                currentSegment.x.push(x.getTime());
                currentSegment.y.push(activeY[i]);
            } else if (currentSegment) {
                segments.push(currentSegment);
                currentSegment = null;
            }
        });
        if (currentSegment) segments.push(currentSegment);

        segments.forEach((seg, segIdx) => {
            const spline = createMonotoneCubicSpline(seg.x, seg.y);
            const smoothX = [];
            const smoothY = [];
            const startTime = seg.x[0];
            const endTime = seg.x[seg.x.length - 1];
            const step = (30 * 24 * 60 * 60 * 1000) / 10;

            for (let t = startTime; t <= endTime; t += step) {
                smoothX.push(new Date(t));
                smoothY.push(spline(t));
            }
            smoothX.push(new Date(endTime));
            smoothY.push(seg.y[seg.y.length - 1]);

            traces.push({
                x: smoothX, y: smoothY,
                type: 'scatter', mode: 'lines',
                line: { color: lineColor, width: isSum ? 4 : 2, shape: 'linear' },
                showlegend: segIdx === 0, name: lineName,
                hoverinfo: 'skip'
            });
        });

        traces.push({
            x: xValues, y: activeY,
            type: 'scatter', mode: 'markers',
            marker: { size: isSum ? 8 : 6, color: lineColor },
            showlegend: false, name: lineName + ' (Pontos)',
            text: activeText,
            hovertemplate: `<b>${lineName}</b><br>Data: %{x}<br>Valor: %{text}<extra></extra>`
        });

        // --- Meta e Limites ---
        traces.push({
            x: xValues, y: targetY,
            type: 'scatter', mode: 'lines', name: isSum ? 'Meta Anual' : 'Meta',
            line: { color: '#ff7f0e', width: 2, dash: 'solid' },
            text: targetText,
            hovertemplate: '<b>%{name}</b><br>Data: %{x}<br>Valor: %{text}<extra></extra>'
        });

        const limitOpacity = isSum ? 0.4 : 1.0;
        const limitWidth = isSum ? 1 : 1;

        if (upperY.some(v => v !== null)) {
            traces.push({
                x: xValues, y: upperY,
                type: 'scatter', mode: 'lines', name: 'Lim. Sup.',
                line: { color: `rgba(148, 103, 189, ${limitOpacity})`, dash: 'dot', width: limitWidth },
                text: upperText,
                hovertemplate: '<b>%{name}</b><br>Data: %{x}<br>Valor: %{text}<extra></extra>'
            });
        }

        if (lowerY.some(v => v !== null)) {
            traces.push({
                x: xValues, y: lowerY,
                type: 'scatter', mode: 'lines', name: 'Lim. Inf.',
                line: { color: `rgba(214, 39, 40, ${limitOpacity})`, dash: 'dot', width: limitWidth },
                text: lowerText,
                hovertemplate: '<b>%{name}</b><br>Data: %{x}<br>Valor: %{text}<extra></extra>'
            });
        }

        traces.push({
            x: xValues, y: targetY,
            type: 'scatter', mode: 'lines', name: 'Lim. Méd.',
            line: { color: '#2ca02c', dash: 'dot', width: 1 },
            xaxis: 'x', yaxis: 'y',
            text: targetText,
            hovertemplate: '<b>%{name}</b><br>Data: %{x}<br>Valor: %{text}<extra></extra>'
        });

        const tableY = { res: 0.35, meta: 0.65 };

        xValues.forEach((date, i) => {
            const val = resultY[i];
            const tar = isSum ? monthlyTargetsForTimeline[i] : targetY[i];
            if (val !== null && val !== undefined) {
                const perf = calculatePerformance(val, tar, direction);
                const status = getStatusEmoji(perf);
                let color = '#eee';
                let textColor = '#fff';
                switch(status) {
                    case '🔵': color = '#007bff'; break;
                    case '🔴': color = '#dc3545'; break;
                    case '🟠': color = '#fd7e14'; break;
                    case '🟡': color = '#ffc107'; textColor = '#000'; break;
                    case '🟢': color = '#28a745'; break;
                    case '🟩': color = '#198754'; break;
                }
                
                const halfWidth = 14 * 24 * 60 * 60 * 1000;
                shapes.push({
                    type: 'rect',
                    xref: 'x', yref: 'y2',
                    x0: date.getTime() - halfWidth,
                    x1: date.getTime() + halfWidth,
                    y0: tableY.res - 0.25,
                    y1: tableY.res + 0.25,
                    fillcolor: color,
                    line: { width: 0 },
                    layer: 'below'
                });

                // Keep ONLY result text in the status bar area to avoid overlaps
                traces.push({
                    x: [date], y: [tableY.res],
                    type: 'scatter', mode: 'text',
                    text: [resultText[i]],
                    textfont: { color: textColor, weight: 'bold', size: 10 },
                    xaxis: 'x', yaxis: 'y2', showlegend: false, hoverinfo: 'none'
                });
            } else {
                traces.push({
                    x: [date], y: [tableY.res],
                    type: 'scatter', mode: 'text', text: ['-'],
                    xaxis: 'x', yaxis: 'y2', showlegend: false, hoverinfo: 'none'
                });
            }
            
            // REMOVED redundant meta text label from status bar area to stop overlapping
        });

        shapes.push({
            type: 'rect',
            xref: 'paper', yref: 'paper',
            x0: 0, x1: 1,
            y0: 0, y1: 0.1,
            line: { color: '#707070', width: 1 },
            layer: 'above'
        });

        const isMobile = window.innerWidth < 600;

        const layout = {
            grid: { rows: 2, columns: 1, pattern: 'independent' },
            margin: { t: 40, b: 40, l: 50, r: isMobile ? 30 : 100 },
            showlegend: !isMobile,
            legend: { x: 1.02, y: 1, font: { size: 10 } },
            barmode: 'group',
            bargap: isMobile ? 0.4 : 0.2,
            xaxis: {
                type: 'date',
                rangeslider: { 
                    visible: true, 
                    thickness: 0.05,
                    yaxis: {
                        rangemode: 'match',
                        showticklabels: false,
                        ticks: ''
                    }
                },
                rangeselector: {
                    buttons: [
                        { count: 12, label: '1 ano', step: 'month', stepmode: 'backward' },
                        { count: 5, label: '5 anos', step: 'year', stepmode: 'backward' },
                        { label: 'Reset', step: 'all' }
                    ],
                    x: 0, y: 1.05, bgcolor: '#D5E3E9', activecolor: '#9CC2D1', bordercolor: '#ABB1B4', borderwidth: 1
                },
                gridcolor: '#F0F0F0', showgrid: true, layer: 'below traces'
            },
            yaxis: { 
                domain: [0.14, 1], 
                range: chartRange, 
                autorange: chartRange ? false : true, 
                gridcolor: '#F0F0F0', 
                nticks: 10, 
                tickmode: 'auto',
                title: '',
                tickformat: '.1f',
                hoverformat: '.1f'
            },
            yaxis2: { 
                domain: [0, 0.12], 
                range: [-0.2, 1.2], 
                autorange: false, 
                showgrid: false, 
                zeroline: false, 
                showline: false, 
                showticklabels: false, 
                ticks: '',
                side: 'right', 
                fixedrange: true 
            },
            plot_bgcolor: '#FFFFFF', paper_bgcolor: '#EBEFEF', shapes: shapes
        };

        const chartEl = document.getElementById(elementId);
        Plotly.newPlot(chartEl, traces, layout, { responsive: true, displayModeBar: true });
        
        chartEl.on('plotly_hover', async (data) => {
            const pt = data.points[0];
            const xDate = new Date(pt.x);
            const monthIdx = xValues.findIndex(d => d.getFullYear() === xDate.getFullYear() && d.getMonth() === xDate.getMonth());

            if (monthIdx !== -1) {
                const valMonthly = resultY[monthIdx];
                const valCumulative = cumulativeY[monthIdx];
                const year = xValues[monthIdx].getFullYear();
                const yTarget = getYearlyTarget(year);
                
                const tar = isSum ? yTarget : targetY[monthIdx];
                const perf = calculatePerformance(isSum ? valCumulative : valMonthly, tar, direction);
                const status = getStatusEmoji(perf);
                const monthName = MONTH_KEYS[monthIdx % 12].toUpperCase();

                const consolidatedTextVal = isSum ? cumulativeText[monthIdx] : resultText[monthIdx];
                container.querySelector('.consolidated-value').textContent = consolidatedTextVal;
                
                if (isSum) {
                    const lastMonthEl = container.querySelector('.last-month-value');
                    if (lastMonthEl) lastMonthEl.textContent = resultText[monthIdx];
                    container.querySelector('.metric-box:nth-child(2) .label').textContent = `Soma Acumulada (${monthName}/${year})`;
                } else {
                    container.querySelector('.metric-box:nth-child(1) .label').textContent = `Valor (${monthName}/${year})`;
                }

                container.querySelector('.performance-value').textContent = (perf * 100).toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + '%';
                container.querySelector('.status-value').textContent = (isSum ? valCumulative : valMonthly) !== null ? status : '';
            }
        });

        chartEl.on('plotly_unhover', async () => {
            container.querySelector('.consolidated-value').textContent = await formatMetricValue(yearlyMetrics.consolidatedValue, tableLens, config.tableId, config, mapping.resultsField);
            if (isSum) {
                const lastMonthEl = container.querySelector('.last-month-value');
                if (lastMonthEl) lastMonthEl.textContent = await formatMetricValue(yearlyMetrics.lastMonthValue, tableLens, config.tableId, config, mapping.resultsField);
                container.querySelector('.metric-box:nth-child(2) .label').textContent = `Soma Acumulada (${selectedYear})`;
            } else {
                container.querySelector('.metric-box:nth-child(1) .label').textContent = `Valor Consolidado (${selectedYear})`;
            }
            container.querySelector('.performance-value').textContent = (yearlyMetrics.performance * 100).toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + '%';
            container.querySelector('.status-value').textContent = yearlyMetrics.status;
        });

        const start = new Date(parseInt(selectedYear), 0, 1);
        const end = new Date(parseInt(selectedYear), 11, 31);
        Plotly.relayout(chartEl, { 'xaxis.range': [start.getTime(), end.getTime()] });
    }

    function getYearlySummary(record, config, years) {
        const summaries = {};
        years.forEach(year => {
            summaries[year] = getIndicatorMetrics(record, config, year.toString());
        });
        return summaries;
    }

    function _renderProgressChip(value, target, direction, tableLens, tableId, config) {
        if (value === null || value === undefined) return '<div class="progress-chip empty">-</div>';
        
        const perf = calculatePerformance(value, target, direction);
        const status = getStatusEmoji(perf);
        
        let color = '#94a3b8'; // Slate 400
        switch(status) {
            case '🔵': color = '#3b82f6'; break; // Blue 500
            case '🔴': color = '#ef4444'; break; // Red 500
            case '🟠': color = '#f97316'; break; // Orange 500
            case '🟡': color = '#eab308'; break; // Yellow 500
            case '🟢': color = '#22c55e'; break; // Green 500
            case '🟩': color = '#16a34a'; break; // Green 600
        }

        const fillWidth = Math.min(100, perf * 100);
        const markerPos = perf > 1 ? (1 / perf) * 100 : 100;
        
        const formattedVal = value.toLocaleString('pt-BR', { maximumFractionDigits: 1 });
        const formattedTarget = target.toLocaleString('pt-BR', { maximumFractionDigits: 1 });
        const formattedPercent = (perf * 100).toLocaleString('pt-BR', { maximumFractionDigits: 1 }) + '%';

        return `
            <div class="progress-chip" title="Meta: ${formattedTarget}">
                <div class="progress-bar-fill" style="width: ${fillWidth}%; background-color: ${color};"></div>
                ${perf > 1 ? `<div class="progress-marker-100" style="left: ${markerPos}%;"></div>` : ''}
                <div class="chip-labels">
                    <span class="label-values">${formattedVal} / ${formattedTarget}</span>
                    <span class="label-percent">${formattedPercent}</span>
                </div>
            </div>
        `;
    }

    async function renderIndicatorRow(container, record, config, currentYear, styling = {}, receivedConfigs = [], tableLens = null) {
        const yearsCount = styling.yearsCount !== undefined ? styling.yearsCount : 3;
        const previousYears = Array.from({ length: yearsCount }, (_, i) => (parseInt(currentYear) - (i + 1)).toString()).reverse();
        const metrics = getIndicatorMetrics(record, config, currentYear);
        const yearlySummaries = getYearlySummary(record, config, previousYears);
        const isSum = metrics.consolidationType === 'SUM';
        
        const row = document.createElement('div');
        row.className = `indicator-row ${isSum ? 'is-cumulative' : ''}`;
        row.dataset.recordId = record.id;

        const cardContainer = document.createElement('div');
        cardContainer.className = 'indicator-card-container sticky-col-left';
        
        if (styling.cardType === 'CUSTOM' && styling.cardConfigId) {
            // ... (keep existing custom card logic)
            const customConfigRecord = receivedConfigs.find(c => c.configId === styling.cardConfigId);
            if (customConfigRecord && tableLens) {
                const customOptions = tableLens.parseConfigRecord(customConfigRecord);
                const tableSchema = await tableLens.getTableSchema(config.tableId);
                await CardSystem.renderCards(cardContainer, [record], { ...customOptions, tableLens, tableId: config.tableId }, tableSchema);
            } else {
                cardContainer.innerHTML = `<div class="error-msg">Config "${styling.cardConfigId}" não encontrada</div>`;
            }
        } else {
            const card = document.createElement('div');
            card.className = 'indicator-card';
            const iconHtml = record.Icone ? `<span class="indicator-icon">${record.Icone}</span>` : '';
            const sumBadge = isSum ? '<span class="sum-badge">ACUMULADO</span>' : '';
            
            card.innerHTML = `
                <div class="card-content">
                    <div class="card-top">
                        ${iconHtml}
                        <span class="indicator-name" title="${record.Nome || ''}">${record.Nome || 'Sem Nome'}</span>
                        ${sumBadge}
                    </div>
                    <div class="card-bottom">
                        <span class="indicator-status-emoji">${metrics.status}</span>
                        <div class="performance-info">
                            <span class="indicator-performance">${(metrics.performance * 100).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}% ${isSum ? '<small>acumulado</small>' : ''}</span>
                            <span class="indicator-consolidated">${isSum ? 'Acumulado: ' : ''}${await formatMetricValue(metrics.consolidatedValue, tableLens, config.tableId, config)}</span>
                        </div>
                    </div>
                </div>
                <div class="card-actions">
                    <button class="action-btn view-chart" title="Visualizar Gráfico">📊</button>
                    <button class="action-btn edit-data" title="Editar Dados">✏️</button>
                </div>
            `;
            cardContainer.appendChild(card);
        }

        // --- TOOLTIP HOVER EVENTS ---
        cardContainer.addEventListener('mouseenter', (e) => showTooltip(e, record, metrics));
        cardContainer.addEventListener('mouseleave', hideTooltip);
        cardContainer.addEventListener('mousemove', (e) => {
            if (tooltipEl && tooltipEl.style.display === 'flex') {
                // Optional: follow mouse slightly or just stay centered
            }
        });

        const monthsWrapper = document.createElement('div');
        monthsWrapper.className = 'months-wrapper scrollable-area';
        const timeline = document.createElement('div');
        timeline.className = 'indicator-timeline months-grid';

        // Get targets
        const targetLine = metrics.targetLine;
        const periodicity = metrics.periodicity;
        const lastMonthIdx = MONTH_KEYS.indexOf(periodicity.months[periodicity.months.length - 1]);
        const yearlyTarget = targetLine[lastMonthIdx] || 0;

        for (let i = 0; i < 12; i++) {
            const m = MONTH_KEYS[i];
            const monthlyVal = metrics.monthlyValues[i];
            const cumulativeVal = metrics.cumulativeResults[i];
            
            const monthCell = document.createElement('div');
            monthCell.className = 'timeline-cell month-cell';
            
            let chipsHtml = '';
            if (isSum) {
                const specificMonthlyTarget = metrics.specificMonthlyTargets[i];
                const cumulativeTarget = targetLine[i]; // FIXED: Use monthly cumulative target instead of yearly
                chipsHtml = `
                    <div class="dual-chip-container">
                        ${_renderProgressChip(monthlyVal, specificMonthlyTarget, metrics.direction, tableLens, config.tableId, config)}
                        ${_renderProgressChip(cumulativeVal, cumulativeTarget, metrics.direction, tableLens, config.tableId, config)}
                    </div>
                `;
            } else {
                const monthlyTarget = targetLine[i];
                chipsHtml = _renderProgressChip(monthlyVal, monthlyTarget, metrics.direction, tableLens, config.tableId, config);
            }

            monthCell.innerHTML = `<div class="month-cell-inner">${chipsHtml}</div>`;
            timeline.appendChild(monthCell);
        }
        monthsWrapper.appendChild(timeline);

        const yearsContainer = document.createElement('div');
        yearsContainer.className = 'years-container sticky-col-right';
        for (const year of previousYears) {
            const summary = yearlySummaries[year];
            let color = '#eee', textColor = '#666';
            if (summary.consolidatedValue !== 0) {
                const status = summary.status;
                textColor = '#fff';
                switch(status) {
                    case '🔵': color = '#007bff'; break;
                    case '🔴': color = '#dc3545'; break;
                    case '🟠': color = '#fd7e14'; break;
                    case '🟡': color = '#ffc107'; textColor = '#000'; break;
                    case '🟢': color = '#28a745'; break;
                    case '🟩': color = '#198754'; break;
                }
            }
            const yearCell = document.createElement('div');
            yearCell.className = 'timeline-cell year-cell';
            yearCell.innerHTML = `<div class="status-pill" style="background-color: ${color}; color: ${textColor};">${await formatMetricValue(summary.consolidatedValue, tableLens, config.tableId, config)}</div>`;
            yearsContainer.appendChild(yearCell);
        }

        row.appendChild(cardContainer);
        row.appendChild(monthsWrapper);
        row.appendChild(yearsContainer);
        container.appendChild(row);
        return row;
    }

    return { renderIndicatorDetails, renderIndicatorRow, getIndicatorMetrics, calculateProgressiveTargets, PERIODICITY_CONFIG };

})();
window.IndicatorsRenderer = IndicatorsRenderer;
