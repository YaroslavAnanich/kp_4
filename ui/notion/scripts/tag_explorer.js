export class TagExplorer {
    constructor() {
        this.tagsSection = document.querySelector('.tags-section');
        this.tagsContent = this.tagsSection.querySelector('.spoiler-content');
        this.createTagBtn = this.tagsSection.querySelector('.create-tag-btn');
        this.tagsCache = null;
        this.onCollectionDeleted = null;
        this.onTagsUpdated = null;
        this.onCollectionSelected = null;
    }

    init(tags = null, collections = null) {
        if (tags && collections) {
            this.tagsCache = tags;
            this.renderTags(tags, collections);
        } else {
            this.loadTags(collections);
        }
        this.bindEvents();
    }

    bindEvents() {
        this.createTagBtn.addEventListener('click', (e) => {
            this.createNewTag();
        });

        // Спойлер для тэгов
        const spoilerToggle = this.tagsSection.querySelector('.spoiler-toggle');
        spoilerToggle.addEventListener('click', (e) => {
            this.toggleSpoiler(e.target.closest('.spoiler-toggle'));
        });
    }

    toggleSpoiler(button) {
        const icon = button.querySelector('i');
        const content = button.closest('.nav-section').querySelector('.spoiler-content');
        
        if (content.style.display === 'none' || !content.style.display) {
            content.style.display = 'block';
            icon.style.transform = 'rotate(90deg)';
        } else {
            content.style.display = 'none';
            icon.style.transform = 'rotate(0deg)';
        }
    }

    async loadTags(collections = null) {
        try {
            const response = await fetch(`http://localhost:8000/tags?user_id=1`);
            this.tagsCache = await response.json();
            this.renderTags(this.tagsCache, collections);
        } catch (error) {
            console.error('Error loading tags:', error);
            this.tagsCache = [];
        }
    }

    renderTags(tags, collections = null) {
        // Сохраняем состояние спойлеров
        const openStates = this.saveSpoilerStates();
        
        this.tagsContent.innerHTML = '';
        
        tags.forEach(tag => {
            const tagElement = this.createTagElement(tag, collections);
            this.tagsContent.appendChild(tagElement);
        });

        // Восстанавливаем состояние спойлеров
        this.restoreSpoilerStates(openStates);
    }

    createTagElement(tag, collections = null) {
        const tagDiv = document.createElement('div');
        tagDiv.className = 'tag-item';
        tagDiv.dataset.tagId = tag.id;

        const tagHeader = document.createElement('div');
        tagHeader.className = 'tag-header-wrapper';

        const spoilerBtn = document.createElement('button');
        spoilerBtn.className = 'spoiler-toggle';
        spoilerBtn.innerHTML = '<i class="fas fa-caret-right"></i><span class="toggle-content">' + tag.name + '</span>';

        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'delete-btn delete-tag-btn';
        deleteBtn.innerHTML = '<i class="fas fa-times"></i>';
        deleteBtn.title = 'Delete Tag';

        tagHeader.appendChild(spoilerBtn);
        tagHeader.appendChild(deleteBtn);
        tagDiv.appendChild(tagHeader);

        const collectionsContainer = document.createElement('div');
        collectionsContainer.className = 'spoiler-content tag-collections-container';
        collectionsContainer.style.display = 'none';
        tagDiv.appendChild(collectionsContainer);

        // Рендерим коллекции для этого тега
        this.renderTagCollections(tag.id, collectionsContainer, collections);

        // События
        spoilerBtn.addEventListener('click', (e) => {
            this.toggleTagSpoiler(e.target.closest('.spoiler-toggle'), collectionsContainer);
        });

        deleteBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.deleteTag(tag.id, tagDiv);
        });

        return tagDiv;
    }

    toggleTagSpoiler(button, content) {
        const icon = button.querySelector('i');
        
        if (content.style.display === 'none' || !content.style.display) {
            content.style.display = 'block';
            icon.style.transform = 'rotate(90deg)';
        } else {
            content.style.display = 'none';
            icon.style.transform = 'rotate(0deg)';
        }
    }

    renderTagCollections(tagId, container, collections = null) {
        const tagCollections = collections ? 
            collections.filter(collection => collection.tag_id === tagId) : 
            [];
        
        if (tagCollections.length === 0) {
            container.innerHTML = '<div style="padding: 3px 5px; color: #888; font-size: 0.8em;">No collections</div>';
            return;
        }

        const collectionsList = document.createElement('ul');
        collectionsList.className = 'tag-collections';

        tagCollections.forEach(collection => {
            const collectionItem = document.createElement('li');
            collectionItem.className = 'collection-item';
            collectionItem.dataset.collectionId = collection.id;

            const nameSpan = document.createElement('span');
            nameSpan.className = 'collection-name-text';
            nameSpan.textContent = collection.name;

            const deleteBtn = document.createElement('button');
            deleteBtn.className = 'delete-btn';
            deleteBtn.innerHTML = '<i class="fas fa-times"></i>';
            deleteBtn.title = 'Delete Collection';

            collectionItem.appendChild(nameSpan);
            collectionItem.appendChild(deleteBtn);
            collectionsList.appendChild(collectionItem);

            // Добавляем обработчик клика на коллекцию в теге
            collectionItem.addEventListener('click', (e) => {
                // Игнорируем клик по кнопке удаления
                if (!e.target.closest('.delete-btn')) {
                    this.selectCollectionFromTag(collection, collectionItem);
                }
            });

            deleteBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.deleteCollection(collection.id, collection.qdrant_id, collectionItem);
            });
        });

        container.innerHTML = '';
        container.appendChild(collectionsList);
    }

    selectCollectionFromTag(collection, element) {
        // Вызываем событие выбора коллекции
        if (this.onCollectionSelected) {
            this.onCollectionSelected(collection);
        }
    }

    async createNewTag() {
        const tagName = prompt('Enter tag name:');
        if (!tagName) return;

        try {
            const response = await fetch(`http://localhost:8000/tags?user_id=1&name=${encodeURIComponent(tagName)}`, {
                method: 'POST'
            });
            
            if (response.ok) {
                const newTag = await response.json();
                // Немедленно добавляем новый тег в интерфейс
                this.tagsCache.push(newTag);
                this.renderTags(this.tagsCache);
                if (this.onTagsUpdated) this.onTagsUpdated();
            }
        } catch (error) {
            console.error('Error creating tag:', error);
        }
    }

    async deleteTag(tagId, tagElement) {
        if (!confirm('Are you sure you want to delete this tag?')) return;

        try {
            const response = await fetch(`http://localhost:8000/tags/${tagId}`, {
                method: 'DELETE'
            });
            
            if (response.ok) {
                // Немедленно удаляем тег из интерфейса
                this.tagsCache = this.tagsCache.filter(tag => tag.id !== tagId);
                this.renderTags(this.tagsCache);
                if (this.onTagsUpdated) this.onTagsUpdated();
            }
        } catch (error) {
            console.error('Error deleting tag:', error);
        }
    }

    async deleteCollection(collectionId, qdrantId, collectionElement) {
        if (!confirm('Are you sure you want to delete this collection?')) return;

        try {
            const response = await fetch(`http://localhost:8000/collections/${collectionId}?qdrant_id=${qdrantId}`, {
                method: 'DELETE'
            });
            
            if (response.ok) {
                // Немедленно удаляем коллекцию из интерфейса
                collectionElement.remove();
                if (this.onCollectionDeleted) this.onCollectionDeleted(collectionId);
                if (this.onTagsUpdated) this.onTagsUpdated();
            }
        } catch (error) {
            console.error('Error deleting collection:', error);
        }
    }

    removeCollectionFromAllTags(collectionId) {
        const collectionElements = this.tagsContent.querySelectorAll(`[data-collection-id="${collectionId}"]`);
        collectionElements.forEach(element => element.remove());
        
        // Обновляем пустые контейнеры
        const tagContainers = this.tagsContent.querySelectorAll('.tag-collections-container');
        tagContainers.forEach(container => {
            if (container.querySelectorAll('.collection-item').length === 0) {
                container.innerHTML = '<div style="padding: 3px 5px; color: #888; font-size: 0.8em;">No collections</div>';
            }
        });
    }

    refreshTags(tags = null, collections = null) {
        if (tags) {
            this.tagsCache = tags;
        }
        this.renderTags(this.tagsCache, collections);
    }

    saveSpoilerStates() {
        const states = {};
        const tagItems = this.tagsContent.querySelectorAll('.tag-item');
        
        tagItems.forEach(tagItem => {
            const tagId = tagItem.dataset.tagId;
            const container = tagItem.querySelector('.tag-collections-container');
            states[tagId] = container.style.display !== 'none';
        });
        
        return states;
    }

    restoreSpoilerStates(states) {
        Object.keys(states).forEach(tagId => {
            if (states[tagId]) {
                const tagItem = this.tagsContent.querySelector(`[data-tag-id="${tagId}"]`);
                if (tagItem) {
                    const button = tagItem.querySelector('.spoiler-toggle');
                    const container = tagItem.querySelector('.tag-collections-container');
                    if (button && container) {
                        container.style.display = 'block';
                        button.querySelector('i').style.transform = 'rotate(90deg)';
                    }
                }
            }
        });
    }
}