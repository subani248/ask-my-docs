import { createContext, useContext, useState, useEffect, type ReactNode } from 'react'
import { healthCheck } from '../services/api'

interface ApiContextType {
  isBackendHealthy: boolean | null
  isLoading: boolean
}

const ApiContext = createContext<ApiContextType>({
  isBackendHealthy: null,
  isLoading: true,
})

export function ApiProvider({ children }: { children: ReactNode }) {
  const [isBackendHealthy, setIsBackendHealthy] = useState<boolean | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const checkHealth = async () => {
      try {
        await healthCheck()
        setIsBackendHealthy(true)
      } catch {
        setIsBackendHealthy(false)
      } finally {
        setIsLoading(false)
      }
    }
    checkHealth()
  }, [])

  return (
    <ApiContext.Provider value={{ isBackendHealthy, isLoading }}>
      {children}
    </ApiContext.Provider>
  )
}

export function useApi() {
  return useContext(ApiContext)
}
