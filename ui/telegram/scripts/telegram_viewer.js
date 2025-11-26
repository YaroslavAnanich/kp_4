export class TelegramViewer {
    constructor(apiBaseUrl) {
        this.apiBaseUrl = apiBaseUrl;
        this.messagesContainer = document.querySelector('.chat-messages');
        this.messageInput = document.querySelector('.integration-footer input');
        this.sendButton = document.querySelector('.integration-footer button');
        this.currentChatId = null;
        this.limit = 50;
        this.oldestMessageId = null;
        this.hasMore = true;
        this.websocket = null;

        this.setupEventListeners();
    }

    loadChat(chatId) {
        this.currentChatId = chatId;
        this.messagesContainer.innerHTML = '';
        this.oldestMessageId = null;
        this.hasMore = true;
        this.loadMessages();
        this.connectWebSocket();
    }

    async loadMessages() {
        if (!this.currentChatId || !this.hasMore) return;

        const url = new URL(`${this.apiBaseUrl}/tg/chats/${this.currentChatId}/messages`);
        url.searchParams.set('limit', this.limit);
        if (this.oldestMessageId) {
            url.searchParams.set('offset_id', this.oldestMessageId);
        }

        try {
            const res = await fetch(url);
            const messages = await res.json();
            
            if (messages.length < this.limit) this.hasMore = false;
            
            // Определяем, будем ли мы добавлять сообщения в начало (prepend = true)
            const prepend = !!this.oldestMessageId;
            let oldScrollHeight = 0;
            
            if (prepend) {
                // 1. Сохраняем старую высоту прокрутки перед добавлением
                oldScrollHeight = this.messagesContainer.scrollHeight; 
            }
            
            if (messages.length > 0) {
                this.oldestMessageId = messages[0].id;
            }

            this.renderMessages(messages, prepend);
            
            if (prepend) {
                // 3. Вычисляем новую высоту
                const newScrollHeight = this.messagesContainer.scrollHeight;
                // 4. Корректируем scrollTop, чтобы сохранить визуальное положение
                this.messagesContainer.scrollTop = newScrollHeight - oldScrollHeight; 
            } else {
                // Это первая загрузка - прокручиваем в самый низ
                this.messagesContainer.scrollTop = this.messagesContainer.scrollHeight;
            }
            
        } catch (err) {
            console.error("Load messages error:", err);
        }
    }

    renderMessages(messages, prepend = false) {
        const fragment = document.createDocumentFragment();
        messages.forEach(msg => {
            const div = document.createElement('div');
            div.className = `message ${msg.is_outgoing ? 'outgoing' : 'incoming'}`;
            div.dataset.messageId = msg.id;

            let html = '';
            
            // Текстовое содержимое
            if (msg.text) {
                html += `<div class="message-text">${this.escapeHtml(msg.text)}</div>`;
            }

            // Медиа контент
            html += this.renderMediaContent(msg);

            div.innerHTML = html || '<em>media</em>';
            fragment.appendChild(div);
        });

        if (prepend) {
            this.messagesContainer.prepend(fragment);
        } else {
            this.messagesContainer.appendChild(fragment);
        }
    }

    renderMediaContent(msg) {
        let html = '';
        
        // Фото (из base64)
        if (msg.media_type === 'photo' && msg.photo_base64) {
            html += `<div class="media-container photo-container">
                <img src="data:image/jpeg;base64,${msg.photo_base64}" class="media-photo" alt="Photo">
            </div>`;
        }
        // Аудио файл
        else if (msg.media_type === 'audio' && msg.file_path) {
            html += `<div class="media-container audio-container">
                <audio controls class="media-audio">
                    <source src="${msg.file_path}" type="audio/mpeg">
                    Your browser does not support the audio element.
                </audio>
            </div>`;
        }
        // Документ/файл
        else if (msg.media_type === 'document' && msg.file_path) {
            const fileName = msg.file_name || 'Download file';
            html += `<div class="media-container document-container">
                <a href="${msg.file_path}" download="${fileName}" class="document-link">
                    <i class="fas fa-file-download"></i>
                    <span>${this.escapeHtml(fileName)}</span>
                </a>
            </div>`;
        }
        // Ссылка
        else if (msg.media_type === 'link' && msg.text) {
            // Извлекаем URL из текста
            const urlMatch = msg.text.match(/https?:\/\/[^\s]+/);
            if (urlMatch) {
                const url = urlMatch[0];
                html += `<div class="media-container link-container">
                    <a href="${url}" target="_blank" rel="noopener noreferrer" class="link-preview">
                        <i class="fas fa-external-link-alt"></i>
                        <span>${this.escapeHtml(url)}</span>
                    </a>
                </div>`;
            }
        }
        // Медиа без кэша (placeholder)
        else if (msg.media_type && !msg.file_path && !msg.photo_base64) {
            let icon = 'fa-file';
            let text = 'File';
            
            switch(msg.media_type) {
                case 'audio':
                    icon = 'fa-music';
                    text = 'Audio file';
                    break;
                case 'photo':
                    icon = 'fa-image';
                    text = 'Photo';
                    break;
                case 'document':
                    icon = 'fa-file';
                    text = 'Document';
                    break;
            }
            
            html += `<div class="media-container placeholder-container" data-msg-id="${msg.id}">
                <div class="media-placeholder" data-media-type="${msg.media_type}">
                    <i class="fas ${icon}"></i>
                    <span>${text}${msg.file_name ? ': ' + this.escapeHtml(msg.file_name) : ''}</span>
                    <button class="download-btn" onclick="telegramViewer.cacheMedia(${msg.id})">
                        <i class="fas fa-download"></i> Download
                    </button>
                </div>
            </div>`;
        }

        return html;
    }

    async sendMessage() {
        const text = this.messageInput.value.trim();
        if (!text || !this.currentChatId) return;

        try {
            await fetch(`${this.apiBaseUrl}/tg/${this.currentChatId}/send`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ text })
            });
            this.messageInput.value = '';
        } catch (err) {
            console.error("Send error:", err);
        }
    }

    connectWebSocket() {
        if (this.websocket) this.websocket.close();

        const wsUrl = this.apiBaseUrl.replace('http', 'ws') + `/tg/ws/${this.currentChatId}`;
        this.websocket = new WebSocket(wsUrl);

        this.websocket.onopen = () => console.log("WebSocket connected:", wsUrl);
        this.websocket.onmessage = (e) => {
            const data = JSON.parse(e.data);
            if (data.type === 'new_message') {
                this.renderMessages([data.message], false);
                this.messagesContainer.scrollTop = this.messagesContainer.scrollHeight;
            }
        };
        this.websocket.onerror = (err) => console.error("WebSocket error:", err);
        this.websocket.onclose = () => console.log("WebSocket disconnected");
    }

    async cacheMedia(messageId) {
        try {
            const res = await fetch(`${this.apiBaseUrl}/tg/${this.currentChatId}/cache/${messageId}`, { 
                method: 'POST' 
            });
            
            if (res.ok) {
                const filePath = await res.text();
                
                // Находим placeholder и заменяем его на реальный медиа-элемент
                const placeholder = document.querySelector(`[data-msg-id="${messageId}"]`);
                if (placeholder) {
                    const messageDiv = placeholder.closest('.message');
                    const msgData = {
                        id: messageId,
                        media_type: placeholder.querySelector('.media-placeholder').dataset.mediaType,
                        file_path: filePath,
                        file_name: placeholder.querySelector('span').textContent.replace(/^[^:]+:\s?/, '')
                    };
                    
                    const newMediaHtml = this.renderMediaContent(msgData);
                    placeholder.outerHTML = newMediaHtml;
                }
                
                return filePath;
            }
            return null;
        } catch (err) {
            console.error("Cache media error:", err);
            return null;
        }
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    setupEventListeners() {
        this.sendButton.addEventListener('click', () => this.sendMessage());
        this.messageInput.addEventListener('keydown', e => e.key === 'Enter' && this.sendMessage());

        this.messagesContainer.addEventListener('scroll', () => {
            if (this.messagesContainer.scrollTop === 0 && this.hasMore) {
                this.loadMessages();
            }
        });

        // Обработчик для кнопок загрузки
        this.messagesContainer.addEventListener('click', async (e) => {
            if (e.target.closest('.download-btn')) {
                e.preventDefault();
                const placeholder = e.target.closest('.media-placeholder');
                if (placeholder) {
                    const msgId = placeholder.closest('[data-msg-id]').dataset.msgId;
                    await this.cacheMedia(parseInt(msgId));
                }
            }
        });
    }
}