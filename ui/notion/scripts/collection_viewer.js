export class CollectionViewer {
    constructor() {
        this.currentCollection = null;
        this.currentCollectionId = null;
        this.collectionNameDisplay = document.getElementById('collection-name-display');
        this.collectionNameInput = document.getElementById('collection-name-input');
        this.tagMetaSpan = document.getElementById('tag-meta-span');
        this.collectionTagSelect = document.getElementById('collection-tag-select');
        this.notionPage = document.querySelector('.notion-page');
        this.init();
    }

    init() {
        this.bindEvents();
    }

    bindEvents() {
        // Переключение между отображением и редактированием названия
        this.collectionNameDisplay.addEventListener('click', () => {
            this.startEditingName();
        });

        this.collectionNameInput.addEventListener('blur', () => {
            this.finishEditingName();
        });

        this.collectionNameInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.finishEditingName();
            }
        });

        // Обработка выбора тега для коллекции
        this.collectionTagSelect.addEventListener('change', (e) => {
            this.updateCollectionTag(e.target.value);
        });
    }

    async showCollection(collection) {
        this.currentCollection = collection;
        this.currentCollectionId = collection.qdrant_id;
        
        // Обновляем заголовок
        this.collectionNameDisplay.textContent = collection.name;
        this.collectionNameInput.value = collection.name;
        
        // Обновляем мета-информацию
        this.updateMetaInfo(collection);
        
        // Загружаем содержимое коллекции
        await this.loadCollectionContent();
    }

    updateMetaInfo(collection) {
        if (collection.tag_id) {
            this.tagMetaSpan.innerHTML = `<i class="fas fa-tags"></i> Tag: ${collection.tag_name || 'Loading...'}`;
            this.collectionTagSelect.style.display = 'inline-block';
            this.loadAvailableTags();
        } else {
            this.tagMetaSpan.innerHTML = `<i class="fas fa-tags"></i> No tag`;
            this.collectionTagSelect.style.display = 'inline-block';
            this.loadAvailableTags();
        }
    }

    async loadAvailableTags() {
        try {
            const response = await fetch(`http://localhost:8000/tags?user_id=1`);
            const tags = await response.json();
            
            this.collectionTagSelect.innerHTML = '<option value="">No tag</option>';
            tags.forEach(tag => {
                const option = document.createElement('option');
                option.value = tag.id;
                option.textContent = tag.name;
                option.selected = tag.id === this.currentCollection.tag_id;
                this.collectionTagSelect.appendChild(option);
            });
        } catch (error) {
            console.error('Error loading tags:', error);
        }
    }

    async loadCollectionContent() {
        try {
            const response = await fetch(`http://localhost:8000/collections/${this.currentCollectionId}`);
            const data = await response.json();
            this.renderCollectionContent(data.collection);
        } catch (error) {
            console.error('Error loading collection content:', error);
            this.notionPage.innerHTML = '<p>Error loading collection content</p>';
        }
    }

    renderCollectionContent(blocks) {
        this.notionPage.innerHTML = '';
        
        // Сортируем блоки по порядку
        const sortedBlocks = blocks.sort((a, b) => (a.order || 0) - (b.order || 0));
        
        sortedBlocks.forEach(block => {
            const blockElement = this.createBlockElement(block);
            this.notionPage.appendChild(blockElement);
        });

        // Добавляем кнопку для добавления нового блока
        this.addNewBlockButton();
    }

    createBlockElement(block) {
        const blockDiv = document.createElement('div');
        blockDiv.className = 'content-block';
        blockDiv.dataset.blockId = block.id;
        blockDiv.dataset.blockType = block.type;

        let contentHTML = '';

        switch (block.type) {
            case 'header':
                contentHTML = this.createHeaderBlock(block);
                break;
            case 'text':
                contentHTML = this.createTextBlock(block);
                break;
            case 'list':
                contentHTML = this.createListBlock(block);
                break;
            case 'file':
                contentHTML = this.createFileBlock(block);
                break;
            case 'link':
                contentHTML = this.createLinkBlock(block);
                break;
            case 'table':
                contentHTML = this.createTableBlock(block);
                break;
        }

        blockDiv.innerHTML = contentHTML;
        
        // Добавляем кнопки управления блоком
        this.addBlockControls(blockDiv, block);
        
        return blockDiv;
    }

    createHeaderBlock(block) {
        return `<h${block.level} class="editable-header" contenteditable="true">${block.content}</h${block.level}>`;
    }

    createTextBlock(block) {
        return `<p class="editable-text" contenteditable="true">${block.content}</p>`;
    }

    createListBlock(block) {
        let listHTML = `<${block.list_type === 'number' ? 'ol' : 'ul'} class="editable-list">`;
        
        if (Array.isArray(block.content)) {
            block.content.forEach(item => {
                if (typeof item === 'object' && item.type === 'text') {
                    listHTML += `<li class="editable-list-item" contenteditable="true" data-item-id="${item.id}">${item.content}</li>`;
                } else if (typeof item === 'string') {
                    listHTML += `<li class="editable-list-item" contenteditable="true" data-item-id="${item}">Item</li>`;
                }
            });
        }
        
        listHTML += `</${block.list_type === 'number' ? 'ol' : 'ul'}>`;
        return listHTML;
    }

    createFileBlock(block) {
        switch (block.media_type) {
            case 'photo':
                return `<div class="file-block photo-block">
                    <img src="${block.file_path}" alt="${block.file_name}" style="max-width: 100%; height: auto;">
                    <div class="file-name" contenteditable="true">${block.file_name}</div>
                </div>`;
            
            case 'audio':
                return `<div class="file-block audio-block">
                    <audio controls>
                        <source src="${block.file_path}" type="audio/mpeg">
                        Your browser does not support the audio element.
                    </audio>
                    <div class="file-name" contenteditable="true">${block.file_name}</div>
                </div>`;
            
            case 'document':
                return `<div class="file-block document-block">
                    <a href="${block.file_path}" target="_blank" class="document-link">
                        <i class="fas fa-file"></i>
                        <span class="file-name" contenteditable="true">${block.file_name}</span>
                    </a>
                </div>`;
        }
    }

    createLinkBlock(block) {
        return `<div class="link-block">
            <a href="${block.content}" target="_blank" class="external-link" contenteditable="true">${block.content}</a>
        </div>`;
    }

    createTableBlock(block) {
        let tableHTML = '<table class="editable-table"><tbody>';
        
        if (Array.isArray(block.content)) {
            block.content.forEach((row, rowIndex) => {
                tableHTML += '<tr>';
                if (Array.isArray(row)) {
                    row.forEach((cell, cellIndex) => {
                        tableHTML += `<td class="editable-table-cell" contenteditable="true" data-row="${rowIndex}" data-col="${cellIndex}">${cell.content || ''}</td>`;
                    });
                }
                tableHTML += '</tr>';
            });
        }
        
        tableHTML += '</tbody></table>';
        return tableHTML;
    }

    addBlockControls(blockDiv, block) {
        const controlsDiv = document.createElement('div');
        controlsDiv.className = 'block-controls';
        
        controlsDiv.innerHTML = `
            <button class="block-btn add-block-btn" title="Add block below">
                <i class="fas fa-plus"></i>
            </button>
            <button class="block-btn delete-block-btn" title="Delete block">
                <i class="fas fa-times"></i>
            </button>
        `;

        blockDiv.appendChild(controlsDiv);

        // Обработчики для кнопок управления
        const addBtn = controlsDiv.querySelector('.add-block-btn');
        const deleteBtn = controlsDiv.querySelector('.delete-block-btn');

        addBtn.addEventListener('click', () => {
            this.showAddBlockModal(block.order + 1);
        });

        deleteBtn.addEventListener('click', () => {
            this.deleteBlock(block.id);
        });
    }

    addNewBlockButton() {
        const addButton = document.createElement('button');
        addButton.className = 'add-new-block-btn';
        addButton.innerHTML = '<i class="fas fa-plus"></i> Add Block';
        addButton.addEventListener('click', () => {
            this.showAddBlockModal();
        });
        this.notionPage.appendChild(addButton);
    }

    showAddBlockModal(afterOrder = null) {
        // Создаем модальное окно для выбора типа блока
        const modal = document.createElement('div');
        modal.className = 'block-type-modal';
        modal.innerHTML = `
            <div class="modal-content">
                <h3>Add New Block</h3>
                <div class="block-type-options">
                    <button class="block-type-option" data-type="text">Text</button>
                    <button class="block-type-option" data-type="header">Header</button>
                    <button class="block-type-option" data-type="list">List</button>
                    <button class="block-type-option" data-type="file">File</button>
                    <button class="block-type-option" data-type="link">Link</button>
                    <button class="block-type-option" data-type="table">Table</button>
                </div>
                <button class="close-modal">Cancel</button>
            </div>
        `;

        document.body.appendChild(modal);

        // Обработчики для выбора типа блока
        const options = modal.querySelectorAll('.block-type-option');
        options.forEach(option => {
            option.addEventListener('click', (e) => {
                const blockType = e.target.dataset.type;
                this.createNewBlock(blockType, afterOrder);
                modal.remove();
            });
        });

        // Закрытие модального окна
        const closeBtn = modal.querySelector('.close-modal');
        closeBtn.addEventListener('click', () => {
            modal.remove();
        });

        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.remove();
            }
        });
    }

    async createNewBlock(blockType, afterOrder = null) {
        const baseBlock = {
            type: blockType,
            order: afterOrder || this.getNextOrder()
        };

        let newBlock = {};

        switch (blockType) {
            case 'header':
                newBlock = { ...baseBlock, content: 'New Header', level: 1 };
                break;
            case 'text':
                newBlock = { ...baseBlock, content: 'New text paragraph' };
                break;
            case 'list':
                newBlock = { ...baseBlock, list_type: 'bullet', content: [] };
                break;
            case 'file':
                // Для файлового блока сначала нужно загрузить файл
                await this.uploadFileAndCreateBlock(baseBlock);
                return;
            case 'link':
                newBlock = { ...baseBlock, media_type: 'link', content: 'https://' };
                break;
            case 'table':
                newBlock = { ...baseBlock, content: [[], [], []], row_count: 3, column_count: 3 };
                break;
        }

        await this.saveBlockToServer(newBlock);
    }

    async uploadFileAndCreateBlock(baseBlock) {
        const fileInput = document.createElement('input');
        fileInput.type = 'file';
        fileInput.accept = '*/*';
        
        fileInput.addEventListener('change', async (e) => {
            const file = e.target.files[0];
            if (!file) return;

            // Определяем тип медиа
            let mediaType = 'document';
            if (file.type.startsWith('image/')) mediaType = 'photo';
            if (file.type.startsWith('audio/')) mediaType = 'audio';

            // Загружаем файл на сервер
            const formData = new FormData();
            formData.append('file', file);

            try {
                const uploadResponse = await fetch(`http://localhost:8000/files/${this.currentCollectionId}`, {
                    method: 'POST',
                    body: formData
                });

                if (uploadResponse.ok) {
                    const filePath = await uploadResponse.text();
                    
                    const fileBlock = {
                        ...baseBlock,
                        type: 'file',
                        media_type: mediaType,
                        file_name: file.name,
                        file_path: filePath
                    };

                    await this.saveBlockToServer(fileBlock);
                }
            } catch (error) {
                console.error('Error uploading file:', error);
            }
        });

        fileInput.click();
    }

    async saveBlockToServer(blockData) {
        try {
            const response = await fetch(`http://localhost:8000/collections/${this.currentCollectionId}/blocks`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'accept': 'application/json'
                },
                body: JSON.stringify(blockData)
            });

            if (response.ok) {
                const newBlock = await response.json();
                await this.loadCollectionContent(); // Перезагружаем содержимое
            }
        } catch (error) {
            console.error('Error saving block:', error);
        }
    }

    async deleteBlock(blockId) {
        if (!confirm('Are you sure you want to delete this block?')) return;

        try {
            const response = await fetch(`http://localhost:8000/collections/${this.currentCollectionId}/blocks/${blockId}`, {
                method: 'DELETE'
            });

            if (response.ok) {
                await this.loadCollectionContent(); // Перезагружаем содержимое
            }
        } catch (error) {
            console.error('Error deleting block:', error);
        }
    }

    getNextOrder() {
        const blocks = this.notionPage.querySelectorAll('.content-block');
        return blocks.length;
    }

    startEditingName() {
        this.collectionNameDisplay.style.display = 'none';
        this.collectionNameInput.style.display = 'block';
        this.collectionNameInput.focus();
        this.collectionNameInput.select();
    }

    async finishEditingName() {
        const newName = this.collectionNameInput.value.trim();
        if (newName && newName !== this.currentCollection.name) {
            // Обновляем название на сервере
            await this.updateCollectionName(newName);
        }
        
        this.collectionNameDisplay.textContent = newName || this.currentCollection.name;
        this.collectionNameDisplay.style.display = 'block';
        this.collectionNameInput.style.display = 'none';
    }

    async updateCollectionName(newName) {
        // Здесь должен быть эндпоинт для обновления названия коллекции
        // Пока просто обновляем локально
        this.currentCollection.name = newName;
    }

    async updateCollectionTag(tagId) {
        // Здесь должен быть эндпоинт для обновления тега коллекции
        console.log('Update collection tag to:', tagId);
    }
}