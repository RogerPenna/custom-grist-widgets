// libraries/grist-field-renderer/renderers/render-image.js

export async function renderImage(options) {
    const { container, cellValue, isEditing, fieldStyle, tableLens } = options;
    const widgetOptions = fieldStyle?.widgetOptions || {};

    if (isEditing) {
        container.innerHTML = `<input type="text" class="grf-form-input" value="${cellValue || ''}" placeholder="URL da Imagem">`;
        const input = container.querySelector('input');
        input.onchange = () => options.onUpdate(input.value);
        return;
    }

    container.innerHTML = '';
    
    if (!cellValue) {
        container.innerHTML = '<span class="grf-readonly-empty">(sem imagem)</span>';
        return;
    }

    let imageUrl = '';
    
    // Grist Attachment support (can be a single ID or an array of IDs like ["L", 12, 13])
    const isAttachment = (Array.isArray(cellValue) && cellValue[0] === 'L') || (typeof cellValue === 'number');

    if (isAttachment && tableLens) {
        try {
            const attachmentId = Array.isArray(cellValue) ? cellValue[1] : cellValue;
            if (attachmentId) {
                const token = await tableLens.getAccessToken();
                const baseUrl = await tableLens.getBaseUrl();
                if (token && baseUrl) {
                    imageUrl = `${baseUrl}/attachments/${attachmentId}/download?auth=${token}`;
                }
            }
        } catch (e) {
            console.error("renderImage: Erro ao resolver anexo do Grist", e);
        }
    } else if (typeof cellValue === 'string' && cellValue.startsWith('[')) {
        // Fallback for string-encoded JSON arrays
        try {
            const parsed = JSON.parse(cellValue);
            if (Array.isArray(parsed) && parsed.length > 0) {
                imageUrl = parsed[0]; 
            }
        } catch (e) {}
    } else {
        imageUrl = String(cellValue);
    }

    if (!imageUrl) {
        container.innerHTML = '<span class="grf-readonly-empty">(sem imagem)</span>';
        return;
    }

    const img = document.createElement('img');
    img.src = imageUrl;
    
    img.style.maxWidth = '100%'; // Always prevent container overflow

    if (widgetOptions.imageSize) {
        const sizePx = `${widgetOptions.imageSize}px`;
        const constraint = widgetOptions.imageConstraint || 'width';
        
        if (constraint === 'width') {
            img.style.width = sizePx;
            img.style.height = 'auto';
        } else if (constraint === 'height') {
            img.style.width = 'auto';
            img.style.height = sizePx;
        } else if (constraint === 'both') {
            img.style.width = sizePx;
            img.style.height = sizePx;
        }
    } else {
        // Fallback for old configs
        img.style.width = widgetOptions.maxWidth || widgetOptions.width || '100%';
        img.style.height = widgetOptions.maxHeight || widgetOptions.height || 'auto';
    }

    img.style.objectFit = widgetOptions.objectFit || 'cover';
    img.style.borderRadius = widgetOptions.borderRadius || '4px';
    img.style.display = 'block';

    // Handle error
    img.onerror = () => {
        container.innerHTML = `<span style="font-size:10px; color:#999;">Falha ao carregar imagem</span>`;
    };

    container.appendChild(img);
}
