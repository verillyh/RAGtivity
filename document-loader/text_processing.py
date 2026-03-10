import re
import spacy
import numpy as np
from sklearn.metrics.pairwise import cosine_similarity
from typing import List
from langchain_google_genai import GoogleGenerativeAIEmbeddings

# ----------------- Configuration -----------------
nlp = spacy.load("en_core_web_sm")
embeddings = GoogleGenerativeAIEmbeddings(
    model="models/gemini-embedding-001",
    output_dimensionality=768
)

SIMILARITY_THRESHOLD = 0.75
MAX_SENTENCES_PER_CHUNK = 5
BATCH_SIZE = 50

# ----------------- Text Cleaning -----------------
def clean_text(text: str) -> str:
    """
    Normalize line breaks, remove bullet markers, numbered lists,
    and excessive spaces.
    """
    text = re.sub(r'\r', '\n', text)
    text = re.sub(r'\n\s*[-+*•–—]\s*\n', '\n', text)
    text = re.sub(r'\n\s*[-+*•–—]\s*', '\n', text)
    text = re.sub(r'\n\s*(\d+)\.\s*', r'\n\1. ', text)
    text = re.sub(r'\s+', ' ', text)
    return text.strip()

# ----------------- Sentence Splitting -----------------
def split_sentences(text: str) -> List[str]:
    """
    Split text into sentences using spaCy and merge headings ending with ':'.
    """
    doc = nlp(text)
    raw_sentences = [sent.text.strip() for sent in doc.sents if sent.text.strip()]
    merged = []
    i = 0
    while i < len(raw_sentences):
        sentence = raw_sentences[i]
        if sentence.endswith(":") and i + 1 < len(raw_sentences):
            sentence += " " + raw_sentences[i + 1]
            i += 1
        merged.append(sentence.strip())
        i += 1
    # filter again to remove any empty strings
    return [s for s in merged if s]

# ----------------- Embedding Utilities -----------------
def batch_embed_texts(texts: List[str]) -> List[List[float]]:
    """
    Embed texts in batches to reduce memory usage and API calls.
    """
    embeddings_list = []
    for i in range(0, len(texts), BATCH_SIZE):
        batch = texts[i:i + BATCH_SIZE]
        batch_emb = embeddings.embed_documents(batch)
        embeddings_list.extend(batch_emb)
    return embeddings_list

# ----------------- Semantic Chunking -----------------
def semantic_merge(sentences: List[str], sentence_embeddings: List[List[float]]):
    """
    Merge sentences into chunks based on similarity and max sentences per chunk.
    Ensures no empty or whitespace-only chunks.
    """
    if not sentences:
        return [], []

    chunks, chunk_embeddings = [], []

    # start with first non-empty sentence
    i = 0
    while i < len(sentences) and not sentences[i].strip():
        i += 1
    if i >= len(sentences):
        return [], []

    current_chunk = [sentences[i].strip()]
    current_embeddings = [sentence_embeddings[i]]

    for j in range(i + 1, len(sentences)):
        sent = sentences[j].strip()
        if not sent:
            continue  # skip empty sentences

        sim = cosine_similarity([sentence_embeddings[j - 1]], [sentence_embeddings[j]])[0][0]

        if sim >= SIMILARITY_THRESHOLD and len(current_chunk) < MAX_SENTENCES_PER_CHUNK:
            current_chunk.append(sent)
            current_embeddings.append(sentence_embeddings[j])
        else:
            joined = " ".join([s for s in current_chunk if s.strip()])
            if joined:  # only append non-empty chunks
                chunks.append(joined)
                chunk_embeddings.append(np.mean(current_embeddings, axis=0))
            current_chunk = [sent]
            current_embeddings = [sentence_embeddings[j]]

    # handle last chunk
    joined = " ".join([s for s in current_chunk if s.strip()])
    if joined:
        chunks.append(joined)
        chunk_embeddings.append(np.mean(current_embeddings, axis=0))

    return chunks, chunk_embeddings

# ----------------- Main Function -----------------
def split_and_get_embeddings(text: str):
    """
    Full pipeline: clean, split, embed, and semantic merge into chunks.
    """
    text = clean_text(text)
    sentences = split_sentences(text)
    if not sentences:
        return [], []

    sentence_embeddings = batch_embed_texts(sentences)
    return semantic_merge(sentences, sentence_embeddings)