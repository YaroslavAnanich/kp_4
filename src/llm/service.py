from typing import List, Dict
from openai import OpenAI
from src.core.utils.file_util import FileUtil
from src.llm.models import RequestResponseOrm, LlmChatOrm
from src.llm.mysql import LlmMysql
from src.llm.schemes import AddNotionContextScheme
from src.notion.models import CollectionOrm
from src.core.database import engine, session_factory


class LlmService:
    def __init__(self):
        self.mysql = LlmMysql(engine=engine, session_factory=session_factory)
        self.file_util = FileUtil()
        self.client = OpenAI(base_url="https://openrouter.ai/api/v1",
                             api_key="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")




    def create_chat(self) -> LlmChatOrm:
        return self.mysql.add_chat()

    def delete_chat(self, chat_id: int) -> bool:
        return self.mysql.delete_chat(chat_id=chat_id)

    def get_user_chats(self) -> List[LlmChatOrm]:
        return self.mysql.get_all_chats()

    def get_chat_history(self, chat_id: int) -> list[RequestResponseOrm]:
        return self.mysql.get_all_request_responses_by_chat_id(chat_id=chat_id)

    def add_collection_context_to_chat(self, chat_id, notion_ids) -> list[int]:
        return self.mysql.add_chat_collections_by_qdrant_ids(chat_id=chat_id, qdrant_collection_ids=notion_ids)

    def get_collection_context_from_chat(self, chat_id: int) -> list[CollectionOrm]:
        return self.mysql.get_qdrant_collections_by_chat_id(chat_id=chat_id)

    def search_in_llm(self, request: str, chat_id: int, qdrant_context: str) -> Dict:
        chat_history = self.get_chat_history(chat_id=chat_id)
        chat_context = self._get_text_from_chat(chat_history)



        completion = self.client.chat.completions.create(
            extra_headers={},
            extra_body={},
            model="meta-llama/llama-4-maverick:free",
            messages=[
                {
                    "role": "user",
                    "content": [
                        {
                            "type": "text",
                            "text": f"Вот мой вопрос: {request}"
                        },
                        {
                            "type": "text",
                            "text": f"Вот история чата: {chat_context}"
                        },
                        {
                            "type": "text",
                            "text": f"Вот контекст: {qdrant_context}"
                        },
                        {
                            "type": "text",
                            "text": "Примечание, отвечай строго по контексту!!!"
                        }
                    ]
                }
            ]
        )
        response = completion.choices[0].message.content


        self.mysql.add_request_response(chat_id=chat_id, request_content=request, response_content=response)

        return {
            "request": request,
            "response": response
        }

    @staticmethod
    def _get_text_from_chat(chat_messages: list[RequestResponseOrm]) -> List[str]:
        """Получает историю сообщений чата по его ID"""
        chat_context = []
        for message in chat_messages:
            if message.request_content:
                chat_context.append(f"[REQUEST] {message.request_content}")
            if message.response_content:
                chat_context.append(f"[RESPONSE] {message.response_content}")

        return chat_context



