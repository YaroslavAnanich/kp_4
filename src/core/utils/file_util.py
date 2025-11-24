import uuid
import os
from typing import BinaryIO, Optional
from unstructured.partition.auto import partition


class FileUtil:
    def __init__(self, storage_path: str = "/home/parus/Projects/KP/var/"):
        self.storage_path = storage_path
        os.makedirs(self.storage_path, exist_ok=True)

    def save_file(self, file: BinaryIO, path: str, filename: Optional[str] = None) -> str:
        # Пытаемся получить расширение разными способами
        name, extension = os.path.splitext(filename)
        filename = uuid.uuid4()
        file_path = f"{self.storage_path}{path}/{filename}{extension}"

        with open(file_path, "wb") as f:
            f.write(file.read())

        return name, f"http://127.0.0.1:8080/var/{path}/{filename}{extension}"
    

    @staticmethod
    def get_file_text(file_path: str) -> str:
        try:
            elements = partition(file_path)
            text = "\n".join([str(el) for el in elements])
            return text
        except Exception as e:
            return f"Ошибка: {str(e)}"