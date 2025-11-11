from sentence_transformers import SentenceTransformer

model = SentenceTransformer('all-MiniLM-L6-v2')
sentences = ["This is a test sentence"]
embeddings = model.encode(sentences)
print(f"Embeddings shape: {embeddings.shape}")
print("Установка прошла успешно!")