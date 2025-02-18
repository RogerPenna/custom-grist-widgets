grist.ready({
    columns: [
        { name: "title", title: "Título", type: "Text", optional: false },
        { name: "subtitle", title: "Subtítulo", type: "Text", optional: true },
        { name: "thumbnail", title: "Imagem (URL)", type: "Text", optional: true },
        { name: "extras", title: "Colunas Extras", type: "Any", allowMultiple: true, optional: true }
    ],
    requiredAccess: "full"
});

let currentRecords = [];

async function fetchData() {
    try {
        const tables = await grist.docApi.listTables();
        if (tables.length === 0) return;

        const tableId = tables[0];
        const tableData = await grist.docApi.fetchTable(tableId);

        currentRecords = Object.keys(tableData.id).map(index => {
            return {
                id: tableData.id[index],
                title: tableData.title ? tableData.title[index] : "",
                subtitle: tableData.subtitle ? tableData.subtitle[index] : "",
                thumbnail: tableData.thumbnail ? tableData.thumbnail[index] : "",
                extras: tableData.extras ? tableData.extras[index] : []
            };
        });

        renderCards();
    } catch (error) {
        console.error("Erro ao buscar dados:", error);
    }
}

function renderCards() {
    const container = document.getElementById("card-container");
    container.innerHTML = "";

    if (currentRecords.length === 0) {
        container.innerHTML = "<p>Nenhum dado encontrado.</p>";
        return;
    }

    currentRecords.forEach(record => {
        const card = document.createElement("div");
        card.classList.add("card");

        if (record.thumbnail) {
            const img = document.createElement("img");
            img.src = record.thumbnail;
            img.alt = "Imagem do card";
            card.appendChild(img);
        }

        const title = document.createElement("h2");
        title.innerText = record.title || "Sem título";
        title.contentEditable = "true";
        card.appendChild(title);

        const subtitle = document.createElement("p");
        subtitle.innerText = record.subtitle || "";
        subtitle.contentEditable = "true";
        card.appendChild(subtitle);

        const extraContainer = document.createElement("div");
        extraContainer.classList.add("extra-fields");
        if (record.extras) {
            record.extras.forEach(extraField => {
                const extraItem = document.createElement("p");
                extraItem.innerText = extraField;
                extraContainer.appendChild(extraItem);
            });
        }
        card.appendChild(extraContainer);

        // Icons
        const iconsDiv = document.createElement("div");
        iconsDiv.classList.add("icons");

        const editIcon = document.createElement("span");
        editIcon.innerHTML = "📝";
        editIcon.onclick = () => card.classList.toggle("editing");

        const popupIcon = document.createElement("span");
        popupIcon.innerHTML = "🔍";
        popupIcon.onclick = () => showPopup(record);

        const saveIcon = document.createElement("span");
        saveIcon.innerHTML = "💾";
        saveIcon.classList.add("save-icon");
        saveIcon.onclick = () => saveData(record.id, title.innerText, subtitle.innerText);

        iconsDiv.appendChild(editIcon);
        iconsDiv.appendChild(popupIcon);
        iconsDiv.appendChild(saveIcon);

        card.appendChild(iconsDiv);
        container.appendChild(card);
    });
}

function showPopup(record) {
    const modal = document.getElementById("modal");
    document.getElementById("modal-title").innerText = record.title;
    document.getElementById("modal-body").innerText = JSON.stringify(record, null, 2);
    modal.style.display = "block";
}

function saveData(id, title, subtitle) {
    grist.docApi.applyUserActions([["UpdateRecord", "Table", id, { title, subtitle }]]);
    alert("Salvo!");
}

// Close Modal
document.querySelector(".close").onclick = () => document.getElementById("modal").style.display = "none";

if (grist.accessLevel === "full") fetchData();
else grist.onRecords((records) => { currentRecords = records; renderCards(); });
