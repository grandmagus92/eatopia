// app/admin/dashboard/page.tsx
'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Order, Product, SalesData } from '@/types'
import { TrendingUp, Users, Coffee, DollarSign, ShoppingCart, Clock, RefreshCw } from 'lucide-react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts'

export default function DashboardPage() {
  const [stats, setStats] = useState({
    totalRevenue: 0,
    totalOrders: 0,
    totalProducts: 0,
    averageOrderValue: 0,
    todayRevenue: 0,
    todayOrders: 0
  })
  const [recentOrders, setRecentOrders] = useState<Order[]>([])
  const [salesData, setSalesData] = useState<SalesData[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  useEffect(() => {
    fetchDashboardData()
  }, [])

  const fetchDashboardData = async () => {
    try {
      setLoading(true)
      
      // Fetch orders
      const { data: orders, error: ordersError } = await supabase
        .from('orders')
        .select('*')
        .order('created_at', { ascending: false })

      if (ordersError) throw ordersError

      // Fetch products
      const { data: products, error: productsError } = await supabase
        .from('products')
        .select('*')

      if (productsError) throw productsError

      // Calculate today's date
      const today = new Date().toISOString().split('T')[0]
      const todayOrders = orders?.filter(order => 
        order.created_at.split('T')[0] === today
      ) || []

      // Calculate statistics
      const totalRevenue = orders?.reduce((sum: number, order: Order) => sum + order.total_amount, 0) || 0
      const totalOrders = orders?.length || 0
      const totalProducts = products?.length || 0
      const averageOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0
      const todayRevenue = todayOrders.reduce((sum: number, order: Order) => sum + order.total_amount, 0)
      const todayOrdersCount = todayOrders.length

      setStats({
        totalRevenue,
        totalOrders,
        totalProducts,
        averageOrderValue,
        todayRevenue,
        todayOrders: todayOrdersCount
      })

      // Fetch recent orders dengan items
      const { data: recentOrdersData, error: recentOrdersError } = await supabase
        .from('orders')
        .select(`
          *,
          order_items(
            *,
            products(*)
          )
        `)
        .order('created_at', { ascending: false })
        .limit(5)

      if (recentOrdersError) throw recentOrdersError
      setRecentOrders(recentOrdersData || [])

      // Generate sales data untuk chart (last 7 days)
      const last7Days = generateLast7DaysSales(orders || [])
      setSalesData(last7Days)
    } catch (error) {
      console.error('Error fetching dashboard data:', error)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  const generateLast7DaysSales = (orders: Order[]): SalesData[] => {
    const days: SalesData[] = []
    for (let i = 6; i >= 0; i--) {
      const date = new Date()
      date.setDate(date.getDate() - i)
      const dateString = date.toISOString().split('T')[0]
      
      const dayOrders = orders.filter(order => 
        order.created_at.split('T')[0] === dateString
      )
      
      days.push({
        date: date.toLocaleDateString('id-ID', { weekday: 'short', day: 'numeric' }),
        revenue: dayOrders.reduce((sum: number, order: Order) => sum + order.total_amount, 0),
        orders: dayOrders.length
      })
    }
    return days
  }

  const handleRefresh = () => {
    setRefreshing(true)
    fetchDashboardData()
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

  return (
    <div className="space-y-4 lg:space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold text-amber-900">Dashboard</h1>
          <p className="text-amber-600 mt-1 text-sm lg:text-base">Ringkasan performa bisnis Anda</p>
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

      {/* Stats Grid - Lebih Responsive */}
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3 lg:gap-4">
        {/* Total Revenue */}
        <div className="bg-white rounded-xl shadow-sm border border-amber-100 p-3 lg:p-4 col-span-2 lg:col-span-1">
          <div className="flex items-center">
            <div className="p-2 bg-green-100 rounded-lg">
              <DollarSign className="h-4 w-4 lg:h-5 lg:w-5 text-green-600" />
            </div>
            <div className="ml-3 flex-1 min-w-0">
              <p className="text-xs font-medium text-gray-600 truncate">Total Revenue</p>
              <p className="text-lg lg:text-xl font-bold text-gray-900 truncate">
                Rp {stats.totalRevenue.toLocaleString('id-ID')}
              </p>
            </div>
          </div>
        </div>

        {/* Total Orders */}
        <div className="bg-white rounded-xl shadow-sm border border-amber-100 p-3 lg:p-4">
          <div className="flex items-center">
            <div className="p-2 bg-blue-100 rounded-lg">
              <ShoppingCart className="h-4 w-4 lg:h-5 lg:w-5 text-blue-600" />
            </div>
            <div className="ml-3 flex-1 min-w-0">
              <p className="text-xs font-medium text-gray-600 truncate">Total Orders</p>
              <p className="text-lg lg:text-xl font-bold text-gray-900">{stats.totalOrders}</p>
            </div>
          </div>
        </div>

        {/* Products */}
        <div className="bg-white rounded-xl shadow-sm border border-amber-100 p-3 lg:p-4">
          <div className="flex items-center">
            <div className="p-2 bg-amber-100 rounded-lg">
              <Coffee className="h-4 w-4 lg:h-5 lg:w-5 text-amber-600" />
            </div>
            <div className="ml-3 flex-1 min-w-0">
              <p className="text-xs font-medium text-gray-600 truncate">Products</p>
              <p className="text-lg lg:text-xl font-bold text-gray-900">{stats.totalProducts}</p>
            </div>
          </div>
        </div>

        {/* Average Order Value */}
        <div className="bg-white rounded-xl shadow-sm border border-amber-100 p-3 lg:p-4 col-span-2 lg:col-span-1">
          <div className="flex items-center">
            <div className="p-2 bg-purple-100 rounded-lg">
              <TrendingUp className="h-4 w-4 lg:h-5 lg:w-5 text-purple-600" />
            </div>
            <div className="ml-3 flex-1 min-w-0">
              <p className="text-xs font-medium text-gray-600 truncate">Avg Order</p>
              <p className="text-lg lg:text-xl font-bold text-gray-900 truncate">
                Rp {stats.averageOrderValue.toLocaleString('id-ID')}
              </p>
            </div>
          </div>
        </div>

        {/* Today's Revenue */}
        <div className="bg-white rounded-xl shadow-sm border border-amber-100 p-3 lg:p-4">
          <div className="flex items-center">
            <div className="p-2 bg-green-50 rounded-lg">
              <Clock className="h-4 w-4 lg:h-5 lg:w-5 text-green-500" />
            </div>
            <div className="ml-3 flex-1 min-w-0">
              <p className="text-xs font-medium text-gray-600 truncate">Today Revenue</p>
              <p className="text-lg lg:text-xl font-bold text-gray-900 truncate">
                Rp {stats.todayRevenue.toLocaleString('id-ID')}
              </p>
            </div>
          </div>
        </div>

        {/* Today's Orders */}
        <div className="bg-white rounded-xl shadow-sm border border-amber-100 p-3 lg:p-4">
          <div className="flex items-center">
            <div className="p-2 bg-blue-50 rounded-lg">
              <Users className="h-4 w-4 lg:h-5 lg:w-5 text-blue-500" />
            </div>
            <div className="ml-3 flex-1 min-w-0">
              <p className="text-xs font-medium text-gray-600 truncate">Today Orders</p>
              <p className="text-lg lg:text-xl font-bold text-gray-900">{stats.todayOrders}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Charts Grid - Layout Responsive */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 lg:gap-6">
        {/* Revenue Chart */}
        <div className="bg-white rounded-xl shadow-sm border border-amber-100 p-4 lg:p-6">
          <h3 className="text-base lg:text-lg font-semibold text-amber-900 mb-4">Revenue 7 Hari Terakhir</h3>
          <div className="h-64 lg:h-80">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={salesData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                <XAxis 
                  dataKey="date" 
                  fontSize={12}
                  tick={{ fill: '#6b7280' }}
                />
                <YAxis 
                  fontSize={12}
                  tick={{ fill: '#6b7280' }}
                  tickFormatter={(value) => `Rp${value / 1000}k`}
                />
                <Tooltip 
                  formatter={(value: number) => [`Rp ${Number(value).toLocaleString('id-ID')}`, 'Revenue']}
                  labelStyle={{ color: '#374151' }}
                  contentStyle={{ 
                    borderRadius: '8px',
                    border: '1px solid #e5e7eb',
                    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
                  }}
                />
                <Line 
                  type="monotone" 
                  dataKey="revenue" 
                  stroke="#d97706" 
                  strokeWidth={3}
                  dot={{ fill: '#d97706', strokeWidth: 2, r: 4 }}
                  activeDot={{ r: 6 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Orders Chart */}
        <div className="bg-white rounded-xl shadow-sm border border-amber-100 p-4 lg:p-6">
          <h3 className="text-base lg:text-lg font-semibold text-amber-900 mb-4">Orders 7 Hari Terakhir</h3>
          <div className="h-64 lg:h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={salesData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                <XAxis 
                  dataKey="date" 
                  fontSize={12}
                  tick={{ fill: '#6b7280' }}
                />
                <YAxis 
                  fontSize={12}
                  tick={{ fill: '#6b7280' }}
                />
                <Tooltip 
                  labelStyle={{ color: '#374151' }}
                  contentStyle={{ 
                    borderRadius: '8px',
                    border: '1px solid #e5e7eb',
                    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
                  }}
                />
                <Bar 
                  dataKey="orders" 
                  fill="#b45309" 
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Recent Orders - Full Width */}
      <div className="bg-white rounded-xl shadow-sm border border-amber-100">
        <div className="p-4 lg:p-6 border-b border-amber-100">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <h3 className="text-base lg:text-lg font-semibold text-amber-900">Order Terbaru</h3>
            <p className="text-sm text-amber-600">5 order terakhir</p>
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
                          hour: '2-digit', 
                          minute: '2-digit' 
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

// Import icon yang diperlukan
import { CheckCircle, XCircle } from 'lucide-react'