import uuid
import os
from typing import BinaryIO

from grpc import server


class FileUtil:
    def __init__(self, storage_path: str = "./var/files/"):
        self.storage_path = storage_path

    def save_file(self, file: BinaryIO) -> str:

        server_name = uuid.uuid4()
        file_path = f"{self.storage_path}{server_name}"


        with open(file_path, "wb") as f:
            f.write(file.read())

        return server_name