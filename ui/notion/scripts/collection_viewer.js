
// collection_viewer.js
import { ApiInteractor } from './ApiInteractor.js';
import { BlockPicker } from './BlockPicker.js';
import { BlockRenderer } from './BlockRenderer.js';
import { EventHandler } from './EventHandler.js';
import { MetadataManager } from './MetadataManager.js';
import { BlockEditor } from './BlockEditor.js';

export class CollectionViewer {
    // STATE
    currentCollectionId = null;
    currentCollectionName = '';
    currentTagId = null;
    allTags = [];
    contentMap = {};
    orderList = [];

    // DOM ELEMENTS
    nameDisplay = document.getElementById('collection-name-display');
    nameInput = document.getElementById('collection-name-input');
    tagMetaSpan = document.getElementById('tag-meta-span');
    tagSelect = document.getElementById('collection-tag-select');
    notionPage = document.querySelector('.notion-page');

    constructor(apiBaseUrl, explorer) {
        this.apiInteractor = new ApiInteractor(apiBaseUrl);
        this.blockPicker = new BlockPicker();
        this.blockRenderer = new BlockRenderer(this); // <-- передаём this (CollectionViewer)
        this.eventHandler = new EventHandler(this);
        this.metadataManager = new MetadataManager(this, this.tagMetaSpan, this.tagSelect, this.nameDisplay, this.nameInput);
        this.blockEditor = new BlockEditor(this);

        this.explorer = explorer;
        this.eventHandler.init(this.notionPage, this.nameDisplay, this.nameInput, this.tagSelect, this.blockPicker);
        this.notionPage.innerHTML = '<p>Please select a collection from the left panel to view its content.</p>';
    }

    setAllTags(tags) {
        this.metadataManager.setAllTags(tags);
    }

    selectCollection(collection) {
        this.currentCollectionId = collection.id;
        this.currentCollectionName = collection.name;
        this.currentTagId = collection.tag_id;
        
        this.nameDisplay.textContent = collection.name;
        this.nameInput.value = collection.name;
        
        this.nameDisplay.style.display = 'block';
        this.nameInput.style.display = 'none';

        this.metadataManager.renderTagMetadata();
        this.metadataManager.populateTagSelect(collection.tag_id);

        this.loadContent();
    }

    async loadContent() {
        if (!this.currentCollectionId) return;

        try {
            const data = await this.apiInteractor.fetchCollectionContent(this.currentCollectionId);

            this.contentMap = data.content.reduce((map, block) => {
                map[block.id] = block;
                return map;
            }, {});
            this.orderList = data.order_list;
            
            if (this.orderList.length === 0) {
                const newBlock = await this.apiInteractor.createEmptyTextBlock(this.currentCollectionId, 0);
                this.contentMap[newBlock.id] = newBlock;
                this.orderList.push(newBlock.id);
                await this.apiInteractor.updateOrderList(this.currentCollectionId, this.orderList);
            }

            this.blockRenderer.renderBlocks(this.notionPage, this.orderList, this.contentMap, (id) => this.blockEditor.handleDeleteBlock(id));

        } catch (error) {
            console.error('Error loading collection content:', error);
            this.notionPage.innerHTML = `<p style="color: red;">Ошибка загрузки контента: ${error.message}</p>`;
        }
    }
}