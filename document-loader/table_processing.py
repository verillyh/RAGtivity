import docx
import csv
from typing import List

def detect_entity_column(headers, rows):
    scores = []
    for col in range(len(headers)):
        values = [row[col] for row in rows if row[col]]
        if not values:
            scores.append(0)
            continue
        numeric_count = sum(v.replace('.', '', 1).isdigit() for v in values)
        unique_ratio = len(set(values)) / len(values)
        avg_length = sum(len(v) for v in values) / len(values)
        scores.append(unique_ratio * 2 + avg_length * 0.01 - numeric_count)
    return scores.index(max(scores))

def docx_tables_to_sentences(doc: docx.Document, filename: str) -> List[str]:
    sentences = []
    for table in doc.tables:
        headers = [cell.text.strip() for cell in table.rows[0].cells]
        rows = [[cell.text.strip() for cell in row.cells] for row in table.rows[1:]]
        if not rows:
            continue
        entity_col = detect_entity_column(headers, rows)
        for row in rows:
            entity = row[entity_col]
            parts = [f"{entity}'s {h.lower()} is {v}" for i, (h, v) in enumerate(zip(headers, row)) if i != entity_col and v]
            if parts:
                sentences.append(f"In {filename}, " + ", ".join(parts) + ".")
    return sentences

def csv_to_sentences(file_path: str, filename: str) -> List[str]:
    sentences = []
    with open(file_path, newline="", encoding="utf-8") as csvfile:
        reader = csv.reader(csvfile)
        rows = list(reader)
        if not rows:
            return []
        headers = rows[0]
        data_rows = rows[1:]
        entity_col = detect_entity_column(headers, data_rows)
        for row in data_rows:
            entity = row[entity_col]
            parts = [f"{entity}'s {h.lower()} is {v}" for i, (h, v) in enumerate(zip(headers, row)) if i != entity_col and v]
            if parts:
                sentences.append(f"In {filename}, " + ", ".join(parts) + ".")
    return sentences