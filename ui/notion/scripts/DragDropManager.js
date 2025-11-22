// ui/notion/scripts/DragDropManager.js
export class DragDropManager {
    constructor(collectionViewer) {
        this.viewer = collectionViewer;
        this.draggedBlock = null;
        this.dragOverBlock = null;
        this.isDragging = false;
        this.initialized = false;
        this.originalOrderList = [];
    }

    init(notionPage) {
        if (this.initialized) return;
        
        // Более простой подход - обрабатываем события на самой notionPage
        notionPage.addEventListener('dragstart', this.handleDragStart.bind(this));
        notionPage.addEventListener('dragover', this.handleDragOver.bind(this));
        notionPage.addEventListener('dragenter', this.handleDragEnter.bind(this));
        notionPage.addEventListener('dragleave', this.handleDragLeave.bind(this));
        notionPage.addEventListener('drop', this.handleDrop.bind(this));
        notionPage.addEventListener('dragend', this.handleDragEnd.bind(this));
        
        this.initialized = true;
    }

    handleDragStart(e) {
        // Находим блок-обертку, даже если перетаскиваем за внутренний элемент
        const wrapper = e.target.closest('.block-wrapper');
        if (!wrapper) return;

        console.log('Drag start:', wrapper.getAttribute('data-block-id'));
        
        this.draggedBlock = wrapper;
        this.isDragging = true;
        
        // Сохраняем исходный порядок
        this.originalOrderList = [...this.viewer.orderList];
        
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', wrapper.getAttribute('data-block-id'));
        
        // Добавляем визуальный эффект
        wrapper.classList.add('dragging');
        
        // Небольшая задержка для лучшего UX
        setTimeout(() => {
            wrapper.style.opacity = '0.4';
        }, 0);
    }

    handleDragOver(e) {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        
        if (!this.isDragging) return;

        // Находим блок над которым сейчас курсор
        const wrapper = e.target.closest('.block-wrapper');
        if (!wrapper || wrapper === this.draggedBlock) {
            this.removeDropIndicator();
            return;
        }

        console.log('Drag over:', wrapper.getAttribute('data-block-id'));
        
        this.dragOverBlock = wrapper;
        this.updateDropIndicator(wrapper, e.clientY);
    }

    handleDragEnter(e) {
        e.preventDefault();
    }

    handleDragLeave(e) {
        // Убираем индикатор только если вышли за пределы notionPage
        if (!e.currentTarget.contains(e.relatedTarget)) {
            this.removeDropIndicator();
            this.dragOverBlock = null;
        }
    }

    handleDrop(e) {
        e.preventDefault();
        
        if (!this.isDragging || !this.draggedBlock || !this.dragOverBlock) {
            console.log('Drop cancelled: missing elements');
            return;
        }

        const draggedId = this.draggedBlock.getAttribute('data-block-id');
        const targetId = this.dragOverBlock.getAttribute('data-block-id');
        
        if (draggedId === targetId) {
            console.log('Drop cancelled: same block');
            this.cancelDrag();
            return;
        }

        console.log('Drop successful:', draggedId, '->', targetId);
        
        // Выполняем перемещение
        this.performMove(draggedId, targetId, this.getDropPosition(e.clientY));
        this.removeDropIndicator();
    }

    handleDragEnd(e) {
        console.log('Drag end');
        
        // Восстанавливаем визуальное состояние
        if (this.draggedBlock) {
            this.draggedBlock.classList.remove('dragging');
            this.draggedBlock.style.opacity = '';
        }
        
        this.removeDropIndicator();
        this.isDragging = false;
        this.draggedBlock = null;
        this.dragOverBlock = null;
        this.originalOrderList = [];
    }

    updateDropIndicator(targetWrapper, clientY) {
        this.removeDropIndicator();
        
        const rect = targetWrapper.getBoundingClientRect();
        const isBefore = clientY - rect.top < rect.height / 2;
        
        const indicator = document.createElement('div');
        indicator.className = 'drop-indicator';
        indicator.style.cssText = `
            position: absolute;
            left: 0;
            right: 0;
            height: 3px;
            background: #d9b981;
            z-index: 1000;
            border-radius: 2px;
            pointer-events: none;
        `;
        
        if (isBefore) {
            indicator.style.top = '0px';
            targetWrapper.parentNode.insertBefore(indicator, targetWrapper);
        } else {
            indicator.style.bottom = '0px';
            targetWrapper.parentNode.insertBefore(indicator, targetWrapper.nextSibling);
        }
    }

    removeDropIndicator() {
        const existingIndicator = document.querySelector('.drop-indicator');
        if (existingIndicator) {
            existingIndicator.remove();
        }
    }

    getDropPosition(clientY) {
        if (!this.dragOverBlock) return 'after';
        
        const rect = this.dragOverBlock.getBoundingClientRect();
        return clientY - rect.top < rect.height / 2 ? 'before' : 'after';
    }

    async performMove(draggedId, targetId, position) {
        try {
            const oldIndex = this.viewer.orderList.indexOf(draggedId);
            const targetIndex = this.viewer.orderList.indexOf(targetId);
            
            if (oldIndex === -1 || targetIndex === -1) {
                console.error('Invalid block IDs');
                return;
            }

            // Создаем новый порядок
            const newOrderList = [...this.viewer.orderList];
            newOrderList.splice(oldIndex, 1);
            
            let newIndex;
            if (position === 'before') {
                newIndex = targetIndex > oldIndex ? targetIndex - 1 : targetIndex;
            } else {
                newIndex = targetIndex > oldIndex ? targetIndex : targetIndex + 1;
            }
            
            newOrderList.splice(newIndex, 0, draggedId);

            // Обновляем данные
            this.viewer.orderList = newOrderList;

            // Отправляем на сервер
            await this.viewer.apiInteractor.updateOrderList(this.viewer.currentCollectionId, newOrderList);
            console.log('Block order updated successfully on server');

            // Перерисовываем
            await this.viewer.blockRenderer.renderBlocks(
                this.viewer.notionPage, 
                this.viewer.orderList, 
                this.viewer.contentMap, 
                (id) => this.viewer.blockEditor.handleDeleteBlock(id)
            );

        } catch (error) {
            console.error('Error moving block:', error);
            // Восстанавливаем исходный порядок при ошибке
            this.viewer.orderList = [...this.originalOrderList];
            await this.viewer.blockRenderer.renderBlocks(
                this.viewer.notionPage, 
                this.viewer.orderList, 
                this.viewer.contentMap, 
                (id) => this.viewer.blockEditor.handleDeleteBlock(id)
            );
        }
    }

    cancelDrag() {
        // Восстанавливаем исходный порядок
        if (this.originalOrderList.length > 0) {
            this.viewer.orderList = [...this.originalOrderList];
            this.viewer.blockRenderer.renderBlocks(
                this.viewer.notionPage, 
                this.viewer.orderList, 
                this.viewer.contentMap, 
                (id) => this.viewer.blockEditor.handleDeleteBlock(id)
            );
        }
    }
}