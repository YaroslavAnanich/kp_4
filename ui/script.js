import { CollectionViewer } from "./notion/scripts/collection_viewer.js";
import { NotionExplorer } from "./notion/scripts/notion_explorer.js";
import { TelegramViewer } from "./telegram/scripts/telegram_viewer.js";
import { TelegramExplorer } from "./telegram/scripts/telegram_explorer.js";
import { LlmExplorer } from "./llm/scripts/llm_explorer.js";
import { LlmViewer } from "./llm/scripts/llm_viewer.js";
import { TelegramDropManager } from './telegram/scripts/TelegramDropManager.js'

const API_BASE_URL = 'http://localhost:8000';

document.addEventListener('DOMContentLoaded', () => {
    const collectionViewer = new CollectionViewer(API_BASE_URL, null);
    window.collectionViewer = collectionViewer;
    const notionExplorer = new NotionExplorer(API_BASE_URL, collectionViewer);
    window.notionExplorer = notionExplorer;
    collectionViewer.explorer = notionExplorer;

    const telegramViewer = new TelegramViewer(API_BASE_URL);
    window.telegramViewer = telegramViewer;
    const telegramExplorer = new TelegramExplorer(API_BASE_URL, telegramViewer);
    window.telegramExplorer = telegramExplorer;

    const llmViewer = new LlmViewer(API_BASE_URL);
    const llmExplorer = new LlmExplorer(API_BASE_URL, llmViewer);
    llmViewer.explorer = llmExplorer;

    window.llmExplorer = llmExplorer;
    window.llmViewer = llmViewer;

    const telegramDropManager = new TelegramDropManager(
        telegramViewer,
        collectionViewer,
        API_BASE_URL
    );

    window.telegramDropManager = telegramDropManager;
});