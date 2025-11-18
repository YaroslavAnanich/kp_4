import { NotionExplorer } from "./notion/scripts/notion_explorer.js";
import { CollectionViewer } from "./notion/scripts/collection_viewer.js";

// Инициализация когда DOM загружен
document.addEventListener('DOMContentLoaded', () => {
    const notionExplorer = new NotionExplorer();
    const collectionViewer = new CollectionViewer();

    // Интегрируем CollectionViewer с NotionExplorer
    notionExplorer.setCollectionViewer(collectionViewer);
});