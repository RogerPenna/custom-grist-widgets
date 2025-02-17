grist.ready({
    requiredAccess: 'read table',
    columns: [
        { name: "title", title: "Título", type: "Text" },
        { name: "subtitle", title: "Subtítulo", type: "Text", optional: true },
        { name: "image", title: "Imagem", type: "Text", optional: true },
        { name: "extras", title: "Colunas Extras", type: "Any", optional: true, allowMultiple: true }
    ]
});

let currentRecords = [];
let fieldMappings = {};

// 🚀 Aguarda a configuração do usuário no Grist
grist.onOptions((options) => {
    if (options.mappings) {
        fieldMappings = options.mappings;
    }
    renderCards();
});

// 🚀 Atualiza os registros quando há mudança na tabela do Grist
grist.onRecords((records) => {
    currentRecords = records;
    renderCards();
});

// 🔄 Renderiza os cartões corretamente
function renderCards() {
    const container = document.getElementById("cards");
    container.innerHTML = "";

    currentRecords.forEach(record => {
        const card = document.createElement("div");
        card.className = "card";

        // ✅ Título
        const title = document.createElement("div");
        title.className = "card-title";
        title.textContent = record[fieldMappings.title] || "Sem título";
        card.appendChild(title);

        // ✅ Subtítulo (se configurado)
        if (fieldMappings.subtitle) {
            const subtitle = document.createElement("div");
            subtitle.className = "card-subtitle";
            subtitle.textContent = record[fieldMappings.subtitle] || "";
            card.appendChild(subtitle);
        }

        // ✅ Imagem (se configurada)
        if (fieldMappings.image) {
            const img = document.createElement("img");
            img.src = record[fieldMappings.image] || "https://via.placeholder.com/150";
            card.appendChild(img);
        }

        // ✅ Adiciona as colunas extras
        if (fieldMappings.extras) {
            fieldMappings.extras.forEach(extraField => {
                const extra = document.createElement("p");
                extra.className = "card-extra";
                extra.textContent = `${extraField}: ${record[extraField] || "Sem dados"}`;
                card.appendChild(extra);
            });
        }

        container.appendChild(card);
    });
}
