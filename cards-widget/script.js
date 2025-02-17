grist.ready({ requiredAccess: 'read table' });

let currentRecords = [];
let layout = "auto";
let maxCardHeight = "auto";

// Recebe os dados do Grist
grist.onRecords((records, mappings) => {
    currentRecords = records;
    renderCards();
});

// Evento para abrir/fechar configurações
document.getElementById("settingsButton").addEventListener("click", () => {
    document.getElementById("settingsPanel").style.display = "block";
});

document.getElementById("closeSettings").addEventListener("click", () => {
    document.getElementById("settingsPanel").style.display = "none";
});

// Evento de mudança de layout e altura
document.getElementById("layoutSelect").addEventListener("change", function () {
    layout = this.value;
    renderCards();
});

document.getElementById("heightSelect").addEventListener("change", function () {
    maxCardHeight = this.value;
    renderCards();
});

// Renderiza os cartões
function renderCards() {
    const container = document.getElementById("cards");
    container.innerHTML = "";
    container.style.gridTemplateColumns = layout === "auto" ? "repeat(auto-fit, minmax(250px, 1fr))" : `repeat(${layout}, 1fr)`;

    currentRecords.forEach(record => {
        const card = document.createElement("div");
        card.className = "card";
        if (maxCardHeight !== "auto") {
            card.style.maxHeight = `${maxCardHeight * 30}px`; // Ajuste de altura
            card.style.overflowY = "auto";
        }

        // Botões do Card
        const buttonContainer = document.createElement("div");
        buttonContainer.className = "card-buttons";

        const editButton = document.createElement("button");
        editButton.innerHTML = '<i class="fas fa-edit"></i>';
        editButton.onclick = () => enableEditMode(card, record);
        buttonContainer.appendChild(editButton);

        const expandButton = document.createElement("button");
        expandButton.innerHTML = '<i class="fas fa-search-plus"></i>';
        expandButton.onclick = () => openModal(record);
        buttonContainer.appendChild(expandButton);

        card.appendChild(buttonContainer);

        // Conteúdo
        const title = document.createElement("div");
        title.className = "card-title";
        title.textContent = record.Name || "Sem título";
        card.appendChild(title);

        const img = document.createElement("img");
        img.src = record.Image || "https://via.placeholder.com/150";
        card.appendChild(img);

        container.appendChild(card);
    });
}
