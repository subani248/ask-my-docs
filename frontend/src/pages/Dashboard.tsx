import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useTheme } from '../context/ThemeContext'
import { apiGetStats, apiListDocuments, apiListConversations, type DashboardStats, type DocumentItem, type ConversationListItem } from '../services/api'

export default function Dashboard() {
  const { user } = useAuth()
  const { darkMode } = useTheme()
  const [stats, setStats] = useState<DashboardStats>({ documents: 0, questions: 0, conversations: 0, chunks: 0 })
  const [recentDocs, setRecentDocs] = useState<DocumentItem[]>([])
  const [recentQuestions, setRecentQuestions] = useState<ConversationListItem[]>([])

  useEffect(() => {
    if (user) {
      apiGetStats().then(setStats).catch(() => {})
      apiListDocuments(1, 5).then(res => setRecentDocs(res.documents)).catch(() => {})
      apiListConversations(1, 5).then(res => setRecentQuestions(res.items)).catch(() => {})
    }
  }, [user])

  const firstName = user?.full_name?.split(' ')[0] || 'Subani'

  const formatSize = (bytes: number) => {
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
  }

  return (
    <div className="max-w-[1400px] mx-auto space-y-6 pb-12">
      
      {/* Hero Section */}
      <div className="relative bg-[#045d43] rounded-3xl p-8 lg:p-10 overflow-hidden text-white flex flex-col md:flex-row items-center justify-between shadow-lg">
        
        {/* Left Content */}
        <div className="relative z-10 max-w-xl w-full">
          <div className="inline-flex items-center gap-1.5 bg-[#034d37] rounded-full px-3 py-1 text-xs font-semibold text-[#34d399] mb-6 border border-[#0b6c50]">
             ✨ AI-Powered Study Assistant
          </div>
          <h1 className="text-3xl lg:text-4xl font-extrabold tracking-tight mb-4 leading-tight">
            Welcome back, <span className="text-[#34d399]">{firstName}!</span> 👋
          </h1>
          <p className="text-[#a7f3d0] text-[15px] leading-relaxed mb-8 max-w-md">
            Your documents, knowledge, and conversations in one place. Upload, ask questions, and get accurate answers with AI.
          </p>
          <div className="flex flex-wrap items-center gap-4">
            <Link to="/documents" className="flex items-center gap-2 bg-[#34d399] text-[#022c20] px-5 py-2.5 rounded-xl font-bold hover:bg-[#10b981] transition-colors shadow-lg shadow-emerald-900/50">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
              Upload Document →
            </Link>
            <Link to="/ask" className="flex items-center gap-2 bg-[#022c20]/50 border border-[#10b981]/30 text-white px-5 py-2.5 rounded-xl font-bold hover:bg-[#022c20] transition-colors">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>
              Ask a Question
            </Link>
          </div>
        </div>

        {/* Right Decorative Graphic (CSS Mockup) */}
        <div className="hidden lg:block relative w-[400px] h-[200px] z-10">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-7xl drop-shadow-2xl">🤖</div>
          
          <div className="absolute top-4 left-10 transform -rotate-12 bg-white rounded-xl shadow-xl p-2.5 flex flex-col items-center justify-center border border-gray-100 hover:scale-110 transition-transform">
            <div className="w-8 h-8 bg-red-100 rounded-lg flex items-center justify-center text-red-600 font-bold text-[10px]">PDF</div>
          </div>
          
          <div className="absolute -top-2 left-32 transform rotate-6 bg-white rounded-xl shadow-xl p-2.5 flex flex-col items-center justify-center border border-gray-100 hover:scale-110 transition-transform">
            <div className="w-8 h-8 bg-orange-100 rounded-lg flex items-center justify-center text-orange-600 font-bold text-[10px]">PPT</div>
          </div>

          <div className="absolute top-2 right-28 transform rotate-12 bg-white rounded-xl shadow-xl p-2.5 flex flex-col items-center justify-center border border-gray-100 hover:scale-110 transition-transform">
            <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center text-blue-600 font-bold text-[10px]">W</div>
          </div>

          <div className="absolute top-12 right-6 transform rotate-6 bg-white rounded-xl shadow-xl p-2.5 flex flex-col items-center justify-center border border-gray-100 hover:scale-110 transition-transform">
            <div className="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center text-green-600 font-bold text-[10px]">TXT</div>
          </div>

          <div className="absolute -top-12 right-[-20px] bg-white text-gray-800 text-[11px] font-bold px-3 py-2 rounded-xl rounded-bl-none shadow-xl transform rotate-6">
            Ask anything about your documents!
          </div>

          {/* Ambient Glow */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-[#34d399] rounded-full blur-[80px] opacity-20 -z-10"></div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className={`p-5 rounded-2xl border flex items-center gap-4 ${darkMode ? 'bg-zinc-900 border-zinc-800' : 'bg-[#eafaf1] border-[#d1f0e4]'}`}>
          <div className="w-12 h-12 rounded-xl bg-green-100 text-green-600 flex items-center justify-center text-xl">📄</div>
          <div>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-extrabold text-gray-900 dark:text-white">{stats.documents || 0}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-gray-500 dark:text-zinc-400">Documents</span>
            </div>
          </div>
        </div>

        <div className={`p-5 rounded-2xl border flex items-center gap-4 ${darkMode ? 'bg-zinc-900 border-zinc-800' : 'bg-[#fdf4ff] border-[#f5d0fe]'}`}>
          <div className="w-12 h-12 rounded-xl bg-purple-100 text-purple-600 flex items-center justify-center text-xl">💬</div>
          <div>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-extrabold text-gray-900 dark:text-white">{stats.questions || 0}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-gray-500 dark:text-zinc-400">Questions</span>
            </div>
          </div>
        </div>

        <div className={`p-5 rounded-2xl border flex items-center gap-4 ${darkMode ? 'bg-zinc-900 border-zinc-800' : 'bg-[#fff7ed] border-[#fed7aa]'}`}>
          <div className="w-12 h-12 rounded-xl bg-orange-100 text-orange-600 flex items-center justify-center text-xl">📊</div>
          <div>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-extrabold text-gray-900 dark:text-white">{stats.conversations || 0}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-gray-500 dark:text-zinc-400">Conversations</span>
            </div>
          </div>
        </div>

        <div className={`p-5 rounded-2xl border flex items-center gap-4 ${darkMode ? 'bg-zinc-900 border-zinc-800' : 'bg-[#eff6ff] border-[#bfdbfe]'}`}>
          <div className="w-12 h-12 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center text-xl">🔖</div>
          <div>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-extrabold text-gray-900 dark:text-white">{stats.chunks || 0}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-gray-500 dark:text-zinc-400">Knowledge Chunks</span>
            </div>
          </div>
        </div>
      </div>

      {/* Action Bars */}
      <div className="grid md:grid-cols-2 gap-4">
        <Link to="/documents" className={`flex items-center gap-4 p-5 rounded-2xl border hover:shadow-md transition-all group ${darkMode ? 'bg-zinc-900 border-zinc-800' : 'bg-[#f0f9f5] border-transparent'}`}>
           <div className="w-12 h-12 rounded-full bg-[#045d43] text-white flex items-center justify-center flex-shrink-0">
             <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
           </div>
           <div className="flex-1">
             <h3 className="font-bold text-gray-900 dark:text-white mb-0.5 group-hover:text-[#045d43] dark:group-hover:text-[#34d399] transition-colors">Upload Document</h3>
             <p className="text-xs text-gray-500 dark:text-zinc-400">Add PDF, DOCX, PPT, or text files to your knowledge base.</p>
           </div>
           <div className="w-8 h-8 rounded-full bg-white dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 flex items-center justify-center text-gray-400 group-hover:text-[#045d43] dark:group-hover:text-[#34d399] group-hover:border-[#045d43] dark:group-hover:border-[#34d399] transition-all">
             <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
           </div>
        </Link>
        
        <Link to="/ask" className={`flex items-center gap-4 p-5 rounded-2xl border hover:shadow-md transition-all group ${darkMode ? 'bg-zinc-900 border-zinc-800' : 'bg-[#f5f3ff] border-transparent'}`}>
           <div className="w-12 h-12 rounded-full bg-[#7c3aed] text-white flex items-center justify-center flex-shrink-0">
             <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" /></svg>
           </div>
           <div className="flex-1">
             <h3 className="font-bold text-gray-900 dark:text-white mb-0.5 group-hover:text-[#7c3aed] transition-colors">Ask My Docs</h3>
             <p className="text-xs text-gray-500 dark:text-zinc-400">Ask questions and get citation-backed answers from your documents.</p>
           </div>
           <div className="w-8 h-8 rounded-full bg-white dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 flex items-center justify-center text-gray-400 group-hover:text-[#7c3aed] group-hover:border-[#7c3aed] transition-all">
             <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
           </div>
        </Link>
      </div>

      {/* Grid Bottom Section */}
      <div className="grid lg:grid-cols-[1.5fr_1.5fr_1fr] gap-6">
        
        {/* Recent Documents */}
        <div className={`p-6 rounded-3xl border flex flex-col ${darkMode ? 'bg-zinc-900 border-zinc-800' : 'bg-white border-gray-100 shadow-sm'}`}>
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2 font-bold text-gray-900 dark:text-white">
              <span className="text-[#045d43]">📄</span> Recent Documents
            </div>
            <Link to="/documents" className="text-xs font-semibold text-[#045d43] dark:text-[#34d399] hover:underline flex items-center gap-1">
              View All <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
            </Link>
          </div>
          <div className="flex-1 space-y-4">
            {recentDocs.length === 0 ? (
              <p className="text-sm text-gray-500 dark:text-zinc-400 text-center py-8">No documents yet. Upload one to get started!</p>
            ) : (
              recentDocs.map((doc) => (
                <div key={doc.id} className="flex items-center gap-4 group">
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-bold text-gray-900 dark:text-white truncate" title={doc.original_filename}>{doc.original_filename}</p>
                    <div className="flex items-center gap-2 mt-0.5 text-[11px] font-medium text-gray-500">
                      <span>{formatDate(doc.created_at)}</span>
                      <span className="w-1 h-1 rounded-full bg-gray-300"></span>
                      <span>{formatSize(doc.file_size)}</span>
                    </div>
                  </div>
                  <button className="text-gray-400 hover:text-gray-900 dark:hover:text-white p-2">
                     <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" /></svg>
                  </button>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Recent Questions */}
        <div className={`p-6 rounded-3xl border flex flex-col ${darkMode ? 'bg-zinc-900 border-zinc-800' : 'bg-white border-gray-100 shadow-sm'}`}>
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2 font-bold text-gray-900 dark:text-white">
              <span className="text-purple-600">💬</span> Recent Questions / Conversations
            </div>
            <Link to="/history" className="text-xs font-semibold text-[#045d43] dark:text-[#34d399] hover:underline flex items-center gap-1">
              View All <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
            </Link>
          </div>
          <div className="flex-1 space-y-4">
            {recentQuestions.length === 0 ? (
              <p className="text-sm text-gray-500 dark:text-zinc-400 text-center py-8">No questions asked yet.</p>
            ) : (
              recentQuestions.map((q) => (
                <div key={q.id} className="flex items-start gap-4">
                  <div className="w-9 h-9 rounded-full bg-gray-50 dark:bg-zinc-800 border border-gray-100 dark:border-zinc-700 flex items-center justify-center flex-shrink-0 text-gray-500">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" /></svg>
                  </div>
                  <div className="flex-1 min-w-0 pt-0.5">
                    <p className="text-[13px] font-bold text-gray-900 dark:text-white truncate" title={q.last_message || q.title}>{q.last_message || q.title || 'Conversation'}</p>
                    <p className="mt-0.5 text-[11px] font-medium text-gray-500">{formatDate(q.updated_at)}</p>
                  </div>
                  <button className="text-gray-400 hover:text-gray-900 dark:hover:text-white p-2">
                     <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" /></svg>
                  </button>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Quick Actions */}
        <div className={`p-6 rounded-3xl border flex flex-col ${darkMode ? 'bg-zinc-900 border-zinc-800' : 'bg-white border-gray-100 shadow-sm'}`}>
          <div className="flex items-center gap-2 font-bold text-gray-900 dark:text-white mb-6">
            <span className="text-[#34d399]">⚡</span> Quick Actions
          </div>
          <div className="grid grid-cols-2 gap-3 mb-6">
            <Link to="/documents" className={`p-4 rounded-2xl flex flex-col items-center justify-center text-center gap-1.5 transition-transform hover:scale-105 ${darkMode ? 'bg-[#045d43]/20 text-[#34d399]' : 'bg-[#eafaf1] text-[#045d43]'}`}>
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
              <div>
                <p className="text-[11px] font-bold">Upload Documents</p>
                <p className="text-[9px] opacity-70">PDF, PPT, DOCX, TXT</p>
              </div>
            </Link>
            
            <Link to="/ask" className={`p-4 rounded-2xl flex flex-col items-center justify-center text-center gap-1.5 transition-transform hover:scale-105 ${darkMode ? 'bg-purple-900/20 text-purple-400' : 'bg-[#fdf4ff] text-purple-700'}`}>
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8h2a2 2 0 012 2v6a2 2 0 01-2 2h-2v4l-4-4H9a1.994 1.994 0 01-1.414-.586m0 0L11 14h4a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2v4l.586-.586z" /></svg>
              <div>
                <p className="text-[11px] font-bold">New Question</p>
                <p className="text-[9px] opacity-70">Ask from your docs</p>
              </div>
            </Link>

            <Link to="/history" className={`p-4 rounded-2xl flex flex-col items-center justify-center text-center gap-1.5 transition-transform hover:scale-105 ${darkMode ? 'bg-pink-900/20 text-pink-400' : 'bg-[#fdf2f8] text-pink-700'}`}>
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              <div>
                <p className="text-[11px] font-bold">View History</p>
                <p className="text-[9px] opacity-70">Previous chats</p>
              </div>
            </Link>

            <Link to="/documents" className={`p-4 rounded-2xl flex flex-col items-center justify-center text-center gap-1.5 transition-transform hover:scale-105 ${darkMode ? 'bg-orange-900/20 text-orange-400' : 'bg-[#fff7ed] text-orange-700'}`}>
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" /></svg>
              <div>
                <p className="text-[11px] font-bold">Manage Documents</p>
                <p className="text-[9px] opacity-70">Organize your files</p>
              </div>
            </Link>
          </div>

          <div className={`mt-auto p-4 rounded-2xl flex gap-3 ${darkMode ? 'bg-zinc-800' : 'bg-[#f8fafc]'}`}>
            <span className="text-green-500 text-lg flex-shrink-0">💡</span>
            <p className="text-[11px] text-gray-500 dark:text-zinc-400 font-medium leading-relaxed">
              Tip: Use natural language to ask questions like "Explain this chapter" or "Summarize this PDF".
            </p>
            <button className="text-gray-400 hover:text-gray-600 self-start">
               <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          </div>
        </div>

      </div>

    </div>
  )
}
