// ui/notion/scripts/event_handler.js
export class EventHandler {
    constructor(collectionViewer) {
        this.viewer = collectionViewer;
    }

    init(notionPage, nameDisplay, nameInput, tagSelect, blockPicker) {
        this.notionPage = notionPage;

        nameDisplay.addEventListener('click', () => this.viewer.metadataManager.startRename());
        nameInput.addEventListener('blur', () => this.viewer.metadataManager.finishRename());
        nameInput.addEventListener('keydown', e => e.key === 'Enter' && this.viewer.metadataManager.finishRename());

        tagSelect.addEventListener('change', () => this.viewer.metadataManager.handleTagChange());

        notionPage.addEventListener('keydown', e => this.handleKeyDown(e));
        notionPage.addEventListener('blur', e => this.handleBlur(e), true);

        document.addEventListener('click', e => blockPicker.handleGlobalClick(e, notionPage));
    }

    getBlockDataFromEvent(e) {
        let el = e.target;
        const editable = el.closest('.notion-block-editable') || el.closest('.notion-table') || el.closest('.file-block-content') || el.closest('.link-editing');
        if (!editable) return null;
        const wrapper = editable.closest('.block-wrapper');
        return {
            editable,
            wrapper,
            blockId: wrapper?.getAttribute('data-block-id'),
            blockType: wrapper?.getAttribute('data-block-type')
        };
    }

    handleBlur(e) {
        const data = this.getBlockDataFromEvent(e);
        if (data && data.editable.isContentEditable) {
            this.viewer.blockEditor.saveBlockContent(data.blockId, data.editable.textContent);
        }
    }

    handleKeyDown(e) {
        const data = this.getBlockDataFromEvent(e);
        if (!data) return;

        const { blockId, blockType } = data;

        if (blockType === 'table' && (e.ctrlKey || e.metaKey)) {
            if (e.key === 'ArrowDown') {
                e.preventDefault();
                this.viewer.blockEditor.resizeTableWithKeys(blockId, 1, 0);
                return;
            }
            if (e.key === 'ArrowUp') {
                e.preventDefault();
                this.viewer.blockEditor.resizeTableWithKeys(blockId, -1, 0);
                return;
            }
            if (e.key === 'ArrowRight') {
                e.preventDefault();
                this.viewer.blockEditor.resizeTableWithKeys(blockId, 0, 1);
                return;
            }
            if (e.key === 'ArrowLeft') {
                e.preventDefault();
                this.viewer.blockEditor.resizeTableWithKeys(blockId, 0, -1);
                return;
            }
        }

        const isEmpty = data.editable.textContent?.trim() === '';
        const isList = blockType === 'list';

        if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
            e.preventDefault();
            this.moveCaretToNearbyBlock(e.key === 'ArrowUp' ? -1 : 1);
            return;
        }

        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            
            // ИСПРАВЛЕНИЕ: сохраняем текущий блок перед созданием нового
            if (data.editable.isContentEditable) {
                this.viewer.blockEditor.saveBlockContent(blockId, data.editable.textContent);
            }
            
            if (isList && isEmpty) {
                this.viewer.blockEditor.createTextBlockAfter(blockId);
            } else if (isList) {
                this.viewer.blockEditor.createListBlockAfter(blockId);
            } else {
                this.viewer.blockEditor.createTextBlockAfter(blockId);
            }
            return;
        }

        if (e.key === 'Backspace' && isEmpty && this.viewer.orderList.length > 1) {
            e.preventDefault();
            this.viewer.blockEditor.handleDeleteBlock(blockId, true);
            return;
        }

        if (e.key === '/' && window.getSelection().getRangeAt(0).startOffset === 0) {
            e.preventDefault();
            this.viewer.blockPicker.show(blockId, data.editable, data.editable.textContent || '', (type) => {
                // ИСПРАВЛЕНИЕ: обрабатываем разные типы файлов
                if (type.startsWith('file ')) {
                    const mediaType = type.split(' ')[1]; // photo, audio, document
                    this.viewer.blockEditor.handleFileUploadReplace(blockId, mediaType);
                } else if (type === 'table') {
                    this.viewer.blockEditor.createTableBlock(blockId);
                } else {
                    this.viewer.blockEditor.replaceBlock(blockId, type, data.editable.textContent || '');
                }
            });
        }
    }

    moveCaretToNearbyBlock(direction) {
        const sel = window.getSelection();
        if (!sel.rangeCount) return;

        let current = sel.getRangeAt(0).startContainer;
        if (current.nodeType !== 1) current = current.parentNode;
        let wrapper = current.closest('.block-wrapper');
        if (!wrapper) return;

        let target = direction < 0 ? wrapper.previousElementSibling : wrapper.nextElementSibling;
        while (target) {
            const editable = target.querySelector('.notion-block-editable') || target.querySelector('.notion-table');
            if (editable) {
                editable.focus();
                if (editable.isContentEditable) {
                    const range = document.createRange();
                    const node = editable.firstChild || editable;
                    const pos = direction < 0 ? (node.textContent?.length || 0) : 0;
                    range.setStart(node, pos);
                    range.collapse(true);
                    sel.removeAllRanges();
                    sel.addRange(range);
                }
                return;
            }
            target = direction < 0 ? target.previousElementSibling : target.nextElementSibling;
        }
    }
}