export class ApiInteractor {
    constructor(apiBaseUrl) {
        this.API_BASE_URL = apiBaseUrl;
    }

    async fetchCollectionContent(collectionId) {
        const response = await fetch(`${this.API_BASE_URL}/collections/${collectionId}`);
        if (!response.ok) throw new Error('Failed to fetch collection content');
        return await response.json();
    }

    async createEmptyTextBlock(collectionId, index) {
        const payload = { type: 'text', content: '', index };
        const response = await fetch(`${this.API_BASE_URL}/collections/${collectionId}/blocks`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'accept': 'application/json' },
            body: JSON.stringify(payload)
        });
        if (!response.ok) throw new Error('Failed to create empty block');
        return await response.json();
    }

    async saveBlockContent(collectionId, block) {
        const response = await fetch(`${this.API_BASE_URL}/collections/${collectionId}/blocks`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'accept': 'application/json' },
            body: JSON.stringify(block)
        });
        if (!response.ok) throw new Error('Failed to save block content');
        return await response.json();
    }

    async replaceBlock(collectionId, block) {
        const response = await fetch(`${this.API_BASE_URL}/collections/${collectionId}/blocks`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'accept': 'application/json' },
            body: JSON.stringify(block)
        });
        if (!response.ok) throw new Error('Failed to replace block');
        return await response.json();
    }

    async uploadFile(collectionId, blockId, mediaType, file) {
        const url = `${this.API_BASE_URL}/collections/${collectionId}/file?block_id=${blockId}&media_type=${mediaType}`;
        const formData = new FormData();
        formData.append('file', file);
        const response = await fetch(url, { method: 'POST', body: formData });
        if (!response.ok) throw new Error('File upload failed');
        return await response.json();
    }

    async deleteBlock(collectionId, blockId) {
        const response = await fetch(`${this.API_BASE_URL}/collections/${collectionId}/blocks/${blockId}`, {
            method: 'DELETE',
            headers: { 'accept': 'application/json' }
        });
        if (!response.ok) throw new Error('Failed to delete block');
    }

    async updateOrderList(collectionId, newOrderList) {
        const response = await fetch(`${this.API_BASE_URL}/collections/${collectionId}/order`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json', 'accept': 'application/json' },
            body: JSON.stringify(newOrderList)
        });
        if (!response.ok) throw new Error('Failed to update block order');
    }

    async updateTag(collectionId, tagId) {
        const url = `${this.API_BASE_URL}/collections/${collectionId}/tags/${tagId === null ? 'null' : tagId}`;
        const response = await fetch(url, {
            method: 'PUT',
            headers: { 'accept': 'application/json' }
        });
        if (!response.ok) throw new Error('Failed to update tag');
        return await response.json();
    }

    async updateName(collectionId, newName) {
        const response = await fetch(`${this.API_BASE_URL}/collections/${collectionId}/name?name=${encodeURIComponent(newName)}`, {
            method: 'PUT',
            headers: { 'accept': 'application/json' }
        });
        if (!response.ok) throw new Error('Failed to update name');
        return await response.json();
    }
}