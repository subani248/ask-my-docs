# Ask My Docs

Production RAG application for document-based question answering with citations.

## Prerequisites

- Python 3.11+
- Node.js 18+

*(Note: The database is configured to use Cloud providers (MongoDB Atlas and Qdrant Cloud) in your `.env` file, so no local database installation is required!)*

## Quick Start

### 1. Backend

Open a terminal and run:

```bash
cd backend
python -m venv .venv
# Activate the virtual environment:
# Windows:
.venv\Scripts\activate
# Mac/Linux:
# source .venv/bin/activate

pip install -e ".[dev]"
# Note: Your .env file is already configured with Cloud database credentials!
uvicorn app.main:app --reload
```

### 2. Frontend

Open a **new** terminal and run:

```bash
cd frontend
npm install
npm run dev
```

## Development

- Backend: http://localhost:8000
- Frontend: http://localhost:5173
- API Docs: http://localhost:8000/docs

## Testing

```bash
# Backend
cd backend
pytest

# Frontend
cd frontend
npm run build
```
