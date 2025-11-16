class CollectionExplorer {
    constructor() {
        this.userId = 1;
        this.baseUrl = 'http://localhost:8000';
        this.collectionsList = document.querySelector('.collection-list');
        this.createCollectionBtn = document.querySelector('.create-collection-btn');
        this.spoilerToggle = document.querySelector('.collections-section .spoiler-toggle');
        this.spoilerContent = document.querySelector('.collections-section .spoiler-content');
        
        this.init();
    }

    init() {
        this.bindEvents();
        this.loadCollections();
    }

    bindEvents() {
        // Создание новой коллекции
        this.createCollectionBtn.addEventListener('click', () => {
            this.createNewCollection();
        });

        // Переключение видимости секции
        this.spoilerToggle.addEventListener('click', () => {
            this.toggleSpoiler();
        });
    }

    toggleSpoiler() {
        const isHidden = this.spoilerContent.style.display === 'none';
        this.spoilerContent.style.display = isHidden ? 'block' : 'none';
        
        const icon = this.spoilerToggle.querySelector('i');
        if (isHidden) {
            icon.classList.remove('fa-caret-right');
            icon.classList.add('fa-caret-down');
        } else {
            icon.classList.remove('fa-caret-down');
            icon.classList.add('fa-caret-right');
        }
    }

    async loadCollections() {
        try {
            const response = await fetch(`${this.baseUrl}/users/${this.userId}/collections`, {
                method: 'GET',
                headers: {
                    'accept': 'application/json'
                }
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const collections = await response.json();
            this.renderCollections(collections);
        } catch (error) {
            console.error('Error loading collections:', error);
            this.showError('Failed to load collections');
        }
    }

    renderCollections(collections) {
        this.collectionsList.innerHTML = '';

        collections.forEach(collection => {
            const listItem = this.createCollectionListItem(collection);
            this.collectionsList.appendChild(listItem);
        });
    }

    createCollectionListItem(collection) {
        const listItem = document.createElement('li');
        listItem.className = 'collection-item';
        listItem.setAttribute('data-collection-id', collection.id);
        listItem.setAttribute('data-qdrant-id', collection.qdrant_id || '');

        const nameSpan = document.createElement('span');
        nameSpan.className = 'collection-name-text';
        nameSpan.textContent = collection.name || 'Unnamed Collection';

        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'delete-btn';
        deleteBtn.title = 'Delete Collection';
        deleteBtn.innerHTML = '<i class="fas fa-times"></i>';
        
        deleteBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.deleteCollection(collection.id, collection.qdrant_id);
        });

        listItem.appendChild(nameSpan);
        listItem.appendChild(deleteBtn);

        // Добавляем обработчик клика для выбора коллекции
        listItem.addEventListener('click', () => {
            this.selectCollection(listItem, collection);
        });

        return listItem;
    }

    async createNewCollection() {
        const collectionName = prompt('Enter collection name:');
        if (!collectionName) return;

        try {
            const response = await fetch(
                `${this.baseUrl}/users/${this.userId}/collections?name=${encodeURIComponent(collectionName)}`,
                {
                    method: 'POST',
                    headers: {
                        'accept': 'application/json'
                    },
                    body: ''
                }
            );

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const newCollection = await response.json();
            this.addCollectionToList(newCollection);
            
        } catch (error) {
            console.error('Error creating collection:', error);
            this.showError('Failed to create collection');
        }
    }

    addCollectionToList(collection) {
        const listItem = this.createCollectionListItem(collection);
        this.collectionsList.appendChild(listItem);
    }

    async deleteCollection(collectionId, qdrantId) {
        if (!confirm('Are you sure you want to delete this collection?')) {
            return;
        }

        try {
            const url = qdrantId 
                ? `${this.baseUrl}/collections/${collectionId}?qdrant_id=${qdrantId}`
                : `${this.baseUrl}/collections/${collectionId}`;

            const response = await fetch(url, {
                method: 'DELETE',
                headers: {
                    'accept': 'application/json'
                }
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            this.removeCollectionFromList(collectionId);
            
        } catch (error) {
            console.error('Error deleting collection:', error);
            this.showError('Failed to delete collection');
        }
    }

    removeCollectionFromList(collectionId) {
        const collectionItem = this.collectionsList.querySelector(
            `[data-collection-id="${collectionId}"]`
        );
        
        if (collectionItem) {
            collectionItem.remove();
        }
    }

    selectCollection(listItem, collection) {
        // Убираем активный класс у всех элементов
        document.querySelectorAll('.collection-item').forEach(item => {
            item.classList.remove('active');
        });

        // Добавляем активный класс выбранному элементу
        listItem.classList.add('active');

        // Генерируем событие выбора коллекции
        const event = new CustomEvent('collectionSelected', {
            detail: { collection }
        });
        document.dispatchEvent(event);
    }

    showError(message) {
        alert(message);
    }

    // Метод для обновления списка коллекций
    refresh() {
        this.loadCollections();
    }
}

// Использование:
// const collectionExplorer = new CollectionExplorer();

export {CollectionExplorer}