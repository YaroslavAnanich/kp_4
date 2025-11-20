// CollectionViewer.js
// ИСПРАВЛЕНО: Предотвращена полная перезагрузка страницы после добавления файлового блока путем
// использования контролируемой перерисовки (renderBlocks) вместо хирургической замены.

export class CollectionViewer {
    // STATE
    currentCollectionId = null;
    currentCollectionName = '';
    currentTagId = null;
    allTags = [];
    contentMap = {};
    orderList = [];
    pickerBlockId = null; // ID блока, для которого открыт селектор

    // DOM ELEMENTS
    nameDisplay = document.getElementById('collection-name-display');
    nameInput = document.getElementById('collection-name-input');
    tagMetaSpan = document.getElementById('tag-meta-span');
    tagSelect = document.getElementById('collection-tag-select');
    notionPage = document.querySelector('.notion-page');
    blockPickerEl = this._createBlockPickerElement(); // Новый элемент селектора

    constructor(apiBaseUrl, explorer) {
        this.API_BASE_URL = apiBaseUrl;
        this.explorer = explorer;
        this.initEventListeners();
        this.notionPage.innerHTML = '<p>Please select a collection from the left panel to view its content.</p>';
    }

    setAllTags(tags) {
        this.allTags = tags;
        this._populateTagSelect(this.currentTagId);
    }

    initEventListeners() {
        // 1. Обработчики для имени коллекции
        this.nameDisplay.addEventListener('click', () => this._startRename());
        this.nameInput.addEventListener('blur', () => this._finishRename());
        this.nameInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') this._finishRename();
        });

        // 2. Обработчик для смены тега
        this.tagSelect.addEventListener('change', () => this._handleTagChange());

        // 3. Делегированные обработчики для блоков в notion-page
        this.notionPage.addEventListener('focus', (e) => this._handleInputFocus(e), true);
        this.notionPage.addEventListener('blur', (e) => this._handleInputBlur(e), true);
        this.notionPage.addEventListener('keydown', (e) => this._handleKeyDown(e));
        this.notionPage.addEventListener('input', (e) => this._handleInput(e));
        
        // 4. Глобальные обработчики для селектора блоков
        document.addEventListener('click', (e) => this._handleGlobalClick(e));
        this.notionPage.addEventListener('scroll', () => this._hideBlockTypePicker());
    }
    
    // --- НОВАЯ ФУНКЦИОНАЛЬНОСТЬ ДЛЯ СЕЛЕКТОРА БЛОКОВ ---

    _createBlockPickerElement() {
        const picker = document.createElement('div');
        // Используем inline стили, так как CSS-файл не может быть изменен напрямую.
        picker.style.cssText = `
            position: fixed; 
            z-index: 200; 
            background: white; 
            border: 1px solid #e8e4db; 
            border-radius: 4px; 
            box-shadow: 0 4px 10px rgba(0,0,0,0.1); 
            padding: 5px 0; 
            display: none; 
            min-width: 150px;
            font-family: 'Roboto', sans-serif;
        `;
        
        const options = [
            { type: 'text', name: 'Text', icon: 'fas fa-paragraph' },
            { type: 'header 1', name: 'Heading 1', icon: 'fas fa-heading' },
            { type: 'list bullet', name: 'Bullet List', icon: 'fas fa-list-ul' },
            { type: 'list number', name: 'Numbered List', icon: 'fas fa-list-ol' },
            { type: 'link', name: 'Link', icon: 'fas fa-link' },
            { type: 'file', name: 'File', icon: 'fas fa-file' }
        ];

        options.forEach(option => {
            const btn = document.createElement('button');
            btn.className = 'picker-option';
            btn.style.cssText = `
                display: block; 
                width: 100%; 
                text-align: left; 
                padding: 7px 10px; 
                border: none; 
                background: none; 
                cursor: pointer; 
                font-size: 0.9em; 
                color: #4a413a;
            `;
            btn.innerHTML = `<i class="${option.icon}" style="margin-right: 8px; width: 15px;"></i> ${option.name}`;
            btn.setAttribute('data-type', option.type);
            btn.addEventListener('click', (e) => this._handlePickerSelect(e));
            
            btn.addEventListener('mouseenter', () => btn.style.backgroundColor = '#f0f0f0');
            btn.addEventListener('mouseleave', () => btn.style.backgroundColor = 'white');
            
            picker.appendChild(btn);
        });
        
        document.body.appendChild(picker);
        return picker;
    }

    _showBlockTypePicker(blockId, currentContent, editableEl) {
        this._hideBlockTypePicker(); 
        this.pickerBlockId = blockId;

        // Позиционируем селектор
        const rect = editableEl.getBoundingClientRect();
        
        // Устанавливаем положение, немного ниже и левее
        this.blockPickerEl.style.top = `${rect.top + rect.height + 5}px`;
        this.blockPickerEl.style.left = `${rect.left}px`;
        this.blockPickerEl.style.display = 'block';
        
        // Очищаем содержимое блока от слеша немедленно
        editableEl.textContent = currentContent.replace('/', '').trim();
    }
    
    _hideBlockTypePicker() {
        if (this.blockPickerEl) {
            this.blockPickerEl.style.display = 'none';
            this.pickerBlockId = null;
        }
    }
    
    _handlePickerSelect(e) {
        e.stopPropagation();
        const type = e.currentTarget.getAttribute('data-type');
        const blockId = this.pickerBlockId;
        
        this._hideBlockTypePicker();
        
        // Получаем контент из блока, чтобы передать его в _replaceBlock
        const editableEl = this.notionPage.querySelector(`[data-block-id="${blockId}"] .notion-block-editable`);
        const currentContent = editableEl ? editableEl.textContent.trim() : '';
        
        if (blockId && type) {
            if (type === 'file') {
                // Если выбран файл, вызываем обработчик, который СРАЗУ открывает диалог
                this._handleFileUploadReplace(blockId);
            } else {
                this._replaceBlock(blockId, type, currentContent);
            }
        }
    }
    
    _handleGlobalClick(e) {
        if (this.blockPickerEl && this.blockPickerEl.style.display !== 'none') {
            const isClickInsidePicker = this.blockPickerEl.contains(e.target);
            
            // Скрываем селектор, если клик был вне его
            if (!isClickInsidePicker) {
                 this._hideBlockTypePicker();
            }
        }
    }

    // --- КОНЕЦ НОВОЙ ФУНКЦИОНАЛЬНОСТИ ---


    selectCollection(collection) {
        this.currentCollectionId = collection.id;
        this.currentCollectionName = collection.name;
        this.currentTagId = collection.tag_id;
        
        this.nameDisplay.textContent = collection.name;
        this.nameInput.value = collection.name;
        
        this.nameDisplay.style.display = 'block';
        this.nameInput.style.display = 'none';

        this._renderTagMetadata();
        this._populateTagSelect(collection.tag_id);

        this.loadContent();
    }

    async loadContent() {
        if (!this.currentCollectionId) return;

        try {
            const response = await fetch(`${this.API_BASE_URL}/collections/${this.currentCollectionId}`);
            if (!response.ok) throw new Error('Failed to fetch collection content');
            const data = await response.json();

            this.contentMap = data.content.reduce((map, block) => {
                map[block.id] = block;
                return map;
            }, {});
            this.orderList = data.order_list;
            
            if (this.orderList.length === 0) {
                await this._createEmptyTextBlock(0); 
            } else {
                this.renderBlocks();
            }

        } catch (error) {
            console.error('Error loading collection content:', error);
            this.notionPage.innerHTML = `<p style="color: red;">Ошибка загрузки контента: ${error.message}</p>`;
        }
    }

    renderBlocks() {
        this.notionPage.innerHTML = '';
        const fragment = document.createDocumentFragment();

        this.orderList.forEach(blockId => {
            const block = this.contentMap[blockId];
            if (block) {
                fragment.appendChild(this._createBlockWrapper(block));
            }
        });

        this.notionPage.appendChild(fragment);
    }

    _createBlockWrapper(block) {
        const wrapper = document.createElement('div');
        wrapper.className = 'block-wrapper';
        wrapper.setAttribute('data-block-id', block.id);
        wrapper.setAttribute('data-block-type', block.type);
        
        const contentElement = this._renderBlockContent(block);
        
        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'delete-block-btn';
        deleteBtn.innerHTML = '<i class="fas fa-trash-alt"></i>';
        deleteBtn.title = 'Удалить блок';
        deleteBtn.addEventListener('click', () => this._handleDeleteBlock(block.id));
        wrapper.prepend(deleteBtn);
        
        wrapper.appendChild(contentElement);
        return wrapper;
    }

    _renderBlockContent(block) {
        let el;
        const content = block.content || ''; 
        
        switch (block.type) {
            case 'text':
                el = document.createElement('p');
                el.textContent = content; 
                el.contentEditable = 'true';
                el.classList.add('notion-block-editable');
                break;
            case 'header':
                el = document.createElement(`h${block.level}`);
                el.textContent = content;
                el.contentEditable = 'true';
                el.classList.add('notion-block-editable');
                break;
            case 'list':
                el = document.createElement('li');
                el.textContent = content; 
                el.setAttribute('data-list-type', block.list_type);
                el.contentEditable = 'true';
                el.classList.add('notion-block-editable');
                break;
            case 'link':
                el = document.createElement('a');
                el.href = content;
                // FIX: Используем link_text, если он есть, иначе content
                el.textContent = block.link_text || content; 
                el.target = '_blank';
                el.contentEditable = 'true'; // Делаем ссылку редактируемой для консистентности
                el.classList.add('notion-block-editable');
                break;
            case 'file':
                el = this._renderFileBlock(block);
                el.contentEditable = 'false'; 
                break;
            case 'table':
                el = this._renderTableBlock(block);
                el.contentEditable = 'false'; 
                break;
            default:
                el = document.createElement('div');
                el.textContent = content || '';
                el.contentEditable = 'true';
                el.classList.add('notion-block-editable');
                break;
        }
        
        return el;
    }

    _renderTableBlock(block) {
        const table = document.createElement('table');
        table.className = 'notion-table';
        const tbody = document.createElement('tbody');
        
        block.content.forEach((row, rowIndex) => {
            const tr = document.createElement('tr');
            row.forEach((cell, cellIndex) => {
                const cellEl = rowIndex === 0 ? document.createElement('th') : document.createElement('td');
                cellEl.textContent = cell;
                cellEl.contentEditable = 'true'; 
                cellEl.setAttribute('data-row-index', rowIndex);
                cellEl.setAttribute('data-cell-index', cellIndex);
                cellEl.classList.add('notion-block-editable'); 
                tr.appendChild(cellEl);
            });
            tbody.appendChild(tr);
        });
        table.appendChild(tbody);
        return table;
    }

    _renderFileBlock(block) {
        const fileWrapper = document.createElement('div');
        fileWrapper.className = 'file-block-content';
        
        switch (block.media_type) {
            case 'photo':
                const img = document.createElement('img');
                img.src = block.file_path;
                img.alt = block.file_name || 'Image';
                fileWrapper.appendChild(img);
                break;
            case 'audio':
                const audio = document.createElement('audio');
                audio.controls = true;
                audio.src = block.file_path;
                fileWrapper.appendChild(audio);
                break;
            case 'document':
                const link = document.createElement('a');
                link.href = block.file_path;
                link.target = '_blank';
                link.textContent = `[Документ] ${block.file_name || 'Открыть файл'}`;
                fileWrapper.appendChild(link);
                break;
            default:
                const text = document.createElement('p');
                text.textContent = `[Файл] ${block.file_name || block.file_path}`;
                fileWrapper.appendChild(text);
                break;
        }
        return fileWrapper;
    }

    _getBlockDataFromEvent(e) {
        const editableEl = e.target.closest('.notion-block-editable');
        if (!editableEl) return null;

        const wrapper = editableEl.closest('.block-wrapper');
        const blockId = wrapper.getAttribute('data-block-id');
        const blockType = wrapper.getAttribute('data-block-type');
        
        return { editableEl, wrapper, blockId, blockType };
    }

    _handleInputFocus(e) {
        const data = this._getBlockDataFromEvent(e);
        if (!data) return;

        const isTextOrList = data.blockType === 'text' || data.blockType === 'list';
        const isEmpty = data.editableEl.textContent.trim() === '';

        if (isTextOrList && isEmpty) {
            data.editableEl.textContent = 'нажмите / чтобы добавить блок';
            data.editableEl.classList.add('empty-placeholder');
            
            const range = document.createRange();
            const sel = window.getSelection();
            if (data.editableEl.firstChild) {
                range.setStart(data.editableEl.firstChild, 0);
            } else {
                 range.setStart(data.editableEl, 0);
            }
            range.collapse(true);
            sel.removeAllRanges();
            sel.addRange(range);
        }
    }
    
    _handleInput(e) {
        const data = this._getBlockDataFromEvent(e);
        if (!data) return;

        const placeholderText = 'нажмите / чтобы добавить блок';
        const editableEl = data.editableEl;
        
        if (editableEl.classList.contains('empty-placeholder')) {
            editableEl.classList.remove('empty-placeholder');
            
            let currentText = editableEl.textContent;
            let newText = currentText;

            if (currentText.includes(placeholderText)) {
                newText = currentText.replace(placeholderText, '');
                editableEl.textContent = newText;
                
                const range = document.createRange();
                const sel = window.getSelection();
                range.selectNodeContents(editableEl);
                range.collapse(false); 
                sel.removeAllRanges();
                sel.addRange(range);
            }
            
            this._saveBlockContent(data.blockId, newText.trim());
        }
    }
    
    _handleInputBlur(e) {
        const data = this._getBlockDataFromEvent(e);
        if (!data) return;

        const block = this.contentMap[data.blockId];

        // --- TABLE EDITING ---
        if (data.blockType === 'table') {
            const cellEl = e.target.closest('td, th');
            if (!cellEl) return;

            const newContent = cellEl.textContent;
            const rowIndex = parseInt(cellEl.getAttribute('data-row-index'));
            const cellIndex = parseInt(cellEl.getAttribute('data-cell-index'));
            
            if (block.content[rowIndex][cellIndex] === newContent) return;

            const newTableContent = block.content.map((row, rIdx) => {
                if (rIdx === rowIndex) {
                    const newRow = [...row];
                    newRow[cellIndex] = newContent;
                    return newRow;
                }
                return row;
            });

            this._saveBlockContent(data.blockId, newTableContent);
            return;
        }

        // --- LINK EDITING ---
        if (data.blockType === 'link') {
             const currentText = data.editableEl.textContent.trim();
             // В этом случае сохраняем изменения как link_text, а не content (URL)
             // Если ссылка была пустой, сохраняем как content
             this._saveBlockContent(data.blockId, currentText); 
             return;
        }

        // --- TEXT/HEADER/LIST EDITING ---
        
        const currentContent = data.editableEl.textContent; 
        
        const contentToSave = (data.editableEl.classList.contains('empty-placeholder')) 
            ? '' 
            : currentContent.trim();
        
        this._saveBlockContent(data.blockId, contentToSave);
        
        data.editableEl.classList.remove('empty-placeholder');
        
        if (contentToSave === '') {
            data.editableEl.textContent = '';
        }
    }
    
    // ФИНАЛЬНОЕ ИСПРАВЛЕНИЕ: Более надежная проверка положения каретки
    async _handleKeyDown(e) {
        const data = this._getBlockDataFromEvent(e);
        if (!data) return;
        
        const { editableEl, blockId, blockType } = data;
        const currentContent = editableEl.textContent; 
        const contentToUse = (editableEl.classList.contains('empty-placeholder')) ? '' : currentContent;
        const currentIndex = this.orderList.indexOf(blockId);
        
        if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
            
            const sel = window.getSelection();
            
            // Получаем точную позицию каретки относительно всего содержимого блока
            let isAtStart = false;
            let isAtEnd = false;

            if (sel.rangeCount > 0) {
                const range = sel.getRangeAt(0);
                
                // Проверка начала: начало диапазона совпадает с началом элемента
                isAtStart = range.startOffset === 0 && range.startContainer === editableEl.firstChild;
                
                // Проверка конца: конец диапазона совпадает с концом элемента
                if (editableEl.lastChild) {
                    isAtEnd = range.endOffset === editableEl.lastChild.textContent.length && range.endContainer === editableEl.lastChild;
                } else {
                    isAtEnd = range.endOffset === editableEl.textContent.length && range.endContainer === editableEl;
                }
                
                // Дополнительная проверка: если блок пуст, оба условия ложны, но при этом мы хотим перемещаться
                if (editableEl.textContent.trim() === '' || editableEl.classList.contains('empty-placeholder')) {
                    isAtStart = true; 
                    isAtEnd = true; 
                }
            }


            if (blockType !== 'table') {
                
                // УСЛОВИЕ ДЛЯ ПЕРЕМЕЩЕНИЯ ВВЕРХ
                if (e.key === 'ArrowUp' && isAtStart) {
                    e.preventDefault(); 
                    const newIndex = currentIndex - 1;
                    const newBlockId = this.orderList[newIndex];
                    if (newBlockId) this._focusBlock(newBlockId, 'end'); 
                } 
                
                // УСЛОВИЕ ДЛЯ ПЕРЕМЕЩЕНИЯ ВНИЗ
                else if (e.key === 'ArrowDown' && isAtEnd) {
                    e.preventDefault(); // КЛЮЧЕВОЕ: Блокируем стандартное действие браузера
                    const newIndex = currentIndex + 1;
                    const newBlockId = this.orderList[newIndex];
                    if (newBlockId) this._focusBlock(newBlockId, 'start'); 
                }
            }
        } else if (e.key === '/') {
            e.preventDefault(); 
            if (blockType === 'table') return;
            
            // --- ЗАМЕНА prompt() НА КАСТОМНЫЙ СЕЛЕКТОР ---
            this._showBlockTypePicker(blockId, contentToUse, editableEl);
            // ----------------------------------------------
            
        } else if (e.key === 'Enter') {
            e.preventDefault(); 
            if (blockType === 'table') return;
            
            await this._saveBlockContent(blockId, contentToUse.trim()); 
            
            editableEl.classList.remove('empty-placeholder');

            let newBlockType = 'text';
            let newBlockListType = 'bullet';

            if (blockType === 'list') {
                const isPlaceholder = contentToUse.trim() === '';
                if (!isPlaceholder) {
                    newBlockType = 'list';
                    newBlockListType = this.contentMap[blockId].list_type;
                }
            }

            await this._createEmptyTextBlock(currentIndex + 1, newBlockType, newBlockListType);

        } else if (e.key === 'Backspace' && contentToUse.trim() === '' && this.orderList.length > 1) {
            e.preventDefault();
            this._handleDeleteBlock(blockId, true);
        }
    }
    
    // Вспомогательная функция для установки фокуса
    _focusBlock(blockId, position) {
        const newBlockWrapper = this.notionPage.querySelector(`[data-block-id="${blockId}"]`);
        if (!newBlockWrapper) return;
        
        const newEditableEl = newBlockWrapper.querySelector('.notion-block-editable, td, th'); 

        if (newEditableEl) {
            newEditableEl.focus();
            
            const range = document.createRange();
            const sel = window.getSelection();

            if (position === 'start') {
                if (newEditableEl.firstChild) {
                    range.setStart(newEditableEl.firstChild, 0);
                } else {
                    range.setStart(newEditableEl, 0);
                }
            } else { // 'end'
                range.selectNodeContents(newEditableEl);
                range.collapse(false); 
            }
            
            sel.removeAllRanges();
            sel.addRange(range);
        }
    }
    
    // --- API CALLS FOR BLOCKS ---
    
    async _createEmptyTextBlock(index, type = 'text', list_type = 'bullet') {
        const blockPayload = { type, content: "" };
        if (type === 'list') blockPayload.list_type = list_type;
        
        try {
            const response = await fetch(`${this.API_BASE_URL}/collections/${this.currentCollectionId}/blocks`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'accept': 'application/json' },
                body: JSON.stringify(blockPayload)
            });

            if (!response.ok) throw new Error('Failed to create block');
            const newBlock = await response.json();

            this.contentMap[newBlock.id] = newBlock;
            this.orderList.splice(index, 0, newBlock.id);
            
            await this._updateOrderList(this.orderList);

            this.renderBlocks();
            this._focusBlock(newBlock.id, 'start');

        } catch (error) {
            console.error('Error creating block:', error);
            alert('Не удалось создать новый блок.');
        }
    }

    async _saveBlockContent(blockId, newContentRaw) {
        const block = this.contentMap[blockId];
        if (!block) return;
        
        let newContent = newContentRaw;
        let payload = { ...block };

        if (block.type === 'link') {
            // Если блок - ссылка, то новая строка - это текст ссылки (link_text)
            // Исходный URL (content) сохраняется, если он не пуст, иначе он должен быть установлен через _replaceBlock
            payload.link_text = newContent.trim();
            // content (URL) не меняем
        } else {
            // Для всех остальных типов новая строка - это content
             if (JSON.stringify(block.content) === JSON.stringify(newContent)) return;
             payload.content = newContent;
        }

        // Удаляем поля, которые устанавливаются сервером
        delete payload.qdrant_collection_name; 
        delete payload.user_id; 
        delete payload.tag_id;
        delete payload.name;
        delete payload.collection_id;
        
        try {
            const response = await fetch(`${this.API_BASE_URL}/collections/${this.currentCollectionId}/blocks`, {
                method: 'POST', 
                headers: { 'Content-Type': 'application/json', 'accept': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (!response.ok) throw new Error('Failed to save block content');
            
            // Обновляем локальную карту контента
            const savedBlock = await response.json();
            this.contentMap[blockId] = savedBlock;
            
        } catch (error) {
            console.error('Error saving block content:', error);
        }
    }

    async _replaceBlock(blockId, newTypeRaw, currentContent) {
        // Берем все данные существующего блока для корректного POST
        const existingBlock = this.contentMap[blockId];
        if (!existingBlock) return;

        const parts = newTypeRaw.toLowerCase().split(' ');
        const type = parts[0];
        
        let cleanContent = currentContent;

        // Начинаем с полного объекта существующего блока
        let blockPayload = { ...existingBlock };
        
        // Удаляем поля, которые устанавливаются сервером или не нужны
        delete blockPayload.qdrant_collection_name; 
        delete blockPayload.user_id; 
        delete blockPayload.tag_id;
        delete blockPayload.name; 
        delete blockPayload.collection_id;
        
        // Сбрасываем поля-модификаторы для нового типа
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
                const url = prompt('Введите URL ссылки:', existingBlock.content || cleanContent || 'https://');
                if (!url) return;
                
                blockPayload.type = 'link';
                blockPayload.media_type = 'link';
                blockPayload.content = url; // URL
                blockPayload.link_text = cleanContent || url; // Текст ссылки
                break;
            default:
                alert('Неизвестный тип блока. Используйте: text, header (1-6), list (bullet/number), link, file.');
                return;
        }

        try {
            const response = await fetch(`${this.API_BASE_URL}/collections/${this.currentCollectionId}/blocks`, {
                method: 'POST', 
                headers: { 'Content-Type': 'application/json', 'accept': 'application/json' },
                body: JSON.stringify(blockPayload)
            });

            if (!response.ok) throw new Error(`Failed to replace block with ${type}`);
            const newBlockData = await response.json();
            
            this.contentMap[blockId] = newBlockData;
            this.renderBlocks();
            this._focusBlock(blockId, 'end');

        } catch (error) {
            console.error('Error replacing block:', error);
            alert(`Не удалось заменить блок на ${type}.`);
        }
    }

    /**
     * Обрабатывает процесс выбора и загрузки файла, затем обновляет блок.
     * @param {string} blockId - ID блока, который нужно заменить файлом.
     */
    _handleFileUploadReplace(blockId) {
        const fileInput = document.createElement('input');
        fileInput.type = 'file';
        
        // 1. Немедленно вызываем click(), сохраняя цепочку пользовательского действия
        fileInput.click(); 
        
        fileInput.onchange = async (e) => {
            const file = e.target.files[0];
            if (!file) {
                 fileInput.remove(); // Очистка, если отменено
                 return;
            }

            // 2. Запрашиваем тип файла только после того, как пользователь выбрал файл
            const mediaType = prompt("Введите тип файла (photo, audio, document):", 'document');
            if (!mediaType) {
                 alert('Операция отменена. Пожалуйста, выберите тип файла.');
                 fileInput.remove(); // Очистка, если отменено
                 return;
            }

            // 3. Выполняем POST-запрос
            const url = `${this.API_BASE_URL}/collections/${this.currentCollectionId}/file?block_id=${blockId}&media_type=${mediaType}`;
            
            const formData = new FormData();
            formData.append('file', file);
            
            try {
                const response = await fetch(url, { method: 'POST', body: formData });
                if (!response.ok) throw new Error('File upload failed');
                
                // Получаем обновленные данные блока
                const updatedBlock = await response.json(); 
                
                // Обновляем локальную карту контента
                this.contentMap[blockId] = updatedBlock;

                // !!! ИСПРАВЛЕНИЕ: Вызываем полную перерисовку, как в _replaceBlock, чтобы избежать
                // проблем с состоянием DOM, которые могли вызывать перезагрузку.
                this.renderBlocks(); 
                
                // Фокусировка на новом блоке (необязательно, но улучшает UX)
                this._focusBlock(blockId, 'start'); 

            } catch (error) {
                alert('Не удалось загрузить файл.');
                console.error('File block error:', error);
            } finally {
                // Обязательная очистка input после завершения операции
                fileInput.remove();
            }
        };
    }
    
    async _handleDeleteBlock(blockId, focusPrevious = false) {
        if (!this.currentCollectionId || !blockId) return;
        
        let wrapper = this.notionPage.querySelector(`[data-block-id="${blockId}"]`);
        let prevWrapper = wrapper ? wrapper.previousElementSibling : null;

        try {
            const response = await fetch(`${this.API_BASE_URL}/collections/${this.currentCollectionId}/blocks/${blockId}`, {
                method: 'DELETE',
                headers: { 'accept': 'application/json' }
            });

            if (!response.ok) throw new Error('Failed to delete block');
            
            delete this.contentMap[blockId];
            this.orderList = this.orderList.filter(id => id !== blockId);
            
            await this._updateOrderList(this.orderList);

            this.renderBlocks();
            
            if (focusPrevious && prevWrapper) {
                const prevBlockId = prevWrapper.getAttribute('data-block-id');
                this._focusBlock(prevBlockId, 'end');
            }

        } catch (error) {
            console.error('Error deleting block:', error);
            alert('Не удалось удалить блок.');
        }
    }

    async _updateOrderList(newOrderList) {
        try {
            const response = await fetch(`${this.API_BASE_URL}/collections/${this.currentCollectionId}/order`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json', 'accept': 'application/json' },
                body: JSON.stringify(newOrderList)
            });
            if (!response.ok) throw new Error('Failed to update block order');
        } catch (error) {
            console.error('Error updating block order:', error);
        }
    }
    
    // --- ОБРАБОТЧИКИ МЕТАДАННЫХ КОЛЛЕКЦИИ ---

    _renderTagMetadata() {
        if (!this.allTags.length) {
            this.tagMetaSpan.innerHTML = '<i class="fas fa-tags"></i> No tags available';
            return;
        }

        const currentTag = this.allTags.find(t => t.id === this.currentTagId);
        
        if (currentTag) {
            this.tagMetaSpan.innerHTML = `<i class="fas fa-tags"></i> ${currentTag.name}`;
        } else {
            this.tagMetaSpan.innerHTML = `<i class="fas fa-tags"></i> Без тега`;
        }
    }

    _populateTagSelect(currentTagId) {
        this.tagSelect.innerHTML = '';
        
        const noTagOption = document.createElement('option');
        noTagOption.value = 'null';
        noTagOption.textContent = 'Без тега';
        noTagOption.selected = currentTagId === null;
        this.tagSelect.appendChild(noTagOption);

        this.allTags.forEach(tag => {
            const option = document.createElement('option');
            option.value = tag.id;
            option.textContent = tag.name;
            if (tag.id === currentTagId) {
                option.selected = true;
            }
            this.tagSelect.appendChild(option);
        });
        
        const toggleSelect = () => {
            if (this.tagSelect.style.display === 'none' || this.tagSelect.style.display === '') {
                this.tagMetaSpan.style.display = 'none';
                this.tagSelect.style.display = 'inline-block';
                this.tagSelect.focus();
            } else {
                this.tagSelect.style.display = 'none';
                this.tagMetaSpan.style.display = 'inline-block';
                this._renderTagMetadata();
            }
        };

        this.tagMetaSpan.removeEventListener('click', toggleSelect);
        this.tagSelect.removeEventListener('blur', toggleSelect);
        
        this.tagMetaSpan.addEventListener('click', toggleSelect);
        this.tagSelect.addEventListener('blur', toggleSelect);
    }

    async _handleTagChange() {
        const tagId = this.tagSelect.value;
        const newTagId = tagId === 'null' ? null : parseInt(tagId);

        try {
            const url = `${this.API_BASE_URL}/collections/${this.currentCollectionId}/tags/${newTagId === null ? 'null' : newTagId}`;
            const response = await fetch(url, {
                method: 'PUT',
                headers: { 'accept': 'application/json' }
            });

            if (!response.ok) throw new Error('Failed to update tag');
            const data = await response.json();

            this.currentTagId = data.tag_id;
            this._renderTagMetadata();
            this.tagSelect.style.display = 'none';
            this.tagMetaSpan.style.display = 'inline-block';
            
            this.explorer.loadData();

        } catch (error) {
            alert('Не удалось обновить тег коллекции.');
            console.error('Tag update error:', error);
            this.tagSelect.value = this.currentTagId === null ? 'null' : this.currentTagId.toString();
        }
    }

    _startRename() {
        if (!this.currentCollectionId) return; 
        this.nameDisplay.style.display = 'none';
        this.nameInput.style.display = 'block';
        this.nameInput.focus();
    }

    async _finishRename() {
        const newName = this.nameInput.value.trim();
        this.nameDisplay.style.display = 'block';
        this.nameInput.style.display = 'none';

        if (!this.currentCollectionId) {
            this.nameDisplay.textContent = this.currentCollectionName;
            return;
        }

        if (newName === this.currentCollectionName || !newName) {
            this.nameInput.value = this.currentCollectionName;
            this.nameDisplay.textContent = this.currentCollectionName;
            return;
        }
        
        try {
            const response = await fetch(`${this.API_BASE_URL}/collections/${this.currentCollectionId}/name?name=${encodeURIComponent(newName)}`, {
                method: 'PUT',
                headers: { 'accept': 'application/json' }
            });

            if (!response.ok) throw new Error('Failed to update name');
            const data = await response.json();
            
            this.currentCollectionName = data.name;
            this.nameDisplay.textContent = data.name;
            this.nameInput.value = data.name;

            this.explorer.loadData(); 

        } catch (error) {
            alert('Не удалось обновить имя коллекции. Проверьте консоль.');
            console.error('Rename error:', error);
            this.nameInput.value = this.currentCollectionName;
            this.nameDisplay.textContent = this.currentCollectionName;
        }
    }
}