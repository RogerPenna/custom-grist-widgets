// libraries/grist-indicators-renderer/IndicatorsRenderer.js

export const IndicatorsRenderer = (() => {

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
        
        const lastMonthIdx = MONTH_KEYS.indexOf(periodicity.months[periodicity.months.length - 1]);
        const targetForPerformance = targetLine[lastMonthIdx] || 0;

        const performance = calculatePerformance(consolidatedValue, targetForPerformance, direction);
        const status = getStatusEmoji(performance);

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
            targetsJson: targetsData[selectedYear] || {},
            targetLine,
            upperLimitLine,
            lowerLimitLine,
            periodicity,
            direction,
            chartRange: (chartMin !== undefined && chartMax !== undefined) ? [chartMin, chartMax] : null
        };
    }

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

        const xValues = [];
        const resultY = [];
        const targetY = [];
        const upperY = [];
        const lowerY = [];

        // Goal Limits Setup
        const useUpper = record[mapping.useUpperLimitField];
        const useLower = record[mapping.useLowerLimitField];
        const upperPct = record[mapping.upperLimitValueField] || 0;
        const lowerPct = record[mapping.lowerLimitValueField] || 0;

        allYears.forEach(year => {
            const yearResults = resultsData[year]?.results || (resultsData[year]?.jan !== undefined ? resultsData[year] : {});
            const yearTargets = progressiveTargets[year] || new Array(12).fill(0);

            MONTH_KEYS.forEach((m, i) => {
                const date = new Date(parseInt(year), i, 1);
                xValues.push(date);

                const resEntry = yearResults[m];
                const resVal = (resEntry && typeof resEntry === 'object') ? resEntry.v : (resEntry ?? null);
                resultY.push(resVal);

                const tarVal = yearTargets[i];
                targetY.push(tarVal);

                upperY.push((useUpper && tarVal) ? tarVal * (1 + upperPct / 100) : null);
                lowerY.push((useLower && tarVal) ? tarVal * (1 - lowerPct / 100) : null);
            });
        });

        const chartMin = record[mapping.chartMinField || config.chartMinField];
        const chartMax = record[mapping.chartMaxField || config.chartMaxField];

        return { xValues, resultY, targetY, upperY, lowerY, chartRange: (chartMin !== undefined && chartMax !== undefined) ? [chartMin, chartMax] : null };
    }

    async function renderIndicatorDetails(container, record, config, selectedYear) {
        const metrics = getIndicatorMetrics(record, config, selectedYear);
        const timelineMetrics = getFullTimelineMetrics(record, config);

        container.innerHTML = `
            <div class="indicator-header">
                <h3>${record.Nome || 'Indicador'}</h3>
                <div class="metrics-summary">
                    <div class="metric-box">
                        <span class="label">Valor Consolidado (${selectedYear})</span>
                        <span class="value consolidated-value">${metrics.consolidatedValue.toLocaleString()}</span>
                    </div>
                    <div class="metric-box">
                        <span class="label">Atingimento</span>
                        <span class="value performance-value">${(metrics.performance * 100).toFixed(1)}%</span>
                    </div>
                    <div class="metric-box">
                        <span class="label">Status</span>
                        <span class="value status-value status-icon">${metrics.status}</span>
                    </div>
                </div>
            </div>
            <div id="plotly-chart" style="width:100%;height:600px;"></div>
        `;

        if (timelineMetrics) {
            renderChart('plotly-chart', timelineMetrics, selectedYear, metrics.direction, metrics, container);
        }
    }

    // --- Monotonic Cubic Spline Interpolation Engine ---
    function createMonotoneCubicSpline(x, y) {
        const n = x.length;
        if (n < 2) return (tx) => y[0];

        // 1. Compute slopes between points
        const delta = new Array(n - 1);
        for (let i = 0; i < n - 1; i++) {
            delta[i] = (y[i + 1] - y[i]) / (x[i + 1] - x[i]);
        }

        // 2. Compute tangents (tangentes nos pontos)
        const m = new Array(n);
        m[0] = delta[0];
        for (let i = 1; i < n - 1; i++) {
            if (delta[i - 1] * delta[i] <= 0) {
                m[i] = 0; // Platô ou pico/vale -> inclinação zero
            } else {
                // Média ponderada para suavidade (Fritsch-Butland)
                const hi = x[i + 1] - x[i];
                const hprev = x[i] - x[i - 1];
                const common = hi + hprev;
                m[i] = 3 * common / ((common + hi) / delta[i - 1] + (common + hprev) / delta[i]);
            }
        }
        m[n - 1] = delta[n - 2];

        // 3. Interpolation function (Hermite Cubic)
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

    function renderChart(elementId, timeline, selectedYear, direction, yearlyMetrics, container) {
        const { xValues, resultY, targetY, upperY, lowerY, chartRange } = timeline;
        
        const traces = [];

        // --- Resultado com Monotonic Cubic Spline ---
        // 1. Separamos os dados em segmentos contínuos (sem nulls)
        const segments = [];
        let currentSegment = null;
        xValues.forEach((x, i) => {
            if (resultY[i] !== null && resultY[i] !== undefined) {
                if (!currentSegment) currentSegment = { x: [], y: [] };
                currentSegment.x.push(x.getTime());
                currentSegment.y.push(resultY[i]);
            } else if (currentSegment) {
                segments.push(currentSegment);
                currentSegment = null;
            }
        });
        if (currentSegment) segments.push(currentSegment);

        // 2. Para cada segmento, geramos a curva suave de alta densidade
        segments.forEach((seg, segIdx) => {
            const spline = createMonotoneCubicSpline(seg.x, seg.y);
            const smoothX = [];
            const smoothY = [];
            
            // Geramos ~10 pontos entre cada mês para suavidade total
            const startTime = seg.x[0];
            const endTime = seg.x[seg.x.length - 1];
            const step = (30 * 24 * 60 * 60 * 1000) / 10; // ~3 dias por ponto

            for (let t = startTime; t <= endTime; t += step) {
                smoothX.push(new Date(t));
                smoothY.push(spline(t));
            }
            // Garantimos o último ponto exato
            smoothX.push(new Date(endTime));
            smoothY.push(seg.y[seg.y.length - 1]);

            traces.push({
                x: smoothX, y: smoothY,
                type: 'scatter', mode: 'lines',
                line: { color: '#1F77B4', width: 2, shape: 'linear' },
                showlegend: segIdx === 0, name: 'Resultado',
                hoverinfo: 'skip'
            });
        });

        // 3. Adicionamos apenas os marcadores (bolinhas) nos pontos mensais reais
        traces.push({
            x: xValues, y: resultY,
            type: 'scatter', mode: 'markers',
            marker: { size: 6, color: '#1F77B4' },
            showlegend: false, name: 'Pontos Reais',
            hoverinfo: 'x+y'
        });

        // --- Meta e Limites ---
        traces.push({
            x: xValues, y: targetY,
            type: 'scatter', mode: 'lines', name: 'Meta',
            line: { color: '#ff7f0e', width: 1, dash: 'dot' },
            xaxis: 'x', yaxis: 'y1'
        });

        if (upperY.some(v => v !== null)) {
            traces.push({
                x: xValues, y: upperY,
                type: 'scatter', mode: 'lines', name: 'Lim. Sup.',
                line: { color: '#9467bd', dash: 'dot', width: 1 },
                xaxis: 'x', yaxis: 'y1'
            });
        }

        if (lowerY.some(v => v !== null)) {
            traces.push({
                x: xValues, y: lowerY,
                type: 'scatter', mode: 'lines', name: 'Lim. Inf.',
                line: { color: '#d62728', dash: 'dot', width: 1 },
                xaxis: 'x', yaxis: 'y1'
            });
        }

        traces.push({
            x: xValues, y: targetY,
            type: 'scatter', mode: 'lines', name: 'Lim. Méd.',
            line: { color: '#2ca02c', dash: 'dot', width: 1 },
            xaxis: 'x', yaxis: 'y1'
        });

        // --- Configuração da Tabela e Layout ---
        const tableY = { res: 0, meta: 1 };

        // Text traces for the table cells
        const resultText = resultY.map(v => v !== null ? v.toLocaleString() : '-');
        const targetText = targetY.map(v => v.toLocaleString(undefined, {maximumFractionDigits: 1}));

        // Table background "cells" as colored scatter markers
        // Results with vibrant colors
        xValues.forEach((date, i) => {
            const val = resultY[i];
            const tar = targetY[i];
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
                traces.push({
                    x: [date], y: [tableY.res],
                    type: 'scatter', mode: 'markers+text',
                    text: [resultText[i]],
                    textposition: 'middle center',
                    textfont: { color: textColor, weight: 'bold', size: 10 },
                    marker: { symbol: 'square', size: 35, color: color },
                    xaxis: 'x', yaxis: 'y2', showlegend: false, hoverinfo: 'none'
                });
            } else {
                traces.push({
                    x: [date], y: [tableY.res],
                    type: 'scatter', mode: 'text', text: ['-'],
                    xaxis: 'x', yaxis: 'y2', showlegend: false, hoverinfo: 'none'
                });
            }
            
            // Meta Row
            traces.push({
                x: [date], y: [tableY.meta],
                type: 'scatter', mode: 'text', text: [targetText[i]],
                textfont: { color: '#000', weight: 'bold', size: 10 },
                xaxis: 'x', yaxis: 'y2', showlegend: false, hoverinfo: 'none'
            });
        });

        const layout = {
            grid: { rows: 2, columns: 1, pattern: 'independent' },
            margin: { t: 40, b: 60, l: 100, r: 150 },
            showlegend: true,
            legend: { x: 1.05, y: 1 },
            xaxis: {
                type: 'date',
                rangeslider: { visible: true, thickness: 0.05 },
                rangeselector: {
                    buttons: [
                        { count: 12, label: '1 ano', step: 'month', stepmode: 'backward' },
                        { count: 5, label: '5 anos', step: 'year', stepmode: 'backward' },
                        { label: 'Reset', step: 'all' }
                    ],
                    x: 0, y: 1.1,
                    bgcolor: '#D5E3E9',
                    activecolor: '#9CC2D1',
                    bordercolor: '#ABB1B4',
                    borderwidth: 1
                },
                gridcolor: '#F0F0F0',
                nticks: 20
            },
            yaxis: {
                domain: [0.3, 1],
                range: chartRange,
                autorange: chartRange ? false : true,
                gridcolor: '#F0F0F0',
                nticks: 20,
                title: 'Valores'
            },
            yaxis2: {
                domain: [0, 0.25],
                range: [-0.5, 1.5], // For Res and Meta rows
                autorange: false,
                showgrid: false,
                zeroline: false,
                showline: false,
                tickvals: [0, 1],
                ticktext: ['RESULTADO', 'META'],
                fixedrange: true
            },
            plot_bgcolor: '#FFFFFF',
            paper_bgcolor: '#EBEFEF'
        };

        const chartEl = document.getElementById(elementId);
        Plotly.newPlot(chartEl, traces, layout, { responsive: true, displayModeBar: true });
        
        // --- Interactivity: Hover Sync ---
        chartEl.on('plotly_hover', (data) => {
            const pt = data.points[0];
            const xDate = new Date(pt.x);
            // Find closest month in xValues
            const monthIdx = xValues.findIndex(d => 
                d.getFullYear() === xDate.getFullYear() && d.getMonth() === xDate.getMonth()
            );

            if (monthIdx !== -1) {
                const val = resultY[monthIdx];
                const tar = targetY[monthIdx];
                const perf = calculatePerformance(val, tar, direction);
                const status = getStatusEmoji(perf);
                const monthName = MONTH_KEYS[monthIdx % 12].toUpperCase();
                const year = xValues[monthIdx].getFullYear();

                container.querySelector('.consolidated-value').textContent = val !== null ? val.toLocaleString() : '-';
                container.querySelector('.performance-value').textContent = val !== null ? (perf * 100).toFixed(1) + '%' : '-';
                container.querySelector('.status-value').textContent = val !== null ? status : '';
                container.querySelector('.metric-box:nth-child(1) .label').textContent = `Valor (${monthName}/${year})`;
            }
        });

        chartEl.on('plotly_unhover', () => {
            container.querySelector('.consolidated-value').textContent = yearlyMetrics.consolidatedValue.toLocaleString();
            container.querySelector('.performance-value').textContent = (yearlyMetrics.performance * 100).toFixed(1) + '%';
            container.querySelector('.status-value').textContent = yearlyMetrics.status;
            container.querySelector('.metric-box:nth-child(1) .label').textContent = `Valor Consolidado (${selectedYear})`;
        });

        const start = new Date(parseInt(selectedYear), 0, 1);
        const end = new Date(parseInt(selectedYear), 11, 31);
        Plotly.relayout(chartEl, { 'xaxis.range': [start.getTime(), end.getTime()] });
    }

    return {
        renderIndicatorDetails,
        getIndicatorMetrics,
        calculateProgressiveTargets,
        PERIODICITY_CONFIG
    };

})();
