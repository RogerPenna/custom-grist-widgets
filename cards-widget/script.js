grist.ready({
    columns: [
        { name: "title", title: "Título", type: "Text", optional: false },
        { name: "subtitle", title: "Subtítulo", type: "Text", optional: true },
        { name: "thumbnail", title: "Imagem (URL)", type: "Text", optional: true },
        { name: "extras", title: "Colunas Extras", type: "Any", allowMultiple: true, optional: true }
    ],
    requiredAccess: "full"
});

async function fetchData() {
    try {
        // Get list of tables in the document
        const tables = await grist.docApi.listTables();
        if (tables.length === 0) return;

        // Assume the first table is the selected one
        const tableId = tables[0];  
        const tableData = await grist.docApi.fetchTable(tableId);

        // Convert the table data to a record array format
        const records = Object.keys(tableData)
            .filter(key => key !== 'id')
            .map(key => ({ id: key, ...tableData[key] }));

        renderCards(records);
    } catch (error) {
        console.error("Error fetching table data:", error);
    }
}

function renderCards(records) {
    const container = document.getElementById("card-container");
    container.innerHTML = "";

    if (!records || records.length === 0) {
        container.innerHTML = "<p>Nenhum dado encontrado.</p>";
        return;
    }

    records.forEach(record => {
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
        card.appendChild(title);

        if (record.subtitle) {
            const subtitle = document.createElement("p");
            subtitle.innerText = record.subtitle;
            card.appendChild(subtitle);
        }

        if (record.extras) {
            const extraContainer = document.createElement("div");
            extraContainer.classList.add("extra-fields");
            record.extras.forEach(extraField => {
                const extraItem = document.createElement("p");
                extraItem.innerText = extraField;
                extraContainer.appendChild(extraItem);
            });
            card.appendChild(extraContainer);
        }

        container.appendChild(card);
    });
}

// If using full access, fetch data manually
if (grist.accessLevel === "full") {
    fetchData();
} else {
    // Listen for automatic updates (works only in partial access)
    grist.onRecords((records) => {
        renderCards(records);
    });
}
