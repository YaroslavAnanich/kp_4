import uuid
import os
from typing import BinaryIO, Optional
import PyPDF2
from docx import Document
import magic


class FileUtil:
    def __init__(self, storage_path: str = "./var/files/"):
        self.storage_path = storage_path
        os.makedirs(self.storage_path, exist_ok=True)

    def save_file(self, file: BinaryIO) -> str:
        server_name = uuid.uuid4()
        file_path = f"{self.storage_path}{server_name}"

        with open(file_path, "wb") as f:
            f.write(file.read())

        return str(server_name)

    def get_file_path(self, server_name: str) -> Optional[str]:
        file_path = f"{self.storage_path}{server_name}"
        print(file_path)
        return file_path if os.path.exists(file_path) else None

    def get_file_text(self, server_name: str) -> Optional[str]:
        """
        Извлекает текст из файла по его server_name.
        Определяет тип файла по содержимому.
        Поддерживает форматы: txt, pdf, docx
        """
        file_path = f"{self.storage_path}{server_name}"

        if not os.path.exists(file_path):
            return None

        file_type = self._detect_file_type(file_path)

        if file_type == 'text/plain':
            return self._read_txt(file_path)
        elif file_type == 'application/pdf':
            return self._read_pdf(file_path)
        elif file_type in ['application/vnd.openxmlformats-officedocument.wordprocessingml.document',
                           'application/msword', 'application/zip']:
            return self._read_docx(file_path)
        else:
            print(f"Неподдерживаемый формат файла: {file_type}")
            return ""

    @staticmethod
    def _detect_file_type(file_path: str) -> str:
        """Определяет MIME-тип файла по содержимому"""
        mime = magic.Magic(mime=True)
        return mime.from_file(file_path)

    @staticmethod
    def _read_txt(file_path: str) -> str:
        """Чтение текстового файла"""
        with open(file_path, 'r', encoding='utf-8') as f:
            return f.read()

    @staticmethod
    def _read_pdf(file_path: str) -> str:
        """Чтение PDF файла"""
        text = ""
        with open(file_path, 'rb') as f:
            pdf_reader = PyPDF2.PdfReader(f)
            for page in pdf_reader.pages:
                text += page.extract_text() + "\n"
        return text.strip()

    @staticmethod
    def _read_docx(file_path: str) -> str:
        """Чтение DOCX файла"""
        doc = Document(file_path)
        text = ""
        for paragraph in doc.paragraphs:
            text += paragraph.text + "\n"
        return text.strip()