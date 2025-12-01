// ui/notion/scripts/block_renderer.js
export class BlockRenderer {
    constructor(viewer) {
        this.viewer = viewer;
    }

    async renderBlocks(notionPage, orderList, contentMap, onDelete) {
        notionPage.innerHTML = '';
        const fragment = document.createDocumentFragment();

        const numberedListInfo = this._getNumberedListInfo(orderList, contentMap);

        orderList.forEach(blockId => {
            const block = contentMap[blockId];
            if (block) {
                fragment.appendChild(this._createBlockWrapper(block, onDelete, numberedListInfo));
            }
        });

        notionPage.appendChild(fragment);
        
        // ИСПРАВЛЕНИЕ: ждем следующего тика event loop для гарантии рендеринга
        await new Promise(resolve => setTimeout(resolve, 0));
        
        // Инициализируем drag&drop после рендеринга
        this._initDragAndDrop(notionPage);
    }

    _getNumberedListInfo(orderList, contentMap) {
        const info = {};
        let currentNumber = 1;
        let prevWasNumbered = false;

        orderList.forEach(blockId => {
            const block = contentMap[blockId];
            if (block && block.type === 'list' && block.list_type === 'number') {
                if (!prevWasNumbered) {
                    currentNumber = 1;
                }
                info[blockId] = currentNumber;
                currentNumber++;
                prevWasNumbered = true;
            } else {
                prevWasNumbered = false;
                currentNumber = 1;
            }
        });

        return info;
    }

    _createBlockWrapper(block, onDelete, numberedListInfo = {}) {
        const wrapper = document.createElement('div');
        wrapper.className = 'block-wrapper';
        wrapper.setAttribute('data-block-id', block.id);
        wrapper.setAttribute('data-block-type', block.type);
        wrapper.tabIndex = -1;
        wrapper.draggable = true;

        const contentElement = this._renderBlockContent(block, numberedListInfo);

        // ВОЗВРАЩАЕМ: кнопку удаления вместо drag-handle
        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'delete-block-btn';
        deleteBtn.innerHTML = '<i class="fas fa-trash-alt"></i>';
        deleteBtn.title = 'Удалить блок';
        deleteBtn.addEventListener('click', () => onDelete(block.id));
        wrapper.prepend(deleteBtn);

        wrapper.appendChild(contentElement);

        if (block.type === 'table') {
            const table = wrapper.querySelector('table');
            if (table) {
                table.tabIndex = 0;
                table.addEventListener('focus', () => wrapper.classList.add('table-focused'));
                table.addEventListener('blur', () => wrapper.classList.remove('table-focused'));
            }
        }

        return wrapper;
    }

    _initDragAndDrop(notionPage) {
        // Инициализируем drag&drop только если еще не инициализирован
        if (!this.viewer.dragDropManager.initialized) {
            this.viewer.dragDropManager.init(notionPage);
        }
    }

    _renderBlockContent(block, numberedListInfo) {
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
                el = document.createElement(`h${block.level || 1}`);
                el.textContent = content;
                el.contentEditable = 'true';
                el.classList.add('notion-block-editable');
                break;

            case 'list':
                el = document.createElement('div');
                el.className = `notion-list-item ${block.list_type === 'number' ? 'numbered' : 'bulleted'}`;
                
                if (block.list_type === 'number') {
                    const number = numberedListInfo[block.id] || 1;
                    el.innerHTML = `<span class="list-marker"></span><div class="notion-block-editable" contenteditable="true">${content}</div>`;
                    const marker = el.querySelector('.list-marker');
                    marker.textContent = `${number}.`;
                    marker.style.marginRight = '8px';
                    marker.style.color = '#666';
                } else {
                    el.innerHTML = `<span class="list-marker"></span><div class="notion-block-editable" contenteditable="true">${content}</div>`;
                }
                break;

            case 'link':
                el = document.createElement('div');
                el.className = 'notion-link-block';

                const a = document.createElement('a');
                a.href = content || 'https://';
                a.target = '_blank';
                a.rel = 'noopener';
                a.textContent = block.link_text || content || 'https://';
                a.className = 'link-display';

                a.addEventListener('click', (e) => {
                    if (e.ctrlKey || e.metaKey) {
                        e.preventDefault();

                        const input = document.createElement('input');
                        input.type = 'text';
                        input.value = a.textContent;
                        input.className = 'link-editing';
                        
                        // ИСПРАВЛЕНИЕ: устанавливаем фиксированную ширину для поля ввода ссылки
                        input.style.width = '100%';
                        input.style.maxWidth = '400px';
                        input.style.minWidth = '200px';

                        el.innerHTML = '';
                        el.appendChild(input);
                        input.focus();
                        input.select();

                        const save = () => {
                            const newText = input.value.trim() || 'https://';
                            this.viewer.blockEditor.saveLinkText(block.id, newText);
                        };

                        input.addEventListener('blur', save);
                        input.addEventListener('keydown', (ev) => {
                            if (ev.key === 'Enter') {
                                ev.preventDefault();
                                save();
                            }
                            if (ev.key === 'Escape') {
                                el.innerHTML = '';
                                el.appendChild(a);
                            }
                        });
                    }
                });

                el.appendChild(a);
                break;

            case 'file':
                el = this._renderFileBlock(block);
                break;

            case 'table':
                el = this._renderTableBlock(block);
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
        const container = document.createElement('div');
        container.className = 'table-container';

        const table = document.createElement('table');
        table.className = 'notion-table';
        table.dataset.blockId = block.id;

        const tbody = document.createElement('tbody');

        const rows = block.content && Array.isArray(block.content) && block.content.length > 0
            ? block.content
            : Array(3).fill().map(() => Array(3).fill(''));

        rows.forEach((row, i) => {
            const tr = document.createElement('tr');
            row.forEach((cell, j) => {
                const cellEl = i === 0 ? document.createElement('th') : document.createElement('td');
                cellEl.textContent = cell || '';
                cellEl.contentEditable = 'true';
                cellEl.classList.add('notion-block-editable');
                tr.appendChild(cellEl);
            });
            tbody.appendChild(tr);
        });

        table.appendChild(tbody);
        container.appendChild(table);
        return container;
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
                // Красивый блок с иконкой
                const preview = document.createElement('a');
                preview.href = block.file_path;
                preview.target = '_blank';
                preview.rel = 'noopener';
                preview.className = 'document-preview';

                // Иконка в зависимости от расширения
                const ext = (block.file_name || '').toLowerCase().split('.').pop();
                const icons = {
                    pdf: 'fa-file-pdf',
                    doc: 'fa-file-word',
                    docx: 'fa-file-word',
                    xls: 'fa-file-excel',
                    xlsx: 'fa-file-excel',
                    ppt: 'fa-file-powerpoint',
                    pptx: 'fa-file-powerpoint',
                    txt: 'fa-file-lines',
                    zip: 'fa-file-zipper',
                    rar: 'fa-file-zipper'
                };
                const iconClass = icons[ext] || 'fa-file';

                preview.innerHTML = `
                    <i class="fas ${iconClass} doc-icon"></i>
                    <div class="doc-info">
                        <div class="doc-name">${block.file_name || 'Документ'}</div>
                        <div class="doc-size">${block.file_size ? this._formatBytes(block.file_size) : ''}</div>
                    </div>
                `;
                fileWrapper.appendChild(preview);
                break;

            default:
                const text = document.createElement('p');
                text.textContent = `[Файл] ${block.file_name || block.file_path}`;
                fileWrapper.appendChild(text);
                break;
        }
        return fileWrapper;
    }

    // Вспомогательная функция для красивого размера файла
    _formatBytes(bytes) {
        if (!bytes) return '';
        const sizes = ['Б', 'КБ', 'МБ', 'ГБ'];
        const i = Math.floor(Math.log(bytes) / Math.log(1024));
        return parseFloat((bytes / Math.pow(1024, i)).toFixed(1)) + ' ' + sizes[i];
    }
}