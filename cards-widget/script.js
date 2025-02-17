grist.ready({
    columns: [
        { name: "Title", title: "Title Field", type: "Text" },
        { name: "Subtitle", title: "Subtitle Field", type: "Text", optional: true },
        { name: "Image", title: "Image URL", type: "Text", optional: true },
        { name: "ExtraFields", title: "Additional Fields", type: "Any", allowMultiple: true }
    ],
    requiredAccess: "read table"
});

grist.onRecords((records, mappings) => {
    const container = document.getElementById("cards");
    container.innerHTML = ""; // Clear existing cards

    records.forEach(record => {
        const mapped = grist.mapColumnNames(record);
        if (!mapped) return; // Skip if not all required fields are mapped

        const card = document.createElement("div");
        card.className = "card";

        // Title
        const title = document.createElement("div");
        title.className = "card-title";
        title.textContent = mapped.Title || "Untitled";
        card.appendChild(title);

        // Subtitle (if exists)
        if (mapped.Subtitle) {
            const subtitle = document.createElement("div");
            subtitle.className = "card-subtitle";
            subtitle.textContent = mapped.Subtitle;
            card.appendChild(subtitle);
        }

        // Image (if exists)
        if (mapped.Image) {
            const img = document.createElement("img");
            img.src = mapped.Image;
            img.alt = "Image";
            card.appendChild(img);
        }

        // Extra Fields
        if (mappings.ExtraFields && mappings.ExtraFields.length > 0) {
            const extraFieldsDiv = document.createElement("div");
            extraFieldsDiv.className = "extra-fields";

            mappings.ExtraFields.forEach(field => {
                const fieldDiv = document.createElement("div");
                fieldDiv.innerHTML = `<strong>${field}:</strong> ${record[field] || "N/A"}`;
                extraFieldsDiv.appendChild(fieldDiv);
            });

            card.appendChild(extraFieldsDiv);
        }

        container.appendChild(card);
    });
});
