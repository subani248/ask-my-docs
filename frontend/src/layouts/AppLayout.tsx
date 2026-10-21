import { useState, useRef, useEffect } from 'react'
import { Outlet, NavLink, Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useTheme } from '../context/ThemeContext'

const NAV_ITEMS = [
  { to: '/dashboard', label: 'Dashboard', icon: '🏠' },
  { to: '/documents', label: 'Documents', icon: '📄' },
  { to: '/ask', label: 'Ask My Docs', icon: '💬' },
  { to: '/history', label: 'History', icon: '🕐' },
  { to: '/bookmarks', label: 'Bookmarks', icon: '🔖' },
  { to: '/settings', label: 'Settings', icon: '⚙️' },
]

export default function AppLayout() {
  const { user, logout } = useAuth()
  const { darkMode, toggleDarkMode } = useTheme()
  const navigate = useNavigate()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [userMenuOpen, setUserMenuOpen] = useState(false)
  const location = useLocation()

  const userRef = useRef<HTMLDivElement>(null)
  const initials = user?.full_name ? user.full_name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2) : 'SS'

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (userRef.current && !userRef.current.contains(e.target as Node)) setUserMenuOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  const handleLogout = async () => { await logout(); navigate('/login') }

  return (
    <div className={`h-screen flex overflow-hidden font-sans ${darkMode ? 'bg-zinc-950 text-white' : 'bg-gray-50 text-gray-900'}`}>
      
      {/* Mobile Sidebar Overlay */}
      {sidebarOpen && <div className="fixed inset-0 z-30 bg-black/40 lg:hidden" onClick={() => setSidebarOpen(false)} />}

      {/* Sidebar */}
      <aside className={`fixed lg:static inset-y-0 left-0 z-40 w-64 flex flex-col transform transition-transform duration-200 ease-in-out border-r ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'} ${darkMode ? 'bg-zinc-900 border-zinc-800' : 'bg-white border-gray-100'}`}>
        
        {/* Logo */}
        <div className="h-16 flex items-center px-6 border-b border-transparent mt-2">
          <Link to="/" className="flex items-center gap-2">
            <svg className="w-6 h-6 text-[#045d43] dark:text-[#34d399]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
              <polyline points="14 2 14 8 20 8"></polyline>
              <line x1="16" y1="13" x2="8" y2="13"></line>
              <line x1="16" y1="17" x2="8" y2="17"></line>
              <polyline points="10 9 9 9 8 9"></polyline>
            </svg>
            <span className="text-xl font-bold tracking-tight">Ask My <span className="text-[#045d43] dark:text-[#34d399]">Docs</span></span>
          </Link>
        </div>

        {/* Nav Links */}
        <nav className="flex-1 py-4 px-4 space-y-1 overflow-y-auto">
          {NAV_ITEMS.map((item) => (
            <NavLink key={item.to} to={item.to} onClick={() => setSidebarOpen(false)}
              className={({ isActive }) => `flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                isActive 
                  ? darkMode ? 'bg-[#045d43]/20 text-[#34d399]' : 'bg-[#eafaf1] text-[#045d43]'
                  : darkMode ? 'text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200' : 'text-gray-500 hover:bg-gray-50 hover:text-gray-900'
              }`}>
              <span className={`text-lg ${location.pathname === item.to ? (darkMode ? 'text-[#34d399]' : 'text-[#045d43]') : 'text-gray-400'}`}>{item.icon}</span>
              {item.label}
            </NavLink>
          ))}
        </nav>

        {/* Bottom Section */}
        <div className="p-4 border-t border-transparent">
          {/* Storage Usage Widget */}
          <div className={`p-4 rounded-2xl mb-4 border ${darkMode ? 'bg-zinc-800/50 border-zinc-700/50' : 'bg-white border-gray-100 shadow-sm'}`}>
            <div className="flex justify-between items-start mb-2">
              <div>
                <p className={`text-xs font-semibold ${darkMode ? 'text-zinc-400' : 'text-gray-500'}`}>Storage Usage</p>
                <p className="text-[13px] font-bold mt-1"><span className="text-gray-900 dark:text-white">1.2 GB</span> <span className="text-gray-400">/ 5 GB</span></p>
              </div>
              <div className="w-10 h-10 rounded-full border-4 border-[#045d43] border-t-gray-100 dark:border-t-zinc-700 flex items-center justify-center transform -rotate-45">
                <span className={`text-[10px] font-bold transform rotate-45 ${darkMode ? 'text-white' : 'text-gray-900'}`}>24%</span>
              </div>
            </div>
            <div className="w-full h-1.5 bg-gray-100 dark:bg-zinc-700 rounded-full mt-2 mb-3">
              <div className="h-full bg-[#045d43] rounded-full w-[24%]"></div>
            </div>
            <button className="w-full py-1.5 rounded-lg bg-[#fff8eb] dark:bg-orange-500/10 text-orange-600 dark:text-orange-400 text-xs font-bold flex items-center justify-center gap-1.5 hover:bg-orange-50 dark:hover:bg-orange-500/20 transition-colors">
              <span>👑</span> Upgrade Storage
            </button>
          </div>

          {/* User Profile */}
          <div className="flex items-center gap-3 px-2 py-2">
            <div className="w-10 h-10 rounded-full bg-[#045d43] text-white flex items-center justify-center text-sm font-bold flex-shrink-0">
              {initials}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold truncate">{user?.full_name || 'Subani Shaik'}</p>
              <p className={`text-[11px] font-medium truncate ${darkMode ? 'text-zinc-400' : 'text-gray-500'}`}>{user?.email || 'subanishaik248@gmail.com'}</p>
            </div>
            <button className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
               <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
            </button>
          </div>
          
          <button onClick={handleLogout} className={`mt-2 w-full flex items-center gap-2 text-sm font-semibold px-2 py-2 rounded-lg transition-colors ${darkMode ? 'text-red-400 hover:bg-red-500/10' : 'text-red-500 hover:bg-red-50'}`}>
             <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
             Sign out
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0">
        
        {/* Top Navbar */}
        <header className={`h-16 flex items-center justify-between px-6 lg:px-8 border-b flex-shrink-0 transition-colors ${darkMode ? 'bg-zinc-900 border-zinc-800' : 'bg-white border-gray-100'}`}>
          <div className="flex items-center gap-4 flex-1">
            <button onClick={() => setSidebarOpen(!sidebarOpen)} className={`lg:hidden p-2 rounded-lg ${darkMode ? 'text-zinc-400 hover:bg-zinc-800' : 'text-gray-500 hover:bg-gray-100'}`}>
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" /></svg>
            </button>
            
            {/* Search Bar */}
            <div className={`hidden md:flex items-center gap-3 rounded-xl border px-3 py-2 w-full max-w-lg transition-colors ${darkMode ? 'bg-zinc-800 border-zinc-700 text-zinc-300' : 'bg-gray-50 border-gray-200 text-gray-600'}`}>
              <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
              <input type="text" placeholder="Search your documents, questions, or anything..." className="flex-1 bg-transparent text-sm placeholder-gray-400 outline-none" />
              <div className="flex items-center gap-1">
                <kbd className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${darkMode ? 'bg-zinc-700 text-zinc-300' : 'bg-white border border-gray-200 text-gray-500 shadow-sm'}`}>Ctrl</kbd>
                <kbd className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${darkMode ? 'bg-zinc-700 text-zinc-300' : 'bg-white border border-gray-200 text-gray-500 shadow-sm'}`}>K</kbd>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <button onClick={toggleDarkMode} className={`p-2 rounded-full transition-colors ${darkMode ? 'text-zinc-400 hover:bg-zinc-800' : 'text-gray-400 hover:bg-gray-100'}`}>
               {darkMode ? '🌙' : '☀️'}
            </button>
            <button className={`relative p-2 rounded-full transition-colors ${darkMode ? 'text-zinc-400 hover:bg-zinc-800' : 'text-gray-400 hover:bg-gray-100'}`}>
               <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" /></svg>
               <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full border border-white dark:border-zinc-900"></span>
            </button>
            <div className="hidden sm:flex items-center gap-2 pl-2 border-l border-gray-200 dark:border-zinc-700">
               <div className="w-8 h-8 rounded-full bg-[#045d43] text-white flex items-center justify-center text-xs font-bold">{initials}</div>
               <div>
                 <p className="text-sm font-bold leading-tight">{user?.full_name?.split(' ')[0] || 'Subani'} Shaik</p>
                 <p className={`text-[10px] font-medium leading-tight ${darkMode ? 'text-zinc-400' : 'text-gray-500'}`}>Student</p>
               </div>
               <svg className={`w-4 h-4 ml-1 ${darkMode ? 'text-zinc-500' : 'text-gray-400'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className={`flex-1 overflow-y-auto p-6 lg:p-8 ${darkMode ? 'bg-zinc-950' : 'bg-[#fafbfc]'}`}>
          <Outlet />
        </main>
      </div>
    </div>
  )
}
