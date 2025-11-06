// reporter_pdf.js (v2 - No tables)

window.ReportGenerator = {};

/**
 * Generates a PDF report for a given completed audit.
 * @param {number} auditFinalId The ID of the record in the 'AuditoriasFinais' table.
 * @param {object} gristData The cached data from Grist (auditors, departments, etc.).
 * @returns {Promise<Blob>}
 */
window.ReportGenerator.generatePdfForAudit = async function(auditFinalId, gristData) {
    const { jsPDF } = window.jspdf;

    if (!auditFinalId) {
        throw new Error("No audit selected.");
    }

    // 1. Fetch the required data from Grist
    const auditFinal = await grist.docApi.fetchTable('AuditoriasFinais', { id: auditFinalId });
    const allResultados = await grist.docApi.fetchTable('ResultadosFinais', { AuditoriaFinal: auditFinalId });

    if (!auditFinal || auditFinal.id.length === 0) {
        throw new Error(`Audit with ID ${auditFinalId} not found in AuditoriasFinais.`);
    }

    const mainAudit = grist.mapColumnNames(auditFinal)[0];
    const results = grist.mapColumnNames(allResultados);

    // 2. Initialize jsPDF
    const doc = new jsPDF('p', 'mm', 'a4');
    let cursorY = 20;
    const leftMargin = 15;
    const rightMargin = 210 - 15;
    const usableWidth = rightMargin - leftMargin;

    // --- Helper for adding text with page breaks ---
    function addText(text, options = {}) {
        const { size = 10, style = 'normal', indent = 0, spaceAfter = 5 } = options;
        doc.setFontSize(size);
        doc.setFont('helvetica', style);

        const lines = doc.splitTextToSize(text, usableWidth - indent);
        const textHeight = doc.getTextDimensions(lines).h;

        if (cursorY + textHeight > 280) { // Check if content fits on page
            doc.addPage();
            cursorY = 20;
        }

        doc.text(lines, leftMargin + indent, cursorY);
        cursorY += textHeight + spaceAfter;
    }

    // --- PDF Header ---
    addText('Relatório de Auditoria Interna', { size: 18, style: 'bold', spaceAfter: 10 });

    // --- Audit Details ---
    const area = gristData.departamentos.find(d => d.id === mainAudit.Area)?.Departamento || 'N/A';
    const lider = gristData.auditores.find(a => a.id === mainAudit.AuditorLider)?.NomeAuditorRef || 'N/A';
    const acomp = gristData.auditores.find(a => a.id === mainAudit.AuditorAcomp)?.NomeAuditorRef || 'N/A';
    const data = mainAudit.DataRealizada ? new Date(mainAudit.DataRealizada * 1000).toLocaleDateString('pt-BR') : 'N/A';

    addText(`Auditoria: ${mainAudit.Auditoria_text}`, { size: 11, spaceAfter: 2 });
    addText(`Departamento: ${area}`, { size: 11, spaceAfter: 2 });
    addText(`Data de Realização: ${data}`, { size: 11, spaceAfter: 2 });
    addText(`Auditor Líder: ${lider}`, { size: 11, spaceAfter: 2 });
    addText(`Auditor Acompanhante: ${acomp}`, { size: 11, spaceAfter: 10 });

    // --- Results Section ---
    doc.setDrawColor(180);
    doc.line(leftMargin, cursorY - 5, rightMargin, cursorY - 5);

    for (const result of results) {
        if (cursorY > 260) { // Manual page break check for section
            doc.addPage();
            cursorY = 20;
        }

        addText(result.PerguntaTexto, { style: 'bold', spaceAfter: 3 });
        
        addText(`Resposta: ${result.RespostaTexto}`, { indent: 5, spaceAfter: 2 });

        if (result.Anotacao) {
            addText(`Anotação: ${result.Anotacao}`, { indent: 5, size: 9, style: 'italic', spaceAfter: 2 });
        }
        if (result.PontoAberto) {
            addText(`Ponto Aberto: ${result.PontoAberto}`, { indent: 5, size: 9, style: 'italic', spaceAfter: 2 });
        }
        if (result.Midias) {
            addText(`Mídias: ${result.Midias}`, { indent: 5, size: 9, style: 'italic', spaceAfter: 2 });
        }

        cursorY += 5; // Add extra space between questions
        doc.setDrawColor(220);
        doc.line(leftMargin, cursorY - 2, rightMargin, cursorY - 2);
    }

    // 3. Return the PDF as a blob
    return doc.output('blob');
}