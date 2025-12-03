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
  Minus,
  Printer,
  Bluetooth,
  Settings,
  AlertCircle,
  Download,
  Upload
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

export default function OrdersPage() {
  // State utama
  const [orders, setOrders] = useState<Order[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [isMobile, setIsMobile] = useState(false)
  const [selectedDate, setSelectedDate] = useState<string>('')

  // State modal
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showDetailModal, setShowDetailModal] = useState(false)
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null)
  const [submitLoading, setSubmitLoading] = useState(false)

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
    items: []
  })

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
  // FUNGSI CETAK ESC/POS DENGAN CHUNKING
  // ============================

  // Fungsi untuk membagi data menjadi chunk-chunk kecil
  const chunkData = (data: Uint8Array, chunkSize: number): Uint8Array[] => {
    const chunks: Uint8Array[] = []
    for (let i = 0; i < data.length; i += chunkSize) {
      chunks.push(data.slice(i, i + chunkSize))
    }
    return chunks
  }

  // Fungsi write dengan retry logic
  const writeWithRetry = async (characteristic: any, data: Uint8Array, maxRetries = 3): Promise<boolean> => {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        await characteristic.writeValue(data)
        return true
      } catch (error: any) {
        console.error(`Attempt ${attempt} failed:`, error.message)

        if (attempt === maxRetries) {
          throw error
        }

        // Wait before retry
        await new Promise(resolve => setTimeout(resolve, 100 * attempt))
      }
    }
    return false
  }

  // Generate ESC/POS commands yang efisien
  const generateEfficientStruk = (order: Order): string => {
    const ESC = '\x1B'
    const GS = '\x1D'
    const LF = '\x0A'

    const lines: string[] = []

    // Initialize printer
    lines.push(ESC + '@')

    // Header - Center aligned
    lines.push(ESC + 'a' + '\x01')

    if (printerConfig.showLogo) {
      // Font size
      lines.push(GS + '!' + String.fromCharCode(printerConfig.fontSize))

      // Bold jika diaktifkan
      if (printerConfig.boldTitle) {
        lines.push(ESC + 'E' + '\x01')
      }

      lines.push(printerConfig.storeName.substring(0, 20))
      lines.push(LF)

      // Reset bold
      lines.push(ESC + 'E' + '\x00')

      // Reset font size
      lines.push(GS + '!' + '\x00')

      lines.push(printerConfig.storeAddress.substring(0, 30))
      lines.push(LF)
      lines.push('Telp: ' + printerConfig.storePhone)
      lines.push(LF)
      lines.push('Kasir' + printerConfig.storeKasir)
    }

    // Separator
    lines.push('='.repeat(printerConfig.paperWidth === 80 ? 40 : 32))
    lines.push(LF)

    // Left align untuk konten
    lines.push(ESC + 'a' + '\x00')

    // Order info (singkat)
    lines.push('No: ' + order.order_number)
    lines.push(LF)
    lines.push('Tgl: ' + new Date(order.created_at).toLocaleDateString('id-ID'))
    lines.push(LF)
    lines.push('Wkt: ' + new Date(order.created_at).toLocaleTimeString('id-ID', {
      hour: '2-digit',
      minute: '2-digit'
    }))
    lines.push(LF)

    if (order.completed_at) {
      lines.push('Sls: ' + new Date(order.completed_at).toLocaleTimeString('id-ID', {
        hour: '2-digit',
        minute: '2-digit'
      }))
      lines.push(LF)
    }

    lines.push('Kasir: Ilham')
    lines.push(LF)
    lines.push('Status: ' + order.status.toUpperCase())
    lines.push(LF)

    // Customer info jika ada
    if (order.customer_name) {
      lines.push('Cust: ' + order.customer_name.substring(0, 15))
      lines.push(LF)
    }
    if (order.customer_phone) {
      lines.push('Telp: ' + order.customer_phone)
      lines.push(LF)
    }

    // Separator
    lines.push('-'.repeat(printerConfig.paperWidth === 80 ? 40 : 32))
    lines.push(LF)

    // Header tabel
    const maxWidth = printerConfig.paperWidth === 80 ? 20 : 16
    lines.push('ITEM'.padEnd(maxWidth - 8) + 'QTY   HARGA')
    lines.push(LF)
    lines.push('-'.repeat(printerConfig.paperWidth === 80 ? 40 : 32))
    lines.push(LF)

    // Items - maksimal 10 item, nama dipotong
    if (order.order_items && order.order_items.length > 0) {
      order.order_items.slice(0, 10).forEach((item) => {
        const productName = item.products?.name || 'Produk'
        const truncatedName = productName.length > maxWidth - 10
          ? productName.substring(0, maxWidth - 10) + '..'
          : productName

        const qty = item.quantity.toString().padStart(2)
        const price = (item.price * item.quantity).toLocaleString('id-ID')

        const line = truncatedName.padEnd(maxWidth - 6) + qty + '   ' + price.padStart(8)
        lines.push(line)
        lines.push(LF)
      })

      if (order.order_items.length > 10) {
        lines.push(`...+${order.order_items.length - 10} item lain`)
        lines.push(LF)
      }
    } else {
      lines.push('Tidak ada item')
      lines.push(LF)
    }

    // Separator
    lines.push('-'.repeat(printerConfig.paperWidth === 80 ? 40 : 32))
    lines.push(LF)

    // Total - Right aligned dan Bold
    lines.push(ESC + 'a' + '\x02') // Right align
    lines.push(ESC + 'E' + '\x01') // Bold on
    lines.push('TOTAL: Rp ' + order.total_amount.toLocaleString('id-ID').padStart(10))
    lines.push(LF)
    lines.push(ESC + 'E' + '\x00') // Bold off

    // Pembayaran
    lines.push(ESC + 'a' + '\x00') // Left align
    lines.push('Bayar: ' + getPaymentMethodLabel(order.payment_method))
    lines.push(LF)

    // Catatan jika ada (dibatasi)
    if (order.notes && order.notes.trim()) {
      lines.push('-'.repeat(printerConfig.paperWidth === 80 ? 40 : 32))
      lines.push(LF)
      lines.push('Catatan:')
      lines.push(LF)

      // Split catatan menjadi baris-baris pendek
      const maxNoteLength = printerConfig.paperWidth === 80 ? 38 : 30
      const notes = order.notes
      for (let i = 0; i < notes.length; i += maxNoteLength) {
        const line = notes.substring(i, i + maxNoteLength)
        lines.push(line)
        lines.push(LF)
      }
    }

    // Separator akhir
    lines.push('='.repeat(printerConfig.paperWidth === 80 ? 40 : 32))
    lines.push(LF)

    // Footer - Center aligned
    lines.push(ESC + 'a' + '\x01')
    lines.push('Terima kasih')
    lines.push(LF)
    lines.push('*** ' + new Date().toLocaleDateString('id-ID') + ' ***')
    lines.push(LF)

    // Feed beberapa baris
    lines.push(ESC + 'd' + '\x03') // Feed 3 lines

    // Cut paper (partial cut)
    lines.push(GS + 'V' + '\x41' + '\x00')

    return lines.join('')
  }

  // Print ke Bluetooth printer dengan chunking
  const printToBluetooth = async (order: Order): Promise<boolean> => {
    if (!bluetoothPrinter?.characteristic) {
      showAlert(
        'Printer Belum Terhubung',
        'Printer Bluetooth belum terhubung. Silakan hubungkan printer terlebih dahulu.',
        'warning'
      )
      return false
    }

    try {
      setIsPrinting(true)
      setPrintProgress({ current: 0, total: 0 })

      // Generate ESC/POS commands
      const commands = generateEfficientStruk(order)
      const encoder = new TextEncoder()
      const data = encoder.encode(commands)

      console.log(`🖨️ Data size: ${data.length} bytes`)

      // Bagi data menjadi chunk-chunk kecil
      const chunks = chunkData(data, printerConfig.chunkSize)
      setPrintProgress({ current: 0, total: chunks.length })

      console.log(`📦 Sending ${chunks.length} chunks (${printerConfig.chunkSize} bytes each)`)

      // Kirim setiap chunk dengan delay
      for (let i = 0; i < chunks.length; i++) {
        try {
          console.log(`Sending chunk ${i + 1}/${chunks.length} (${chunks[i].length} bytes)`)

          await writeWithRetry(bluetoothPrinter.characteristic, chunks[i])
          setPrintProgress({ current: i + 1, total: chunks.length })

          // Delay kecil antar chunk
          if (i < chunks.length - 1) {
            await new Promise(resolve => setTimeout(resolve, printerConfig.chunkDelay))
          }
        } catch (error: any) {
          console.error(`Error sending chunk ${i + 1}:`, error)

          if (error.message.includes('512 bytes')) {
            showAlert(
              'Ukuran Data Terlalu Besar',
              `Chunk terlalu besar (${chunks[i].length} bytes). Mengurangi ukuran chunk...`,
              'warning'
            )

            // Coba dengan chunk size yang lebih kecil
            const smallerChunks = chunkData(data, 100)
            return await printWithChunks(smallerChunks)
          }

          throw error
        }
      }

      console.log('✅ Print berhasil')
      setPrintProgress({ current: 0, total: 0 })
      return true

    } catch (error: any) {
      console.error('❌ Error printing:', error)
      setPrintProgress({ current: 0, total: 0 })

      if (error.message.includes('disconnected')) {
        showAlert(
          'Printer Terputus',
          'Printer terputus. Silakan hubungkan kembali.',
          'error'
        )
        setBluetoothPrinter(null)
      } else if (error.message.includes('512 bytes')) {
        showAlert(
          'Error Mencetak',
          'Error: Data terlalu besar. Mencoba metode alternatif...',
          'warning'
        )
        return await printSimpleStruk(order)
      } else {
        showAlert(
          'Gagal Mencetak',
          'Gagal mencetak: ' + error.message,
          'error'
        )
      }

      return false
    } finally {
      setIsPrinting(false)
    }
  }

  // Fungsi helper untuk print dengan chunks
  const printWithChunks = async (chunks: Uint8Array[]): Promise<boolean> => {
    for (let i = 0; i < chunks.length; i++) {
      try {
        await bluetoothPrinter!.characteristic.writeValue(chunks[i])
        await new Promise(resolve => setTimeout(resolve, 50))
      } catch (error) {
        console.error('Failed to print with smaller chunks')
        return false
      }
    }
    return true
  }

  // Versi struk yang sangat sederhana (fallback)
  const printSimpleStruk = async (order: Order): Promise<boolean> => {
    try {
      // Generate struk sangat sederhana
      const ESC = '\x1B'
      const LF = '\x0A'

      let commands = ''
      commands += ESC + '@' // Initialize
      commands += ESC + 'a' + '\x01' // Center
      commands += 'STRUK' + LF
      commands += order.order_number + LF
      commands += new Date(order.created_at).toLocaleDateString('id-ID') + LF
      commands += '-'.repeat(32) + LF

      commands += ESC + 'a' + '\x00' // Left

      // Total saja
      commands += 'TOTAL: Rp ' + order.total_amount.toLocaleString('id-ID') + LF
      commands += 'Status: ' + order.status.toUpperCase() + LF

      commands += ESC + 'a' + '\x01' // Center
      commands += 'Terima kasih' + LF

      // Feed dan cut
      commands += ESC + 'd' + '\x03'
      commands += '\x1DV\x41\x00'

      const encoder = new TextEncoder()
      const data = encoder.encode(commands)

      // Pastikan data kecil
      if (data.length > 100) {
        // Potong menjadi 100 bytes
        const smallData = data.slice(0, 100)
        await bluetoothPrinter!.characteristic.writeValue(smallData)
      } else {
        await bluetoothPrinter!.characteristic.writeValue(data)
      }

      return true
    } catch (error) {
      console.error('Simple print failed:', error)
      return false
    }
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
  const printStruk = async (order: Order) => {
    // Cek jika Bluetooth printer sudah terhubung
    if (bluetoothPrinter) {
      const success = await printToBluetooth(order)
      if (success) {
        showAlert(
          'Cetak Berhasil',
          `Struk ${order.order_number} berhasil dicetak!`,
          'success'
        )
      } else {
        // Fallback ke browser print
        printStrukBrowser(order)
      }
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
            display :flex;
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
          ${order.completed_at ?
        `<div>Selesai: ${new Date(order.completed_at).toLocaleTimeString('id-ID')}</div>` :
        ''
      }
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
            <div>
                  TOTAL: Rp 
            </div>
            <div>
            ${order.total_amount.toLocaleString('id-ID')}
            </div>
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
  // FUNGSI DATABASE & ORDER
  // ============================

  // Fetch data dari Supabase
  const fetchOrders = async () => {
    try {
      setLoading(true)

      let query = supabase
        .from('orders')
        .select(`
          *,
          order_items(
            *,
            products(*)
          )
        `)
        .order('created_at', { ascending: false })

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

      const { data: ordersData, error: ordersError } = await query

      if (ordersError) {
        console.error('Error query utama:', ordersError)
        throw ordersError
      }

      setOrders(ordersData || [])
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

  // Update order status dengan konfirmasi cetak
  const updateOrderStatus = async (orderId: string, status: Order['status']) => {
    try {
      // Jika mengubah ke completed, tampilkan konfirmasi cetak
      if (status === 'completed') {
        const order = orders.find(o => o.id === orderId)
        if (order) {
          setOrderToPrint(order)
          setShowPrintConfirmation(true)
        }
      }

      // Update status di database
      const { error } = await supabase
        .from('orders')
        .update({
          status,
          completed_at: status === 'completed' ? new Date().toISOString() : null
        })
        .eq('id', orderId)

      if (error) throw error

      await fetchOrders()
      setShowMobileMenu(null)

      if (status !== 'completed') {
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

          await fetchOrders()
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
  // FUNGSI FORM ORDER
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
      // Generate order number dengan format ORD-YYYYMMDD-XXXX
      const now = new Date()
      const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '')
      const randomNum = Math.floor(Math.random() * 10000).toString().padStart(4, '0')
      const orderNumber = `ORD-${dateStr}-${randomNum}`

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

      // Tampilkan konfirmasi
      showAlert(
        'Order Berhasil',
        `✅ Order ${orderNumber} berhasil dibuat!\n\nTotal: Rp ${total_amount.toLocaleString('id-ID')}\nStatus: Pending`,
        'success'
      )

      // Otomatis print jika printer terhubung
      if (bluetoothPrinter) {
        const printSuccess = await printToBluetooth({
          ...order,
          order_items: orderItems.map((item, index) => ({
            ...item,
            products: products.find(p => p.id === formData.items[index].product_id)
          }))
        } as Order)

        if (!printSuccess) {
          showAlert(
            'Print Gagal',
            'Order berhasil dibuat, tetapi gagal mencetak struk.',
            'warning'
          )
        }
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

  // ============================
  // HELPER FUNCTIONS
  // ============================

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
      case 'ovo': return <CreditCard className="h-4 w-4" />
      case 'gopay': return <CreditCard className="h-4 w-4" />
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

  const totalItems = formData.items.reduce((sum, item) => sum + item.quantity, 0)

  // Format currency
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0
    }).format(amount)
  }

  // Calculate totals for dashboard
  const totalRevenue = orders
    .filter(order => order.status === 'completed')
    .reduce((sum, order) => sum + order.total_amount, 0)

  const todayOrders = orders.filter(order => {
    const orderDate = new Date(order.created_at).toDateString()
    const today = new Date().toDateString()
    return orderDate === today
  })

  const todayRevenue = todayOrders.reduce((sum, order) => sum + order.total_amount, 0)

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

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
        <div className="bg-white rounded-xl p-4 shadow-sm border border-amber-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Order Hari ini</p>
              <p className="text-xl md:text-2xl font-bold text-gray-900">{todayOrders.length}</p>
              <p className="text-xs text-gray-500 mt-1">{orders.length} total order</p>
            </div>
            <ShoppingCart className="h-7 w-7 md:h-8 md:w-8 text-amber-600" />
          </div>
        </div>

        <div className="bg-white rounded-xl p-4 shadow-sm border border-amber-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Pending</p>
              <p className="text-xl md:text-2xl font-bold text-yellow-600">
                {orders.filter(o => o.status === 'pending').length}
              </p>
            </div>
            <Clock className="h-7 w-7 md:h-8 md:w-8 text-yellow-600" />
          </div>
        </div>

        <div className="bg-white rounded-xl p-4 shadow-sm border border-amber-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Pendapatan Hari ini.</p>
              <p className="text-xl md:text-2xl font-bold text-green-600">
                {formatCurrency(todayRevenue)}
              </p>
              <p className="text-xs text-gray-500 mt-1">{formatCurrency(totalRevenue)} total</p>
            </div>
            <CreditCard className="h-7 w-7 md:h-8 md:w-8 text-green-600" />
          </div>
        </div>

        <div className="bg-white rounded-xl p-4 shadow-sm border border-amber-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Completed</p>
              <p className="text-xl md:text-2xl font-bold text-green-600">
                {orders.filter(o => o.status === 'completed').length}
              </p>
              <p className="text-xs text-gray-500 mt-1">{formatCurrency(todayRevenue)} hari ini</p>
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
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-3">
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => {
                setSelectedDate(e.target.value)
                setTimeout(() => fetchOrders(), 100)
              }}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
            />

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

            {selectedDate && (
              <button
                onClick={() => {
                  setSelectedDate('')
                  fetchOrders()
                }}
                className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Clear Date
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
            {filteredOrders.length === 0 ? (
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
            ) : (
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
                              <span>Detail</span>
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
                        <p className="text-gray-600">Pembayaran</p>
                        <p className="text-gray-900 text-xs capitalize">
                          {getPaymentMethodLabel(order.payment_method)}
                        </p>
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
                  <th className="text-left py-4 px-4 text-sm font-semibold text-amber-900">Pembayaran</th>
                  <th className="text-left py-4 px-4 text-sm font-semibold text-amber-900">Tanggal</th>
                  <th className="text-left py-4 px-4 text-sm font-semibold text-amber-900">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {filteredOrders.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-12 text-center">
                      <ShoppingCart className="h-16 w-16 text-gray-300 mx-auto mb-4" />
                      <p className="text-gray-500">Tidak ada order yang ditemukan</p>
                      <button
                        onClick={openCreateModal}
                        className="mt-4 text-amber-600 hover:text-amber-700 font-medium transition-colors"
                      >
                        Buat order pertama
                      </button>
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
                              title="Detail Order"
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
                          <td colSpan={8} className="py-4 px-4">
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

      {/* Order Detail Modal */}
      {showDetailModal && selectedOrder && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200 flex items-center justify-between">
              <div>
                <h3 className="text-xl font-semibold text-gray-900">
                  Detail Order
                </h3>
                <p className="text-sm text-gray-600 mt-1">{selectedOrder.order_number}</p>
              </div>
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
                    <div>
                      <p className="text-xs text-gray-600">Tanggal Order</p>
                      <p className="text-sm text-gray-900">
                        {new Date(selectedOrder.created_at).toLocaleString('id-ID')}
                      </p>
                    </div>
                  </div>
                </div>

                <div>
                  <h4 className="font-medium text-gray-900 mb-3 flex items-center">
                    <CreditCard className="h-4 w-4 mr-2 text-amber-600" />
                    Informasi Pembayaran
                  </h4>
                  <div className="space-y-2">
                    <div>
                      <p className="text-xs text-gray-600">Total Amount</p>
                      <p className="text-lg font-semibold text-gray-900">
                        {formatCurrency(selectedOrder.total_amount)}
                      </p>
                    </div>
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
                  Detail Produk yang Dipesan ({selectedOrder.order_items?.length || 0} item)
                </h4>
                <div className="space-y-2">
                  {selectedOrder.order_items && selectedOrder.order_items.length > 0 ? (
                    selectedOrder.order_items.map((item) => (
                      <div key={item.id} className="flex justify-between items-center p-3 bg-gray-50 rounded-lg border border-gray-200">
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
                    ))
                  ) : (
                    <div className="text-center py-4 text-gray-500 text-sm">
                      Tidak ada produk
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
                    {formatCurrency(selectedOrder.total_amount)}
                  </span>
                </div>
                <div className="mt-2 text-xs text-amber-700">
                  Dibuat pada {new Date(selectedOrder.created_at).toLocaleString('id-ID')}
                  {selectedOrder.completed_at && (
                    <span> • Selesai pada {new Date(selectedOrder.completed_at).toLocaleString('id-ID')}</span>
                  )}
                </div>
              </div>
            </div>

            <div className="p-6 border-t border-gray-200 flex flex-col sm:flex-row justify-between gap-3">
              <div className="flex gap-2">
                <button
                  onClick={() => printStruk(selectedOrder)}
                  className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors flex items-center space-x-2"
                >
                  <Printer className="h-4 w-4" />
                  <span>Cetak Struk</span>
                </button>
                {bluetoothPrinter && (
                  <button
                    onClick={() => updateOrderStatus(selectedOrder.id, 'completed')}
                    className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center space-x-2"
                  >
                    <CheckCircle className="h-4 w-4" />
                    <span>Mark as Completed</span>
                  </button>
                )}
              </div>
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

      {/* Printer Configuration Modal */}
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
