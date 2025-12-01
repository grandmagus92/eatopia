// app/admin/layout.tsx
'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Coffee, Home, BarChart3, Package, LogOut, PieChart, Menu, X, ShoppingCart } from 'lucide-react'
import { isAuthenticated, logout } from '@/utils/auth'

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const [isAuth, setIsAuth] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)
  const router = useRouter()
  const pathname = usePathname()

  useEffect(() => {
    const checkAuth = () => {
      if (!isAuthenticated()) {
        router.push('/login')
      } else {
        setIsAuth(true)
      }
      setIsLoading(false)
    }

    checkAuth()
  }, [router])

  useEffect(() => {
    // Close sidebar on route change (mobile)
    setIsSidebarOpen(false)
  }, [pathname])

  const handleLogout = () => {
    logout()
  }

  const navigation = [
    { name: 'Dashboard', href: '/admin/dashboard', icon: Home },
    { name: 'Pemesanan', href: '/admin/orders', icon: ShoppingCart },
    { name: 'Produk', href: '/admin/products', icon: Package },
    { name: 'Laporan', href: '/admin/reports', icon: PieChart },
    
  ]

  if (isLoading) {
    return (
      <div className="min-h-screen bg-amber-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-amber-600 mx-auto"></div>
          <p className="mt-4 text-amber-700">Memuat...</p>
        </div>
      </div>
    )
  }

  if (!isAuth) {
    return null
  }

  return (
    <div className="flex h-screen bg-amber-50">
      {/* Mobile Overlay */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <div className={`
        fixed lg:static inset-y-0 left-0 z-50
        w-64 bg-amber-800 text-white flex flex-col transform transition-transform duration-300 ease-in-out
        ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
      `}>
        {/* Header */}
        <div className="p-4 lg:p-6 border-b border-amber-700">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <Coffee className="h-6 w-6 lg:h-8 lg:w-8" />
              <div>
                <h1 className="text-lg lg:text-xl font-bold">Eatopia Coffe</h1>
                <p className="text-amber-200 text-xs lg:text-sm">Admin Panel</p>
              </div>
            </div>
            <button
              onClick={() => setIsSidebarOpen(false)}
              className="lg:hidden text-amber-200 hover:text-white"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>
        
        {/* Navigation */}
        <nav className="flex-1 p-4 overflow-y-auto">
          <div className="space-y-2">
            {navigation.map((item) => {
              const Icon = item.icon
              const isActive = pathname === item.href
              
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  className={`flex items-center px-3 py-3 lg:px-4 lg:py-3 rounded-lg transition-colors ${
                    isActive
                      ? 'bg-amber-700 text-white'
                      : 'text-amber-100 hover:bg-amber-700/50'
                  }`}
                >
                  <Icon className="h-5 w-5 mr-3" />
                  <span className="text-sm lg:text-base">{item.name}</span>
                </Link>
              )
            })}
          </div>
        </nav>
        
        {/* Footer */}
        <div className="p-4 border-t border-amber-700">
          <button
            onClick={handleLogout}
            className="flex items-center w-full px-3 py-3 text-amber-100 hover:bg-amber-700 rounded-lg transition-colors"
          >
            <LogOut className="h-5 w-5 mr-3" />
            <span className="text-sm lg:text-base">Logout</span>
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        {/* Top Bar */}
        <header className="bg-white shadow-sm border-b border-amber-200">
          <div className="flex items-center justify-between px-4 lg:px-6 py-4">
            <div className="flex items-center space-x-4">
              <button
                onClick={() => setIsSidebarOpen(true)}
                className="lg:hidden text-amber-600 hover:text-amber-700"
              >
                <Menu className="h-6 w-6" />
              </button>
              <div>
                <h2 className="text-lg lg:text-xl font-semibold text-amber-900">
                  {navigation.find(item => item.href === pathname)?.name || 'Dashboard'}
                </h2>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-auto p-4 lg:p-8">
          {children}
        </main>
      </div>
    </div>
  )
}
