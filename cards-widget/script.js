// Definir os campos esperados para o mapeamento dinâmico
grist.ready({
    columns: [
        { name: "title", title: "Título", type: "Text", optional: false },
        { name: "subtitle", title: "Subtítulo", type: "Text", optional: true },
        { name: "thumbnail", title: "Imagem (URL)", type: "Text", optional: true },
        { name: "extras", title: "Colunas Extras", type: "Any", allowMultiple: true, optional: true }
    ],
    requiredAccess: "read table"
});

function renderCards(records, mappings) {
    const container = document.getElementById("card-container");
    container.innerHTML = "";

    if (!records || records.length === 0) {
        container.innerHTML = "<p>Nenhum dado encontrado.</p>";
        return;
    }

    records.forEach(record => {
        const mapped = grist.mapColumnNames(record);
        if (!mapped) return;

        const card = document.createElement("div");
        card.classList.add("card");

        // Adiciona imagem se houver
        if (mapped.thumbnail) {
            const img = document.createElement("img");
            img.src = mapped.thumbnail;
            img.alt = "Imagem do card";
            card.appendChild(img);
        }

        // Adiciona título
        const title = document.createElement("h2");
        title.innerText = mapped.title || "Sem título";
        card.appendChild(title);

        // Adiciona subtítulo, se existir
        if (mapped.subtitle) {
            const subtitle = document.createElement("p");
            subtitle.innerText = mapped.subtitle;
            card.appendChild(subtitle);
        }

        // Adiciona colunas extras, se existirem
        if (mapped.extras) {
            const extraContainer = document.createElement("div");
            extraContainer.classList.add("extra-fields");

            mapped.extras.forEach(extraField => {
                const extraItem = document.createElement("p");
                extraItem.innerText = extraField;
                extraContainer.appendChild(extraItem);
            });

            card.appendChild(extraContainer);
        }

        container.appendChild(card);
    });
}

// Atualiza os cards quando os dados mudam
grist.onRecords((records, mappings) => {
    renderCards(records, mappings);
});
