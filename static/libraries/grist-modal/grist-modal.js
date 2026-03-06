// libraries/grist-modal/grist-modal.js
const ModalComponent = (() => {
    let modalOverlay = null;

function openModalWithIframe(url, options = {}) {
    if (modalOverlay) {
        closeModal();
    }

    const width = options.width || '80%';
    const height = options.height || '90%';

    modalOverlay = document.createElement('div');
    modalOverlay.className = 'grf-modal-overlay';

    const modalContent = document.createElement('div');
    modalContent.className = 'grf-modal-content';
    modalContent.style.width = width;
    modalContent.style.height = height;

    const modalHeader = document.createElement('div');
    modalHeader.className = 'grf-modal-header';
    
    const closeButton = document.createElement('button');
    closeButton.innerHTML = '×';
    closeButton.className = 'grf-modal-close';
    closeButton.onclick = closeModal;

    modalHeader.appendChild(closeButton);

    const iframe = document.createElement('iframe');

    // --- INÍCIO DA CORREÇÃO CRÍTICA ---
    // Damos ao iframe as permissões necessárias para que a API do Grist funcione.
    iframe.sandbox = 'allow-scripts allow-same-origin allow-forms allow-popups';
    // --- FIM DA CORREÇÃO CRÍTICA ---

    iframe.src = url;
    iframe.className = 'grf-modal-iframe';

    modalContent.appendChild(modalHeader);
    modalContent.appendChild(iframe);
    modalOverlay.appendChild(modalContent);
    document.body.appendChild(modalOverlay);

    modalOverlay.addEventListener('click', (e) => {
        if (e.target === modalOverlay) {
            closeModal();
        }
    });
}

    function closeModal() {
        if (modalOverlay && modalOverlay.parentNode) {
            modalOverlay.parentNode.removeChild(modalOverlay);
        }
        modalOverlay = null;
    }

    return {
        openModalWithIframe,
        closeModal
    };
})();