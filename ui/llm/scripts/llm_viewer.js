export class LlmViewer {
    constructor(apiBaseUrl, llmExplorer) {
        this.api = apiBaseUrl;
        this.explorer = llmExplorer;
        this.currentChatId = null;

        this.pageEl = document.querySelector('.llm-page');
        this.inputEl = document.querySelector('.llm-input');
        this.sendBtn = document.querySelector('.send-message-btn');
        this.contextAddBtn = document.querySelector('.context-add-btn');
        this.contextContainer = document.querySelector('.context-tags-container');

        this.init();
    }

    init() {
        this.sendBtn.addEventListener('click', () => this.sendMessage());
        this.contextAddBtn.addEventListener('click', () => this.toggleContextPopup());

        this.inputEl.addEventListener('keypress', e => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                this.sendMessage();
            }
        });
    }

    toggleContextPopup() {
        const existing = document.querySelector('.context-popup');
        if (existing) {
            existing.remove();
            document.querySelector('.llm-popup-backdrop')?.remove();
        } else {
            this.showContextPopup();
        }
    }


    async showContextPopup() {
        if (!this.currentChatId) return alert('Сначала выберите чат');

        const backdrop = document.createElement('div');
        backdrop.className = 'llm-popup-backdrop';
        backdrop.onclick = () => {
            popup.remove();
            backdrop.remove();
        };
        document.body.appendChild(backdrop);

        const popup = document.createElement('div');
        popup.className = 'llm-popup context-popup';
        
        // Получаем координаты кнопки для позиционирования
        const buttonRect = this.contextAddBtn.getBoundingClientRect();
        
        popup.style.position = 'fixed';
        popup.style.left = `${buttonRect.left}px`;
        popup.style.bottom = `${window.innerHeight - buttonRect.top + 10}px`; // Показываем над кнопкой
        
        // Убираем заголовок и делаем только тело с элементами
        popup.innerHTML = `
            <div class="llm-popup-body">
                <h4 style="margin:12px 16px 8px; color:#666;">Коллекции</h4>
                <div id="cols" class="context-list"></div>
                <h4 style="margin:16px 16px 8px; color:#666;">Теги</h4>
                <div id="tags" class="context-list"></div>
            </div>
            <button class="llm-close-btn" style="position:absolute; top:8px; right:8px; background:none; border:none; font-size:1.2em; color:#999; cursor:pointer;">×</button>
        `;
        document.body.appendChild(popup);

        popup.querySelector('.llm-close-btn').onclick = () => {
            popup.remove();
            backdrop.remove();
        };

        const [cols, tags] = await Promise.all([
            fetch(`${this.api}/collections`).then(r => r.json()),
            fetch(`${this.api}/tags`).then(r => r.json())
        ]);

        popup.querySelector('#cols').innerHTML = cols.map(c => `<div class="context-item" data-type="collection" data-id="${c.id}">${c.name}</div>`).join('');
        popup.querySelector('#tags').innerHTML = tags.map(t => `<div class="context-item" data-type="tag" data-id="${t.id}">#${t.name}</div>`).join('');

        popup.addEventListener('click', async e => {
            const item = e.target.closest('.context-item');
            if (!item) return;
            const { type, id } = item.dataset;
            const url = type === 'collection'
                ? `${this.api}/llm/chats/${this.currentChatId}/context/collections?collection_id=${id}`
                : `${this.api}/llm/chats/${this.currentChatId}/context/tags?tag_id=${id}`;
            await fetch(url, { method: 'POST' });
            await this.loadCurrentContext();
            popup.remove();
            backdrop.remove();
        });
    }

    clearChat() {
        this.pageEl.innerHTML = `<div class="llm-message user-msg">Выберите коллекцию, чтобы начать общение с контекстом</div>
            <div class="llm-message assistant-msg">Я могу помочь суммировать или отвечать на вопросы по вашим коллекциям. Сначала выберите коллекцию слева.</div>`;
        this.currentChatId = null;
        this.updateContextTags([]);
    }

    async loadChat(id, name = 'Новый чат') {
        this.currentChatId = id;
        this.pageEl.innerHTML = '<div class="loading">Загрузка...</div>';
        this.updateContextTags([]);

        try {
            const res = await fetch(`${this.api}/llm/chats/${id}/history`);
            const history = res.ok ? await res.json() : [];
            this.pageEl.innerHTML = '';
            history.forEach(m => {
                if (m.request_content) this.addMessage(m.request_content, 'user');
                if (m.response_content) this.addMessage(m.response_content, 'assistant', m.documents || []);
            });
            this.pageEl.scrollTop = this.pageEl.scrollHeight;
        } catch (e) {
            this.pageEl.innerHTML = '<p style="color:red;text-align:center;">Ошибка</p>';
        }

        await this.loadCurrentContext();
        this.inputEl.focus();
    }

    addMessage(content, role, docs = []) {
        const div = document.createElement('div');
        div.className = `llm-message ${role}-msg`;
        div.innerHTML = (content || '').replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>').replace(/\n/g, '<br>');
        if (docs.length) {
            div.innerHTML += `<div class="message-sources"><strong>Источники:</strong> ` +
                docs.map(d => `<a href="${d.file_path}" target="_blank">${d.file_name}</a>`).join(' • ') + `</div>`;
        }
        this.pageEl.appendChild(div);
        this.pageEl.scrollTop = this.pageEl.scrollHeight;
    }

    async sendMessage() {
        if (!this.currentChatId) return alert('Please create or select a chat first');

        const text = this.inputEl.value.trim();
        if (!text) return;

        this.addMessage(text, 'user');
        this.inputEl.value = '';

        // ←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←
        // КРАСИВАЯ АНИМАЦИЯ ЗАГРУЗКИ ВМЕСТО "Думаю..."
        const thinkingDiv = document.createElement('div');
        thinkingDiv.className = 'llm-message assistant-msg';
        thinkingDiv.innerHTML = `
            <div class="typing-indicator">
                <span></span>
                <span></span>
                <span></span>
            </div>
        `;
        this.pageEl.appendChild(thinkingDiv);
        this.pageEl.scrollTop = this.pageEl.scrollHeight;
        // ←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←

        try {
            const res = await fetch(`${this.api}/llm/chats/${this.currentChatId}/search?request=${encodeURIComponent(text)}`);
            const data = await res.json();

            thinkingDiv.remove();                                                   // убираем анимацию
            this.addMessage(data.response || 'No response from the model', 'assistant', data.documents || []);
        } catch (e) {
            thinkingDiv.remove();
            this.addMessage('Error: could not get a response', 'assistant');
        }
    }

    async loadCurrentContext() {
        if (!this.currentChatId) return;
        const res = await fetch(`${this.api}/llm/chats/${this.currentChatId}/context/collections`);
        const cols = res.ok ? await res.json() : [];
        this.updateContextTags(cols.map(c => ({ id: c.id, name: c.name })));
    }

    updateContextTags(items) {
        this.contextContainer.innerHTML = '';
        items.forEach(item => {
            const tag = document.createElement('span');
            tag.className = 'context-tag';
            tag.innerHTML = `${item.name} <i class="fas fa-times"></i>`;
            tag.querySelector('i').onclick = () => this.removeContext(item.id);
            this.contextContainer.appendChild(tag);
        });
    }

    async removeContext(id) {
        await fetch(`${this.api}/llm/chats/${this.currentChatId}/context/${id}`, { method: 'DELETE' });
        this.loadCurrentContext();
    }
}