from src.llm.service import LlmService



from src.core.utils.mysql_util import MySqlUtil
from src.core.utils.file_util import FileUtil
from src.telegram.service import TelegramService

from src.core.database import engine, session_factory
import os



file_manager = FileUtil()
my_sql_manager = MySqlUtil(engine=engine, session_factory=session_factory)


llm = LlmService(file_manager=file_manager, my_sql_manager=my_sql_manager)



