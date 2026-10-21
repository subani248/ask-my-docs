import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from 'react'
import {
  apiGetMe,
  apiLogin,
  apiRegister,
  apiLogout,
  apiGoogleAuth,
  apiUpdateProfile,
  type User,
} from '../services/api'

interface AuthContextType {
  user: User | null
  isAuthenticated: boolean
  isLoading: boolean
  login: (email: string, password: string) => Promise<void>
  register: (fullName: string, email: string, password: string) => Promise<void>
  googleAuth: (credential: string) => Promise<void>
  updateProfile: (fullName: string) => Promise<void>
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  // On mount, check if already authenticated
  useEffect(() => {
    let cancelled = false
    apiGetMe()
      .then((u) => {
        if (!cancelled) setUser(u)
      })
      .catch(() => {
        if (!cancelled) setUser(null)
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const login = useCallback(async (email: string, password: string) => {
    const res = await apiLogin(email, password)
    setUser(res.user)
  }, [])

  const register = useCallback(
    async (fullName: string, email: string, password: string) => {
      const res = await apiRegister(fullName, email, password)
      setUser(res.user)
    },
    []
  )

  const googleAuth = useCallback(async (credential: string) => {
    const res = await apiGoogleAuth(credential)
    setUser(res.user)
  }, [])

  const updateProfile = useCallback(async (fullName: string) => {
    const updated = await apiUpdateProfile(fullName)
    setUser(updated)
  }, [])

  const logout = useCallback(async () => {
    await apiLogout()
    setUser(null)
  }, [])

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        isLoading,
        login,
        register,
        googleAuth,
        updateProfile,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth(): AuthContextType {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
