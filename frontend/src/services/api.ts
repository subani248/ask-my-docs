const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'

// ─── Types ───────────────────────────────────────────────────

export interface User {
  id: string
  full_name: string
  email: string
  role: string
  is_active: boolean
  google_id?: string | null
}

export interface AuthResponse {
  user: User
  access_token: string
  token_type: string
}

export interface ApiError {
  detail: string
}

// ─── Helpers ─────────────────────────────────────────────────

async function request<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const url = `${API_URL}${path}`
  const res = await fetch(url, {
    ...options,
    credentials: 'include', // send cookies
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  })

  const body = await res.json().catch(() => null)

  if (!res.ok) {
    const message =
      (body as ApiError | null)?.detail ?? `Request failed (${res.status})`
    throw new Error(message)
  }

  return body as T
}

// ─── Auth API ────────────────────────────────────────────────

export async function apiRegister(
  full_name: string,
  email: string,
  password: string
): Promise<AuthResponse> {
  return request<AuthResponse>('/api/v1/auth/register', {
    method: 'POST',
    body: JSON.stringify({ full_name, email, password }),
  })
}

export async function apiLogin(
  email: string,
  password: string
): Promise<AuthResponse> {
  return request<AuthResponse>('/api/v1/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  })
}

export async function apiLogout(): Promise<void> {
  await request<{ message: string }>('/api/v1/auth/logout', {
    method: 'POST',
  })
}

export async function apiGetMe(): Promise<User> {
  return request<User>('/api/v1/auth/me')
}

export async function apiGoogleAuth(credential: string): Promise<AuthResponse> {
  return request<AuthResponse>('/api/v1/auth/google', {
    method: 'POST',
    body: JSON.stringify({ credential }),
  })
}

export async function apiUpdateProfile(fullName: string): Promise<User> {
  return request<User>('/api/v1/auth/me', {
    method: 'PUT',
    body: JSON.stringify({ full_name: fullName }),
  })
}

export async function apiChangePassword(currentPassword: string, newPassword: string): Promise<void> {
  await request<{ message: string }>('/api/v1/auth/change-password', {
    method: 'POST',
    body: JSON.stringify({ current_password: currentPassword, new_password: newPassword }),
  })
}

export async function apiExportData(): Promise<void> {
  const url = `${API_URL}/api/v1/auth/export`
  const res = await fetch(url, { credentials: 'include' })
  if (!res.ok) throw new Error('Export failed')
  const blob = await res.blob()
  const disposition = res.headers.get('Content-Disposition') || ''
  const match = disposition.match(/filename="(.+)"/)
  const filename = match ? match[1] : 'askmydocs-export.txt'
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(a.href)
}

export async function apiDeleteAccount(): Promise<void> {
  await request<{ message: string }>('/api/v1/auth/me', {
    method: 'DELETE',
  })
}

// ─── Documents ──────────────────────────────────────────────

export interface DocumentItem {
  id: string
  filename: string
  original_filename: string
  content_type: string
  file_size: number
  status: string
  error_message: string | null
  chunk_count: number
  created_at: string
  updated_at: string
}

export interface DocumentListResponse {
  documents: DocumentItem[]
  total: number
  page: number
  page_size: number
}

export interface IngestionJob {
  id: string
  document_id: string
  status: string
  attempts: number
  error_message: string | null
  started_at: string | null
  completed_at: string | null
  created_at: string
}

export async function apiListDocuments(
  page = 1,
  pageSize = 20
): Promise<DocumentListResponse> {
  const params = new URLSearchParams({
    page: String(page),
    page_size: String(pageSize),
  })
  return request<DocumentListResponse>(`/api/v1/documents?${params}`)
}

export async function apiGetDocument(id: string): Promise<DocumentItem> {
  return request<DocumentItem>(`/api/v1/documents/${id}`)
}

export async function apiUploadDocument(
  file: File,
  onProgress?: (pct: number) => void
): Promise<DocumentItem> {
  const url = `${API_URL}/api/v1/documents`
  const formData = new FormData()
  formData.append('file', file)

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open('POST', url)
    xhr.withCredentials = true

    xhr.upload.addEventListener('progress', (e) => {
      if (e.lengthComputable && onProgress) {
        onProgress(Math.round((e.loaded / e.total) * 100))
      }
    })

    xhr.addEventListener('load', () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve(JSON.parse(xhr.responseText))
      } else {
        try {
          const body = JSON.parse(xhr.responseText)
          reject(new Error(body.detail || 'Upload failed'))
        } catch {
          reject(new Error('Upload failed'))
        }
      }
    })

    xhr.addEventListener('error', () => reject(new Error('Network error')))
    xhr.send(formData)
  })
}

export async function apiDeleteDocument(id: string): Promise<void> {
  const url = `${API_URL}/api/v1/documents/${id}`
  const res = await fetch(url, {
    method: 'DELETE',
    credentials: 'include',
  })
  if (!res.ok && res.status !== 204) {
    throw new Error('Delete failed')
  }
}

export async function apiGetDocumentStatus(
  id: string
): Promise<IngestionJob> {
  return request<IngestionJob>(`/api/v1/documents/${id}/status`)
}

// ─── Health ──────────────────────────────────────────────────

export async function healthCheck(): Promise<{ status: string }> {
  return request<{ status: string }>('/health')
}

export async function readinessCheck(): Promise<{
  status: string
  checks: Record<string, string>
}> {
  return request<{ status: string; checks: Record<string, string> }>('/ready')
}

// ─── Retrieval ──────────────────────────────────────────────

export interface RetrievalResult {
  chunk_id: string
  document_id: string
  score: number
  rank: number
  content: string
  metadata: {
    filename: string
    page_number: number | null
    section: string | null
  }
}

export interface SearchResponse {
  query: string
  results: RetrievalResult[]
  retrieval_status: string
  total_results: number
  trace?: {
    vector_candidates: number
    bm25_candidates: number
    hybrid_candidates: number
    reranked_candidates: number
    latency_ms: Record<string, number>
  }
}

export async function apiSearch(
  query: string,
  topK: number = 8,
): Promise<SearchResponse> {
  return request<SearchResponse>('/api/v1/retrieval/search', {
    method: 'POST',
    body: JSON.stringify({ query, top_k: topK }),
  })
}

// ─── Stats ─────────────────────────────────────────────────

export interface DashboardStats {
  documents: number
  questions: number
  conversations: number
  chunks: number
}

export async function apiGetStats(): Promise<DashboardStats> {
  return request<DashboardStats>('/api/v1/stats')
}

// ─── Conversations / History ───────────────────────────────

export interface ConversationListItem {
  id: string
  title: string
  document_ids: string[]
  last_message: string
  updated_at: string
  message_count: number
}

export interface ConversationListResponse {
  items: ConversationListItem[]
  page: number
  limit: number
  total: number
}

export interface MessageItem {
  id: string
  role: 'user' | 'assistant'
  content: string
  citations: Array<{
    citation_id: string
    document_id: string
    filename: string
    page_number: number | null
    section: string | null
    excerpt: string
  }>
  rag_mode: string | null
  intent: string | null
  document_ids: string[]
  created_at: string
}

export interface ConversationDetail {
  id: string
  title: string
  document_ids: string[]
  created_at: string
  updated_at: string
  message_count: number
  messages: MessageItem[]
}

export async function apiListConversations(page = 1, limit = 20): Promise<ConversationListResponse> {
  const params = new URLSearchParams({ page: String(page), limit: String(limit) })
  return request<ConversationListResponse>(`/api/v1/conversations?${params}`)
}

export async function apiSearchConversations(query: string): Promise<{ items: ConversationListItem[]; query: string; total: number }> {
  const params = new URLSearchParams({ q: query })
  return request(`/api/v1/conversations/search?${params}`)
}

export async function apiGetConversation(id: string): Promise<ConversationDetail> {
  return request<ConversationDetail>(`/api/v1/conversations/${id}`)
}

export async function apiRenameConversation(id: string, title: string): Promise<void> {
  await request(`/api/v1/conversations/${id}`, {
    method: 'PATCH',
    body: JSON.stringify({ title }),
  })
}

export async function apiDeleteConversation(id: string): Promise<void> {
  const url = `${API_URL}/api/v1/conversations/${id}`
  const res = await fetch(url, { method: 'DELETE', credentials: 'include' })
  if (!res.ok && res.status !== 204) {
    throw new Error('Delete failed')
  }
}

// ─── Payments ───────────────────────────────────────────────

export interface RazorpayOrderResponse {
  order_id: string
  amount: number
  currency: string
  razorpay_key_id: string
}

export interface RazorpayVerifyResponse {
  success: boolean
  message: string
  subscription_id: string | null
}

export async function apiCreateRazorpayOrder(
  plan: string,
  amount: number,
  currency: string = 'INR'
): Promise<RazorpayOrderResponse> {
  return request<RazorpayOrderResponse>('/api/v1/payments/create-order', {
    method: 'POST',
    body: JSON.stringify({ plan, amount, currency }),
  })
}

export async function apiVerifyRazorpayPayment(
  razorpay_order_id: string,
  razorpay_payment_id: string,
  razorpay_signature: string,
  plan: string
): Promise<RazorpayVerifyResponse> {
  return request<RazorpayVerifyResponse>('/api/v1/payments/verify', {
    method: 'POST',
    body: JSON.stringify({
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      plan,
    }),
  })
}
