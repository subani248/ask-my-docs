import { Link } from 'react-router-dom'
import { useEffect, useState } from 'react'



export default function Home() {
  const [isScrolled, setIsScrolled] = useState(false)

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 10)
    }
    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#eafaf1] via-white to-white font-sans text-gray-900 overflow-x-hidden">
      
      {/* Navbar */}
      <nav className={`fixed top-0 inset-x-0 z-50 transition-all duration-300 ${isScrolled ? 'bg-white/90 backdrop-blur-md shadow-sm py-3' : 'bg-transparent py-5'}`}>
        <div className="max-w-7xl mx-auto px-6 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <svg className="w-7 h-7 text-[#045d43]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
              <polyline points="14 2 14 8 20 8"></polyline>
              <line x1="16" y1="13" x2="8" y2="13"></line>
              <line x1="16" y1="17" x2="8" y2="17"></line>
              <polyline points="10 9 9 9 8 9"></polyline>
            </svg>
            <span className="text-xl font-bold tracking-tight text-gray-900">Ask My <span className="text-[#045d43]">Docs</span></span>
          </Link>

          <div className="hidden md:flex items-center gap-8">
            <Link to="/" className="text-sm font-semibold text-gray-900 border-b-2 border-[#045d43] pb-1">Home</Link>
            <Link to="/features" className="text-sm font-medium text-gray-500 hover:text-gray-900 transition-colors">Features</Link>
            <Link to="/how-it-works" className="text-sm font-medium text-gray-500 hover:text-gray-900 transition-colors">How it Works</Link>
          </div>

          <div className="flex items-center gap-4">
            <button className="text-gray-500 hover:text-gray-900 transition-colors hidden sm:block">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
            </button>
            <Link to="/login" className="text-sm font-semibold text-gray-900 border border-gray-300 rounded-full px-5 py-2 hover:bg-gray-50 transition-colors">
              Login
            </Link>
            <Link to="/register" className="text-sm font-semibold text-white bg-[#045d43] rounded-full px-5 py-2.5 hover:bg-[#034d37] transition-colors shadow-lg shadow-emerald-900/20">
              Get Started
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative pt-32 pb-20 lg:pt-40 lg:pb-28 max-w-7xl mx-auto px-6 grid lg:grid-cols-2 gap-12 items-center">
        
        {/* Left Content */}
        <div className="relative z-10">
          <div className="inline-flex items-center gap-2 rounded-full bg-[#ebf7f3] border border-[#d1f0e4] px-3 py-1.5 mb-6">
            <span className="text-[#045d43]">✨</span>
            <span className="text-sm font-bold text-[#045d43]">Powered by AI</span>
          </div>

          <h1 className="text-5xl lg:text-7xl font-extrabold tracking-tight leading-[1.1] mb-6">
            Your Documents,<br />
            <span className="text-[#045d43]">Instant Answers.</span>
          </h1>

          <p className="text-lg text-gray-600 mb-8 max-w-lg leading-relaxed">
            Upload your PDFs, PPTs, DOCX or notes and ask questions in natural language. Get accurate, contextual answers from your own documents using AI.
          </p>

          <div className="flex flex-wrap items-center gap-4 mb-8">
            <Link to="/register" className="flex items-center gap-2 bg-[#045d43] text-white px-7 py-3.5 rounded-full font-semibold hover:bg-[#034d37] transition-colors shadow-xl shadow-emerald-900/20">
              Get Started
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M14 5l7 7m0 0l-7 7m7-7H3" />
              </svg>
            </Link>
            <button className="flex items-center gap-2 bg-white border border-gray-200 text-gray-900 px-7 py-3.5 rounded-full font-semibold hover:bg-gray-50 transition-colors shadow-sm">
              <span className="bg-[#045d43] text-white rounded-full p-1">
                <svg className="w-3 h-3 ml-0.5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" />
                </svg>
              </span>
              Watch Demo
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-6 text-sm font-medium text-gray-600">
            <span className="flex items-center gap-1.5">
              <span className="text-[#34d399] bg-[#eafaf1] rounded-full p-0.5">
                <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg>
              </span>
              No credit card required
            </span>
            <span className="flex items-center gap-1.5">
              <span className="text-[#34d399] bg-[#eafaf1] rounded-full p-0.5">
                <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg>
              </span>
              Secure & private
            </span>
            <span className="flex items-center gap-1.5">
              <span className="text-[#34d399] bg-[#eafaf1] rounded-full p-0.5">
                <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg>
              </span>
              Supports multiple formats
            </span>
          </div>
        </div>

        {/* Right Illustration/Mockup */}
        <div className="relative z-10 hidden lg:block h-[500px]">
          
          {/* Decorative Elements */}
          <div className="absolute top-10 left-10 transform -rotate-12 bg-white rounded-xl shadow-xl p-3 flex flex-col items-center justify-center border border-gray-100 z-20 hover:scale-110 transition-transform">
            <div className="w-10 h-10 bg-red-100 rounded-lg flex items-center justify-center text-red-600 font-bold mb-1">PDF</div>
          </div>
          <div className="absolute top-4 right-32 transform rotate-12 bg-white rounded-xl shadow-xl p-3 flex flex-col items-center justify-center border border-gray-100 z-20 hover:scale-110 transition-transform">
            <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center text-orange-600 font-bold mb-1">PPT</div>
          </div>
          <div className="absolute top-24 right-10 transform rotate-6 bg-white rounded-xl shadow-xl p-3 flex flex-col items-center justify-center border border-gray-100 z-20 hover:scale-110 transition-transform">
            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center text-blue-600 font-bold mb-1">W</div>
          </div>

          <div className="absolute top-20 right-[-40px] z-30">
             <div className="bg-[#045d43] text-white text-sm font-medium px-4 py-2 rounded-xl rounded-bl-none shadow-lg transform rotate-6">
                Ask anything about your documents!
             </div>
          </div>

          <div className="absolute top-6 left-28 transform -rotate-6 z-30">
             <div className="font-writing text-gray-800 text-lg rotate-[-15deg] whitespace-nowrap">
                Upload any document ↘
             </div>
          </div>

          {/* Laptop Mockup */}
          <div className="absolute top-32 left-0 right-0 z-10 w-[700px] bg-[#1a1a1a] rounded-t-3xl rounded-b-xl shadow-2xl overflow-hidden border-8 border-[#262626]">
            {/* Screen Content */}
            <div className="bg-[#f8fafc] w-full h-[320px] flex overflow-hidden">
              {/* Sidebar */}
              <div className="w-[200px] bg-white border-r border-gray-100 p-4 flex flex-col">
                <div className="flex items-center gap-2 mb-6 text-[#045d43] font-bold text-sm">
                  <span className="bg-[#045d43] text-white w-5 h-5 rounded flex items-center justify-center text-xs">💬</span>
                  Ask My Docs
                </div>
                <div className="space-y-1">
                  <div className="flex items-center gap-2 px-3 py-2 bg-[#eafaf1] text-[#045d43] rounded-lg text-xs font-semibold">
                    <span>🏠</span> Home
                  </div>
                  <div className="flex items-center gap-2 px-3 py-2 text-gray-500 rounded-lg text-xs font-medium">
                    <span>💬</span> Chat
                  </div>
                  <div className="flex items-center gap-2 px-3 py-2 text-gray-500 rounded-lg text-xs font-medium">
                    <span>📄</span> My Documents
                  </div>
                </div>
              </div>
              {/* Main Area */}
              <div className="flex-1 p-6 bg-gray-50 flex flex-col">
                <h3 className="text-xl font-bold text-gray-900 mb-1">Ask My <span className="text-[#045d43]">Docs</span></h3>
                <p className="text-xs text-gray-500 mb-4">Upload your documents and get instant answers.</p>
                
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-2 flex items-center mb-6">
                  <input type="text" placeholder="Ask a question about your documents..." className="flex-1 text-sm bg-transparent outline-none px-2 text-gray-600" disabled />
                  <div className="w-8 h-8 bg-[#045d43] rounded-lg flex items-center justify-center text-white">→</div >
                </div>

                <div className="grid grid-cols-2 gap-4 flex-1">
                   <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
                     <h4 className="text-xs font-bold text-gray-800 mb-3">Recent Documents</h4>
                     <div className="space-y-2">
                       <div className="flex items-center gap-2 text-xs text-gray-600"><span className="text-red-500">📄</span> DBMS_Notes.pdf</div>
                       <div className="flex items-center gap-2 text-xs text-gray-600"><span className="text-orange-500">📄</span> ML_Lecture_3.pptx</div>
                     </div>
                   </div>
                   <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
                     <h4 className="text-xs font-bold text-gray-800 mb-3">Recent Questions</h4>
                     <div className="space-y-2">
                       <div className="flex items-center gap-2 text-[10px] text-gray-600">💬 Explain the working of TCP...</div>
                       <div className="flex items-center gap-2 text-[10px] text-gray-600">💬 Summarize Unit 1 notes.</div>
                     </div>
                   </div>
                </div>
              </div>
            </div>
            {/* Laptop Base */}
            <div className="h-4 bg-gray-400 w-[110%] -ml-[5%] rounded-b-3xl relative">
              <div className="absolute top-0 left-1/2 -translate-x-1/2 w-24 h-1 bg-gray-300 rounded-b-md"></div>
            </div>
          </div>
          
          {/* Floating Robot & Books */}
          <div className="absolute bottom-4 -right-12 z-30">
            <div className="relative">
               <div className="text-6xl text-shadow-xl">🤖</div>
               <div className="absolute -top-8 -right-10 whitespace-nowrap transform rotate-12 font-writing text-gray-800 text-sm">
                 Get accurate<br/>answers with AI
               </div>
            </div>
          </div>

        </div>
      </section>

    </div>
  )
}
