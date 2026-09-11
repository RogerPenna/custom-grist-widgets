import { GristTableLens } from '../libraries/grist-table-lens/grist-table-lens.js';
import { GristRestApi } from '../libraries/grist-rest-api.js';

document.addEventListener('DOMContentLoaded', async () => {
    const statusBox = document.getElementById('status-box');
    const btnAnalyze = document.getElementById('btn-analyze');
    const btnCopyJson = document.getElementById('btn-copy-json');
    const btnDownloadJson = document.getElementById('btn-download-json');
    const btnMigrate = document.getElementById('btn-migrate');
    const migrationLog = document.getElementById('migration-log');
    const jsonOutput = document.getElementById('json-output');

    const tableLens = new GristTableLens(window.grist);
    let finalJsonData = null;
    let rawRecordsIndicadores = [];
    let rawRecordsDados = [];

    grist.ready({ requiredAccess: 'full' });

    grist.on('ready', () => {
        statusBox.textContent = '✅ Conectado ao Grist! Pronto para análise.';
        statusBox.className = 'status-msg status-info';
    });

    // Helper to log migration progress
    function logMsg(msg) {
        migrationLog.style.display = 'block';
        const line = document.createElement('div');
        line.textContent = `[${new Date().toLocaleTimeString()}] ${msg}`;
        migrationLog.appendChild(line);
        migrationLog.scrollTop = migrationLog.scrollHeight;
    }

    btnAnalyze.addEventListener('click', async () => {
        try {
            statusBox.textContent = '⏳ Analisando metadados e registros...';
            statusBox.className = 'status-msg status-info';

            // Initialize API
            await GristRestApi.init(grist);

            // 1. Resolve table IDs
            const tableIndicadoresId = await tableLens.resolveTableId('Indicadores');
            const tableDadosId = await tableLens.resolveTableId('DadosIndicadores');

            // 2. Fetch Schemas
            const schemaIndicadores = await tableLens.getTableSchema(tableIndicadoresId);
            const schemaDados = await tableLens.getTableSchema(tableDadosId);

            // Render tables in UI
            renderSchemaTable('indicadores-table', 'indicadores-summary', schemaIndicadores);
            renderSchemaTable('dados-table', 'dados-summary', schemaDados);

            // 3. Fetch Records
            rawRecordsIndicadores = await tableLens.fetchTableRecords(tableIndicadoresId);
            rawRecordsDados = await tableLens.fetchTableRecords(tableDadosId);

            // 4. Capture structure and find the latest record from DadosIndicadores for each indicator
            // Group DadosIndicadores records by indicator reference
            const latestDadosByIndicator = {};
            for (const record of rawRecordsDados) {
                const ref = record.ref_indicator;
                if (!ref) continue;

                // Handle Grist Reference list or single value
                const refId = Array.isArray(ref) ? ref[1] : ref; 
                if (!refId) continue;

                const currentLatest = latestDadosByIndicator[refId];
                // Compare dates to find the latest
                if (!currentLatest || new Date(record.dt_result || record.dt_meta || 0) > new Date(currentLatest.dt_result || currentLatest.dt_meta || 0)) {
                    latestDadosByIndicator[refId] = record;
                }
            }

            // Consolidate final payload for AI
            finalJsonData = {
                generator: "Migration Helper Widget v1.0.0",
                timestamp: new Date().toISOString(),
                tables: {
                    Indicadores: {
                        tableId: tableIndicadoresId,
                        totalRecords: rawRecordsIndicadores.length,
                        schema: schemaIndicadores
                    },
                    DadosIndicadores: {
                        tableId: tableDadosId,
                        totalRecords: rawRecordsDados.length,
                        schema: schemaDados
                    }
                },
                sampleMergedData: rawRecordsIndicadores.map(ind => {
                    const latestDado = latestDadosByIndicator[ind.id] || null;
                    return {
                        indicador_id: ind.id,
                        indicador_nome: ind.Nome || ind.label || '',
                        indicador_fields: ind,
                        latest_dados_fields: latestDado
                    };
                })
            };

            jsonOutput.textContent = JSON.stringify(finalJsonData, null, 2);
            btnCopyJson.disabled = false;
            btnDownloadJson.disabled = false;
            btnMigrate.disabled = false;

            statusBox.textContent = '🎉 Análise concluída com sucesso! Prontinho para copiar e migrar.';
            statusBox.className = 'status-msg status-info';

        } catch (error) {
            console.error(error);
            statusBox.textContent = `❌ Erro na análise: ${error.message}`;
            statusBox.className = 'status-msg status-error';
        }
    });

    btnMigrate.addEventListener('click', async () => {
        try {
            migrationLog.innerHTML = '';
            logMsg('Iniciando processo de migração...');
            btnMigrate.disabled = true;

            // 1. Criar a nova tabela de destino 'Indicators' caso ela não exista
            logMsg('Verificando/Criando tabela "Indicators"...');
            
            // Criamos as colunas inicialmente de forma simples (tipo básico) para garantir estabilidade de criação
            const columnsToCreate = [
                { id: 'Nome', fields: { label: 'Nome', type: 'Text' } },
                { id: 'Peso', fields: { label: 'Peso', type: 'Numeric' } },
                { id: 'Meta_Ciclo', fields: { label: 'Meta_Ciclo', type: 'Text' } },
                { id: 'Resultados_Mensais_JSON', fields: { label: 'Resultados_Mensais_JSON', type: 'Text' } },
                { id: 'Periodicidade', fields: { label: 'Periodicidade', type: 'Text' } },
                { id: 'Un_', fields: { label: 'Un.', type: 'Text' } },
                { id: 'chart_min', fields: { label: 'Ajuste Gráfico Inferior', type: 'Numeric' } },
                { id: 'chart_max', fields: { label: 'Ajuste Gráfico Superior', type: 'Numeric' } },
                { id: 'Direcao', fields: { label: 'Direção', type: 'Text' } },
                { id: 'Tipo_Consolidacao', fields: { label: 'Tipo_Consolidacao', type: 'Text' } },
                { id: 'SinalResult', fields: { label: 'SinalResult', type: 'Numeric' } },
                { id: 'Atingimento_Estatico', fields: { label: 'Atingimento Estático', type: 'Numeric' } },
                { id: 'Semaforo_Estatico', fields: { label: 'Semáforo Estático', type: 'Text' } },
                { id: 'LimInf', fields: { label: 'LimInf', type: 'Bool' } },
                { id: 'LimSup', fields: { label: 'LimSup', type: 'Bool' } },
                { id: 'LimiteInferior', fields: { label: 'LimiteInferior', type: 'Numeric' } },
                { id: 'LimiteSuperior', fields: { label: 'LimiteSuperior', type: 'Numeric' } },
                { id: 'DiaVencimento', fields: { label: 'DiaVencimento', type: 'Int' } },
                { id: 'ATIVO_', fields: { label: 'Ativo', type: 'Bool' } }
            ];

            let tableCreated = false;
            try {
                await grist.docApi.applyUserActions([
                    ['AddTable', 'Indicators', columnsToCreate]
                ]);
                tableCreated = true;
                logMsg('Tabela "Indicators" criada com sucesso!');
            } catch (err) {
                if (err.message?.includes('already exists') || err.message?.includes('existente')) {
                    logMsg('Tabela "Indicators" já existe. Prosseguindo...');
                } else {
                    throw err;
                }
            }

            // 1.5. Aplicar metadados avançados (Opções Choices, Formatações Condicionais) via API REST
            logMsg('Aplicando metadados avançados e formatações condicionais via API...');
            try {
                await GristRestApi.init(grist);

                // Configurações do widgetOptions para Choices e Estilos
                const colUpdates = [
                    {
                        id: 'Periodicidade',
                        fields: {
                            type: 'Choice',
                            widgetOptions: JSON.stringify({
                                widget: 'TextBox',
                                alignment: 'left',
                                choices: ['Mensal', 'Bimestral', 'Trimestral', 'Quadrimestral', 'Semestral', 'Anual']
                            })
                        }
                    },
                    {
                        id: 'Direcao',
                        fields: {
                            type: 'Choice',
                            widgetOptions: JSON.stringify({
                                widget: 'TextBox',
                                alignment: 'left',
                                choices: ['⬆️Maior Melhor', '⬇️Menor Melhor']
                            })
                        }
                    },
                    {
                        id: 'Tipo_Consolidacao',
                        fields: {
                            type: 'Choice',
                            widgetOptions: JSON.stringify({
                                widget: 'TextBox',
                                alignment: 'left',
                                choices: ['Último Valor', 'Soma Acumulada']
                            })
                        }
                    },
                    {
                        id: 'Atingimento_Estatico',
                        fields: {
                            type: 'Numeric',
                            widgetOptions: JSON.stringify({
                                widget: 'TextBox',
                                alignment: 'right',
                                numMode: 'decimal',
                                rulesOptions: [
                                    { fillColor: '#084794', textColor: '#FFFFFF' }, // > 100%
                                    { fillColor: '#126E0E', textColor: '#FFFFFF' }, // <= 100%
                                    { fillColor: '#2AE028', textColor: '#FFFFFF' }, // < 90%
                                    { fillColor: '#E8D62F', textColor: '#FFFFFF' }, // < 80%
                                    { fillColor: '#FD9D28', textColor: '#FFFFFF' }, // < 70%
                                    { fillColor: '#E00A17', textColor: '#FFFFFF' }  // <= 50%
                                ]
                            })
                        }
                    }
                ];

                await GristRestApi.request('/tables/Indicators/columns', {
                    method: 'PATCH',
                    body: JSON.stringify({ columns: colUpdates })
                });

                logMsg('✅ Metadados de opções e formatações injetados com sucesso.');
            } catch (apiErr) {
                logMsg(`⚠️ Nota: Falha ao aplicar metadados específicos de opções (${apiErr.message}). A migração continuará.`);
            }

            // 2. Processar registros e juntar DadosIndicadores em JSON estruturado por ano/mês
            logMsg('Processando dados históricos das colunas A e dt_result...');
            
            const monthsPt = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

            const dadosByIndicator = {};
            for (const row of rawRecordsDados) {
                const ref = row.ref_indicator;
                if (!ref) continue;
                const refId = Array.isArray(ref) ? ref[1] : ref;
                if (!refId) continue;

                if (!dadosByIndicator[refId]) {
                    dadosByIndicator[refId] = [];
                }

                let dateA = row.A;
                let dateResult = row.dt_result;

                // Formata datas normais para ISO string YYYY-MM-DD
                function formatGristDate(val) {
                    if (!val) return null;
                    try {
                        const parsed = new Date(typeof val === 'number' ? val * 1000 : val);
                        if (isNaN(parsed.getTime())) return null;
                        return parsed.toISOString().split('T')[0];
                    } catch (e) {
                        return null;
                    }
                }

                dateA = formatGristDate(dateA);
                dateResult = formatGristDate(dateResult);

                if (!dateA) continue; // Precisamos da data de referência A

                const d = new Date(dateA);
                const year = d.getFullYear().toString();
                const month = monthsPt[d.getMonth()];

                dadosByIndicator[refId].push({
                    year,
                    month,
                    dateA,
                    dateResult,
                    meta: row.meta || 0,
                    value: row.result || 0
                });
            }

            // Helper para obter o Semáforo com base no Atingimento
            function calculateSemaforo(performance) {
                const p = performance * 100;
                if (p > 100) return "🔵";
                if (p < 50) return "🔴";
                if (p < 70) return "🟠";
                if (p < 80) return "🟡";
                if (p < 90) return "🟢";
                if (p <= 100) return "🟩";
                return "❓";
            }

            // 3. Gravar dados consolidados na nova tabela
            logMsg('Enviando novos registros para a tabela unificada...');
            const recordsToAdd = rawRecordsIndicadores.map(ind => {
                const items = dadosByIndicator[ind.id] || [];
                
                const metaCicloObj = {};
                const resultadosMensaisObj = {};

                // Mapeia periodicidade do novo formato
                const periodicityStr = ind.Periodicidade === 'Mensal' ? 'MONTHLY' : 'YEARLY';

                let lastValue = 0;
                let sumValue = 0;
                let latestMeta = 0;

                // Ordena os itens cronologicamente para consolidação correta de último valor
                items.sort((a, b) => new Date(a.dateA) - new Date(b.dateA));

                for (const item of items) {
                    // 1. Meta Ciclo
                    if (!metaCicloObj[item.year]) {
                        metaCicloObj[item.year] = {};
                    }
                    metaCicloObj[item.year][item.month] = {
                        v: item.meta,
                        m: true
                    };
                    latestMeta = item.meta; // Atualiza a última meta encontrada

                    // 2. Resultados Mensais JSON
                    if (!resultadosMensaisObj[item.year]) {
                        resultadosMensaisObj[item.year] = {
                            periodicity: periodicityStr,
                            results: {},
                            targets: {}
                        };
                    }
                    resultadosMensaisObj[item.year].results[item.month] = {
                        v: item.value,
                        d: item.dateResult || item.dateA
                    };

                    lastValue = item.value;
                    sumValue += item.value;
                }

                // Traduz o Sinalizador antigo para o Tipo_Consolidacao novo
                let tipoConsolidacao = 'Último Valor';
                if (ind.Sinalizador === 'Valor Acumulado') {
                    tipoConsolidacao = 'Soma Acumulada';
                }

                // Calcula SinalResult e Atingimento estáticos a serem inseridos
                const finalSinalResult = tipoConsolidacao === 'Soma Acumulada' ? sumValue : lastValue;
                
                let atingimento = 0;
                if (latestMeta > 0) {
                    if (ind.Direcao === '⬇️Menor Melhor') {
                        atingimento = finalSinalResult === 0 ? 2.0 : latestMeta / finalSinalResult;
                    } else {
                        atingimento = finalSinalResult / latestMeta;
                    }
                } else if (finalSinalResult > 0) {
                    atingimento = 1.0;
                }

                const semaforo = calculateSemaforo(atingimento);

                return [
                    'AddRecord', 'Indicators', null, {
                        Nome: ind.Nome || '',
                        Peso: ind.weight || 1,
                        Meta_Ciclo: JSON.stringify(metaCicloObj),
                        Resultados_Mensais_JSON: JSON.stringify(resultadosMensaisObj),
                        Periodicidade: ind.Periodicidade || '',
                        Un_: ind.Un_ || '',
                        chart_min: ind.chart_min || 0,
                        chart_max: ind.chart_max || 100,
                        Direcao: ind.Direcao || '',
                        Tipo_Consolidacao: tipoConsolidacao,
                        SinalResult: finalSinalResult,
                        Atingimento_Estatico: atingimento,
                        Semaforo_Estatico: semaforo,
                        LimInf: true,
                        LimSup: true,
                        LimiteInferior: 10,
                        LimiteSuperior: 10,
                        DiaVencimento: 5,
                        ATIVO_: ind.ATIVO_ !== false
                    }
                ];
            });

            // Envia em blocos para evitar estourar limites de requisição
            const chunkSize = 50;
            for (let i = 0; i < recordsToAdd.length; i += chunkSize) {
                const chunk = recordsToAdd.slice(i, i + chunkSize);
                await grist.docApi.applyUserActions(chunk);
                logMsg(`Registros importados: ${Math.min(i + chunkSize, recordsToAdd.length)} / ${recordsToAdd.length}`);
            }

            logMsg('🎉 MIGRAÇÃO CONCLUÍDA COM SUCESSO! A nova tabela "Indicators" está pronta.');
            alert('Sucesso! A tabela Indicators foi criada e preenchida com os dados unificados.');

        } catch (err) {
            console.error(err);
            logMsg(`❌ Erro durante a migração: ${err.message}`);
        } finally {
            btnMigrate.disabled = false;
        }
    });

    btnCopyJson.addEventListener('click', () => {
        if (!finalJsonData) return;
        navigator.clipboard.writeText(JSON.stringify(finalJsonData, null, 2))
            .then(() => {
                const oldText = btnCopyJson.textContent;
                btnCopyJson.textContent = '✨ Copiado com sucesso!';
                setTimeout(() => btnCopyJson.textContent = oldText, 2000);
            })
            .catch(err => {
                alert('Erro ao copiar: ' + err);
            });
    });

    btnDownloadJson.addEventListener('click', () => {
        if (!finalJsonData) return;
        const blob = new Blob([JSON.stringify(finalJsonData, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `mapeamento_indicadores_migration_${new Date().toISOString().split('T')[0]}.json`;
        a.click();
        URL.revokeObjectURL(url);
    });

    function renderSchemaTable(tableElId, summaryElId, schema) {
        const table = document.getElementById(tableElId);
        const summary = document.getElementById(summaryElId);
        const tbody = table.querySelector('tbody');
        tbody.innerHTML = '';

        const cols = Object.keys(schema);
        if (cols.length === 0) {
            summary.textContent = "Nenhuma coluna encontrada.";
            table.style.display = 'none';
            return;
        }

        summary.textContent = `Total de colunas: ${cols.length}`;
        table.style.display = 'table';

        for (const colId of cols) {
            const col = schema[colId];
            const tr = document.createElement('tr');
            
            const tdName = document.createElement('td');
            tdName.innerHTML = `<strong>${col.label}</strong><br><small style="color: #64748b;">${col.colId}</small>`;
            
            const tdType = document.createElement('td');
            tdType.textContent = col.type || 'Text';

            const tdConfig = document.createElement('td');
            if (col.isFormula) {
                tdConfig.innerHTML = `<span class="formula-badge">Formula</span> <code style="font-size:11px;">${col.formula}</code>`;
            } else if (col.type?.startsWith('Ref:')) {
                tdConfig.innerHTML = `<small style="color: #0284c7;">Ref → ${col.type}</small>`;
            } else {
                tdConfig.innerHTML = `<small style="color: #64748b;">Dado Manual</small>`;
            }

            tr.appendChild(tdName);
            tr.appendChild(tdType);
            tr.appendChild(tdConfig);
            tbody.appendChild(tr);
        }
    }
});
