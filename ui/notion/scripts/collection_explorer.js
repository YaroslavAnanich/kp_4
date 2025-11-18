export class CollectionExplorer {
    constructor() {
        this.collectionsSection = document.querySelector('.collections-section');
        this.collectionsList = this.collectionsSection.querySelector('.collection-list');
        this.createCollectionBtn = this.collectionsSection.querySelector('.create-collection-btn');
        this.collectionsCache = null;
        this.onCollectionDeleted = null;
        this.onCollectionsUpdated = null;
        this.onCollectionSelected = null;
    }

    init(collections = null) {
        if (collections) {
            this.collectionsCache = collections;
            this.renderCollections(collections);
        } else {
            this.loadCollections();
        }
        this.bindEvents();
    }

    bindEvents() {
        this.createCollectionBtn.addEventListener('click', (e) => {
            this.createNewCollection();
        });

        // Спойлер для коллекций
        const spoilerToggle = this.collectionsSection.querySelector('.spoiler-toggle');
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

    async loadCollections() {
        try {
            const response = await fetch(`http://localhost:8000/users/1/collections`);
            this.collectionsCache = await response.json();
            this.renderCollections(this.collectionsCache);
        } catch (error) {
            console.error('Error loading collections:', error);
            this.collectionsCache = [];
        }
    }

    renderCollections(collections) {
        this.collectionsList.innerHTML = '';
        
        collections.forEach(collection => {
            const collectionElement = this.createCollectionElement(collection);
            this.collectionsList.appendChild(collectionElement);
        });
    }

    createCollectionElement(collection) {
        const li = document.createElement('li');
        li.className = 'collection-item';
        li.dataset.collectionId = collection.id;

        const nameSpan = document.createElement('span');
        nameSpan.className = 'collection-name-text';
        nameSpan.textContent = collection.name;

        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'delete-btn';
        deleteBtn.innerHTML = '<i class="fas fa-times"></i>';
        deleteBtn.title = 'Delete Collection';

        li.appendChild(nameSpan);
        li.appendChild(deleteBtn);

        // Добавляем обработчик клика на всю коллекцию
        li.addEventListener('click', (e) => {
            // Игнорируем клик по кнопке удаления
            if (!e.target.closest('.delete-btn')) {
                this.selectCollection(collection, li);
            }
        });

        deleteBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.deleteCollection(collection.id, collection.qdrant_id, li);
        });

        return li;
    }

    selectCollection(collection, element) {
        // Убираем выделение у всех коллекций
        const allCollections = this.collectionsList.querySelectorAll('.collection-item');
        allCollections.forEach(item => item.classList.remove('active'));
        
        // Выделяем выбранную коллекцию
        element.classList.add('active');
        
        // Вызываем событие выбора
        if (this.onCollectionSelected) {
            this.onCollectionSelected(collection);
        }
    }

    async createNewCollection() {
        const collectionName = prompt('Enter collection name:');
        if (!collectionName) return;

        try {
            const response = await fetch(`http://localhost:8000/users/1/collections?name=${encodeURIComponent(collectionName)}`, {
                method: 'POST'
            });
            
            if (response.ok) {
                const newCollection = await response.json();
                // Немедленно добавляем новую коллекцию в интерфейс
                this.collectionsCache.push(newCollection);
                this.renderCollections(this.collectionsCache);
                if (this.onCollectionsUpdated) this.onCollectionsUpdated();
            }
        } catch (error) {
            console.error('Error creating collection:', error);
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
                this.collectionsCache = this.collectionsCache.filter(c => c.id !== collectionId);
                this.renderCollections(this.collectionsCache);
                if (this.onCollectionDeleted) this.onCollectionDeleted(collectionId);
                if (this.onCollectionsUpdated) this.onCollectionsUpdated();
            }
        } catch (error) {
            console.error('Error deleting collection:', error);
        }
    }

    removeCollectionFromUI(collectionId) {
        const collectionElement = this.collectionsList.querySelector(`[data-collection-id="${collectionId}"]`);
        if (collectionElement) {
            collectionElement.remove();
        }
    }

    refreshCollections(collections = null) {
        if (collections) {
            this.collectionsCache = collections;
            this.renderCollections(collections);
        } else {
            this.loadCollections();
        }
    }
}