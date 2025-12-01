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
            
            const prepend = !!this.oldestMessageId;
            let oldScrollHeight = 0;
            
            if (prepend) {
                oldScrollHeight = this.messagesContainer.scrollHeight; 
            }
            
            if (messages.length > 0) {
                this.oldestMessageId = messages[0].id;
            }

            this.renderMessages(messages, prepend);
            
            if (prepend) {
                const newScrollHeight = this.messagesContainer.scrollHeight;
                this.messagesContainer.scrollTop = newScrollHeight - oldScrollHeight; 
            } else {
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

            const hasText = msg.text && msg.text.trim().length > 0;
            const hasPhoto = msg.media_type === 'photo' && (msg.photo_base64 || msg.file_path);

            if (hasPhoto && !hasText) {
                div.classList.add('photo-only');
            }

            let html = '';
            
            if (msg.text) {
                html += `<div class="message-text">${this.escapeHtml(msg.text)}</div>`;
            }

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
        
        if (msg.media_type === 'photo' && msg.photo_base64) {
            html += `<div class="media-container photo-container">
                <img src="data:image/jpeg;base64,${msg.photo_base64}" class="media-photo" alt="Photo">
            </div>`;
        }
        else if (msg.media_type === 'audio' && msg.file_path) {
            html += `<div class="media-container audio-container">
                <audio controls class="media-audio">
                    <source src="${msg.file_path}" type="audio/mpeg">
                    Your browser does not support the audio element.
                </audio>
            </div>`;
        }
        else if (msg.media_type === 'document' && msg.file_path) {
            const fileName = msg.file_name || 'Download file';
            html += `<div class="media-container document-container">
                <a href="${msg.file_path}" download="${fileName}" class="document-link">
                    <i class="fas fa-file-download"></i>
                    <span>${this.escapeHtml(fileName)}</span>
                </a>
            </div>`;
        }
        else if (msg.media_type === 'link' && msg.text) {
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
        else if (msg.media_type && !msg.file_path && !msg.photo_base64) {
            let icon = 'fa-file';
            let text = 'File';
            switch(msg.media_type) {
                case 'audio': icon = 'fa-music'; text = 'Audio file'; break;
                case 'photo': icon = 'fa-image'; text = 'Photo'; break;
                case 'document': icon = 'fa-file'; text = 'Document'; break;
            }
            html += `<div class="media-container placeholder-container" data-msg-id="${msg.id}">
                <div class="media-placeholder" data-media-type="${msg.media_type}">
                    <i class="fas ${icon}"></i>
                    <span>${text}${msg.file_name ? ': ' + this.escapeHtml(msg.file_name) : ''}</span>
                    <button class="download-btn" onclick="telegramViewer.cacheMedia(${msg.id})">
                        Download
                    </button>
                </div>
            </div>`;
        }

        return html;
    }

    // ОПТИМИСТИЧНАЯ ОТПРАВКА СООБЩЕНИЯ
    async sendMessage() {
        const text = this.messageInput.value.trim();
        if (!text || !this.currentChatId) return;

        const tempId = Date.now(); // временный ID

        // 1. Сразу показываем сообщение локально
        const optimisticMessage = {
            id: tempId,
            text: text,
            is_outgoing: true,
            media_type: null
        };

        this.renderMessages([optimisticMessage], false);
        this.messagesContainer.scrollTop = this.messagesContainer.scrollHeight;
        this.messageInput.value = '';

        try {
            const response = await fetch(`${this.apiBaseUrl}/tg/${this.currentChatId}/send`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ text })
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }

            // Всё ок — сервер примет и пришлёт через WS, мы просто ждём

        } catch (err) {
            console.error("Send error:", err);

            // Помечаем сообщение как не отправленное
            const msgEl = this.messagesContainer.querySelector(`.message[data-message-id="${tempId}"]`);
            if (msgEl) {
                msgEl.style.opacity = '0.6';
                msgEl.style.border = '2px solid #e74c3c';
                msgEl.title = 'Не удалось отправить';

                if (!msgEl.querySelector('.retry-btn')) {
                    const retryBtn = document.createElement('button');
                    retryBtn.textContent = '↻';
                    retryBtn.className = 'retry-btn';
                    retryBtn.style.cssText = 'margin-left:8px;background:#e74c3c;color:white;border:none;padding:2px 6px;border-radius:4px;font-size:0.8em;cursor:pointer;';
                    retryBtn.onclick = (e) => {
                        e.stopPropagation();
                        const textToResend = msgEl.querySelector('.message-text')?.textContent || '';
                        msgEl.remove();
                        this.messageInput.value = textToResend;
                        this.sendMessage();
                    };
                    msgEl.appendChild(retryBtn);
                }
            }
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
                const msg = data.message;

                // Если сообщение уже есть (по ID) — не дублируем
                if (this.messagesContainer.querySelector(`.message[data-message-id="${msg.id}"]`)) {
                    return;
                }

                // Если это наше исходящее — удаляем временную версию (по совпадению текста)
                if (msg.is_outgoing) {
                    const outgoing = Array.from(this.messagesContainer.querySelectorAll('.message.outgoing'));
                    for (const el of outgoing.reverse()) {
                        const textEl = el.querySelector('.message-text');
                        if (textEl && textEl.textContent === msg.text) {
                            el.remove();
                            break;
                        }
                    }
                }

                this.renderMessages([msg], false);
                this.messagesContainer.scrollTop = this.messagesContainer.scrollHeight;
            }
        };

        this.websocket.onerror = (err) => console.error("WebSocket error:", err);
        this.websocket.onclose = () => console.log("WebSocket disconnected");
    }

    async cacheMedia(messageId) {
        try {
            const res = await fetch(`${this.apiBaseUrl}/tg/${this.currentChatId}/cache/${messageId}`, { method: 'POST' });
            if (res.ok) {
                const filePath = await res.text();
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

                    if (msgData.media_type === 'photo' && !messageDiv.querySelector('.message-text')) {
                        messageDiv.classList.add('photo-only');
                    }
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
        this.messageInput.addEventListener('keydown', e => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), this.sendMessage()));

        this.messagesContainer.addEventListener('scroll', () => {
            if (this.messagesContainer.scrollTop === 0 && this.hasMore) {
                this.loadMessages();
            }
        });

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