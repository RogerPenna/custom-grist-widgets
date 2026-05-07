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
        const { results, targetLine, upperLimitLine, lowerLimitLine, periodicity, direction } = metrics;

        const hasUpper = upperLimitLine.some(v => v !== null);
        const hasLower = lowerLimitLine.some(v => v !== null);

        container.innerHTML = `
            <div class="indicator-header">
                <h3>${record.Nome || 'Indicador'}</h3>
                <div class="metrics-summary">
                    <div class="metric-box">
                        <span class="label">Valor Consolidado (${selectedYear})</span>
                        <span class="value">${metrics.consolidatedValue.toLocaleString()}</span>
                    </div>
                    <div class="metric-box">
                        <span class="label">Atingimento</span>
                        <span class="value">${(metrics.performance * 100).toFixed(1)}%</span>
                    </div>
                    <div class="metric-box">
                        <span class="label">Status</span>
                        <span class="value status-icon">${metrics.status}</span>
                    </div>
                </div>
            </div>
            <div id="plotly-chart" style="width:100%;height:400px;"></div>
            <div class="data-table-container">
                <table class="indicator-data-table horizontal-table">
                    <thead>
                        <tr>
                            <th>TIPO</th>
                            ${periodicity.months.map(m => `<th>${m.toUpperCase()}</th>`).join('')}
                        </tr>
                    </thead>
                    <tbody>
                        ${hasUpper ? `
                        <tr>
                            <td class="row-label">LIM. SUP</td>
                            ${periodicity.months.map(m => {
                                const val = upperLimitLine[MONTH_KEYS.indexOf(m)];
                                return `<td>${val !== null ? val.toLocaleString(undefined, {maximumFractionDigits: 1}) : '-'}</td>`;
                            }).join('')}
                        </tr>` : ''}
                        <tr>
                            <td class="row-label">META</td>
                            ${periodicity.months.map(m => {
                                const val = targetLine[MONTH_KEYS.indexOf(m)];
                                return `<td style="font-weight:bold">${val.toLocaleString(undefined, {maximumFractionDigits: 1})}</td>`;
                            }).join('')}
                        </tr>
                        ${hasLower ? `
                        <tr>
                            <td class="row-label">LIM. INF</td>
                            ${periodicity.months.map(m => {
                                const val = lowerLimitLine[MONTH_KEYS.indexOf(m)];
                                return `<td>${val !== null ? val.toLocaleString(undefined, {maximumFractionDigits: 1}) : '-'}</td>`;
                            }).join('')}
                        </tr>` : ''}
                        <tr>
                            <td class="row-label">RESULTADO</td>
                            ${periodicity.months.map(m => {
                                const monthIdx = MONTH_KEYS.indexOf(m);
                                const entry = results[m];
                                const val = (entry && typeof entry === 'object') ? entry.v : entry;
                                
                                let color = "transparent";
                                let textColor = "inherit";
                                if (val !== null && val !== undefined) {
                                    const perf = calculatePerformance(val, targetLine[monthIdx], direction);
                                    const status = getStatusEmoji(perf);
                                    textColor = "#fff";
                                    switch(status) {
                                        case '🔵': color = '#007bff'; break;
                                        case '🔴': color = '#dc3545'; break;
                                        case '🟠': color = '#fd7e14'; break;
                                        case '🟡': color = '#ffc107'; textColor = "#000"; break;
                                        case '🟢': color = '#28a745'; break;
                                        case '🟩': color = '#198754'; break;
                                    }
                                }
                                return `<td style="background-color: ${color}; color: ${textColor}; font-weight: bold;">${val !== null && val !== undefined ? val.toLocaleString() : '-'}</td>`;
                            }).join('')}
                        </tr>
                    </tbody>
                </table>
            </div>
        `;

        if (timelineMetrics) {
            renderChart('plotly-chart', timelineMetrics, selectedYear);
        }
    }

    function renderChart(elementId, timeline, selectedYear) {
        const { xValues, resultY, targetY, upperY, lowerY, chartRange } = timeline;
        
        const traces = [];

        // Resultado - Azul Sólido com Suavização Spline
        traces.push({
            x: xValues, y: resultY,
            type: 'scatter', mode: 'lines+markers', name: 'Resultado',
            line: { color: '#1f77b4', width: 2, shape: 'spline', smoothing: 0.8 },
            marker: { size: 6 }
        });

        // Meta - Laranja Sólido
        traces.push({
            x: xValues, y: targetY,
            type: 'scatter', mode: 'lines', name: 'Meta',
            line: { color: '#ff7f0e', width: 2 }
        });

        // Limite Superior - Roxo Pontilhado
        if (upperY.some(v => v !== null)) {
            traces.push({
                x: xValues, y: upperY,
                type: 'scatter', mode: 'lines', name: 'Lim. Sup.',
                line: { color: '#9467bd', dash: 'dot', width: 1.5 }
            });
        }

        // Limite Inferior - Vermelho Pontilhado
        if (lowerY.some(v => v !== null)) {
            traces.push({
                x: xValues, y: lowerY,
                type: 'scatter', mode: 'lines', name: 'Lim. Inf.',
                line: { color: '#d62728', dash: 'dot', width: 1.5 }
            });
        }

        // Limite Médio / Meta Interpolada - Verde Pontilhado
        traces.push({
            x: xValues, y: targetY,
            type: 'scatter', mode: 'lines', name: 'Lim. Méd.',
            line: { color: '#2ca02c', dash: 'dot', width: 1.5 },
            showlegend: true
        });

        const layout = {
            margin: { t: 40, b: 60, l: 60, r: 150 },
            showlegend: true,
            legend: { 
                x: 1.05, y: 1,
                font: { size: 10 },
                bgcolor: 'rgba(255,255,255,0.5)',
                bordercolor: '#eee',
                borderwidth: 1
            },
            xaxis: {
                type: 'date',
                rangeslider: { visible: true, thickness: 0.1 },
                rangeselector: {
                    buttons: [
                        { count: 12, label: '1 ano', step: 'month', stepmode: 'backward' },
                        { count: 5, label: '5 anos', step: 'year', stepmode: 'backward' },
                        { label: 'Reset', step: 'all' }
                    ],
                    x: 0, y: 1.1,
                    font: { size: 11 },
                    bgcolor: '#f8f9fa'
                }
            },
            yaxis: {
                range: chartRange,
                autorange: chartRange ? false : true,
                gridcolor: '#f0f0f0'
            },
            plot_bgcolor: '#fff',
            paper_bgcolor: '#fff'
        };

        Plotly.newPlot(elementId, traces, layout, { responsive: true, displayModeBar: true });
        
        const start = new Date(parseInt(selectedYear), 0, 1);
        const end = new Date(parseInt(selectedYear), 11, 31);
        Plotly.relayout(elementId, { 'xaxis.range': [start.getTime(), end.getTime()] });
    }

    return {
        renderIndicatorDetails,
        getIndicatorMetrics,
        calculateProgressiveTargets,
        PERIODICITY_CONFIG
    };

})();
