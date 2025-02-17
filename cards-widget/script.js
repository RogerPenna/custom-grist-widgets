// ✅ Configuração inicial do Grist para permitir o mapeamento correto
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

// ✅ Atualiza os mapeamentos de colunas escolhidos pelo usuário
grist.onOptions((options) => {
    if (options.mappings) {
        fieldMappings = options.mappings;
    }
    renderCards();
});

// ✅ Atualiza os registros quando há mudança na tabela do Grist
grist.onRecords((records) => {
    currentRecords = records.records; // <-- Pegando corretamente os registros
    renderCards();
});

// ✅ Renderiza os cartões corretamente com os dados reais
function renderCards() {
    const container = document.getElementById("cards");
    container.innerHTML = "";

    currentRecords.forEach(record => {
        const card = document.createElement("div");
        card.className = "card";

        // ✅ Pegando os valores corretamente a partir do mapeamento
        const titleText = record[fieldMappings.title] || "Sem título";
        const subtitleText = fieldMappings.subtitle ? record[fieldMappings.subtitle] || "" : "";
        const imageUrl = fieldMappings.image ? record[fieldMappings.image] || "https://via.placeholder.com/150" : "";

        // ✅ Criando o título do card
        const title = document.createElement("div");
        title.className = "card-title";
        title.textContent = titleText;
        card.appendChild(title);

        // ✅ Criando o subtítulo do card (se existir)
        if (subtitleText) {
            const subtitle = document.createElement("div");
            subtitle.className = "card-subtitle";
            subtitle.textContent = subtitleText;
            card.appendChild(subtitle);
        }

        // ✅ Criando a imagem do card (se existir)
        if (fieldMappings.image) {
            const img = document.createElement("img");
            img.src = imageUrl;
            card.appendChild(img);
        }

        // ✅ Adicionando os campos extras, se existirem
        if (fieldMappings.extras && fieldMappings.extras.length > 0) {
            fieldMappings.extras.forEach(extraField => {
                if (record[extraField] !== undefined) {
                    const extra = document.createElement("p");
                    extra.className = "card-extra";
                    extra.textContent = `${extraField}: ${record[extraField]}`;
                    card.appendChild(extra);
                }
            });
        }

        container.appendChild(card);
    });
}
