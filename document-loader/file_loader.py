import fitz
import docx
from fastapi import HTTPException
from table_processing import docx_tables_to_sentences, csv_to_sentences

def extract_text_from_file(file_path: str, filename: str) -> str:
    lower_name = filename.lower()
    if lower_name.endswith(".pdf"):
        doc = fitz.open(file_path)
        return "\n".join([page.get_text("text") for page in doc])
    elif lower_name.endswith(".txt"):
        with open(file_path, "r", encoding="utf-8") as f:
            return f.read()
    elif lower_name.endswith(".docx"):
        doc = docx.Document(file_path)
        all_text = "\n".join([p.text for p in doc.paragraphs if p.text.strip()])
        table_sentences = docx_tables_to_sentences(doc, filename)
        if table_sentences:
            all_text += "\n" + " ".join(table_sentences)
        return all_text
    elif lower_name.endswith(".csv"):
        return " ".join(csv_to_sentences(file_path, filename))
    else:
        raise HTTPException(status_code=400, detail="Unsupported file type")