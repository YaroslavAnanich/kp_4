export class LlmExplorer {
    constructor(apiBaseUrl, llmViewer) {
        this.api = apiBaseUrl;
        this.viewer = llmViewer;
        this.chats = [];
        this.popup = null;
        this.backdrop = null;
        this.init();
    }

    async init() {
        await this.loadChats();
        document.querySelector('.create-chat-btn').addEventListener('click', () => this.createChat());
        document.querySelector('.history-btn').addEventListener('click', () => this.toggleHistoryPopup());
    }

    async loadChats() {
        try {
            const res = await fetch(`${this.api}/llm/chats`);
            this.chats = res.ok ? await res.json() : [];
        } catch (e) { this.chats = []; }
    }

    async createChat() {
        try {
            const res = await fetch(`${this.api}/llm/chats`, { method: 'POST' });
            const chat = await res.json();
            this.chats.unshift(chat);
            this.viewer.loadChat(chat.id, chat.name || 'Новый чат');
            this.renderHistoryPopup();
        } catch (e) {
            alert('Ошибка создания чата');
        }
    }

    toggleHistoryPopup() {
        if (this.popup?.classList.contains('history-popup')) {
            this.closePopup();
        } else {
            this.showHistoryPopup();
        }
    }

    showHistoryPopup() {
        this.closePopup();
        this.createBackdrop();
        this.popup = this.createPopup('history-popup', 'История чатов');
        this.renderHistoryPopup();
    }

    renderHistoryPopup() {
        if (!this.popup) return;
        const body = this.popup.querySelector('.llm-popup-body');
        body.innerHTML = this.chats.length === 0
            ? '<div style="padding:20px;text-align:center;color:#888;">Нет чатов</div>'
            : this.chats.map(c => `
                <div class="history-item ${this.viewer.currentChatId === c.id ? 'active' : ''}"
                     onclick="window.llmExplorer.selectChat(${c.id})">
                    <span>${c.name || 'Новый чат'}</span>
                    <button class="delete-chat-btn" onclick="event.stopPropagation(); window.llmExplorer.deleteChat(${c.id})">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            `).join('');
    }

    async deleteChat(id) {
        if (!confirm('Удалить чат?')) return;
        await fetch(`${this.api}/llm/chats/${id}`, { method: 'DELETE' });
        this.chats = this.chats.filter(c => c.id !== id);
        if (this.viewer.currentChatId === id) this.viewer.clearChat();
        this.renderHistoryPopup();
    }

    selectChat(id) {
        const chat = this.chats.find(c => c.id === id);
        if (chat) {
            this.viewer.loadChat(id, chat.name || 'Новый чат');
            this.closePopup();
        }
    }

    createBackdrop() {
        this.backdrop = document.createElement('div');
        this.backdrop.className = 'llm-popup-backdrop';
        this.backdrop.onclick = () => this.closePopup();
        document.body.appendChild(this.backdrop);
    }

    createPopup(className, title) {
        const popup = document.createElement('div');
        popup.className = `llm-popup ${className}`;
        popup.innerHTML = `
            <div class="llm-popup-header">
                <span>${title}</span>
                <button class="llm-close-btn">×</button>
            </div>
            <div class="llm-popup-body"></div>
        `;
        popup.querySelector('.llm-close-btn').onclick = () => this.closePopup();
        document.body.appendChild(popup);
        return popup;
    }

    closePopup() {
        if (this.popup) this.popup.remove();
        if (this.backdrop) this.backdrop.remove();
        this.popup = null;
        this.backdrop = null;
    }
}