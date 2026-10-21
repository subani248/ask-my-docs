# Requirements Specification

**Ask My Docs — Production RAG Application**

---

# Project Overview

Ask My Docs is an enterprise-grade retrieval-augmented generation system that enables authenticated users to upload domain-specific documents and ask natural-language questions. The system provides verifiable citations for every document-grounded factual claim, maintains strict multi-tenant isolation, and supports configurable model providers and retrieval parameters.

---

# Problem Statement

Basic "chat with PDF" systems are insufficient for production because they:

1. **Lack authorization**: Any user can access any document
2. **No citation validation**: Systems hallucinate citations without verification
3. **No quality measurement**: No regression detection or evaluation framework
4. **Single-tenant only**: Cannot isolate data between organizations
5. **No access control**: No document-level permissions
6. **Fragile parsing**: Fail on complex document formats
7. **No retry handling**: Permanent failures on transient errors
8. **No observability**: Cannot debug retrieval or generation behavior
9. **Monolithic architecture**: Cannot scale components independently
10. **No CI quality gates**: Regressions ship to production undetected

---

# Goals

1. **Measurable RAG Quality**: Achieve configurable thresholds for retrieval recall, faithfulness, and citation accuracy
2. **Security-First Architecture**: Authorization enforced before retrieved context reaches the LLM
3. **Provider Abstraction**: Embedding, reranking, and LLM providers replaceable without business logic changes
4. **CI-Gated Quality**: Evaluation regressions block deployment
5. **Multi-Tenant Isolation**: Strict data separation at database and retrieval layers
6. **Citation Traceability**: Every factual claim traceable to retrieved document evidence
7. **Incremental Development**: Architecture supports phased implementation

---

# Non-Goals (Initial System)

1. Real-time document collaboration
2. Document versioning and diff tracking
3. Voice input or output
4. Multi-language support beyond English
5. Custom embedding model training
6. Fine-tuning of LLM providers
7. Advanced analytics dashboards
8. Mobile native applications
9. Third-party SSO integration (future phase)
10. Streaming response support (future phase)

---

# Users and Roles

## Roles

### User
- Upload documents to own tenant
- Query own documents
- View conversation history
- Manage own documents

### Admin
- All User permissions
- Manage users within tenant
- Configure tenant settings
- View tenant usage metrics
- Manage document permissions

### Tenant
- Organizational boundary
- Contains Users and Admins
- Isolated data storage
- Configurable retrieval parameters

---

# Functional Requirements

## Document Management

### Upload
- **FR-DM-01**: Users can upload documents via API
- **FR-DM-02**: Supported formats: PDF, DOCX, TXT, Markdown, HTML
- **FR-DM-03**: Maximum file size configurable (default: 50MB)
- **FR-DM-04**: Maximum documents per user configurable
- **FR-DM-05**: Upload returns document ID and initial status

### List
- **FR-DM-06**: Users can list own documents with pagination
- **FR-DM-07**: Response includes document metadata and processing status
- **FR-DM-08**: Filtering by status, filename, upload date

### View
- **FR-DM-09**: Users can view document metadata
- **FR-DM-10**: Users can view document processing status
- **FR-DM-11**: Users can view document chunks (Admin only)

### Delete
- **FR-DM-12**: Users can delete own documents
- **FR-DM-13**: Admins can delete any document in tenant
- **FR-DM-14**: Deletion removes vector embeddings and BM25 index
- **FR-DM-15**: Soft delete with configurable retention period

### Document Metadata
- **FR-DM-16**: filename, size, mime_type, upload_date, status, owner_id, tenant_id, chunk_count, processing_started_at, processing_completed_at, error_message

### Document Status
- **FR-DM-17**: Status values: UPLOADED, VALIDATING, PROCESSING, INDEXING, READY, FAILED
- **FR-DM-18**: Status transitions are auditable
- **FR-DM-19**: FAILED status includes error_message

### Duplicate Detection
- **FR-DM-20**: Detect duplicate uploads by content hash
- **FR-DM-21**: Duplicate detection is configurable (enable/disable)
- **FR-DM-22**: Duplicates return existing document reference

## Document Processing

### Parsing
- **FR-DP-01**: PDF parsing with PyMuPDF or equivalent
- **FR-DP-02**: DOCX parsing preserving structure
- **FR-DP-03**: Plain text parsing
- **FR-DP-04**: Markdown parsing with structure preservation
- **FR-DP-05**: HTML parsing with content extraction

### OCR Fallback
- **FR-DP-06**: OCR triggered when text extraction yields insufficient content
- **FR-DP-07**: OCR threshold configurable
- **FR-DP-08**: OCR provider configurable

### Cleaning
- **FR-DP-09**: Remove excessive whitespace
- **FR-DP-10**: Remove page headers/footers when detected
- **FR-DP-11**: Normalize encoding to UTF-8
- **FR-DP-12**: Preserve meaningful structure (headings, lists)

### Structure Detection
- **FR-DP-13**: Preserve title hierarchy
- **FR-DP-14**: Preserve section boundaries
- **FR-DP-15**: Preserve paragraph breaks
- **FR-DP-16**: Preserve list items
- **FR-DP-17**: Preserve page numbers

### Chunking
- **FR-DP-18**: Recursive text splitting with configurable parameters
- **FR-DP-19**: chunk_size configurable (default: 512 tokens)
- **FR-DP-20**: chunk_overlap configurable (default: 50 tokens)
- **FR-DP-21**: min_chunk_size configurable (default: 100 tokens)
- **FR-DP-22**: max_chunk_size configurable (default: 1024 tokens)
- **FR-DP-23**: Chunks preserve parent document context

### Metadata Extraction
- **FR-DP-24**: Extract document_id, chunk_id, tenant_id
- **FR-DP-25**: Extract filename, page_number, section
- **FR-DP-26**: Extract content_hash for deduplication
- **FR-DP-27**: Timestamps: created_at, updated_at

### Embedding
- **FR-DP-28**: Provider abstraction for embedding models
- **FR-DP-29**: Dimension compatibility validation
- **FR-DP-30**: Batch embedding with configurable batch size
- **FR-DP-31**: Re-embedding strategy for model changes

### Indexing
- **FR-DP-32**: Store chunks in PostgreSQL
- **FR-DP-33**: Store embeddings in vector database
- **FR-DP-34**: Index for BM25 retrieval
- **FR-DP-35**: Transactional indexing (all-or-nothing)

### Retry Handling
- **FR-DP-36**: Retryable errors: network, timeout, transient DB
- **FR-DP-37**: Retry with exponential backoff
- **FR-DP-38**: Maximum retry count configurable (default: 3)
- **FR-DP-39**: Permanent failures logged and reported

### Failure Handling
- **FR-DP-40**: Document marked FAILED with error message
- **FR-DP-41**: Partial processing can be resumed
- **FR-DP-42**: Failed documents don't affect other documents

## Retrieval

### Vector Search
- **FR-R-01**: Embed query using configured provider
- **FR-R-02**: Cosine similarity search
- **FR-R-03**: top-K configurable (default: 30)
- **FR-R-04**: Filter by tenant_id, user permissions
- **FR-R-05**: Return similarity scores

### BM25
- **FR-R-06**: BM25 indexing of document chunks
- **FR-R-07**: Tokenization configurable
- **FR-R-08**: top-K configurable (default: 30)
- **FR-R-09**: Filter by tenant_id, user permissions

### Hybrid Retrieval
- **FR-R-10**: Combine vector and BM25 results
- **FR-R-11**: Fusion method configurable (RRF recommended)
- **FR-R-12**: Fusion candidates configurable (default: 30-50)

### Metadata Filtering
- **FR-R-13**: Filter by document_id
- **FR-R-14**: Filter by tenant_id (mandatory)
- **FR-R-15**: Filter by user permissions

### Reranking
- **FR-R-16**: Cross-encoder reranking
- **FR-R-17**: reranker model configurable
- **FR-R-18**: final_K configurable (default: 5-10)
- **FR-R-19**: Reranker failure falls back to fusion ranking

### Context Construction
- **FR-R-20**: Order by reranker score
- **FR-R-21**: Respect token budget configurable (default: 4096 tokens)
- **FR-R-22**: Include citation metadata in context
- **FR-R-23**: Deduplicate near-identical chunks

## Question Answering

### Query Processing
- **FR-QA-01**: Normalize whitespace and encoding
- **FR-QA-02**: Query rewriting optional, configurable
- **FR-QA-03**: Metadata extraction from query

### Context Selection
- **FR-QA-04**: Use reranked results
- **FR-QA-05**: Apply token budget limits
- **FR-QA-06**: Include citation IDs in context

### Grounded Generation
- **FR-QA-07**: LLM generates answer from provided context
- **FR-QA-08**: System prompt enforces citation requirements
- **FR-QA-09**: Structured output with answer and citations

### No-Answer Behavior
- **FR-QA-10**: System refuses to answer when context insufficient
- **FR-QA-11**: Clear messaging for no-answer responses
- **FR-QA-12**: Configurable confidence threshold for no-answer

### Citation Generation
- **FR-QA-13**: Citations mandatory for factual claims
- **FR-QA-14**: Citations reference provided context IDs only
- **FR-QA-15**: Each citation includes: document_id, chunk_id, filename, page, section, snippet

### Citation Validation
- **FR-QA-16**: Validate citation IDs exist in context
- **FR-QA-17**: Validate citations belong to authorized documents
- **FR-QA-18**: Remove invalid citations from response
- **FR-QA-19**: Log citation validation failures

## Conversations

### Create
- **FR-C-01**: Create conversation with optional document filters
- **FR-C-02**: Conversation belongs to user and tenant

### List
- **FR-C-03**: List own conversations with pagination
- **FR-C-04**: Include message count and last message preview

### Retrieve
- **FR-C-05**: Retrieve conversation with full message history
- **FR-C-06**: Messages ordered chronologically

### Delete
- **FR-C-07**: Delete own conversations
- **FR-C-08**: Admins can delete any conversation in tenant

### Message History
- **FR-C-09**: Each message includes: role, content, citations, timestamp
- **FR-C-10**: Messages ordered by creation time

## Authentication

### Registration
- **FR-AUTH-01**: Email and password registration
- **FR-AUTH-02**: Password strength requirements enforced
- **FR-AUTH-03**: Email verification required (optional)

### Login
- **FR-AUTH-04**: Email and password authentication
- **FR-AUTH-05**: Returns JWT access token and refresh token
- **FR-AUTH-06**: Access token expiry configurable (default: 15 minutes)
- **FR-AUTH-07**: Refresh token expiry configurable (default: 7 days)

### Logout
- **FR-AUTH-08**: Invalidate refresh token
- **FR-AUTH-09**: Optional: invalidate all tokens for user

### Token Handling
- **FR-AUTH-10**: Access token in Authorization header
- **FR-AUTH-11**: Refresh token in HTTP-only cookie or request body
- **FR-AUTH-12**: Token validation on every protected endpoint

### Password Security
- **FR-AUTH-13**: Bcrypt hashing with configurable rounds
- **FR-AUTH-14**: Minimum password length configurable (default: 8)
- **FR-AUTH-15**: Password history optional

## Authorization

### RBAC
- **FR-AUTHZ-01**: Role assignment: User, Admin
- **FR-AUTHZ-02**: Role checks on every endpoint
- **FR-AUTHZ-03**: Admin can manage users within tenant

### Document Permissions
- **FR-AUTHZ-04**: Document owner has full access
- **FR-AUTHZ-05**: Admin can grant/revoke document access
- **FR-AUTHZ-06**: Permissions checked before retrieval

### Ownership
- **FR-AUTHZ-07**: Documents belong to user and tenant
- **FR-AUTHZ-08**: Conversations belong to user and tenant

### Tenant Isolation
- **FR-AUTHZ-09**: All queries scoped to tenant_id
- **FR-AUTHZ-10**: Cross-tenant access impossible
- **FR-AUTHZ-11**: Tenant_id enforced at database level

---

# RAG Requirements

## Embeddings
- Provider abstraction supporting multiple models
- Dimension validation on ingestion and query
- Batch processing with configurable batch size
- Re-embedding when model version changes

## Vector Database
- Support for cosine similarity search
- Metadata filtering (tenant_id, document_id, user_id)
- Pagination support
- Collection/index per tenant or shared with filtering (configurable)

## BM25
- Configurable tokenization (stemming, stop words)
- Index per tenant or shared with filtering
- Score normalization

## Hybrid Fusion
- Reciprocal Rank Fusion recommended as default
- Weighted fusion configurable alternative
- Fusion parameters tunable

## Reranking
- Cross-encoder models for precision
- Model abstraction layer
- Fallback to fusion ranking on failure

## Context Compression
- Optional summarization of long contexts
- Configurable compression strategy

## Deduplication
- Detect near-identical chunks across documents
- Configurable similarity threshold for deduplication

## Query Rewriting
- Optional query expansion
- Optional query decomposition for multi-hop questions
- Configurable enable/disable

## Metadata Filtering
- Mandatory tenant_id filter
- Optional document_id filter
- Optional user permission filter

---

# Citation Requirements

1. **Mandatory Citations**: Every document-grounded factual claim must include citation
2. **No Hallucinated Citations**: System must not invent citation IDs, filenames, pages, or URLs
3. **Citation Validation**: All citations validated against retrieved context before response
4. **Authorization Check**: Citations must reference authorized documents only
5. **Structured Output**: LLM must return JSON with answer and citations array
6. **Citation Metadata**: Each citation includes: citation_id, document_id, chunk_id, filename, page, section, snippet
7. **Invalid Citation Handling**: Invalid citations removed, user notified
8. **Citation IDs**: Deterministic, sequential within response

---

# Evaluation Requirements

## Retrieval Metrics
- **Recall@K**: Proportion of relevant chunks retrieved in top-K
- **Precision@K**: Proportion of retrieved chunks that are relevant
- **MRR**: Mean Reciprocal Rank of first relevant result
- **NDCG**: Normalized Discounted Cumulative Gain

## Generation Metrics
- **Faithfulness**: Answer grounded in provided context
- **Answer Relevance**: Answer addresses the question
- **Context Relevance**: Retrieved context is relevant to question
- **Citation Correctness**: Citations accurately reference source
- **Citation Completeness**: All factual claims have citations

## System Metrics
- **P50/P95/P99 Latency**: Response time percentiles
- **Token Usage**: Input and output tokens per query
- **Cost/Query**: Estimated cost per query
- **Error Rate**: Failed requests percentage

---

# CI Quality Requirements

## Configurable Thresholds
```yaml
retrieval:
  recall_at_10: 0.7  # Configurable
  precision_at_10: 0.5  # Configurable
generation:
  faithfulness: 0.8  # Configurable
  answer_relevance: 0.7  # Configurable
citations:
  correctness: 0.9  # Configurable
  completeness: 0.8  # Configurable
system:
  p95_latency_ms: 5000  # Configurable
  error_rate: 0.01  # Configurable
```

## Regression Detection
- Compare evaluation results against baseline
- Block deployment if any metric drops below threshold
- Generate detailed regression report

---

# Non-Functional Requirements

## Performance
- **NFR-01**: Query response time P95 < configurable threshold (default: 5000ms)
- **NFR-02**: Document upload acknowledgment < 1 second
- **NFR-03**: Concurrent users per tenant configurable

## Scalability
- **NFR-04**: Horizontal scaling for API and workers
- **NFR-05**: Vertical scaling for database
- **NFR-06**: Vector database scaling strategy defined

## Reliability
- **NFR-07**: 99.9% uptime target (configurable)
- **NFR-08**: Graceful degradation on component failure
- **NFR-09**: No data loss on worker failure

## Availability
- **NFR-10**: Health checks for all services
- **NFR-11**: Dependency health validation
- **NFR-12**: Graceful shutdown support

## Security
- **NFR-13**: HTTPS enforced in production
- **NFR-14**: Secrets never in source code
- **NFR-15**: Input validation on all endpoints
- **NFR-16**: Rate limiting on all endpoints

## Maintainability
- **NFR-17**: Type hints throughout codebase
- **NFR-18**: Automated linting and formatting
- **NFR-19**: Test coverage > 80% (configurable)

## Observability
- **NFR-20**: Structured logging
- **NFR-21**: Distributed tracing
- **NFR-22**: Custom metrics for RAG pipeline
- **NFR-23**: Retrieval score inspection

## Cost Efficiency
- **NFR-24**: Token usage monitoring and limits
- **NFR-25**: Embedding cost tracking
- **NFR-26**: Storage usage monitoring

---

# Production Requirements

## Docker
- Multi-stage builds for optimization
- Non-root container execution
- Health checks configured
- Environment-based configuration

## Environment Configuration
- All configuration via environment variables
- No hardcoded secrets
- Configurable model parameters
- Configurable retrieval parameters

## Logging
- Structured JSON logging
- Log levels configurable
- No sensitive data in logs
- Request correlation IDs

## Metrics
- Request count and latency
- Retrieval scores distribution
- Reranker scores distribution
- Token usage
- Error rates
- Queue depths

## Tracing
- Request tracing across services
- Retrieval pipeline stages
- LLM call duration
- Citation validation timing

## Rate Limiting
- Per-user rate limits configurable
- Per-tenant rate limits configurable
- API key rate limits optional

## Health Checks
- Liveness probe: service is running
- Readiness probe: service can handle requests
- Dependency checks: database, vector DB, cache

## Background Workers
- Ingestion workers with concurrency control
- Retry handling with exponential backoff
- Dead letter queue for permanent failures
- Worker health monitoring

## Graceful Failure
- Partial ingestion doesn't block other documents
- Reranker failure falls back to fusion ranking
- LLM failure returns error without data loss
- Citation validation failure logged and reported

## Database Migrations
- Alembic or equivalent for schema management
- Backward-compatible migrations
- Migration testing in CI

---

# Acceptance Criteria

## Document Management
- [ ] Users can upload supported document formats
- [ ] Documents processed asynchronously
- [ ] Status tracking visible to users
- [ ] Duplicate detection works
- [ ] Deletion removes all associated data

## Document Processing
- [ ] All supported formats parsed correctly
- [ ] OCR fallback triggered appropriately
- [ ] Chunks created with proper metadata
- [ ] Embeddings generated successfully
- [ ] BM25 index updated
- [ ] Retry handling works for transient failures

## Retrieval
- [ ] Vector search returns relevant results
- [ ] BM25 returns relevant results
- [ ] Hybrid fusion improves over individual methods
- [ ] Reranking improves precision
- [ ] Tenant isolation enforced
- [ ] Document permissions enforced

## Question Answering
- [ ] Answers grounded in provided context
- [ ] Citations mandatory for factual claims
- [ ] No hallucinated citations
- [ ] No-answer behavior works correctly
- [ ] Citation validation catches invalid citations

## Authentication
- [ ] Registration creates user account
- [ ] Login returns valid tokens
- [ ] Token refresh works
- [ ] Logout invalidates tokens
- [ ] Password security enforced

## Authorization
- [ ] RBAC enforced on all endpoints
- [ ] Document permissions checked before retrieval
- [ ] Tenant isolation complete
- [ ] Cross-tenant access impossible

## Evaluation
- [ ] Golden dataset loads successfully
- [ ] Retrieval metrics calculated correctly
- [ ] Generation metrics calculated correctly
- [ ] CI quality gates block on regression
- [ ] Evaluation reports generated

## Production
- [ ] Docker containers build successfully
- [ ] Health checks pass
- [ ] Graceful shutdown works
- [ ] Logging structured and complete
- [ ] Metrics exported
- [ ] Database migrations apply cleanly

---

# Definition of Done

The project is production-ready when:

1. **All functional requirements implemented and tested**
2. **All non-functional requirements met**
3. **All acceptance criteria passing**
4. **Evaluation framework operational with golden dataset**
5. **CI quality gates blocking regressions**
6. **Security testing completed**
7. **Docker deployment working**
8. **Monitoring and alerting configured**
9. **Documentation complete and accurate**
10. **No critical or high-severity bugs open**

---

*This document is the source of truth for requirements. All other documents must be consistent with this specification.*
