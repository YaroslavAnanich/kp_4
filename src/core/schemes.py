from enum import Enum

class MediaType(str, Enum):
    PHOTO = "photo"
    VIDEO = "video"
    AUDIO = "audio"
    STICKER = "sticker"
    GIF = "gif"
    DOCUMENT = "document"
    LINK = "link"
    UNKNOWN = "unknown"
