// ui/telegram/scripts/TelegramDropManager.js
export class TelegramDropManager {
    constructor(telegramViewer, collectionViewer, apiBaseUrl) {
        this.telegramViewer = telegramViewer;
        this.collectionViewer = collectionViewer;
        this.apiBaseUrl = apiBaseUrl;
        this.init();
    }

    init() {
        const container = this.telegramViewer.messagesContainer;

        // Делаем ВСЕ сообщения draggable (даже если внутри нет медиа)
        const makeMessagesDraggable = () => {
            container.querySelectorAll('.message').forEach(msgEl => {
                if (msgEl.hasAttribute('draggable')) return; // уже обработано

                msgEl.draggable = true;
                msgEl.style.cursor = 'grab';
                msgEl.title = 'Перетащите в Notion, чтобы добавить как блок';

                msgEl.addEventListener('dragstart', (e) => {
                    const messageId = msgEl.dataset.messageId;
                    if (!messageId) return;

                    // Подсветка
                    msgEl.classList.add('tg-dragging');

                    // Передаём данные
                    e.dataTransfer.effectAllowed = 'copy';
                    e.dataTransfer.setData('application/x-tg-message', JSON.stringify({
                        chatId: this.telegramViewer.currentChatId,
                        messageId: parseInt(messageId)
                    }));

                    // Красивый ghost
                    const ghost = document.createElement('div');
                    ghost.textContent = 'Telegram → Notion';
                    ghost.style.cssText = `
                        position: absolute; top: -1000px; padding: 6px 12px;
                        background: #d9b981; color: white; border-radius: 6px;
                        font-size: 0.85em; font-weight: 500; pointer-events: none;
                        box-shadow: 0 4px 12px rgba(0,0,0,0.2);
                    `;
                    document.body.appendChild(ghost);
                    e.dataTransfer.setDragImage(ghost, 15, 15);
                    setTimeout(() => ghost.remove(), 0);
                });

                msgEl.addEventListener('dragend', () => {
                    msgEl.classList.remove('tg-dragging');
                });
            });
        };

        // Запускаем сразу + после каждой подгрузки сообщений
        makeMessagesDraggable();

        // Подписываемся на новую отрисовку сообщений
        const originalRenderMessages = this.telegramViewer.renderMessages.bind(this.telegramViewer);
        this.telegramViewer.renderMessages = (...args) => {
            originalRenderMessages(...args);
            setTimeout(makeMessagesDraggable, 50); // небольшая задержка, чтобы DOM успел обновиться
        };

        // Приёмная зона — только пустые text-блоки в Notion
        this.collectionViewer.notionPage.addEventListener('dragover', (e) => {
            if (!e.dataTransfer.types.includes('application/x-tg-message')) return;

            const wrapper = e.target.closest('.block-wrapper[data-block-type="text"]');
            if (!wrapper) return;

            const editable = wrapper.querySelector('.notion-block-editable');
            if (!editable) return;

            const text = editable.textContent || editable.innerText || '';
            if (text.trim() !== '') return;

            e.preventDefault();
            e.dataTransfer.dropEffect = 'copy';
            wrapper.classList.add('tg-drop-target');
        });

        this.collectionViewer.notionPage.addEventListener('dragleave', (e) => {
            const wrapper = e.target.closest('.block-wrapper');
            if (wrapper && !this.collectionViewer.notionPage.contains(e.relatedTarget)) {
                wrapper.classList.remove('tg-drop-target');
            }
        });

        this.collectionViewer.notionPage.addEventListener('drop', async (e) => {
            e.preventDefault();

            const wrapper = e.target.closest('.block-wrapper[data-block-type="text"]');
            if (!wrapper) return;
            wrapper.classList.remove('tg-drop-target');

            const editable = wrapper.querySelector('.notion-block-editable');
            if (!editable || (editable.textContent || '').trim() !== '') return;

            const blockId = wrapper.dataset.blockId;
            if (!blockId) return;

            const json = e.dataTransfer.getData('application/x-tg-message');
            if (!json) return;

            let payload;
            try { payload = JSON.parse(json); } catch (err) { return; }

            await this.replaceTextBlock(blockId, payload.chatId, payload.messageId);
        });
    }

    async replaceTextBlock(targetBlockId, chatId, messageId) {
        if (!this.collectionViewer.currentCollectionId) {
            alert('Выберите коллекцию');
            return;
        }

        try {
            const url = `${this.apiBaseUrl}/tg/${chatId}/${messageId}/block`;
            const resp = await fetch(url, { headers: { accept: 'application/json' } });
            if (!resp.ok) throw new Error(`HTTP ${resp.status}`);

            const newBlockData = await resp.json();
            newBlockData.id = targetBlockId; // ← замена по id

            const saved = await this.collectionViewer.apiInteractor.replaceBlock(
                this.collectionViewer.currentCollectionId,
                newBlockData
            );

            this.collectionViewer.contentMap[targetBlockId] = saved;

            await this.collectionViewer.blockRenderer.renderBlocks(
                this.collectionViewer.notionPage,
                this.collectionViewer.orderList,
                this.collectionViewer.contentMap,
                (id) => this.collectionViewer.blockEditor.handleDeleteBlock(id)
            );

            await new Promise(r => setTimeout(r, 0));
            this.collectionViewer.blockEditor.focusBlock(targetBlockId, 'end');

        } catch (err) {
            console.error('Telegram → Notion failed:', err);
            alert('Ошибка добавления сообщения');
        }
    }
}