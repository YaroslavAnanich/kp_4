import { CollectionViewer } from "./notion/scripts/collection_viewer.js";
import { NotionExplorer } from "./notion/scripts/notion_explorer.js";
import { TelegramViewer } from "./telegram/scripts/telegram_viewer.js";
import { TelegramExplorer } from "./telegram/scripts/telegram_explorer.js";

const API_BASE_URL = 'http://localhost:8000';

document.addEventListener('DOMContentLoaded', () => {
    // 1. Notion (оставляем как было)
    const collectionViewer = new CollectionViewer(API_BASE_URL, null);
    window.collectionViewer = collectionViewer;
    const notionExplorer = new NotionExplorer(API_BASE_URL, collectionViewer);
    window.notionExplorer = notionExplorer;
    collectionViewer.explorer = notionExplorer;

    // 2. Telegram — ВАЖНЫЙ ПОРЯДОК!
    const telegramViewer = new TelegramViewer(API_BASE_URL);
    window.telegramViewer = telegramViewer;        // для дебага

    const telegramExplorer = new TelegramExplorer(API_BASE_URL, telegramViewer);
    window.telegramExplorer = telegramExplorer;    // для дебага
});