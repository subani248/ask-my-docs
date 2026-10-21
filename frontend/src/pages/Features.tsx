import { Link } from 'react-router-dom'

const FEATURES_LIST = [
  {
    icon: (
      <svg className="w-6 h-6 text-[#045d43]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
    ),
    title: 'Multiple Formats',
    description: 'Supports PDF, PPT, DOCX, TXT and more.'
  },
  {
    icon: (
      <svg className="w-6 h-6 text-[#045d43]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
      </svg>
    ),
    title: 'Accurate Answers',
    description: 'Get relevant answers with source references.'
  },
  {
    icon: (
      <svg className="w-6 h-6 text-orange-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
      </svg>
    ),
    title: 'Save Time',
    description: 'Find information in seconds, not hours.'
  },
  {
    icon: (
      <svg className="w-6 h-6 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
      </svg>
    ),
    title: 'Secure & Private',
    description: 'Your documents are safe and only accessible to you.'
  },
  {
    icon: (
      <svg className="w-6 h-6 text-[#045d43]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
      </svg>
    ),
    title: 'Hybrid Search',
    description: 'Combines keyword matching with semantic vector search for unmatched precision.'
  },
  {
    icon: (
      <svg className="w-6 h-6 text-[#045d43]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
      </svg>
    ),
    title: 'Advanced AI',
    description: 'Powered by the latest LLM technologies ensuring deep understanding of context.'
  }
]

export default function Features() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-[#eafaf1] via-white to-white font-sans text-gray-900 overflow-x-hidden pt-24 pb-20">
      
      {/* Navbar */}
      <nav className="fixed top-0 inset-x-0 z-50 bg-white/90 backdrop-blur-md shadow-sm py-3 transition-all duration-300">
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
            <Link to="/" className="text-sm font-medium text-gray-500 hover:text-gray-900 transition-colors">Home</Link>
            <Link to="/features" className="text-sm font-semibold text-gray-900 border-b-2 border-[#045d43] pb-1">Features</Link>
            <Link to="/how-it-works" className="text-sm font-medium text-gray-500 hover:text-gray-900 transition-colors">How it Works</Link>
          </div>

          <div className="flex items-center gap-4">
            <Link to="/login" className="text-sm font-semibold text-gray-900 border border-gray-300 rounded-full px-5 py-2 hover:bg-gray-50 transition-colors hidden sm:block">
              Login
            </Link>
            <Link to="/register" className="text-sm font-semibold text-white bg-[#045d43] rounded-full px-5 py-2.5 hover:bg-[#034d37] transition-colors shadow-lg shadow-emerald-900/20">
              Get Started
            </Link>
          </div>
        </div>
      </nav>

      <section className="max-w-7xl mx-auto px-6 py-12">
        <div className="text-center mb-16">
          <div className="inline-flex items-center gap-4 mb-4">
            <div className="h-px w-8 bg-[#045d43]"></div>
            <span className="text-[#045d43] font-bold text-sm tracking-widest uppercase">Everything you need</span>
            <div className="h-px w-8 bg-[#045d43]"></div>
          </div>
          <h1 className="text-4xl lg:text-5xl font-extrabold text-gray-900">Powerful Features for Your Docs</h1>
          <p className="mt-4 text-lg text-gray-500 max-w-2xl mx-auto">
            Our platform provides enterprise-grade AI capabilities disguised as a simple, beautiful interface.
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {FEATURES_LIST.map((feature, i) => (
            <div key={i} className="bg-white rounded-2xl p-8 shadow-[0_4px_20px_rgba(0,0,0,0.03)] border border-gray-100 flex flex-col gap-4 hover:-translate-y-1 transition-transform">
              <div className="w-14 h-14 rounded-2xl bg-[#f0f9f5] flex items-center justify-center">
                {feature.icon}
              </div>
              <div>
                <h3 className="text-xl font-bold text-gray-900 mb-2">{feature.title}</h3>
                <p className="text-[15px] text-gray-500 leading-relaxed">{feature.description}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

    </div>
  )
}
