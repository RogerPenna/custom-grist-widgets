// ✅ Setup Grist Widget Configuration
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

// ✅ Debugging: Confirm Grist is passing correct field mappings
grist.onOptions((options) => {
    console.log("📢 Field Mappings Received from Grist:", options);

    if (options.mappings) {
        fieldMappings = options.mappings;
    } else {
        console.error("⚠ Field mappings are missing!");
    }
    renderCards();
});

// ✅ Debugging: Check if Grist is sending records
grist.onRecords((records) => {
    console.log("📢 Records Received from Grist:", records.records);

    if (records.records && records.records.length > 0) {
        currentRecords = records.records;
    } else {
        console.error("⚠ No records received from Grist.");
        currentRecords = [];
    }
    renderCards();
});

// ✅ Render Cards with Correct Data
function renderCards() {
    const container = document.getElementById("cards");
    container.innerHTML = "";

    if (currentRecords.length === 0) {
        console.warn("⚠ No records available to display.");
        container.innerHTML = "<p style='color:red;'>⚠ Nenhum dado disponível.</p>";
        return;
    }

    currentRecords.forEach(record => {
        const card = document.createElement("div");
        card.className = "card";

        // ✅ Ensure mapped fields exist before using them
        const titleText = fieldMappings.title ? record[fieldMappings.title] || "Sem título" : "Sem título";
        const subtitleText = fieldMappings.subtitle ? record[fieldMappings.subtitle] || "" : "";
        const imageUrl = fieldMappings.image ? record[fieldMappings.image] || "https://via.placeholder.com/150" : "";

        // ✅ Title
        const title = document.createElement("div");
        title.className = "card-title";
        title.textContent = titleText;
        card.appendChild(title);

        // ✅ Subtitle (if exists)
        if (subtitleText) {
            const subtitle = document.createElement("div");
            subtitle.className = "card-subtitle";
            subtitle.textContent = subtitleText;
            card.appendChild(subtitle);
        }

        // ✅ Image (if exists)
        if (fieldMappings.image) {
            const img = document.createElement("img");
            img.src = imageUrl;
            card.appendChild(img);
        }

        // ✅ Extra Fields (if mapped)
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
