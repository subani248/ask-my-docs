import { useState, useEffect, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTheme } from '../context/ThemeContext'
import {
  apiListConversations,
  apiSearchConversations,
  apiRenameConversation,
  apiDeleteConversation,
  type ConversationListItem,
  type ConversationDetail,
  type MessageItem,
} from '../services/api'

/* ── Helpers ── */

function timeAgo(dateStr: string): string {
  const now = Date.now()
  const then = new Date(dateStr).getTime()
  const diff = now - then
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'Just now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days === 1) return 'Yesterday'
  if (days < 7) return `${days}d ago`
  return new Date(dateStr).toLocaleDateString()
}

function groupByDate(items: ConversationListItem[]): Record<string, ConversationListItem[]> {
  const groups: Record<string, ConversationListItem[]> = {}
  const now = new Date()
  const today = now.toDateString()
  const yesterday = new Date(now.getTime() - 86400000).toDateString()
  const weekAgo = new Date(now.getTime() - 7 * 86400000).getTime()

  for (const item of items) {
    const d = new Date(item.updated_at)
    const ds = d.toDateString()
    let label = 'Older'
    if (ds === today) label = 'Today'
    else if (ds === yesterday) label = 'Yesterday'
    else if (d.getTime() > weekAgo) label = 'Previous 7 Days'
    if (!groups[label]) groups[label] = []
    groups[label].push(item)
  }
  return groups
}

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

/* ── Rename modal ── */

function RenameModal({
  title,
  onRename,
  onClose,
  darkMode,
}: {
  title: string
  onRename: (t: string) => void
  onClose: () => void
  darkMode: boolean
}) {
  const [value, setValue] = useState(title)
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div
        className={`rounded-2xl p-6 w-full max-w-sm shadow-xl ${darkMode ? 'bg-gray-800 border border-gray-700' : 'bg-white'}`}
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className={`text-sm font-bold mb-3 ${darkMode ? 'text-zinc-900 dark:text-white' : 'text-gray-900'}`}>Rename conversation</h3>
        <input
          autoFocus
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && value.trim()) { onRename(value.trim()); onClose() } }}
          maxLength={80}
          className={`w-full rounded-xl border px-3 py-2 text-sm outline-none mb-4 ${darkMode ? 'bg-gray-700 border-gray-600 text-zinc-900 dark:text-white' : 'bg-gray-50 border-gray-200 text-gray-900'}`}
        />
        <div className="flex gap-2 justify-end">
          <button onClick={onClose} className={`text-xs px-3 py-1.5 rounded-lg ${darkMode ? 'text-zinc-500 hover:bg-gray-700' : 'text-gray-500 hover:bg-gray-100'}`}>Cancel</button>
          <button onClick={() => { if (value.trim()) { onRename(value.trim()); onClose() } }} disabled={!value.trim()} className="text-xs px-3 py-1.5 rounded-lg bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 hover:bg-zinc-800 dark:hover:bg-zinc-100 disabled:opacity-50">Save</button>
        </div>
      </div>
    </div>
  )
}

/* ── Delete confirm modal ── */

function DeleteModal({
  onConfirm,
  onClose,
  darkMode,
}: {
  onConfirm: () => void
  onClose: () => void
  darkMode: boolean
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div
        className={`rounded-2xl p-6 w-full max-w-sm shadow-xl ${darkMode ? 'bg-gray-800 border border-gray-700' : 'bg-white'}`}
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className={`text-sm font-bold mb-2 ${darkMode ? 'text-zinc-900 dark:text-white' : 'text-gray-900'}`}>Delete conversation?</h3>
        <p className={`text-xs mb-4 ${darkMode ? 'text-zinc-500' : 'text-gray-500'}`}>This cannot be undone.</p>
        <div className="flex gap-2 justify-end">
          <button onClick={onClose} className={`text-xs px-3 py-1.5 rounded-lg ${darkMode ? 'text-zinc-500 hover:bg-gray-700' : 'text-gray-500 hover:bg-gray-100'}`}>Cancel</button>
          <button onClick={onConfirm} className="text-xs px-3 py-1.5 rounded-lg bg-red-600 text-zinc-900 dark:text-white hover:bg-red-500">Delete</button>
        </div>
      </div>
    </div>
  )
}

/* ── Message bubble in conversation detail ── */

function MessageBubble({ msg, darkMode }: { msg: MessageItem; darkMode: boolean }) {
  const isUser = msg.role === 'user'
  return (
    <div className={`flex items-start gap-3 mb-4 ${isUser ? 'justify-end' : ''}`}>
      {!isUser && (
        <div className="w-8 h-8 rounded-full bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 flex items-center justify-center flex-shrink-0">
          <span className="text-zinc-900 dark:text-white text-sm">🤖</span>
        </div>
      )}
      <div className={`max-w-2xl rounded-2xl px-5 py-3 text-sm leading-relaxed whitespace-pre-wrap ${
        isUser
          ? 'bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 rounded-tr-md'
          : darkMode
            ? 'bg-gray-800 border border-gray-700 text-gray-100 rounded-tl-md'
            : 'bg-white border border-gray-200 shadow-sm text-gray-900 rounded-tl-md'
      }`}>
        {isUser ? msg.content : parseCitationRefs(msg.content).map((part, i) =>
          part.type === 'citation' ? (
            <span key={i} className="inline-block bg-zinc-100 dark:bg-zinc-800 text-purple-700 text-xs font-bold px-1.5 py-0.5 rounded mx-0.5">{part.value}</span>
          ) : (
            <span key={i}>{part.value}</span>
          )
        )}
      </div>
      {isUser && (
        <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${darkMode ? 'bg-gray-700' : 'bg-gray-200'}`}>
          <span className="text-sm">👤</span>
        </div>
      )}
    </div>
  )
}

/* ── Main History component ── */

export default function History() {
  const { darkMode } = useTheme()
  const navigate = useNavigate()

  const [conversations, setConversations] = useState<ConversationListItem[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<ConversationListItem[] | null>(null)
  const [selected, setSelected] = useState<ConversationDetail | null>(null)

  // Modals
  const [renameTarget, setRenameTarget] = useState<ConversationListItem | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<ConversationListItem | null>(null)

  const searchTimer = useRef<ReturnType<typeof setTimeout>>(undefined)

  const loadConversations = useCallback(async () => {
    setLoading(true)
    try {
      const data = await apiListConversations(1, 100)
      setConversations(data.items)
    } catch {
      // Ignore
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadConversations() }, [loadConversations])

  // Debounced search
  useEffect(() => {
    if (searchTimer.current) clearTimeout(searchTimer.current)
    if (!searchQuery.trim()) {
      setSearchResults(null)
      return
    }
    searchTimer.current = setTimeout(async () => {
      try {
        const data = await apiSearchConversations(searchQuery.trim())
        setSearchResults(data.items)
      } catch {
        setSearchResults([])
      }
    }, 300)
    return () => { if (searchTimer.current) clearTimeout(searchTimer.current) }
  }, [searchQuery])

  const openConversation = (id: string) => {
    navigate(`/ask?conversation=${id}`)
  }

  const handleRename = async (id: string, title: string) => {
    await apiRenameConversation(id, title)
    setConversations((prev) => prev.map((c) => c.id === id ? { ...c, title } : c))
    if (selected?.id === id) setSelected((prev) => prev ? { ...prev, title } : prev)
  }

  const handleDelete = async (id: string) => {
    await apiDeleteConversation(id)
    setConversations((prev) => prev.filter((c) => c.id !== id))
    if (selected?.id === id) setSelected(null)
  }

  const displayItems = searchResults ?? conversations
  const grouped = groupByDate(displayItems)

  const bg = darkMode ? 'bg-gray-900' : ''
  const textStrong = darkMode ? 'text-zinc-900 dark:text-white' : 'text-gray-900'
  const text = darkMode ? 'text-zinc-500' : 'text-gray-500'
  const inputBg = darkMode ? 'bg-gray-800 border-gray-700 text-zinc-900 dark:text-white placeholder-gray-500' : 'bg-white border-gray-200 text-gray-900 placeholder-gray-400'
  const hoverBg = darkMode ? 'hover:bg-gray-800' : 'hover:bg-gray-50'

  /* ── Detail view ── */
  if (selected) {
    return (
      <div className={`h-[calc(100vh-4rem)] flex flex-col ${bg}`}>
        <div className={`border-b px-6 py-3 flex items-center gap-4 ${darkMode ? 'border-gray-800' : 'border-gray-200'}`}>
          <button onClick={() => setSelected(null)} className={`text-sm ${darkMode ? 'text-zinc-500 hover:text-zinc-900 dark:text-white' : 'text-gray-500 hover:text-gray-900'}`}>
            ← Back
          </button>
          <div className="flex-1 min-w-0">
            <h1 className={`text-sm font-bold truncate ${textStrong}`}>{selected.title}</h1>
            {selected.document_ids.length > 0 && (
              <p className={`text-xs ${text}`}>{selected.document_ids.length} document{selected.document_ids.length > 1 ? 's' : ''} referenced</p>
            )}
          </div>
          <span className={`text-xs ${text}`}>{selected.message_count} messages</span>
        </div>

        <div className="flex-1 overflow-y-auto">
          <div className="max-w-4xl mx-auto px-4 py-6">
            {selected.messages.map((msg) => (
              <MessageBubble key={msg.id} msg={msg} darkMode={darkMode} />
            ))}
          </div>
        </div>

        <div className={`border-t px-6 py-3 ${darkMode ? 'bg-gray-900 border-gray-800' : 'bg-white border-gray-200'}`}>
          <button
            onClick={() => navigate(`/ask?conversation=${selected.id}`)}
            className="w-full text-center text-sm text-zinc-900 dark:text-zinc-100 font-semibold hover:text-zinc-600 dark:text-zinc-400 font-medium py-2"
          >
            Ask a follow-up question →
          </button>
        </div>

        {renameTarget && (
          <RenameModal
            title={renameTarget.title}
            onRename={(t) => handleRename(renameTarget.id, t)}
            onClose={() => setRenameTarget(null)}
            darkMode={darkMode}
          />
        )}
        {deleteTarget && (
          <DeleteModal
            onConfirm={() => { handleDelete(deleteTarget.id); setDeleteTarget(null) }}
            onClose={() => setDeleteTarget(null)}
            darkMode={darkMode}
          />
        )}
      </div>
    )
  }

  /* ── List view ── */
  return (
    <div className="max-w-5xl mx-auto">
      <h1 className={`text-2xl font-bold mb-2 ${textStrong}`}>History</h1>
      <p className={`text-sm mb-6 ${text}`}>View your past questions and conversations.</p>

      {/* Search */}
      <div className={`flex items-center gap-2 rounded-xl border px-4 py-2.5 mb-6 ${inputBg}`}>
        <span className="text-zinc-500 text-sm">🔍</span>
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search conversations..."
          className={`flex-1 bg-transparent text-sm outline-none ${darkMode ? 'text-gray-300 placeholder-gray-500' : 'text-gray-700 placeholder-gray-400'}`}
        />
        {searchQuery && (
          <button onClick={() => setSearchQuery('')} className="text-zinc-500 hover:text-gray-600 text-sm">✕</button>
        )}
      </div>

      {/* Loading */}
      {loading && (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className={`rounded-xl p-4 animate-pulse ${darkMode ? 'bg-gray-800' : 'bg-white border border-gray-200'}`}>
              <div className={`h-4 w-48 rounded mb-2 ${darkMode ? 'bg-gray-700' : 'bg-gray-200'}`} />
              <div className={`h-3 w-64 rounded ${darkMode ? 'bg-gray-700' : 'bg-gray-200'}`} />
            </div>
          ))}
        </div>
      )}

      {/* Empty state */}
      {!loading && displayItems.length === 0 && (
        <div className={`rounded-xl border p-12 text-center ${darkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
          <span className="text-4xl mb-4 block">🕐</span>
          <h2 className={`text-lg font-semibold mb-2 ${textStrong}`}>
            {searchResults !== null ? 'No conversations found.' : 'No conversations yet'}
          </h2>
          <p className={`text-sm max-w-md mx-auto mb-4 ${text}`}>
            {searchResults !== null
              ? 'Try a different search term.'
              : 'Ask a question about your documents to start your first conversation.'}
          </p>
          {searchResults === null && (
            <button
              onClick={() => navigate('/ask')}
              className="text-sm px-4 py-2 rounded-xl bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 hover:bg-zinc-800 dark:hover:bg-zinc-100 font-medium"
            >
              Ask My Docs →
            </button>
          )}
        </div>
      )}

      {/* Conversation groups */}
      {!loading && displayItems.length > 0 && (
        <div className="space-y-6">
          {Object.entries(grouped).map(([label, items]) => (
            <div key={label}>
              <h3 className={`text-xs font-semibold uppercase tracking-wider mb-2 ${text}`}>{label}</h3>
              <div className="space-y-1">
                {items.map((conv) => (
                  <div
                    key={conv.id}
                    className={`group flex items-center gap-3 rounded-xl px-4 py-3 cursor-pointer transition-colors ${hoverBg}`}
                    onClick={() => openConversation(conv.id)}
                  >
                    <span className="text-lg">📄</span>
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm font-semibold truncate ${textStrong}`}>{conv.title}</p>
                      {conv.last_message && (
                        <p className={`text-xs truncate ${text}`}>"{conv.last_message}"</p>
                      )}
                    </div>
                    <span className={`text-xs flex-shrink-0 ${text}`}>{timeAgo(conv.updated_at)}</span>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity" onClick={(e) => e.stopPropagation()}>
                      <button
                        onClick={() => setRenameTarget(conv)}
                        className={`p-1 rounded-lg text-xs ${darkMode ? 'text-gray-500 hover:text-zinc-900 dark:text-white hover:bg-gray-700' : 'text-zinc-500 hover:text-gray-700 hover:bg-gray-100'}`}
                        title="Rename"
                      >
                        ✏️
                      </button>
                      <button
                        onClick={() => setDeleteTarget(conv)}
                        className={`p-1 rounded-lg text-xs ${darkMode ? 'text-gray-500 hover:text-red-400 hover:bg-gray-700' : 'text-zinc-500 hover:text-red-500 hover:bg-red-50'}`}
                        title="Delete"
                      >
                        🗑️
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {renameTarget && (
        <RenameModal
          title={renameTarget.title}
          onRename={(t) => handleRename(renameTarget.id, t)}
          onClose={() => setRenameTarget(null)}
          darkMode={darkMode}
        />
      )}
      {deleteTarget && (
        <DeleteModal
          onConfirm={() => { handleDelete(deleteTarget.id); setDeleteTarget(null) }}
          onClose={() => setDeleteTarget(null)}
          darkMode={darkMode}
        />
      )}
    </div>
  )
}
