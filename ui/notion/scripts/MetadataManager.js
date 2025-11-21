export class MetadataManager {
    constructor(collectionViewer, tagMetaSpan, tagSelect, nameDisplay, nameInput) {
        this.viewer = collectionViewer;
        this.tagMetaSpan = tagMetaSpan;
        this.tagSelect = tagSelect;
        this.nameDisplay = nameDisplay;
        this.nameInput = nameInput;
    }

    setAllTags(tags) {
        this.viewer.allTags = tags;
        this.populateTagSelect(this.viewer.currentTagId);
    }

    renderTagMetadata() {
        if (!this.viewer.allTags.length) {
            this.tagMetaSpan.innerHTML = '<i class="fas fa-tags"></i> No tags available';
            return;
        }

        const currentTag = this.viewer.allTags.find(t => t.id === this.viewer.currentTagId);
        
        if (currentTag) {
            this.tagMetaSpan.innerHTML = `<i class="fas fa-tags"></i> ${currentTag.name}`;
        } else {
            this.tagMetaSpan.innerHTML = `<i class="fas fa-tags"></i> Без тега`;
        }
    }

    populateTagSelect(currentTagId) {
        this.tagSelect.innerHTML = '';
        
        const noTagOption = document.createElement('option');
        noTagOption.value = 'null';
        noTagOption.textContent = 'Без тега';
        noTagOption.selected = currentTagId === null;
        this.tagSelect.appendChild(noTagOption);

        this.viewer.allTags.forEach(tag => {
            const option = document.createElement('option');
            option.value = tag.id;
            option.textContent = tag.name;
            if (tag.id === currentTagId) {
                option.selected = true;
            }
            this.tagSelect.appendChild(option);
        });
        
        const toggleSelect = () => {
            if (this.tagSelect.style.display === 'none' || this.tagSelect.style.display === '') {
                this.tagMetaSpan.style.display = 'none';
                this.tagSelect.style.display = 'inline-block';
                this.tagSelect.focus();
            } else {
                this.tagSelect.style.display = 'none';
                this.tagMetaSpan.style.display = 'inline-block';
                this.renderTagMetadata();
            }
        };

        this.tagMetaSpan.removeEventListener('click', toggleSelect);
        this.tagSelect.removeEventListener('blur', toggleSelect);
        
        this.tagMetaSpan.addEventListener('click', toggleSelect);
        this.tagSelect.addEventListener('blur', toggleSelect);
    }

    async handleTagChange() {
        const tagId = this.tagSelect.value;
        const newTagId = tagId === 'null' ? null : parseInt(tagId);

        try {
            const data = await this.viewer.apiInteractor.updateTag(this.viewer.currentCollectionId, newTagId);
            this.viewer.currentTagId = data.tag_id;
            this.renderTagMetadata();
            this.tagSelect.style.display = 'none';
            this.tagMetaSpan.style.display = 'inline-block';
            this.viewer.explorer.loadData();
        } catch (error) {
            alert('Не удалось обновить тег коллекции.');
            console.error('Tag update error:', error);
            this.tagSelect.value = this.viewer.currentTagId === null ? 'null' : this.viewer.currentTagId.toString();
        }
    }

    startRename() {
        if (!this.viewer.currentCollectionId) return; 
        this.nameDisplay.style.display = 'none';
        this.nameInput.style.display = 'block';
        this.nameInput.focus();
    }

    async finishRename() {
        const newName = this.nameInput.value.trim();
        this.nameDisplay.style.display = 'block';
        this.nameInput.style.display = 'none';

        if (!this.viewer.currentCollectionId || newName === this.viewer.currentCollectionName || !newName) {
            this.nameInput.value = this.viewer.currentCollectionName;
            this.nameDisplay.textContent = this.viewer.currentCollectionName;
            return;
        }
        
        try {
            const data = await this.viewer.apiInteractor.updateName(this.viewer.currentCollectionId, newName);
            this.viewer.currentCollectionName = data.name;
            this.nameDisplay.textContent = data.name;
            this.nameInput.value = data.name;
            this.viewer.explorer.loadData(); 
        } catch (error) {
            alert('Не удалось обновить имя коллекции. Проверьте консоль.');
            console.error('Rename error:', error);
            this.nameInput.value = this.viewer.currentCollectionName;
            this.nameDisplay.textContent = this.viewer.currentCollectionName;
        }
    }
}
