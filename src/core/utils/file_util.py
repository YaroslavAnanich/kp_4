import uuid
import os
from typing import BinaryIO
from unstructured.partition.auto import partition

class FileUtil:
    def __init__(self, storage_path: str = "./var/files/"):
        self.storage_path = storage_path
        os.makedirs(self.storage_path, exist_ok=True)

    def save_file(self, file: BinaryIO) -> str:
        server_name = str(uuid.uuid4())
        file_path = f"{self.storage_path}{server_name}"

        with open(file_path, "wb") as f:
            f.write(file.read())

        return str(server_name)

    def get_file_text(self, server_name: str) -> str:
        try:
            elements = partition(filename=f"{self.storage_path}{server_name}")
            text = "\n".join([str(el) for el in elements])
            return text
        except Exception as e:
            return f"Ошибка: {str(e)}"