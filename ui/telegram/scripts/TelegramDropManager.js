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

        // Делаем ВСЕ сообщения draggable
        const makeMessagesDraggable = () => {
            container.querySelectorAll('.message').forEach(msgEl => {
                if (msgEl.hasAttribute('draggable')) return;

                msgEl.draggable = true;
                msgEl.style.cursor = 'grab';
                msgEl.title = 'Перетащите в Notion, чтобы добавить как блок';

                msgEl.addEventListener('dragstart', (e) => {
                    const messageId = msgEl.dataset.messageId;
                    if (!messageId) return;

                    msgEl.classList.add('tg-dragging');

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

        makeMessagesDraggable();
        const originalRenderMessages = this.telegramViewer.renderMessages.bind(this.telegramViewer);
        this.telegramViewer.renderMessages = (...args) => {
            originalRenderMessages(...args);
            setTimeout(makeMessagesDraggable, 50);
        };

        // === ИСПРАВЛЕННАЯ ЛОГИКА ПРИЁМА ПЕРЕТАСКИВАНИЯ ===
        let currentDropTarget = null;

        this.collectionViewer.notionPage.addEventListener('dragover', (e) => {
            if (!e.dataTransfer.types.includes('application/x-tg-message')) return;

            const wrapper = e.target.closest('.block-wrapper[data-block-type="text"]');
            if (!wrapper) {
                if (currentDropTarget) {
                    currentDropTarget.classList.remove('tg-drop-target');
                    currentDropTarget = null;
                }
                return;
            }

            const editable = wrapper.querySelector('.notion-block-editable');
            if (!editable) return;

            const text = (editable.textContent || editable.innerText || '').trim();
            if (text !== '') return; // только пустые блоки

            e.preventDefault();
            e.dataTransfer.dropEffect = 'copy';

            // Снимаем подсветку с предыдущего блока
            if (currentDropTarget && currentDropTarget !== wrapper) {
                currentDropTarget.classList.remove('tg-drop-target');
            }

            wrapper.classList.add('tg-drop-target');
            currentDropTarget = wrapper;
        });

        // Снимаем подсветку только когда действительно вышли за пределы всей страницы
        this.collectionViewer.notionPage.addEventListener('dragleave', (e) => {
            if (!e.relatedTarget || !this.collectionViewer.notionPage.contains(e.relatedTarget)) {
                if (currentDropTarget) {
                    currentDropTarget.classList.remove('tg-drop-target');
                    currentDropTarget = null;
                }
            }
        });

        this.collectionViewer.notionPage.addEventListener('drop', async (e) => {
            e.preventDefault();

            // Сбрасываем подсветку в любом случае
            if (currentDropTarget) {
                currentDropTarget.classList.remove('tg-drop-target');
            }

            const wrapper = e.target.closest('.block-wrapper[data-block-type="text"]');
            if (!wrapper) {
                currentDropTarget = null;
                return;
            }

            const editable = wrapper.querySelector('.notion-block-editable');
            if (!editable || (editable.textContent || '').trim() !== '') {
                currentDropTarget = null;
                return;
            }

            const blockId = wrapper.dataset.blockId;
            if (!blockId) {
                currentDropTarget = null;
                return;
            }

            const json = e.dataTransfer.getData('application/x-tg-message');
            if (!json) {
                currentDropTarget = null;
                return;
            }

            let payload;
            try { payload = JSON.parse(json); } catch (err) {
                currentDropTarget = null;
                return;
            }

            currentDropTarget = null;
            await this.replaceTextBlock(blockId, payload.chatId, payload.messageId);
        });

        // На случай отмены перетаскивания (Esc, бросили за пределы окна и т.д.)
        document.addEventListener('dragend', () => {
            if (currentDropTarget) {
                currentDropTarget.classList.remove('tg-drop-target');
                currentDropTarget = null;
            }
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
            newBlockData.id = targetBlockId;

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