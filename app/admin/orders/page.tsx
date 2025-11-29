'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Order, Product, CreateOrderData } from '@/types'
import { useModal } from '@/contexts/ModalContext'
import { 
  Plus, 
  Search, 
  Filter, 
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
  FileText
} from 'lucide-react'

const PAYMENT_METHODS = [
  { value: 'cash', label: 'Cash' },
  { value: 'card', label: 'Kartu' },
  { value: 'qris', label: 'QRIS' },
  { value: 'transfer', label: 'Transfer' }
] as const

export default function OrdersPage() {
  const { showModal } = useModal()
  const [orders, setOrders] = useState<Order[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  
  // Modal states
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showDetailModal, setShowDetailModal] = useState(false)
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null)
  const [submitLoading, setSubmitLoading] = useState(false)

  // Form state
  const [formData, setFormData] = useState({
    customer_name: '',
    customer_phone: '',
    payment_method: 'cash' as string,
    notes: '',
    items: [] as Array<{ product_id: string; quantity: number; price: number }>
  })

  useEffect(() => {
    fetchOrders()
    fetchProducts()
  }, [])

  const fetchOrders = async () => {
    try {
      setLoading(true)
      const { data, error } = await supabase
        .from('orders')
        .select(`
          *,
          order_items(
            *,
            products(*)
          )
        `)
        .order('created_at', { ascending: false })

      if (error) throw error
      setOrders(data || [])
    } catch (error: any) {
      console.error('Error fetching orders:', error)
      showModal({
        title: 'Error',
        message: 'Gagal memuat data order: ' + error.message,
        type: 'error'
      })
    } finally {
      setLoading(false)
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
      showModal({
        title: 'Error',
        message: 'Gagal memuat data produk: ' + error.message,
        type: 'error'
      })
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

  const createOrder = async () => {
    const validation = validateForm()
    if (!validation.isValid) {
      showModal({
        title: 'Validasi Gagal',
        message: validation.message,
        type: 'error'
      })
      return
    }

    setSubmitLoading(true)
    
    try {
      // Generate order number
      const orderNumber = `ORD-${Date.now()}`
      
      // Calculate total amount
      const total_amount = formData.items.reduce((sum, item) => sum + (item.price * item.quantity), 0)

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

      // Reset form and refresh
      resetForm()
      setShowCreateModal(false)
      await fetchOrders()
      
      showModal({
        title: 'Sukses',
        message: `Order ${orderNumber} berhasil dibuat!\nTotal: Rp ${total_amount.toLocaleString('id-ID')}`,
        type: 'success'
      })
    } catch (error: any) {
      console.error('Error creating order:', error)
      showModal({
        title: 'Error',
        message: 'Gagal membuat order: ' + error.message,
        type: 'error'
      })
    } finally {
      setSubmitLoading(false)
    }
  }

  const updateOrderStatus = async (orderId: string, status: Order['status']) => {
    try {
      const { error } = await supabase
        .from('orders')
        .update({ status })
        .eq('id', orderId)

      if (error) throw error
      
      await fetchOrders()
      showModal({
        title: 'Sukses',
        message: 'Status order berhasil diupdate',
        type: 'success'
      })
    } catch (error: any) {
      console.error('Error updating order status:', error)
      showModal({
        title: 'Error',
        message: 'Gagal mengupdate status order: ' + error.message,
        type: 'error'
      })
    }
  }

  const deleteOrder = async (orderId: string) => {
    const orderToDelete = orders.find(order => order.id === orderId)
    
    showModal({
      title: 'Konfirmasi Hapus',
      message: `Apakah Anda yakin ingin menghapus order ${orderToDelete?.order_number}?\nTindakan ini tidak dapat dibatalkan.`,
      type: 'confirm',
      confirmText: 'Hapus',
      cancelText: 'Batal',
      onConfirm: async () => {
        try {
          const { error } = await supabase
            .from('orders')
            .delete()
            .eq('id', orderId)

          if (error) throw error
          
          await fetchOrders()
          showModal({
            title: 'Sukses',
            message: 'Order berhasil dihapus',
            type: 'success'
          })
        } catch (error: any) {
          console.error('Error deleting order:', error)
          showModal({
            title: 'Error',
            message: 'Gagal menghapus order: ' + error.message,
            type: 'error'
          })
        }
      }
    })
  }

  // Form helpers
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
      showModal({
        title: 'Peringatan',
        message: 'Order harus memiliki minimal 1 item',
        type: 'warning'
      })
      return
    }

    setFormData(prev => ({
      ...prev,
      items: prev.items.filter((_, i) => i !== index)
    }))
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
      showModal({
        title: 'Peringatan',
        message: 'Tidak ada produk yang tersedia. Silakan tambahkan produk terlebih dahulu.',
        type: 'warning'
      })
      return
    }
    resetForm()
    setShowCreateModal(true)
  }

  const openDetailModal = (order: Order) => {
    setSelectedOrder(order)
    setShowDetailModal(true)
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

  const getPaymentMethodLabel = (method: string) => {
    const paymentMethod = PAYMENT_METHODS.find(pm => pm.value === method)
    return paymentMethod ? paymentMethod.label : method
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

  const totalAmount = formData.items.reduce((sum, item) => sum + (item.price * item.quantity), 0)

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
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold text-amber-900">Manajemen Pemesanan</h1>
          <p className="text-amber-600 mt-1">Kelola semua order dari pelanggan</p>
        </div>
        <button
          onClick={openCreateModal}
          className="mt-4 lg:mt-0 bg-amber-600 text-white px-6 py-3 rounded-lg hover:bg-amber-700 transition-colors flex items-center space-x-2 shadow-lg hover:shadow-xl"
        >
          <Plus className="h-5 w-5" />
          <span>Order Baru</span>
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
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
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
              <input
                type="text"
                placeholder="Cari order number, nama pelanggan..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent"
              />
            </div>
          </div>
          <div className="flex gap-2">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent"
            >
              <option value="all">Semua Status</option>
              <option value="pending">Pending</option>
              <option value="processing">Processing</option>
              <option value="completed">Completed</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>
        </div>
      </div>

      {/* Orders Table */}
      <div className="bg-white rounded-xl shadow-sm border border-amber-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-amber-100 bg-amber-50">
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
                <tr key={order.id} className="border-b border-amber-50 hover:bg-amber-50 transition-colors">
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
              ))}
            </tbody>
          </table>
          
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

            <div className="p-6 space-y-4">
              {/* Customer Info */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className=" text-sm font-medium text-gray-700 mb-2 flex items-center">
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
                  <label className=" text-sm font-medium text-gray-700 mb-2 flex items-center">
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
                <label className=" text-sm font-medium text-gray-700 mb-2 flex items-center">
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
                  <label className=" text-sm font-medium text-gray-700 flex items-center">
                    <ShoppingCart className="h-4 w-4 mr-2 text-amber-600" />
                    Items Order
                  </label>
                  <button
                    type="button"
                    onClick={addItemToOrder}
                    className="bg-amber-600 text-white px-3 py-1 rounded-lg text-sm hover:bg-amber-700 transition-colors flex items-center space-x-1"
                  >
                    <Plus className="h-4 w-4" />
                    <span>Tambah Item</span>
                  </button>
                </div>

                <div className="space-y-3">
                  {formData.items.map((item, index) => (
                    <div key={index} className="flex items-center gap-3 p-3 border border-gray-200 rounded-lg bg-gray-50">
                      <select
                        value={item.product_id}
                        onChange={(e) => updateOrderItem(index, 'product_id', e.target.value)}
                        className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 bg-white"
                        required
                      >
                        <option value="">Pilih Produk</option>
                        {products.map(product => (
                          <option key={product.id} value={product.id}>
                            {product.name} - Rp {product.price.toLocaleString('id-ID')}
                          </option>
                        ))}
                      </select>
                      <input
                        type="number"
                        min="1"
                        value={item.quantity}
                        onChange={(e) => updateOrderItem(index, 'quantity', parseInt(e.target.value) || 1)}
                        className="w-20 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 bg-white"
                      />
                      <div className="w-24 text-right font-semibold text-amber-600">
                        Rp {(item.price * item.quantity).toLocaleString('id-ID')}
                      </div>
                      <button
                        type="button"
                        onClick={() => removeOrderItem(index)}
                        className="text-red-600 hover:text-red-800 p-2 transition-colors"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                </div>

                {formData.items.length === 0 && (
                  <div className="text-center py-8 border-2 border-dashed border-gray-300 rounded-lg">
                    <ShoppingCart className="h-12 w-12 text-gray-300 mx-auto mb-2" />
                    <p className="text-gray-500">Belum ada items dalam order</p>
                  </div>
                )}
              </div>

              {/* Notes */}
              <div>
                <label className=" text-sm font-medium text-gray-700 mb-2 flex items-center">
                  <FileText className="h-4 w-4 mr-2 text-amber-600" />
                  Catatan
                </label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                  rows={2}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
                  placeholder="Catatan untuk order..."
                />
              </div>

              {/* Total */}
              {formData.items.length > 0 && (
                <div className="bg-amber-50 p-4 rounded-lg border border-amber-200">
                  <div className="flex justify-between items-center text-lg font-semibold">
                    <span>Total Order:</span>
                    <span className="text-amber-600">
                      Rp {totalAmount.toLocaleString('id-ID')}
                    </span>
                  </div>
                </div>
              )}
            </div>

            <div className="p-6 border-t border-gray-200 flex justify-end space-x-3">
              <button
                onClick={closeModals}
                className="px-6 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
                disabled={submitLoading}
              >
                Batal
              </button>
              <button
                onClick={createOrder}
                disabled={submitLoading || formData.items.length === 0}
                className="px-6 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center space-x-2"
              >
                {submitLoading && <Loader2 className="h-4 w-4 animate-spin" />}
                <span>{submitLoading ? 'Membuat...' : 'Buat Order'}</span>
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
                Detail Order: {selectedOrder.order_number}
              </h3>
              <button
                onClick={closeModals}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X className="h-6 w-6" />
              </button>
            </div>

            <div className="p-6 space-y-6">
              {/* Order Info */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Status</label>
                  <div className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium border ${getStatusColor(selectedOrder.status)}`}>
                    {getStatusIcon(selectedOrder.status)}
                    <span className="ml-2 capitalize">{selectedOrder.status}</span>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Pembayaran</label>
                  <div className="flex items-center space-x-2 text-sm text-gray-900 capitalize">
                    {getPaymentMethodIcon(selectedOrder.payment_method)}
                    <span>{getPaymentMethodLabel(selectedOrder.payment_method)}</span>
                  </div>
                </div>
                {selectedOrder.customer_name && (
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-2">Pelanggan</label>
                    <div className="flex items-center space-x-4">
                      <div className="flex items-center space-x-2">
                        <User className="h-4 w-4 text-gray-400" />
                        <span className="text-sm text-gray-900">{selectedOrder.customer_name}</span>
                      </div>
                      {selectedOrder.customer_phone && (
                        <div className="flex items-center space-x-2">
                          <Phone className="h-4 w-4 text-gray-400" />
                          <span className="text-sm text-gray-500">{selectedOrder.customer_phone}</span>
                        </div>
                      )}
                    </div>
                  </div>
                )}
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-2">Tanggal & Waktu</label>
                  <div className="text-sm text-gray-900">
                    {new Date(selectedOrder.created_at).toLocaleDateString('id-ID', { 
                      weekday: 'long',
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric'
                    })}
                  </div>
                  <div className="text-sm text-gray-500">
                    {new Date(selectedOrder.created_at).toLocaleTimeString('id-ID')}
                  </div>
                </div>
              </div>

              {/* Order Items */}
              <div>
                <h4 className="text-lg font-medium text-gray-900 mb-3">Items Order</h4>
                <div className="space-y-2">
                  {selectedOrder.items?.map((item) => (
                    <div key={item.id} className="flex justify-between items-center p-3 bg-gray-50 rounded-lg border border-gray-200">
                      <div className="flex-1">
                        <p className="font-medium text-gray-900">{item.product?.name}</p>
                        <p className="text-sm text-gray-500">
                          {item.quantity} x Rp {item.price.toLocaleString('id-ID')}
                        </p>
                        {item.product?.category && (
                          <p className="text-xs text-amber-600 bg-amber-50 px-2 py-1 rounded-full inline-block mt-1">
                            {item.product.category}
                          </p>
                        )}
                      </div>
                      <p className="font-semibold text-gray-900">
                        Rp {item.subtotal.toLocaleString('id-ID')}
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Total */}
              <div className="border-t pt-4">
                <div className="flex justify-between items-center text-lg font-semibold">
                  <span>Total:</span>
                  <span className="text-amber-600 text-xl">
                    Rp {selectedOrder.total_amount.toLocaleString('id-ID')}
                  </span>
                </div>
              </div>

              {selectedOrder.notes && (
                <div>
                  <h4 className="text-lg font-medium text-gray-900 mb-2 flex items-center">
                    <FileText className="h-5 w-5 mr-2 text-amber-600" />
                    Catatan
                  </h4>
                  <p className="text-gray-700 bg-gray-50 p-3 rounded-lg border border-gray-200">{selectedOrder.notes}</p>
                </div>
              )}
            </div>

            <div className="p-6 border-t border-gray-200 flex justify-end">
              <button
                onClick={closeModals}
                className="px-6 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
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
