from typing import List, Dict
from openai import OpenAI
from src.core.utils.file_util import FileUtil
from src.llm.mysql import LlmMysql


class LlmService:
    def __init__(self, engine, session_factory):
        self.llm_mysql = LlmMysql(engine=engine, session_factory=session_factory)
        self.file_util = FileUtil()
        self.client = OpenAI(base_url="https://openrouter.ai/api/v1",
                             api_key="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")



    def _get_chat_context(self, chat_id: int) -> List[str]:
        """Получает историю сообщений чата по его ID"""
        chat_messages = self.llm_mysql.get_all_request_responses_by_chat_id(chat_id)

        chat_context = []
        for message in chat_messages:
            if message.request_content:
                chat_context.append(f"[REQUEST] {message.request_content}")
            if message.response_content:
                chat_context.append(f"[RESPONSE] {message.response_content}")

        return chat_context



    def get_history_by_user_id(self, user_id: int):
        chats = self.llm_mysql.get_all_chats_by_user_id(user_id)
        history = {}

        for chat in chats:
            # Получаем все блоки запрос-ответ для текущего чата
            request_responses = self.llm_mysql.get_all_request_responses_by_chat_id(chat.id)
            history[chat.id] = request_responses

        return history


    def generate_response(self, request: str, chat_id: int) -> Dict:
        chat_context = self._get_chat_context(chat_id)


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
                            "text": request
                        },
                        {
                            "type": "text",
                            "text": "Anotand – это настоящий виртуоз игры за Китай в Age of Empires IV, превративший эту сложную цивилизацию в произведение стратегического искусства. Его стиль – это идеальный симбиоз агрессивного раннего давления и кинематографически красивого позднего доминирования, где каждый юнит используется с хирургической точностью. Anotand довел до совершенства механику династий, плавно перетекающих одна в другую как отточенный боевой танец – его переход от Сун к Юань выглядит как заранее спланированный спектакль, где противник играет отведенную ему роль жертвы. Особое мастерство он демонстрирует в использовании уникальных китайских осадных орудий – его огненные повозки и дворцовые стражи появляются на поле боя точно в нужный момент, словно по мановению волшебной палочки."
                        },
                        {
                            "type": "image_url",
                            "image_url": {
                                "url": "https://upload.wikimedia.org/wikipedia/commons/thumb/d/dd/Gfp-wisconsin-madison-the-nature-boardwalk.jpg/2560px-Gfp-wisconsin-madison-the-nature-boardwalk.jpg"
                            }
                        }
                    ]
                }
            ]
        )
        response = completion.choices[0].message.content


        self.llm_mysql.add_request_response(chat_id=chat_id, request_content=request, response_content=response)

        return {
            "request": request,
            "response": response
        }





