export class MetadataManager {
    constructor(collectionViewer, tagMetaSpan, tagSelect, nameDisplay, nameInput) {
        this.viewer = collectionViewer;
        this.tagMetaSpan = tagMetaSpan;
        this.tagSelect = this._createTagSelect(); // ИСПРАВЛЕНИЕ: создаем селект с правильной логикой
        this.nameDisplay = nameDisplay;
        this.nameInput = nameInput;
        
        // ИСПРАВЛЕНИЕ: сохраняем оригинальную ширину для поля ввода
        this.originalNameWidth = this.nameDisplay.offsetWidth + 'px';
        
        // ИСПРАВЛЕНИЕ: добавляем селект в DOM
        this.tagMetaSpan.parentNode.insertBefore(this.tagSelect, this.tagMetaSpan.nextSibling);
    }

    _createTagSelect() {
        const select = document.createElement('select');
        select.id = 'collection-tag-select';
        select.style.cssText = `
            display: none;
            border: 1px solid #d4d0c5;
            padding: 4px 8px;
            border-radius: 4px;
            font-size: 0.9em;
            color: #4a413a;
            margin-left: 5px;
            background-color: #fcfcf5;
            width: auto;
            max-width: 200px;
            min-width: 120px;
        `;
        return select;
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
        
        // ИСПРАВЛЕНИЕ: правильная логика переключения видимости
        this._setupTagSelectEvents();
    }

    _setupTagSelectEvents() {
        // Удаляем старые обработчики
        this.tagMetaSpan.removeEventListener('click', this._toggleTagSelect.bind(this));
        this.tagSelect.removeEventListener('blur', this._hideTagSelect.bind(this));
        this.tagSelect.removeEventListener('change', this._handleTagChange.bind(this));

        // Добавляем новые обработчики
        this.tagMetaSpan.addEventListener('click', this._toggleTagSelect.bind(this));
        this.tagSelect.addEventListener('blur', this._hideTagSelect.bind(this));
        this.tagSelect.addEventListener('change', this._handleTagChange.bind(this));
    }

    _toggleTagSelect() {
        this.tagMetaSpan.style.display = 'none';
        this.tagSelect.style.display = 'inline-block';
        this.tagSelect.focus();
    }

    _hideTagSelect() {
        // ИСПРАВЛЕНИЕ: небольшая задержка чтобы обработать change событие
        setTimeout(() => {
            this.tagSelect.style.display = 'none';
            this.tagMetaSpan.style.display = 'inline-block';
            this.renderTagMetadata();
        }, 100);
    }

    async _handleTagChange() {
        const tagId = this.tagSelect.value;
        const newTagId = tagId === 'null' ? null : parseInt(tagId);

        // ИСПРАВЛЕНИЕ: проверяем, что тег действительно изменился
        if (newTagId === this.viewer.currentTagId) {
            this.tagSelect.style.display = 'none';
            this.tagMetaSpan.style.display = 'inline-block';
            return;
        }

        try {
            const data = await this.viewer.apiInteractor.updateTag(this.viewer.currentCollectionId, newTagId);
            this.viewer.currentTagId = data.tag_id;
            this.renderTagMetadata();
            
            // ИСПРАВЛЕНИЕ: сразу скрываем селект и показываем мета-информацию
            this.tagSelect.style.display = 'none';
            this.tagMetaSpan.style.display = 'inline-block';
            
            this.viewer.explorer.loadData();
        } catch (error) {
            alert('Не удалось обновить тег коллекции.');
            console.error('Tag update error:', error);
            // ИСПРАВЛЕНИЕ: восстанавливаем предыдущее значение в селекте
            this.tagSelect.value = this.viewer.currentTagId === null ? 'null' : this.viewer.currentTagId.toString();
            this.tagSelect.style.display = 'none';
            this.tagMetaSpan.style.display = 'inline-block';
        }
    }

    // Удаляем старый метод handleTagChange так как теперь используем _handleTagChange

    startRename() {
        if (!this.viewer.currentCollectionId) return; 
        this.nameDisplay.style.display = 'none';
        this.nameInput.style.display = 'block';
        
        // ИСПРАВЛЕНИЕ: устанавливаем фиксированную ширину для поля ввода
        this.nameInput.style.width = this.originalNameWidth;
        this.nameInput.style.maxWidth = '400px'; // Максимальная ширина
        this.nameInput.style.minWidth = '200px'; // Минимальная ширина
        
        this.nameInput.focus();
        this.nameInput.select();
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