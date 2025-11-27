// app/login/page.tsx
'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { verifyAdmin } from '@/utils/auth'
import { Coffee, Eye, EyeOff, Lock, User, ArrowRight, Sparkles } from 'lucide-react'

export default function LoginPage() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [isMounted, setIsMounted] = useState(false)
  const router = useRouter()

  useEffect(() => {
    setIsMounted(true)
    
    // Cek jika sudah login
    const isLoggedIn = localStorage.getItem('adminAuth')
    if (isLoggedIn) {
      router.push('/admin/dashboard')
    }
  }, [router])

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      // Trim inputs to remove any accidental spaces
      const trimmedUsername = username.trim()
      const trimmedPassword = password.trim()
      
      if (verifyAdmin(trimmedUsername, trimmedPassword)) {
        localStorage.setItem('adminAuth', 'true')
        
        // Tambahkan delay untuk feedback visual
        await new Promise(resolve => setTimeout(resolve, 500))
        router.push('/admin/dashboard')
      } else {
        setError('Username atau password salah!!!')
      }
    } catch (err) {
      setError('Terjadi kesalahan saat login')
    } finally {
      setLoading(false)
    }
  }

  // Auto-fill for testing
  const fillDemoCredentials = () => {
    setUsername('')
    setPassword('')
    setError('')
  }

  // Reset form
  const resetForm = () => {
    setUsername('')
    setPassword('')
    setError('')
  }

  if (!isMounted) {
    return (
      <div className="min-h-screen bg-linear-to-br from-amber-50 via-orange-50 to-rose-50 flex items-center justify-center p-4">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-amber-600 mx-auto"></div>
          <p className="mt-4 text-amber-700">Memuat...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-linear-to-br from-amber-50 via-orange-50 to-rose-50 flex items-center justify-center p-4 relative overflow-hidden">
      {/* Background Decorations */}
      <div className="absolute inset-0 overflow-hidden">
        {/* Animated Coffee Beans */}
        <div className="absolute top-10 left-10 w-4 h-4 bg-amber-600 rounded-full opacity-20 animate-bounce"></div>
        <div className="absolute top-20 right-20 w-3 h-3 bg-amber-500 rounded-full opacity-30 animate-bounce delay-75"></div>
        <div className="absolute bottom-20 left-20 w-5 h-5 bg-amber-400 rounded-full opacity-25 animate-bounce delay-150"></div>
        <div className="absolute bottom-10 right-10 w-4 h-4 bg-amber-300 rounded-full opacity-20 animate-bounce delay-300"></div>
        
        {/* Floating Shapes */}
        <div className="absolute top-1/4 left-1/4 w-8 h-8 border-2 border-amber-200 rounded-lg rotate-45 animate-pulse"></div>
        <div className="absolute bottom-1/3 right-1/3 w-6 h-6 border-2 border-amber-300 rounded-full animate-pulse delay-1000"></div>
      </div>

      {/* Main Login Card */}
      <div className="max-w-md w-full bg-white/95 backdrop-blur-sm rounded-3xl shadow-2xl overflow-hidden transform transition-all duration-500 hover:shadow-3xl relative z-10">
        {/* Header dengan linear */}
        <div className="bg-linear-to-r from-amber-600 via-orange-500 to-orange-200 p-8 text-center relative overflow-hidden">
          {/* Sparkle Effect */}
          <div className="absolute top-4 right-4">
            <Sparkles className="h-6 w-6 text-white/80 animate-pulse" />
          </div>
          
          <div className="relative z-10">
            <div className="flex items-center justify-center space-x-3 mb-4">
              <div className="relative">
                <Coffee className="h-10 w-10 text-white animate-bounce" />
                <div className="absolute -top-1 -right-1 w-3 h-3 bg-rose-300 rounded-full animate-ping"></div>
              </div>
              <h1 className="text-3xl font-bold text-white">Coffee POS</h1>
            </div>
            <p className="text-amber-100 text-lg">Admin Dashboard</p>
            <div className="mt-4 flex items-center justify-center space-x-2 text-amber-200">
              <div className="w-2 h-2 bg-current rounded-full animate-pulse"></div>
              <span className="text-sm">Sistem Manajemen Kedai Kopi</span>
              <div className="w-2 h-2 bg-current rounded-full animate-pulse delay-300"></div>
            </div>
          </div>
          
          {/* linear Overlay */}
          <div className="absolute inset-0 bg-linear-to-t from-black/10 to-transparent"></div>
        </div>
        
        {/* Login Form */}
        <div className="p-8">
          <form onSubmit={handleLogin} className="space-y-6">
            {/* Username Field */}
            <div className="group">
              <label className="text-sm font-medium text-gray-700 mb-3 flex items-center">
                <User className="h-4 w-4 mr-2 text-amber-600" />
                Username
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full px-4 py-4 pl-12 border-2 text-black border-gray-200 rounded-xl focus:outline-none focus:border-amber-500 focus:ring-4 focus:ring-amber-100 transition-all duration-300 bg-white/80 backdrop-blur-sm group-hover:border-amber-300"
                  placeholder="Masukkan username Anda"
                  required
                  disabled={loading}
                />
                <User className="absolute left-4 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400 group-focus-within:text-amber-600 transition-colors" />
              </div>
            </div>
            
            {/* Password Field */}
            <div className="group">
              <label className=" text-sm font-medium text-gray-700 mb-3 flex items-center">
                <Lock className="h-4 w-4 mr-2 text-amber-600" />
                Password
              </label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-4 py-4 pl-12 pr-12 text-black border-2 border-gray-200 rounded-xl focus:outline-none focus:border-amber-500 focus:ring-4 focus:ring-amber-100 transition-all duration-300 bg-white/80 backdrop-blur-sm group-hover:border-amber-300"
                  placeholder="Masukkan password Anda"
                  required
                  disabled={loading}
                />
                <Lock className="absolute left-4 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400 group-focus-within:text-amber-600 transition-colors" />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-amber-600 transition-colors p-1"
                  disabled={loading}
                >
                  {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
            </div>
            
            {/* Error Message */}
            {error && (
              <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded-lg animate-shake">
                <div className="flex items-center">
                  <div className="shrink-0">
                    <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <div className="ml-3">
                    <p className="text-sm text-red-700">{error}</p>
                  </div>
                </div>
              </div>
            )}
            
            {/* Action Buttons */}
            <div className="flex flex-col space-y-4">
              <button
                type="submit"
                disabled={loading || !username || !password}
                className="w-full bg-linear-to-r from-amber-600 to-orange-600 text-white py-4 px-6 rounded-xl hover:from-amber-700 hover:to-orange-700 focus:outline-none focus:ring-4 focus:ring-amber-100 transform transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none hover:scale-105 active:scale-95 flex items-center justify-center space-x-3 font-semibold shadow-lg"
              >
                {loading ? (
                  <>
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                    <span>Memproses...</span>
                  </>
                ) : (
                  <>
                    <span>Masuk ke Dashboard</span>
                    <ArrowRight className="h-5 w-5" />
                  </>
                )}
              </button>

              
            </div>
          </form>
        </div>

        {/* Footer */}
        <div className="bg-gray-50 px-8 py-4 border-t border-gray-200">
          <div className="text-center text-xs text-gray-500">
            <p>© 2024 Coffee POS - Sistem Manajemen Kedai Kopi</p>
            <p className="mt-1">Secure Admin Access</p>
          </div>
        </div>
      </div>

      {/* Floating Action Button untuk Mobile */}
      <div className="fixed bottom-6 right-6 lg:hidden">
        <button
          onClick={fillDemoCredentials}
          className="bg-amber-500 text-white p-3 rounded-full shadow-lg hover:bg-amber-600 transition-colors animate-bounce"
          title="Isi Demo Credentials"
        >
          <User className="h-6 w-6" />
        </button>
      </div>

      {/* Background Pattern */}
      <div className="absolute inset-0 opacity-5">
        <div className="absolute inset-0" style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23d97706' fill-opacity='0.2'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
        }}></div>
      </div>
    </div>
  )
}