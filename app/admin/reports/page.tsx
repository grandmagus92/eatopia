'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { ReportData, ProductSales, CategorySales, TimeSeriesData, PieDataItem } from '@/types'
import { Calendar, Download, Filter, BarChart3, PieChart, TrendingUp, Menu, X, Package, Users, Star, Coffee, ChevronLeft, ChevronRight } from 'lucide-react'
import {
  BarChart, Bar,
  LineChart, Line,
  PieChart as RechartsPie, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from 'recharts'
import * as XLSX from 'xlsx'

const COLORS = ['#d97706', '#b45309', '#92400e', '#78350f', '#65a30d', '#059669', '#0d9488', '#0369a1', '#7c3aed', '#dc2626'];

// Helper function untuk waktu Indonesia
const getIndonesiaTime = () => {
  return new Date().toLocaleString("en-US", { timeZone: "Asia/Jakarta" });
};

// Helper function untuk mendapatkan Date object dengan timezone Jakarta
const getJakartaDate = () => {
  const now = new Date();
  const jakartaTime = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Jakarta" }));
  return jakartaTime;
};

const formatDateToIndonesia = (date: Date) => {
  return date.toLocaleDateString('id-ID', {
    timeZone: 'Asia/Jakarta',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });
};

// Helper function untuk mendapatkan tanggal dalam format input (YYYY-MM-DD)
const formatDateForInput = (date: Date) => {
  // Convert to Jakarta time first, then format
  const jakartaDate = new Date(date.toLocaleString("en-US", { timeZone: "Asia/Jakarta" }));
  const year = jakartaDate.getFullYear();
  const month = String(jakartaDate.getMonth() + 1).padStart(2, '0');
  const day = String(jakartaDate.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

// Custom label untuk Pie Chart
const renderCustomizedLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent, name }: any) => {
  if (!percent || percent < 0.05) return null;

  const RADIAN = Math.PI / 180;
  const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
  const x = cx + radius * Math.cos(-midAngle * RADIAN);
  const y = cy + radius * Math.sin(-midAngle * RADIAN);

  return (
    <text
      x={x}
      y={y}
      fill="white"
      textAnchor={x > cx ? 'start' : 'end'}
      dominantBaseline="central"
      fontSize={12}
      fontWeight="bold"
    >
      {`${(percent * 100).toFixed(0)}%`}
    </text>
  );
};

export default function ReportsPage() {
  const [timeRange, setTimeRange] = useState<'week' | 'month' | 'quarter' | 'year'>('month')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [reportData, setReportData] = useState<ReportData | null>(null)
  const [productSales, setProductSales] = useState<ProductSales[]>([])
  const [categorySales, setCategorySales] = useState<CategorySales[]>([])
  const [timeSeriesData, setTimeSeriesData] = useState<TimeSeriesData[]>([])
  const [pieChartData, setPieChartData] = useState<PieDataItem[]>([])
  const [loading, setLoading] = useState(false)
  const [isMobile, setIsMobile] = useState(false)
  const [showMobileFilters, setShowMobileFilters] = useState(false)

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage] = useState(10) // Default tetap 10 data per halaman

  // Detect screen size
  useEffect(() => {
    const checkScreenSize = () => {
      setIsMobile(window.innerWidth < 768)
    }

    checkScreenSize()
    window.addEventListener('resize', checkScreenSize)

    return () => window.removeEventListener('resize', checkScreenSize)
  }, [])

  useEffect(() => {
    // Set default date range to current month dengan waktu Indonesia
    const now = getJakartaDate();
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1)
    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0)

    setStartDate(formatDateForInput(firstDay))
    setEndDate(formatDateForInput(lastDay))
  }, [])

  useEffect(() => {
    if (startDate && endDate) {
      generateReports()
    }
  }, [startDate, endDate, timeRange])

  // Reset pagination ke halaman 1 ketika data berubah
  useEffect(() => {
    setCurrentPage(1)
  }, [productSales])

  const generateReports = async () => {
    setLoading(true)
    try {
      await Promise.all([
        fetchSummaryReport(),
        fetchProductSales(),
        fetchCategorySales(),
        fetchTimeSeriesData()
      ])
    } catch (error) {
      console.error('Error generating reports:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchSummaryReport = async () => {
    const { data: orders, error } = await supabase
      .from('orders')
      .select(`
        *,
        order_items(
          quantity,
          price,
          subtotal,
          products(name, category)
        )
      `)
      .gte('created_at', `${startDate}T00:00:00`)
      .lte('created_at', `${endDate}T23:59:59`)

    if (error) {
      console.error('Error fetching orders:', error)
      return
    }

    // Calculate summary statistics
    const totalRevenue = orders?.reduce((sum: number, order: any) => sum + order.total_amount, 0) || 0
    const totalOrders = orders?.length || 0
    const averageOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0

    // Hitung total cups (minuman) dan total snack terpisah
    let totalCups = 0
    let totalSnack = 0
    const productSalesMap = new Map()
    const categorySalesMap = new Map()

    // Define drink categories (minuman)
    const drinkCategories = ['Hot Coffee', 'Cold Coffee', 'Specialty', 'Basic', 'Mocktail', 'Non-Coffe']

    orders?.forEach((order: any) => {
      order.order_items?.forEach((item: any) => {
        const category = item.products?.category || 'Unknown'

        // Separate counting for drinks vs snacks
        if (drinkCategories.includes(category)) {
          totalCups += item.quantity
        } else if (category === 'Snacks') {
          totalSnack += item.quantity
        }

        // Product sales
        const productName = item.products?.name || 'Unknown'
        const currentProduct = productSalesMap.get(productName) || { quantity: 0, revenue: 0 }
        productSalesMap.set(productName, {
          quantity: currentProduct.quantity + item.quantity,
          revenue: currentProduct.revenue + item.subtotal
        })

        // Category sales
        const categoryKey = item.products?.category || 'Unknown'
        const currentCategory = categorySalesMap.get(categoryKey) || { quantity: 0, revenue: 0 }
        categorySalesMap.set(categoryKey, {
          quantity: currentCategory.quantity + item.quantity,
          revenue: currentCategory.revenue + item.subtotal
        })
      })
    })

    // Find best selling product
    let bestSellingProduct = '-'
    let bestSellingProductQuantity = 0
    let maxQuantity = 0
    productSalesMap.forEach((value, key) => {
      if (value.quantity > maxQuantity) {
        maxQuantity = value.quantity
        bestSellingProduct = key
        bestSellingProductQuantity = value.quantity
      }
    })

    // Find best selling category
    let bestSellingCategory = '-'
    let bestSellingCategoryQuantity = 0
    let maxCategoryRevenue = 0
    categorySalesMap.forEach((value, key) => {
      if (value.revenue > maxCategoryRevenue) {
        maxCategoryRevenue = value.revenue
        bestSellingCategory = key
        bestSellingCategoryQuantity = value.quantity
      }
    })

    // Hitung produk unik yang terjual
    const uniqueProductsSold = productSalesMap.size

    setReportData({
      period: `${startDate} to ${endDate}`,
      revenue: totalRevenue,
      orders: totalOrders,
      averageOrderValue,
      bestSellingProduct,
      bestSellingCategory,
      totalCups,
      totalSnack,
      bestSellingProductQuantity,
      bestSellingCategoryQuantity,
      uniqueProductsSold
    })
  }

  const fetchProductSales = async () => {
    const { data, error } = await supabase
      .from('order_items')
      .select(`
        quantity,
        price,
        subtotal,
        products(name, category)
      `)
      .gte('created_at', `${startDate}T00:00:00`)
      .lte('created_at', `${endDate}T23:59:59`)

    if (error) {
      console.error('Error fetching product sales:', error)
      return
    }

    const productMap = new Map()

    data?.forEach((item: any) => {
      const productName = item.products?.name || 'Unknown'
      const category = item.products?.category || 'Unknown'
      const current = productMap.get(productName) || {
        product_name: productName,
        category: category,
        quantity_sold: 0,
        total_revenue: 0,
        average_price: 0
      }

      productMap.set(productName, {
        ...current,
        quantity_sold: current.quantity_sold + item.quantity,
        total_revenue: current.total_revenue + item.subtotal,
        average_price: (current.total_revenue + item.subtotal) / (current.quantity_sold + item.quantity)
      })
    })

    const sortedProducts = Array.from(productMap.values())
      .sort((a: any, b: any) => b.total_revenue - a.total_revenue)

    setProductSales(sortedProducts)

    // Generate Pie Chart Data dari product sales (top 8 produk)
    const pieData: PieDataItem[] = sortedProducts.slice(0, 8).map((product: any) => ({
      name: product.product_name,
      value: product.total_revenue,
      quantity: product.quantity_sold
    }))
    setPieChartData(pieData)
  }

  const fetchCategorySales = async () => {
    const { data, error } = await supabase
      .from('order_items')
      .select(`
        quantity,
        subtotal,
        products(category)
      `)
      .gte('created_at', `${startDate}T00:00:00`)
      .lte('created_at', `${endDate}T23:59:59`)

    if (error) {
      console.error('Error fetching category sales:', error)
      return
    }

    const categoryMap = new Map()
    let totalRevenue = 0

    data?.forEach((item: any) => {
      const category = item.products?.category || 'Unknown'
      const current = categoryMap.get(category) || {
        category: category,
        quantity_sold: 0,
        total_revenue: 0
      }

      categoryMap.set(category, {
        ...current,
        quantity_sold: current.quantity_sold + item.quantity,
        total_revenue: current.total_revenue + item.subtotal
      })

      totalRevenue += item.subtotal
    })

    const categories = Array.from(categoryMap.values()).map((cat: any) => ({
      ...cat,
      percentage: totalRevenue > 0 ? (cat.total_revenue / totalRevenue) * 100 : 0
    })).sort((a: any, b: any) => b.total_revenue - a.total_revenue)

    setCategorySales(categories)
  }

  const fetchTimeSeriesData = async () => {
    let groupBy = 'day'
    if (timeRange === 'year') groupBy = 'month'
    if (timeRange === 'quarter') groupBy = 'week'

    const { data: orders, error } = await supabase
      .from('orders')
      .select(`
        *,
        order_items(
          quantity,
          price,
          subtotal
        )
      `)
      .gte('created_at', `${startDate}T00:00:00`)
      .lte('created_at', `${endDate}T23:59:59`)
      .order('created_at', { ascending: true })

    if (error) {
      console.error('Error fetching time series data:', error)
      return
    }

    const timeSeriesMap = new Map()

    orders?.forEach((order: any) => {
      const date = new Date(order.created_at)
      let key: string

      if (groupBy === 'day') {
        key = date.toLocaleDateString('id-ID', {
          day: 'numeric',
          month: 'short',
          timeZone: 'Asia/Jakarta'
        })
      } else if (groupBy === 'week') {
        const weekNumber = Math.ceil(date.getDate() / 7)
        key = `Minggu ${weekNumber}`
      } else {
        key = date.toLocaleDateString('id-ID', {
          month: 'short',
          timeZone: 'Asia/Jakarta'
        })
      }

      // Calculate total quantity from order_items
      const totalQuantity = order.order_items?.reduce((sum: number, item: any) => sum + item.quantity, 0) || 0

      const current = timeSeriesMap.get(key) || {
        date: key,
        revenue: 0,
        orders: 0,
        quantity: 0
      }

      timeSeriesMap.set(key, {
        date: key,
        revenue: current.revenue + order.total_amount,
        orders: current.orders + 1,
        quantity: current.quantity + totalQuantity
      })
    })

    const timeSeriesArray = Array.from(timeSeriesMap.values())
    setTimeSeriesData(timeSeriesArray)
  }

  // Pagination logic untuk product sales
  const indexOfLastItem = currentPage * itemsPerPage
  const indexOfFirstItem = indexOfLastItem - itemsPerPage
  const currentProductSales = productSales.slice(indexOfFirstItem, indexOfLastItem)
  const totalPages = Math.ceil(productSales.length / itemsPerPage)

  // Pagination controls
  const goToPage = (pageNumber: number) => {
    setCurrentPage(pageNumber)
  }

  const goToNextPage = () => {
    if (currentPage < totalPages) {
      setCurrentPage(currentPage + 1)
    }
  }

  const goToPrevPage = () => {
    if (currentPage > 1) {
      setCurrentPage(currentPage - 1)
    }
  }

  // Render pagination numbers
  const renderPaginationNumbers = () => {
    const pageNumbers = []
    const maxPageNumbers = isMobile ? 3 : 5

    if (totalPages <= maxPageNumbers) {
      for (let i = 1; i <= totalPages; i++) {
        pageNumbers.push(i)
      }
    } else {
      // Always show first page
      pageNumbers.push(1)

      let start = Math.max(2, currentPage - 1)
      let end = Math.min(totalPages - 1, currentPage + 1)

      // Adjust if at the beginning
      if (currentPage <= 2) {
        end = Math.min(totalPages - 1, 4)
      }

      // Adjust if at the end
      if (currentPage >= totalPages - 1) {
        start = Math.max(2, totalPages - 3)
      }

      // Add ellipsis after first page if needed
      if (start > 2) {
        pageNumbers.push('...')
      }

      // Add middle pages
      for (let i = start; i <= end; i++) {
        pageNumbers.push(i)
      }

      // Add ellipsis before last page if needed
      if (end < totalPages - 1) {
        pageNumbers.push('...')
      }

      // Always show last page
      if (totalPages > 1) {
        pageNumbers.push(totalPages)
      }
    }

    return pageNumbers
  }

  // Fungsi untuk menentukan unit berdasarkan kategori
  const getQuantityUnit = (category: string) => {
    const snackCategories = ['Snacks', 'Food'];
    const drinkCategories = ['Hot Coffee', 'Cold Coffee', 'Specialty', 'Basic', 'Mocktail', 'Non-Coffe'];

    if (snackCategories.includes(category)) {
      return 'pcs';
    } else if (drinkCategories.includes(category)) {
      return 'cups';
    } else {
      return 'pcs'; // Default untuk kategori lain
    }
  }

  // Fungsi untuk menampilkan quantity dengan unit yang sesuai
  const formatQuantity = (quantity: number, category: string) => {
    const unit = getQuantityUnit(category);
    return `${quantity} ${unit}`;
  }

  // Fungsi untuk menampilkan icon berdasarkan kategori
  const getCategoryIcon = (category: string) => {
    if (category === 'Snacks' || category === 'Food') {
      return <Package className="h-3 w-3 mr-2 text-orange-500" />;
    } else if (['Hot Coffee', 'Cold Coffee', 'Specialty', 'Basic', 'Mocktail', 'Non-Coffe'].includes(category)) {
      return <Coffee className="h-3 w-3 mr-2 text-blue-500" />;
    } else {
      return null;
    }
  }

  // ... (kode exportToPDF tetap sama)
  const exportToPDF = () => {
    const printWindow = window.open('', '_blank')
    if (printWindow) {
      // Calculate summary data for PDF
      const totalRevenue = reportData?.revenue || 0;
      const totalCups = reportData?.totalCups || 0;
      const totalSnack = reportData?.totalSnack || 0;
      const totalQuantity = totalCups + totalSnack;
      const totalOrders = reportData?.orders || 0;
      const bestSeller = reportData?.bestSellingProduct || '-';
      const bestSellerQty = reportData?.bestSellingProductQuantity || 0;
      const uniqueProducts = reportData?.uniqueProductsSold || 0;

      // Calculate category totals
      const categoryTotalQty = categorySales.reduce((sum, cat) => sum + cat.quantity_sold, 0);
      const categoryTotalRevenue = categorySales.reduce((sum, cat) => sum + cat.total_revenue, 0);

      printWindow.document.write(`
      <html>
        <head>
          <title>Laporan Penjualan ${startDate} - ${endDate}</title>
          <style>
            @import url('https://fonts.googleapis.com/css2?family=Roboto:wght@300;400;500;700&display=swap');
            
            * {
              margin: 0;
              padding: 0;
              box-sizing: border-box;
            }
            
            body {
              font-family: 'Roboto', Arial, sans-serif;
              margin: 0;
              padding: 20px;
              background: #ffffff;
              color: #000000;
              line-height: 1.4;
              font-size: 12px;
            }
            
            .container {
              max-width: 210mm;
              margin: 0 auto;
              background: white;
            }
            
            /* Header Styles */
            .header {
              text-align: center;
              margin-bottom: 25px;
              padding-bottom: 15px;
              border-bottom: 2px solid #000000;
            }
            
            .header h1 {
              font-size: 20px;
              font-weight: 700;
              color: #000000;
              margin-bottom: 5px;
              text-transform: uppercase;
            }
            
            .header h2 {
              font-size: 16px;
              font-weight: 400;
              color: #333333;
              margin-bottom: 15px;
            }
            
            .header-info {
              display: grid;
              grid-template-columns: repeat(3, 1fr);
              gap: 10px;
              margin-top: 15px;
              text-align: left;
            }
            
            .info-item {
              padding: 8px;
              border: 1px solid #dddddd;
              border-radius: 4px;
              background: #f9f9f9;
            }
            
            .info-label {
              font-size: 10px;
              color: #666666;
              font-weight: 500;
              margin-bottom: 3px;
              display: block;
            }
            
            .info-value {
              font-size: 12px;
              color: #000000;
              font-weight: 600;
            }
            
            /* Section Titles */
            .section-title {
              font-size: 14px;
              font-weight: 600;
              color: #000000;
              padding: 8px 0;
              margin: 20px 0 10px 0;
              border-bottom: 1px solid #000000;
              text-transform: uppercase;
            }
            
            /* Summary Stats */
            .summary-stats {
              display: grid;
              grid-template-columns: repeat(4, 1fr);
              gap: 10px;
              margin-bottom: 20px;
            }
            
            .stat-item {
              border: 1px solid #dddddd;
              border-radius: 4px;
              padding: 12px;
              text-align: center;
              background: #ffffff;
            }
            
            .stat-title {
              font-size: 10px;
              color: #666666;
              font-weight: 500;
              margin-bottom: 5px;
              display: block;
              text-transform: uppercase;
            }
            
            .stat-value {
              font-size: 16px;
              font-weight: 700;
              color: #000000;
              display: block;
            }
            
            .stat-note {
              font-size: 9px;
              color: #888888;
              margin-top: 3px;
              display: block;
            }
            
            /* Tables */
            table {
              width: 100%;
              border-collapse: collapse;
              margin: 15px 0;
              font-size: 11px;
              border: 1px solid #dddddd;
            }
            
            th {
              background: #f5f5f5;
              color: #000000;
              font-weight: 600;
              padding: 8px;
              text-align: left;
              border-bottom: 2px solid #000000;
              border-right: 1px solid #dddddd;
              text-transform: uppercase;
            }
            
            td {
              padding: 8px;
              border-bottom: 1px solid #dddddd;
              border-right: 1px solid #dddddd;
              vertical-align: top;
            }
            
            tr:last-child td {
              border-bottom: none;
            }
            
            td:last-child, th:last-child {
              border-right: none;
            }
            
            tfoot tr {
              background: #f5f5f5;
              font-weight: 600;
            }
            
            tfoot td {
              border-top: 2px solid #000000;
            }
            
            /* Table Numbers */
            .text-right {
              text-align: right;
            }
            
            .text-center {
              text-align: center;
            }
            
            .text-left {
              text-align: left;
            }
            
            /* Type Labels */
            .type-label {
              display: inline-block;
              padding: 2px 8px;
              border-radius: 3px;
              font-size: 9px;
              font-weight: 500;
              border: 1px solid #cccccc;
              background: #ffffff;
            }
            
            /* Divider */
            .divider {
              height: 1px;
              background: #dddddd;
              margin: 20px 0;
            }
            
            /* Summary Box */
            .summary-box {
              border: 1px solid #dddddd;
              border-radius: 4px;
              padding: 15px;
              margin: 15px 0;
              background: #f9f9f9;
            }
            
            .summary-row {
              display: grid;
              grid-template-columns: repeat(2, 1fr);
              gap: 15px;
              margin-bottom: 10px;
            }
            
            .summary-item h4 {
              font-size: 11px;
              color: #666666;
              font-weight: 500;
              margin-bottom: 5px;
            }
            
            .summary-item p {
              font-size: 13px;
              font-weight: 600;
              color: #000000;
            }
            
            /* Footer */
            .footer {
              margin-top: 30px;
              padding-top: 15px;
              border-top: 1px solid #dddddd;
              text-align: center;
              color: #666666;
              font-size: 10px;
            }
            
            .footer p {
              margin-bottom: 3px;
            }
            
            /* Print Styles */
            @media print {
              body {
                padding: 10px;
              }
              
              .container {
                padding: 0;
              }
              
              .no-print {
                display: none;
              }
            }
            
            /* Page Break */
            .page-break {
              page-break-before: always;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <!-- Header -->
            <div class="header">
              <h1>LAPORAN PENJUALAN</h1>
              <h2>EATOPIA COFFEE SHOP</h2>
              
              <div class="header-info">
                <div class="info-item">
                  <span class="info-label">Periode</span>
                  <span class="info-value">${startDate} - ${endDate}</span>
                </div>
                <div class="info-item">
                  <span class="info-label">Dibuat Pada</span>
                  <span class="info-value">${new Date(getIndonesiaTime()).toLocaleString('id-ID', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      })}</span>
                </div>
                <div class="info-item">
                  <span class="info-label">Durasi</span>
                  <span class="info-value">${Math.ceil((new Date(endDate).getTime() - new Date(startDate).getTime()) / (1000 * 60 * 60 * 24)) + 1} hari</span>
                </div>
              </div>
            </div>
            
            <!-- Summary Stats -->
            <div class="summary-stats">
              <div class="stat-item">
                <span class="stat-title">Total Revenue</span>
                <span class="stat-value">Rp ${totalRevenue.toLocaleString('id-ID')}</span>
                <span class="stat-note">${totalOrders} transaksi</span>
              </div>
              
              <div class="stat-item">
                <span class="stat-title">Total Cups</span>
                <span class="stat-value">${totalCups}</span>
                <span class="stat-note">cups terjual</span>
              </div>
              
              <div class="stat-item">
                <span class="stat-title">Total Snack</span>
                <span class="stat-value">${totalSnack}</span>
                <span class="stat-note">pcs terjual</span>
              </div>
              
              <div class="stat-item">
                <span class="stat-title">Best Seller</span>
                <span class="stat-value">${bestSeller.length > 12 ? bestSeller.substring(0, 12) + '...' : bestSeller}</span>
                <span class="stat-note">${bestSellerQty} pcs terjual</span>
              </div>
            </div>
            
            <div class="divider"></div>
            
            <!-- Products Table -->
            <div class="section-title">Produk Terlaris (Berdasarkan Revenue)</div>
            
            <table>
              <thead>
                <tr>
                  <th width="5%">No</th>
                  <th width="25%">Nama Produk</th>
                  <th width="15%">Kategori</th>
                  <th width="10%" class="text-center">Quantity</th>
                  <th width="15%" class="text-right">Harga Rata</th>
                  <th width="20%" class="text-right">Revenue</th>
                  <th width="10%" class="text-center">%</th>
                </tr>
              </thead>
              <tbody>
                ${productSales.map((product, index) => {
        const percentage = totalRevenue > 0 ? (product.total_revenue / totalRevenue * 100).toFixed(1) : '0.0';
        return `
                    <tr>
                      <td class="text-center">${index + 1}</td>
                      <td>${product.product_name}</td>
                      <td>${product.category}</td>
                      <td class="text-center">${product.quantity_sold} pcs</td>
                      <td class="text-right">Rp ${product.average_price?.toLocaleString('id-ID') || '0'}</td>
                      <td class="text-right">Rp ${product.total_revenue.toLocaleString('id-ID')}</td>
                      <td class="text-center">${percentage}%</td>
                    </tr>
                  `;
      }).join('')}
              </tbody>
              <tfoot>
                <tr>
                  <td colspan="3"><strong>TOTAL</strong></td>
                  <td class="text-center"><strong>${productSales.reduce((sum, p) => sum + p.quantity_sold, 0)} pcs</strong></td>
                  <td class="text-right"><strong>Rp ${Math.round(productSales.reduce((sum, p) => sum + (p.average_price || 0), 0) / productSales.length).toLocaleString('id-ID')}</strong></td>
                  <td class="text-right"><strong>Rp ${productSales.reduce((sum, p) => sum + p.total_revenue, 0).toLocaleString('id-ID')}</strong></td>
                  <td class="text-center"><strong>100%</strong></td>
                </tr>
              </tfoot>
            </table>
            
            <div class="divider"></div>
            
            <!-- Category Table -->
            <div class="section-title">Kinerja Kategori</div>
            
            <table>
              <thead>
                <tr>
                  <th width="5%">No</th>
                  <th width="30%">Kategori</th>
                  <th width="15%">Tipe</th>
                  <th width="15%" class="text-center">Quantity</th>
                  <th width="25%" class="text-right">Revenue</th>
                  <th width="10%" class="text-center">%</th>
                </tr>
              </thead>
              <tbody>
                ${categorySales.map((category, index) => {
        const isSnack = category.category === 'Snacks';
        const isDrink = ['Hot Coffee', 'Cold Coffee', 'Specialty', 'Basic', 'Mocktail', 'Non-Coffe'].includes(category.category);
        const type = isSnack ? 'Snack' : isDrink ? 'Minuman' : 'Lainnya';

        return `
                    <tr>
                      <td class="text-center">${index + 1}</td>
                      <td>${category.category}</td>
                      <td><span class="type-label">${type}</span></td>
                      <td class="text-center">${category.quantity_sold} pcs</td>
                      <td class="text-right">Rp ${category.total_revenue.toLocaleString('id-ID')}</td>
                      <td class="text-center">${category.percentage.toFixed(1)}%</td>
                    </tr>
                  `;
      }).join('')}
              </tbody>
              <tfoot>
                <tr>
                  <td colspan="3"><strong>TOTAL KATEGORI</strong></td>
                  <td class="text-center"><strong>${categoryTotalQty} pcs</strong></td>
                  <td class="text-right"><strong>Rp ${categoryTotalRevenue.toLocaleString('id-ID')}</strong></td>
                  <td class="text-center"><strong>100%</strong></td>
                </tr>
              </tfoot>
            </table>
            
            <!-- Summary Box -->
            <div class="summary-box">
              <div class="summary-row">
                <div class="summary-item">
                  <h4>Total Quantity Terjual</h4>
                  <p>${totalQuantity} items (${totalCups} cups + ${totalSnack} snack)</p>
                </div>
                <div class="summary-item">
                  <h4>Produk Unik Terjual</h4>
                  <p>${uniqueProducts} produk</p>
                </div>
              </div>
              <div class="summary-row">
                <div class="summary-item">
                  <h4>Kategori Terlaris</h4>
                  <p>${categorySales[0]?.category || '-'}</p>
                </div>
                <div class="summary-item">
                  <h4>Persentase Minuman</h4>
                  <p>${totalCups > 0 ? ((totalCups / totalQuantity) * 100).toFixed(1) : '0'}% dari total</p>
                </div>
              </div>
            </div>
            
            <!-- Time Series Table -->
            <div class="section-title">Trend Penjualan Harian</div>
            
            <table>
              <thead>
                <tr>
                  <th width="20%">Tanggal</th>
                  <th width="25%" class="text-right">Revenue</th>
                  <th width="15%" class="text-center">Orders</th>
                  <th width="20%" class="text-center">Quantity</th>
                  <th width="20%" class="text-right">Revenue per Order</th>
                </tr>
              </thead>
              <tbody>
                ${timeSeriesData.map((day, index) => {
        const revenuePerOrder = day.orders > 0 ? (day.revenue / day.orders) : 0;
        return `
                    <tr>
                      <td>${day.date}</td>
                      <td class="text-right">Rp ${day.revenue.toLocaleString('id-ID')}</td>
                      <td class="text-center">${day.orders}</td>
                      <td class="text-center">${day.quantity} pcs</td>
                      <td class="text-right">Rp ${revenuePerOrder.toLocaleString('id-ID')}</td>
                    </tr>
                  `;
      }).join('')}
              </tbody>
              <tfoot>
                <tr>
                  <td><strong>TOTAL</strong></td>
                  <td class="text-right"><strong>Rp ${timeSeriesData.reduce((sum, day) => sum + day.revenue, 0).toLocaleString('id-ID')}</strong></td>
                  <td class="text-center"><strong>${timeSeriesData.reduce((sum, day) => sum + day.orders, 0)}</strong></td>
                  <td class="text-center"><strong>${timeSeriesData.reduce((sum, day) => sum + day.quantity, 0)} pcs</strong></td>
                  <td class="text-right"><strong>Rp ${(totalOrders > 0 ? totalRevenue / totalOrders : 0).toLocaleString('id-ID')}</strong></td>
                </tr>
              </tfoot>
            </table>
            
            <!-- Footer -->
            <div class="footer">
              <p>Laporan ini dibuat secara otomatis oleh sistem Eatopia</p>
              <p>EATOPIA COFFEE SHOP • Document ID: SR-${startDate.replace(/-/g, '')}-${endDate.replace(/-/g, '')}</p>
              <p>Generated: ${new Date(getIndonesiaTime()).toLocaleString('id-ID', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
      })}</p>
            </div>
          </div>
          
          <script>
            // Auto-print after content loads
            window.onload = function() {
              setTimeout(function() {
                window.print();
              }, 500);
            }
          </script>
        </body>
      </html>
    `)
      printWindow.document.close()
    }
  }

  // PERBAIKAN: Fungsi quick date ranges dengan timezone Jakarta yang benar
  const quickDateRanges = {
    'Today': () => {
      const today = getJakartaDate();
      return {
        start: formatDateForInput(today),
        end: formatDateForInput(today)
      }
    },
    'This Week': () => {
      const today = getJakartaDate();
      const firstDay = new Date(today);
      firstDay.setDate(today.getDate() - today.getDay()); // Minggu
      const lastDay = new Date(today);
      lastDay.setDate(today.getDate() - today.getDay() + 6); // Sabtu

      return {
        start: formatDateForInput(firstDay),
        end: formatDateForInput(lastDay)
      }
    },
    'This Month': () => {
      const today = getJakartaDate();
      const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
      const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0);
      return {
        start: formatDateForInput(firstDay),
        end: formatDateForInput(lastDay)
      }
    },
    'Last Month': () => {
      const today = getJakartaDate();
      const firstDay = new Date(today.getFullYear(), today.getMonth() - 1, 1);
      const lastDay = new Date(today.getFullYear(), today.getMonth(), 0);
      return {
        start: formatDateForInput(firstDay),
        end: formatDateForInput(lastDay)
      }
    }
  }

  // Custom tooltip untuk Pie Chart dengan quantity
  const CustomPieTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      const total = pieChartData.reduce((sum: number, item: PieDataItem) => sum + item.value, 0);
      const percentage = total > 0 ? (data.value / total) * 100 : 0;

      return (
        <div className="bg-white p-3 border border-gray-300 rounded shadow-lg">
          <p className="font-semibold">{data.name}</p>
          <p className="text-amber-600">
            Rp {data.value.toLocaleString('id-ID')}
          </p>
          <p className="text-gray-600">
            {data.quantity} pcs terjual
          </p>
          <p className="text-gray-600 text-sm">
            {percentage.toFixed(1)}% of total
          </p>
        </div>
      );
    }
    return null;
  };

  // Custom tooltip untuk chart lainnya
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white p-3 border border-gray-300 rounded shadow-lg">
          <p className="font-semibold">{`${label}`}</p>
          {payload.map((entry: any, index: number) => (
            <p key={index} style={{ color: entry.color }}>
              {entry.name}: {entry.name.includes('Revenue') || entry.name.includes('Rp')
                ? `Rp ${Number(entry.value).toLocaleString('id-ID')}`
                : entry.name.includes('Quantity') || entry.name.includes('Orders')
                  ? `${entry.value} pcs`
                  : entry.value
              }
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  // Fungsi pie chart data
  const getPieChartTotal = (): number => {
    return pieChartData.reduce((sum: number, item: PieDataItem) => sum + item.value, 0);
  };

  // Toast notification
  const showToast = (type: 'success' | 'error', message: string) => {
    // Simple alert untuk sekarang
    if (type === 'success') {
      alert(`✅ ${message}`)
    } else {
      alert(`❌ ${message}`)
    }
  }

  // Format currency untuk YAxis - IMPROVED
  const formatYAxis = (value: number) => {
    if (value >= 1000000000) {
      return `Rp${(value / 1000000000).toFixed(1)}M`;
    }
    if (value >= 1000000) {
      return `Rp${(value / 1000000).toFixed(0)}Jt`;
    }
    if (value >= 1000) {
      return `Rp${(value / 1000).toFixed(0)}Rb`;
    }
    return `Rp${value}`;
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      {/* Header Section */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6 sm:mb-8">
        <div className="flex-1">
          <h1 className="text-2xl sm:text-3xl font-bold text-amber-900">Laporan Penjualan</h1>
          <p className="text-amber-600 mt-1 sm:mt-2 text-sm sm:text-base">Analisis detail performa kedai kopi Anda</p>
        </div>
        <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
        
          <button
            onClick={exportToPDF}
            className="bg-red-600 text-white px-3 sm:px-4 py-2 rounded-lg flex items-center justify-center space-x-2 hover:bg-red-700 transition-colors text-sm sm:text-base"
          >
            <Download className="h-4 w-4" />
            <span>Export PDF</span>
          </button>
        </div>
      </div>

      {/* Mobile Filter Toggle */}
      {isMobile && (
        <button
          onClick={() => setShowMobileFilters(!showMobileFilters)}
          className="w-full bg-white rounded-lg shadow p-4 mb-4 flex items-center justify-between"
        >
          <span className="flex items-center">
            <Filter className="h-5 w-5 mr-2" />
            Filter Laporan
          </span>
          {showMobileFilters ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      )}

      {/* Date Selector */}
      <div className={`bg-white rounded-lg shadow p-4 sm:p-6 mb-6 sm:mb-8 ${isMobile && !showMobileFilters ? 'hidden' : 'block'}`}>
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-4 gap-3">
          <h3 className="text-lg font-semibold flex items-center">
            <Filter className="h-5 w-5 mr-2" />
            Filter Laporan
          </h3>
          <div className="flex flex-wrap gap-2 w-full sm:w-auto">
            {Object.entries(quickDateRanges).map(([label, getDates]) => (
              <button
                key={label}
                onClick={() => {
                  const dates = getDates()
                  setStartDate(dates.start)
                  setEndDate(dates.end)
                  if (isMobile) setShowMobileFilters(false)
                }}
                className="px-3 py-1 text-xs sm:text-sm bg-amber-100 text-amber-800 rounded-md hover:bg-amber-200 transition-colors flex-1 sm:flex-none text-center"
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1 sm:mb-2">Tanggal Mulai</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1 sm:mb-2">Tanggal Akhir</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1 sm:mb-2">Rentang Waktu</label>
            <select
              value={timeRange}
              onChange={(e) => setTimeRange(e.target.value as any)}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
            >
              <option value="week">Mingguan</option>
              <option value="month">Bulanan</option>
              <option value="quarter">Triwulan</option>
              <option value="year">Tahunan</option>
            </select>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center items-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-amber-600"></div>
        </div>
      ) : (
        <>
          {/* Summary Cards */}
          {reportData && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 lg:gap-6 mb-6 sm:mb-8">
              <div className="bg-white rounded-lg shadow p-4 sm:p-6">
                <div className="flex items-center">
                  <div className="h-8 w-8 sm:h-10 sm:w-10 bg-green-100 rounded-full flex items-center justify-center">
                    <span className="text-green-600 font-bold text-sm">Rp</span>
                  </div>
                  <div className="ml-3 sm:ml-4">
                    <p className="text-xs sm:text-sm font-medium text-gray-600">Total Revenue</p>
                    <p className="text-lg sm:text-xl font-bold text-gray-900 truncate">
                      Rp {reportData.revenue.toLocaleString('id-ID')}
                    </p>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-lg shadow p-4 sm:p-6">
                <div className="flex items-center">
                  <div className="h-8 w-8 sm:h-10 sm:w-10 bg-blue-100 rounded-full flex items-center justify-center">
                    <Coffee className="h-4 w-4 sm:h-5 sm:w-5 text-blue-600" />
                  </div>
                  <div className="ml-3 sm:ml-4">
                    <p className="text-xs sm:text-sm font-medium text-gray-600">Total Cups</p>
                    <p className="text-lg sm:text-xl font-bold text-gray-900">
                      {reportData.totalCups} cups
                    </p>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-lg shadow p-4 sm:p-6">
                <div className="flex items-center">
                  <div className="h-8 w-8 sm:h-10 sm:w-10 bg-orange-100 rounded-full flex items-center justify-center">
                    <Package className="h-4 w-4 sm:h-5 sm:w-5 text-orange-600" />
                  </div>
                  <div className="ml-3 sm:ml-4">
                    <p className="text-xs sm:text-sm font-medium text-gray-600">Total Snack</p>
                    <p className="text-lg sm:text-xl font-bold text-gray-900">
                      {reportData.totalSnack} pcs
                    </p>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-lg shadow p-4 sm:p-6">
                <div className="flex items-center">
                  <div className="h-8 w-8 sm:h-10 sm:w-10 bg-amber-100 rounded-full flex items-center justify-center">
                    <Star className="h-4 w-4 sm:h-5 sm:w-5 text-amber-600" />
                  </div>
                  <div className="ml-3 sm:ml-4">
                    <p className="text-xs sm:text-sm font-medium text-gray-600">Best Seller</p>
                    <p className="text-base sm:text-lg font-bold text-gray-900 truncate" title={reportData.bestSellingProduct}>
                      {reportData.bestSellingProduct}
                    </p>
                    <p className="text-xs text-gray-600">{reportData.bestSellingProductQuantity} pcs</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Additional Stats */}
          {reportData && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 mb-6 sm:mb-8">
              <div className="bg-white rounded-lg shadow p-4">
                <div className="text-center">
                  <p className="text-sm font-medium text-gray-600">Total Quantity</p>
                  <p className="text-lg font-bold text-gray-900">
                    {reportData.totalCups + reportData.totalSnack} items
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    ({reportData.totalCups} cups + {reportData.totalSnack} snack)
                  </p>
                </div>
              </div>
              <div className="bg-white rounded-lg shadow p-4">
                <div className="text-center">
                  <p className="text-sm font-medium text-gray-600">Best Category</p>
                  <p className="text-lg font-bold text-gray-900 truncate" title={reportData.bestSellingCategory}>
                    {reportData.bestSellingCategory}
                  </p>
                  <p className="text-xs text-gray-600">{reportData.bestSellingCategoryQuantity} pcs</p>
                </div>
              </div>
            </div>
          )}

          {/* Charts Grid */}
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 sm:gap-6 lg:gap-8 mb-6 sm:mb-8">
            {/* Revenue Trend */}
            <div className="bg-white rounded-lg shadow p-4 sm:p-6">
              <h3 className="text-base sm:text-lg font-semibold mb-3 sm:mb-4 flex items-center">
                <TrendingUp className="h-4 w-4 sm:h-5 sm:w-5 mr-2" />
                Revenue Trend
              </h3>
              <ResponsiveContainer width="100%" height={isMobile ? 250 : 300}>
                <LineChart
                  data={timeSeriesData}
                  margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis
                    dataKey="date"
                    fontSize={isMobile ? 10 : 12}
                    tickLine={false}
                    axisLine={{ stroke: '#e0e0e0' }}
                  />
                  <YAxis
                    fontSize={isMobile ? 10 : 12}
                    tickLine={false}
                    axisLine={{ stroke: '#e0e0e0' }}
                    tickFormatter={formatYAxis}
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend />
                  <Line
                    type="monotone"
                    dataKey="revenue"
                    stroke="#d97706"
                    strokeWidth={3}
                    name="Revenue"
                    dot={{
                      fill: '#d97706',
                      strokeWidth: 2,
                      r: isMobile ? 3 : 4,
                      stroke: '#fff',
                    }}
                    activeDot={{
                      r: isMobile ? 6 : 8,
                      stroke: '#d97706',
                      strokeWidth: 2,
                      fill: '#fff'
                    }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>

            {/* Quantity Trend */}
            <div className="bg-white rounded-lg shadow p-4 sm:p-6">
              <h3 className="text-base sm:text-lg font-semibold mb-3 sm:mb-4 flex items-center">
                <Package className="h-4 w-4 sm:h-5 sm:w-5 mr-2" />
                Quantity Trend
              </h3>
              <ResponsiveContainer width="100%" height={isMobile ? 250 : 300}>
                <BarChart
                  data={timeSeriesData}
                  margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis
                    dataKey="date"
                    fontSize={isMobile ? 10 : 12}
                    tickLine={false}
                    axisLine={{ stroke: '#e0e0e0' }}
                  />
                  <YAxis
                    fontSize={isMobile ? 10 : 12}
                    tickLine={false}
                    axisLine={{ stroke: '#e0e0e0' }}
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend />
                  <Bar
                    dataKey="quantity"
                    fill="#059669"
                    name="Quantity Terjual"
                    radius={[4, 4, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Sales by Product Name */}
            <div className="bg-white rounded-lg shadow p-4 sm:p-6">
              <h3 className="text-base sm:text-lg font-semibold mb-3 sm:mb-4 flex items-center">
                <PieChart className="h-4 w-4 sm:h-5 sm:w-5 mr-2" />
                Sales by Product Name
              </h3>

              {pieChartData.length > 0 ? (
                <>
                  <div className="flex flex-col lg:flex-row items-center">
                    <ResponsiveContainer width="100%" height={isMobile ? 200 : 250}>
                      <RechartsPie>
                        <Pie
                          data={pieChartData}
                          cx="50%"
                          cy="50%"
                          labelLine={false}
                          outerRadius={isMobile ? 70 : 90}
                          fill="#8884d8"
                          dataKey="value"
                          label={renderCustomizedLabel}
                        >
                          {pieChartData.map((entry: PieDataItem, index: number) => (
                            <Cell
                              key={`cell-${index}`}
                              fill={COLORS[index % COLORS.length]}
                            />
                          ))}
                        </Pie>
                        <Tooltip content={<CustomPieTooltip />} />
                      </RechartsPie>
                    </ResponsiveContainer>

                    {/* Legend Manual */}
                    <div className="mt-4 lg:mt-0 lg:ml-4 w-full lg:w-1/2">
                      <div className="grid grid-cols-1 gap-2 text-xs sm:text-sm">
                        {pieChartData.map((item: PieDataItem, index: number) => {
                          const total = getPieChartTotal();
                          const percentage = total > 0 ? (item.value / total) * 100 : 0;
                          return (
                            <div key={item.name} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                              <div className="flex items-center flex-1 min-w-0">
                                <div
                                  className="w-3 h-3 rounded-full mr-2 shrink-0"
                                  style={{ backgroundColor: COLORS[index % COLORS.length] }}
                                />
                                <span className="truncate text-sm" title={item.name}>
                                  {item.name}
                                </span>
                              </div>
                              <div className="text-right shrink-0 ml-2">
                                <div className="text-gray-600 font-medium text-sm">
                                  {percentage.toFixed(1)}%
                                </div>
                                <div className="text-xs text-gray-500">
                                  {item.quantity} pcs
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </>
              ) : (
                <div className="flex items-center justify-center h-48">
                  <p className="text-gray-500 text-sm">Tidak ada data penjualan untuk periode yang dipilih</p>
                </div>
              )}
            </div>

            {/* Top Products by Revenue - IMPROVED */}
            <div className="bg-white rounded-lg shadow p-4 sm:p-6">
              <h3 className="text-base sm:text-lg font-semibold mb-3 sm:mb-4 flex items-center justify-between">
                <span className="flex items-center">
                  <Star className="h-4 w-4 sm:h-5 sm:w-5 mr-2 text-amber-500" />
                  Top 10 Products by Revenue
                </span>
                {productSales.length > 0 && (
                  <span className="text-xs bg-amber-100 text-amber-800 px-2 py-1 rounded-full">
                    {productSales.length} products
                  </span>
                )}
              </h3>

              <ResponsiveContainer width="100%" height={isMobile ? 320 : 380}>
                <BarChart
                  data={productSales.slice(0, 10)} // Tetap 10 data untuk chart
                  layout="vertical"
                  margin={{
                    top: 10,
                    right: 30,
                    left: isMobile ? 10 : 30,
                    bottom: 1
                  }}
                >
                  <defs>
                    <linearGradient id="revenueGradient" x1="0" y1="0" x2="1" y2="0">
                      <stop offset="0%" stopColor="#d97706" />
                      <stop offset="100%" stopColor="#f59e0b" />
                    </linearGradient>
                  </defs>

                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="#f3f4f6"
                    horizontal={true}
                    vertical={false}
                  />

                  <XAxis
                    type="number"
                    tickFormatter={formatYAxis}
                    fontSize={isMobile ? 11 : 12}
                    tickLine={false}
                    axisLine={{ stroke: '#e5e7eb' }}
                    tick={{ fill: '#6b7280' }}
                    tickMargin={10}
                  />

                  <YAxis
                    type="category"
                    dataKey="product_name"
                    width={isMobile ? 110 : 170}
                    tick={{
                      fontSize: isMobile ? 11 : 13,
                      fill: '#374151',
                      fontWeight: 500
                    }}
                    tickLine={false}
                    axisLine={{ stroke: '#e5e7eb' }}
                    interval={0}
                  />

                  <Tooltip
                    formatter={(value: number, name: string) => [
                      <div key="tooltip-content" className="text-center">
                        <div className="font-bold text-lg text-amber-600">
                          Rp {Number(value).toLocaleString('id-ID')}
                        </div>
                        <div className="text-sm text-gray-600 mt-1">
                          {name}
                        </div>
                      </div>,
                      ''
                    ]}
                    labelFormatter={(label) => (
                      <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-2">
                        <div className="font-bold text-amber-800 text-sm">{label}</div>
                      </div>
                    )}
                    contentStyle={{
                      backgroundColor: 'white',
                      border: 'none',
                      borderRadius: '12px',
                      boxShadow: '0 10px 25px -5px rgb(0 0 0 / 0.1)',
                      padding: '0'
                    }}
                  />

                  <Bar
                    dataKey="total_revenue"
                    name="Revenue"
                    radius={[0, 6, 6, 0]}
                    maxBarSize={isMobile ? 28 : 35}
                    fill="url(#revenueGradient)"
                  >
                    {productSales.slice(0, 10).map((entry, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={`url(#revenueGradient)`}
                        opacity={0.8 + (index * 0.02)}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>

              {/* Enhanced Summary Stats */}

            </div>
          </div>

          {/* Detailed Tables */}
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 sm:gap-6 lg:gap-8">
            {/* Product Sales Table dengan Pagination */}
            <div className="bg-white rounded-lg shadow">
              <div className="p-4 sm:p-6 border-b flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                  <h3 className="text-base sm:text-lg font-semibold">Product Sales Details</h3>
                  <p className="text-sm text-gray-600 mt-1">
                    Showing {indexOfFirstItem + 1}-{Math.min(indexOfLastItem, productSales.length)} of {productSales.length} products
                  </p>
                </div>

                {/* Pagination Controls */}
                {productSales.length > itemsPerPage && (
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={goToPrevPage}
                      disabled={currentPage === 1}
                      className={`p-2 rounded-md ${currentPage === 1
                          ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                          : 'bg-amber-100 text-amber-800 hover:bg-amber-200'
                        }`}
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </button>

                    <div className="flex items-center space-x-1">
                      {renderPaginationNumbers().map((pageNum, index) => (
                        <button
                          key={index}
                          onClick={() => typeof pageNum === 'number' ? goToPage(pageNum) : null}
                          className={`min-w-32px h-8 px-2 rounded-md text-sm ${pageNum === currentPage
                              ? 'bg-amber-600 text-white'
                              : typeof pageNum === 'number'
                                ? 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                : 'bg-transparent text-gray-400 cursor-default'
                            }`}
                          disabled={pageNum === '...'}
                        >
                          {pageNum}
                        </button>
                      ))}
                    </div>

                    <button
                      onClick={goToNextPage}
                      disabled={currentPage === totalPages}
                      className={`p-2 rounded-md ${currentPage === totalPages
                          ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                          : 'bg-amber-100 text-amber-800 hover:bg-amber-200'
                        }`}
                    >
                      <ChevronRight className="h-4 w-4" />
                    </button>
                  </div>
                )}
              </div>

              <div className="p-2 sm:p-4 lg:p-6">
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[500px]">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left py-2 text-xs sm:text-sm">No</th>
                        <th className="text-left py-2 text-xs sm:text-sm">Product Name</th>
                        <th className="text-left py-2 text-xs sm:text-sm">Category</th>
                        <th className="text-left py-2 text-xs sm:text-sm">Quantity</th>
                        <th className="text-left py-2 text-xs sm:text-sm">Revenue</th>
                      </tr>
                    </thead>
                    <tbody>
                      {currentProductSales.map((product: ProductSales, index: number) => (
                        <tr key={index} className="border-b hover:bg-gray-50">
                          <td className="py-2 sm:py-3 text-xs sm:text-sm">
                            {indexOfFirstItem + index + 1}
                          </td>
                          <td className="py-2 sm:py-3 font-medium text-xs sm:text-sm truncate max-w-[120px] sm:max-w-none">
                            <div className="flex items-center">
                              {getCategoryIcon(product.category)}
                              <span title={product.product_name}>
                                {product.product_name}
                              </span>
                            </div>
                          </td>
                          <td className="py-2 sm:py-3 text-xs sm:text-sm">
                            <span className={`px-2 py-1 rounded-full text-xs ${product.category === 'Snacks' || product.category === 'Food'
                                ? 'bg-orange-100 text-orange-800'
                                : ['Hot Coffee', 'Cold Coffee', 'Specialty', 'Basic', 'Mocktail', 'Non-Coffe'].includes(product.category)
                                  ? 'bg-blue-100 text-blue-800'
                                  : 'bg-gray-100 text-gray-800'
                              }`}>
                              {product.category}
                            </span>
                          </td>
                          <td className="py-2 sm:py-3 text-xs sm:text-sm">
                            <div className="flex items-center">
                              <span className="font-medium">
                                {formatQuantity(product.quantity_sold, product.category)}
                              </span>
                              {product.category === 'Snacks' || product.category === 'Food' ? (
                                <Package className="h-3 w-3 ml-1 text-orange-500" />
                              ) : ['Hot Coffee', 'Cold Coffee', 'Specialty', 'Basic', 'Mocktail', 'Non-Coffe'].includes(product.category) ? (
                                <Coffee className="h-3 w-3 ml-1 text-blue-500" />
                              ) : null}
                            </div>
                          </td>
                          <td className="py-2 sm:py-3 text-xs sm:text-sm font-medium text-green-700">
                            Rp {product.total_revenue.toLocaleString('id-ID')}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    {productSales.length > 0 && (
                      <tfoot>
                        <tr className="bg-gray-50 font-semibold">
                          <td colSpan={3} className="py-2 sm:py-3 text-xs sm:text-sm">TOTAL (Page {currentPage})</td>
                          <td className="py-2 sm:py-3 text-xs sm:text-sm">
                            {currentProductSales.reduce((sum, product) => sum + product.quantity_sold, 0)} items
                          </td>
                          <td className="py-2 sm:py-3 text-xs sm:text-sm text-green-700">
                            Rp {currentProductSales.reduce((sum, product) => sum + product.total_revenue, 0).toLocaleString('id-ID')}
                          </td>
                        </tr>
                        {productSales.length > itemsPerPage && (
                          <tr className="bg-amber-50 text-amber-800">
                            <td colSpan={5} className="py-2 sm:py-3 text-xs sm:text-sm text-center">
                              Total all products: {productSales.reduce((sum, product) => sum + product.quantity_sold, 0)} items •
                              Rp {productSales.reduce((sum, product) => sum + product.total_revenue, 0).toLocaleString('id-ID')}
                            </td>
                          </tr>
                        )}
                      </tfoot>
                    )}
                  </table>
                </div>

                {/* Pagination Footer untuk mobile */}
                {isMobile && productSales.length > itemsPerPage && (
                  <div className="mt-4 flex justify-between items-center">
                    <button
                      onClick={goToPrevPage}
                      disabled={currentPage === 1}
                      className={`px-3 py-1 rounded text-sm ${currentPage === 1
                          ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                          : 'bg-amber-100 text-amber-800'
                        }`}
                    >
                      Previous
                    </button>
                    <span className="text-sm text-gray-600">
                      Page {currentPage} of {totalPages}
                    </span>
                    <button
                      onClick={goToNextPage}
                      disabled={currentPage === totalPages}
                      className={`px-3 py-1 rounded text-sm ${currentPage === totalPages
                          ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                          : 'bg-amber-100 text-amber-800'
                        }`}
                    >
                      Next
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Category Sales Table */}
            <div className="bg-white rounded-lg shadow">
              <div className="p-4 sm:p-6 border-b">
                <div className="flex justify-between items-center">
                  <h3 className="text-base sm:text-lg font-semibold">Category Performance</h3>
                  <div className="text-sm text-gray-600">
                    Total: {categorySales.reduce((sum, cat) => sum + cat.quantity_sold, 0)} items
                  </div>
                </div>
              </div>
              <div className="p-2 sm:p-4 lg:p-6">
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[500px]">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left py-2 text-xs sm:text-sm">Category</th>
                        <th className="text-left py-2 text-xs sm:text-sm">Type</th>
                        <th className="text-left py-2 text-xs sm:text-sm">Quantity</th>
                        <th className="text-left py-2 text-xs sm:text-sm">Revenue</th>
                        <th className="text-left py-2 text-xs sm:text-sm">Percentage</th>
                      </tr>
                    </thead>
                    <tbody>
                      {categorySales.map((category: CategorySales, index: number) => {
                        const isSnack = category.category === 'Snacks';
                        const isDrink = ['Hot Coffee', 'Cold Coffee', 'Specialty', 'Basic', 'Mocktail', 'Non-Coffe'].includes(category.category);
                        const type = isSnack ? 'Snack' : isDrink ? 'Drink' : 'Other';

                        return (
                          <tr key={index} className="border-b hover:bg-gray-50">
                            <td className="py-2 sm:py-3 text-xs sm:text-sm">
                              <div className="flex items-center">
                                {getCategoryIcon(category.category)}
                                {category.category}
                              </div>
                            </td>
                            <td className="py-2 sm:py-3 text-xs sm:text-sm">
                              <span className={`px-2 py-1 rounded-full text-xs ${type === 'Drink' ? 'bg-blue-100 text-blue-800' :
                                type === 'Snack' ? 'bg-orange-100 text-orange-800' :
                                  'bg-gray-100 text-gray-800'
                                }`}>
                                {type}
                              </span>
                            </td>
                            <td className="py-2 sm:py-3 text-xs sm:text-sm">
                              <div className="flex items-center">
                                <span className="font-medium">
                                  {formatQuantity(category.quantity_sold, category.category)}
                                </span>
                                {isSnack ? (
                                  <Package className="h-3 w-3 ml-1 text-orange-500" />
                                ) : isDrink ? (
                                  <Coffee className="h-3 w-3 ml-1 text-blue-500" />
                                ) : null}
                              </div>
                            </td>
                            <td className="py-2 sm:py-3 text-xs sm:text-sm">Rp {category.total_revenue.toLocaleString('id-ID')}</td>
                            <td className="py-2 sm:py-3 text-xs sm:text-sm">{category.percentage.toFixed(1)}%</td>
                          </tr>
                        );
                      })}
                    </tbody>
                    {/* Summary Row */}
                    {categorySales.length > 0 && (
                      <tfoot>
                        <tr className="bg-gray-50 font-semibold">
                          <td colSpan={2} className="py-2 sm:py-3 text-xs sm:text-sm">TOTAL</td>
                          <td className="py-2 sm:py-3 text-xs sm:text-sm">
                            {categorySales.reduce((sum, cat) => sum + cat.quantity_sold, 0)} items
                          </td>
                          <td className="py-2 sm:py-3 text-xs sm:text-sm">
                            Rp {categorySales.reduce((sum, cat) => sum + cat.total_revenue, 0).toLocaleString('id-ID')}
                          </td>
                          <td className="py-2 sm:py-3 text-xs sm:text-sm">100%</td>
                        </tr>
                      </tfoot>
                    )}
                  </table>
                </div>

                {/* Summary Breakdown */}
                {categorySales.length > 0 && (
                  <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium text-gray-600">Total Cups</p>
                          <p className="text-lg font-bold text-blue-700">
                            {reportData?.totalCups || 0} cups
                          </p>
                        </div>
                        <Coffee className="h-8 w-8 text-blue-600" />
                      </div>
                    </div>

                    <div className="bg-orange-50 p-4 rounded-lg border border-orange-200">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium text-gray-600">Total Snack</p>
                          <p className="text-lg font-bold text-orange-700">
                            {reportData?.totalSnack || 0} pcs
                          </p>
                        </div>
                        <Package className="h-8 w-8 text-orange-600" />
                      </div>
                    </div>

                    <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium text-gray-600">Total Quantity</p>
                          <p className="text-lg font-bold text-gray-700">
                            {(reportData?.totalCups || 0) + (reportData?.totalSnack || 0)} items
                          </p>
                        </div>
                        <Users className="h-8 w-8 text-gray-600" />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
