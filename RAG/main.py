from fastapi import FastAPI, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from agents import create_rag_agent
from dataclasses import dataclass
from pymongo import MongoClient
import os
import shutil
import re
import ast
import requests
import json

@dataclass
class LangchainRuntimeContext:
    mongoClient: MongoClient
    userId: str

DOCUMENT_LOADER_URL = "http://document-loader:8001/load/document"
UPLOAD_DIR = "/uploaded_docs"
os.makedirs(UPLOAD_DIR, exist_ok=True)

app = FastAPI(title="RAG API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

agent = create_rag_agent(LangchainRuntimeContext)

class QueryRequest(BaseModel):
    question: str
    userId: str

@app.on_event("startup")
def app_startup():
    try:
        app.mongo_client = MongoClient(os.getenv("MONGO_URI"))
        app.mongo_client.admin.command("ping")
        print("Connected to MongoDB")
    except Exception as e:
        print("Something went wrong while connecting to MongoDB: " + e)
        raise Exception("Database connection failed")

@app.on_event("shutdown")
def app_shutdown():
    app.mongo_client.close()

@app.get("/")
def root():
    return {"message": "RAG API is running"}


@app.post("/query")
async def query_rag(request: QueryRequest):
    async def chat_generator():
        sources = []
        async for message_chunk, metadata in agent.astream(
            {"messages": [{"role": "user", "content": request.question}]},
            stream_mode="messages",
            context=LangchainRuntimeContext(mongoClient=app.mongo_client, userId=request.userId)
        ):
            if message_chunk.type != "ai" and message_chunk.type != "AIMessageChunk":
                continue
            # message_chunk is an instance of AiMessage or AIMessageChunk
            content = message_chunk.content
            
            # Extract Source blocks
            source_matches = re.findall(r"Source: ({.*?})", content, re.DOTALL)
            current_sources = []
            for match in source_matches:
                try:
                    src = ast.literal_eval(match)
                    sources.append(src)
                    current_sources.append(src)
                except Exception:
                    pass

            # Clean content for the stream
            clean_content = re.sub(r"Source: ({.*?})", "", content, flags=re.DOTALL)
            
            response_data = {
                "answer": clean_content,
                "sources": current_sources
            }
            # Yield as streaming data. Use [BREAK] to indicate that it is the end of the current stream/chunk
            yield f"{json.dumps(response_data)}[BREAK]"
        
        # Yield [DONE] to indicate the text has been fully sent
        yield "[DONE]"

    return StreamingResponse(chat_generator(), media_type="text/event-stream")

#this is the uploading document that call the chunking service
@app.post("/upload")
def upload_document(file: UploadFile = File(...)):
    # Call document loader container
    response = requests.post(
        DOCUMENT_LOADER_URL,
        files={"file": (file.filename, file.file)}
    )

    return response.json()


@app.get("/documents")
def get_documents():
    """
    Retrieve all documents in the vector store along with their chunk counts.
    """
    all_docs = []
    collection_data = vector_store._collection.get()
    ids = collection_data["ids"]
    metadatas = collection_data["metadatas"]

    # Create a dict to count chunks per file
    chunk_counts = {}
    for md in metadatas:
        filename = md.get("filename", "Unknown")
        chunk_counts[filename] = chunk_counts.get(filename, 0) + 1

    # Assign unique numeric ID for frontend
    for idx, filename in enumerate(chunk_counts.keys(), start=1):
        all_docs.append({
            "id": idx,
            "filename": filename,
            "chunks": chunk_counts[filename]
        })

    return {"documents": all_docs}
