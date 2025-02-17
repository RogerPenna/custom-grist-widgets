// Configuração inicial do Grist
grist.ready({
    requiredAccess: 'read table',
    columns: [
        { name: "title", title: "Título", type: "Text" },
        { name: "subtitle", title: "Subtítulo", type: "Text", optional: true },
        { name: "image", title: "Imagem", type: "Text", optional: true },
        { name: "extras", title: "Campos Extras", type: "Any", optional: true }
    ]
});

let currentRecords = [];
let layout = "auto";
let maxCardHeight = "auto";
let fieldMappings = {};

// Recebendo as configurações do usuário via Grist
grist.onOptions(async (options) => {
    fieldMappings = options.mappings;
    renderCards();
});

// Atualização dos registros
grist.onRecords((records) => {
    currentRecords = records;
    renderCards();
});

// Evento para abrir o painel de configurações
document.getElementById("settingsButton").addEventListener("click", () => {
    document.getElementById("settingsPanel").style.display = "block";
});

// Fechar o painel de configurações
document.getElementById("closeSettings").addEventListener("click", () => {
    document.getElementById("settingsPanel").style.display = "none";
});

// Atualizar layout
document.getElementById("layoutSelect").addEventListener("change", function () {
    layout = this.value;
    renderCards();
});

document.getElementById("heightSelect").addEventListener("change", function () {
    maxCardHeight = this.value;
    renderCards();
});

// Renderizar cartões
function renderCards() {
    const container = document.getElementById("cards");
    container.innerHTML = "";
    container.style.gridTemplateColumns = layout === "auto" ? "repeat(auto-fit, minmax(250px, 1fr))" : `repeat(${layout}, 1fr)`;

    currentRecords.forEach(record => {
        const card = document.createElement("div");
        card.className = "card";

        if (maxCardHeight !== "auto") {
            card.style.maxHeight = `${maxCardHeight * 30}px`;
            card.style.overflowY = "auto";
        }

        const buttonContainer = document.createElement("div");
        buttonContainer.className = "card-buttons";

        const editButton = document.createElement("button");
        editButton.innerHTML = '<i class="fas fa-edit"></i>';
        buttonContainer.appendChild(editButton);

        const expandButton = document.createElement("button");
        expandButton.innerHTML = '<i class="fas fa-search-plus"></i>';
        buttonContainer.appendChild(expandButton);

        card.appendChild(buttonContainer);

        const title = document.createElement("div");
        title.className = "card-title";
        title.textContent = record[fieldMappings.title] || "Sem título";
        card.appendChild(title);

        const img = document.createElement("img");
        img.src = record[fieldMappings.image] || "https://via.placeholder.com/150";
        card.appendChild(img);

        container.appendChild(card);
    });
}
