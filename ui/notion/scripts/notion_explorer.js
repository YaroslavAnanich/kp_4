// NotionExplorer.js
// Этот класс будет экспортирован и импортирован в script.js

export class NotionExplorer {
    sidebarElement;
    tagsContent;
    collectionsList;
    allCollections = [];
    allTags = [];
    collectionViewer; 
    API_BASE_URL;
    USER_ID;

    /**
     * @param {string} apiBaseUrl - Базовый URL API.
     * @param {number} userId - ID пользователя.
     * @param {CollectionViewer} viewer - Ссылка на CollectionViewer.
     */
    constructor(apiBaseUrl, userId, viewer) {
        this.API_BASE_URL = apiBaseUrl;
        this.USER_ID = userId;
        this.collectionViewer = viewer;
        
        this.sidebarElement = document.querySelector('.notion-sidebar');
        this.tagsContent = this.sidebarElement.querySelector('.tags-section .spoiler-content');
        this.collectionsList = this.sidebarElement.querySelector('.collections-section .collection-list');

        this.initEventListeners();
        this.loadData();
    }

    initEventListeners() {
        this.sidebarElement.addEventListener('click', this.handleSidebarClick.bind(this));
        document.querySelector('.create-tag-btn').addEventListener('click', this.handleCreateTag.bind(this));
        document.querySelector('.create-collection-btn').addEventListener('click', this.handleCreateCollection.bind(this));

        // Инициализация спойлеров
        const tagSpoilerToggle = this.sidebarElement.querySelector('.tags-section > .nav-section-header > .spoiler-toggle');
        const collectionSpoilerToggle = this.sidebarElement.querySelector('.collections-section > .nav-section-header > .spoiler-toggle');

        if (tagSpoilerToggle) {
            this.tagsContent.style.display = 'block';
            tagSpoilerToggle.setAttribute('aria-expanded', 'true');
            tagSpoilerToggle.querySelector('i').classList.replace('fa-caret-right', 'fa-caret-down');
            tagSpoilerToggle.addEventListener('click', () => {
                this.handleSpoilerToggle(tagSpoilerToggle, this.tagsContent);
            });
        }

        if (collectionSpoilerToggle) {
            this.collectionsList.style.display = 'block';
            collectionSpoilerToggle.setAttribute('aria-expanded', 'true');
            collectionSpoilerToggle.querySelector('i').classList.replace('fa-caret-right', 'fa-caret-down');
            collectionSpoilerToggle.addEventListener('click', () => {
                this.handleSpoilerToggle(collectionSpoilerToggle, this.collectionsList);
            });
        }
    }

    async loadData() {
        const activeSpoilers = this.saveAndRestoreSpoilerState();

        try {
            const [tagsResponse, collectionsResponse] = await Promise.all([
                this.fetchTags(),
                this.fetchCollections()
            ]);
            
            this.allTags = tagsResponse;
            this.allCollections = collectionsResponse;

            this.collectionViewer.setAllTags(this.allTags);

            this.renderTagsAndCollections();
            this.saveAndRestoreSpoilerState(activeSpoilers);

        } catch (error) {
            console.error('Ошибка при загрузке данных:', error);
            alert('Не удалось загрузить теги или коллекции. Проверьте консоль.');
        }
    }

    // --- МЕТОДЫ РЕНДЕРИНГА САЙДБАРА ---

    saveAndRestoreSpoilerState(tagIdsToRestore) {
        if (!tagIdsToRestore) {
            const openTags = [];
            this.tagsContent.querySelectorAll('.tag-item').forEach(tagItem => {
                const toggle = tagItem.querySelector('.spoiler-toggle');
                if (toggle && toggle.getAttribute('aria-expanded') === 'true') {
                    openTags.push(tagItem.getAttribute('data-tag-id'));
                }
            });
            return openTags;
        } else {
            tagIdsToRestore.forEach(tagId => {
                const tagItem = this.tagsContent.querySelector(`.tag-item[data-tag-id="${tagId}"]`);
                if (tagItem) {
                    const toggle = tagItem.querySelector('.spoiler-toggle');
                    const content = tagItem.querySelector('.spoiler-content.tag-collections-container');
                    
                    if (toggle && content) {
                        if (toggle.getAttribute('aria-expanded') === 'false') {
                            this.handleSpoilerToggle(toggle, content);
                        }
                    }
                }
            });
        }
    }

    renderTagsAndCollections() {
        this.renderTags();
        this.renderCollectionsList();
    }

    renderTags() {
        this.tagsContent.innerHTML = '';
        
        const collectionsByTag = this.allCollections.reduce((acc, collection) => {
            if (collection.tag_id !== null) {
                if (!acc[collection.tag_id]) {
                    acc[collection.tag_id] = [];
                }
                acc[collection.tag_id].push(collection);
            }
            return acc;
        }, {});

        this.allTags.forEach(tag => {
            const tagItem = document.createElement('div');
            tagItem.className = 'tag-item';
            tagItem.setAttribute('data-tag-id', tag.id);

            const tagHeaderWrapper = document.createElement('div');
            tagHeaderWrapper.className = 'tag-header-wrapper';

            const spoilerToggle = document.createElement('button');
            spoilerToggle.className = 'spoiler-toggle';
            spoilerToggle.innerHTML = `
                <i class="fas fa-caret-right"></i>
                <span class="toggle-content">${tag.name}</span>
            `;
            spoilerToggle.setAttribute('aria-expanded', 'false');

            const deleteTagBtn = this.createDeleteButton('tag', tag.id);
            deleteTagBtn.classList.add('delete-tag-btn');

            tagHeaderWrapper.appendChild(spoilerToggle);
            tagHeaderWrapper.appendChild(deleteTagBtn);
            tagItem.appendChild(tagHeaderWrapper);

            const tagCollectionsContainer = document.createElement('div');
            tagCollectionsContainer.className = 'spoiler-content tag-collections-container';
            tagCollectionsContainer.style.display = 'none';

            const tagCollectionsList = document.createElement('ul');
            tagCollectionsList.className = 'tag-collections';

            const collections = collectionsByTag[tag.id] || [];
            collections.forEach(collection => {
                tagCollectionsList.appendChild(this.createCollectionItem(collection, true));
            });
            
            tagCollectionsContainer.appendChild(tagCollectionsList);
            tagItem.appendChild(tagCollectionsContainer);
            this.tagsContent.appendChild(tagItem);

            spoilerToggle.addEventListener('click', (e) => this.handleSpoilerToggle(e.currentTarget, tagCollectionsContainer));
        });
    }

    renderCollectionsList() {
        this.collectionsList.innerHTML = '';
        this.allCollections.forEach(collection => {
            this.collectionsList.appendChild(this.createCollectionItem(collection, false));
        });
    }

    createCollectionItem(collection, isNested) {
        const li = document.createElement('li');
        li.className = isNested ? 'collection-item' : 'collection-list-item';
        li.setAttribute('data-collection-id', collection.id);
        if (collection.tag_id !== null) {
            li.setAttribute('data-tag-id', collection.tag_id);
        }

        const nameSpan = document.createElement('span');
        nameSpan.className = 'collection-name-text';
        nameSpan.textContent = collection.name;
        
        li.appendChild(nameSpan);
        li.appendChild(this.createDeleteButton('collection', collection.id));

        return li;
    }

    createDeleteButton(type, id) {
        const button = document.createElement('button');
        button.className = 'delete-btn';
        button.setAttribute('data-action', 'delete');
        button.setAttribute('data-type', type);
        button.setAttribute('data-id', id);
        button.title = `Удалить ${type === 'tag' ? 'тег' : 'коллекцию'}`;
        button.innerHTML = '<i class="fas fa-trash"></i>';
        return button;
    }

    handleSpoilerToggle(toggleButton, contentElement) {
        const isExpanded = toggleButton.getAttribute('aria-expanded') === 'true';
        const icon = toggleButton.querySelector('i');
        
        if (isExpanded) {
            contentElement.style.display = 'none';
            toggleButton.setAttribute('aria-expanded', 'false');
            if (icon) {
                icon.classList.replace('fa-caret-down', 'fa-caret-right');
            }
        } else {
            contentElement.style.display = 'block';
            toggleButton.setAttribute('aria-expanded', 'true');
            if (icon) {
                icon.classList.replace('fa-caret-right', 'fa-caret-down');
            }
        }
    }


    // --- ОБРАБОТЧИК КЛИКОВ И ЛОГИКА ---

    handleSidebarClick(event) {
        const deleteTarget = event.target.closest('[data-action="delete"]');
        const collectionTarget = event.target.closest('.collection-list-item, .tag-collections .collection-item');

        if (deleteTarget) {
            const type = deleteTarget.getAttribute('data-type');
            const id = parseInt(deleteTarget.getAttribute('data-id'));
            
            if (confirm(`Вы уверены, что хотите удалить ${type === 'tag' ? 'тег' : 'коллекцию'} с ID: ${id}?`)) {
                if (type === 'collection') {
                    this.handleDeleteCollection(id);
                } else if (type === 'tag') {
                    this.handleDeleteTag(id);
                }
            }
        } else if (collectionTarget) {
            const collectionId = parseInt(collectionTarget.getAttribute('data-collection-id'));
            const collectionData = this.allCollections.find(c => c.id === collectionId);

            if (collectionData) {
                this.sidebarElement.querySelectorAll('.active-collection').forEach(el => el.classList.remove('active-collection'));
                collectionTarget.classList.add('active-collection');
                
                this.collectionViewer.selectCollection(collectionData);
            }
        }
    }

    // --- CRUD МЕТОДЫ САЙДБАРА ---

    async handleCreateTag() {
        const name = prompt('Введите название нового тега:');
        if (!name || name.trim() === '') return;

        try {
            await this.createTag(name);
            alert(`Тег "${name}" успешно создан.`);
            await this.loadData();
        } catch (error) {
            console.error('Ошибка при создании тега:', error);
            alert('Не удалось создать тег. Проверьте консоль.');
        }
    }

    async handleCreateCollection() {
        const name = prompt('Введите название новой коллекции:');
        if (!name || name.trim() === '') return;

        try {
            await this.createCollection(name);
            alert(`Коллекция "${name}" успешно создана.`);
            await this.loadData();
        } catch (error) {
            console.error('Ошибка при создании коллекции:', error);
            alert('Не удалось создать коллекцию. Проверьте консоль.');
        }
    }

    async handleDeleteCollection(collectionId) {
        try {
            await this.deleteCollection(collectionId);
            alert(`Коллекция ID:${collectionId} успешно удалена.`);
            await this.loadData();
        } catch (error) {
            console.error('Ошибка при удалении коллекции:', error);
            alert('Не удалось удалить коллекцию. Проверьте консоль.');
        }
    }

    async handleDeleteTag(tagId) {
        try {
            await this.deleteTag(tagId);
            alert(`Тег ID:${tagId} успешно удален. Связанные коллекции теперь без тега.`);
            await this.loadData();
        } catch (error) {
            console.error('Ошибка при удалении тега:', error);
            alert('Не удалось удалить тег. Проверьте консоль.');
        }
    }

    async fetchCollections() {
        const response = await fetch(`${this.API_BASE_URL}/users/${this.USER_ID}/collections`);
        if (!response.ok) throw new Error('Failed to fetch collections');
        return response.json();
    }

    async createCollection(name) {
        const url = `${this.API_BASE_URL}/users/${this.USER_ID}/collections?name=${encodeURIComponent(name)}`;
        const response = await fetch(url, { method: 'POST', headers: { 'accept': 'application/json' } });
        if (!response.ok) throw new Error('Failed to create collection');
        return response.json();
    }

    async deleteCollection(collectionId) {
        const url = `${this.API_BASE_URL}/collections/${collectionId}`;
        const response = await fetch(url, { method: 'DELETE', headers: { 'accept': 'application/json' } });
        if (!response.ok) throw new Error('Failed to delete collection');
    }

    async fetchTags() {
        const response = await fetch(`${this.API_BASE_URL}/tags?user_id=${this.USER_ID}`);
        if (!response.ok) throw new Error('Failed to fetch tags');
        return response.json();
    }

    async createTag(name) {
        const url = `${this.API_BASE_URL}/tags?user_id=${this.USER_ID}&name=${encodeURIComponent(name)}`;
        const response = await fetch(url, { method: 'POST', headers: { 'accept': 'application/json' } });
        if (!response.ok) throw new Error('Failed to create tag');
        return response.json();
    }

    async deleteTag(tagId) {
        const url = `${this.API_BASE_URL}/tags/${tagId}`;
        const response = await fetch(url, { method: 'DELETE', headers: { 'accept': 'application/json' } });
        if (!response.ok) throw new Error('Failed to delete tag');
    }
}