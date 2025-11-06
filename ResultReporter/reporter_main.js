// reporter_main.js

// --- CONFIGURATION ---
// Instructions:
// 1. This widget needs to connect to several tables in your Grist document.
// 2. The names of these tables might be different in your document.
// 3. Below, you will find a list of tables the widget needs.
// 4. Please replace the default names with the actual names of the tables in your document.
//
// Example: If your table for "audits" is called "MyAudits", change:
//      auditorias: 'Auditoria',
// to:
//      auditorias: 'MyAudits',
const TABLE_MAPPINGS = {
    /**
     * Table with the questions for the audits.
     */
    perguntas: 'Modelos_Perguntas',

    /**
     * Table with the list of auditors.
     */
    auditores: 'Auditores',

    /**
     * Table with the list of departments.
     */
    departamentos: 'Departamentos',

    /**
     * Table with the details of the possible answers.
     */
    opcoesRespostas: 'Opcoes_Respostas_Detalhes',

    /**
     * Table with the parent planning information.
     * This was the source of the error.
     * Based on your schema, the correct table name is 'PAI'.
     */
    planejamentos: 'PAI',

    /**
     * Table with the main audit data.
     */
    auditorias: 'Auditoria',
};
// --- END OF CONFIGURATION ---

document.addEventListener('DOMContentLoaded', () => {
    console.log("--- DOM Content Loaded ---");

    // --- UI ELEMENTS ---
    const fileInput = document.getElementById('results-json-input');
    const importStatus = document.getElementById('import-status');
    const auditSelect = document.getElementById('auditoria-final-select');
    const generateReportBtn = document.getElementById('btn-generate-report');
    const reportStatus = document.getElementById('report-status');

    // --- STATE ---
    const gristData = {};
    const importedData = [];

    // --- INITIALIZATION ---
    if (fileInput) {
        fileInput.disabled = true;
        importStatus.innerHTML = "<i>Aguardando carregamento dos dados do Grist...</i>";
    } else {
        console.error("❌ File input not found on DOM load.");
        return;
    }

    // --- FUNCTIONS ---

    function promiseWithTimeout(promise, ms, errorMessage) {
        return new Promise((resolve, reject) => {
            const timeoutId = setTimeout(() => reject(new Error(errorMessage)), ms);
            promise.then(res => {
                clearTimeout(timeoutId);
                resolve(res);
            }).catch(err => {
                clearTimeout(timeoutId);
                reject(err);
            });
        });
    }

    async function fetchGristData() {
        try {
            importStatus.innerHTML = "<b>Carregando dados do Grist...</b>";
            console.log("Attempting to fetch Grist data...");

            const tablesToFetch = TABLE_MAPPINGS;
            const promises = Object.entries(tablesToFetch).map(([key, tableName]) =>
                promiseWithTimeout(
                    grist.docApi.fetchTable(tableName),
                    10000, // Increased timeout to 10 seconds
                    `Timeout: A tabela '${tableName}' demorou muito para carregar.`
                ).then(data => ({ key, data }))
            );

            const results = await Promise.all(promises);

            for (const result of results) {
                gristData[result.key] = grist.mapColumnNames(result.data);
            }

            console.log('✔️ Grist data cache populated:', gristData);
            importStatus.innerHTML = "<b>Dados carregados.</b> Por favor, selecione um ou mais arquivos de resultado (.json).";
            fileInput.disabled = false; // Enable file input now

        } catch (error) {
            console.error("❌ Error during Grist data fetch:", error);
            importStatus.innerHTML = `<span style="color: red;"><b>Falha ao carregar dados do Grist:</b><br>${error.message}<br>Recarregue o widget para tentar novamente.</span>`;
        }
    }

    async function handleFileSelect(event) {
        const files = event.target.files;
        if (!files.length) {
            importStatus.innerHTML = "Nenhum arquivo selecionado.";
            return;
        }

        importStatus.innerHTML = `Processando ${files.length} arquivo(s)...`;
        importedData.length = 0; // Clear previous data

        try {
            for (const file of files) {
                const fileContent = await file.text();
                const resultData = JSON.parse(fileContent);
                await processResultFile(resultData, file.name);
            }
            importStatus.innerHTML = `<b>${importedData.length} auditoria(s) importada(s) com sucesso!</b><br>Selecione uma auditoria abaixo para gerar o relatório.`;
            await populateAuditsDropdown();

        } catch (error) {
            console.error("❌ Error processing files:", error);
            importStatus.innerHTML = `<span style="color: red;"><b>Erro ao processar arquivos:</b><br>${error.message}</span>`;
        }
    }

    async function processResultFile(resultData, fileName) {
        importedData.push({ data: resultData, fileName: fileName });
        console.log("Processed file:", fileName);
    }

    async function populateAuditsDropdown() {
        auditSelect.innerHTML = '<option value="">-- Selecione uma auditoria --</option>';

        if (importedData.length === 0) {
            auditSelect.disabled = true;
            generateReportBtn.disabled = true;
            return;
        }

        importedData.forEach((item, index) => {
            const auditState = item.data;
            const fileName = item.fileName;

            const areaId = auditState.areaId;
            const department = gristData.departamentos?.find(d => d.id === areaId)?.Departamento || 'Área Desconhecida';

            const displayName = `${fileName.replace(/\.json$/i, '')} (${department})`

            const option = document.createElement('option');
            option.value = index;
            option.textContent = displayName;
            auditSelect.appendChild(option);
        });

        auditSelect.disabled = false;
    }

    async function handleReportGeneration() {
        const selectedIndex = auditSelect.value;
        if (selectedIndex === "" || selectedIndex === null) {
            reportStatus.textContent = 'Por favor, selecione uma auditoria.';
            return;
        }

        reportStatus.textContent = 'Gerando relatório...';
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF();

        try {
            const selectedAudit = importedData[selectedIndex];
            const auditState = selectedAudit.data;
            const fileName = selectedAudit.fileName.replace(/\.json$/i, '');

            // --- METADATA ---
            const areaId = auditState.areaId;
            const department = gristData.departamentos?.find(d => d.id === areaId)?.Departamento || 'N/A';
            const date = auditState.dataRealizada ? new Date(auditState.dataRealizada).toLocaleDateString('pt-BR', { timeZone: 'UTC' }) : 'N/A';
            const auditorLiderId = auditState.auditorLiderId;
            const auditorLider = gristData.auditores?.find(a => a.id === auditorLiderId)?.NomeAuditorRef || 'N/A';

            // --- PDF CONTENT ---
            doc.setFontSize(18);
            doc.text(`Relatório de Auditoria`, 14, 22);

            doc.setFontSize(12);
            doc.text(`Auditoria: ${fileName}`, 14, 32);
            doc.text(`Área: ${department}`, 14, 40);
            doc.text(`Data: ${date}`, 14, 48);
            doc.text(`Auditor Líder: ${auditorLider}`, 14, 56);

            // --- RESULTS TABLE ---
            if (auditState.respostas && Object.keys(auditState.respostas).length > 0) {
                const tableColumn = ["Pergunta", "Resposta", "Observação"];
                
                const perguntasMap = new Map(gristData.perguntas.map(p => [p.id, p]));
                const opcoesMap = new Map(gristData.opcoesRespostas.map(o => [o.id, o]));

                let tableRows = [];
                for (const perguntaIdStr in auditState.respostas) {
                    const perguntaId = Number(perguntaIdStr);
                    const respostaId = auditState.respostas[perguntaId];

                    const pergunta = perguntasMap.get(perguntaId);
                    const opcao = opcoesMap.get(respostaId);

                    const perguntaTexto = pergunta?.Texto_Pergunta || `Pergunta ID: ${perguntaId}`;
                    const respostaTexto = opcao?.Texto_Opcao || `Resposta ID: ${respostaId}`;
                    const observacao = auditState.anotacoes?.[perguntaId] || '';
                    const ordem = pergunta?.Ordem || 0;

                    tableRows.push({ordem, cols: [perguntaTexto, respostaTexto, observacao]});
                }
                
                tableRows.sort((a, b) => a.ordem - b.ordem);
                const sortedRows = tableRows.map(r => r.cols);

                doc.autoTable({
                    head: [tableColumn],
                    body: sortedRows,
                    startY: 65,
                    styles: { fontSize: 8, cellPadding: 2 },
                    headStyles: { fillColor: [22, 160, 133] },
                    didDrawPage: (data) => {
                        // You can add headers/footers here if needed
                    }
                });
            } else {
                doc.text("Nenhum resultado (respostas) encontrado neste arquivo.", 14, 75);
            }

            // --- SAVE PDF ---
            doc.save(`${fileName}_Relatorio.pdf`);
            reportStatus.textContent = `Relatório "${fileName}_Relatorio.pdf" gerado com sucesso!`;

        } catch (error) {
            console.error("❌ Error generating PDF:", error);
            reportStatus.innerHTML = `<span style="color: red;"><b>Erro ao gerar PDF:</b><br>${error.message}</span>`;
        }
    }
    
    async function debugSchema() { /* ... same as before ... */ }

    // --- EVENT LISTENERS ---
    fileInput.addEventListener('change', handleFileSelect);
    auditSelect.addEventListener('change', () => {
        generateReportBtn.disabled = !auditSelect.value;
    });
    generateReportBtn.addEventListener('click', handleReportGeneration);

    // --- KICK OFF ---
    if (window.grist) {
        grist.ready();
        fetchGristData();
        // debugSchema(); // This function is empty, commenting out
    } else {
        console.error("CRITICAL: Grist object not found on window!");
        importStatus.innerHTML = "<span style='color: red;'><b>CRITICAL: Grist API not found.</b></span>";
    }
});
