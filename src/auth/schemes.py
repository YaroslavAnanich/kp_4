from pydantic import BaseModel

class UserScheme(BaseModel):
    phone: str
    password: str