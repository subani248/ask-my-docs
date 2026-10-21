import { useState, useRef, useEffect, useCallback } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useTheme } from '../context/ThemeContext'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'

/* ── Types ── */

interface CitationSource {
  citation_id: string
  document_id: string
  filename: string
  page_number: number | null
  section: string | null
  excerpt: string
}

interface SearchStats {
  documents_searched: number
  chunks_searched: number
  candidates_found: number
  retrieval_latency_ms: number
}

interface AskResponse {
  question: string
  answer: string
  citations: CitationSource[]
  grounded: boolean
  status: string
  allowed: boolean
  intent: string
  suggested_questions?: string[]
  model: string
  retrieval_status: string
  rag_mode: string | null
  search_stats?: SearchStats
  conversation_id?: string
}

interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  question?: string
  answer?: string
  citations?: CitationSource[]
  grounded?: boolean
  status?: string
  allowed?: boolean
  intent?: string
  suggested_questions?: string[]
  model?: string
  retrieval_status?: string
  rag_mode?: string | null
  search_stats?: SearchStats
}

interface DocumentItem {
  id: string
  original_filename: string
  status: string
  chunk_count: number
}

const STATUS_LABELS: Record<string, { text: string; color: string; icon: string }> = {
  SUCCESS: { text: 'Grounded', color: 'text-green-700 bg-green-50', icon: '✅' },
  NO_RELEVANT_CONTEXT: { text: 'Not found', color: 'text-amber-700 bg-amber-50', icon: '🔍' },
  NO_DOCUMENTS: { text: 'No docs', color: 'text-blue-700 bg-blue-50', icon: '📄' },
  INVALID_QUERY: { text: 'Invalid', color: 'text-red-700 bg-red-50', icon: '⚠️' },
  GENERATION_FAILED: { text: 'Error', color: 'text-red-700 bg-red-50', icon: '❌' },
  UNGROUNDED: { text: 'Ungrounded', color: 'text-amber-700 bg-amber-50', icon: '⚠️' },
  OUT_OF_SCOPE: { text: 'Outside scope', color: 'text-orange-700 bg-orange-50', icon: '🚫' },
}

const RAG_MODE_LABELS: Record<string, { text: string; color: string }> = {
  TARGETED: { text: '🎯 Targeted', color: 'text-blue-600 bg-blue-50' },
  DOCUMENT_LEVEL: { text: '📄 Document', color: 'text-zinc-900 dark:text-zinc-100 font-semibold bg-purple-50' },
}

/* ── helpers ── */

function parseCitationRefs(text: string): Array<{ type: 'text' | 'citation'; value: string }> {
  const parts: Array<{ type: 'text' | 'citation'; value: string }> = []
  const regex = /\[(C\d+)\]/g
  let lastIndex = 0
  let match
  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) parts.push({ type: 'text', value: text.slice(lastIndex, match.index) })
    parts.push({ type: 'citation', value: match[1] })
    lastIndex = regex.lastIndex
  }
  if (lastIndex < text.length) parts.push({ type: 'text', value: text.slice(lastIndex) })
  return parts
}

function highlightKeywords(text: string, query: string, darkMode: boolean): React.ReactNode {
  if (!query.trim()) return text
  const words = query
    .toLowerCase()
    .split(/\s+/)
    .filter((w) => w.length > 3)
  if (words.length === 0) return text

  const pattern = new RegExp(`(${words.map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})`, 'gi')
  const segments = text.split(pattern)

  return segments.map((seg, i) =>
    words.some((w) => seg.toLowerCase() === w) ? (
      <mark
        key={i}
        className={`px-0.5 rounded font-semibold ${
          darkMode ? 'bg-purple-900/60 text-purple-200' : 'bg-zinc-100 dark:bg-zinc-800 text-purple-800'
        }`}
      >
        {seg}
      </mark>
    ) : (
      <span key={i}>{seg}</span>
    ),
  )
}

/* ── Typing animation ── */

function TypingIndicator({ darkMode, ragMode }: { darkMode: boolean; ragMode: string }) {
  const [phase, setPhase] = useState(0)
  const labels = ragMode === 'DOCUMENT_LEVEL'
    ? ['Reading document…', 'Analyzing sections…', 'Generating summary…']
    : ['Retrieving documents…', 'Analyzing chunks…', 'Generating answer…']

  useEffect(() => {
    const t = setInterval(() => setPhase((p) => (p + 1) % labels.length), 1800)
    return () => clearInterval(t)
  }, [])

  return (
    <div className="flex items-start gap-3 mb-4">
      <div className="w-8 h-8 rounded-full bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 flex items-center justify-center flex-shrink-0">
        <span className="text-zinc-900 dark:text-white text-sm">🤖</span>
      </div>
      <div
        className={`rounded-2xl rounded-tl-md px-5 py-4 max-w-2xl ${
          darkMode ? 'bg-gray-800 border border-gray-700' : 'bg-white border border-gray-200 shadow-sm'
        }`}
      >
        <div className="flex items-center gap-1.5 mb-3">
          <span className={`w-2 h-2 rounded-full bg-purple-500 animate-bounce`} style={{ animationDelay: '0ms' }} />
          <span className={`w-2 h-2 rounded-full bg-purple-500 animate-bounce`} style={{ animationDelay: '150ms' }} />
          <span className={`w-2 h-2 rounded-full bg-purple-500 animate-bounce`} style={{ animationDelay: '300ms' }} />
        </div>
        <div className="flex items-center gap-2">
          <div className={`w-4 h-4 border-2 ${darkMode ? 'border-purple-400' : 'border-zinc-900 dark:border-white'} border-t-transparent rounded-full animate-spin`} />
          <span className={`text-sm ${darkMode ? 'text-zinc-500' : 'text-gray-500'}`}>{labels[phase]}</span>
        </div>
      </div>
    </div>
  )
}

/* ── Out-of-scope bubble ── */

function OutOfScopeBubble({
  msg,
  darkMode,
  onSuggestionClick,
}: {
  msg: ChatMessage
  darkMode: boolean
  onSuggestionClick: (q: string) => void
}) {
  return (
    <div className="flex items-start gap-3 mb-4">
      <div className="w-8 h-8 rounded-full bg-orange-500 flex items-center justify-center flex-shrink-0">
        <span className="text-zinc-900 dark:text-white text-sm">🚫</span>
      </div>
      <div className="max-w-2xl w-full">
        <div
          className={`rounded-2xl rounded-tl-md px-5 py-4 text-sm leading-relaxed ${
            darkMode
              ? 'bg-gray-800 border border-orange-800/40 text-zinc-700 dark:text-zinc-300'
              : 'bg-orange-50 border border-orange-200 text-gray-800'
          }`}
        >
          <div className="flex items-center gap-2 mb-2">
            <span className="text-orange-500">⚠️</span>
            <span className="font-semibold">Outside document scope</span>
          </div>
          <p className="mb-3">
            Sorry, I can only answer questions about your uploaded document.
          </p>
          {msg.suggested_questions && msg.suggested_questions.length > 0 && (
            <div>
              <p className={`text-xs font-medium mb-2 ${darkMode ? 'text-zinc-500' : 'text-gray-500'}`}>
                You can ask:
              </p>
              <div className="flex flex-wrap gap-1.5">
                {msg.suggested_questions.map((sq) => (
                  <button
                    key={sq}
                    onClick={() => onSuggestionClick(sq)}
                    className={`text-xs px-2.5 py-1.5 rounded-lg border transition-colors ${
                      darkMode
                        ? 'border-gray-700 text-zinc-500 hover:border-orange-500 hover:text-orange-400 bg-gray-900/50'
                        : 'border-orange-200 text-orange-700 hover:border-orange-400 hover:bg-orange-100 bg-white'
                    }`}
                  >
                    {sq}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

/* ── Answer bubble ── */

function AnswerBubble({
  msg,
  darkMode,
  lastQuery,
}: {
  msg: ChatMessage
  darkMode: boolean
  lastQuery: string
}) {
  const [expanded, setExpanded] = useState(false)
  const parts = parseCitationRefs(msg.answer || '')
  const statusInfo = msg.status ? STATUS_LABELS[msg.status] : null
  const modeInfo = msg.rag_mode ? RAG_MODE_LABELS[msg.rag_mode] : null

  return (
    <div className="flex items-start gap-3 mb-4">
      <div className="w-8 h-8 rounded-full bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 flex items-center justify-center flex-shrink-0">
        <span className="text-zinc-900 dark:text-white text-sm">🤖</span>
      </div>
      <div className="max-w-3xl w-full">
        {/* Answer text */}
        <div
          className={`rounded-2xl rounded-tl-md px-5 py-4 text-sm leading-relaxed whitespace-pre-wrap ${
            darkMode ? 'bg-gray-800 border border-gray-700 text-gray-100' : 'bg-white border border-gray-200 shadow-sm text-gray-900'
          }`}
        >
          {parts.map((part, i) =>
            part.type === 'citation' ? (
              <span
                key={i}
                className="inline-block bg-zinc-100 dark:bg-zinc-800 text-purple-700 text-xs font-bold px-1.5 py-0.5 rounded mx-0.5 cursor-pointer hover:bg-purple-200 transition-colors"
                title={`Source ${part.value}`}
              >
                {part.value}
              </span>
            ) : (
              <span key={i}>{part.value}</span>
            ),
          )}
        </div>

        {/* Meta row */}
        <div className="flex items-center gap-3 mt-2 px-1 flex-wrap">
          {statusInfo && (
            <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${statusInfo.color}`}>
              {statusInfo.icon} {statusInfo.text}
            </span>
          )}
          {modeInfo && (
            <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${modeInfo.color}`}>
              {modeInfo.text}
            </span>
          )}
          {msg.grounded && (
            <span className="text-xs bg-green-50 text-green-700 px-2 py-0.5 rounded-full font-medium">✓ Verified</span>
          )}
          {msg.model && <span className={`text-xs ${darkMode ? 'text-gray-600' : 'text-zinc-500'}`}>{msg.model}</span>}
          {msg.citations && msg.citations.length > 0 && (
            <button
              onClick={() => setExpanded(!expanded)}
              className={`text-xs font-medium transition-colors ${
                darkMode ? 'text-purple-400 hover:text-zinc-500' : 'text-zinc-900 dark:text-zinc-100 font-semibold hover:text-zinc-600 dark:text-zinc-400'
              }`}
            >
              {expanded ? '▾ Hide' : '▸ Sources'} ({msg.citations.length})
            </button>
          )}
        </div>

        {/* Sources panel (collapsible) */}
        {expanded && msg.citations && msg.citations.length > 0 && (
          <div className="mt-3 space-y-2">
            {msg.citations.map((c) => (
              <div
                key={c.citation_id}
                className={`rounded-xl border p-3 transition-all ${
                  darkMode
                    ? 'bg-gray-800/50 border-gray-700 hover:border-zinc-900 dark:hover:border-white/50'
                    : 'bg-gray-50 border-gray-200 hover:border-purple-300'
                }`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <span className="bg-zinc-100 dark:bg-zinc-800 text-purple-700 text-xs font-bold px-1.5 py-0.5 rounded">
                    {c.citation_id}
                  </span>
                  <span className={`text-xs font-semibold ${darkMode ? 'text-zinc-900 dark:text-white' : 'text-gray-900'}`}>
                    {c.filename || 'Untitled'}
                  </span>
                  {c.page_number && (
                    <span className={`text-xs ${darkMode ? 'text-gray-500' : 'text-zinc-500'}`}>p.{c.page_number}</span>
                  )}
                  {c.section && (
                    <>
                      <span className={`text-xs ${darkMode ? 'text-gray-600' : 'text-gray-300'}`}>·</span>
                      <span className={`text-xs ${darkMode ? 'text-gray-500' : 'text-zinc-500'}`}>{c.section}</span>
                    </>
                  )}
                </div>
                {c.excerpt && (
                  <p className={`text-xs leading-relaxed pl-2 border-l-2 border-purple-300 dark:border-purple-700 ${
                    darkMode ? 'text-zinc-500' : 'text-gray-500'
                  }`}>
                    &ldquo;{highlightKeywords(
                      c.excerpt.length > 300 ? c.excerpt.slice(0, 300) + '…' : c.excerpt,
                      lastQuery,
                      darkMode,
                    )}&rdquo;
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

/* ── Document selector ── */

function DocumentSelector({
  documents,
  selectedId,
  onSelect,
  darkMode,
}: {
  documents: DocumentItem[]
  selectedId: string | null
  onSelect: (id: string | null) => void
  darkMode: boolean
}) {
  const readyDocs = documents.filter((d) => d.status === 'ready')

  if (readyDocs.length === 0) return null

  return (
    <div className={`flex items-center gap-2 px-1`}>
      <span className={`text-xs font-medium ${darkMode ? 'text-gray-500' : 'text-zinc-500'}`}>Ask about:</span>
      <select
        value={selectedId || ''}
        onChange={(e) => onSelect(e.target.value || null)}
        className={`text-xs rounded-lg border px-2 py-1 outline-none transition-colors ${
          darkMode
            ? 'bg-gray-800 border-gray-700 text-gray-300 focus:border-zinc-200 dark:border-zinc-800'
            : 'bg-white border-gray-200 text-gray-700 focus:border-zinc-200 dark:border-zinc-800'
        }`}
      >
        <option value="">All documents</option>
        {readyDocs.map((doc) => (
          <option key={doc.id} value={doc.id}>
            {doc.original_filename}
          </option>
        ))}
      </select>
    </div>
  )
}

/* ── Main Ask component ── */

export default function Ask() {
  const { darkMode } = useTheme()
  const [searchParams, setSearchParams] = useSearchParams()
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [question, setQuestion] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const chatEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const [lastQuery, setLastQuery] = useState('')
  const [documents, setDocuments] = useState<DocumentItem[]>([])
  const [selectedDocId, setSelectedDocId] = useState<string | null>(null)
  const [conversationId, setConversationId] = useState<string | null>(null)
  const [loadingConversation, setLoadingConversation] = useState(false)
  const loadedConvoRef = useRef<string | null>(null)

  const scrollToBottom = useCallback(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [])

  useEffect(() => {
    scrollToBottom()
  }, [messages, loading, scrollToBottom])

  // Load documents for selector
  useEffect(() => {
    const loadDocs = async () => {
      try {
        const API = import.meta.env.VITE_API_URL || 'http://localhost:8000'
        const res = await fetch(`${API}/api/v1/documents?page=1&page_size=50`, {
          credentials: 'include',
        })
        if (res.ok) {
          const data = await res.json()
          setDocuments(data.documents || [])
          // Auto-select if only one document
          if (data.documents?.length === 1 && data.documents[0].status === 'ready') {
            setSelectedDocId(data.documents[0].id)
          }
        }
      } catch {
        // Ignore — document selector is optional
      }
    }
    loadDocs()
  }, [])

  // Load conversation from URL param when navigating back
  useEffect(() => {
    const convoId = searchParams.get('conversation')
    if (!convoId || convoId === loadedConvoRef.current) return
    if (messages.length > 0 && conversationId === convoId) return

    const loadConversation = async () => {
      setLoadingConversation(true)
      try {
        const res = await fetch(`${API_URL}/api/v1/conversations/${convoId}`, {
          credentials: 'include',
        })
        if (!res.ok) throw new Error('Conversation not found')
        const data = await res.json()

        // Convert backend messages to ChatMessage format
        const loaded: ChatMessage[] = []
        for (const m of data.messages || []) {
          if (m.role === 'user') {
            loaded.push({
              id: m.id,
              role: 'user',
              question: m.content,
            })
          } else if (m.role === 'assistant') {
            loaded.push({
              id: m.id,
              role: 'assistant',
              answer: m.content,
              citations: m.citations || [],
              rag_mode: m.rag_mode,
              intent: m.intent,
              status: 'SUCCESS',
              allowed: true,
              grounded: true,
            })
          }
        }

        setMessages(loaded)
        setConversationId(convoId)
        loadedConvoRef.current = convoId

        // Set document selector from conversation
        if (data.document_ids?.length === 1) {
          setSelectedDocId(data.document_ids[0])
        }
      } catch {
        // Conversation not found — clear the param
        setSearchParams({}, { replace: true })
      } finally {
        setLoadingConversation(false)
      }
    }
    loadConversation()
  }, [searchParams])

  const handleAskSuggestion = async (q: string) => {
    setLastQuery(q)
    const userMsg: ChatMessage = { id: `u-${Date.now()}`, role: 'user', question: q }
    setMessages((prev) => [...prev, userMsg])
    setQuestion('')
    setLoading(true)
    setError('')

    try {
      const body: Record<string, unknown> = { question: q }
      if (selectedDocId) body.document_ids = [selectedDocId]
      if (conversationId) body.conversation_id = conversationId

      const res = await fetch(`${API_URL}/api/v1/ask`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      if (!res.ok) {
        const errBody = await res.json().catch(() => null)
        throw new Error(errBody?.detail || `Request failed (${res.status})`)
      }

      const data: AskResponse = await res.json()
      if (data.conversation_id) {
        setConversationId(data.conversation_id)
        // Update URL so navigating away preserves the conversation
        setSearchParams({ conversation: data.conversation_id }, { replace: true })
        loadedConvoRef.current = data.conversation_id
      }
      setMessages((prev) => [...prev, {
        id: `a-${Date.now()}`,
        role: 'assistant',
        answer: data.answer,
        citations: data.citations,
        grounded: data.grounded,
        status: data.status,
        allowed: data.allowed,
        intent: data.intent,
        suggested_questions: data.suggested_questions,
        model: data.model,
        retrieval_status: data.retrieval_status,
        rag_mode: data.rag_mode,
        search_stats: data.search_stats,
      }])
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to get answer')
      setTimeout(() => setError(''), 5000)
    } finally {
      setLoading(false)
    }
  }

  const handleAsk = async () => {
    if (!question.trim() || loading) return

    const q = question.trim()
    setLastQuery(q)
    const userMsg: ChatMessage = { id: `u-${Date.now()}`, role: 'user', question: q }
    setMessages((prev) => [...prev, userMsg])
    setQuestion('')
    setLoading(true)
    setError('')

    try {
      const body: Record<string, unknown> = { question: q }
      if (selectedDocId) {
        body.document_ids = [selectedDocId]
      }
      if (conversationId) {
        body.conversation_id = conversationId
      }

      const res = await fetch(`${API_URL}/api/v1/ask`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      if (!res.ok) {
        const errBody = await res.json().catch(() => null)
        throw new Error(errBody?.detail || `Request failed (${res.status})`)
      }

      const data: AskResponse = await res.json()
      if (data.conversation_id) {
        setConversationId(data.conversation_id)
        setSearchParams({ conversation: data.conversation_id }, { replace: true })
        loadedConvoRef.current = data.conversation_id
      }
      const assistantMsg: ChatMessage = {
        id: `a-${Date.now()}`,
        role: 'assistant',
        answer: data.answer,
        citations: data.citations,
        grounded: data.grounded,
        status: data.status,
        allowed: data.allowed,
        intent: data.intent,
        suggested_questions: data.suggested_questions,
        model: data.model,
        retrieval_status: data.retrieval_status,
        rag_mode: data.rag_mode,
        search_stats: data.search_stats,
      }
      setMessages((prev) => [...prev, assistantMsg])
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to get answer')
      setTimeout(() => setError(''), 5000)
    } finally {
      setLoading(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleAsk()
    }
  }

  const clearChat = () => {
    setMessages([])
    setQuestion('')
    setError('')
    setConversationId(null)
    loadedConvoRef.current = null
    setSearchParams({}, { replace: true })
  }

  const bg = darkMode ? 'bg-gray-900' : 'bg-gray-50'
  const inputBg = darkMode
    ? 'bg-gray-800 border-gray-700 text-zinc-900 dark:text-white placeholder-gray-500 focus:border-zinc-200 dark:border-zinc-800'
    : 'bg-white border-gray-200 text-gray-900 placeholder-gray-400 focus:border-zinc-200 dark:border-zinc-800'
  const textStrong = darkMode ? 'text-zinc-900 dark:text-white' : 'text-gray-900'
  const text = darkMode ? 'text-zinc-500' : 'text-gray-500'

  return (
    <div className={`h-[calc(100vh-4rem)] flex flex-col ${bg}`}>
      {/* Header */}
      <div className={`border-b px-6 py-3 flex items-center justify-between ${darkMode ? 'border-gray-800' : 'border-gray-200'}`}>
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 flex items-center justify-center">
            <span className="text-zinc-900 dark:text-white text-sm">💬</span>
          </div>
          <div>
            <h1 className={`text-base font-bold ${textStrong}`}>
              Ask My <span className="text-zinc-900 dark:text-zinc-100 font-semibold">Docs</span>
            </h1>
            <p className={`text-xs ${text}`}>Grounded RAG · Citation-backed answers</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <DocumentSelector
            documents={documents}
            selectedId={selectedDocId}
            onSelect={setSelectedDocId}
            darkMode={darkMode}
          />
          {messages.length > 0 && (
            <button
              onClick={clearChat}
              className={`text-xs px-3 py-1.5 rounded-lg transition-colors ${
                darkMode ? 'bg-gray-800 text-zinc-500 hover:text-zinc-900 dark:text-white hover:bg-gray-700' : 'bg-gray-100 text-gray-500 hover:text-gray-700 hover:bg-gray-200'
              }`}
            >
              ↻ New chat
            </button>
          )}
        </div>
      </div>

      {/* Chat area */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-4xl mx-auto px-4 py-6">
          {/* Loading conversation */}
          {loadingConversation && (
            <div className="flex items-center justify-center py-24">
              <div className="flex items-center gap-3">
                <div className="w-5 h-5 border-2 border-zinc-900 dark:border-white border-t-transparent rounded-full animate-spin" />
                <span className={`text-sm ${darkMode ? 'text-zinc-500' : 'text-gray-500'}`}>Loading conversation…</span>
              </div>
            </div>
          )}

          {/* Empty state */}
          {messages.length === 0 && !loading && !loadingConversation && (
            <div className="flex-1 flex items-center justify-center py-24">
              <div className="text-center">
                <div className={`w-20 h-20 rounded-2xl mx-auto mb-4 flex items-center justify-center text-4xl ${
                  darkMode ? 'bg-gray-800' : 'bg-white border border-gray-200'
                }`}>
                  📚
                </div>
                <h2 className={`text-lg font-semibold ${textStrong} mb-2`}>Ask your documents</h2>
                <p className={`text-sm ${text} max-w-md mx-auto`}>
                  Ask anything about your uploaded documents and get
                  AI-powered answers with verifiable source citations.
                </p>
                {selectedDocId && (
                  <p className={`text-xs mt-2 ${darkMode ? 'text-purple-400' : 'text-zinc-900 dark:text-zinc-100 font-semibold'}`}>
                    📄 Asking about: {documents.find(d => d.id === selectedDocId)?.original_filename || 'Selected document'}
                  </p>
                )}
                <p className={`text-xs font-medium mt-6 mb-2 ${darkMode ? 'text-gray-500' : 'text-zinc-500'}`}>You can ask:</p>
                <div className="flex flex-wrap gap-2 justify-center">
                  {[
                    'What is this document about?',
                    'Summarize this document.',
                    'What are the key points?',
                    'What topics are covered?',
                    'What are the main findings?',
                    'Explain the important sections.',
                  ].map((suggestion) => (
                    <button
                      key={suggestion}
                      onClick={() => { setQuestion(suggestion); inputRef.current?.focus() }}
                      className={`text-xs px-3 py-2 rounded-xl border transition-colors ${
                        darkMode
                          ? 'border-gray-700 text-zinc-500 hover:border-zinc-900 dark:hover:border-white hover:text-zinc-900 dark:hover:text-white'
                          : 'border-gray-200 text-gray-500 hover:border-zinc-900 dark:hover:border-white hover:text-zinc-900 dark:text-zinc-100 font-semibold'
                      }`}
                    >
                      {suggestion}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Messages */}
          {messages.map((msg) => (
            <div key={msg.id}>
              {msg.role === 'user' && (
                <div className="flex items-start gap-3 mb-4 justify-end">
                  <div
                    className="rounded-2xl rounded-tr-md px-5 py-3 max-w-2xl text-sm bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900"
                  >
                    {msg.question}
                  </div>
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                    darkMode ? 'bg-gray-700' : 'bg-gray-200'
                  }`}>
                    <span className="text-sm">👤</span>
                  </div>
                </div>
              )}
              {msg.role === 'assistant' && msg.status === 'OUT_OF_SCOPE' ? (
                <OutOfScopeBubble
                  msg={msg}
                  darkMode={darkMode}
                  onSuggestionClick={(q) => {
                    setQuestion(q)
                    setTimeout(() => handleAskSuggestion(q), 100)
                  }}
                />
              ) : msg.role === 'assistant' ? (
                <AnswerBubble msg={msg} darkMode={darkMode} lastQuery={lastQuery} />
              ) : null}
            </div>
          ))}

          {loading && <TypingIndicator darkMode={darkMode} ragMode={selectedDocId ? 'DOCUMENT_LEVEL' : 'TARGETED'} />}

          <div ref={chatEndRef} />
        </div>
      </div>

      {/* Error toast */}
      {error && (
        <div className="max-w-4xl mx-auto w-full px-4 mb-2">
          <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-sm text-red-700 text-center">
            {error}
          </div>
        </div>
      )}

      {/* Input bar */}
      <div className={`border-t px-4 py-3 ${darkMode ? 'bg-gray-900 border-gray-800' : 'bg-white border-gray-200'}`}>
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center gap-3">
            <div className="flex-1 relative">
              <input
                ref={inputRef}
                type="text"
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={selectedDocId ? 'Ask about this document...' : 'Ask a question about your documents...'}
                disabled={loading}
                className={`w-full rounded-xl border px-4 py-3 pr-12 text-sm outline-none transition-colors ${inputBg}`}
              />
              {question && (
                <button
                  onClick={() => { setQuestion(''); inputRef.current?.focus() }}
                  className={`absolute right-3 top-1/2 -translate-y-1/2 text-sm ${
                    darkMode ? 'text-gray-500 hover:text-gray-300' : 'text-zinc-500 hover:text-gray-600'
                  }`}
                >
                  ✕
                </button>
              )}
            </div>
            <button
              onClick={handleAsk}
              disabled={!question.trim() || loading}
              className="bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 rounded-xl px-5 py-3 text-sm font-semibold hover:bg-zinc-800 dark:hover:bg-zinc-100 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center gap-2"
            >
              {loading ? (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <>↑</>
              )}
            </button>
          </div>
          <p className={`text-xs ${text} mt-1.5 text-center`}>
            RAG-powered · Hybrid retrieval · Grounded generation · Citation-verified
          </p>
        </div>
      </div>
    </div>
  )
}
