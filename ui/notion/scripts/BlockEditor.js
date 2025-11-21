// ui/notion/scripts/block_editor.js
export class BlockEditor {
    constructor(collectionViewer) {
        this.viewer = collectionViewer;
    }

    async createTextBlockAfter(blockId) {
        const index = this.viewer.orderList.indexOf(blockId) + 1;
        const newBlock = await this.viewer.apiInteractor.createEmptyTextBlock(this.viewer.currentCollectionId, index);
        this.viewer.contentMap[newBlock.id] = newBlock;
        this.viewer.orderList.splice(index, 0, newBlock.id);
        await this.viewer.apiInteractor.updateOrderList(this.viewer.currentCollectionId, this.viewer.orderList);
        this.viewer.blockRenderer.renderBlocks(this.viewer.notionPage, this.viewer.orderList, this.viewer.contentMap, (id) => this.handleDeleteBlock(id));
        this.focusBlock(newBlock.id, 'start');
    }

    async createListBlockAfter(blockId) {
        const currentBlock = this.viewer.contentMap[blockId];
        const listType = currentBlock.list_type || 'bullet';
        const index = this.viewer.orderList.indexOf(blockId) + 1;

        const payload = { type: 'list', content: '', list_type: listType, index };
        const response = await fetch(`${this.viewer.apiInteractor.API_BASE_URL}/collections/${this.viewer.currentCollectionId}/blocks`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'accept': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (!response.ok) throw new Error('Failed to create list block');
        const newBlock = await response.json();

        this.viewer.contentMap[newBlock.id] = newBlock;
        this.viewer.orderList.splice(index, 0, newBlock.id);
        await this.viewer.apiInteractor.updateOrderList(this.viewer.currentCollectionId, this.viewer.orderList);
        this.viewer.blockRenderer.renderBlocks(this.viewer.notionPage, this.viewer.orderList, this.viewer.contentMap, (id) => this.handleDeleteBlock(id));
        this.focusBlock(newBlock.id, 'start');
    }

    async createTableBlock(blockId = null) {
        const emptyGrid = Array(3).fill().map(() => Array(3).fill(''));

        const payload = {
            type: 'table',
            content: emptyGrid,
            row_count: 3,
            column_count: 3
        };

        if (blockId) {
            const old = this.viewer.contentMap[blockId];
            payload.id = old.id;
        }

        const response = await fetch(`${this.viewer.apiInteractor.API_BASE_URL}/collections/${this.viewer.currentCollectionId}/blocks`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (!response.ok) return;

        const newBlock = await response.json();

        if (blockId) {
            this.viewer.contentMap[blockId] = newBlock;
        } else {
            this.viewer.contentMap[newBlock.id] = newBlock;
            this.viewer.orderList.push(newBlock.id);
            await this.viewer.apiInteractor.updateOrderList(this.viewer.currentCollectionId, this.viewer.orderList);
        }

        this.viewer.blockRenderer.renderBlocks(this.viewer.notionPage, this.viewer.orderList, this.viewer.contentMap, (id) => this.handleDeleteBlock(id));
        if (blockId) this.focusBlock(blockId, 'start');
    }

    async saveBlockContent(blockId, newContent) {
        const block = this.viewer.contentMap[blockId];
        if (!block) return;

        if (block.type === 'table') {
            const table = this.viewer.notionPage.querySelector(`[data-block-id="${blockId}"] table`);
            if (!table) return;
            const rows = Array.from(table.querySelectorAll('tr'));
            const newGrid = rows.map(row => Array.from(row.querySelectorAll('th, td')).map(cell => cell.textContent));

            const payload = { ...block, content: newGrid };
            delete payload.qdrant_collection_name;
            delete payload.user_id;
            delete payload.tag_id;
            delete payload.name;
            delete payload.collection_id;

            try {
                const saved = await this.viewer.apiInteractor.saveBlockContent(this.viewer.currentCollectionId, payload);
                this.viewer.contentMap[blockId] = saved;
            } catch (e) {
                console.error('Table save error:', e);
            }
            return;
        }

        if (block.type !== 'link' && block.content === newContent) return;

        let payload = { ...block };
        
        // ИСПРАВЛЕНИЕ: для ссылок обновляем content вместо link_text
        if (block.type === 'link') {
            payload.content = newContent; // ОТПРАВЛЯЕМ В CONTENT
            delete payload.link_text; // УДАЛЯЕМ link_text из payload
        } else {
            payload.content = newContent;
        }

        delete payload.qdrant_collection_name;
        delete payload.user_id;
        delete payload.tag_id;
        delete payload.name;
        delete payload.collection_id;

        try {
            const saved = await this.viewer.apiInteractor.saveBlockContent(this.viewer.currentCollectionId, payload);
            this.viewer.contentMap[blockId] = saved;
        } catch (e) {
            console.error('Block save error:', e);
        }
    }

    async saveLinkText(blockId, newLinkText) {
        const block = this.viewer.contentMap[blockId];
        if (!block || block.type !== 'link') return;

        // ИСПРАВЛЕНИЕ: полностью переписан метод - теперь сохраняем текст ссылки в content
        const payload = { ...block, content: newLinkText };
        delete payload.link_text;
        delete payload.qdrant_collection_name;
        delete payload.user_id;
        delete payload.tag_id;
        delete payload.name;
        delete payload.collection_id;

        try {
            const saved = await this.viewer.apiInteractor.saveBlockContent(this.viewer.currentCollectionId, payload);
            this.viewer.contentMap[blockId] = saved;
            this.viewer.blockRenderer.renderBlocks(this.viewer.notionPage, this.viewer.orderList, this.viewer.contentMap, (id) => this.handleDeleteBlock(id));
        } catch (e) {
            console.error('Save link error:', e);
        }
    }

    async resizeTableWithKeys(blockId, deltaRows, deltaCols) {
        const block = this.viewer.contentMap[blockId];
        if (!block || block.type !== 'table') return;

        let currentRows = block.row_count || block.content?.length || 3;
        let currentCols = block.column_count || (block.content?.[0]?.length) || 3;

        const newRows = Math.max(1, currentRows + deltaRows);
        const newCols = Math.max(1, currentCols + deltaCols);

        if (newRows === currentRows && newCols === currentCols) return;

        const oldGrid = block.content || [];
        const newGrid = [];

        for (let i = 0; i < newRows; i++) {
            const row = [];
            for (let j = 0; j < newCols; j++) {
                row.push((oldGrid[i] && oldGrid[i][j]) || '');
            }
            newGrid.push(row);
        }

        const payload = {
            ...block,
            content: newGrid,
            row_count: newRows,
            column_count: newCols
        };

        delete payload.qdrant_collection_name;
        delete payload.user_id;
        delete payload.tag_id;
        delete payload.name;
        delete payload.collection_id;

        try {
            const saved = await this.viewer.apiInteractor.saveBlockContent(this.viewer.currentCollectionId, payload);
            this.viewer.contentMap[blockId] = saved;
            this.viewer.blockRenderer.renderBlocks(this.viewer.notionPage, this.viewer.orderList, this.viewer.contentMap, (id) => this.handleDeleteBlock(id));
            // ИСПРАВЛЕНИЕ: возвращаем фокус на таблицу после изменения размера
            setTimeout(() => this.focusBlock(blockId, 'start'), 100);
        } catch (e) {
            console.error('Resize table error:', e);
        }
    }

    async replaceBlock(blockId, newTypeRaw, currentContent) {
        const existingBlock = this.viewer.contentMap[blockId];
        if (!existingBlock) return;

        if (newTypeRaw === 'table') {
            this.createTableBlock(blockId);
            return;
        }

        const parts = newTypeRaw.toLowerCase().split(' ');
        const type = parts[0];
        let cleanContent = currentContent.trim();

        let blockPayload = { ...existingBlock };
        delete blockPayload.qdrant_collection_name;
        delete blockPayload.user_id;
        delete blockPayload.tag_id;
        delete blockPayload.name;
        delete blockPayload.collection_id;
        delete blockPayload.level;
        delete blockPayload.list_type;
        delete blockPayload.media_type;
        delete blockPayload.file_path;
        delete blockPayload.file_name;
        delete blockPayload.link_text;

        switch (type) {
            case 'text':
                blockPayload.type = 'text';
                blockPayload.content = cleanContent;
                break;
            case 'header':
                const levelMatch = newTypeRaw.match(/(\d)$/);
                blockPayload.type = 'header';
                blockPayload.content = cleanContent;
                blockPayload.level = levelMatch ? parseInt(levelMatch[1]) : 1;
                break;
            case 'list':
                const listType = newTypeRaw.toLowerCase().includes('number') ? 'number' : 'bullet';
                blockPayload.type = 'list';
                blockPayload.content = cleanContent;
                blockPayload.list_type = listType;
                break;
            case 'link':
                blockPayload.type = 'link';
                blockPayload.media_type = 'link';
                blockPayload.content = 'https://';
                break;
            default:
                return;
        }

        try {
            const newBlockData = await this.viewer.apiInteractor.replaceBlock(this.viewer.currentCollectionId, blockPayload);
            this.viewer.contentMap[blockId] = newBlockData;
            this.viewer.blockRenderer.renderBlocks(this.viewer.notionPage, this.viewer.orderList, this.viewer.contentMap, (id) => this.handleDeleteBlock(id));
            if (type === 'link') this.focusBlock(blockId, 'start');
            else this.focusBlock(blockId, 'end');
        } catch (error) {
            console.error('Error replacing block:', error);
        }
    }

    handleFileUploadReplace(blockId) {
        const fileInput = document.createElement('input');
        fileInput.type = 'file';
        fileInput.click();

        fileInput.onchange = async (e) => {
            const file = e.target.files[0];
            if (!file) {
                fileInput.remove();
                return;
            }

            const mediaType = prompt("Тип файла (photo, audio, document):", 'document')?.trim().toLowerCase();
            if (!mediaType || !['photo', 'audio', 'document'].includes(mediaType)) {
                alert('Неверный тип файла.');
                fileInput.remove();
                return;
            }

            try {
                const updatedBlock = await this.viewer.apiInteractor.uploadFile(this.viewer.currentCollectionId, blockId, mediaType, file);
                this.viewer.contentMap[blockId] = updatedBlock;
                this.viewer.blockRenderer.renderBlocks(this.viewer.notionPage, this.viewer.orderList, this.viewer.contentMap, (id) => this.handleDeleteBlock(id));
                this.focusBlock(blockId, 'start');
            } catch (error) {
                alert('Ошибка загрузки файла.');
                console.error('File upload error:', error);
            } finally {
                fileInput.remove();
            }
        };
    }

    async handleDeleteBlock(blockId, focusPrevious = false) {
        if (!this.viewer.currentCollectionId || !blockId) return;

        const wrapper = this.viewer.notionPage.querySelector(`[data-block-id="${blockId}"]`);
        const prevWrapper = wrapper ? wrapper.previousElementSibling : null;

        try {
            await this.viewer.apiInteractor.deleteBlock(this.viewer.currentCollectionId, blockId);
            delete this.viewer.contentMap[blockId];
            this.viewer.orderList = this.viewer.orderList.filter(id => id !== blockId);
            await this.viewer.apiInteractor.updateOrderList(this.viewer.currentCollectionId, this.viewer.orderList);
            this.viewer.blockRenderer.renderBlocks(this.viewer.notionPage, this.viewer.orderList, this.viewer.contentMap, (id) => this.handleDeleteBlock(id));

            if (focusPrevious && prevWrapper) {
                const prevId = prevWrapper.getAttribute('data-block-id');
                this.focusBlock(prevId, 'end');
            }
        } catch (error) {
            console.error('Error deleting block:', error);
        }
    }

    focusBlock(blockId, position = 'start') {
        const wrapper = this.viewer.notionPage.querySelector(`[data-block-id="${blockId}"]`);
        if (!wrapper) return;

        const editable = wrapper.querySelector('.notion-block-editable') || wrapper.querySelector('.link-editing') || wrapper.querySelector('.notion-table') || wrapper.querySelector('.file-block-content');
        if (!editable) return;

        editable.focus();

        if (editable.isContentEditable || editable.tagName === 'INPUT') {
            const range = document.createRange();
            const sel = window.getSelection();
            const node = editable.firstChild || editable;
            const pos = position === 'start' ? 0 : (node.textContent?.length || node.value?.length || 0);
            range.setStart(node, pos);
            range.collapse(true);
            sel.removeAllRanges();
            sel.addRange(range);
        }
    }
}