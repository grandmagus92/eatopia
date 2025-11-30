'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Order, Product, OrderItem } from '@/types'
import {
  Plus,
  Search,
  ShoppingCart,
  Clock,
  CheckCircle,
  XCircle,
  Loader2,
  Edit,
  Trash2,
  X,
  User,
  Phone,
  CreditCard,
  FileText,
  Package,
  ChevronDown,
  ChevronUp,
  MoreVertical,
  Minus
} from 'lucide-react'

// Tipe data untuk form order baru
interface OrderFormData {
  customer_name: string
  customer_phone: string
  payment_method: string
  notes: string
  items: Array<{
    product_id: string
    quantity: number
    price: number
  }>
}

// Metode pembayaran
const PAYMENT_METHODS = [
  { value: 'cash', label: 'Cash' },
  { value: 'card', label: 'Kartu Kredit/Debit' },
  { value: 'qris', label: 'QRIS' },
  { value: 'transfer', label: 'Transfer Bank' }
] as const

export default function OrdersPage() {
  // State utama
  const [orders, setOrders] = useState<Order[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [isMobile, setIsMobile] = useState(false)

  // State modal
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showDetailModal, setShowDetailModal] = useState(false)
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null)
  const [submitLoading, setSubmitLoading] = useState(false)
  
  // State UI
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set())
  const [showMobileMenu, setShowMobileMenu] = useState<string | null>(null)

  // State form
  const [formData, setFormData] = useState<OrderFormData>({
    customer_name: '',
    customer_phone: '',
    payment_method: 'cash',
    notes: '',
    items: []
  })

  // Inisialisasi
  useEffect(() => {
    fetchOrders()
    fetchProducts()
    checkMobile()

    const handleResize = () => checkMobile()
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  const checkMobile = () => {
    setIsMobile(window.innerWidth < 768)
  }

  // Fetch data dari Supabase - VERSI DIPERBAIKI
  const fetchOrders = async () => {
    try {
      setLoading(true)
      
      console.log('🔄 Memulai fetch orders...')
      
      // Method 1: Coba query dengan join langsung
      const { data: ordersData, error: ordersError } = await supabase
        .from('orders')
        .select(`
          *,
          order_items(
            *,
            products(*)
          )
        `)
        .order('created_at', { ascending: false })

      if (ordersError) {
        console.error('Error query utama:', ordersError)
        // Fallback ke method manual
        await fetchOrdersWithManualJoin()
        return
      }

      console.log('✅ Data orders dari query utama:', ordersData)
      
      if (ordersData && ordersData.length > 0) {
        console.log('📦 Order pertama items:', ordersData[0].order_items)
      }

      setOrders(ordersData || [])
    } catch (error: any) {
      console.error('❌ Error fetching orders:', error)
      alert('Gagal memuat data order: ' + error.message)
    } finally {
      setLoading(false)
    }
  }

  // Fallback method jika query utama gagal
  const fetchOrdersWithManualJoin = async () => {
    try {
      console.log('🔄 Menggunakan fallback manual join...')
      
      const { data: ordersData, error: ordersError } = await supabase
        .from('orders')
        .select('*')
        .order('created_at', { ascending: false })

      if (ordersError) throw ordersError

      if (!ordersData || ordersData.length === 0) {
        console.log('ℹ️ Tidak ada data orders')
        setOrders([])
        return
      }

      console.log('📋 Orders ditemukan:', ordersData.length)
      const orderIds = ordersData.map(order => order.id)
      console.log('🆔 Order IDs:', orderIds)

      // Fetch order_items dengan products
      const { data: orderItemsData, error: itemsError } = await supabase
        .from('order_items')
        .select(`
          *,
          products(*)
        `)
        .in('order_id', orderIds)

      if (itemsError) throw itemsError

      console.log('📦 Data order_items:', orderItemsData)

      // Gabungkan data
      const ordersWithItems = ordersData.map(order => ({
        ...order,
        order_items: orderItemsData?.filter(item => item.order_id === order.id) || []
      }))

      console.log('✅ Orders dengan items:', ordersWithItems)
      setOrders(ordersWithItems)
    } catch (error: any) {
      console.error('❌ Error in manual join:', error)
      alert('Gagal memuat data order: ' + error.message)
    }
  }

  const fetchProducts = async () => {
    try {
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .eq('is_available', true)
        .order('name')

      if (error) throw error
      setProducts(data || [])
    } catch (error: any) {
      console.error('Error fetching products:', error)
      alert('Gagal memuat data produk: ' + error.message)
    }
  }

  // Toggle expanded row untuk detail produk
  const toggleRowExpansion = (orderId: string) => {
    const newExpanded = new Set(expandedRows)
    if (newExpanded.has(orderId)) {
      newExpanded.delete(orderId)
    } else {
      newExpanded.add(orderId)
    }
    setExpandedRows(newExpanded)
    
    // Debug: lihat order yang di-expand
    const order = orders.find(o => o.id === orderId)
    if (order && !newExpanded.has(orderId)) {
      console.log(`📖 Expand order: ${order.order_number}`, order.order_items)
    }
  }

  // Validasi form
  const validateForm = (): { isValid: boolean; message: string } => {
    if (formData.items.length === 0) {
      return { isValid: false, message: 'Minimal tambahkan 1 item produk' }
    }

    for (const item of formData.items) {
      if (!item.product_id) {
        return { isValid: false, message: 'Semua item harus memilih produk' }
      }
      if (item.quantity < 1) {
        return { isValid: false, message: 'Quantity harus minimal 1' }
      }
      if (item.price <= 0) {
        return { isValid: false, message: 'Harga harus lebih dari 0' }
      }
    }

    return { isValid: true, message: 'Valid' }
  }

  // Create order
  const createOrder = async () => {
    const validation = validateForm()
    if (!validation.isValid) {
      alert(validation.message)
      return
    }

    setSubmitLoading(true)

    try {
      // Generate order number
      const orderNumber = `ORD-${Date.now()}`

      // Calculate total amount
      const total_amount = formData.items.reduce((sum, item) => 
        sum + (item.price * item.quantity), 0
      )

      // Insert order
      const { data: order, error: orderError } = await supabase
        .from('orders')
        .insert([
          {
            order_number: orderNumber,
            total_amount,
            status: 'pending',
            payment_method: formData.payment_method,
            customer_name: formData.customer_name || null,
            customer_phone: formData.customer_phone || null,
            notes: formData.notes || null
          }
        ])
        .select()
        .single()

      if (orderError) throw orderError

      // Insert order items
      const orderItems = formData.items.map(item => ({
        order_id: order.id,
        product_id: item.product_id,
        quantity: item.quantity,
        price: item.price,
        subtotal: item.price * item.quantity
      }))

      const { error: itemsError } = await supabase
        .from('order_items')
        .insert(orderItems)

      if (itemsError) throw itemsError

      // Reset form dan refresh data
      resetForm()
      setShowCreateModal(false)
      await fetchOrders()

      alert(`Order ${orderNumber} berhasil dibuat!\nTotal: Rp ${total_amount.toLocaleString('id-ID')}`)
    } catch (error: any) {
      console.error('Error creating order:', error)
      alert('Gagal membuat order: ' + error.message)
    } finally {
      setSubmitLoading(false)
    }
  }

  // Update order status
  const updateOrderStatus = async (orderId: string, status: Order['status']) => {
    try {
      const { error } = await supabase
        .from('orders')
        .update({ status })
        .eq('id', orderId)

      if (error) throw error

      await fetchOrders()
      setShowMobileMenu(null)
      alert('Status order berhasil diupdate')
    } catch (error: any) {
      console.error('Error updating order status:', error)
      alert('Gagal mengupdate status order: ' + error.message)
    }
  }

  // Delete order
  const deleteOrder = async (orderId: string) => {
    const orderToDelete = orders.find(order => order.id === orderId)
    
    if (!confirm(`Apakah Anda yakin ingin menghapus order ${orderToDelete?.order_number}?`)) {
      return
    }

    try {
      // Hapus order_items terlebih dahulu
      const { error: itemsError } = await supabase
        .from('order_items')
        .delete()
        .eq('order_id', orderId)

      if (itemsError) throw itemsError

      // Hapus order
      const { error } = await supabase
        .from('orders')
        .delete()
        .eq('id', orderId)

      if (error) throw error

      await fetchOrders()
      setShowMobileMenu(null)
      alert('Order berhasil dihapus')
    } catch (error: any) {
      console.error('Error deleting order:', error)
      alert('Gagal menghapus order: ' + error.message)
    }
  }

  // Helper functions untuk form
  const addItemToOrder = () => {
    setFormData(prev => ({
      ...prev,
      items: [...prev.items, { product_id: '', quantity: 1, price: 0 }]
    }))
  }

  const updateOrderItem = (index: number, field: string, value: any) => {
    const newItems = [...formData.items]
    newItems[index] = { ...newItems[index], [field]: value }

    // Auto-update price jika product berubah
    if (field === 'product_id') {
      const product = products.find(p => p.id === value)
      if (product) {
        newItems[index].price = product.price
      }
    }

    setFormData(prev => ({ ...prev, items: newItems }))
  }

  const removeOrderItem = (index: number) => {
    if (formData.items.length === 1) {
      alert('Order harus memiliki minimal 1 item')
      return
    }

    setFormData(prev => ({
      ...prev,
      items: prev.items.filter((_, i) => i !== index)
    }))
  }

  // Quantity control functions
  const increaseQuantity = (index: number) => {
    const newItems = [...formData.items]
    newItems[index].quantity += 1
    setFormData(prev => ({ ...prev, items: newItems }))
  }

  const decreaseQuantity = (index: number) => {
    const newItems = [...formData.items]
    if (newItems[index].quantity > 1) {
      newItems[index].quantity -= 1
      setFormData(prev => ({ ...prev, items: newItems }))
    }
  }

  const handleQuantityChange = (index: number, value: string) => {
    const quantity = parseInt(value) || 1
    if (quantity >= 1) {
      const newItems = [...formData.items]
      newItems[index].quantity = quantity
      setFormData(prev => ({ ...prev, items: newItems }))
    }
  }

  const resetForm = () => {
    setFormData({
      customer_name: '',
      customer_phone: '',
      payment_method: 'cash',
      notes: '',
      items: []
    })
  }

  const openCreateModal = () => {
    if (products.length === 0) {
      alert('Tidak ada produk yang tersedia. Silakan tambahkan produk terlebih dahulu.')
      return
    }
    resetForm()
    setShowCreateModal(true)
  }

  const openDetailModal = (order: Order) => {
    setSelectedOrder(order)
    setShowDetailModal(true)
    setShowMobileMenu(null)
    console.log('🔍 Detail order:', order)
  }

  const closeModals = () => {
    setShowCreateModal(false)
    setShowDetailModal(false)
    setSelectedOrder(null)
  }

  // Filter orders
  const filteredOrders = orders.filter(order => {
    const matchesSearch =
      order.order_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
      order.customer_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      order.customer_phone?.includes(searchTerm)

    const matchesStatus = statusFilter === 'all' || order.status === statusFilter

    return matchesSearch && matchesStatus
  })

  // Helper functions untuk UI
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'bg-yellow-100 text-yellow-800 border-yellow-200'
      case 'processing': return 'bg-blue-100 text-blue-800 border-blue-200'
      case 'completed': return 'bg-green-100 text-green-800 border-green-200'
      case 'cancelled': return 'bg-red-100 text-red-800 border-red-200'
      default: return 'bg-gray-100 text-gray-800 border-gray-200'
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending': return <Clock className="h-4 w-4" />
      case 'processing': return <Loader2 className="h-4 w-4 animate-spin" />
      case 'completed': return <CheckCircle className="h-4 w-4" />
      case 'cancelled': return <XCircle className="h-4 w-4" />
      default: return <Clock className="h-4 w-4" />
    }
  }

  const getPaymentMethodIcon = (method: string) => {
    switch (method) {
      case 'cash': return <CreditCard className="h-4 w-4" />
      case 'card': return <CreditCard className="h-4 w-4" />
      case 'qris': return <CreditCard className="h-4 w-4" />
      case 'transfer': return <CreditCard className="h-4 w-4" />
      default: return <CreditCard className="h-4 w-4" />
    }
  }

  const getPaymentMethodLabel = (method: string) => {
    const paymentMethod = PAYMENT_METHODS.find(pm => pm.value === method)
    return paymentMethod ? paymentMethod.label : method
  }

  const totalAmount = formData.items.reduce((sum, item) => 
    sum + (item.price * item.quantity), 0
  )

  // Debug: log state penting
  console.log('📊 Orders state:', orders)
  console.log('🎯 Expanded rows:', expandedRows)
  console.log('🔍 Filtered orders:', filteredOrders.length)

  // Loading state
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-96">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-amber-600 mx-auto"></div>
          <p className="mt-4 text-amber-700">Memuat data order...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-amber-900">Manajemen Pemesanan</h1>
          <p className="text-amber-600 mt-1">Kelola semua order dari pelanggan</p>
        </div>
        <button
          onClick={openCreateModal}
          className="bg-amber-600 text-white px-6 py-3 rounded-lg hover:bg-amber-700 transition-colors flex items-center space-x-2"
        >
          <Plus className="h-5 w-5" />
          <span>Order Baru</span>
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl p-4 shadow-sm border border-amber-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Total Order</p>
              <p className="text-2xl font-bold text-gray-900">{orders.length}</p>
            </div>
            <ShoppingCart className="h-8 w-8 text-amber-600" />
          </div>
        </div>

        <div className="bg-white rounded-xl p-4 shadow-sm border border-amber-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Pending</p>
              <p className="text-2xl font-bold text-yellow-600">
                {orders.filter(o => o.status === 'pending').length}
              </p>
            </div>
            <Clock className="h-8 w-8 text-yellow-600" />
          </div>
        </div>

        <div className="bg-white rounded-xl p-4 shadow-sm border border-amber-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Processing</p>
              <p className="text-2xl font-bold text-blue-600">
                {orders.filter(o => o.status === 'processing').length}
              </p>
            </div>
            <Loader2 className="h-8 w-8 text-blue-600" />
          </div>
        </div>

        <div className="bg-white rounded-xl p-4 shadow-sm border border-amber-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Completed</p>
              <p className="text-2xl font-bold text-green-600">
                {orders.filter(o => o.status === 'completed').length}
              </p>
            </div>
            <CheckCircle className="h-8 w-8 text-green-600" />
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl p-4 shadow-sm border border-amber-100">
        <div className="flex flex-col lg:flex-row gap-4">
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
              <input
                type="text"
                placeholder="Cari order number, nama pelanggan..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
            </div>
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
          >
            <option value="all">Semua Status</option>
            <option value="pending">Pending</option>
            <option value="processing">Processing</option>
            <option value="completed">Completed</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>
      </div>

      {/* Orders Table */}
      <div className="bg-white rounded-xl shadow-sm border border-amber-100 overflow-hidden">
        {isMobile ? (
          /* Mobile View */
          <div className="divide-y divide-amber-50">
            {filteredOrders.map((order) => (
              <div key={order.id}>
                <div className="p-4 hover:bg-amber-50 transition-colors">
                  <div className="flex justify-between items-start mb-3">
                    <div className="flex-1 min-w-0">
                      <button
                        onClick={() => toggleRowExpansion(order.id)}
                        className="flex items-center space-x-2 text-left w-full"
                      >
                        <h3 className="font-semibold text-gray-900 truncate">{order.order_number}</h3>
                        {expandedRows.has(order.id) ? (
                          <ChevronUp className="h-4 w-4 text-gray-400 shrink-0" />
                        ) : (
                          <ChevronDown className="h-4 w-4 text-gray-400 shrink-0" />
                        )}
                      </button>
                      <p className="text-sm text-gray-600 mt-1">
                        {order.customer_name || 'Walk-in Customer'}
                      </p>
                      {order.customer_phone && (
                        <p className="text-xs text-gray-500">{order.customer_phone}</p>
                      )}
                    </div>
                    <div className="relative">
                      <button
                        onClick={() => setShowMobileMenu(showMobileMenu === order.id ? null : order.id)}
                        className="p-1 text-gray-400 hover:text-gray-600"
                      >
                        <MoreVertical className="h-4 w-4" />
                      </button>

                      {showMobileMenu === order.id && (
                        <div className="absolute right-0 top-6 bg-white border border-gray-200 rounded-lg shadow-lg z-10 min-w-32">
                          <button
                            onClick={() => openDetailModal(order)}
                            className="w-full px-4 py-2 text-left text-sm text-blue-600 hover:bg-blue-50 flex items-center space-x-2"
                          >
                            <Edit className="h-4 w-4" />
                            <span>Detail</span>
                          </button>
                          <button
                            onClick={() => deleteOrder(order.id)}
                            className="w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50 flex items-center space-x-2"
                          >
                            <Trash2 className="h-4 w-4" />
                            <span>Hapus</span>
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <p className="text-gray-600">Total</p>
                      <p className="font-semibold text-gray-900">
                        Rp {order.total_amount.toLocaleString('id-ID')}
                      </p>
                    </div>
                    <div>
                      <p className="text-gray-600">Status</p>
                      <div className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium border ${getStatusColor(order.status)}`}>
                        {getStatusIcon(order.status)}
                        <span className="ml-1 capitalize">{order.status}</span>
                      </div>
                    </div>
                    <div>
                      <p className="text-gray-600">Pembayaran</p>
                      <p className="text-gray-900 capitalize">{getPaymentMethodLabel(order.payment_method)}</p>
                    </div>
                    <div>
                      <p className="text-gray-600">Tanggal</p>
                      <p className="text-gray-900 text-xs">
                        {new Date(order.created_at).toLocaleDateString('id-ID')}
                      </p>
                    </div>
                  </div>

                  {/* Status Selector for Mobile */}
                  <div className="mt-3">
                    <select
                      value={order.status}
                      onChange={(e) => updateOrderStatus(order.id, e.target.value as Order['status'])}
                      className="w-full text-xs border border-gray-300 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-amber-500 bg-white"
                    >
                      <option value="pending">Pending</option>
                      <option value="processing">Processing</option>
                      <option value="completed">Completed</option>
                      <option value="cancelled">Cancelled</option>
                    </select>
                  </div>
                </div>

                {/* Expanded Product Details for Mobile */}
                {expandedRows.has(order.id) && (
                  <div className="bg-gray-200 border-t border-amber-100 p-4">
                    <h4 className="font-medium text-gray-900 mb-3 flex items-center">
                      <Package className="h-4 w-4 mr-2 text-amber-600" />
                      Detail Produk yang Dipesan
                    </h4>
                    <div className="space-y-2">
                      {order.order_items && order.order_items.length > 0 ? (
                        order.order_items.map((item) => (
                          <div key={item.id} className="flex justify-between items-center p-3 bg-white rounded-lg border border-gray-200">
                            <div className="flex-1">
                              <p className="font-medium text-gray-900 text-sm">
                                {item.products?.name || 'Nama produk tidak tersedia'}
                              </p>
                              
                            </div>
                            <p className="font-semibold text-gray-900 text-sm">
                              x {item.quantity}
                            </p>
                          </div>
                        ))
                      ) : (
                        <div className="text-center py-4 text-gray-500 text-sm">
                          <Package className="h-8 w-8 text-gray-300 mx-auto mb-2" />
                          Tidak ada produk dalam order ini
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          /* Desktop View */
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-amber-100 bg-amber-50">
                  <th className="text-left py-4 px-4 text-sm font-semibold text-amber-900 w-8"></th>
                  <th className="text-left py-4 px-4 text-sm font-semibold text-amber-900">Order #</th>
                  <th className="text-left py-4 px-4 text-sm font-semibold text-amber-900">Pelanggan</th>
                  <th className="text-left py-4 px-4 text-sm font-semibold text-amber-900">Total</th>
                  <th className="text-left py-4 px-4 text-sm font-semibold text-amber-900">Status</th>
                  <th className="text-left py-4 px-4 text-sm font-semibold text-amber-900">Pembayaran</th>
                  <th className="text-left py-4 px-4 text-sm font-semibold text-amber-900">Tanggal</th>
                  <th className="text-left py-4 px-4 text-sm font-semibold text-amber-900">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {filteredOrders.map((order) => (
                  <>
                    <tr key={order.id} className="border-b border-amber-50 hover:bg-amber-50 transition-colors">
                      <td className="py-4 px-4">
                        <button
                          onClick={() => toggleRowExpansion(order.id)}
                          className="text-gray-400 hover:text-amber-600 transition-colors"
                        >
                          {expandedRows.has(order.id) ? (
                            <ChevronUp className="h-4 w-4" />
                          ) : (
                            <ChevronDown className="h-4 w-4" />
                          )}
                        </button>
                      </td>
                      <td className="py-4 px-4">
                        <div className="font-medium text-gray-900">{order.order_number}</div>
                      </td>
                      <td className="py-4 px-4">
                        <div>
                          <div className="font-medium text-gray-900">
                            {order.customer_name || 'Walk-in Customer'}
                          </div>
                          {order.customer_phone && (
                            <div className="text-sm text-gray-500">{order.customer_phone}</div>
                          )}
                        </div>
                      </td>
                      <td className="py-4 px-4">
                        <div className="font-semibold text-gray-900">
                          Rp {order.total_amount.toLocaleString('id-ID')}
                        </div>
                      </td>
                      <td className="py-4 px-4">
                        <div className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium border ${getStatusColor(order.status)}`}>
                          {getStatusIcon(order.status)}
                          <span className="ml-2 capitalize">{order.status}</span>
                        </div>
                      </td>
                      <td className="py-4 px-4">
                        <div className="flex items-center space-x-2 text-sm text-gray-900 capitalize">
                          {getPaymentMethodIcon(order.payment_method)}
                          <span>{getPaymentMethodLabel(order.payment_method)}</span>
                        </div>
                      </td>
                      <td className="py-4 px-4">
                        <div className="text-sm text-gray-900">
                          {new Date(order.created_at).toLocaleDateString('id-ID')}
                        </div>
                        <div className="text-xs text-gray-500">
                          {new Date(order.created_at).toLocaleTimeString('id-ID')}
                        </div>
                      </td>
                      <td className="py-4 px-4">
                        <div className="flex items-center space-x-2">
                          <select
                            value={order.status}
                            onChange={(e) => updateOrderStatus(order.id, e.target.value as Order['status'])}
                            className="text-xs border border-gray-300 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-amber-500 bg-white"
                          >
                            <option value="pending">Pending</option>
                            <option value="processing">Processing</option>
                            <option value="completed">Completed</option>
                            <option value="cancelled">Cancelled</option>
                          </select>

                          <button
                            onClick={() => openDetailModal(order)}
                            className="text-blue-600 hover:text-blue-800 p-1 transition-colors"
                            title="Detail Order"
                          >
                            <Edit className="h-4 w-4" />
                          </button>

                          <button
                            onClick={() => deleteOrder(order.id)}
                            className="text-red-600 hover:text-red-800 p-1 transition-colors"
                            title="Hapus Order"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                    
                    {/* Expanded Product Details for Desktop */}
                    {expandedRows.has(order.id) && (
                      <tr className="bg-gray-50 border-b border-amber-100">
                        <td colSpan={8} className="py-4 px-4">
                          <div className="max-w-4xl">
                            <h4 className="font-medium text-gray-900 mb-3 flex items-center">
                              <Package className="h-4 w-4 mr-2 text-amber-600" />
                              Detail Produk yang Dipesan
                            </h4>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                              {order.order_items && order.order_items.length > 0 ? (
                                order.order_items.map((item) => (
                                  <div key={item.id} className="bg-white p-3 rounded-lg border border-gray-200">
                                    <div className="flex justify-between items-start">
                                      <div className="flex-1">
                                        <p className="font-medium text-gray-900">
                                          {item.products?.name || 'Nama produk tidak tersedia'}
                                        </p>
                                       
                                      </div>
                                      <div className="text-right">
                                        <p className="font-semibold text-gray-900">
                                          x {item.quantity}
                                        </p>
                                      </div>
                                    </div>
                                  </div>
                                ))
                              ) : (
                                <div className="col-span-3 text-center py-8 text-gray-500">
                                  <Package className="h-12 w-12 text-gray-300 mx-auto mb-2" />
                                  <p>Tidak ada produk dalam order ini</p>
                                </div>
                              )}
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {filteredOrders.length === 0 && (
          <div className="text-center py-12">
            <ShoppingCart className="h-16 w-16 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500">Tidak ada order yang ditemukan</p>
            <button
              onClick={openCreateModal}
              className="mt-4 text-amber-600 hover:text-amber-700 font-medium transition-colors"
            >
              Buat order pertama
            </button>
          </div>
        )}
      </div>

      {/* Create Order Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200 flex items-center justify-between">
              <h3 className="text-xl font-semibold text-gray-900">Buat Order Baru</h3>
              <button
                onClick={closeModals}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X className="h-6 w-6" />
              </button>
            </div>

            <div className="p-6 space-y-6">
              {/* Customer Info */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-2 flex items-center">
                    <User className="h-4 w-4 mr-2 text-amber-600" />
                    Nama Pelanggan
                  </label>
                  <input
                    type="text"
                    value={formData.customer_name}
                    onChange={(e) => setFormData(prev => ({ ...prev, customer_name: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
                    placeholder="Opsional"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-2 flex items-center">
                    <Phone className="h-4 w-4 mr-2 text-amber-600" />
                    No. Telepon
                  </label>
                  <input
                    type="tel"
                    value={formData.customer_phone}
                    onChange={(e) => setFormData(prev => ({ ...prev, customer_phone: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
                    placeholder="Opsional"
                  />
                </div>
              </div>

              {/* Payment Method */}
              <div>
                <label className="text-sm font-medium text-gray-700 mb-2 flex items-center">
                  <CreditCard className="h-4 w-4 mr-2 text-amber-600" />
                  Metode Pembayaran
                </label>
                <select
                  value={formData.payment_method}
                  onChange={(e) => setFormData(prev => ({ ...prev, payment_method: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
                >
                  {PAYMENT_METHODS.map(method => (
                    <option key={method.value} value={method.value}>
                      {method.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Order Items */}
              <div>
                <div className="flex items-center justify-between mb-4">
                  <label className="text-sm font-medium text-gray-700 flex items-center">
                    <Package className="h-4 w-4 mr-2 text-amber-600" />
                    Produk yang Dipesan
                  </label>
                  <button
                    type="button"
                    onClick={addItemToOrder}
                    className="text-amber-600 hover:text-amber-700 text-sm font-medium flex items-center space-x-1"
                  >
                    <Plus className="h-4 w-4" />
                    <span>Tambah Item</span>
                  </button>
                </div>

                <div className="space-y-4">
                  {formData.items.map((item, index) => (
                    <div key={index} className="border border-gray-200 rounded-lg p-4">
                      <div className="flex items-center justify-between mb-3">
                        <h4 className="font-medium text-gray-900">Item #{index + 1}</h4>
                        {formData.items.length > 1 && (
                          <button
                            type="button"
                            onClick={() => removeOrderItem(index)}
                            className="text-red-600 hover:text-red-700 p-1 transition-colors"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        )}
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="text-xs text-gray-600 mb-1 block">Produk</label>
                          <select
                            value={item.product_id}
                            onChange={(e) => updateOrderItem(index, 'product_id', e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 text-sm"
                            required
                          >
                            <option value="">Pilih Produk</option>
                            {products.map(product => (
                              <option key={product.id} value={product.id}>
                                {product.name} - Rp {product.price.toLocaleString('id-ID')}
                              </option>
                            ))}
                          </select>
                        </div>

                       

                        <div>
                          <label className="text-xs text-gray-600 mb-1 block">Quantity</label>
                          <div className="flex items-center space-x-3">
                            <button
                              type="button"
                              onClick={() => decreaseQuantity(index)}
                              className="p-2 rounded-full border border-gray-300 hover:bg-gray-100 transition-colors"
                              disabled={item.quantity <= 1}
                            >
                              <Minus className="h-3 w-3" />
                            </button>
                            <input
                              type="number"
                              value={item.quantity}
                              onChange={(e) => handleQuantityChange(index, e.target.value)}
                              className="w-16 px-2 py-1 border border-gray-300 rounded text-center text-sm"
                              min="1"
                            />
                            <button
                              type="button"
                              onClick={() => increaseQuantity(index)}
                              className="p-2 rounded-full border border-gray-300 hover:bg-gray-100 transition-colors"
                            >
                              <Plus className="h-3 w-3" />
                            </button>
                          </div>
                        </div>

                        <div>
                          <label className="text-xs text-gray-600 mb-1 block">Subtotal</label>
                          <div className="px-3 py-2 bg-gray-50 rounded-lg text-sm font-semibold text-gray-900">
                            Rp {(item.price * item.quantity).toLocaleString('id-ID')}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {formData.items.length === 0 && (
                  <div className="text-center py-8 border-2 border-dashed border-gray-300 rounded-lg">
                    <Package className="h-8 w-8 text-gray-300 mx-auto mb-2" />
                    <p className="text-gray-500 text-sm">Belum ada produk yang ditambahkan</p>
                    <button
                      type="button"
                      onClick={addItemToOrder}
                      className="mt-2 text-amber-600 hover:text-amber-700 text-sm font-medium"
                    >
                      Tambah produk pertama
                    </button>
                  </div>
                )}
              </div>

              {/* Notes */}
              <div>
                <label className="text-sm font-medium text-gray-700 mb-2 flex items-center">
                  <FileText className="h-4 w-4 mr-2 text-amber-600" />
                  Catatan
                </label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
                  placeholder="Catatan untuk order (opsional)"
                />
              </div>

              {/* Total Amount */}
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                <div className="flex justify-between items-center">
                  <span className="text-lg font-semibold text-amber-900">Total Amount</span>
                  <span className="text-2xl font-bold text-amber-900">
                    Rp {totalAmount.toLocaleString('id-ID')}
                  </span>
                </div>
              </div>
            </div>

            <div className="p-6 border-t border-gray-200 flex gap-3 justify-end">
              <button
                onClick={closeModals}
                disabled={submitLoading}
                className="px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
              >
                Batal
              </button>
              <button
                onClick={createOrder}
                disabled={submitLoading || formData.items.length === 0}
                className="px-6 py-3 bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
              >
                {submitLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Membuat Order...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle className="h-4 w-4" />
                    <span>Buat Order</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Order Detail Modal */}
      {showDetailModal && selectedOrder && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200 flex items-center justify-between">
              <h3 className="text-xl font-semibold text-gray-900">
                Detail Order - {selectedOrder.order_number}
              </h3>
              <button
                onClick={closeModals}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X className="h-6 w-6" />
              </button>
            </div>

            <div className="p-6 space-y-6">
              {/* Order Information */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <h4 className="font-medium text-gray-900 mb-3 flex items-center">
                    <User className="h-4 w-4 mr-2 text-amber-600" />
                    Informasi Pelanggan
                  </h4>
                  <div className="space-y-2">
                    <div>
                      <p className="text-xs text-gray-600">Nama</p>
                      <p className="text-sm text-gray-900">
                        {selectedOrder.customer_name || 'Walk-in Customer'}
                      </p>
                    </div>
                    {selectedOrder.customer_phone && (
                      <div>
                        <p className="text-xs text-gray-600">No. Telepon</p>
                        <p className="text-sm text-gray-900">{selectedOrder.customer_phone}</p>
                      </div>
                    )}
                  </div>
                </div>

                <div>
                  <h4 className="font-medium text-gray-900 mb-3 flex items-center">
                    <CreditCard className="h-4 w-4 mr-2 text-amber-600" />
                    Informasi Pembayaran
                  </h4>
                  <div className="space-y-2">
                    <div>
                      <p className="text-xs text-gray-600">Metode Pembayaran</p>
                      <p className="text-sm text-gray-900 capitalize">
                        {getPaymentMethodLabel(selectedOrder.payment_method)}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-600">Status</p>
                      <div className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium border ${getStatusColor(selectedOrder.status)}`}>
                        {getStatusIcon(selectedOrder.status)}
                        <span className="ml-1 capitalize">{selectedOrder.status}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Order Items */}
              <div>
                <h4 className="font-medium text-gray-900 mb-3 flex items-center">
                  <Package className="h-4 w-4 mr-2 text-amber-600" />
                  Detail Produk yang Dipesan
                </h4>
                <div className="space-y-3">
                  {selectedOrder.order_items && selectedOrder.order_items.length > 0 ? (
                    selectedOrder.order_items.map((item) => (
                      <div key={item.id} className="border border-gray-200 rounded-lg p-4">
                        <div className="flex justify-between items-start">
                          
                          <div className="text-right">
                            <p className="font-semibold text-gray-900">
                              x {item.quantity }
                            </p>
                          </div>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="text-center py-4 text-gray-500">
                      Tidak ada item produk
                    </div>
                  )}
                </div>
              </div>

              {/* Notes */}
              {selectedOrder.notes && (
                <div>
                  <h4 className="font-medium text-gray-900 mb-2 flex items-center">
                    <FileText className="h-4 w-4 mr-2 text-amber-600" />
                    Catatan
                  </h4>
                  <p className="text-sm text-gray-700 bg-gray-50 p-3 rounded-lg border border-gray-200">
                    {selectedOrder.notes}
                  </p>
                </div>
              )}

              {/* Summary */}
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                <div className="flex justify-between items-center">
                  <span className="text-lg font-semibold text-amber-900">Total Amount</span>
                  <span className="text-2xl font-bold text-amber-900">
                    Rp {selectedOrder.total_amount.toLocaleString('id-ID')}
                  </span>
                </div>
                <div className="mt-2 text-xs text-amber-700">
                  Dibuat pada {new Date(selectedOrder.created_at).toLocaleString('id-ID')}
                </div>
              </div>
            </div>

            <div className="p-6 border-t border-gray-200 flex justify-end">
              <button
                onClick={closeModals}
                className="px-6 py-3 bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition-colors"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
