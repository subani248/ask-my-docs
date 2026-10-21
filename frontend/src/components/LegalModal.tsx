import { useEffect, useRef } from 'react'

interface LegalModalProps {
  isOpen: boolean
  onClose: () => void
  title: string
  children: React.ReactNode
}

export default function LegalModal({ isOpen, onClose, title, children }: LegalModalProps) {
  const overlayRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!isOpen) return
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleEsc)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', handleEsc)
      document.body.style.overflow = ''
    }
  }, [isOpen, onClose])

  if (!isOpen) return null

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
      onClick={(e) => {
        if (e.target === overlayRef.current) onClose()
      }}
    >
      <div className="relative w-full max-w-2xl max-h-[80vh] rounded-2xl bg-white shadow-2xl border border-gray-200 flex flex-col overflow-hidden animate-in">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="text-lg font-bold text-gray-900">{title}</h2>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full text-zinc-500 hover:bg-gray-100 hover:text-gray-600 transition-colors"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-5 text-sm text-gray-600 leading-relaxed">
          {children}
        </div>

        {/* Footer */}
        <div className="flex justify-end border-t border-gray-100 px-6 py-3">
          <button
            onClick={onClose}
            className="rounded-xl bg-zinc-900 dark:bg-zinc-100 text-zinc-900 dark:text-white dark:text-zinc-900 px-5 py-2 text-sm font-semibold text-zinc-900 dark:text-white hover:bg-purple-500 transition-colors"
          >
            I Understand
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Terms of Service content ───────────────────────────────

export function TermsContent() {
  return (
    <div className="space-y-4">
      <p className="text-xs text-zinc-500">Last updated: September 1, 2026</p>

      <h3 className="font-semibold text-gray-800">1. Acceptance of Terms</h3>
      <p>
        By accessing and using Ask My Docs ("the Service"), you agree to be bound by these Terms of Service.
        If you do not agree to these terms, please do not use the Service.
      </p>

      <h3 className="font-semibold text-gray-800">2. Description of Service</h3>
      <p>
        Ask My Docs is an AI-powered document intelligence platform that allows users to upload documents
        and ask natural-language questions to receive answers grounded in their uploaded content. The Service
        uses retrieval-augmented generation (RAG) to provide accurate, source-backed responses.
      </p>

      <h3 className="font-semibold text-gray-800">3. User Accounts</h3>
      <p>
        You are responsible for maintaining the confidentiality of your account credentials. You agree to
        provide accurate, current, and complete information during registration. You must notify us
        immediately of any unauthorized use of your account.
      </p>

      <h3 className="font-semibold text-gray-800">4. Acceptable Use</h3>
      <p>You agree not to:</p>
      <ul className="list-disc pl-5 space-y-1">
        <li>Upload documents that contain malware, viruses, or harmful code</li>
        <li>Use the Service for any unlawful purpose or in violation of any applicable law</li>
        <li>Attempt to gain unauthorized access to the Service or its related systems</li>
        <li>Use the Service to harass, abuse, or harm others</li>
        <li>Reverse engineer, decompile, or disassemble any part of the Service</li>
      </ul>

      <h3 className="font-semibold text-gray-800">5. Intellectual Property</h3>
      <p>
        The Service and its original content, features, and functionality are owned by Ask My Docs and are
        protected by copyright, trademark, and other intellectual property laws. Your uploaded documents
        remain your intellectual property.
      </p>

      <h3 className="font-semibold text-gray-800">6. Payment Terms</h3>
      <p>
        Free tier usage is subject to the limits specified in your plan. Paid subscriptions are billed in
        advance on a recurring basis. You may cancel your subscription at any time. Refunds are handled
        on a case-by-case basis within 14 days of purchase.
      </p>

      <h3 className="font-semibold text-gray-800">7. Data and Privacy</h3>
      <p>
        Your uploaded documents are processed to generate embeddings and provide answers. We do not use
        your documents to train AI models or share them with third parties. Please refer to our Privacy
        Policy for detailed information on data handling.
      </p>

      <h3 className="font-semibold text-gray-800">8. Limitation of Liability</h3>
      <p>
        The Service is provided "as is" without warranties of any kind. We are not liable for any
        indirect, incidental, special, or consequential damages arising from your use of the Service.
        AI-generated answers may contain inaccuracies and should be verified against original documents.
      </p>

      <h3 className="font-semibold text-gray-800">9. Termination</h3>
      <p>
        We reserve the right to terminate or suspend your account at our discretion, without notice,
        for conduct that violates these Terms or is harmful to other users, us, or third parties.
      </p>

      <h3 className="font-semibold text-gray-800">10. Changes to Terms</h3>
      <p>
        We reserve the right to modify these Terms at any time. We will notify you of any material
        changes by posting the new Terms on this page and updating the "Last updated" date.
      </p>

      <h3 className="font-semibold text-gray-800">11. Contact Us</h3>
      <p>
        If you have questions about these Terms, please contact us at{' '}
        <span className="text-zinc-900 dark:text-zinc-100 font-semibold font-medium">support@askmydocs.com</span>.
      </p>
    </div>
  )
}

// ─── Privacy Policy content ─────────────────────────────────

export function PrivacyContent() {
  return (
    <div className="space-y-4">
      <p className="text-xs text-zinc-500">Last updated: September 1, 2026</p>

      <h3 className="font-semibold text-gray-800">1. Information We Collect</h3>
      <p>We collect the following types of information:</p>
      <ul className="list-disc pl-5 space-y-1">
        <li><strong>Account Information:</strong> Name, email address, and authentication credentials</li>
        <li><strong>Documents:</strong> Files you upload for processing and querying</li>
        <li><strong>Usage Data:</strong> Questions asked, interactions, and feature usage patterns</li>
        <li><strong>Technical Data:</strong> IP address, browser type, device information, and cookies</li>
      </ul>

      <h3 className="font-semibold text-gray-800">2. How We Use Your Information</h3>
      <p>Your information is used to:</p>
      <ul className="list-disc pl-5 space-y-1">
        <li>Provide, operate, and maintain the Service</li>
        <li>Process your documents to generate embeddings and retrieve relevant content</li>
        <li>Generate AI-powered answers grounded in your documents</li>
        <li>Improve and personalize your experience</li>
        <li>Communicate with you about your account and the Service</li>
        <li>Detect and prevent fraud, abuse, and security issues</li>
      </ul>

      <h3 className="font-semibold text-gray-800">3. Document Handling</h3>
      <p>
        Your uploaded documents are processed locally and in encrypted storage. We extract text, generate
        vector embeddings for retrieval, and store chunks of content to answer your questions. Your
        documents are <strong>never used to train AI models</strong> and are not shared with any third party.
        You may delete your documents at any time, and deletion is permanent.
      </p>

      <h3 className="font-semibold text-gray-800">4. Data Storage and Security</h3>
      <p>
        We use industry-standard encryption (AES-256) for data at rest and TLS 1.3 for data in transit.
        Your documents and data are stored in secure, access-controlled environments. We implement
        regular security audits and follow best practices for data protection.
      </p>

      <h3 className="font-semibold text-gray-800">5. Third-Party Services</h3>
      <p>We use the following third-party services:</p>
      <ul className="list-disc pl-5 space-y-1">
        <li><strong>Google OAuth:</strong> For authentication (sign-in with Google)</li>
        <li><strong>Razorpay:</strong> For payment processing (subscription billing)</li>
        <li><strong>AI/LLM Providers:</strong> For generating answers from retrieved content</li>
      </ul>
      <p>These services have their own privacy policies governing their use of your data.</p>

      <h3 className="font-semibold text-gray-800">6. Cookies</h3>
      <p>
        We use essential cookies for authentication and session management. We do not use advertising
        or tracking cookies. You can control cookie settings through your browser preferences.
      </p>

      <h3 className="font-semibold text-gray-800">7. Data Retention</h3>
      <p>
        We retain your account information and documents for as long as your account is active. If you
        delete your account, all associated data is permanently removed within 30 days. Usage analytics
        are retained in anonymized form for up to 12 months.
      </p>

      <h3 className="font-semibold text-gray-800">8. Your Rights</h3>
      <p>You have the right to:</p>
      <ul className="list-disc pl-5 space-y-1">
        <li>Access, correct, or delete your personal information</li>
        <li>Export your data in a machine-readable format</li>
        <li>Object to processing of your personal data</li>
        <li>Withdraw consent at any time</li>
        <li>Lodge a complaint with a supervisory authority</li>
      </ul>

      <h3 className="font-semibold text-gray-800">9. Children's Privacy</h3>
      <p>
        The Service is not intended for users under the age of 13. We do not knowingly collect
        information from children under 13. If we become aware of such collection, we will delete it.
      </p>

      <h3 className="font-semibold text-gray-800">10. Changes to This Policy</h3>
      <p>
        We may update this Privacy Policy from time to time. We will notify you of any material changes
        by posting the new policy on this page and updating the "Last updated" date.
      </p>

      <h3 className="font-semibold text-gray-800">11. Contact Us</h3>
      <p>
        For questions about this Privacy Policy, contact us at{' '}
        <span className="text-zinc-900 dark:text-zinc-100 font-semibold font-medium">privacy@askmydocs.com</span>.
      </p>
    </div>
  )
}
