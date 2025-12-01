'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { ReportData, ProductSales, CategorySales, TimeSeriesData, PieDataItem } from '@/types'
import { Calendar, Download, Filter, BarChart3, PieChart, TrendingUp, Menu, X, Package, Users, Star } from 'lucide-react'
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

    // Hitung total quantity terjual
    let totalQuantitySold = 0
    const productSalesMap = new Map()
    const categorySalesMap = new Map()

    orders?.forEach((order: any) => {
      order.order_items?.forEach((item: any) => {
        totalQuantitySold += item.quantity

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
      totalQuantitySold,
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
      .slice(0, 10)

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

  const exportToXLS = () => {
    try {
      // Create workbook
      const workbook = XLSX.utils.book_new()

      // Worksheet 1: Summary
      const summaryData = [
        ['LAPORAN PENJUALAN - COFFEE POS'],
        [`Periode: ${startDate} hingga ${endDate}`],
        [],
        ['SUMMARY'],
        ['Total Revenue', `Rp ${reportData?.revenue.toLocaleString('id-ID')}`],
        ['Total Orders', reportData?.orders],
        ['Total Quantity Terjual', reportData?.totalQuantitySold],
        ['Produk Unik Terjual', reportData?.uniqueProductsSold],
        ['Average Order Value', `Rp ${reportData?.averageOrderValue.toLocaleString('id-ID')}`],
        ['Best Selling Product', `${reportData?.bestSellingProduct} (${reportData?.bestSellingProductQuantity} pcs)`],
        ['Best Selling Category', `${reportData?.bestSellingCategory} (${reportData?.bestSellingCategoryQuantity} pcs)`],
        [],
        ['Generated on', new Date(getIndonesiaTime()).toLocaleString('id-ID')]
      ]

      const summarySheet = XLSX.utils.aoa_to_sheet(summaryData)
      XLSX.utils.book_append_sheet(workbook, summarySheet, 'Summary')

      // Worksheet 2: Product Sales
      const productData = [
        ['PRODUCT SALES'],
        ['Product Name', 'Category', 'Quantity Sold', 'Average Price', 'Revenue (Rp)'],
        ...productSales.map(product => [
          product.product_name,
          product.category,
          product.quantity_sold,
          `Rp ${product.average_price?.toLocaleString('id-ID') || '0'}`,
          product.total_revenue
        ])
      ]

      const productSheet = XLSX.utils.aoa_to_sheet(productData)
      XLSX.utils.book_append_sheet(workbook, productSheet, 'Product Sales')

      // Worksheet 3: Category Sales
      const categoryData = [
        ['CATEGORY SALES'],
        ['Category', 'Quantity Sold', 'Revenue (Rp)', 'Percentage (%)'],
        ...categorySales.map(category => [
          category.category,
          category.quantity_sold,
          category.total_revenue,
          category.percentage.toFixed(2)
        ])
      ]

      const categorySheet = XLSX.utils.aoa_to_sheet(categoryData)
      XLSX.utils.book_append_sheet(workbook, categorySheet, 'Category Sales')

      // Worksheet 4: Time Series Data
      const timeSeriesDataSheet = [
        ['DAILY SALES TREND'],
        ['Date', 'Revenue (Rp)', 'Orders', 'Quantity Terjual'],
        ...timeSeriesData.map(day => [
          day.date,
          day.revenue,
          day.orders,
          day.quantity
        ])
      ]

      const timeSheet = XLSX.utils.aoa_to_sheet(timeSeriesDataSheet)
      XLSX.utils.book_append_sheet(workbook, timeSheet, 'Sales Trend')

      // Generate filename
      const fileName = `laporan-penjualan-${startDate}-hingga-${endDate}.xlsx`

      // Export to file
      XLSX.writeFile(workbook, fileName)

      showToast('success', 'File Excel berhasil diunduh!')
    } catch (error) {
      console.error('Error exporting to XLS:', error)
      showToast('error', 'Gagal mengunduh file Excel')
    }
  }

  const exportToPDF = () => {
    const printWindow = window.open('', '_blank')
    if (printWindow) {
      printWindow.document.write(`
        <html>
          <head>
            <title>Sales Report ${startDate} to ${endDate}</title>
            <style>
              body { font-family: Arial, sans-serif; margin: 20px; }
              .header { text-align: center; margin-bottom: 30px; border-bottom: 2px solid #333; padding-bottom: 10px; }
              .summary { margin-bottom: 30px; background: #f9f9f9; padding: 15px; border-radius: 5px; }
              .chart { margin: 20px 0; }
              table { width: 100%; border-collapse: collapse; margin: 20px 0; }
              th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
              th { background-color: #f5f5f5; font-weight: bold; }
              .section { margin-bottom: 30px; }
              .section-title { background: #d97706; color: white; padding: 10px; border-radius: 5px; }
              .stat-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px; margin: 15px 0; }
              .stat-item { background: white; padding: 10px; border-radius: 5px; border-left: 4px solid #d97706; }
            </style>
          </head>
          <body>
            <div class="header">
              <h1>EATOPIA - LAPORAN PENJUALAN</h1>
              <p><strong>Periode:</strong> ${startDate} hingga ${endDate}</p>
              <p><strong>Dibuat pada:</strong> ${new Date(getIndonesiaTime()).toLocaleString('id-ID')}</p>
            </div>
            
            <div class="summary">
              <h2>Ringkasan Detail</h2>
              <div class="stat-grid">
                <div class="stat-item">
                  <strong>Total Revenue:</strong><br>
                  Rp ${reportData?.revenue.toLocaleString('id-ID')}
                </div>
                <div class="stat-item">
                  <strong>Total Orders:</strong><br>
                  ${reportData?.orders} transaksi
                </div>
                <div class="stat-item">
                  <strong>Total Quantity Terjual:</strong><br>
                  ${reportData?.totalQuantitySold} items
                </div>
                <div class="stat-item">
                  <strong>Produk Unik Terjual:</strong><br>
                  ${reportData?.uniqueProductsSold} produk
                </div>
                <div class="stat-item">
                  <strong>Average Order Value:</strong><br>
                  Rp ${reportData?.averageOrderValue.toLocaleString('id-ID')}
                </div>
                <div class="stat-item">
                  <strong>Best Selling Product:</strong><br>
                  ${reportData?.bestSellingProduct} (${reportData?.bestSellingProductQuantity} pcs)
                </div>
              </div>
            </div>

            <div class="section">
              <div class="section-title">
                <h2>Top 10 Products by Revenue</h2>
              </div>
              <table>
                <thead>
                  <tr>
                    <th>Product</th>
                    <th>Category</th>
                    <th>Quantity Sold</th>
                    <th>Average Price</th>
                    <th>Revenue</th>
                  </tr>
                </thead>
                <tbody>
                  ${productSales.map(p => `
                    <tr>
                      <td>${p.product_name}</td>
                      <td>${p.category}</td>
                      <td>${p.quantity_sold} pcs</td>
                      <td>Rp ${p.average_price?.toLocaleString('id-ID') || '0'}</td>
                      <td>Rp ${p.total_revenue.toLocaleString('id-ID')}</td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>

            <div class="section">
              <div class="section-title">
                <h2>Category Performance</h2>
              </div>
              <table>
                <thead>
                  <tr>
                    <th>Category</th>
                    <th>Quantity</th>
                    <th>Revenue</th>
                    <th>Percentage</th>
                  </tr>
                </thead>
                <tbody>
                  ${categorySales.map(c => `
                    <tr>
                      <td>${c.category}</td>
                      <td>${c.quantity_sold} pcs</td>
                      <td>Rp ${c.total_revenue.toLocaleString('id-ID')}</td>
                      <td>${c.percentage.toFixed(1)}%</td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>

            <div class="section">
              <div class="section-title">
                <h2>Sales Trend</h2>
              </div>
              <table>
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Revenue</th>
                    <th>Orders</th>
                    <th>Quantity</th>
                  </tr>
                </thead>
                <tbody>
                  ${timeSeriesData.map(d => `
                    <tr>
                      <td>${d.date}</td>
                      <td>Rp ${d.revenue.toLocaleString('id-ID')}</td>
                      <td>${d.orders}</td>
                      <td>${d.quantity} pcs</td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>
          </body>
        </html>
      `)
      printWindow.document.close()
      printWindow.print()
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
            onClick={exportToXLS}
            className="bg-green-600 text-white px-3 sm:px-4 py-2 rounded-lg flex items-center justify-center space-x-2 hover:bg-green-700 transition-colors text-sm sm:text-base"
          >
            <Download className="h-4 w-4" />
            <span>Export Excel</span>
          </button>
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
                    <Package className="h-4 w-4 sm:h-5 sm:w-5 text-blue-600" />
                  </div>
                  <div className="ml-3 sm:ml-4">
                    <p className="text-xs sm:text-sm font-medium text-gray-600">Total Quantity</p>
                    <p className="text-lg sm:text-xl font-bold text-gray-900">
                      {reportData.totalQuantitySold} pcs
                    </p>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-lg shadow p-4 sm:p-6">
                <div className="flex items-center">
                  <div className="h-8 w-8 sm:h-10 sm:w-10 bg-purple-100 rounded-full flex items-center justify-center">
                    <Users className="h-4 w-4 sm:h-5 sm:w-5 text-purple-600" />
                  </div>
                  <div className="ml-3 sm:ml-4">
                    <p className="text-xs sm:text-sm font-medium text-gray-600">Total Orders</p>
                    <p className="text-lg sm:text-xl font-bold text-gray-900">{reportData.orders}</p>
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
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4 mb-6 sm:mb-8">
              <div className="bg-white rounded-lg shadow p-4">
                <div className="text-center">
                  <p className="text-sm font-medium text-gray-600">Avg Order Value</p>
                  <p className="text-lg font-bold text-gray-900">
                    Rp {reportData.averageOrderValue.toLocaleString('id-ID')}
                  </p>
                </div>
              </div>
              <div className="bg-white rounded-lg shadow p-4">
                <div className="text-center">
                  <p className="text-sm font-medium text-gray-600">Unique Products</p>
                  <p className="text-lg font-bold text-gray-900">
                    {reportData.uniqueProductsSold} produk
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
                  data={productSales}
                  layout="vertical"
                  margin={{ 
                    top: 10, 
                    right: 30, 
                    left: isMobile ? 120 : 180, 
                    bottom: 10 
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
                    {productSales.map((entry, index) => (
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
              {productSales.length > 0 && (
                <div className="mt-6 pt-4 border-t border-gray-200">
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 text-sm">
                    <div className="bg-linear-to-r from-amber-50 to-orange-50 p-3 rounded-lg border border-amber-200">
                      <p className="text-gray-600 font-medium text-xs">TOTAL REVENUE</p>
                      <p className="text-amber-700 font-bold text-lg">
                        Rp {productSales.reduce((sum, product) => sum + product.total_revenue, 0).toLocaleString('id-ID')}
                      </p>
                    </div>
                    
                    <div className="bg-linear-to-r from-green-50 to-emerald-50 p-3 rounded-lg border border-green-200">
                      <p className="text-gray-600 font-medium text-xs">TOTAL QUANTITY</p>
                      <p className="text-green-700 font-bold text-lg">
                        {productSales.reduce((sum, product) => sum + product.quantity_sold, 0).toLocaleString('id-ID')} pcs
                      </p>
                    </div>
                    
                    <div className="bg-linear-to-r from-blue-50 to-cyan-50 p-3 rounded-lg border border-blue-200">
                      <p className="text-gray-600 font-medium text-xs">AVG PRICE</p>
                      <p className="text-blue-700 font-bold text-lg">
                        Rp {Math.round(productSales.reduce((sum, product) => sum + (product.average_price || 0), 0) / productSales.length).toLocaleString('id-ID')}
                      </p>
                    </div>
                    
                    <div className="bg-linear-to-r from-purple-50 to-violet-50 p-3 rounded-lg border border-purple-200">
                      <p className="text-gray-600 font-medium text-xs">TOP PRODUCT</p>
                      <p className="text-purple-700 font-bold text-sm truncate" title={productSales[0]?.product_name}>
                        {productSales[0]?.product_name}
                      </p>
                      <p className="text-purple-600 text-xs">
                        {productSales[0]?.quantity_sold} pcs sold
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Detailed Tables */}
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 sm:gap-6 lg:gap-8">
            {/* Product Sales Table */}
            <div className="bg-white rounded-lg shadow">
              <div className="p-4 sm:p-6 border-b">
                <h3 className="text-base sm:text-lg font-semibold">Product Sales Details</h3>
              </div>
              <div className="p-2 sm:p-4 lg:p-6">
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[500px]">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left py-2 text-xs sm:text-sm">Product Name</th>
                        <th className="text-left py-2 text-xs sm:text-sm">Category</th>
                        <th className="text-left py-2 text-xs sm:text-sm">Quantity</th>
                        <th className="text-left py-2 text-xs sm:text-sm">Avg Price</th>
                        <th className="text-left py-2 text-xs sm:text-sm">Revenue</th>
                      </tr>
                    </thead>
                    <tbody>
                      {productSales.map((product: ProductSales, index: number) => (
                        <tr key={index} className="border-b hover:bg-gray-50">
                          <td className="py-2 sm:py-3 font-medium text-xs sm:text-sm truncate max-w-[120px] sm:max-w-none">
                            {product.product_name}
                          </td>
                          <td className="py-2 sm:py-3 text-xs sm:text-sm">{product.category}</td>
                          <td className="py-2 sm:py-3 text-xs sm:text-sm">{product.quantity_sold} pcs</td>
                          <td className="py-2 sm:py-3 text-xs sm:text-sm">Rp {product.average_price?.toLocaleString('id-ID') || '0'}</td>
                          <td className="py-2 sm:py-3 text-xs sm:text-sm">Rp {product.total_revenue.toLocaleString('id-ID')}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* Category Sales Table */}
            <div className="bg-white rounded-lg shadow">
              <div className="p-4 sm:p-6 border-b">
                <h3 className="text-base sm:text-lg font-semibold">Category Performance</h3>
              </div>
              <div className="p-2 sm:p-4 lg:p-6">
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[500px]">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left py-2 text-xs sm:text-sm">Category</th>
                        <th className="text-left py-2 text-xs sm:text-sm">Quantity</th>
                        <th className="text-left py-2 text-xs sm:text-sm">Revenue</th>
                        <th className="text-left py-2 text-xs sm:text-sm">Percentage</th>
                      </tr>
                    </thead>
                    <tbody>
                      {categorySales.map((category: CategorySales, index: number) => (
                        <tr key={index} className="border-b hover:bg-gray-50">
                          <td className="py-2 sm:py-3 text-xs sm:text-sm">{category.category}</td>
                          <td className="py-2 sm:py-3 text-xs sm:text-sm">{category.quantity_sold} pcs</td>
                          <td className="py-2 sm:py-3 text-xs sm:text-sm">Rp {category.total_revenue.toLocaleString('id-ID')}</td>
                          <td className="py-2 sm:py-3 text-xs sm:text-sm">{category.percentage.toFixed(1)}%</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
