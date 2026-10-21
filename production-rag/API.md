# API Specification

**Ask My Docs — REST API**

---

# API Principles

1. **RESTful**: Resource-oriented design with standard HTTP methods
2. **JSON**: All request/response bodies in JSON format
3. **Versioned**: API version in URL path (e.g., `/api/v1/`)
4. **Authenticated**: JWT-based authentication on protected endpoints
5. **Authorized**: Role-based access control enforced
6. **Paginated**: List endpoints support pagination
7. **Error Consistent**: Standard error response format
8. **Idempotent**: POST/PUT operations idempotent where possible

---

# Base URL

```
https://api.askmydocs.example.com/api/v1
```

---

# Authentication

## POST /auth/register

**Purpose:** Register a new user account.

**Method:** `POST`

**Path:** `/auth/register`

**Auth:** None

**Request:**
```json
{
  "email": "user@example.com",
  "password": "securepassword123",
  "tenant_name": "Acme Corp"
}
```

**Response (201):**
```json
{
  "user_id": "usr_abc123",
  "email": "user@example.com",
  "tenant_id": "tnt_xyz789",
  "role": "user",
  "created_at": "2025-01-15T10:30:00Z"
}
```

**Errors:**
- 400: Invalid request (missing fields, invalid email)
- 409: Email already exists
- 422: Validation error (password too short, etc.)

**Permissions:** Public endpoint

---

## POST /auth/login

**Purpose:** Authenticate user and receive tokens.

**Method:** `POST`

**Path:** `/auth/login`

**Auth:** None

**Request:**
```json
{
  "email": "user@example.com",
  "password": "securepassword123"
}
```

**Response (200):**
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIs...",
  "refresh_token": "eyJhbGciOiJIUzI1NiIs...",
  "token_type": "bearer",
  "expires_in": 900,
  "user": {
    "user_id": "usr_abc123",
    "email": "user@example.com",
    "tenant_id": "tnt_xyz789",
    "role": "user"
  }
}
```

**Errors:**
- 400: Missing email or password
- 401: Invalid credentials
- 422: Validation error

**Permissions:** Public endpoint

---

## POST /auth/refresh

**Purpose:** Refresh access token using refresh token.

**Method:** `POST`

**Path:** `/auth/refresh`

**Auth:** Refresh token

**Request:**
```json
{
  "refresh_token": "eyJhbGciOiJIUzI1NiIs..."
}
```

**Response (200):**
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIs...",
  "token_type": "bearer",
  "expires_in": 900
}
```

**Errors:**
- 401: Invalid or expired refresh token
- 422: Validation error

**Permissions:** Valid refresh token required

---

## POST /auth/logout

**Purpose:** Invalidate refresh token.

**Method:** `POST`

**Path:** `/auth/logout`

**Auth:** Access token

**Request:**
```json
{
  "refresh_token": "eyJhbGciOiJIUzI1NiIs..."
}
```

**Response (200):**
```json
{
  "message": "Logged out successfully"
}
```

**Errors:**
- 401: Invalid access token
- 422: Validation error

**Permissions:** Authenticated user

---

# Documents

## POST /documents

**Purpose:** Upload a new document for processing.

**Method:** `POST`

**Path:** `/documents`

**Auth:** Access token

**Request:** `multipart/form-data`

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| file | file | Yes | Document file |
| title | string | No | Optional title override |

**Response (201):**
```json
{
  "document_id": "doc_abc123",
  "filename": "Employee Handbook.pdf",
  "mime_type": "application/pdf",
  "size_bytes": 1048576,
  "status": "UPLOADED",
  "created_at": "2025-01-15T10:30:00Z"
}
```

**Errors:**
- 400: Invalid file (wrong type, too large)
- 401: Unauthorized
- 409: Duplicate document (if enabled)
- 413: File too large
- 422: Validation error

**Permissions:** Authenticated user

---

## GET /documents

**Purpose:** List documents for the authenticated user.

**Method:** `GET`

**Path:** `/documents`

**Auth:** Access token

**Query Parameters:**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| page | integer | 1 | Page number |
| page_size | integer | 20 | Items per page |
| status | string | null | Filter by status |
| sort_by | string | created_at | Sort field |
| sort_order | string | desc | Sort order (asc/desc) |

**Response (200):**
```json
{
  "documents": [
    {
      "document_id": "doc_abc123",
      "filename": "Employee Handbook.pdf",
      "mime_type": "application/pdf",
      "size_bytes": 1048576,
      "status": "READY",
      "chunk_count": 150,
      "owner_id": "usr_abc123",
      "created_at": "2025-01-15T10:30:00Z",
      "updated_at": "2025-01-15T10:35:00Z"
    }
  ],
  "pagination": {
    "page": 1,
    "page_size": 20,
    "total_items": 1,
    "total_pages": 1
  }
}
```

**Errors:**
- 401: Unauthorized
- 422: Validation error (invalid query parameters)

**Permissions:** Authenticated user (sees own documents)

---

## GET /documents/{id}

**Purpose:** Get document details.

**Method:** `GET`

**Path:** `/documents/{id}`

**Auth:** Access token

**Path Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| id | string | Document ID |

**Response (200):**
```json
{
  "document_id": "doc_abc123",
  "filename": "Employee Handbook.pdf",
  "mime_type": "application/pdf",
  "size_bytes": 1048576,
  "status": "READY",
  "chunk_count": 150,
  "owner_id": "usr_abc123",
  "tenant_id": "tnt_xyz789",
  "metadata": {
    "title": "Employee Handbook 2025",
    "author": "HR Department",
    "page_count": 50
  },
  "created_at": "2025-01-15T10:30:00Z",
  "updated_at": "2025-01-15T10:35:00Z"
}
```

**Errors:**
- 401: Unauthorized
- 403: Forbidden (not owner or admin)
- 404: Document not found

**Permissions:** Document owner or admin

---

## DELETE /documents/{id}

**Purpose:** Delete a document and all associated data.

**Method:** `DELETE`

**Path:** `/documents/{id}`

**Auth:** Access token

**Path Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| id | string | Document ID |

**Response (200):**
```json
{
  "message": "Document deleted successfully"
}
```

**Errors:**
- 401: Unauthorized
- 403: Forbidden (not owner or admin)
- 404: Document not found

**Permissions:** Document owner or admin

---

# Query

## POST /query

**Purpose:** Ask a question about documents.

**Method:** `POST`

**Path:** `/query`

**Auth:** Access token

**Request:**
```json
{
  "question": "What is the annual leave policy?",
  "conversation_id": "conv_abc123",
  "document_filters": ["doc_abc123", "doc_def456"],
  "options": {
    "max_tokens": 1024,
    "temperature": 0.1,
    "include_citations": true
  }
}
```

**Request Fields:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| question | string | Yes | User question |
| conversation_id | string | No | Existing conversation ID |
| document_filters | array[string] | No | Filter to specific documents |
| options | object | No | Generation options |

**Options Fields:**

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| max_tokens | integer | 1024 | Max response tokens |
| temperature | float | 0.1 | Generation temperature |
| include_citations | boolean | true | Include citations in response |

**Response (200):**
```json
{
  "answer": "Employees receive 24 days of annual leave per calendar year.[1]",
  "citations": [
    {
      "citation_id": 1,
      "document_id": "doc_abc123",
      "chunk_id": "chunk_xyz789",
      "filename": "Employee Handbook.pdf",
      "page": 42,
      "section": "Leave Policy",
      "snippet": "Annual leave entitlement is 24 days per calendar year..."
    }
  ],
  "conversation_id": "conv_abc123",
  "message_id": "msg_abc123",
  "metadata": {
    "retrieval_scores": {
      "vector_max": 0.85,
      "bm25_max": 12.5,
      "fusion_max": 0.92,
      "reranker_max": 0.88
    },
    "token_usage": {
      "prompt_tokens": 1500,
      "completion_tokens": 150,
      "total_tokens": 1650
    },
    "latency_ms": 2500
  }
}
```

**Errors:**
- 400: Invalid request (missing question)
- 401: Unauthorized
- 403: Forbidden (no access to documents)
- 404: Conversation not found (if conversation_id provided)
- 422: Validation error
- 429: Rate limit exceeded
- 500: Internal error

**Permissions:** Authenticated user

---

# Conversations

## POST /conversations

**Purpose:** Create a new conversation.

**Method:** `POST`

**Path:** `/conversations`

**Auth:** Access token

**Request:**
```json
{
  "title": "HR Policy Questions",
  "document_filters": ["doc_abc123"]
}
```

**Response (201):**
```json
{
  "conversation_id": "conv_abc123",
  "title": "HR Policy Questions",
  "document_filters": ["doc_abc123"],
  "message_count": 0,
  "created_at": "2025-01-15T10:30:00Z"
}
```

**Errors:**
- 401: Unauthorized
- 422: Validation error

**Permissions:** Authenticated user

---

## GET /conversations

**Purpose:** List conversations for the authenticated user.

**Method:** `GET`

**Path:** `/conversations`

**Auth:** Access token

**Query Parameters:**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| page | integer | 1 | Page number |
| page_size | integer | 20 | Items per page |
| sort_by | string | updated_at | Sort field |
| sort_order | string | desc | Sort order |

**Response (200):**
```json
{
  "conversations": [
    {
      "conversation_id": "conv_abc123",
      "title": "HR Policy Questions",
      "message_count": 5,
      "last_message": "What is the annual leave policy?",
      "created_at": "2025-01-15T10:30:00Z",
      "updated_at": "2025-01-15T11:00:00Z"
    }
  ],
  "pagination": {
    "page": 1,
    "page_size": 20,
    "total_items": 1,
    "total_pages": 1
  }
}
```

**Errors:**
- 401: Unauthorized
- 422: Validation error

**Permissions:** Authenticated user (sees own conversations)

---

## GET /conversations/{id}

**Purpose:** Get conversation with message history.

**Method:** `GET`

**Path:** `/conversations/{id}`

**Auth:** Access token

**Path Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| id | string | Conversation ID |

**Response (200):**
```json
{
  "conversation_id": "conv_abc123",
  "title": "HR Policy Questions",
  "document_filters": ["doc_abc123"],
  "messages": [
    {
      "message_id": "msg_abc123",
      "role": "user",
      "content": "What is the annual leave policy?",
      "created_at": "2025-01-15T10:30:00Z"
    },
    {
      "message_id": "msg_def456",
      "role": "assistant",
      "content": "Employees receive 24 days of annual leave per calendar year.[1]",
      "citations": [
        {
          "citation_id": 1,
          "document_id": "doc_abc123",
          "chunk_id": "chunk_xyz789",
          "filename": "Employee Handbook.pdf",
          "page": 42,
          "section": "Leave Policy",
          "snippet": "Annual leave entitlement is 24 days..."
        }
      ],
      "created_at": "2025-01-15T10:30:05Z"
    }
  ],
  "created_at": "2025-01-15T10:30:00Z",
  "updated_at": "2025-01-15T10:30:05Z"
}
```

**Errors:**
- 401: Unauthorized
- 403: Forbidden (not conversation owner)
- 404: Conversation not found

**Permissions:** Conversation owner

---

## DELETE /conversations/{id}

**Purpose:** Delete a conversation and all messages.

**Method:** `DELETE`

**Path:** `/conversations/{id}`

**Auth:** Access token

**Path Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| id | string | Conversation ID |

**Response (200):**
```json
{
  "message": "Conversation deleted successfully"
}
```

**Errors:**
- 401: Unauthorized
- 403: Forbidden (not conversation owner or admin)
- 404: Conversation not found

**Permissions:** Conversation owner or admin

---

# Citation Schema

```json
{
  "citation_id": 1,
  "document_id": "doc_abc123",
  "chunk_id": "chunk_xyz789",
  "filename": "Employee Handbook.pdf",
  "page": 42,
  "section": "Leave Policy",
  "snippet": "Annual leave entitlement is 24 days per calendar year..."
}
```

**Fields:**

| Field | Type | Description |
|-------|------|-------------|
| citation_id | integer | Sequential ID within response |
| document_id | string | Source document ID |
| chunk_id | string | Source chunk ID |
| filename | string | Human-readable filename |
| page | integer | Page number (nullable) |
| section | string | Section title (nullable) |
| snippet | string | Relevant text excerpt |

---

# Error Handling

## Standard Error Response

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid request parameters",
    "details": [
      {
        "field": "email",
        "message": "Invalid email format"
      }
    ],
    "request_id": "req_abc123"
  }
}
```

## Error Codes

| HTTP Status | Code | Description |
|-------------|------|-------------|
| 400 | BAD_REQUEST | Invalid request syntax |
| 401 | UNAUTHORIZED | Authentication required or invalid |
| 403 | FORBIDDEN | Insufficient permissions |
| 404 | NOT_FOUND | Resource not found |
| 409 | CONFLICT | Resource already exists |
| 422 | VALIDATION_ERROR | Request validation failed |
| 429 | RATE_LIMITED | Too many requests |
| 500 | INTERNAL_ERROR | Server error |
| 503 | SERVICE_UNAVAILABLE | Service temporarily unavailable |

## Error Details

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid request parameters",
    "details": [
      {
        "field": "email",
        "message": "Invalid email format",
        "value": "not-an-email"
      }
    ]
  }
}
```

---

# Authorization

## Endpoint Permissions

| Endpoint | User | Admin | Public |
|----------|------|-------|--------|
| POST /auth/register | - | - | ✓ |
| POST /auth/login | - | - | ✓ |
| POST /auth/refresh | ✓ | ✓ | - |
| POST /auth/logout | ✓ | ✓ | - |
| POST /documents | ✓ | ✓ | - |
| GET /documents | ✓ | ✓ | - |
| GET /documents/{id} | ✓* | ✓ | - |
| DELETE /documents/{id} | ✓* | ✓ | - |
| POST /query | ✓ | ✓ | - |
| POST /conversations | ✓ | ✓ | - |
| GET /conversations | ✓ | ✓ | - |
| GET /conversations/{id} | ✓* | ✓ | - |
| DELETE /conversations/{id} | ✓* | ✓ | - |
| GET /health | - | - | ✓ |
| GET /ready | - | - | ✓ |

✓* = Owner or admin

---

# Rate Limiting

## Configuration

- `rate_limit_per_user`: 100 requests per minute (default, configurable)
- `rate_limit_per_tenant`: 1000 requests per minute (default, configurable)
- `rate_limit_query`: 10 requests per minute (default, configurable)

## Headers

```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1642252800
```

## Rate Limit Exceeded

```json
{
  "error": {
    "code": "RATE_LIMITED",
    "message": "Rate limit exceeded",
    "retry_after": 30
  }
}
```

---

# Security

## Validation

- All request bodies validated against schemas
- File uploads validated (MIME, size, extension)
- Query parameters validated

## Request Limits

- `max_request_size`: 10MB (default, configurable)
- `max_file_size`: 50MB (default, configurable)
- `max_query_length`: 1000 characters (default, configurable)

## File Limits

- `allowed_mime_types`: ["application/pdf", "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "text/plain", "text/markdown", "text/html"]
- `max_files_per_user`: 100 (default, configurable)

## Authorization

- JWT validated on every protected endpoint
- Permissions checked before resource access
- Tenant isolation enforced

## Tenant Isolation

- All queries scoped to tenant_id
- Cross-tenant access impossible
- Document access checked before retrieval

---

# Health Checks

## GET /health

**Purpose:** Liveness probe - is the service running?

**Method:** `GET`

**Path:** `/health`

**Auth:** None

**Response (200):**
```json
{
  "status": "healthy",
  "timestamp": "2025-01-15T10:30:00Z"
}
```

**Response (503):**
```json
{
  "status": "unhealthy",
  "timestamp": "2025-01-15T10:30:00Z",
  "checks": {
    "database": "unhealthy",
    "redis": "healthy"
  }
}
```

---

## GET /ready

**Purpose:** Readiness probe - can the service handle requests?

**Method:** `GET`

**Path:** `/ready`

**Auth:** None

**Response (200):**
```json
{
  "status": "ready",
  "timestamp": "2025-01-15T10:30:00Z",
  "checks": {
    "database": "healthy",
    "redis": "healthy",
    "vector_db": "healthy",
    "workers": "healthy"
  }
}
```

**Response (503):**
```json
{
  "status": "not_ready",
  "timestamp": "2025-01-15T10:30:00Z",
  "checks": {
    "database": "healthy",
    "redis": "unhealthy",
    "vector_db": "healthy",
    "workers": "healthy"
  }
}
```

---

# OpenAPI

## Documentation Endpoints

- Swagger UI: `/docs`
- ReDoc: `/redoc`
- OpenAPI JSON: `/openapi.json`

## Schema Generation

- Auto-generated from Pydantic models
- Request/response schemas documented
- Authentication requirements documented

---

# Acceptance Tests

## Authentication

- [ ] Registration creates user
- [ ] Login returns valid tokens
- [ ] Refresh token works
- [ ] Logout invalidates tokens
- [ ] Invalid credentials rejected

## Documents

- [ ] Upload accepts valid files
- [ ] Upload rejects invalid files
- [ ] List returns user's documents
- [ ] Get returns document details
- [ ] Delete removes document
- [ ] Permissions enforced

## Query

- [ ] Query returns answer with citations
- [ ] Query respects document filters
- [ ] Query handles no-answer case
- [ ] Rate limiting works

## Conversations

- [ ] Create conversation works
- [ ] List returns user's conversations
- [ ] Get returns message history
- [ ] Delete removes conversation

## Error Handling

- [ ] Invalid requests return 400
- [ ] Unauthorized requests return 401
- [ ] Forbidden requests return 403
- [ ] Not found returns 404
- [ ] Validation errors return 422

## Health

- [ ] Health check returns status
- [ ] Readiness check returns dependencies

---

*This document is consistent with ARCHITECTURE.md, SECURITY.md, and docs/citations.md.*
