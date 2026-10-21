import { Link } from 'react-router-dom'

const STEPS = [
  {
    icon: (
      <svg className="w-8 h-8 text-[#045d43]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
      </svg>
    ),
    title: '1. Upload Documents',
    description: 'Upload your PDFs, PPTs, DOCX or text notes securely to our cloud.'
  },
  {
    icon: (
      <svg className="w-8 h-8 text-[#045d43]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
      </svg>
    ),
    title: '2. Ask Questions',
    description: 'Type your question in natural language as if you were talking to an expert.'
  },
  {
    icon: (
      <svg className="w-8 h-8 text-[#045d43]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
      </svg>
    ),
    title: '3. Get Instant Answers',
    description: 'Receive accurate answers instantly, complete with citations pointing directly to your source text.'
  }
]

export default function HowItWorks() {
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
            <Link to="/features" className="text-sm font-medium text-gray-500 hover:text-gray-900 transition-colors">Features</Link>
            <Link to="/how-it-works" className="text-sm font-semibold text-gray-900 border-b-2 border-[#045d43] pb-1">How it Works</Link>
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

      <section className="max-w-4xl mx-auto px-6 py-12">
        <div className="text-center mb-16">
          <div className="inline-flex items-center gap-4 mb-4">
            <div className="h-px w-8 bg-[#045d43]"></div>
            <span className="text-[#045d43] font-bold text-sm tracking-widest uppercase">The Process</span>
            <div className="h-px w-8 bg-[#045d43]"></div>
          </div>
          <h1 className="text-4xl lg:text-5xl font-extrabold text-gray-900">Get Answers in 3 Simple Steps</h1>
          <p className="mt-4 text-lg text-gray-500 max-w-2xl mx-auto">
            It takes less than 60 seconds to go from a raw document to meaningful insights. Here's how it works behind the scenes.
          </p>
        </div>

        <div className="space-y-12 relative">
          {/* Vertical connecting line */}
          <div className="hidden md:block absolute left-12 top-10 bottom-10 w-0.5 bg-gray-200 z-0"></div>

          {STEPS.map((step, i) => (
            <div key={i} className="flex flex-col md:flex-row items-start gap-6 relative z-10">
              <div className="w-24 h-24 rounded-full bg-white shadow-xl flex items-center justify-center flex-shrink-0 border-4 border-[#eafaf1] relative z-10 mx-auto md:mx-0">
                {step.icon}
              </div>
              <div className="bg-white rounded-3xl p-8 shadow-sm border border-gray-100 flex-1 w-full text-center md:text-left">
                <h3 className="text-2xl font-bold text-gray-900 mb-3">{step.title}</h3>
                <p className="text-lg text-gray-500 leading-relaxed">{step.description}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

    </div>
  )
}
