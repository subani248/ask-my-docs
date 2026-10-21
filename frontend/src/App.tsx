import { RouterProvider } from 'react-router-dom'
import { Agentation } from 'agentation'
import { AuthProvider } from './context/AuthContext'
import { ThemeProvider } from './context/ThemeContext'
import { router } from './routes'

function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <RouterProvider router={router} />
        {import.meta.env.DEV && <Agentation />}
      </AuthProvider>
    </ThemeProvider>
  )
}

export default App
