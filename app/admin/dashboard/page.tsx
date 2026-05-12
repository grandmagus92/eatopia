// app/admin/dashboard/page.tsx
'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Order, Product, SalesData } from '@/types'
import { TrendingUp, Users, Coffee, DollarSign, ShoppingCart, Clock, RefreshCw, CheckCircle, XCircle, Calendar } from 'lucide-react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts'

interface ExtendedSalesData extends SalesData {
  dateObj?: Date;
}

export default function DashboardPage() {
  const [stats, setStats] = useState({
    totalRevenue: 0,
    totalOrders: 0,
    totalProducts: 0,
    averageOrderValue: 0,
    todayRevenue: 0,
    todayOrders: 0,
    monthlyRevenue: 0,
    monthlyOrders: 0
  })
  const [recentOrders, setRecentOrders] = useState<Order[]>([])
  const [salesData, setSalesData] = useState<ExtendedSalesData[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [currentMonth, setCurrentMonth] = useState('')

  // Helper: format tanggal lokal ke string YYYY-MM-DD
  const toLocalDateString = (date: Date): string => {
    const y = date.getFullYear()
    const m = String(date.getMonth() + 1).padStart(2, '0')
    const d = String(date.getDate()).padStart(2, '0')
    return `${y}-${m}-${d}`
  }

  useEffect(() => {
    fetchDashboardData()

    const interval = setInterval(() => {
      const now = new Date()
      if (now.getHours() === 0 && now.getMinutes() === 0) {
        fetchDashboardData()
      }
    }, 60000)

    return () => clearInterval(interval)
  }, [])

  const fetchDashboardData = async () => {
    try {
      setLoading(true)

      const today = new Date()
      const todayStr = toLocalDateString(today)

      // Awal dan akhir hari ini (format string lokal, bukan ISO UTC)
      const todayStart = `${todayStr}T00:00:00`
      const todayEnd   = `${todayStr}T23:59:59`

      // Awal dan akhir bulan ini
      const monthStart = toLocalDateString(new Date(today.getFullYear(), today.getMonth(), 1))
      const monthEnd   = toLocalDateString(new Date(today.getFullYear(), today.getMonth() + 1, 0))
      const monthStartStr = `${monthStart}T00:00:00`
      const monthEndStr   = `${monthEnd}T23:59:59`

      const monthNames = [
        'Januari','Februari','Maret','April','Mei','Juni',
        'Juli','Agustus','September','Oktober','November','Desember'
      ]
      setCurrentMonth(`${monthNames[today.getMonth()]} ${today.getFullYear()}`)

      // ── Fetch semua orders (untuk total stats) ──────────────────────────
      const { data: allOrders, error: allOrdersError } = await supabase
        .from('orders')
        .select('id, total_amount, created_at, status')

      if (allOrdersError) {
        console.error('allOrders error:', allOrdersError)
        throw allOrdersError
      }

      // ── Fetch orders hari ini ───────────────────────────────────────────
      const { data: todayOrdersData, error: todayError } = await supabase
        .from('orders')
        .select('id, total_amount')
        .gte('created_at', todayStart)
        .lte('created_at', todayEnd)

      if (todayError) {
        console.error('todayOrders error:', todayError)
        throw todayError
      }

      // ── Fetch orders bulan ini ──────────────────────────────────────────
      const { data: monthOrdersData, error: monthError } = await supabase
        .from('orders')
        .select('id, total_amount')
        .gte('created_at', monthStartStr)
        .lte('created_at', monthEndStr)

      if (monthError) {
        console.error('monthOrders error:', monthError)
        throw monthError
      }

      // ── Fetch products ──────────────────────────────────────────────────
      const { data: products, error: productsError } = await supabase
        .from('products')
        .select('id')

      if (productsError) {
        console.error('products error:', productsError)
        throw productsError
      }

      // ── Hitung statistik ────────────────────────────────────────────────
      const totalRevenue    = allOrders?.reduce((s, o) => s + (o.total_amount ?? 0), 0) ?? 0
      const totalOrders     = allOrders?.length ?? 0
      const totalProducts   = products?.length ?? 0
      const averageOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0

      const todayRevenue    = todayOrdersData?.reduce((s, o) => s + (o.total_amount ?? 0), 0) ?? 0
      const todayOrdersCount = todayOrdersData?.length ?? 0

      const monthlyRevenue  = monthOrdersData?.reduce((s, o) => s + (o.total_amount ?? 0), 0) ?? 0
      const monthlyOrdersCount = monthOrdersData?.length ?? 0

      setStats({
        totalRevenue,
        totalOrders,
        totalProducts,
        averageOrderValue,
        todayRevenue,
        todayOrders: todayOrdersCount,
        monthlyRevenue,
        monthlyOrders: monthlyOrdersCount
      })

      // ── Fetch recent orders (5 terbaru) ─────────────────────────────────
      // Pisah query: ambil orders dulu, lalu order_items secara terpisah
      // agar join tidak gagal diam-diam
      const { data: recentOrdersRaw, error: recentError } = await supabase
        .from('orders')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(5)

      if (recentError) {
        console.error('recentOrders error:', recentError)
        throw recentError
      }

      // Ambil order_items untuk 5 order tersebut
      const orderIds = recentOrdersRaw?.map(o => o.id) ?? []
      let itemsByOrder: Record<string, any[]> = {}

      if (orderIds.length > 0) {
        const { data: itemsData, error: itemsError } = await supabase
          .from('order_items')
          .select('*, products(*)')
          .in('order_id', orderIds)

        if (itemsError) {
          console.error('order_items error:', itemsError)
          // Tidak throw — recent orders tetap tampil meski tanpa items
        } else {
          itemsData?.forEach(item => {
            if (!itemsByOrder[item.order_id]) itemsByOrder[item.order_id] = []
            itemsByOrder[item.order_id].push(item)
          })
        }
      }

      const recentWithItems = (recentOrdersRaw ?? []).map(order => ({
        ...order,
        order_items: itemsByOrder[order.id] ?? []
      }))

      setRecentOrders(recentWithItems)

      // ── Sales chart 7 hari terakhir ─────────────────────────────────────
      const last7Days = await generateLast7DaysSales()
      setSalesData(last7Days)

    } catch (error) {
      console.error('Error fetchDashboardData:', error)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  const generateLast7DaysSales = async (): Promise<ExtendedSalesData[]> => {
    const days: ExtendedSalesData[] = []

    // Ambil semua orders 7 hari terakhir dalam SATU query
    const today = new Date()
    const sevenDaysAgo = new Date(today)
    sevenDaysAgo.setDate(today.getDate() - 6)

    const rangeStart = `${toLocalDateString(sevenDaysAgo)}T00:00:00`
    const rangeEnd   = `${toLocalDateString(today)}T23:59:59`

    const { data: weekOrders, error } = await supabase
      .from('orders')
      .select('id, total_amount, created_at')
      .gte('created_at', rangeStart)
      .lte('created_at', rangeEnd)

    if (error) {
      console.error('generateLast7DaysSales error:', error)
      return []
    }

    // Kelompokkan per hari
    for (let i = 6; i >= 0; i--) {
      const date = new Date(today)
      date.setDate(today.getDate() - i)
      const dateStr = toLocalDateString(date)

      const dayOrders = (weekOrders ?? []).filter(o => {
        // Ambil bagian tanggal dari created_at (support ISO string atau date string)
        const orderDate = o.created_at?.substring(0, 10)
        return orderDate === dateStr
      })

      const revenue     = dayOrders.reduce((s, o) => s + (o.total_amount ?? 0), 0)
      const ordersCount = dayOrders.length

      days.push({
        date: date.toLocaleDateString('id-ID', {
          weekday: 'short',
          day: 'numeric',
          month: 'short'
        }),
        revenue,
        orders: ordersCount,
        dateObj: date
      })
    }

    return days.sort((a, b) =>
      (a.dateObj?.getTime() ?? 0) - (b.dateObj?.getTime() ?? 0)
    )
  }

  const handleRefresh = () => {
    setRefreshing(true)
    fetchDashboardData()
  }

  const getTodayInfo = () => {
    const today = new Date()
    return {
      date: today.toLocaleDateString('id-ID', {
        weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
      }),
      time: today.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-96">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-amber-600 mx-auto"></div>
          <p className="mt-4 text-amber-700">Memuat dashboard...</p>
        </div>
      </div>
    )
  }

  const todayInfo = getTodayInfo()

  return (
    <div className="space-y-4 lg:space-y-6 p-4 lg:p-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex-1">
          <h1 className="text-2xl lg:text-3xl font-bold text-amber-900">Dashboard</h1>
          <p className="text-amber-600 mt-1 text-sm lg:text-base">Ringkasan performa bisnis Anda</p>
          <div className="flex items-center space-x-2 mt-1">
            <Clock className="h-3 w-3 text-amber-500" />
            <span className="text-xs text-gray-500">
              Data hari ini: {todayInfo.date} • {todayInfo.time}
            </span>
          </div>
          {currentMonth && (
            <div className="flex items-center space-x-1 mt-1">
              <Calendar className="h-3 w-3 text-amber-500" />
              <span className="text-xs font-medium text-amber-700">
                Periode Bulan: {currentMonth}
              </span>
            </div>
          )}
        </div>
        <button
          onClick={handleRefresh}
          disabled={refreshing}
          className="bg-amber-600 text-white px-4 py-2 rounded-lg hover:bg-amber-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm lg:text-base flex items-center space-x-2 w-full sm:w-auto justify-center"
        >
          <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
          <span>{refreshing ? 'Memuat...' : 'Refresh'}</span>
        </button>
      </div>

      {/* Monthly Performance Banner */}
      <div className="bg-linear-to-r from-amber-500 to-amber-600 rounded-xl p-4 lg:p-6 text-white">
        <div className="flex flex-col items-center lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="flex items-center space-x-2">
              <Clock className="h-5 w-5 text-white" />
              <h2 className="text-lg lg:text-xl font-bold">Performa Hari Ini</h2>
            </div>
            <p className="text-white text-sm lg:text-base mt-1">{todayInfo.date}</p>
          </div>
          <div className="flex items-center space-x-4 lg:space-x-6 mt-3 lg:mt-0">
            <div className="text-center">
              <p className="text-white text-xs lg:text-sm">Pendapatan</p>
              <p className="text-lg lg:text-2xl font-bold">
                Rp {stats.todayRevenue.toLocaleString('id-ID')}
              </p>
            </div>
            <div className="h-8 w-px bg-white"></div>
            <div className="text-center">
              <p className="text-white text-xs lg:text-sm">Order</p>
              <p className="text-lg lg:text-2xl font-bold">{stats.todayOrders}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3 lg:gap-4">
        <div className="bg-white rounded-xl shadow-sm border border-amber-100 p-3 lg:p-4 col-span-2 lg:col-span-2">
          <div className="flex items-center">
            <div className="p-2 bg-amber-100 rounded-lg">
              <Calendar className="h-4 w-4 lg:h-5 lg:w-5 text-amber-600" />
            </div>
            <div className="ml-3 flex-1 min-w-0">
              <p className="text-xs font-medium text-gray-600 truncate">Monthly Revenue</p>
              <p className="text-lg lg:text-xl font-bold text-gray-900 truncate">
                Rp {stats.monthlyRevenue.toLocaleString('id-ID')}
              </p>
              <p className="text-xs text-gray-500 mt-0.5">{currentMonth}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-amber-100 p-3 lg:p-4">
          <div className="flex items-center">
            <div className="p-2 bg-amber-50 rounded-lg">
              <ShoppingCart className="h-4 w-4 lg:h-5 lg:w-5 text-amber-500" />
            </div>
            <div className="ml-3 flex-1 min-w-0">
              <p className="text-xs font-medium text-gray-600 truncate">Monthly Orders</p>
              <p className="text-lg lg:text-xl font-bold text-gray-900">{stats.monthlyOrders}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-3 lg:p-4">
          <div className="flex items-center">
            <div className="p-2 bg-gray-50 rounded-lg">
              <ShoppingCart className="h-4 w-4 lg:h-5 lg:w-5 text-gray-500" />
            </div>
            <div className="ml-3 flex-1 min-w-0">
              <p className="text-xs font-medium text-gray-600 truncate">Total Orders</p>
              <p className="text-lg lg:text-xl font-bold text-gray-900">{stats.totalOrders}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-amber-100 p-3 lg:p-4 hidden xl:block">
          <div className="flex items-center">
            <div className="p-2 bg-green-100 rounded-lg">
              <Coffee className="h-4 w-4 lg:h-5 lg:w-5 text-green-600" />
            </div>
            <div className="ml-3 flex-1 min-w-0">
              <p className="text-xs font-medium text-gray-600 truncate">Products</p>
              <p className="text-lg lg:text-xl font-bold text-gray-900">{stats.totalProducts}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-purple-100 p-3 lg:p-4 col-span-2 lg:col-span-1">
          <div className="flex items-center">
            <div className="p-2 bg-purple-100 rounded-lg">
              <TrendingUp className="h-4 w-4 lg:h-5 lg:w-5 text-purple-600" />
            </div>
            <div className="ml-3 flex-1 min-w-0">
              <p className="text-xs font-medium text-gray-600 truncate">Avg Order</p>
              <p className="text-lg lg:text-xl font-bold text-gray-900 truncate">
                Rp {Math.round(stats.averageOrderValue).toLocaleString('id-ID')}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 lg:gap-6">
        <div className="bg-white rounded-xl shadow-sm border border-amber-100 p-4 lg:p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base lg:text-lg font-semibold text-amber-900">Revenue 7 Hari Terakhir</h3>
            <div className="text-xs text-gray-500">{todayInfo.date}</div>
          </div>
          <div className="h-64 lg:h-80">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={salesData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                <XAxis dataKey="date" fontSize={12} tick={{ fill: '#6b7280' }} />
                <YAxis
                  fontSize={12}
                  tick={{ fill: '#6b7280' }}
                  tickFormatter={(v) => `Rp${v / 1000}k`}
                />
                <Tooltip
                  formatter={(value: number) => [`Rp ${Number(value).toLocaleString('id-ID')}`, 'Revenue']}
                  labelStyle={{ color: '#374151' }}
                  contentStyle={{ borderRadius: '8px', border: '1px solid #e5e7eb', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' }}
                />
                <Line type="monotone" dataKey="revenue" stroke="#d97706" strokeWidth={3}
                  dot={{ fill: '#d97706', strokeWidth: 2, r: 4 }} activeDot={{ r: 6 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-amber-100 p-4 lg:p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base lg:text-lg font-semibold text-amber-900">Orders 7 Hari Terakhir</h3>
            <div className="text-xs text-gray-500">{currentMonth}</div>
          </div>
          <div className="h-64 lg:h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={salesData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                <XAxis dataKey="date" fontSize={12} tick={{ fill: '#6b7280' }} />
                <YAxis fontSize={12} tick={{ fill: '#6b7280' }} />
                <Tooltip
                  labelStyle={{ color: '#374151' }}
                  contentStyle={{ borderRadius: '8px', border: '1px solid #e5e7eb', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' }}
                />
                <Bar dataKey="orders" fill="#b45309" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Recent Orders */}
      <div className="bg-white rounded-xl shadow-sm border border-amber-100">
        <div className="p-4 lg:p-6 border-b border-amber-100">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <h3 className="text-base lg:text-lg font-semibold text-amber-900">Order Terbaru</h3>
            <div className="flex items-center space-x-2">
              <p className="text-sm text-amber-600">5 order terakhir</p>
              <div className="text-xs px-2 py-1 bg-amber-100 text-amber-800 rounded">{currentMonth}</div>
            </div>
          </div>
        </div>
        <div className="p-4 lg:p-6">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[600px]">
              <thead>
                <tr className="border-b border-amber-100">
                  <th className="text-left py-3 px-2 lg:px-4 text-xs lg:text-sm font-medium text-gray-600">Order #</th>
                  <th className="text-left py-3 px-2 lg:px-4 text-xs lg:text-sm font-medium text-gray-600">Pelanggan</th>
                  <th className="text-left py-3 px-2 lg:px-4 text-xs lg:text-sm font-medium text-gray-600">Amount</th>
                  <th className="text-left py-3 px-2 lg:px-4 text-xs lg:text-sm font-medium text-gray-600">Status</th>
                  <th className="text-left py-3 px-2 lg:px-4 text-xs lg:text-sm font-medium text-gray-600">Tanggal</th>
                </tr>
              </thead>
              <tbody>
                {recentOrders.map((order) => (
                  <tr key={order.id} className="border-b border-amber-50 last:border-0 hover:bg-amber-50">
                    <td className="py-3 px-2 lg:px-4">
                      <div className="text-xs lg:text-sm font-medium text-gray-900">{order.order_number}</div>
                    </td>
                    <td className="py-3 px-2 lg:px-4">
                      <div className="text-xs lg:text-sm text-gray-900">
                        {order.customer_name || 'Walk-in Customer'}
                      </div>
                      {order.customer_phone && (
                        <div className="text-xs text-gray-500">{order.customer_phone}</div>
                      )}
                    </td>
                    <td className="py-3 px-2 lg:px-4">
                      <div className="text-xs lg:text-sm font-semibold text-gray-900">
                        Rp {order.total_amount.toLocaleString('id-ID')}
                      </div>
                    </td>
                    <td className="py-3 px-2 lg:px-4">
                      <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs ${
                        order.status === 'completed'
                          ? 'bg-green-100 text-green-800'
                          : order.status === 'processing'
                          ? 'bg-blue-100 text-blue-800'
                          : order.status === 'pending'
                          ? 'bg-yellow-100 text-yellow-800'
                          : 'bg-red-100 text-red-800'
                      }`}>
                        {order.status === 'processing' && <RefreshCw className="h-3 w-3 mr-1 animate-spin" />}
                        {order.status === 'completed' && <CheckCircle className="h-3 w-3 mr-1" />}
                        {order.status === 'pending' && <Clock className="h-3 w-3 mr-1" />}
                        {order.status === 'cancelled' && <XCircle className="h-3 w-3 mr-1" />}
                        <span className="capitalize">{order.status}</span>
                      </span>
                    </td>
                    <td className="py-3 px-2 lg:px-4">
                      <div className="text-xs lg:text-sm text-gray-900">
                        {new Date(order.created_at).toLocaleDateString('id-ID')}
                      </div>
                      <div className="text-xs text-gray-500">
                        {new Date(order.created_at).toLocaleTimeString('id-ID', {
                          hour: '2-digit', minute: '2-digit'
                        })}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {recentOrders.length === 0 && (
            <div className="text-center py-8 text-gray-500">
              <ShoppingCart className="h-12 w-12 mx-auto text-gray-300 mb-2" />
              <p className="text-sm">Belum ada order</p>
            </div>
          )}

          {recentOrders.length > 0 && (
            <div className="mt-4 flex justify-center">
              <button
                onClick={() => window.location.href = '/admin/orders'}
                className="text-amber-600 hover:text-amber-700 text-sm font-medium flex items-center space-x-1"
              >
                <span>Lihat Semua Order</span>
                <TrendingUp className="h-4 w-4" />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
