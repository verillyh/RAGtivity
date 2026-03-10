from fastapi import FastAPI, UploadFile
import tempfile
import shutil
from text_processing import split_and_get_embeddings
from file_loader import extract_text_from_file

app = FastAPI(title="Document Loader Service")

@app.post("/load/document")
def load_document(file: UploadFile):
    with tempfile.NamedTemporaryFile(delete=True) as tmpfile:
        with open(tmpfile.name, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)

        raw_text = extract_text_from_file(tmpfile.name, file.filename)
        chunks, embeddings_list = split_and_get_embeddings(raw_text)

        return {
            "text": chunks,
            "embeddings": [emb.tolist() for emb in embeddings_list]
        }