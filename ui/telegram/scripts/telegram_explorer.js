// ui/telegram/scripts/telegram_explorer.js
export class TelegramExplorer {
    constructor(apiBaseUrl, telegramViewer) {
        this.apiBaseUrl = apiBaseUrl;
        this.telegramViewer = telegramViewer;
        this.chatList = document.querySelector('.chat-list');

        // ← ВОТ ТУТ БЫЛА ОШИБКА! Было this.loadChats — без ()
        this.loadChats();  // ← ВЫЗЫВАЕМ, а не просто ссылаемся!

        this.setupEventListeners();
    }

    async loadChats() {
        try {
            const res = await fetch(`${this.apiBaseUrl}/tg/chats`);
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const data = await res.json();
            this.renderChats(data.chats || []);
        } catch (err) {
            console.error("Failed to load Telegram chats:", err);
            this.chatList.innerHTML = '<li style="padding:15px; color:#999;">Не удалось загрузить чаты</li>';
        }
    }

    renderChats(chats) {
        this.chatList.innerHTML = '';
        if (chats.length === 0) {
            this.chatList.innerHTML = '<li style="padding:15px; color:#999;">Нет чатов</li>';
            return;
        }

        chats.forEach(chat => {
            const li = document.createElement('li');
            li.className = 'chat-item';
            li.dataset.chatId = chat.id;

            const icon = chat.file_path
                ? `<img src="${chat.file_path}" alt="" style="width:32px;height:32px;border-radius:50%;margin-right:10px;object-fit:cover;">`
                : `<div style="width:32px;height:32px;border-radius:50%;background:#d9b981;margin-right:10px;flex-shrink:0;"></div>`;

            li.innerHTML = `
                <div style="display:flex;align-items:center; width:100%;">
                    ${icon}
                    <span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${chat.name}</span>
                </div>
            `;

            this.chatList.appendChild(li);
        });
    }

    setupEventListeners() {
        this.chatList.addEventListener('click', (e) => {
            const item = e.target.closest('.chat-item');
            if (!item) return;

            // Активный чат
            this.chatList.querySelectorAll('.chat-item').forEach(i => i.classList.remove('active'));
            item.classList.add('active');

            const chatId = item.dataset.chatId;
            if (this.telegramViewer && typeof this.telegramViewer.loadChat === 'function') {
                this.telegramViewer.loadChat(chatId);
            } else {
                console.error("telegramViewer не передан или не имеет loadChat()");
            }
        });
    }
}