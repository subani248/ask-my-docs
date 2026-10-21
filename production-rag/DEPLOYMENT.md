# Deployment Specification

**Ask My Docs — Production Deployment**

---

# Deployment Goals

1. **Reliability**: 99.9% uptime target (configurable)
2. **Scalability**: Horizontal scaling for application layer
3. **Security**: Defense in depth, least privilege
4. **Observability**: Full visibility into system behavior
5. **Maintainability**: Easy updates and rollbacks
6. **Cost Efficiency**: Optimize resource usage

---

# Environments

## Development

**Purpose**: Local development and testing

**Infrastructure**:
- Docker Compose
- Single PostgreSQL instance
- Embedded Redis
- pgvector for vector storage
- Local LLM (optional)

**Configuration**:
```yaml
environment: development
debug: true
log_level: DEBUG
database:
  host: localhost
  port: 5432
redis:
  host: localhost
  port: 6379
```

## Testing

**Purpose**: Automated testing and CI

**Infrastructure**:
- Docker Compose
- Isolated databases
- Test-specific configuration
- Mock external services (optional)

**Configuration**:
```yaml
environment: testing
debug: false
log_level: INFO
database:
  name: askmydocs_test
```

## Staging

**Purpose**: Pre-production validation

**Infrastructure**:
- Docker Compose or Kubernetes
- Production-like configuration
- Real external services
- Limited data

**Configuration**:
```yaml
environment: staging
debug: false
log_level: INFO
database:
  host: staging-db.example.com
```

## Production

**Purpose**: Live service

**Infrastructure**:
- Kubernetes or Docker Swarm
- High availability
- Full monitoring
- Backup and recovery

**Configuration**:
```yaml
environment: production
debug: false
log_level: WARNING
database:
  host: prod-db.example.com
  replicas: 2
```

---

# Container Architecture

## Services

```mermaid
graph TB
    subgraph Frontend["Frontend"]
        React[React App]
    end

    subgraph Edge["Edge"]
        Nginx[Nginx Reverse Proxy]
    end

    subgraph Application["Application"]
        API1[API Server 1]
        API2[API Server 2]
        Worker1[Ingestion Worker 1]
        Worker2[Ingestion Worker 2]
    end

    subgraph Data["Data"]
        PG[(PostgreSQL)]
        Redis[(Redis)]
        Qdrant[(Qdrant)]
    end

    subgraph External["External"]
        LLM[LLM API]
        Embed[Embedding API]
    end

    React --> Nginx
    Nginx --> API1
    Nginx --> API2
    API1 --> PG
    API1 --> Redis
    API1 --> Qdrant
    API1 --> LLM
    API1 --> Embed
    API2 --> PG
    API2 --> Redis
    API2 --> Qdrant
    Worker1 --> PG
    Worker1 --> Redis
    Worker1 --> Qdrant
    Worker1 --> Embed
    Worker2 --> PG
    Worker2 --> Redis
    Worker2 --> Qdrant
    Worker2 --> Embed
```

## Service Specifications

### Frontend (React)
- **Port**: 80/443 (via Nginx)
- **Resources**: 128MB RAM, 0.1 CPU
- **Health Check**: GET /

### Nginx
- **Port**: 443 (HTTPS), 80 (HTTP redirect)
- **Resources**: 64MB RAM, 0.1 CPU
- **Health Check**: GET /health

### API Server
- **Port**: 8000
- **Resources**: 512MB RAM, 0.5 CPU (configurable)
- **Health Check**: GET /health
- **Readiness Check**: GET /ready
- **Replicas**: 2+ (configurable)

### Ingestion Worker
- **Resources**: 1GB RAM, 1 CPU (configurable)
- **Concurrency**: 4 (configurable)
- **Replicas**: 2+ (configurable)

### PostgreSQL
- **Port**: 5432
- **Resources**: 2GB RAM, 1 CPU (configurable)
- **Storage**: 50GB (configurable)
- **Replicas**: 1+ (read replicas for scaling)

### Redis
- **Port**: 6379
- **Resources**: 256MB RAM
- **Persistence**: AOF + RDB

### Qdrant
- **Port**: 6333
- **Resources**: 2GB RAM, 1 CPU (configurable)
- **Storage**: 50GB (configurable)

---

# Docker Strategy

## Multi-Stage Builds

### API Dockerfile
```dockerfile
# Stage 1: Build
FROM python:3.11-slim as builder
WORKDIR /app
COPY requirements.txt .
RUN pip install --user -r requirements.txt

# Stage 2: Runtime
FROM python:3.11-slim
WORKDIR /app
COPY --from=builder /root/.local /root/.local
COPY . .
ENV PATH=/root/.local/bin:$PATH
EXPOSE 8000
CMD ["uvicorn", "src.api.main:app", "--host", "0.0.0.0", "--port", "8000"]
```

### Worker Dockerfile
```dockerfile
FROM python:3.11-slim as builder
WORKDIR /app
COPY requirements.txt .
RUN pip install --user -r requirements.txt

FROM python:3.11-slim
WORKDIR /app
COPY --from=builder /root/.local /root/.local
COPY . .
ENV PATH=/root/.local/bin:$PATH
CMD ["celery", "-A", "workers.celery_app", "worker", "--loglevel=info"]
```

## Non-Root Containers

```dockerfile
RUN addgroup --system app && adduser --system --ingroup app app
USER app
```

## Health Checks

```dockerfile
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:8000/health || exit 1
```

## Environment Variables

```dockerfile
ENV PYTHONUNBUFFERED=1
ENV PYTHONDONTWRITEBYTECODE=1
```

## Image Security

- Use slim base images
- Scan for vulnerabilities
- No unnecessary packages
- Regular base image updates

---

# Configuration

## Environment Variable Categories

### Database
```yaml
DATABASE_URL: "postgresql://user:pass@host:5432/dbname"
DATABASE_POOL_SIZE: 20
DATABASE_MAX_OVERFLOW: 10
DATABASE_POOL_TIMEOUT: 30
```

### Redis
```yaml
REDIS_URL: "redis://host:6379/0"
REDIS_PASSWORD: "secret"
```

### Vector Database
```yaml
VECTOR_DB_TYPE: "pgvector"  # or "qdrant"
QDRANT_URL: "http://qdrant:6333"
QDRANT_API_KEY: "secret"
```

### Authentication
```yaml
JWT_SECRET: "secret"
JWT_ALGORITHM: "HS256"
JWT_ACCESS_TOKEN_EXPIRE_MINUTES: 15
JWT_REFRESH_TOKEN_EXPIRE_DAYS: 7
```

### Embedding
```yaml
EMBEDDING_PROVIDER: "openai"
EMBEDDING_MODEL: "text-embedding-ada-002"
EMBEDDING_DIMENSION: 1536
EMBEDDING_BATCH_SIZE: 100
```

### LLM
```yaml
LLM_PROVIDER: "openai"
LLM_MODEL: "gpt-4"
LLM_MAX_TOKENS: 1024
LLM_TEMPERATURE: 0.1
```

### Reranker
```yaml
RERANKER_PROVIDER: "sentence-transformers"
RERANKER_MODEL: "cross-encoder/ms-marco-MiniLM-L-6-v2"
```

### Retrieval
```yaml
VECTOR_TOP_K: 30
BM25_TOP_K: 30
FUSION_METHOD: "rrf"
RRF_K: 60
RERANKER_TOP_K: 5
CONTEXT_TOKEN_BUDGET: 4096
```

### Rate Limiting
```yaml
RATE_LIMIT_PER_USER: 100
RATE_LIMIT_PER_TENANT: 1000
RATE_LIMIT_QUERY: 10
```

### File Limits
```yaml
MAX_FILE_SIZE: 52428800  # 50MB
MAX_FILES_PER_USER: 100
ALLOWED_MIME_TYPES: "application/pdf,text/plain,text/markdown"
```

### Workers
```yaml
CELERY_CONCURRENCY: 4
CELERY_RETRY_MAX: 3
CELERY_RETRY_BACKOFF: 1
```

### Observability
```yaml
LOG_LEVEL: "INFO"
OTEL_EXPORTER_OTLP_ENDPOINT: "http://otel:4317"
LANGFUSE_SECRET_KEY: "secret"
LANGFUSE_PUBLIC_KEY: "public"
```

---

# CI/CD

## Pipeline

```mermaid
graph LR
    A[Pull Request] --> B[Lint]
    B --> C[Unit Tests]
    C --> D[Integration Tests]
    D --> E[RAG Evaluation]
    E --> F[Security Scan]
    F --> G[Build Docker Image]
    G --> H[Push to Registry]
    H --> I[Deploy to Staging]
    I --> J[Smoke Tests]
    J --> K[Deploy to Production]
```

## Workflow Steps

### 1. Lint
- Python linting (ruff, black)
- TypeScript linting (eslint)
- Markdown linting

### 2. Unit Tests
- pytest for Python
- jest for TypeScript
- Coverage reporting

### 3. Integration Tests
- Database tests
- API tests
- Worker tests

### 4. RAG Evaluation
- Run evaluation suite
- Compare against baseline
- Quality gate check

### 5. Security Scan
- Dependency scanning
- Container scanning
- Secret detection

### 6. Build
- Multi-stage Docker build
- Image tagging
- Push to registry

### 7. Deploy to Staging
- Deploy to staging environment
- Run smoke tests
- Validate functionality

### 8. Deploy to Production
- Deploy to production
- Monitor for issues
- Rollback if needed

## Quality Gate

```yaml
quality_gates:
  evaluation:
    enabled: true
    fail_on_regression: true
  security:
    enabled: true
    block_on_critical: true
  tests:
    enabled: true
    min_coverage: 80
```

---

# Database

## Migrations

### Tool
- Alembic (Python)
- Version-controlled migrations
- Rollback support

### Process
1. Generate migration
2. Review migration
3. Test migration
4. Apply in CI/CD
5. Verify migration

### Best Practices
- Backward-compatible migrations
- Test migrations on copy of production
- Never delete columns without deprecation
- Use transactions

## Backups

### Schedule
- Daily automated backups
- Weekly full backups
- Retention: 30 days (configurable)

### Storage
- Encrypted backups
- Offsite storage
- Access-controlled

### Restore Testing
- Monthly restore tests
- Verify data integrity
- Document procedure

## Connection Pooling

### Configuration
```yaml
pool_size: 20
max_overflow: 10
pool_timeout: 30
pool_recycle: 3600
```

### Monitoring
- Connection count
- Pool utilization
- Wait time

---

# Vector Database

## Persistence

### pgvector
- Persistent storage
- WAL for durability
- Regular backups

### Qdrant
- On-disk storage
- Snapshot backups
- Replication (optional)

## Backups

- Automated snapshots
- Point-in-time recovery
- Restore testing

## Indexes

### pgvector
```sql
CREATE INDEX ON document_chunks
    USING ivfflat (embedding vector_cosine_ops)
    WITH (lists = 100);
```

### Qdrant
- Automatic indexing
- Payload indexes for filtering

## Scaling

### pgvector
- Vertical scaling (more RAM/CPU)
- Read replicas (future)

### Qdrant
- Horizontal scaling (sharding)
- Replication

---

# Redis

## Role

1. **Celery Broker**: Task queue management
2. **Caching**: Session data, permissions
3. **Rate Limiting**: Request counting
4. **Token Blacklist**: Refresh token revocation

## Configuration

```yaml
maxmemory: 256mb
maxmemory-policy: allkeys-lru
appendonly: yes
appendfsync: everysec
```

## Persistence

- AOF for durability
- RDB for backups
- Configure based on use case

## Monitoring

- Memory usage
- Connected clients
- Hit rate
- Queue depth

---

# Workers

## Ingestion Workers

### Concurrency
- Default: 4 workers per process
- Configurable per deployment
- Resource-aware scaling

### Task Types
- Document ingestion
- Re-embedding
- Cleanup tasks

### Retry Handling
- Exponential backoff
- Max retries: 3 (configurable)
- Dead letter queue

### Failure Queues
- Separate queue for failed tasks
- Manual retry option
- Alerting on failures

## Monitoring

- Task completion rate
- Failure rate
- Queue depth
- Worker health

---

# Observability

## Logs

### Format
```json
{
  "timestamp": "2025-01-15T10:30:00Z",
  "level": "INFO",
  "service": "api",
  "request_id": "req_abc123",
  "message": "Query processed",
  "metadata": {
    "user_id": "usr_abc123",
    "latency_ms": 2500
  }
}
```

### Configuration
- JSON structured logging
- Correlation IDs
- No sensitive data

## Metrics

### API Metrics
- Request count by endpoint
- Latency histogram
- Error rate
- Active connections

### RAG Metrics
- Retrieval scores
- Reranker scores
- Token usage
- Citation success rate

### System Metrics
- CPU usage
- Memory usage
- Disk usage
- Network I/O

### Export
- Prometheus format
- Custom dashboards

## Tracing

### OpenTelemetry
- Distributed tracing
- Span hierarchy
- Error attribution

### Integration
- API server
- Workers
- Database queries
- External calls

## Alerts

### Critical
- Service down
- Error rate > 5%
- Database connection failure

### Warning
- High latency
- Queue depth > threshold
- Memory usage > 80%

### Info
- Deployment completed
- Backup completed
- Migration applied

---

# Health Checks

## Liveness Probe

**Purpose**: Is the service running?

**Endpoint**: GET /health

**Response**:
```json
{
  "status": "healthy",
  "timestamp": "2025-01-15T10:30:00Z"
}
```

**Configuration**:
- Interval: 30s
- Timeout: 3s
- Start period: 5s
- Retries: 3

## Readiness Probe

**Purpose**: Can the service handle requests?

**Endpoint**: GET /ready

**Checks**:
- Database connectivity
- Redis connectivity
- Vector DB connectivity
- Worker health

**Response**:
```json
{
  "status": "ready",
  "checks": {
    "database": "healthy",
    "redis": "healthy",
    "vector_db": "healthy",
    "workers": "healthy"
  }
}
```

---

# Scaling

## Horizontal Scaling

### API Servers
- Add instances behind load balancer
- Stateless design enables scaling
- Session data in Redis

### Workers
- Add worker instances
- Celery handles distribution
- Queue-based scaling

## Vertical Scaling

### Database
- Increase RAM/CPU
- Add storage
- Read replicas

### Vector Database
- Increase resources
- Sharding (Qdrant)

## Auto-Scaling

### Configuration
```yaml
min_replicas: 2
max_replicas: 10
target_cpu: 70
target_memory: 80
scale_up_cooldown: 300
scale_down_cooldown: 600
```

---

# Reliability

## Timeouts

```yaml
api_timeout: 30
database_timeout: 10
redis_timeout: 5
vector_db_timeout: 10
llm_timeout: 60
embedding_timeout: 30
```

## Retries

```yaml
max_retries: 3
retry_backoff: 1
retry_backoff_max: 60
retry_jitter: true
```

## Circuit Breakers

### Configuration
```yaml
failure_threshold: 5
success_threshold: 3
timeout: 30
```

### Services
- LLM API
- Embedding API
- External services

## Graceful Degradation

- Reranker failure → Use fusion ranking
- BM25 failure → Use vector search only
- Vector DB failure → Return error
- LLM failure → Return error

---

# Security

## TLS

### Termination
- Nginx terminates TLS
- Internal HTTP (trusted network)
- Certificate management (Let's Encrypt or commercial)

### Configuration
```nginx
ssl_certificate /etc/ssl/certs/askmydocs.pem;
ssl_certificate_key /etc/ssl/private/askmydocs.key;
ssl_protocols TLSv1.2 TLSv1.3;
ssl_ciphers HIGH:!aNULL:!MD5;
```

## Secrets

- Environment variables
- Kubernetes secrets (if using K8s)
- No secrets in images
- Rotation support

## Network Isolation

### Docker Network
```yaml
networks:
  frontend:
    driver: bridge
  backend:
    driver: bridge
  internal:
    driver: bridge
    internal: true
```

### Firewall Rules
- Frontend: 443, 80
- Backend: Internal only
- Database: Backend only

## Least Privilege

- Containers run as non-root
- Database users have minimal permissions
- API keys with limited scope

## Container Security

- Scan images for vulnerabilities
- No privileged containers
- Read-only filesystem where possible
- Resource limits

---

# Deployment Strategy

## Rolling Update (Recommended)

### Process
1. Deploy new version to one instance
2. Health check passes
3. Route traffic to new instance
4. Repeat for remaining instances
5. Old instances terminated

### Advantages
- Zero downtime
- Easy rollback
- Simple implementation

### Disadvantages
- Mixed versions during deployment

## Blue/Green

### Process
1. Deploy new version (green)
2. Run smoke tests
3. Switch traffic from blue to green
4. Keep blue for rollback

### Advantages
- Instant rollback
- No mixed versions

### Disadvantages
- Double resources during deployment

## Canary

### Process
1. Deploy to small percentage of traffic
2. Monitor for issues
3. Gradually increase traffic
4. Full deployment if healthy

### Advantages
- Early issue detection
- Limited blast radius

### Disadvantages
- Complex implementation

---

# Rollback

## Application Rollback

### Process
1. Identify issue
2. Deploy previous version
3. Verify rollback
4. Monitor for stability

### Automation
- CI/CD rollback command
- Quick deployment
- Health check validation

## Database Rollback

### Considerations
- Schema changes may not be reversible
- Data migrations may be destructive
- Plan rollback before migration

### Process
1. Stop application
2. Apply rollback migration
3. Deploy previous application version
4. Verify functionality

---

# Disaster Recovery

## Backups

### Database
- Daily automated backups
- WAL archiving (point-in-time recovery)
- Offsite storage

### Vector Database
- Regular snapshots
- Export capability

### Redis
- RDB snapshots
- AOF persistence

## Recovery

### RPO (Recovery Point Objective)
- Target: 1 hour (configurable)
- Based on backup frequency

### RTO (Recovery Time Objective)
- Target: 4 hours (configurable)
- Based on restoration process

### Process
1. Assess damage
2. Restore from backup
3. Apply WAL (if available)
4. Verify data integrity
5. Deploy application
6. Validate functionality

---

# Cost Control

## Model Usage

### Limits
- Token budget per user (configurable)
- Token budget per tenant (configurable)
- Alert on high usage

### Optimization
- Cache frequent queries
- Use smaller models for simple tasks
- Batch processing

## Storage Management

### Documents
- Retention policy
- Cleanup old documents
- Compression

### Logs
- Log rotation
- Retention period
- Sampling

## Resource Scaling

### Auto-Scaling
- Scale down during low traffic
- Scale up for peak usage
- Cost-aware scaling

### Right-Sizing
- Monitor resource usage
- Adjust instance sizes
- Remove unused resources

---

# Production Checklist

## Pre-Deployment

- [ ] All tests passing
- [ ] Evaluation passing quality gates
- [ ] Security scan clean
- [ ] Configuration reviewed
- [ ] Secrets rotated (if needed)
- [ ] Backups verified

## Deployment

- [ ] Database migrations applied
- [ ] API servers deployed
- [ ] Workers deployed
- [ ] Health checks passing
- [ ] Readiness checks passing
- [ ] No errors in logs

## Post-Deployment

- [ ] Smoke tests passing
- [ ] Monitoring active
- [ ] Alerts configured
- [ ] Documentation updated
- [ ] Rollback plan ready

## Ongoing

- [ ] Monitoring reviewed
- [ ] Backups verified
- [ ] Security patches applied
- [ ] Performance reviewed
- [ ] Cost reviewed

---

# Acceptance Criteria

## Infrastructure

- [ ] All containers build successfully
- [ ] Health checks configured
- [ ] Resource limits set
- [ ] Network isolation working

## Deployment

- [ ] CI/CD pipeline functional
- [ ] Automated deployment working
- [ ] Rollback tested
- [ ] Zero-downtime deployment

## Monitoring

- [ ] Logs collected
- [ ] Metrics exported
- [ ] Traces working
- [ ] Alerts configured

## Security

- [ ] TLS configured
- [ ] Secrets managed
- [ ] Access controlled
- [ ] Scanning automated

## Reliability

- [ ] Health checks passing
- [ ] Auto-scaling configured
- [ ] Backups working
- [ ] Disaster recovery tested

---

# Deployment Architecture Diagram

```mermaid
graph TB
    subgraph Internet["Internet"]
        User[User]
    end

    subgraph Edge["Edge Layer"]
        CDN[CDN]
        LB[Load Balancer]
    end

    subgraph DMZ["DMZ"]
        Nginx[Nginx]
    end

    subgraph Application["Application Layer"]
        API1[API Server 1]
        API2[API Server 2]
        Worker1[Worker 1]
        Worker2[Worker 2]
    end

    subgraph Data["Data Layer"]
        PG[(PostgreSQL)]
        Redis[(Redis)]
        Qdrant[(Qdrant)]
    end

    subgraph Storage["Storage"]
        S3[Object Storage]
    end

    subgraph Observability["Observability"]
        Prometheus[Prometheus]
        Grafana[Grafana]
        Jaeger[Jaeger]
    end

    User --> CDN
    CDN --> LB
    LB --> Nginx
    Nginx --> API1
    Nginx --> API2
    API1 --> PG
    API1 --> Redis
    API1 --> Qdrant
    API1 --> S3
    API2 --> PG
    API2 --> Redis
    API2 --> Qdrant
    Worker1 --> PG
    Worker1 --> Redis
    Worker1 --> Qdrant
    Worker1 --> S3
    Worker2 --> PG
    Worker2 --> Redis
    Worker2 --> Qdrant
    Worker2 --> S3
    API1 --> Prometheus
    Worker1 --> Prometheus
    Prometheus --> Grafana
    API1 --> Jaeger
```

---

*This document is consistent with ARCHITECTURE.md, SECURITY.md, and REQUIREMENTS.md.*
