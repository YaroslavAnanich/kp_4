export class BlockPicker {
    constructor() {
        this.pickerBlockId = null;
        this.blockPickerEl = this._createBlockPickerElement();
        document.body.appendChild(this.blockPickerEl);
    }

    _createBlockPickerElement() {
        const picker = document.createElement('div');
        picker.style.cssText = `
            position: fixed; 
            z-index: 200; 
            background: white; 
            border: 1px solid #e8e4db; 
            border-radius: 4px; 
            box-shadow: 0 4px 10px rgba(0,0,0,0.1); 
            padding: 5px 0; 
            display: none; 
            min-width: 150px;
            font-family: 'Roboto', sans-serif;
        `;
        
        const options = [
            { type: 'text', name: 'Text', icon: 'fas fa-paragraph' },
            { type: 'header 1', name: 'Heading 1', icon: 'fas fa-heading' },
            { type: 'list bullet', name: 'Bullet List', icon: 'fas fa-list-ul' },
            { type: 'list number', name: 'Numbered List', icon: 'fas fa-list-ol' },
            { type: 'link', name: 'Link', icon: 'fas fa-link' },
            { type: 'file photo', name: 'Photo', icon: 'fas fa-image' },
            { type: 'file audio', name: 'Audio', icon: 'fas fa-music' },
            { type: 'file document', name: 'Document', icon: 'fas fa-file' },
            { type: 'table', name: 'Table', icon: 'fas fa-table' }
        ];

        options.forEach(option => {
            const btn = document.createElement('button');
            btn.className = 'picker-option';
            btn.style.cssText = `
                display: block; 
                width: 100%; 
                text-align: left; 
                padding: 7px 10px; 
                border: none; 
                background: none; 
                cursor: pointer; 
                font-size: 0.9em; 
                color: #4a413a;
            `;
            btn.innerHTML = `<i class="${option.icon}" style="margin-right: 8px; width: 15px;"></i> ${option.name}`;
            btn.setAttribute('data-type', option.type);
            btn.addEventListener('mouseenter', () => btn.style.backgroundColor = '#f0f0f0');
            btn.addEventListener('mouseleave', () => btn.style.backgroundColor = 'white');
            picker.appendChild(btn);
        });
        
        return picker;
    }

    show(blockId, editableEl, currentContent, onSelect) {
        this._hide();
        this.pickerBlockId = blockId;

        const rect = editableEl.getBoundingClientRect();
        this.blockPickerEl.style.top = `${rect.top + rect.height + 5}px`;
        this.blockPickerEl.style.left = `${rect.left}px`;
        this.blockPickerEl.style.display = 'block';

        editableEl.textContent = currentContent.replace('/', '').trim();

        // Attach click listeners to options
        const buttons = this.blockPickerEl.querySelectorAll('button');
        buttons.forEach(btn => {
            btn.onclick = (e) => {
                const type = btn.getAttribute('data-type');
                this._hide();
                onSelect(type);
            };
        });
    }

    _hide() {
        this.blockPickerEl.style.display = 'none';
        this.pickerBlockId = null;
    }

    handleGlobalClick(e, notionPage) {
        if (this.blockPickerEl.style.display !== 'none' && !this.blockPickerEl.contains(e.target)) {
            this._hide();
        }
        notionPage.addEventListener('scroll', () => this._hide());
    }
}