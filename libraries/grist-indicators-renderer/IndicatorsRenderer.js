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

        return {
            consolidatedValue,
            performance,
            status,
            results,
            targetsJson: targetsData[selectedYear] || {},
            targetLine,
            periodicity,
            direction,
            chartRange: (chartMin !== undefined && chartMax !== undefined) ? [chartMin, chartMax] : null
        };
    }

    async function renderIndicatorDetails(container, record, config, selectedYear) {
        const metrics = getIndicatorMetrics(record, config, selectedYear);
        const { results, targetLine, periodicity, direction } = metrics;

        container.innerHTML = `
            <div class="indicator-header">
                <h3>${record.Nome || 'Indicador'} (${selectedYear})</h3>
                <div class="metrics-summary">
                    <div class="metric-box">
                        <span class="label">Valor Consolidado</span>
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
            <div id="plotly-chart" style="width:100%;height:300px;"></div>
            <div class="data-table-container">
                <table class="indicator-data-table">
                    <thead>
                        <tr>${periodicity.months.map(m => `<th>${m.toUpperCase()}</th>`).join('')}</tr>
                    </thead>
                    <tbody>
                        <tr>
                            ${periodicity.months.map(m => {
                                const entry = results[m];
                                const val = (entry && typeof entry === 'object') ? entry.v : entry;
                                if (val === null || val === undefined) return '<td>-</td>';
                                
                                const monthIdx = MONTH_KEYS.indexOf(m);
                                const monthTarget = targetLine[monthIdx];
                                
                                const perf = calculatePerformance(val, monthTarget, direction);
                                const status = getStatusEmoji(perf);
                                let color = '#fff';
                                switch(status) {
                                    case '🔵': color = '#d1ecf1'; break;
                                    case '🔴': color = '#f8d7da'; break;
                                    case '🟠': color = '#ffe5d0'; break;
                                    case '🟡': color = '#fff3cd'; break;
                                    case '🟢': color = '#d4edda'; break;
                                    case '🟩': color = '#c3e6cb'; break;
                                }
                                return `<td style="background-color: ${color}">${val}</td>`;
                            }).join('')}
                        </tr>
                    </tbody>
                </table>
            </div>
        `;

        renderChart('plotly-chart', metrics);
    }

    function renderChart(elementId, metrics) {
        const { results, targetLine, periodicity, direction } = metrics;
        
        const xValues = periodicity.months.map(m => m.toUpperCase());
        const yValues = periodicity.months.map(m => {
            const entry = results[m];
            return (entry && typeof entry === 'object') ? entry.v : entry;
        });
        
        const targetYValues = periodicity.months.map(m => targetLine[MONTH_KEYS.indexOf(m)]);

        const traceResults = {
            x: xValues,
            y: yValues,
            type: 'scatter',
            mode: 'lines+markers',
            name: 'Resultado',
            line: { color: '#007bff', shape: 'spline', smoothing: 0.8 }
        };

        const traceTargets = {
            x: xValues,
            y: targetYValues,
            type: 'scatter',
            mode: 'lines',
            name: 'Meta',
            line: { color: 'green', dash: 'dash', width: 2 }
        };

        const layout = {
            margin: { t: 20, b: 40, l: 40, r: 20 },
            showlegend: true,
            legend: { orientation: 'h', y: -0.2 },
            yaxis: {
                range: metrics.chartRange,
                autorange: metrics.chartRange ? false : true
            }
        };

        Plotly.newPlot(elementId, [traceResults, traceTargets], layout, { responsive: true, displayModeBar: false });
    }

    return {
        renderIndicatorDetails,
        getIndicatorMetrics,
        calculateProgressiveTargets,
        PERIODICITY_CONFIG
    };

})();
