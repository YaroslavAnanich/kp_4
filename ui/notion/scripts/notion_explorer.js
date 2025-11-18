import { TagExplorer } from './tag_explorer.js';
import { CollectionExplorer } from './collection_explorer.js';

export class NotionExplorer {
    constructor() {
        this.tagExplorer = new TagExplorer();
        this.collectionExplorer = new CollectionExplorer();
        this.collectionsCache = null;
        this.tagsCache = null;
        this.init();
    }

    async init() {
        // Загружаем данные один раз и передаем в оба компонента
        await this.loadAllData();
        this.tagExplorer.init(this.tagsCache, this.collectionsCache);
        this.collectionExplorer.init(this.collectionsCache);
        
        // Связываем события между компонентами
        this.tagExplorer.onCollectionDeleted = (collectionId) => {
            this.collectionExplorer.removeCollectionFromUI(collectionId);
            this.removeCollectionFromCache(collectionId);
        };
        
        this.collectionExplorer.onCollectionDeleted = (collectionId) => {
            this.tagExplorer.removeCollectionFromAllTags(collectionId);
            this.removeCollectionFromCache(collectionId);
        };

        this.tagExplorer.onTagsUpdated = async () => {
            await this.loadAllData();
            this.tagExplorer.refreshTags(this.tagsCache, this.collectionsCache);
            this.collectionExplorer.refreshCollections(this.collectionsCache);
        };

        this.collectionExplorer.onCollectionsUpdated = async () => {
            await this.loadAllData();
            this.tagExplorer.refreshTags(this.tagsCache, this.collectionsCache);
            this.collectionExplorer.refreshCollections(this.collectionsCache);
        };
    }

    async loadAllData() {
        try {
            // Загружаем теги и коллекции параллельно
            const [tagsResponse, collectionsResponse] = await Promise.all([
                fetch(`http://localhost:8000/tags?user_id=1`),
                fetch(`http://localhost:8000/users/1/collections`)
            ]);
            
            this.tagsCache = await tagsResponse.json();
            this.collectionsCache = await collectionsResponse.json();
        } catch (error) {
            console.error('Error loading data:', error);
            this.tagsCache = [];
            this.collectionsCache = [];
        }
    }

    removeCollectionFromCache(collectionId) {
        if (this.collectionsCache) {
            this.collectionsCache = this.collectionsCache.filter(c => c.id !== collectionId);
        }
    }

    // Метод для интеграции с CollectionViewer
    setCollectionViewer(collectionViewer) {
        this.collectionExplorer.onCollectionSelected = (collection) => {
            collectionViewer.showCollection(collection);
        };
        
        this.tagExplorer.onCollectionSelected = (collection) => {
            collectionViewer.showCollection(collection);
        };
    }
}