class LeftPanelController {
    constructor() {
        this.userId = 1;
        this.baseUrl = 'http://localhost:8000';
        this.tags = [];
        this.collections = [];

        // Переменные для отслеживания текущей выбранной коллекции
        this.currentCollectionId = null;
        this.currentCollectionName = null;
        this.currentTagId = null;

        this.initialize();
    }

    async initialize() {
        await this.loadTags();
        await this.loadCollections();
        this.renderTags();
        this.renderCollections();
        this.populateTagSelect();
        this.setupEventListeners();

        this.resetCenterPanel();
    }

    async loadTags() {
        try {
            const response = await fetch(`${this.baseUrl}/tags?user_id=${this.userId}`);
            this.tags = await response.json();
        } catch (error) {
            console.error('Error loading tags:', error);
        }
    }

    async loadCollections() {
        try {
            const response = await fetch(`${this.baseUrl}/users/${this.userId}/notes`);
            this.collections = await response.json();
        } catch (error) {
            console.error('Error loading collections:', error);
        }
    }

    // Получает ID открытых тегов
    getOpenTagIds() {
        const openIds = [];
        document.querySelectorAll('.tag-item').forEach(item => {
            const container = item.querySelector('.tag-collections');
            // Проверяем стиль, так как он устанавливается JS
            if (container && container.style.display === 'block') {
                openIds.push(item.dataset.tagId);
            }
        });
        return openIds;
    }

    // Восстанавливает состояние тегов
    restoreTagState(openIds) {
        openIds.forEach(id => {
            const tagItem = document.querySelector(`.tag-item[data-tag-id="${id}"]`);
            if (tagItem) {
                const collectionsContainer = tagItem.querySelector('.tag-collections');
                const icon = tagItem.querySelector('.tag-toggle i');
                if (collectionsContainer) {
                    collectionsContainer.style.display = 'block';
                    icon.className = 'fas fa-caret-down';
                }
            }
        });
    }

    renderTags() {
        const tagsSection = document.querySelector('.tags-section .spoiler-content');
        tagsSection.innerHTML = '';

        this.tags.forEach(tag => {
            const tagElement = document.createElement('div');
            tagElement.className = 'tag-item';
            tagElement.dataset.tagId = tag.id;

            // ИСПРАВЛЕНО: Добавлен div.tag-header-wrapper для Flex-контейнера
            tagElement.innerHTML = `
                <div class="tag-header-wrapper">
                    <button class="spoiler-toggle tag-toggle">
                        <span class="toggle-content">
                            <i class="fas fa-caret-right"></i>${tag.name}
                        </span>
                    </button>
                    <button class="delete-btn delete-tag-btn" data-id="${tag.id}" title="Удалить тег">
                        <i class="fas fa-trash-alt"></i>
                    </button>
                </div>
                <ul class="tag-collections" style="display: none;">
                    </ul>
            `;
            tagsSection.appendChild(tagElement);
        });
    }

    renderCollections() {
        const collectionsSection = document.querySelector('.collection-list');
        collectionsSection.innerHTML = '';

        // Show ALL collections in the main list
        this.collections.forEach(collection => {
            const collectionElement = document.createElement('li');
            collectionElement.className = 'collection-item';
            collectionElement.dataset.collectionId = collection.id;
            collectionElement.dataset.collectionName = collection.name;
            collectionElement.dataset.tagId = collection.tag_id || '0';
            collectionElement.dataset.qdrantId = collection.qdrant_id || ''; // НОВОЕ: Сохраняем Qdrant ID

            // НОВОЕ: Добавляем кнопку удаления
            collectionElement.innerHTML = `
                <span class="collection-name-text">${collection.name}</span>
                <button class="delete-btn delete-collection-btn" 
                        data-id="${collection.id}" 
                        data-qdrant-id="${collection.qdrant_id || ''}" 
                        title="Удалить коллекцию">
                    <i class="fas fa-trash-alt"></i>
                </button>
            `;
            collectionsSection.appendChild(collectionElement);
        });

        // Also populate collections under their respective tags for filtering
        this.populateTagCollections();
    }

    populateTagSelect() {
        const select = document.getElementById('collection-tag-select');
        select.innerHTML = '';

        // Опция "Без тега"
        const noTagOption = document.createElement('option');
        noTagOption.value = '0'; // Используем '0' для отсутствия тега
        noTagOption.textContent = 'No tag';
        select.appendChild(noTagOption);

        this.tags.forEach(tag => {
            const option = document.createElement('option');
            option.value = tag.id;
            option.textContent = tag.name;
            select.appendChild(option);
        });
    }

    populateTagCollections() {
        this.tags.forEach(tag => {
            const tagCollections = this.collections.filter(collection => collection.tag_id === tag.id);
            const tagElement = document.querySelector(`.tag-item[data-tag-id="${tag.id}"]`);

            if (tagElement) {
                const collectionsContainer = tagElement.querySelector('.tag-collections');
                collectionsContainer.innerHTML = '';

                tagCollections.forEach(collection => {
                    const collectionElement = document.createElement('li');
                    collectionElement.className = 'collection-item tag-collection-item';
                    collectionElement.dataset.collectionId = collection.id;
                    collectionElement.dataset.collectionName = collection.name;
                    collectionElement.dataset.tagId = collection.tag_id;
                    collectionElement.dataset.qdrantId = collection.qdrant_id || ''; // НОВОЕ: Сохраняем Qdrant ID

                    // НОВОЕ: Добавляем кнопку удаления
                    collectionElement.innerHTML = `
                        <span class="collection-name-text">${collection.name}</span>
                        <button class="delete-btn delete-collection-btn" 
                                data-id="${collection.id}" 
                                data-qdrant-id="${collection.qdrant_id || ''}" 
                                title="Удалить коллекцию">
                            <i class="fas fa-trash-alt"></i>
                        </button>
                    `;
                    collectionsContainer.appendChild(collectionElement);
                });
            }
        });
    }

    setupEventListeners() {
        // Create new tag
        document.querySelector('.create-tag-btn').addEventListener('click', () => {
            this.createNewTag();
        });

        // Create new collection
        document.querySelector('.create-collection-btn').addEventListener('click', () => {
            this.createNewCollection();
        });

        // --- НОВОЕ: Обработчик клика для кнопок удаления и спойлера тега ---
        document.addEventListener('click', (e) => {
            // Delete Tag
            const deleteTagBtn = e.target.closest('.delete-tag-btn');
            if (deleteTagBtn) {
                e.stopPropagation(); // Предотвращаем срабатывание спойлера
                const tagId = deleteTagBtn.dataset.id;
                this.deleteTag(tagId);
                return;
            }

            // Delete Collection
            const deleteCollectionBtn = e.target.closest('.delete-collection-btn');
            if (deleteCollectionBtn) {
                e.stopPropagation(); // Предотвращаем выбор коллекции
                const collectionId = deleteCollectionBtn.dataset.id;
                const qdrantId = deleteCollectionBtn.dataset.qdrantId;
                this.deleteCollection(collectionId, qdrantId);
                return;
            }

            // Tag spoiler toggle (Обычная логика спойлера)
            const tagToggle = e.target.closest('.tag-toggle');
            if (tagToggle) {
                const tagItem = tagToggle.closest('.tag-item');
                if (tagItem) {
                    const collectionsContainer = tagItem.querySelector('.tag-collections');
                    const icon = tagToggle.querySelector('i');

                    if (collectionsContainer.style.display === 'none' || collectionsContainer.style.display === '') {
                        collectionsContainer.style.display = 'block';
                        icon.className = 'fas fa-caret-down';
                    } else {
                        collectionsContainer.style.display = 'none';
                        icon.className = 'fas fa-caret-right';
                    }
                }
            }
        });
        // ---------------------------------------------------

        // Collection click handler (works for both main list and tag collections)
        document.addEventListener('click', (e) => {
            const collectionItem = e.target.closest('.collection-item');
            if (collectionItem && !e.target.closest('.delete-collection-btn')) { // Проверяем, что клик не был на кнопке удаления
                this.selectCollection(collectionItem);
            }
        });

        // General spoiler toggle for sections
        document.addEventListener('click', (e) => {
            if (e.target.closest('.spoiler-toggle') && !e.target.closest('.tag-toggle')) {
                const toggle = e.target.closest('.spoiler-toggle');
                const content = toggle.closest('.nav-section').querySelector('.spoiler-content');
                const icon = toggle.querySelector('i');

                if (content.style.display === 'none') {
                    content.style.display = 'block';
                    icon.className = 'fas fa-caret-down';
                } else {
                    content.style.display = 'none';
                    icon.className = 'fas fa-caret-right';
                }
            }
        });

        const nameInput = document.getElementById('collection-name-input');
        const tagSelect = document.getElementById('collection-tag-select');

        // Отправка при потере фокуса с поля имени
        nameInput.addEventListener('blur', () => {
            this.updateCollection();
        });

        // Отправка при нажатии Enter
        nameInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                nameInput.blur(); // Вызовет событие 'blur', которое отправит данные
            }
        });

        // Отправка при изменении тега
        tagSelect.addEventListener('change', () => {
            this.updateCollection();
        });
    }

    async createNewTag() {
        const tagName = prompt('Enter tag name:');
        if (!tagName) return;

        // 1. Сохраняем состояние открытых тегов
        const openTagIds = this.getOpenTagIds();

        try {
            const response = await fetch(`${this.baseUrl}/tags?user_id=${this.userId}&name=${encodeURIComponent(tagName)}`, {
                method: 'POST'
            });

            if (response.ok) {
                const newTag = await response.json();
                this.tags.push(newTag);

                // 2. Перерисовываем и восстанавливаем состояние
                this.renderTags();
                this.restoreTagState(openTagIds);

                this.populateTagCollections();
                this.populateTagSelect();
            }
        } catch (error) {
            console.error('Error creating tag:', error);
        }
    }

    // --- НОВОЕ: Удаление тега ---
    async deleteTag(tagId) {
        if (!confirm(`Вы уверены, что хотите удалить тег с ID ${tagId}? Все коллекции, привязанные к этому тегу, останутся, но будут "Без тега".`)) return;

        try {
            const response = await fetch(`${this.baseUrl}/tags/${tagId}`, {
                method: 'DELETE'
            });

            if (response.ok) {
                alert('Тег успешно удален.');

                // 1. Сохраняем состояние открытых тегов
                const openTagIds = this.getOpenTagIds().filter(id => id != tagId);

                // 2. Перезагружаем данные и перерисовываем
                await this.loadTags();
                await this.loadCollections();
                this.renderTags();
                this.restoreTagState(openTagIds);
                this.renderCollections();
                this.populateTagSelect();

                // Сбрасываем центральную панель, если удаленный тег был выбран
                if (this.currentTagId == tagId) {
                    this.resetCenterPanel();
                }
            } else {
                console.error('Failed to delete tag:', response.status, response.statusText);
                alert(`Ошибка при удалении тега: ${response.statusText}`);
            }
        } catch (error) {
            console.error('Error deleting tag:', error);
            alert('Произошла ошибка при удалении тега.');
        }
    }
    // ----------------------------


    async createNewCollection() {
        const collectionName = prompt('Enter collection name:');
        if (!collectionName) return;

        try {
            const response = await fetch(`${this.baseUrl}/users/${this.userId}/notes?name=${encodeURIComponent(collectionName)}`, {
                method: 'POST'
            });

            if (response.ok) {
                const newCollection = await response.json();
                this.collections.push(newCollection);
                this.renderCollections();
            }
        } catch (error) {
            console.error('Error creating collection:', error);
        }
    }

    // --- НОВОЕ: Удаление коллекции ---
    async deleteCollection(collectionId, qdrantId) {
        if (!confirm(`Вы уверены, что хотите удалить коллекцию с ID ${collectionId}? Это действие необратимо и удалит данные из Qdrant.`)) return;

        if (!qdrantId) {
            alert("Ошибка: Невозможно удалить коллекцию. Отсутствует ID Qdrant.");
            return;
        }

        try {
            const url = `${this.baseUrl}/notes/${collectionId}?qdrant_id=${qdrantId}`;
            const response = await fetch(url, {
                method: 'DELETE'
            });

            if (response.ok) {
                alert('Коллекция успешно удалена.');

                // 1. Сбрасываем центральную панель, если удаленная коллекция была выбрана
                if (this.currentCollectionId == collectionId) {
                    this.currentCollectionId = null;
                    this.resetCenterPanel();
                }

                // 2. Удаляем коллекцию локально и перерисовываем
                const openTagIds = this.getOpenTagIds();
                await this.loadCollections();
                this.renderCollections();
                this.restoreTagState(openTagIds); // Восстанавливаем состояние спойлеров
            } else {
                const errorData = await response.json();
                console.error('Failed to delete collection:', response.status, errorData.detail);
                alert(`Ошибка при удалении коллекции: ${errorData.detail || response.statusText}`);
            }
        } catch (error) {
            console.error('Error deleting collection:', error);
            alert('Произошла ошибка при удалении коллекции.');
        }
    }
    // ---------------------------------


    resetCenterPanel() {
        const nameDisplay = document.getElementById('collection-name-display');
        const nameInput = document.getElementById('collection-name-input');
        const tagSelect = document.getElementById('collection-tag-select');
        const tagMetaSpan = document.getElementById('tag-meta-span');

        nameDisplay.style.display = 'block';
        nameDisplay.textContent = 'Select a Collection';

        nameInput.style.display = 'none';
        nameInput.value = 'Select a Collection';

        tagSelect.style.display = 'none';
        tagMetaSpan.innerHTML = `<i class="fas fa-tags"></i> No collection selected`;
        tagMetaSpan.style.display = 'flex';
    }

    selectCollection(collectionElement) {
        // Remove active class from all collections
        document.querySelectorAll('.collection-item').forEach(item => {
            item.classList.remove('active');
        });

        // Add active class to selected collection
        collectionElement.classList.add('active');

        const collectionId = collectionElement.dataset.collectionId;
        const collectionName = collectionElement.dataset.collectionName;
        const tagId = collectionElement.dataset.tagId || '0';

        // Обновляем текущие данные в контроллере
        this.currentCollectionId = collectionId;
        this.currentCollectionName = collectionName;
        this.currentTagId = tagId;

        // Элементы UI
        const nameDisplay = document.getElementById('collection-name-display');
        const nameInput = document.getElementById('collection-name-input');
        const tagSelect = document.getElementById('collection-tag-select');
        const tagMetaSpan = document.getElementById('tag-meta-span');

        // Показываем поля ввода, скрываем статичный заголовок
        nameDisplay.style.display = 'none';
        nameInput.style.display = 'block';
        tagSelect.style.display = 'block';
        tagMetaSpan.style.display = 'flex';

        // Заполнение текущими значениями
        nameInput.value = collectionName;
        tagSelect.value = tagId;

        // Обновляем мета-информацию (span для корректного отображения иконки)
        tagMetaSpan.innerHTML = `<i class="fas fa-tags"></i> Tag:`;
    }

    async updateCollection() {
        const nameInput = document.getElementById('collection-name-input');
        const tagSelect = document.getElementById('collection-tag-select');

        const newName = nameInput.value.trim();
        const newTagId = tagSelect.value;
        const collectionId = this.currentCollectionId;

        if (!collectionId) return;

        // Проверка, изменилось ли что-то
        const isNameChanged = newName !== this.currentCollectionName;
        const isTagChanged = newTagId !== this.currentTagId;

        if (!isNameChanged && !isTagChanged) return;

        if (newName === "") {
            alert("Collection name cannot be empty.");
            nameInput.value = this.currentCollectionName; // Восстанавливаем старое имя
            return;
        }

        // Отправляем 'null' вместо '0' для сброса тега
        const tagSegment = (newTagId === '0') ? 'null' : newTagId;

        // Формируем URL запроса: /notes/{collection_id}/tags/{tag_id}?name={name}
        const url = `${this.baseUrl}/notes/${collectionId}/tags/${tagSegment}?name=${encodeURIComponent(newName)}`;

        try {
            console.log(`Sending PUT request to: ${url}`);
            const response = await fetch(url, {
                method: 'PUT'
            });

            if (response.ok) {
                console.log('Collection updated successfully.');

                // Обновляем локальные данные
                this.currentCollectionName = newName;
                this.currentTagId = newTagId;

                // Обновляем коллекцию в общем массиве
                const updatedCollection = this.collections.find(c => c.id == collectionId);
                if (updatedCollection) {
                    updatedCollection.name = newName;
                    updatedCollection.tag_id = newTagId === '0' ? null : parseInt(newTagId);
                }

                // 1. Сохраняем состояние открытых тегов перед полной перерисовкой
                const openTagIds = this.getOpenTagIds();

                // Перерендериваем списки, чтобы обновить имя и тег в левой панели
                this.loadCollections().then(() => {
                    this.renderCollections();

                    // 2. Восстанавливаем состояние открытых тегов
                    this.restoreTagState(openTagIds);

                    // Снова выделяем активную коллекцию
                    const activeItem = document.querySelector(`.collection-item[data-collection-id="${collectionId}"]`);
                    if(activeItem) {
                         // Обновляем data-атрибуты для корректного повторного выбора
                         activeItem.dataset.collectionName = newName;
                         activeItem.dataset.tagId = newTagId;
                         this.selectCollection(activeItem);
                    }
                });

            } else {
                console.error('Failed to update collection:', response.status, response.statusText);
                alert('Failed to update collection. Restoring previous values.');
                // Восстанавливаем старые значения в полях ввода, если обновление не удалось
                nameInput.value = this.currentCollectionName;
                tagSelect.value = this.currentTagId;
            }
        } catch (error) {
            console.error('Error updating collection:', error);
            alert('An error occurred while updating the collection.');
            nameInput.value = this.currentCollectionName;
            tagSelect.value = this.currentTagId;
        }
    }
}

// Initialize the controller when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new LeftPanelController();
});