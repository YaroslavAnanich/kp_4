import { CollectionViewer } from "./notion/scripts/collection_viewer.js";
import { NotionExplorer } from "./notion/scripts/notion_explorer.js";

// --- КОНФИГУРАЦИЯ ---
const API_BASE_URL = 'http://localhost:8000';
const USER_ID = 1;
// ---------------------

document.addEventListener('DOMContentLoaded', () => {
    // 1. Создаем экземпляр CollectionViewer
    // Временно передаем null в качестве explorer, так как NotionExplorer еще не создан.
    const collectionViewer = new CollectionViewer(API_BASE_URL, null);
    window.collectionViewer = collectionViewer; // Для удобства отладки

    // 2. Создаем экземпляр NotionExplorer, передавая ему Viewer
    const notionExplorer = new NotionExplorer(API_BASE_URL, USER_ID, collectionViewer);
    window.notionExplorer = notionExplorer; // Для удобства отладки

    // 3. Устанавливаем ссылку на explorer в CollectionViewer (замыкание цикла зависимости)
    collectionViewer.explorer = notionExplorer;
});