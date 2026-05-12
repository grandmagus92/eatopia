'use client'
import { useEffect, useState, useRef } from 'react'
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
  Minus,
  Printer,
  Bluetooth,
  Settings,
  AlertCircle,
  Download,
  Upload,
  ChevronLeft,
  ChevronRight,
  Calendar,
  Save,
  RefreshCw,
  DollarSign,
  TrendingUp,
  Home,
  UtensilsCrossed,
  Coffee
} from 'lucide-react'

// Tipe data untuk form order baru
interface OrderFormData {
  customer_name: string
  customer_phone: string
  payment_method: string
  notes: string
  order_type: 'openbill' | 'closebill'
  items: Array<{
    product_id: string
    quantity: number
    price: number
    product_name?: string
  }>
}

// Tipe untuk printer Bluetooth
interface BluetoothPrinter {
  device: any
  server: any
  service: any
  characteristic: any
}

// Tipe untuk konfigurasi printer
interface PrinterConfig {
  copies: number
  paperWidth: number
  fontSize: number
  boldTitle: boolean
  showLogo: boolean
  storeName: string
  storeAddress: string
  storePhone: string
  storeKasir: string
  chunkSize: number
  chunkDelay: number
}

// Tipe untuk modal alert
interface AlertModalProps {
  isOpen: boolean
  title: string
  message: string
  type: 'success' | 'error' | 'warning' | 'info'
  onClose: () => void
  onConfirm?: () => void
  confirmText?: string
  cancelText?: string
}

// Component untuk Alert Modal
const AlertModal = ({
  isOpen,
  title,
  message,
  type,
  onClose,
  onConfirm,
  confirmText = 'OK',
  cancelText = 'Batal'
}: AlertModalProps) => {
  if (!isOpen) return null

  const getIcon = () => {
    switch (type) {
      case 'success':
        return <CheckCircle className="h-12 w-12 text-green-500" />
      case 'error':
        return <XCircle className="h-12 w-12 text-red-500" />
      case 'warning':
        return <AlertCircle className="h-12 w-12 text-yellow-500" />
      case 'info':
        return <AlertCircle className="h-12 w-12 text-blue-500" />
    }
  }

  const getButtonColor = () => {
    switch (type) {
      case 'success':
        return 'bg-green-600 hover:bg-green-700'
      case 'error':
        return 'bg-red-600 hover:bg-red-700'
      case 'warning':
        return 'bg-yellow-600 hover:bg-yellow-700'
      case 'info':
        return 'bg-blue-600 hover:bg-blue-700'
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-60">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        <div className="p-6 border-b border-gray-200">
          <h3 className="text-xl font-semibold text-gray-900">{title}</h3>
        </div>

        <div className="p-6">
          <div className="text-center mb-6">
            <div className="flex justify-center mb-4">
              {getIcon()}
            </div>
            <div className="text-gray-700 whitespace-pre-line">{message}</div>
          </div>

          <div className={`flex ${onConfirm ? 'grid grid-cols-2 gap-3' : 'justify-center'}`}>
            {onConfirm && (
              <button
                onClick={onClose}
                className="px-4 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
              >
                {cancelText}
              </button>
            )}
            <button
              onClick={onConfirm || onClose}
              className={`px-4 py-3 text-white rounded-lg transition-colors ${getButtonColor()} ${!onConfirm ? 'w-full' : ''}`}
            >
              {confirmText}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// Metode pembayaran
const PAYMENT_METHODS = [
  { value: 'cash', label: 'Cash' },
  { value: 'card', label: 'Kartu Kredit/Debit' },
  { value: 'qris', label: 'QRIS' },
  { value: 'transfer', label: 'Transfer Bank' },
  { value: 'ovo', label: 'OVO' },
  { value: 'gopay', label: 'GoPay' }
] as const

// Jenis order
const ORDER_TYPES = [
  { value: 'openbill', label: 'Open Bill' },
  { value: 'closebill', label: 'Close Bill' }
] as const

export default function OrdersPage() {
  // State utama
  const [orders, setOrders] = useState<Order[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [orderTypeFilter, setOrderTypeFilter] = useState<string>('all')
  const [isMobile, setIsMobile] = useState(false)
  const [selectedDate, setSelectedDate] = useState<string>('')

  // State untuk statistik dari database
  const [pendingCount, setPendingCount] = useState(0)
  const [todayRevenue, setTodayRevenue] = useState(0)
  const [todayOrdersCount, setTodayOrdersCount] = useState(0)
  const [totalRevenue, setTotalRevenue] = useState(0)
  const [completedCount, setCompletedCount] = useState(0)
  const [processingCount, setProcessingCount] = useState(0)
  const [cancelledCount, setCancelledCount] = useState(0)
  const [statsLoading, setStatsLoading] = useState(true)

  // State pagination
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage, setItemsPerPage] = useState(10)
  const [totalOrders, setTotalOrders] = useState(0)
  const [filteredOrders, setFilteredOrders] = useState<Order[]>([])

  // State modal
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showDetailModal, setShowDetailModal] = useState(false)
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null)
  const [submitLoading, setSubmitLoading] = useState(false)

  // State untuk update order di modal detail
  const [isUpdating, setIsUpdating] = useState(false)
  const [updateForm, setUpdateForm] = useState<{
    customer_name: string
    customer_phone: string
    payment_method: string
    notes: string
    status: Order['status']
    order_type: 'openbill' | 'closebill'
    items: Array<{
      id?: string
      product_id: string
      quantity: number
      price: number
      product_name?: string
      subtotal: number
    }>
  }>({
    customer_name: '',
    customer_phone: '',
    payment_method: 'cash',
    notes: '',
    status: 'pending',
    order_type: 'openbill',
    items: []
  })

  // State untuk printer Bluetooth
  const [bluetoothPrinter, setBluetoothPrinter] = useState<BluetoothPrinter | null>(null)
  const [isConnecting, setIsConnecting] = useState(false)
  const [isPrinting, setIsPrinting] = useState(false)
  const [showPrinterConfig, setShowPrinterConfig] = useState(false)
  const [bluetoothSupported, setBluetoothSupported] = useState(false)
  const [printProgress, setPrintProgress] = useState({ current: 0, total: 0 })

  // State untuk Alert Modals
  const [alertModal, setAlertModal] = useState<{
    isOpen: boolean
    title: string
    message: string
    type: 'success' | 'error' | 'warning' | 'info'
    onConfirm?: () => void
    confirmText?: string
    cancelText?: string
  }>({
    isOpen: false,
    title: '',
    message: '',
    type: 'info'
  })

  // Konfigurasi printer
  const [printerConfig, setPrinterConfig] = useState<PrinterConfig>({
    copies: 1,
    paperWidth: 58,
    fontSize: 1,
    boldTitle: true,
    showLogo: true,
    storeName: 'EATOPIA CAFE',
    storeAddress: 'Jl. Restoran No. 123',
    storePhone: '0812-3456-7890',
    storeKasir: 'Ilham',
    chunkSize: 200,
    chunkDelay: 30
  })

  // State modal konfirmasi cetak
  const [showPrintConfirmation, setShowPrintConfirmation] = useState(false)
  const [orderToPrint, setOrderToPrint] = useState<Order | null>(null)

  // State UI
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set())
  const [showMobileMenu, setShowMobileMenu] = useState<string | null>(null)
  const [showExportModal, setShowExportModal] = useState(false)

  // State form
  const [formData, setFormData] = useState<OrderFormData>({
    customer_name: '',
    customer_phone: '',
    payment_method: 'cash',
    notes: '',
    order_type: 'openbill',
    items: []
  })

  // Ref untuk tracking previous selectedDate
  const prevSelectedDateRef = useRef<string>('')
  const isInitialMount = useRef(true)

  // ============================
  // FUNGSI UTILITAS
  // ============================

  // Fungsi untuk menampilkan alert modal
  const showAlert = (
    title: string,
    message: string,
    type: 'success' | 'error' | 'warning' | 'info' = 'info',
    onConfirm?: () => void,
    confirmText?: string,
    cancelText?: string
  ) => {
    setAlertModal({
      isOpen: true,
      title,
      message,
      type,
      onConfirm,
      confirmText,
      cancelText
    })
  }

  // Fungsi untuk menutup alert modal
  const closeAlert = () => {
    setAlertModal(prev => ({ ...prev, isOpen: false }))
  }

  // Format currency
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0
    }).format(amount)
  }

  // Helper functions untuk UI
  const getStatusColor = (status: Order['status']) => {
    switch (status) {
      case 'pending': return 'bg-yellow-100 text-yellow-800 border-yellow-200'
      case 'processing': return 'bg-blue-100 text-blue-800 border-blue-200'
      case 'completed': return 'bg-green-100 text-green-800 border-green-200'
      case 'cancelled': return 'bg-red-100 text-red-800 border-red-200'
      default: return 'bg-gray-100 text-gray-800 border-gray-200'
    }
  }

  const getStatusIcon = (status: Order['status']) => {
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
      case 'ovo': return <CreditCard className="h-4 w-4" />
      case 'gopay': return <CreditCard className="h-4 w-4" />
      default: return <CreditCard className="h-4 w-4" />
    }
  }

  const getPaymentMethodLabel = (method: string) => {
    const paymentMethod = PAYMENT_METHODS.find(pm => pm.value === method)
    return paymentMethod ? paymentMethod.label : method
  }

  const getOrderTypeLabel = (type: string) => {
    const orderType = ORDER_TYPES.find(ot => ot.value === type)
    return orderType ? orderType.label : type
  }

  const getOrderTypeIcon = (type: 'openbill' | 'closebill') => {
    if (type === 'closebill') return '🥡'
    return '🍽️'
  }

  const getOrderTypeColor = (type: 'openbill' | 'closebill') => {
    return type === 'closebill'
      ? 'bg-green-100 text-green-800 border-green-200'
      : 'bg-blue-100 text-blue-800 border-blue-200'
  }

  // ============================
  // FUNGSI FETCH DATA
  // ============================

  // Fetch jumlah order pending dari database
  const fetchPendingCount = async () => {
    try {
      let query = supabase
        .from('orders')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'pending')

      // Filter berdasarkan tanggal jika dipilih
      if (selectedDate) {
        const startDate = new Date(selectedDate)
        startDate.setHours(0, 0, 0, 0)
        const endDate = new Date(selectedDate)
        endDate.setHours(23, 59, 59, 999)

        query = query
          .gte('created_at', startDate.toISOString())
          .lte('created_at', endDate.toISOString())
      }

      const { count, error } = await query

      if (error) throw error
      setPendingCount(count || 0)
    } catch (error) {
      console.error('Error fetching pending count:', error)
    }
  }

  // Fetch jumlah order processing dari database
  const fetchProcessingCount = async () => {
    try {
      let query = supabase
        .from('orders')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'processing')

      if (selectedDate) {
        const startDate = new Date(selectedDate)
        startDate.setHours(0, 0, 0, 0)
        const endDate = new Date(selectedDate)
        endDate.setHours(23, 59, 59, 999)

        query = query
          .gte('created_at', startDate.toISOString())
          .lte('created_at', endDate.toISOString())
      }

      const { count, error } = await query
      if (error) throw error
      setProcessingCount(count || 0)
    } catch (error) {
      console.error('Error fetching processing count:', error)
    }
  }

  // Fetch jumlah order completed dari database
  const fetchCompletedCount = async () => {
    try {
      let query = supabase
        .from('orders')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'completed')

      if (selectedDate) {
        const startDate = new Date(selectedDate)
        startDate.setHours(0, 0, 0, 0)
        const endDate = new Date(selectedDate)
        endDate.setHours(23, 59, 59, 999)

        query = query
          .gte('created_at', startDate.toISOString())
          .lte('created_at', endDate.toISOString())
      }

      const { count, error } = await query
      if (error) throw error
      setCompletedCount(count || 0)
    } catch (error) {
      console.error('Error fetching completed count:', error)
    }
  }

  // Fetch jumlah order cancelled dari database
  const fetchCancelledCount = async () => {
    try {
      let query = supabase
        .from('orders')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'cancelled')

      if (selectedDate) {
        const startDate = new Date(selectedDate)
        startDate.setHours(0, 0, 0, 0)
        const endDate = new Date(selectedDate)
        endDate.setHours(23, 59, 59, 999)

        query = query
          .gte('created_at', startDate.toISOString())
          .lte('created_at', endDate.toISOString())
      }

      const { count, error } = await query
      if (error) throw error
      setCancelledCount(count || 0)
    } catch (error) {
      console.error('Error fetching cancelled count:', error)
    }
  }

  // Fungsi untuk menghitung pendapatan hari ini dari database
  const fetchTodayRevenue = async () => {
    try {
      let query = supabase
        .from('orders')
        .select('total_amount')

      // Filter berdasarkan tanggal jika dipilih
      if (selectedDate) {
        const startDate = new Date(selectedDate)
        startDate.setHours(0, 0, 0, 0)
        const endDate = new Date(selectedDate)
        endDate.setHours(23, 59, 59, 999)

        query = query
          .gte('created_at', startDate.toISOString())
          .lte('created_at', endDate.toISOString())
      } else {
        // Default: hari ini
        const today = new Date()
        today.setHours(0, 0, 0, 0)
        const tomorrow = new Date(today)
        tomorrow.setDate(tomorrow.getDate() + 1)

        query = query
          .gte('created_at', today.toISOString())
          .lt('created_at', tomorrow.toISOString())
      }

      const { data: revenueData, error: revenueError } = await query

      if (revenueError) throw revenueError

      // Hitung total revenue
      const revenue = revenueData?.reduce((sum, order) => sum + order.total_amount, 0) || 0
      setTodayRevenue(revenue)

    } catch (error: any) {
      console.error('Error fetching today revenue:', error)
    }
  }

  // Fungsi untuk menghitung total revenue dari database
  const fetchTotalRevenue = async () => {
    try {
      const { data, error } = await supabase
        .from('orders')
        .select('total_amount')
        .eq('status', 'completed')

      if (error) throw error

      const revenue = data?.reduce((sum, order) => sum + order.total_amount, 0) || 0
      setTotalRevenue(revenue)

    } catch (error: any) {
      console.error('Error fetching total revenue:', error)
    }
  }

  // Fungsi untuk menghitung jumlah order hari ini
  const fetchTodayOrdersCount = async () => {
    try {
      let query = supabase
        .from('orders')
        .select('id', { count: 'exact', head: true })

      if (selectedDate) {
        const startDate = new Date(selectedDate)
        startDate.setHours(0, 0, 0, 0)
        const endDate = new Date(selectedDate)
        endDate.setHours(23, 59, 59, 999)

        query = query
          .gte('created_at', startDate.toISOString())
          .lte('created_at', endDate.toISOString())
      } else {
        // Default: hari ini
        const today = new Date()
        today.setHours(0, 0, 0, 0)
        const tomorrow = new Date(today)
        tomorrow.setDate(tomorrow.getDate() + 1)

        query = query
          .gte('created_at', today.toISOString())
          .lt('created_at', tomorrow.toISOString())
      }

      const { count, error } = await query

      if (error) throw error
      setTodayOrdersCount(count || 0)

    } catch (error: any) {
      console.error('Error fetching today orders count:', error)
    }
  }

  // Fungsi untuk mengambil semua statistik sekaligus
  const fetchAllStats = async () => {
    try {
      setStatsLoading(true)
      await Promise.all([
        fetchPendingCount(),
        fetchProcessingCount(),
        fetchCompletedCount(),
        fetchCancelledCount(),
        fetchTodayRevenue(),
        fetchTotalRevenue(),
        fetchTodayOrdersCount()
      ])
    } catch (error) {
      console.error('Error fetching all stats:', error)
    } finally {
      setStatsLoading(false)
    }
  }

  // Fetch total count orders
  const fetchTotalOrders = async () => {
    try {
      let query = supabase
        .from('orders')
        .select('id', { count: 'exact', head: true })

      // Filter by date jika dipilih
      if (selectedDate) {
        const startDate = new Date(selectedDate)
        startDate.setHours(0, 0, 0, 0)
        const endDate = new Date(selectedDate)
        endDate.setHours(23, 59, 59, 999)

        query = query
          .gte('created_at', startDate.toISOString())
          .lte('created_at', endDate.toISOString())
      }

      // Filter by status
      if (statusFilter !== 'all') {
        query = query.eq('status', statusFilter)
      }

      // Filter by order type - DIHAPUS
      // if (orderTypeFilter !== 'all') {
      //   query = query.eq('order_type', orderTypeFilter)
      // }

      const { count, error } = await query

      if (error) throw error
      setTotalOrders(count || 0)
    } catch (error) {
      console.error('Error fetching total orders:', error)
    }
  }

  // Fetch orders dengan pagination - DIPERBAIKI
  const fetchOrders = async () => {
    try {
      setLoading(true)

      // Hitung offset untuk pagination
      const from = (currentPage - 1) * itemsPerPage
      const to = from + itemsPerPage - 1

     let query = supabase
  .from('orders')
  .select(`
    *,
    order_items(
      *,
      products:product_id(*)
    )
  `, { count: 'exact' })
        .order('created_at', { ascending: false })
        .range(from, to)

      // Filter by date - DIPERBAIKI: selalu filter berdasarkan tanggal
      if (selectedDate) {
        const startDate = new Date(selectedDate)
        startDate.setHours(0, 0, 0, 0)
        const endDate = new Date(selectedDate)
        endDate.setHours(23, 59, 59, 999)

        query = query
          .gte('created_at', startDate.toISOString())
          .lte('created_at', endDate.toISOString())
      } else {
        // Default: tampilkan hari ini
        const today = new Date()
        today.setHours(0, 0, 0, 0)
        const tomorrow = new Date(today)
        tomorrow.setDate(tomorrow.getDate() + 1)

        query = query
          .gte('created_at', today.toISOString())
          .lt('created_at', tomorrow.toISOString())
      }

      // Filter by status
      if (statusFilter !== 'all') {
        query = query.eq('status', statusFilter)
      }

      // Filter by order type - DIHAPUS
      // if (orderTypeFilter !== 'all') {
      //   query = query.eq('order_type', orderTypeFilter)
      // }

      const { data: ordersData, error: ordersError, count } = await query

      if (ordersError) {
        console.error('Error query utama:', ordersError)
        throw ordersError
      }

      setOrders(ordersData || [])
      setTotalOrders(count || 0)
      setFilteredOrders(ordersData || []) // Langsung set filtered orders

    } catch (error: any) {
      console.error('❌ Error fetching orders:', error)
      showAlert(
        'Gagal Memuat Data',
        'Gagal memuat data order: ' + error.message,
        'error'
      )
    } finally {
      setLoading(false)
    }
  }

  // Apply search filter ke data yang sudah di-fetch
  const applySearchFilter = (data: Order[]) => {
    if (!searchTerm.trim()) {
      setFilteredOrders(data)
      return
    }

    const filtered = data.filter(order => {
      const searchLower = searchTerm.toLowerCase()
      return (
        order.order_number.toLowerCase().includes(searchLower) ||
        order.customer_name?.toLowerCase().includes(searchLower) ||
        order.customer_phone?.includes(searchTerm)
      )
    })

    setFilteredOrders(filtered)
  }

  // Fetch products
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
      showAlert(
        'Gagal Memuat Produk',
        'Gagal memuat data produk: ' + error.message,
        'error'
      )
    }
  }

  // ============================
  // USE EFFECTS
  // ============================

  // Load konfigurasi dari localStorage saat pertama kali render
  useEffect(() => {
    const savedConfig = localStorage.getItem('printerConfig')
    if (savedConfig) {
      try {
        setPrinterConfig(JSON.parse(savedConfig))
      } catch (e) {
        console.error('Error loading printer config:', e)
      }
    }

    // Cek dukungan Bluetooth
    checkBluetoothSupport()
  }, [])

  // Save konfigurasi ke localStorage saat berubah
  useEffect(() => {
    localStorage.setItem('printerConfig', JSON.stringify(printerConfig))
  }, [printerConfig])

  // Use effect untuk fetch data saat pertama kali load
  useEffect(() => {
    const fetchInitialData = async () => {
      await fetchProducts()
      await fetchOrders()
      await fetchTotalOrders()
      await fetchAllStats()
    }

    fetchInitialData()
    checkMobile()

    const handleResize = () => checkMobile()
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  // Effect untuk handle perubahan selectedDate - DIPERBAIKI
  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false
      return
    }

    // Cek jika selectedDate benar-benar berubah
    if (selectedDate !== prevSelectedDateRef.current) {
      console.log('Selected date changed to:', selectedDate)
      prevSelectedDateRef.current = selectedDate

      // Reset ke halaman 1 dan fetch data
      setCurrentPage(1)

      // Fetch semua data terkait tanggal
      const fetchData = async () => {
        await fetchOrders()
        await fetchTotalOrders()
        await fetchAllStats()
      }

      fetchData()
    }
  }, [selectedDate])

  // Effect untuk handle perubahan statusFilter - DIPERBAIKI
  useEffect(() => {
    if (isInitialMount.current) return

    console.log('Status filter changed to:', statusFilter)
    setCurrentPage(1)

    const fetchData = async () => {
      await fetchOrders()
      await fetchTotalOrders()
      await fetchAllStats()
    }

    fetchData()
  }, [statusFilter])

  // Effect untuk handle perubahan pagination
  useEffect(() => {
    if (isInitialMount.current) return

    console.log('Pagination changed:', { currentPage, itemsPerPage })

    const fetchData = async () => {
      await fetchOrders()
      await fetchTotalOrders()
    }

    fetchData()
  }, [currentPage, itemsPerPage])

  // Update useEffect untuk search
  useEffect(() => {
    if (searchTerm.trim()) {
      // Apply filter ke data yang sudah ada
      applySearchFilter(orders)
    } else {
      setFilteredOrders(orders)
    }
  }, [searchTerm, orders])

  const checkMobile = () => {
    setIsMobile(window.innerWidth < 768)
  }

  // Load data ke form update ketika order dipilih - DIPERBAIKI
  useEffect(() => {
    if (selectedOrder) {
      // Format items untuk update form
      const formattedItems = selectedOrder.order_items?.map(item => ({
        id: item.id,
        product_id: item.product_id,
        quantity: item.quantity,
        price: item.price,
        product_name: item.products?.name,
        subtotal: item.price * item.quantity
      })) || []

      setUpdateForm({
        customer_name: selectedOrder.customer_name || '',
        customer_phone: selectedOrder.customer_phone || '',
        payment_method: selectedOrder.payment_method || 'cash',
        notes: selectedOrder.notes || '',
        status: selectedOrder.status,
        order_type: selectedOrder.order_type || 'openbill',
        items: formattedItems
      })
    }
  }, [selectedOrder])

  // ============================
  // PAGINATION FUNCTIONS
  // ============================

  // Pagination controls
  const totalPages = Math.ceil(totalOrders / itemsPerPage)
  const hasPreviousPage = currentPage > 1
  const hasNextPage = currentPage < totalPages

  const goToPage = (page: number) => {
    if (page >= 1 && page <= totalPages) {
      setCurrentPage(page)
    }
  }

  const goToPreviousPage = () => {
    if (hasPreviousPage) {
      setCurrentPage(prev => prev - 1)
    }
  }

  const goToNextPage = () => {
    if (hasNextPage) {
      setCurrentPage(prev => prev + 1)
    }
  }

  // ============================
  // HANDLER FUNCTIONS
  // ============================

  // Handle search
  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(e.target.value)
  }

  // Handle date change dengan immediate refresh
  const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newDate = e.target.value
    console.log('Date changed to:', newDate)
    setSelectedDate(newDate)
  }

  // Handle status filter change
  const handleStatusFilterChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setStatusFilter(e.target.value)
  }

  // Reset ke hari ini
  const resetToToday = () => {
    const today = new Date()
    const todayFormatted = today.toISOString().split('T')[0]

    setSelectedDate(todayFormatted)
    setCurrentPage(1)
  }

  // Clear date filter
  const clearDateFilter = () => {
    setSelectedDate('')
    setCurrentPage(1)
  }

  // ============================
  // FUNGSI BLUETOOTH PRINTER
  // ============================

  // Cek dukungan Web Bluetooth API
  const checkBluetoothSupport = () => {
    const navigatorWithBluetooth = navigator as any
    const supported = !!(navigatorWithBluetooth && navigatorWithBluetooth.bluetooth)
    setBluetoothSupported(supported)

    if (!supported) {
      console.warn('Web Bluetooth API tidak didukung di browser ini')
    }

    return supported
  }

  // Connect ke printer Bluetooth
  const connectBluetoothPrinter = async () => {
    if (!checkBluetoothSupport()) {
      showAlert(
        'Browser Tidak Didukung',
        'Browser tidak mendukung Web Bluetooth API. Gunakan Chrome, Edge, atau Opera versi terbaru.',
        'error'
      )
      return
    }

    try {
      setIsConnecting(true)

      // Filter untuk printer ESC/POS
      const options = {
        filters: [
          { services: ['000018f0-0000-1000-8000-00805f9b34fb'] }, // ESC/POS service
          { namePrefix: 'Blue' },
          { namePrefix: 'BT' },
          { namePrefix: 'Printer' },
          { namePrefix: 'POS' }
        ],
        optionalServices: [
          '000018f0-0000-1000-8000-00805f9b34fb',
          '00001800-0000-1000-8000-00805f9b34fb',
          '00001801-0000-1000-8000-00805f9b34fb'
        ]
      }

      console.log('🔍 Mencari printer Bluetooth...')

      const navigatorWithBluetooth = navigator as any
      const device = await navigatorWithBluetooth.bluetooth.requestDevice(options)

      if (!device) {
        throw new Error('Tidak ada printer yang dipilih')
      }

      console.log('📱 Printer ditemukan:', device.name)

      const server = await device.gatt?.connect()

      if (!server) {
        throw new Error('Gagal connect ke server Bluetooth')
      }

      console.log('🔗 Terhubung ke GATT server')

      // Coba beberapa service UUID
      const serviceUUIDs = [
        '000018f0-0000-1000-8000-00805f9b34fb', // ESC/POS
        '0000ffe0-0000-1000-8000-00805f9b34fb', // Generic
        '0000ae00-0000-1000-8000-00805f9b34fb'  // Thermal Printer
      ]

      let service = null
      let characteristic = null

      for (const uuid of serviceUUIDs) {
        try {
          service = await server.getPrimaryService(uuid)
          if (service) {
            // Coba beberapa characteristic UUID
            const charUUIDs = [
              '00002af1-0000-1000-8000-00805f9b34fb',
              '0000ffe1-0000-1000-8000-00805f9b34fb',
              '0000ae01-0000-1000-8000-00805f9b34fb'
            ]

            for (const charUUID of charUUIDs) {
              try {
                characteristic = await service.getCharacteristic(charUUID)
                if (characteristic) {
                  break
                }
              } catch (e) {
                console.log(`Characteristic ${charUUID} tidak ditemukan`)
              }
            }
            break
          }
        } catch (e) {
          console.log(`Service ${uuid} tidak ditemukan`)
        }
      }

      if (!service || !characteristic) {
        throw new Error('Service atau Characteristic tidak ditemukan. Pastikan printer mendukung ESC/POS.')
      }

      const printer: BluetoothPrinter = {
        device,
        server,
        service,
        characteristic
      }

      setBluetoothPrinter(printer)

      device.addEventListener('gattserverdisconnected', handleDisconnected)

      showAlert(
        'Printer Terhubung',
        `✅ Printer terhubung: ${device.name || 'Unknown Device'}`,
        'success'
      )

    } catch (error: any) {
      console.error('❌ Error connecting to Bluetooth printer:', error)

      if (error.name === 'NotFoundError') {
        showAlert(
          'Printer Tidak Ditemukan',
          'Printer Bluetooth tidak ditemukan. Pastikan:\n1. Printer sudah dinyalakan\n2. Bluetooth aktif\n3. Printer dalam mode pairing',
          'warning'
        )
      } else if (error.name === 'SecurityError') {
        showAlert(
          'Izin Ditolak',
          'Izin Bluetooth ditolak. Pastikan Anda memberikan izin untuk mengakses Bluetooth.',
          'error'
        )
      } else if (error.name === 'NetworkError') {
        showAlert(
          'Koneksi Terputus',
          'Koneksi terputus. Pastikan printer dalam jangkauan.',
          'error'
        )
      } else {
        showAlert(
          'Gagal Menghubungkan',
          'Gagal menghubungkan ke printer: ' + error.message,
          'error'
        )
      }
    } finally {
      setIsConnecting(false)
    }
  }

  // Handle disconnect
  const handleDisconnected = () => {
    console.log('🔌 Printer disconnected')
    setBluetoothPrinter(null)
    showAlert(
      'Printer Terputus',
      'Printer terputus. Silakan hubungkan kembali.',
      'warning'
    )
  }

  const printToBluetoothPrinter = async (order: Order) => {
    if (!bluetoothPrinter?.characteristic) {
      showAlert(
        'Printer Belum Terhubung',
        'Printer Bluetooth belum terhubung. Akan menggunakan print browser.',
        'warning',
        () => printStrukBrowser(order)
      )
      return
    }

    try {
      setIsPrinting(true)

      // ESC/POS commands
      const ESC = '\x1B'
      const LF = '\x0A'
      const FS = '\x1C'
      const GS = '\x1D'

      // Tipe data untuk Order
      interface OrderItem {
        quantity: number
        price: number
        products?: {
          name: string
        }
      }

      interface Order {
        order_number: string
        created_at: string | Date
        status: string
        customer_name?: string
        order_items?: OrderItem[]
        total_amount: number
        payment_method: string
      }

      // Tipe data untuk Printer Config
      interface PrinterConfig {
        boldTitle: boolean
        storeName: string
        storeAddress: string
        storePhone: string
        storeKasir: string
        paperWidth: number
      }

      // Helper function untuk format currency
      const formatCurrency = (amount: number): string => {
        return amount.toLocaleString('id-ID')
      }

      // Helper function untuk payment method label
      const getPaymentMethodLabel = (method: string): string => {
        const methods: { [key: string]: string } = {
          'cash': 'CASH',
          'transfer': 'TRANSFER',
          'qris': 'QRIS',
          'debit': 'KARTU DEBIT',
          'credit': 'KARTU KREDIT'
        }
        return methods[method] || method.toUpperCase()
      }

      // Struktur struk yang efisien
      const generateEfficientStruk = (order: Order, printerConfig: PrinterConfig): string => {
        const lines: string[] = []

        // Initialize printer
        lines.push(ESC + '@')

        // Header - Center aligned
        lines.push(ESC + 'a' + '\x01')

        // Store name dengan bold jika diaktifkan
        if (printerConfig.boldTitle) {
          lines.push(ESC + 'E' + '\x01')
        }
        lines.push(printerConfig.storeName)
        lines.push(LF)

        if (printerConfig.boldTitle) {
          lines.push(ESC + 'E' + '\x00') // Bold off
        }

        // Store info
        lines.push(printerConfig.storeAddress)
        lines.push(LF)
        lines.push('Telp: ' + printerConfig.storePhone)
        lines.push(LF)

        // Separator
        lines.push('='.repeat(printerConfig.paperWidth === 80 ? 40 : 32))
        lines.push(LF)

        // Left align untuk konten
        lines.push(ESC + 'a' + '\x00')

        // Order info (singkat)
        lines.push('No: ' + order.order_number)
        lines.push(LF)

        const orderDate = new Date(order.created_at)
        lines.push('Tgl: ' + orderDate.toLocaleDateString('id-ID')) + ('Jam: ' + orderDate.toLocaleTimeString('id-ID', {
          hour: '2-digit',
          minute: '2-digit'
        }))
        {/*  lines.push(LF)
        lines.push('Wkt: ' + orderDate.toLocaleTimeString('id-ID', {
          hour: '2-digit',
          minute: '2-digit'
        })) */}
        lines.push(LF)
        lines.push('Kasir: ' + printerConfig.storeKasir)
        lines.push(LF)


        // Customer info jika ada
        if (order.customer_name) {
          lines.push('Cust: ' + order.customer_name.substring(0, 15))
          lines.push(LF)
        }
        // Payment info - PASTIKAN PAYMENT_METHOD ADA
        const paymentMethod = order.payment_method || 'cash'
        lines.push('Payment: ' + getPaymentMethodLabel(paymentMethod))
        lines.push(LF)


        // Separator
        lines.push('-'.repeat(printerConfig.paperWidth === 80 ? 40 : 32))
        lines.push(LF)

        // FORMAT YANG RAPIH DENGAN PENJAGAAN UNTUK ORDER_ITEMS
        const paperWidth = printerConfig.paperWidth === 80 ? 40 : 32

        // Header tabel
        const header = 'ITEM'.padEnd(19) + 'QTY'.padStart(3) + 'SUBTOTAL'.padStart(10)
        lines.push(header)
        lines.push(LF)
        lines.push('-'.repeat(paperWidth))
        lines.push(LF)

        // Items - DENGAN PENJAGAAN UNTUK ORDER_ITEMS YANG MUNGKIN UNDEFINED
        if (order.order_items && order.order_items.length > 0) {
          // Gunakan slice hanya jika order_items ada
          const itemsToShow = order.order_items.slice(0, 10)

          itemsToShow.forEach((item: OrderItem) => {
            const productName = item.products?.name || 'Produk'

            // Potong nama jika terlalu panjang
            let itemName = productName
            if (productName.length > 17) {
              itemName = productName.substring(0, 15) + '..'
            }

            const qty = item.quantity.toString().padStart(2)
            const subtotal = formatCurrency(item.price * item.quantity).padStart(8)

            // Format: ITEM(19 chars) + QTY(3 chars) + SUBTOTAL(10 chars)
            const itemLine = itemName.padEnd(19) + qty.padStart(3) + subtotal.padStart(10)
            lines.push(itemLine)
            lines.push(LF)
          })

          // Tampilkan pesan jika ada item lebih dari 10
          if (order.order_items.length > 10) {
            lines.push(`...+${order.order_items.length - 10} item lain`)
            lines.push(LF)
          }
        } else {
          // Jika tidak ada items
          lines.push('Tidak ada item'.padStart(paperWidth))
          lines.push(LF)
        }

        // Separator
        lines.push('-'.repeat(paperWidth))
        lines.push(LF)

        // TOTAL dengan justify - PASTIKAN TOTAL_AMOUNT ADA
        const totalAmount = order.total_amount || 0
        const totalLabel = 'TOTAL:'
        const totalValue = 'Rp ' + formatCurrency(totalAmount)

        // Hitung spasi yang dibutuhkan untuk justify
        const spacesNeeded = paperWidth - totalLabel.length - totalValue.length
        const totalLine = totalLabel + ' '.repeat(Math.max(1, spacesNeeded)) + totalValue

        lines.push(ESC + 'E' + '\x01') // Bold on
        lines.push(totalLine)
        lines.push(LF)
        lines.push(ESC + 'E' + '\x00') // Bold off

        // Separator akhir
        lines.push('='.repeat(paperWidth))
        lines.push(LF)

        // Footer - Center aligned
        lines.push(ESC + 'a' + '\x01')
        lines.push('Terima kasih atas kunjungan Anda')
        lines.push(LF)
        lines.push('*** ' + new Date().toLocaleDateString('id-ID') + ' ***')
        lines.push(LF)

        // Feed beberapa baris
        lines.push(ESC + 'd' + '\x03') // Feed 3 lines

        // Cut paper
        lines.push(GS + 'V' + '\x41' + '\x00')

        return lines.join('')
      }

      // Untuk menggunakan dengan kode lama Anda:
      const strukData = generateEfficientStruk(order, printerConfig)

      const encoder = new TextEncoder()
      const data = encoder.encode(strukData)

      // Bagi menjadi chunk
      const chunks = chunkData(data, printerConfig.chunkSize)
      setPrintProgress({ current: 0, total: chunks.length })

      // Kirim data per chunk
      for (let i = 0; i < chunks.length; i++) {
        await bluetoothPrinter.characteristic.writeValue(chunks[i])
        setPrintProgress({ current: i + 1, total: chunks.length })

        if (printerConfig.chunkDelay > 0) {
          await new Promise(resolve => setTimeout(resolve, printerConfig.chunkDelay))
        }
      }

      // Reset progress
      setPrintProgress({ current: 0, total: 0 })

      showAlert(
        'Struk Berhasil Dicetak',
        'Struk telah berhasil dicetak!',
        'success'
      )

    } catch (error: any) {
      console.error('Error printing to Bluetooth:', error)
      showAlert(
        'Gagal Mencetak ke Bluetooth',
        'Gagal mencetak ke printer Bluetooth: ' + error.message + '\n\nMencoba print via browser...',
        'warning',
        () => printStrukBrowser(order)
      )
    } finally {
      setIsPrinting(false)
    }
  }

  // Disconnect printer
  const disconnectPrinter = () => {
    if (bluetoothPrinter?.device?.gatt?.connected) {
      bluetoothPrinter.device.gatt.disconnect()
    }
    setBluetoothPrinter(null)
    showAlert(
      'Printer Terputus',
      'Printer telah diputuskan',
      'success'
    )
  }

  // ============================
  // FUNGSI CETAK
  // ============================
  const chunkData = (data: Uint8Array, chunkSize: number): Uint8Array[] => {
    const chunks: Uint8Array[] = []
    for (let i = 0; i < data.length; i += chunkSize) {
      chunks.push(data.slice(i, i + chunkSize))
    }
    return chunks
  }


  // Print test page
  const printTestPage = async () => {
    if (!bluetoothPrinter?.characteristic) {
      showAlert(
        'Printer Belum Terhubung',
        'Printer Bluetooth belum terhubung.',
        'warning'
      )
      return
    }

    try {
      setIsPrinting(true)

      // Test page yang sederhana
      const ESC = '\x1B'
      const LF = '\x0A'

      const testData = [
        ESC + '@', // Initialize
        ESC + 'a' + '\x01', // Center
        'TEST PRINTER' + LF,
        '='.repeat(32) + LF,
        ESC + 'a' + '\x00', // Left
        'Date: ' + new Date().toLocaleDateString('id-ID') + LF,
        'Time: ' + new Date().toLocaleTimeString('id-ID') + LF,
        '-'.repeat(32) + LF,
        'Line 1: ABCDEFGHIJ' + LF,
        'Line 2: 1234567890' + LF,
        'Line 3: !@#$%^&*()' + LF,
        '-'.repeat(32) + LF,
        ESC + 'a' + '\x01', // Center
        'TEST BERHASIL!' + LF,
        ESC + 'd' + '\x03', // Feed 3 lines
        '\x1DV\x41\x00' // Cut
      ].join('')

      const encoder = new TextEncoder()
      const data = encoder.encode(testData)

      // Bagi menjadi chunk kecil
      const chunks = chunkData(data, 100)

      for (let i = 0; i < chunks.length; i++) {
        await bluetoothPrinter.characteristic.writeValue(chunks[i])
        await new Promise(resolve => setTimeout(resolve, 30))
      }

      showAlert(
        'Test Berhasil',
        'Test page berhasil dicetak!',
        'success'
      )

    } catch (error: any) {
      console.error('Error printing test page:', error)
      showAlert(
        'Gagal Mencetak',
        'Gagal mencetak test page: ' + error.message,
        'error'
      )
    } finally {
      setIsPrinting(false)
    }
  }
  // Print struk (fungsi utama)
const printStruk = async (order: Order, forcePrint: boolean = false) => {
    // Cek jika order type openbill
    if (order.order_type === 'openbill' && !forcePrint) {
      // Jika status sudah completed, boleh cetak struk
      if (order.status !== 'completed') {
        showAlert(
          'Order Open Bill',
          `Order ${order.order_number} adalah Open Bill.\nCetak struk hanya saat selesai/checkout.`,
          'warning'
        )
        return
      }
    }

    // Proses printing untuk take away
    if (bluetoothPrinter) {
      // Logika print ke Bluetooth printer
      await printToBluetoothPrinter(order)
    } else {
      // Fallback ke print browser jika Bluetooth tidak tersedia
      printStrukBrowser(order)
    }
  }

  // Fallback ke browser print
  const printStrukBrowser = (order: Order) => {
    const strukContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Struk ${order.order_number}</title>
        <style>
          @media print {
            @page {
              margin: 0;
              size: ${printerConfig.paperWidth}mm auto;
            }
            body {
              margin: 0;
              padding: 8px;
              font-family: 'Courier New', monospace;
              font-size: 12px;
              width: ${printerConfig.paperWidth}mm;
            }
          }
          body {
            margin: 0;
            padding: 8px;
            font-family: 'Courier New', monospace;
            font-size: 12px;
            width: ${printerConfig.paperWidth}mm;
          }
          .header {
            text-align: center;
            margin-bottom: 10px;
            border-bottom: 1px dashed #000;
            padding-bottom: 8px;
          }
          .store-name {
            font-weight: bold;
            font-size: ${printerConfig.fontSize === 2 ? '18px' : printerConfig.fontSize === 3 ? '20px' : '16px'};
          }
          .order-info {
            margin: 8px 0;
          }
          .order-type {
            text-align: center;
            font-weight: bold;
            margin: 5px 0;
            padding: 3px;
            border-radius: 4px;
          }
          .takeaway {
            background-color: #d1fae5;
            color: #065f46;
          }
          .dinein {
            background-color: #dbeafe;
            color: #1e40af;
          }
          .items {
            margin: 10px 0;
            border-bottom: 1px dashed #000;
            padding-bottom: 8px;
          }
          .item-row {
            display: flex;
            justify-content: space-between;
            margin: 3px 0;
          }
          .item-name {
            flex: 2;
          }
          .item-qty {
            flex: 1;
            text-align: center;
          }
          .item-price {
            flex: 1;
            text-align: right;
          }
          .total {
            display: flex;
            justify-content: space-between;
            font-weight: bold;
            text-align: center;
            margin: 10px 0;
            font-size: 14px;
          }
          .footer {
            text-align: center;
            margin-top: 15px;
            font-size: 10px;
            border-top: 1px dashed #000;
            padding-top: 8px;
          }
          .separator {
            border-top: 1px dashed #000;
            margin: 8px 0;
          }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="store-name">${printerConfig.storeName}</div>
          <div>${printerConfig.storeAddress}</div>
          <div>Telp: ${printerConfig.storePhone}</div>
        </div>
                
        <div class="order-info">
          <div><strong>No: ${order.order_number}</strong></div>
          <div>Tanggal: ${new Date(order.created_at).toLocaleDateString('id-ID')}</div>
          <div>Waktu: ${new Date(order.created_at).toLocaleTimeString('id-ID')}</div>
          <div>Kasir: ${printerConfig.storeKasir}</div>
          <div>Status: <strong>${order.status.toUpperCase()}</strong></div>
          ${order.customer_name ? `<div>Pelanggan: ${order.customer_name}</div>` : ''}
          ${order.customer_phone ? `<div>Telp: ${order.customer_phone}</div>` : ''}
        </div>
        
        <div class="separator"></div>
        
        <div class="items">
          ${order.order_items && order.order_items.length > 0 ?
        order.order_items.map(item => `
              <div class="item-row">
                <div class="item-name">${item.products?.name || 'Produk'}</div>
                <div class="item-qty">${item.quantity}x</div>
                <div class="item-price">${(item.price * item.quantity).toLocaleString('id-ID')}</div>
              </div>
            `).join('') :
        '<div>Tidak ada item</div>'
      }
        </div>
        
        <div class="separator"></div>
        
        <div class="total">
            <div>TOTAL: Rp</div>
            <div>${order.total_amount.toLocaleString('id-ID')}</div>
        </div>
        
        <div style="margin: 8px 0;">
          <div>Pembayaran: ${getPaymentMethodLabel(order.payment_method)}</div>
          <div>Status: ${order.status.toUpperCase()}</div>
        </div>
        
        ${order.notes ? `
          <div style="margin: 8px 0;">
            <div><strong>Catatan:</strong></div>
            <div>${order.notes}</div>
          </div>
        ` : ''}
        
        <div class="footer">
          <div>Terima kasih atas kunjungan Anda</div>
          <div>*** ${new Date().toLocaleDateString('id-ID')} ***</div>
        </div>
      </body>
      </html>
    `

    const printWindow = window.open('', '_blank', `width=${printerConfig.paperWidth}mm,height=600`)
    if (printWindow) {
      printWindow.document.write(strukContent)
      printWindow.document.close()

      printWindow.onload = () => {
        printWindow.focus()
        printWindow.print()
      }
    } else {
      showAlert(
        'Popup Diblokir',
        'Popup diblokir! Izinkan popup untuk mencetak struk.',
        'warning'
      )
    }
  }

  // ============================
  // FUNGSI ORDER CRUD
  // ============================

  // Update order status dari tabel
  const updateOrderStatus = async (orderId: string, status: Order['status']) => {
    try {
      const order = orders.find(o => o.id === orderId)

      // Jika mengubah ke completed
      if (status === 'completed') {
        if (order) {
          // Jika order_type openbill, tawarkan cetak struk
          if (order.order_type === 'openbill') {
            setOrderToPrint(order)
            setShowPrintConfirmation(true)
             // Jangan update dulu, tunggu konfirmasi cetak
          } else if (order.order_type === 'closebill') {
            // Untuk take away, auto print jika printer terhubung
            showAlert(
              'Order Selesai',
              `Order ${order.order_number} telah diselesaikan!`,
              'success'
            )
          }
        }
      }

      // Update status saja
      const { error } = await supabase
        .from('orders')
        .update({
          status
        })
        .eq('id', orderId)

      if (error) throw error

      // Refresh data
      await fetchOrders()
      await fetchTotalOrders()
      await fetchAllStats()
      setShowMobileMenu(null)

      if (status === 'completed') {
        showAlert(
          'Order Selesai',
          `Order ${order?.order_number} telah diselesaikan!`,
          'success'
        )
      } else {
        showAlert(
          'Status Diupdate',
          'Status order berhasil diupdate',
          'success'
        )
      }
    } catch (error: any) {
      console.error('Error updating order status:', error)
      showAlert(
        'Gagal Mengupdate',
        'Gagal mengupdate status order: ' + error.message,
        'error'
      )
    }
  }

  // FUNGSI UNTUK UPDATE ITEMS DI MODAL DETAIL
  const updateOrderItems = async () => {
    if (!selectedOrder) return

    try {
      setIsUpdating(true)

      // Hitung total baru
      const newTotal = updateForm.items.reduce((sum, item) =>
        sum + (item.price * item.quantity), 0
      )

      // Update order dengan total baru - TANPA updated_at
      const { error: orderError } = await supabase
        .from('orders')
        .update({
          total_amount: newTotal,
          customer_name: updateForm.customer_name || null,
          customer_phone: updateForm.customer_phone || null,
          payment_method: updateForm.payment_method,
          notes: updateForm.notes || null,
          status: updateForm.status,
          order_type: updateForm.order_type
          // HAPUS: updated_at: new Date().toISOString()
        })
        .eq('id', selectedOrder.id)

      if (orderError) throw orderError

      // Hapus semua order_items lama
      const { error: deleteError } = await supabase
        .from('order_items')
        .delete()
        .eq('order_id', selectedOrder.id)

      if (deleteError) throw deleteError

      // Insert order_items baru
      if (updateForm.items.length > 0) {
        const orderItems = updateForm.items.map(item => ({
          order_id: selectedOrder.id,
          product_id: item.product_id,
          quantity: item.quantity,
          price: item.price,
          subtotal: item.price * item.quantity
        }))

        const { error: itemsError } = await supabase
          .from('order_items')
          .insert(orderItems)

        if (itemsError) throw itemsError
      }

      // Refresh data
      await fetchOrders()
      await fetchTotalOrders()
      await fetchAllStats()

      // Update selectedOrder dengan data baru - TANPA updated_at
      const updatedOrder = {
        ...selectedOrder,
        total_amount: newTotal,
        customer_name: updateForm.customer_name || undefined,
        customer_phone: updateForm.customer_phone || undefined,
        payment_method: updateForm.payment_method,
        notes: updateForm.notes || undefined,
        status: updateForm.status,
        order_type: updateForm.order_type,
        // HAPUS: updated_at: new Date().toISOString(),
        order_items: updateForm.items.map(item => ({
          id: item.id || '',
          order_id: selectedOrder.id,
          product_id: item.product_id,
          quantity: item.quantity,
          price: item.price,
          subtotal: item.price * item.quantity,
          products: products.find(p => p.id === item.product_id)
        }))
      } as Order

      setSelectedOrder(updatedOrder)

      showAlert(
        'Berhasil Update',
        `Order ${selectedOrder.order_number} berhasil diupdate!\nTotal baru: ${formatCurrency(newTotal)}`,
        'success'
      )
    } catch (error: any) {
      console.error('Error updating order:', error)
      showAlert(
        'Gagal Update',
        'Gagal mengupdate order: ' + error.message,
        'error'
      )
    } finally {
      setIsUpdating(false)
    }
  }

  // Fungsi handle konfirmasi cetak
  const handlePrintConfirmation = (shouldPrint: boolean) => {
    if (shouldPrint && orderToPrint) {
      printStruk(orderToPrint)
    }

    setShowPrintConfirmation(false)
    setOrderToPrint(null)

    if (orderToPrint) {
      showAlert(
        'Order Selesai',
        `Order ${orderToPrint.order_number} telah diselesaikan!`,
        'success'
      )
    }
  }

  // Delete order
  const deleteOrder = async (orderId: string) => {
    const orderToDelete = orders.find(order => order.id === orderId)

    showAlert(
      'Konfirmasi Hapus',
      `Apakah Anda yakin ingin menghapus order ${orderToDelete?.order_number}?`,
      'warning',
      async () => {
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

          // Refresh data dengan pagination yang sama
          await fetchOrders()
          await fetchTotalOrders()
          await fetchAllStats()
          setShowMobileMenu(null)

          showAlert(
            'Order Dihapus',
            'Order berhasil dihapus',
            'success'
          )
        } catch (error: any) {
          console.error('Error deleting order:', error)
          showAlert(
            'Gagal Menghapus',
            'Gagal menghapus order: ' + error.message,
            'error'
          )
        }
      },
      'Hapus',
      'Batal'
    )
  }
  // ============================
  // FUNGSI MANAJEMEN ITEMS DI MODAL DETAIL
  // ============================

  // Tambah item baru di modal detail
  const addItemToUpdateForm = () => {
    setUpdateForm(prev => ({
      ...prev,
      items: [...prev.items, {
        product_id: '',
        quantity: 1,
        price: 0,
        product_name: '',
        subtotal: 0
      }]
    }))
  }

  // Update item di modal detail
  const updateItemInUpdateForm = (index: number, field: string, value: any) => {
    const newItems = [...updateForm.items]

    if (field === 'product_id') {
      const product = products.find(p => p.id === value)
      if (product) {
        newItems[index] = {
          ...newItems[index],
          product_id: value,
          price: product.price,
          product_name: product.name,
          subtotal: product.price * newItems[index].quantity
        }
      }
    } else if (field === 'quantity') {
      const quantity = parseInt(value) || 1
      newItems[index] = {
        ...newItems[index],
        quantity,
        subtotal: newItems[index].price * quantity
      }
    } else if (field === 'price') {
      const price = parseFloat(value) || 0
      newItems[index] = {
        ...newItems[index],
        price,
        subtotal: price * newItems[index].quantity
      }
    }

    setUpdateForm(prev => ({ ...prev, items: newItems }))
  }

  // Hapus item dari modal detail
  const removeItemFromUpdateForm = (index: number) => {
    if (updateForm.items.length <= 1) {
      showAlert(
        'Peringatan',
        'Order harus memiliki minimal 1 item',
        'warning'
      )
      return
    }

    setUpdateForm(prev => ({
      ...prev,
      items: prev.items.filter((_, i) => i !== index)
    }))
  }

  // Hitung total untuk update form
  const updateFormTotal = updateForm.items.reduce((sum, item) =>
    sum + (item.price * item.quantity), 0
  )

  // ============================
  // FUNGSI FORM ORDER BARU
  // ============================

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
      showAlert(
        'Validasi Gagal',
        validation.message,
        'warning'
      )
      return
    }

    setSubmitLoading(true)

    try {
      // Generate order number dengan format berdasarkan order type
      const now = new Date()
      const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '')
      const randomNum = Math.floor(Math.random() * 10000).toString().padStart(4, '0')

      // Format order number berbeda untuk openbill dan closebill
      let orderNumber = ''
      if (formData.order_type === 'openbill') {
        orderNumber = `ORD-${dateStr}-${randomNum}`
      } else {
        orderNumber = `ORD-${dateStr}-${randomNum}`
      }

      // Tentukan status: completed untuk closebill, pending untuk openbill
      const orderStatus = formData.order_type === 'closebill' ? 'completed' : 'pending'

      // Calculate total amount
      const total_amount = formData.items.reduce((sum, item) =>
        sum + (item.price * item.quantity), 0
      )

      // Insert order dengan order_type dan status yang sesuai
      const { data: order, error: orderError } = await supabase
        .from('orders')
        .insert([
          {
            order_number: orderNumber,
            total_amount,
            status: orderStatus, // Menggunakan status yang sudah ditentukan
            payment_method: formData.payment_method,
            customer_name: formData.customer_name || null,
            customer_phone: formData.customer_phone || null,
            notes: formData.notes || null,
            order_type: formData.order_type
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

      // Build full order object dengan product details
      const fullOrder = {
        ...order,
        order_items: orderItems.map((item, index) => ({
          ...item,
          products: products.find(p => p.id === formData.items[index].product_id)
        }))
      } as Order

      // Reset form dan refresh data
      resetForm()
      setShowCreateModal(false)

      // Refresh data terlebih dahulu
      await fetchOrders()
      await fetchTotalOrders()
      await fetchAllStats()

      // Tampilkan konfirmasi berdasarkan jenis order
      if (formData.order_type === 'closebill') {
        // Untuk closebill, status sudah completed
        let successMessage = `✅ Order ${orderNumber} berhasil dibuat!\n\nTotal: Rp ${total_amount.toLocaleString('id-ID')}\nStatus: Completed\nJenis: Close Bill (Take Away)`

        // Tampilkan alert dengan tombol print
        showAlert(
          'Order Close Bill Berhasil',
          `Order ${orderNumber} telah berhasil dibuat sebagai Close Bill (Take Away).\n\nStatus: Completed\nTotal: ${formatCurrency(total_amount)}\n\nApakah Anda ingin mencetak struk sekarang?`,
          'info',
          () => {
            // Call print function
            if (bluetoothPrinter) {
              printStruk(fullOrder)
            } else {
              printStrukBrowser(fullOrder)
            }
          },
          'Ya, Cetak Sekarang',
          'Nanti'
        )
      } else {
        // Untuk openbill, status pending
        let successMessage = `✅ Order ${orderNumber} berhasil dibuat!\n\nTotal: Rp ${total_amount.toLocaleString('id-ID')}\nStatus: Pending\nJenis: Open Bill`

        showAlert(
          'Order Berhasil',
          successMessage,
          'success'
        )
      }

    } catch (error: any) {
      console.error('Error creating order:', error)
      showAlert(
        'Gagal Membuat Order',
        'Gagal membuat order: ' + error.message,
        'error'
      )
    } finally {
      setSubmitLoading(false)
    }
  }
  // Helper functions untuk form
  const addItemToOrder = () => {
    setFormData(prev => ({
      ...prev,
      items: [...prev.items, { product_id: '', quantity: 1, price: 0, product_name: '' }]
    }))
  }

  const updateOrderItem = (index: number, field: string, value: any) => {
    const newItems = [...formData.items]
    newItems[index] = { ...newItems[index], [field]: value }

    // Auto-update price dan nama produk jika product berubah
    if (field === 'product_id') {
      const product = products.find(p => p.id === value)
      if (product) {
        newItems[index].price = product.price
        newItems[index].product_name = product.name
      }
    }

    setFormData(prev => ({ ...prev, items: newItems }))
  }

  const removeOrderItem = (index: number) => {
    if (formData.items.length === 1) {
      showAlert(
        'Peringatan',
        'Order harus memiliki minimal 1 item',
        'warning'
      )
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
      order_type: 'openbill',
      items: []
    })
  }

  const openCreateModal = () => {
    if (products.length === 0) {
      showAlert(
        'Tidak Ada Produk',
        'Tidak ada produk yang tersedia. Silakan tambahkan produk terlebih dahulu.',
        'warning'
      )
      return
    }
    resetForm()
    setShowCreateModal(true)
  }

  const openDetailModal = (order: Order) => {
    setSelectedOrder(order)
    setShowDetailModal(true)
    setShowMobileMenu(null)
  }

  const closeModals = () => {
    setShowCreateModal(false)
    setShowDetailModal(false)
    setSelectedOrder(null)
    setShowPrinterConfig(false)
    setShowExportModal(false)
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
  }

  const totalAmount = formData.items.reduce((sum, item) =>
    sum + (item.price * item.quantity), 0
  )

  // Empty state handler
  const showEmptyState = () => {
    const today = new Date().toDateString()
    const isToday = !selectedDate || new Date(selectedDate).toDateString() === today

    if (isToday && orders.length === 0) {
      return (
        <div className="text-center py-12">
          <ShoppingCart className="h-24 w-24 text-gray-200 mx-auto mb-6" />
          <h3 className="text-xl font-semibold text-gray-700 mb-2">Belum Ada Order Hari Ini</h3>
          <p className="text-gray-500 max-w-md mx-auto mb-6">
            Tidak ada order yang dibuat hari ini. Mulai dengan membuat order baru untuk pelanggan Anda.
          </p>
          <button
            onClick={openCreateModal}
            className="bg-amber-600 text-white px-6 py-3 rounded-lg hover:bg-amber-700 transition-colors flex items-center space-x-2 mx-auto"
          >
            <Plus className="h-5 w-5" />
            <span>Buat Order Pertama</span>
          </button>
        </div>
      )
    }

    if (filteredOrders.length === 0 && searchTerm) {
      return (
        <div className="text-center py-12">
          <Search className="h-16 w-16 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500">Tidak ada order yang ditemukan untuk "{searchTerm}"</p>
          <button
            onClick={() => setSearchTerm('')}
            className="mt-4 text-amber-600 hover:text-amber-700 font-medium transition-colors"
          >
            Clear Search
          </button>
        </div>
      )
    }

    if (filteredOrders.length === 0) {
      return (
        <div className="text-center py-12">
          <ShoppingCart className="h-16 w-16 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500">Tidak ada order yang ditemukan</p>
          {selectedDate && (
            <button
              onClick={resetToToday}
              className="mt-4 text-amber-600 hover:text-amber-700 font-medium transition-colors"
            >
              Lihat Order Hari Ini
            </button>
          )}
        </div>
      )
    }

    return null
  }

  // Loading state
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[calc(100vh-200px)]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-amber-600 mx-auto"></div>
          <p className="mt-4 text-amber-700">Memuat data order...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6 p-4 md:p-6">
      {/* Alert Modal */}
      <AlertModal
        isOpen={alertModal.isOpen}
        title={alertModal.title}
        message={alertModal.message}
        type={alertModal.type}
        onClose={closeAlert}
        onConfirm={alertModal.onConfirm}
        confirmText={alertModal.confirmText}
        cancelText={alertModal.cancelText}
      />

      {/* Header dengan printer status */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-amber-900">Manajemen Pemesanan</h1>
          <p className="text-amber-600 mt-1">Kelola semua order dari pelanggan</p>
        </div>
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
          {/* Printer Status & Controls */}
          <div className="flex items-center gap-2">
            {bluetoothPrinter ? (
              <div className="flex items-center gap-2 bg-green-100 text-green-800 px-3 py-2 rounded-lg border border-green-200">
                <Bluetooth className="h-4 w-4 animate-pulse" />
                <span className="text-sm font-medium truncate max-w-32">
                  {bluetoothPrinter.device.name || 'Printer'}
                </span>
                <button
                  onClick={disconnectPrinter}
                  className="text-red-600 hover:text-red-800"
                  title="Disconnect Printer"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ) : !bluetoothSupported ? (
              <div className="flex items-center gap-2 bg-gray-100 text-gray-600 px-3 py-2 rounded-lg border border-gray-200">
                <AlertCircle className="h-4 w-4" />
                <span className="text-sm">Bluetooth tidak didukung</span>
              </div>
            ) : (
              <button
                onClick={connectBluetoothPrinter}
                disabled={isConnecting}
                className="flex items-center gap-2 bg-blue-600 text-white px-3 py-2 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 text-sm"
              >
                {isConnecting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Connecting...</span>
                  </>
                ) : (
                  <>
                    <Bluetooth className="h-4 w-4" />
                    <span>Connect Printer</span>
                  </>
                )}
              </button>
            )}

            <button
              onClick={() => setShowPrinterConfig(true)}
              className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
              title="Printer Settings"
            >
              <Settings className="h-4 w-4" />
            </button>
          </div>
          <button
            onClick={openCreateModal}
            className="bg-amber-600 text-white px-4 py-2 md:px-6 md:py-3 rounded-lg hover:bg-amber-700 transition-colors flex items-center justify-center space-x-2"
          >
            <Plus className="h-4 w-4 md:h-5 md:w-5" />
            <span className="text-sm md:text-base">Order Baru</span>
          </button>
        </div>
      </div>

      {/* Stats Cards - SEMUA DATA DARI DATABASE */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
        {/* Order Hari Ini */}
        <div className="bg-white rounded-xl p-4 shadow-sm border border-amber-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Order {selectedDate ? 'Terpilih' : 'Hari Ini'}</p>
              {statsLoading ? (
                <div className="animate-pulse">
                  <div className="h-7 w-12 bg-gray-200 rounded"></div>
                </div>
              ) : (
                <p className="text-xl md:text-2xl font-bold text-gray-900">{todayOrdersCount}</p>
              )}
              <p className="text-xs text-gray-500 mt-1">{totalOrders} total order</p>
            </div>
            <ShoppingCart className="h-7 w-7 md:h-8 md:w-8 text-amber-600" />
          </div>
        </div>

        {/* Pendapatan */}
        <div className="bg-white rounded-xl p-4 shadow-sm border border-amber-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Pendapatan {selectedDate ? 'Terpilih' : 'Hari Ini'}</p>
              {statsLoading ? (
                <div className="animate-pulse">
                  <div className="h-7 w-12 bg-gray-200 rounded"></div>
                </div>
              ) : (
                <p className="text-xl md:text-2xl font-bold text-green-600">
                  {formatCurrency(todayRevenue)}
                </p>
              )}
            </div>
            <CreditCard className="h-7 w-7 md:h-8 md:w-8 text-green-600" />
          </div>
        </div>

        {/* PENDING - DATA DARI DATABASE */}
        <div className="bg-white rounded-xl p-4 shadow-sm border border-amber-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Pending</p>
              {statsLoading ? (
                <div className="animate-pulse">
                  <div className="h-7 w-12 bg-gray-200 rounded"></div>
                </div>
              ) : (
                <p className="text-xl md:text-2xl font-bold text-yellow-600">
                  {pendingCount}
                </p>
              )}
              <p className="text-xs text-gray-500 mt-1">
                {processingCount} processing
              </p>
            </div>
            <Clock className="h-7 w-7 md:h-8 md:w-8 text-yellow-600" />
          </div>
        </div>



        {/* COMPLETED - DATA DARI DATABASE */}
        <div className="bg-white rounded-xl p-4 shadow-sm border border-amber-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Completed</p>
              {statsLoading ? (
                <div className="animate-pulse">
                  <div className="h-7 w-12 bg-gray-200 rounded"></div>
                </div>
              ) : (
                <p className="text-xl md:text-2xl font-bold text-green-600">
                  {completedCount}
                </p>
              )}
              <p className="text-xs text-gray-500 mt-1">{cancelledCount} cancelled</p>
            </div>
            <CheckCircle className="h-7 w-7 md:h-8 md:w-8 text-green-600" />
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
                onChange={handleSearch}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
              <input
                type="date"
                value={selectedDate}
                onChange={handleDateChange}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
            </div>

            <select
              value={statusFilter}
              onChange={handleStatusFilterChange}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
            >
              <option value="all">Semua Status</option>
              <option value="pending">Pending</option>
              <option value="processing">Processing</option>
              <option value="completed">Completed</option>
              <option value="cancelled">Cancelled</option>
            </select>

            {/* FILTER ORDER TYPE DIHAPUS */}
            {/* <select
              value={orderTypeFilter}
              onChange={handleOrderTypeFilterChange}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
            >
              <option value="all">Semua Jenis</option>
              <option value="openbill">Open Bill</option>
              <option value="closebill">Close Bill</option>
            </select> */}

            <button
              onClick={resetToToday}
              className="px-4 py-2 bg-amber-100 text-amber-700 rounded-lg hover:bg-amber-200 transition-colors flex items-center space-x-2"
            >
              <Calendar className="h-4 w-4" />
              <span>Hari Ini</span>
            </button>

            {selectedDate && selectedDate !== new Date().toISOString().split('T')[0] && (
              <button
                onClick={clearDateFilter}
                className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Clear Filter
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Orders Table */}
      <div className="bg-white rounded-xl shadow-sm border border-amber-100 overflow-hidden">
        {isMobile ? (
          /* Mobile View */
          <div className="divide-y divide-amber-50">
            {showEmptyState() || (
              filteredOrders.map((order) => (
                <div key={order.id} className="border-b border-amber-50">
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
                              <span>Detail/Edit</span>
                            </button>
                            <button
                              onClick={() => printStruk(order)}
                              className="w-full px-4 py-2 text-left text-sm text-green-600 hover:bg-green-50 flex items-center space-x-2"
                            >
                              <Printer className="h-4 w-4" />
                              <span>Cetak</span>
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
                          {formatCurrency(order.total_amount)}
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
                        <p className="text-gray-600">Jenis</p>
                        <div className={`inline-flex items-center px-2 py-1 rounded-lg text-xs font-medium ${getOrderTypeColor(order.order_type)}`}>
                          <span className="mr-1">{getOrderTypeIcon(order.order_type)}</span>
                          <span>{order.order_type === 'openbill' ? 'Open Bill' : 'Close Bill'}</span>
                        </div>
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
                    <div className="bg-gray-50 border-t border-amber-100 p-4">
                      <h4 className="font-medium text-gray-900 mb-3 flex items-center">
                        <Package className="h-4 w-4 mr-2 text-amber-600" />
                        Detail Produk ({order.order_items?.length || 0} item)
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
                              <div className="text-right">
                                <p className="font-semibold text-gray-900 text-sm">
                                  x {item.quantity}
                                </p>
                              </div>
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
              ))
            )}
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
                  <th className="text-left py-4 px-4 text-sm font-semibold text-amber-900">Jenis</th>
                  <th className="text-left py-4 px-4 text-sm font-semibold text-amber-900">Pembayaran</th>
                  <th className="text-left py-4 px-4 text-sm font-semibold text-amber-900">Tanggal</th>
                  <th className="text-left py-4 px-4 text-sm font-semibold text-amber-900">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {showEmptyState() ? (
                  <tr>
                    <td colSpan={9}>
                      {showEmptyState()}
                    </td>
                  </tr>
                ) : (
                  filteredOrders.map((order) => (
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
                            {formatCurrency(order.total_amount)}
                          </div>
                        </td>
                        <td className="py-4 px-4">
                          <div className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium border ${getStatusColor(order.status)}`}>
                            {getStatusIcon(order.status)}
                            <span className="ml-2 capitalize">{order.status}</span>
                          </div>
                        </td>
                        <td className="py-4 px-4">
                          <div className={`inline-flex items-center px-2 py-1 rounded-lg text-xs font-medium ${getOrderTypeColor(order.order_type)}`}>
                            <span className="mr-1">{getOrderTypeIcon(order.order_type)}</span>
                            <span>{order.order_type === 'openbill' ? 'Open Bill' : 'Close Bill'}</span>
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
                              title="Detail/Edit Order"
                            >
                              <Edit className="h-4 w-4" />
                            </button>

                            <button
                              onClick={() => printStruk(order)}
                              className="text-green-600 hover:text-green-800 p-1 transition-colors"
                              title="Cetak Struk"
                            >
                              <Printer className="h-4 w-4" />
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
                          <td colSpan={9} className="py-4 px-4">
                            <div className="max-w-4xl">
                              <h4 className="font-medium text-gray-900 mb-3 flex items-center">
                                <Package className="h-4 w-4 mr-2 text-amber-600" />
                                Detail Produk yang Dipesan ({order.order_items?.length || 0} item)
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
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Controls */}
        {filteredOrders.length > 0 && (
          <div className="bg-white border-t border-amber-100 px-6 py-4 rounded-b-xl">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="flex items-center space-x-4">
                <div className="text-sm text-gray-600">
                  Menampilkan <span className="font-medium">{(currentPage - 1) * itemsPerPage + 1}</span>-
                  <span className="font-medium">
                    {Math.min(currentPage * itemsPerPage, totalOrders)}
                  </span> dari <span className="font-medium">{totalOrders}</span> order
                </div>

                <select
                  value={itemsPerPage}
                  onChange={(e) => {
                    setItemsPerPage(Number(e.target.value))
                    setCurrentPage(1)
                  }}
                  className="text-sm border border-gray-300 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-amber-500"
                >
                  <option value="5">5 per halaman</option>
                  <option value="10">10 per halaman</option>
                  <option value="20">20 per halaman</option>
                  <option value="50">50 per halaman</option>
                </select>
              </div>

              <div className="flex items-center space-x-2">
                <button
                  onClick={goToPreviousPage}
                  disabled={!hasPreviousPage}
                  className="p-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  aria-label="Previous page"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>

                <div className="flex items-center space-x-1">
                  {/* First page */}
                  {currentPage > 3 && (
                    <>
                      <button
                        onClick={() => goToPage(1)}
                        className="w-8 h-8 flex items-center justify-center text-sm font-medium text-gray-700 hover:bg-amber-100 hover:text-amber-700 rounded-lg transition-colors"
                      >
                        1
                      </button>
                      {currentPage > 4 && (
                        <span className="text-gray-400">...</span>
                      )}
                    </>
                  )}

                  {/* Page numbers */}
                  {[...Array(totalPages)].map((_, index) => {
                    const pageNumber = index + 1
                    if (
                      pageNumber === currentPage ||
                      pageNumber === currentPage - 1 ||
                      pageNumber === currentPage + 1 ||
                      pageNumber === currentPage - 2 ||
                      pageNumber === currentPage + 2
                    ) {
                      return (
                        <button
                          key={pageNumber}
                          onClick={() => goToPage(pageNumber)}
                          className={`w-8 h-8 flex items-center justify-center text-sm font-medium rounded-lg transition-colors ${currentPage === pageNumber
                            ? 'bg-amber-600 text-white'
                            : 'text-gray-700 hover:bg-amber-100 hover:text-amber-700'
                            }`}
                        >
                          {pageNumber}
                        </button>
                      )
                    }
                    return null
                  })}

                  {/* Last page */}
                  {currentPage < totalPages - 2 && (
                    <>
                      {currentPage < totalPages - 3 && (
                        <span className="text-gray-400">...</span>
                      )}
                      <button
                        onClick={() => goToPage(totalPages)}
                        className="w-8 h-8 flex items-center justify-center text-sm font-medium text-gray-700 hover:bg-amber-100 hover:text-amber-700 rounded-lg transition-colors"
                      >
                        {totalPages}
                      </button>
                    </>
                  )}
                </div>

                <button
                  onClick={goToNextPage}
                  disabled={!hasNextPage}
                  className="p-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  aria-label="Next page"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Order Summary */}
            <div className="mt-4 pt-4 border-t border-gray-100">
              <div className="flex flex-wrap gap-4 text-sm text-gray-600">
                <div className="flex items-center">
                  <div className="w-3 h-3 bg-yellow-500 rounded-full mr-2"></div>
                  <span>Pending: {pendingCount}</span>
                </div>
                <div className="flex items-center">
                  <div className="w-3 h-3 bg-blue-500 rounded-full mr-2"></div>
                  <span>Processing: {processingCount}</span>
                </div>
                <div className="flex items-center">
                  <div className="w-3 h-3 bg-green-500 rounded-full mr-2"></div>
                  <span>Completed: {completedCount}</span>
                </div>
                <div className="flex items-center">
                  <div className="w-3 h-3 bg-red-500 rounded-full mr-2"></div>
                  <span>Cancelled: {cancelledCount}</span>
                </div>
              </div>
            </div>
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

              {/* Order Type */}
              <div>
                <label className="text-sm font-medium text-gray-700 mb-2 flex items-center">
                  <ShoppingCart className="h-4 w-4 mr-2 text-amber-600" />
                  Jenis Order
                </label>
                <div className="grid grid-cols-2 gap-3">
                  {ORDER_TYPES.map((type) => (
                    <button
                      key={type.value}
                      type="button"
                      onClick={() => setFormData(prev => ({ ...prev, order_type: type.value }))}
                      className={`p-3 rounded-lg border transition-all ${formData.order_type === type.value
                        ? 'border-amber-500 bg-amber-50 text-amber-700'
                        : 'border-gray-300 hover:border-amber-300 hover:bg-amber-50'
                        }`}
                    >
                      <div className="flex items-center space-x-2">
                        <div className="text-left">
                          <p className="font-medium">{type.label}</p>
                          <p className="text-xs text-gray-500">
                            {type.value === 'openbill' ? 'Tidak langsung cetak struk' : 'Langsung cetak struk'}
                          </p>
                        </div>
                      </div>
                    </button>
                  ))}
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
                <div className="flex items-center justify-between mb-3">
                  <label className="text-sm font-medium text-gray-700">
                    Produk yang Dipesan
                  </label>
                  <button
                    type="button"
                    onClick={addItemToOrder}
                    className="text-amber-600 hover:text-amber-700 text-sm font-medium flex items-center space-x-1"
                  >
                    <Plus className="h-4 w-4" />
                    <span>Tambah</span>
                  </button>
                </div>

                <div className="space-y-2">
                  {formData.items.map((item, index) => (
                    <div key={index} className="flex items-center gap-3 p-3 border border-gray-200 rounded-lg bg-white">
                      {/* Product Selection */}
                      <div className="flex-1">
                        <select
                          value={item.product_id}
                          onChange={(e) => updateOrderItem(index, 'product_id', e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 text-sm"
                          required
                        >
                          <option value="">Pilih Produk</option>
                          {products.map(product => (
                            <option key={product.id} value={product.id}>
                              {product.name}
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* Quantity Control */}
                      <div className="flex items-center space-x-2">
                        <button
                          type="button"
                          onClick={() => decreaseQuantity(index)}
                          className="w-6 h-6 flex items-center justify-center rounded border border-gray-300 hover:bg-gray-100 transition-colors disabled:opacity-50"
                          disabled={item.quantity <= 1}
                        >
                          <Minus className="h-3 w-3" />
                        </button>

                        <span className="text-sm font-medium w-8 text-center">
                          {item.quantity}
                        </span>

                        <button
                          type="button"
                          onClick={() => increaseQuantity(index)}
                          className="w-6 h-6 flex items-center justify-center rounded border border-gray-300 hover:bg-gray-100 transition-colors"
                        >
                          <Plus className="h-3 w-3" />
                        </button>
                      </div>

                      {/* Remove Button */}
                      {formData.items.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeOrderItem(index)}
                          className="text-red-500 hover:text-red-700 p-1 transition-colors"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>

                {formData.items.length === 0 && (
                  <div className="text-center py-6 border-2 border-dashed border-gray-300 rounded-lg bg-gray-50">
                    <Package className="h-6 w-6 text-gray-300 mx-auto mb-2" />
                    <p className="text-gray-500 text-sm">Belum ada produk</p>
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

      {/* Order Detail Modal dengan Form Update */}
      {showDetailModal && selectedOrder && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200 flex items-center justify-between">
              <div>
                <h3 className="text-xl font-semibold text-gray-900">
                  Detail Order - {selectedOrder.order_number}
                </h3>
                <p className="text-sm text-gray-600 mt-1">
                  Created: {new Date(selectedOrder.created_at).toLocaleString('id-ID')}
                </p>
              </div>
              <button
                onClick={closeModals}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X className="h-6 w-6" />
              </button>
            </div>

            <div className="p-6 space-y-6">
              {/* FORM UPDATE ORDER */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Customer Name */}
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-2 block">
                    Nama Pelanggan
                  </label>
                  <input
                    type="text"
                    value={updateForm.customer_name}
                    onChange={(e) => setUpdateForm(prev => ({
                      ...prev,
                      customer_name: e.target.value
                    }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
                    placeholder="Nama pelanggan"
                  />
                </div>

                {/* Customer Phone */}
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-2 block">
                    No. Telepon
                  </label>
                  <input
                    type="tel"
                    value={updateForm.customer_phone}
                    onChange={(e) => setUpdateForm(prev => ({
                      ...prev,
                      customer_phone: e.target.value
                    }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
                    placeholder="No. telepon"
                  />
                </div>

                {/* Payment Method */}
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-2 block">
                    Metode Pembayaran
                  </label>
                  <select
                    value={updateForm.payment_method}
                    onChange={(e) => setUpdateForm(prev => ({
                      ...prev,
                      payment_method: e.target.value
                    }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
                  >
                    {PAYMENT_METHODS.map(method => (
                      <option key={method.value} value={method.value}>
                        {method.label}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Status */}
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-2 block">
                    Status
                  </label>
                  <select
                    value={updateForm.status}
                    onChange={(e) => setUpdateForm(prev => ({
                      ...prev,
                      status: e.target.value as Order['status']
                    }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
                  >
                    <option value="pending">Pending</option>
                    <option value="processing">Processing</option>
                    <option value="completed">Completed</option>
                    <option value="cancelled">Cancelled</option>
                  </select>
                </div>

                {/* Order Type */}
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-2 block">
                    Jenis Order
                  </label>
                  <select
                    value={updateForm.order_type}
                    onChange={(e) => setUpdateForm(prev => ({
                      ...prev,
                      order_type: e.target.value as 'openbill' | 'closebill'
                    }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
                  >
                    <option value="openbill">Open Bill</option>
                    <option value="closebill">Close Bill</option>
                  </select>
                </div>

                {/* Notes */}
                <div className="md:col-span-2">
                  <label className="text-sm font-medium text-gray-700 mb-2 block">
                    Catatan
                  </label>
                  <textarea
                    value={updateForm.notes}
                    onChange={(e) => setUpdateForm(prev => ({
                      ...prev,
                      notes: e.target.value
                    }))}
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
                    placeholder="Catatan untuk order"
                  />
                </div>
              </div>

              {/* ORDER ITEMS SECTION - DIPERBAIKI */}
              <div className="border-t border-gray-200 pt-6">
                <div className="flex items-center justify-between mb-4">
                  <h4 className="text-lg font-medium text-gray-900 flex items-center">
                    <Package className="h-5 w-5 mr-2 text-amber-600" />
                    Produk ({updateForm.items.length} item)
                  </h4>
                  <button
                    type="button"
                    onClick={addItemToUpdateForm}
                    className="text-amber-600 hover:text-amber-700 text-sm font-medium flex items-center space-x-1"
                  >
                    <Plus className="h-4 w-4" />
                    <span>Tambah Produk</span>
                  </button>
                </div>

                <div className="space-y-3">
                  {updateForm.items.map((item, index) => (
                    <div key={index} className="flex items-center gap-3 p-4 border border-gray-200 rounded-lg bg-white">
                      {/* Product Selection */}
                      <div className="flex-1">
                        <select
                          value={item.product_id}
                          onChange={(e) => updateItemInUpdateForm(index, 'product_id', e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 text-sm"
                        >
                          <option value="">Pilih Produk</option>
                          {products.map(product => (
                            <option key={product.id} value={product.id}>
                              {product.name} - Rp {product.price.toLocaleString('id-ID')}
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* Quantity Control */}
                      <div className="flex items-center space-x-2">
                        <button
                          type="button"
                          onClick={() => {
                            const newQty = Math.max(1, item.quantity - 1)
                            updateItemInUpdateForm(index, 'quantity', newQty)
                          }}
                          className="w-8 h-8 flex items-center justify-center rounded border border-gray-300 hover:bg-gray-100 transition-colors"
                        >
                          <Minus className="h-3 w-3" />
                        </button>

                        <span className="text-sm font-medium w-8 text-center">
                          {item.quantity}
                        </span>

                        <button
                          type="button"
                          onClick={() => {
                            updateItemInUpdateForm(index, 'quantity', item.quantity + 1)
                          }}
                          className="w-8 h-8 flex items-center justify-center rounded border border-gray-300 hover:bg-gray-100 transition-colors"
                        >
                          <Plus className="h-3 w-3" />
                        </button>
                      </div>

                      {/* Price Display */}
                      <div className="text-right">
                        <div className="text-sm font-medium text-gray-900">
                          Rp {(item.price * item.quantity).toLocaleString('id-ID')}
                        </div>
                        <div className="text-xs text-gray-500">
                          @ Rp {item.price.toLocaleString('id-ID')}
                        </div>
                      </div>

                      {/* Remove Button */}
                      <button
                        type="button"
                        onClick={() => removeItemFromUpdateForm(index)}
                        className="text-red-500 hover:text-red-700 p-1 transition-colors"
                        disabled={updateForm.items.length <= 1}
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                </div>

                {updateForm.items.length === 0 && (
                  <div className="text-center py-8 border-2 border-dashed border-gray-300 rounded-lg bg-gray-50">
                    <Package className="h-12 w-12 text-gray-300 mx-auto mb-2" />
                    <p className="text-gray-500">Belum ada produk dalam order ini</p>
                  </div>
                )}

                {/* Total Section */}
                <div className="mt-6 bg-amber-50 border border-amber-200 rounded-lg p-4">
                  <div className="flex justify-between items-center">
                    <span className="text-lg font-semibold text-amber-900">Total Amount</span>
                    <span className="text-2xl font-bold text-amber-900">
                      Rp {updateFormTotal.toLocaleString('id-ID')}
                    </span>
                  </div>
                  <div className="text-sm text-gray-600 mt-1">
                    {selectedOrder.total_amount !== updateFormTotal && (
                      <span className="text-red-600">
                        Perubahan: {formatCurrency(selectedOrder.total_amount)} → {formatCurrency(updateFormTotal)}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="p-6 border-t border-gray-200 flex flex-col sm:flex-row justify-between gap-3">
              <div className="flex gap-2">
                <button
                  onClick={() => printStruk(selectedOrder)}
                  className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors flex items-center space-x-2"
                >
                  <Printer className="h-4 w-4" />
                  <span>Cetak Struk</span>
                </button>
                <button
                  onClick={() => {
                    // Reset form ke data asli
                    const formattedItems = selectedOrder.order_items?.map(item => ({
                      id: item.id,
                      product_id: item.product_id,
                      quantity: item.quantity,
                      price: item.price,
                      product_name: item.products?.name,
                      subtotal: item.price * item.quantity
                    })) || []

                    setUpdateForm({
                      customer_name: selectedOrder.customer_name || '',
                      customer_phone: selectedOrder.customer_phone || '',
                      payment_method: selectedOrder.payment_method || 'cash',
                      notes: selectedOrder.notes || '',
                      status: selectedOrder.status,
                      order_type: selectedOrder.order_type || 'openbill',
                      items: formattedItems
                    })

                    showAlert(
                      'Form Reset',
                      'Form telah direset ke nilai awal',
                      'info'
                    )
                  }}
                  className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors flex items-center space-x-2"
                >
                  <RefreshCw className="h-4 w-4" />
                  <span>Reset</span>
                </button>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={closeModals}
                  className="px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Batal
                </button>
                <button
                  onClick={updateOrderItems}
                  disabled={isUpdating || updateForm.items.length === 0}
                  className="px-6 py-3 bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition-colors disabled:opacity-50 flex items-center space-x-2"
                >
                  {isUpdating ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span>Menyimpan...</span>
                    </>
                  ) : (
                    <>
                      <Save className="h-4 w-4" />
                      <span>Simpan Perubahan</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showPrinterConfig && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200 flex items-center justify-between">
              <h3 className="text-xl font-semibold text-gray-900 flex items-center">
                <Settings className="h-5 w-5 mr-2 text-blue-600" />
                Konfigurasi Printer
              </h3>
              <button
                onClick={closeModals}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X className="h-6 w-6" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              {/* Store Information */}
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1 block">
                  Nama Toko
                </label>
                <input
                  type="text"
                  value={printerConfig.storeName}
                  onChange={(e) => setPrinterConfig(prev => ({
                    ...prev,
                    storeName: e.target.value
                  }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="text-sm font-medium text-gray-700 mb-1 block">
                  Alamat Toko
                </label>
                <input
                  type="text"
                  value={printerConfig.storeAddress}
                  onChange={(e) => setPrinterConfig(prev => ({
                    ...prev,
                    storeAddress: e.target.value
                  }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="text-sm font-medium text-gray-700 mb-1 block">
                  Telepon Toko
                </label>
                <input
                  type="text"
                  value={printerConfig.storePhone}
                  onChange={(e) => setPrinterConfig(prev => ({
                    ...prev,
                    storePhone: e.target.value
                  }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1 block">
                  Kasir
                </label>
                <input
                  type="text"
                  value={printerConfig.storeKasir}
                  onChange={(e) => setPrinterConfig(prev => ({
                    ...prev,
                    storeKasir: e.target.value
                  }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-1 block">
                    Jumlah Copy
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="5"
                    value={printerConfig.copies}
                    onChange={(e) => setPrinterConfig(prev => ({
                      ...prev,
                      copies: Math.max(1, Math.min(5, parseInt(e.target.value) || 1))
                    }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="text-sm font-medium text-gray-700 mb-1 block">
                    Lebar Kertas
                  </label>
                  <select
                    value={printerConfig.paperWidth}
                    onChange={(e) => setPrinterConfig(prev => ({
                      ...prev,
                      paperWidth: parseInt(e.target.value)
                    }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="58">58mm (Standard)</option>
                    <option value="80">80mm (Wide)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-sm font-medium text-gray-700 mb-1 block">
                  Ukuran Font
                </label>
                <select
                  value={printerConfig.fontSize}
                  onChange={(e) => setPrinterConfig(prev => ({
                    ...prev,
                    fontSize: parseInt(e.target.value)
                  }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="0">Normal</option>
                  <option value="1">Medium</option>
                  <option value="2">Large</option>
                  <option value="3">Extra Large</option>
                </select>
              </div>

              {/* Advanced Settings */}
              <div className="pt-2 border-t border-gray-200">
                <h4 className="font-medium text-gray-900 mb-2">Advanced Settings</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium text-gray-700 mb-1 block">
                      Chunk Size (bytes)
                    </label>
                    <input
                      type="number"
                      min="50"
                      max="500"
                      step="10"
                      value={printerConfig.chunkSize}
                      onChange={(e) => setPrinterConfig(prev => ({
                        ...prev,
                        chunkSize: Math.max(50, Math.min(500, parseInt(e.target.value) || 200))
                      }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Ukuran data per chunk (max 512)
                    </p>
                  </div>

                  <div>
                    <label className="text-sm font-medium text-gray-700 mb-1 block">
                      Chunk Delay (ms)
                    </label>
                    <input
                      type="number"
                      min="0"
                      max="200"
                      step="10"
                      value={printerConfig.chunkDelay}
                      onChange={(e) => setPrinterConfig(prev => ({
                        ...prev,
                        chunkDelay: Math.max(0, Math.min(200, parseInt(e.target.value) || 30))
                      }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Delay antar chunk
                    </p>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium text-gray-700">
                    Tampilkan Logo/Nama Toko
                  </label>
                  <input
                    type="checkbox"
                    checked={printerConfig.showLogo}
                    onChange={(e) => setPrinterConfig(prev => ({
                      ...prev,
                      showLogo: e.target.checked
                    }))}
                    className="h-5 w-5 text-blue-600 rounded focus:ring-blue-500"
                  />
                </div>

                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium text-gray-700">
                    Bold Judul
                  </label>
                  <input
                    type="checkbox"
                    checked={printerConfig.boldTitle}
                    onChange={(e) => setPrinterConfig(prev => ({
                      ...prev,
                      boldTitle: e.target.checked
                    }))}
                    className="h-5 w-5 text-blue-600 rounded focus:ring-blue-500"
                  />
                </div>
              </div>

              {/* Printer Status */}
              <div className="pt-4 border-t border-gray-200">
                <h4 className="font-medium text-gray-900 mb-2">Status Printer</h4>
                <div className="text-sm space-y-2">
                  {bluetoothPrinter ? (
                    <div className="text-green-600 flex items-center">
                      <Bluetooth className="h-4 w-4 mr-2" />
                      Terhubung ke: {bluetoothPrinter.device.name || 'Unknown Device'}
                    </div>
                  ) : (
                    <div className="text-red-600">
                      Printer belum terhubung
                    </div>
                  )}

                  {bluetoothSupported ? (
                    <div className="text-green-600">
                      ✓ Browser mendukung Web Bluetooth
                    </div>
                  ) : (
                    <div className="text-red-600">
                      ✗ Browser tidak mendukung Web Bluetooth
                    </div>
                  )}
                </div>
              </div>

              {/* Test Print Button */}
              {bluetoothPrinter && (
                <div className="pt-4">
                  <button
                    onClick={printTestPage}
                    disabled={isPrinting}
                    className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center justify-center space-x-2"
                  >
                    {isPrinting ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        <span>Mencetak Test Page...</span>
                      </>
                    ) : (
                      <>
                        <Printer className="h-4 w-4" />
                        <span>Cetak Test Page</span>
                      </>
                    )}
                  </button>
                </div>
              )}
            </div>

            <div className="p-6 border-t border-gray-200 flex justify-end">
              <button
                onClick={closeModals}
                className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                Simpan & Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Print Confirmation Modal */}
      {showPrintConfirmation && orderToPrint && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="p-6 border-b border-gray-200">
              <h3 className="text-xl font-semibold text-gray-900 flex items-center">
                <Printer className="h-5 w-5 mr-2 text-green-600" />
                Cetak Struk?
              </h3>
            </div>

            <div className="p-6">
              <div className="text-center mb-6">
                <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-3" />
                <p className="text-gray-700 mb-2">
                  Order <span className="font-semibold">{orderToPrint.order_number}</span>
                  telah diselesaikan!
                </p>
                <p className="text-sm text-gray-600 mb-4">
                  Total: {formatCurrency(orderToPrint.total_amount)}
                </p>
                <p className="text-gray-700">
                  Apakah Anda ingin mencetak struk untuk order ini?
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => handlePrintConfirmation(false)}
                  className="px-4 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors flex items-center justify-center space-x-2"
                >
                  <X className="h-4 w-4" />
                  <span>Nanti Saja</span>
                </button>
                <button
                  onClick={() => handlePrintConfirmation(true)}
                  disabled={isPrinting}
                  className="px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center justify-center space-x-2 disabled:opacity-50"
                >
                  {isPrinting ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span>Mencetak...</span>
                    </>
                  ) : (
                    <>
                      <Printer className="h-4 w-4" />
                      <span>Cetak Sekarang</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Printing Progress Overlay */}
      {isPrinting && printProgress.total > 0 && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
            <div className="text-center mb-4">
              <Printer className="h-12 w-12 text-blue-500 mx-auto mb-3 animate-pulse" />
              <h3 className="text-xl font-semibold text-gray-900">Mencetak Struk</h3>
              <p className="text-gray-600 mt-1">
                Mengirim data ke printer...
              </p>
            </div>

            <div className="mb-4">
              <div className="flex justify-between text-sm text-gray-600 mb-1">
                <span>Progress</span>
                <span>{printProgress.current} / {printProgress.total} chunks</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${(printProgress.current / printProgress.total) * 100}%` }}
                ></div>
              </div>
            </div>

            <p className="text-sm text-center text-gray-500">
              Jangan matikan printer selama proses cetak
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
