from enum import Enum

class MediaType(str, Enum):
    PHOTO = "photo"
    AUDIO = "audio"
    DOCUMENT = "document"
    LINK = "link"