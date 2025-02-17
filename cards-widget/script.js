grist.ready({ requiredAccess: 'read table' });

let currentRecords = [];
let layout = "auto";
let maxCardHeight = "auto";
let fieldMappings = {};

// Abre o painel de configuração ao iniciar
document.getElementById("fieldsPanel").style.display = "block";

// Recebe os dados do Grist e preenche os campos
grist.onRecords((records) => {
    currentRecords = records;
    renderCards();
});

// Preenche os campos disponíveis no Grist
grist.onOptions(async (options) => {
    let columns = await grist.docApi.fetchTable(grist.widget.options.tableId);
    let columnNames = Object.keys(columns);

    ["titleField", "subtitleField", "imageField"].forEach(id => {
        let select = document.getElementById(id);
        select.innerHTML = "";
        columnNames.forEach(name => {
            let option = document.createElement("option");
            option.value = name;
            option.textContent = name;
            select.appendChild(option);
        });
    });
});

// Salva as configurações dos campos
document.getElementById("saveFields").addEventListener("click", () => {
    fieldMappings = {
        title: document.getElementById("titleField").value,
        subtitle: document.getElementById("subtitleField").value,
        image: document.getElementById("imageField").value,
        extras: document.getElementById("extraFields").value.split(",").map(f => f.trim())
    };

    document.getElementById("fieldsPanel").style.display = "none";
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
