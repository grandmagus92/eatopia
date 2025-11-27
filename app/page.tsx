'use client'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'
import { Coffee, ArrowRight, BarChart3, Package, Users } from 'lucide-react'
import LoginPage from './login/page'

export default function HomePage() {
  const router = useRouter()

  useEffect(() => {
    // Cek apakah user sudah login
    const isLoggedIn = localStorage.getItem('adminAuth')
    if (isLoggedIn) {
      router.push('/admin/dashboard')
    }
  }, [router])

  const handleLoginRedirect = () => {
    router.push('/login')
  }

  const features = [
    {
      icon: <BarChart3 className="h-8 w-8" />,
      title: 'Dashboard Real-time',
      description: 'Monitor penjualan dan performa bisnis secara real-time'
    },
    {
      icon: <Package className="h-8 w-8" />,
      title: 'Manajemen Produk',
      description: 'Kelola menu kopi dan produk dengan mudah'
    },
    {
      icon: <Users className="h-8 w-8" />,
      title: 'Laporan Lengkap',
      description: 'Analisis penjualan mingguan dan bulanan'
    }
  ]

  return (
    <div className="min-h-screen bg-linear-to-br from-amber-50 to-amber-100">
      <LoginPage/>
    </div>
  )
}