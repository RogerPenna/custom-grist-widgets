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

    function interpolateTargets(targetsJson) {
        const result = new Array(12).fill(null);
        if (!targetsJson || Object.keys(targetsJson).length === 0) return result;

        const definedMonths = MONTH_KEYS
            .map((m, i) => ({ index: i, val: targetsJson[m] }))
            .filter(item => item.val !== undefined && item.val !== null);

        if (definedMonths.length === 0) return result;

        // Sort by month index
        definedMonths.sort((a, b) => a.index - b.index);

        // If only one point, fill all with that point
        if (definedMonths.length === 1) {
            return result.fill(definedMonths[0].val);
        }

        // Interpolate between defined points
        for (let i = 0; i < definedMonths.length - 1; i++) {
            const start = definedMonths[i];
            const end = definedMonths[i + 1];
            const steps = end.index - start.index;
            const stepVal = (end.val - start.val) / steps;

            for (let j = 0; j <= steps; j++) {
                result[start.index + j] = start.val + (stepVal * j);
            }
        }

        // Extrapolate backwards from first point
        const first = definedMonths[0];
        for (let i = 0; i < first.index; i++) {
            result[i] = first.val;
        }

        // Extrapolate forwards from last point
        const last = definedMonths[definedMonths.length - 1];
        for (let i = last.index + 1; i < 12; i++) {
            result[i] = last.val;
        }

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
        const rawJson = record[resultsField];
        let data = {};
        try {
            data = typeof rawJson === 'string' ? JSON.parse(rawJson) : (rawJson || {});
        } catch (e) {
            console.error("Error parsing indicator JSON:", e);
        }

        // Master JSON detection: data[selectedYear] might have .results and .targets
        let yearNode = data[selectedYear] || {};
        
        // Backward compatibility fallback
        let results = yearNode.results || {};
        if (!yearNode.results && (yearNode.jan !== undefined || data.jan !== undefined)) {
            // It's a legacy flat JSON
            results = yearNode.jan !== undefined ? yearNode : data;
        }

        const rawPeriodicity = record[mapping.periodicityField || config.periodicityField];
        const periodicityKey = mapping.periodicityMap?.[rawPeriodicity] || 'MONTHLY';
        const periodicity = PERIODICITY_CONFIG[periodicityKey] || PERIODICITY_CONFIG.MONTHLY;

        const rawDirection = record[mapping.directionField || config.directionField];
        const direction = mapping.directionMap?.[rawDirection] || 'MORE_IS_BETTER';

        const rawConsolidation = record[mapping.consolidationField || config.consolidationField];
        const consolidationType = mapping.consolidationMap?.[rawConsolidation] || 'SUM';

        // Targets: priority to Master JSON .targets, fallback to cycle target field
        const targetsJson = yearNode.targets || {};
        const cycleTarget = record[mapping.targetField || config.targetField] || 0;
        
        // If targetsJson is empty, we'll use cycleTarget as a flat line
        const interpolatedTargets = interpolateTargets(targetsJson);
        const hasSpecificTargets = Object.keys(targetsJson).length > 0;
        const targetLine = hasSpecificTargets ? interpolatedTargets : new Array(12).fill(cycleTarget);

        // Consolidation should only consider months defined in periodicity
        const consolidatedValue = consolidateYearData(results, consolidationType, periodicity.months);
        
        // Target for performance: if specific targets exist, use the last one from the periodicity months
        // or a cycle target if flat.
        let targetForPerformance = cycleTarget;
        if (hasSpecificTargets) {
            const lastMonthIdx = MONTH_KEYS.indexOf(periodicity.months[periodicity.months.length - 1]);
            targetForPerformance = targetLine[lastMonthIdx];
        }

        const performance = calculatePerformance(consolidatedValue, targetForPerformance, direction);
        const status = getStatusEmoji(performance);

        const chartMin = record[mapping.chartMinField || config.chartMinField];
        const chartMax = record[mapping.chartMaxField || config.chartMaxField];

        return {
            consolidatedValue,
            performance,
            status,
            results,
            targetsJson,
            targetLine,
            periodicity,
            direction,
            cycleTarget,
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
        PERIODICITY_CONFIG
    };

})();
