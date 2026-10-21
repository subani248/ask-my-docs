import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import {
  apiCreateRazorpayOrder,
  apiVerifyRazorpayPayment,
} from '../services/api'

// Extend Window to include Razorpay
declare global {
  interface Window {
    Razorpay: new (options: RazorpayOptions) => RazorpayInstance
  }
}

interface RazorpayOptions {
  key: string
  amount: number
  currency: string
  name: string
  description: string
  order_id: string
  handler: (response: RazorpayCallbackResponse) => void
  prefill?: { name?: string; email?: string; contact?: string }
  theme?: { color?: string }
  modal?: { ondismiss?: () => void }
}

interface RazorpayInstance {
  open: () => void
  close: () => void
}

interface RazorpayCallbackResponse {
  razorpay_order_id: string
  razorpay_payment_id: string
  razorpay_signature: string
}

const PLANS = [
  {
    name: 'Free',
    price: '$0',
    period: 'forever',
    amount: 0,
    planId: 'free',
    description: 'Perfect for trying out Ask My Docs.',
    features: [
      '5 document uploads',
      '100 questions / month',
      'Basic retrieval',
      'Community support',
    ],
    cta: 'Get Started',
    highlight: false,
  },
  {
    name: 'Pro',
    price: '₹499',
    period: '/month',
    amount: 49900, // in paise
    planId: 'pro_monthly',
    description: 'For professionals who need reliable document intelligence.',
    features: [
      'Unlimited document uploads',
      'Unlimited questions',
      'Hybrid retrieval + reranking',
      'Citation-backed answers',
      'Priority support',
      'API access',
    ],
    cta: 'Start Free Trial',
    highlight: true,
  },
  {
    name: 'Enterprise',
    price: 'Custom',
    period: '',
    amount: 0,
    planId: 'enterprise',
    description: 'For teams that need security, scale, and control.',
    features: [
      'Everything in Pro',
      'Multi-tenant isolation',
      'SSO / SAML',
      'Custom models',
      'Dedicated support',
      'SLA guarantee',
      'On-premise deployment',
    ],
    cta: 'Contact Sales',
    highlight: false,
  },
]

export default function Pricing() {
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null)
  const { isAuthenticated } = useAuth()
  const navigate = useNavigate()

  // Load Razorpay script on mount
  useEffect(() => {
    const script = document.createElement('script')
    script.src = 'https://checkout.razorpay.com/v1/checkout.js'
    script.async = true
    document.body.appendChild(script)
    return () => {
      document.body.removeChild(script)
    }
  }, [])

  // Auto-resume checkout after login redirect
  useEffect(() => {
    const pendingPlanId = sessionStorage.getItem('pendingRazorpayPlan')
    if (pendingPlanId && isAuthenticated) {
      sessionStorage.removeItem('pendingRazorpayPlan')
      const plan = PLANS.find((p) => p.planId === pendingPlanId)
      if (plan) {
        // Trigger checkout on next tick so state is settled
        setTimeout(() => initiatePayment(plan), 100)
      }
    }
  }, [isAuthenticated]) // eslint-disable-line react-hooks/exhaustive-deps

  const handlePayment = async (plan: typeof PLANS[number]) => {
    // Free plan — redirect to register
    if (plan.planId === 'free') {
      navigate('/register')
      return
    }

    // Enterprise — contact sales (mailto)
    if (plan.planId === 'enterprise') {
      window.location.href = 'mailto:sales@askmydocs.com?subject=Enterprise Plan Inquiry'
      return
    }

    // Paid plan — check auth first
    if (!isAuthenticated) {
      sessionStorage.setItem('pendingRazorpayPlan', plan.planId)
      navigate('/login')
      return
    }

    await initiatePayment(plan)
  }

  const initiatePayment = async (plan: typeof PLANS[number]) => {

    setLoadingPlan(plan.planId)

    try {
      const order = await apiCreateRazorpayOrder(plan.planId, plan.amount)

      const options: RazorpayOptions = {
        key: order.razorpay_key_id,
        amount: order.amount,
        currency: order.currency,
        name: 'Ask My Docs',
        description: `${plan.name} Plan Subscription`,
        order_id: order.order_id,
        handler: async (response: RazorpayCallbackResponse) => {
          try {
            await apiVerifyRazorpayPayment(
              response.razorpay_order_id,
              response.razorpay_payment_id,
              response.razorpay_signature,
              plan.planId
            )
            alert('Payment successful! Your subscription is now active.')
            navigate('/dashboard')
          } catch (err) {
            console.error('Payment verification failed:', err)
            alert('Payment received but verification failed. Please contact support.')
          }
        },
        theme: {
          color: '#9333ea',
        },
        modal: {
          ondismiss: () => {
            setLoadingPlan(null)
          },
        },
      }

      const rzp = new window.Razorpay(options)
      rzp.open()
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error'
      console.error('Failed to create order:', err)
      if (message.includes('not configured')) {
        alert('Payment system is not configured. Please contact support.')
      } else if (message.includes('Not authenticated') || message.includes('401')) {
        alert('Please sign in to continue with payment.')
        navigate('/login')
      } else {
        alert(`Payment failed: ${message}`)
      }
    } finally {
      setLoadingPlan(null)
    }
  }

  return (
    <div className="min-h-screen  text-zinc-900 dark:text-white">
      <nav className="mx-auto flex max-w-7xl items-center justify-between px-6 py-5">
        <Link to="/" className="flex items-center gap-2 text-xl font-bold tracking-tight">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-zinc-100 dark:bg-zinc-800 text-lg">
            💬
          </span>
          Ask My Docs
        </Link>
        <div className="flex items-center gap-3">
          <Link to="/login" className="text-sm font-medium text-gray-300 hover:text-zinc-900 dark:text-white transition-colors px-4 py-2">
            Sign In
          </Link>
          <Link
            to="/register"
            className="inline-flex items-center gap-2 rounded-full bg-zinc-900 text-zinc-900 dark:text-white hover:bg-zinc-800 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-100 px-5 py-2.5 text-sm font-semibold text-zinc-900 dark:text-white shadow-lg shadow-purple-500/25 hover:from-purple-500 hover:to-purple-400 transition-all"
          >
            ✨ Get Started
          </Link>
        </div>
      </nav>

      <section className="mx-auto max-w-6xl px-6 py-20">
        <h1 className="text-center text-4xl font-bold md:text-5xl">Simple Pricing</h1>
        <p className="mx-auto mt-4 max-w-xl text-center text-zinc-500">
          Start free. Scale when you need to.
        </p>

        <div className="mt-16 grid gap-8 lg:grid-cols-3">
          {PLANS.map((plan) => (
            <div
              key={plan.name}
              className={`relative rounded-2xl p-8 transition-all ${
                plan.highlight
                  ? 'border-2 border-zinc-200 dark:border-zinc-800 bg-purple-500/5 shadow-lg shadow-purple-500/10'
                  : 'border border-white/5 bg-white/[0.02]'
              }`}
            >
              {plan.highlight && (
                <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 rounded-full bg-zinc-900 text-zinc-900 dark:text-white hover:bg-zinc-800 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-100 px-4 py-1 text-xs font-semibold text-zinc-900 dark:text-white">
                  Most Popular
                </div>
              )}

              <h3 className="text-xl font-semibold text-zinc-900 dark:text-white">{plan.name}</h3>

              <div className="mt-4 flex items-baseline gap-1">
                <span className="text-4xl font-extrabold text-zinc-900 dark:text-white">{plan.price}</span>
                {plan.period && (
                  <span className="text-sm text-zinc-500">{plan.period}</span>
                )}
              </div>

              <p className="mt-3 text-sm text-zinc-500">{plan.description}</p>

              <ul className="mt-6 space-y-3">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-sm text-gray-300">
                    <svg className="mt-0.5 h-4 w-4 flex-shrink-0 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                    {f}
                  </li>
                ))}
              </ul>

              <button
                onClick={() => handlePayment(plan)}
                disabled={loadingPlan === plan.planId}
                className={`mt-8 block w-full rounded-full py-3 text-center text-sm font-semibold transition-all ${
                  plan.highlight
                    ? 'bg-zinc-900 text-zinc-900 dark:text-white hover:bg-zinc-800 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-100 text-zinc-900 dark:text-white shadow-lg shadow-purple-500/25 hover:from-purple-500 hover:to-purple-400'
                    : 'border border-white/10 bg-white/5 text-zinc-900 dark:text-white hover:bg-white/10'
                } ${loadingPlan === plan.planId ? 'cursor-not-allowed opacity-60' : ''}`}
              >
                {loadingPlan === plan.planId ? (
                  <span className="inline-flex items-center gap-2">
                    <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Processing...
                  </span>
                ) : (
                  plan.cta
                )}
              </button>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}
