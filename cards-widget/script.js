grist.ready({ requiredAccess: 'read table' });

let currentRecords = [];
let layout = "auto";

// Recebe os dados do Grist
grist.onRecords((records, mappings) => {
    console.log("📢 Dados recebidos do Grist:", records);
    currentRecords = records;
    renderCards();
});

// Evento de mudança de layout
document.getElementById("layoutSelect").addEventListener("change", function () {
    layout = this.value;
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

        // Botões do Card
        const buttonContainer = document.createElement("div");
        buttonContainer.className = "card-buttons";

        const editButton = document.createElement("button");
        editButton.textContent = "✏ Editar";
        editButton.onclick = () => enableEditMode(card, record);
        buttonContainer.appendChild(editButton);

        const expandButton = document.createElement("button");
        expandButton.textContent = "🔍 Expandir";
        expandButton.onclick = () => openModal(record);
        buttonContainer.appendChild(expandButton);

        card.appendChild(buttonContainer);

        // Título
        const title = document.createElement("div");
        title.className = "card-title";
        title.textContent = record.Name || "Sem título";
        card.appendChild(title);

        // Imagem
        const img = document.createElement("img");
        img.src = record.Image || "https://via.placeholder.com/150";
        card.appendChild(img);

        // Descrição
        const desc = document.createElement("p");
        desc.textContent = record.Description || "Sem descrição.";
        card.appendChild(desc);

        container.appendChild(card);
    });
}

// Habilita o modo de edição
function enableEditMode(card, record) {
    card.innerHTML = "";

    const inputTitle = document.createElement("input");
    inputTitle.value = record.Name || "";
    inputTitle.style.width = "100%";

    const inputDesc = document.createElement("textarea");
    inputDesc.value = record.Description || "";
    inputDesc.style.width = "100%";

    const saveButton = document.createElement("button");
    saveButton.textContent = "💾 Salvar";
    saveButton.onclick = async () => {
        saveButton.textContent = "🔄 Salvando...";
        saveButton.disabled = true;

        const updatedData = {
            Name: inputTitle.value,
            Description: inputDesc.value
        };

        await grist.docApi.applyUserActions([
            ["UpdateRecord", grist.widget.options.tableId, record.id, updatedData]
        ]);

        saveButton.textContent = "💾 Salvar";
        saveButton.disabled = false;

        renderCards();
    };

    card.appendChild(inputTitle);
    card.appendChild(inputDesc);
    card.appendChild(saveButton);
}

// Abre o modal
function openModal(record) {
    const modal = document.getElementById("modal");
    const overlay = document.getElementById("modalOverlay");
    const modalContent = document.getElementById("modalContent");

    modalContent.innerHTML = `
        <h3>${record.Name}</h3>
        ${record.Image ? `<img src="${record.Image}" style="max-width:100%">` : ""}
        <p>${record.Description || "Sem descrição."}</p>
    `;

    modal.style.display = "block";
    overlay.style.display = "block";
}

// Fecha o modal
function closeModal() {
    document.getElementById("modal").style.display = "none";
    document.getElementById("modalOverlay").style.display = "none";
}
