from unstructured.partition.auto import partition

def extract_text_clean(file_path):
    try:
        elements = partition(filename=file_path)
        text = "\n".join([str(el) for el in elements])
        return text
    except Exception as e:
        return f"Ошибка: {str(e)}"

# Использование
text = extract_text_clean("./var/files/3b1a2a5b-f23a-478c-a49d-4d3294b8d4f5")
print(text)

