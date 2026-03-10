FROM python:3.11-slim

# Set working directory
WORKDIR /app

# Copy application files
COPY . .

RUN apt-get update && apt-get install -y \
    build-essential \
    wget \
    libpoppler-cpp-dev \
    && rm -rf /var/lib/apt/lists/*

# Install Python dependencies
RUN pip install --no-cache-dir \
    fastapi \
    uvicorn \
    python-multipart \
    PyMuPDF \
    langchain-google-genai \
    langchain-community \
    python-dotenv \
    spacy \
    scikit-learn \
    numpy \
    requests \
    python-docx

# Download spaCy English model
RUN python -m spacy download en_core_web_sm

# Expose FastAPI port
EXPOSE 8001

# Run FastAPI
CMD ["uvicorn", "document-loader:app", "--host", "0.0.0.0", "--port", "8001", "--reload"]