'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { ReportData, ProductSales, CategorySales, TimeSeriesData, PieDataItem } from '@/types'
import { Calendar, Download, Filter, BarChart3, PieChart, TrendingUp } from 'lucide-react'
import { 
  BarChart, Bar, 
  LineChart, Line, 
  PieChart as RechartsPie, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend 
} from 'recharts'
import * as XLSX from 'xlsx'

const COLORS = ['#d97706', '#b45309', '#92400e', '#78350f', '#65a30d', '#059669', '#0d9488', '#0369a1', '#7c3aed', '#dc2626'];

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

  useEffect(() => {
    // Set default date range to current month
    const now = new Date()
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1)
    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0)
    
    setStartDate(firstDay.toISOString().split('T')[0])
    setEndDate(lastDay.toISOString().split('T')[0])
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

    // Find best selling product and category
    const productSalesMap = new Map()
    const categorySalesMap = new Map()

    orders?.forEach((order: any) => {
      order.order_items?.forEach((item: any) => {
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
    let maxQuantity = 0
    productSalesMap.forEach((value, key) => {
      if (value.quantity > maxQuantity) {
        maxQuantity = value.quantity
        bestSellingProduct = key
      }
    })

    // Find best selling category
    let bestSellingCategory = '-'
    let maxCategoryRevenue = 0
    categorySalesMap.forEach((value, key) => {
      if (value.revenue > maxCategoryRevenue) {
        maxCategoryRevenue = value.revenue
        bestSellingCategory = key
      }
    })

    setReportData({
      period: `${startDate} to ${endDate}`,
      revenue: totalRevenue,
      orders: totalOrders,
      averageOrderValue,
      bestSellingProduct,
      bestSellingCategory
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
        total_revenue: 0
      }

      productMap.set(productName, {
        ...current,
        quantity_sold: current.quantity_sold + item.quantity,
        total_revenue: current.total_revenue + item.subtotal
      })
    })

    const sortedProducts = Array.from(productMap.values())
      .sort((a: any, b: any) => b.total_revenue - a.total_revenue)
      .slice(0, 10)

    setProductSales(sortedProducts)

    // Generate Pie Chart Data dari product sales (top 8 produk)
    const pieData: PieDataItem[] = sortedProducts.slice(0, 8).map((product: any) => ({
      name: product.product_name,
      value: product.total_revenue
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
      .select('*')
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
        key = date.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })
      } else if (groupBy === 'week') {
        const weekNumber = Math.ceil(date.getDate() / 7)
        key = `Week ${weekNumber}`
      } else {
        key = date.toLocaleDateString('id-ID', { month: 'short' })
      }

      const current = timeSeriesMap.get(key) || {
        date: key,
        revenue: 0,
        orders: 0
      }

      timeSeriesMap.set(key, {
        date: key,
        revenue: current.revenue + order.total_amount,
        orders: current.orders + 1
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
        ['Average Order Value', `Rp ${reportData?.averageOrderValue.toLocaleString('id-ID')}`],
        ['Best Selling Product', reportData?.bestSellingProduct],
        ['Best Selling Category', reportData?.bestSellingCategory],
        [],
        ['Generated on', new Date().toLocaleString('id-ID')]
      ]
      
      const summarySheet = XLSX.utils.aoa_to_sheet(summaryData)
      XLSX.utils.book_append_sheet(workbook, summarySheet, 'Summary')

      // Worksheet 2: Product Sales
      const productData = [
        ['PRODUCT SALES'],
        ['Product Name', 'Category', 'Quantity Sold', 'Revenue (Rp)'],
        ...productSales.map(product => [
          product.product_name,
          product.category,
          product.quantity_sold,
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
        ['Date', 'Revenue (Rp)', 'Orders'],
        ...timeSeriesData.map(day => [
          day.date,
          day.revenue,
          day.orders
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
            </style>
          </head>
          <body>
            <div class="header">
              <h1>EATOPIA - LAPORAN PENJUALAN</h1>
              <p><strong>Periode:</strong> ${startDate} hingga ${endDate}</p>
              <p><strong>Dibuat pada:</strong> ${new Date().toLocaleString('id-ID')}</p>
            </div>
            
            <div class="summary">
              <h2>Ringkasan</h2>
              <p><strong>Total Revenue:</strong> Rp ${reportData?.revenue.toLocaleString('id-ID')}</p>
              <p><strong>Total Orders:</strong> ${reportData?.orders}</p>
              <p><strong>Average Order Value:</strong> Rp ${reportData?.averageOrderValue.toLocaleString('id-ID')}</p>
              <p><strong>Best Selling Product:</strong> ${reportData?.bestSellingProduct}</p>
              <p><strong>Best Selling Category:</strong> ${reportData?.bestSellingCategory}</p>
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
                    <th>Revenue</th>
                  </tr>
                </thead>
                <tbody>
                  ${productSales.map(p => `
                    <tr>
                      <td>${p.product_name}</td>
                      <td>${p.category}</td>
                      <td>${p.quantity_sold}</td>
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
                      <td>${c.quantity_sold}</td>
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
                  </tr>
                </thead>
                <tbody>
                  ${timeSeriesData.map(d => `
                    <tr>
                      <td>${d.date}</td>
                      <td>Rp ${d.revenue.toLocaleString('id-ID')}</td>
                      <td>${d.orders}</td>
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

  const quickDateRanges = {
    'Today': () => {
      const today = new Date()
      return {
        start: today.toISOString().split('T')[0],
        end: today.toISOString().split('T')[0]
      }
    },
    'This Week': () => {
      const today = new Date()
      const firstDay = new Date(today.setDate(today.getDate() - today.getDay()))
      const lastDay = new Date(today.setDate(today.getDate() - today.getDay() + 6))
      return {
        start: firstDay.toISOString().split('T')[0],
        end: lastDay.toISOString().split('T')[0]
      }
    },
    'This Month': () => {
      const today = new Date()
      const firstDay = new Date(today.getFullYear(), today.getMonth(), 1)
      const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0)
      return {
        start: firstDay.toISOString().split('T')[0],
        end: lastDay.toISOString().split('T')[0]
      }
    },
    'Last Month': () => {
      const today = new Date()
      const firstDay = new Date(today.getFullYear(), today.getMonth() - 1, 1)
      const lastDay = new Date(today.getFullYear(), today.getMonth(), 0)
      return {
        start: firstDay.toISOString().split('T')[0],
        end: lastDay.toISOString().split('T')[0]
      }
    }
  }

  // Custom tooltip untuk Pie Chart dengan type safety
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
          <p className="text-gray-600 text-sm">
            {percentage.toFixed(1)}% of total
          </p>
        </div>
      );
    }
    return null;
  };

  // Fungsi untuk menghitung total pie chart data
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

  return (
    <div className="p-8">
      {/* Header */}
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold text-amber-900">Laporan Penjualan</h1>
          <p className="text-amber-600 mt-2">Analisis detail performa kedai kopi Anda</p>
        </div>
        <div className="flex space-x-3">
          <button
            onClick={exportToXLS}
            className="bg-green-600 text-white px-4 py-2 rounded-lg flex items-center space-x-2 hover:bg-green-700 transition-colors"
          >
            <Download className="h-4 w-4" />
            <span>Export Excel</span>
          </button>
          <button
            onClick={exportToPDF}
            className="bg-red-600 text-white px-4 py-2 rounded-lg flex items-center space-x-2 hover:bg-red-700 transition-colors"
          >
            <Download className="h-4 w-4" />
            <span>Export PDF</span>
          </button>
        </div>
      </div>

      {/* Date Range Selector */}
      <div className="bg-white rounded-lg shadow p-6 mb-8">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold flex items-center">
            <Filter className="h-5 w-5 mr-2" />
            Filter Laporan
          </h3>
          <div className="flex space-x-2">
            {Object.entries(quickDateRanges).map(([label, getDates]) => (
              <button
                key={label}
                onClick={() => {
                  const dates = getDates()
                  setStartDate(dates.start)
                  setEndDate(dates.end)
                }}
                className="px-3 py-1 text-sm bg-amber-100 text-amber-800 rounded-md hover:bg-amber-200 transition-colors"
              >
                {label}
              </button>
            ))}
          </div>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Tanggal Mulai</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-amber-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Tanggal Akhir</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-amber-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Rentang Waktu</label>
            <select
              value={timeRange}
              onChange={(e) => setTimeRange(e.target.value as any)}
              className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-amber-500"
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
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
              <div className="bg-white rounded-lg shadow p-6">
                <div className="flex items-center">
                  <div className="h-10 w-10 bg-green-100 rounded-full flex items-center justify-center">
                    <span className="text-green-600 font-bold">Rp</span>
                  </div>
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-600">Total Revenue</p>
                    <p className="text-xl font-bold text-gray-900">
                      Rp {reportData.revenue.toLocaleString('id-ID')}
                    </p>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-lg shadow p-6">
                <div className="flex items-center">
                  <div className="h-10 w-10 bg-blue-100 rounded-full flex items-center justify-center">
                    <BarChart3 className="h-5 w-5 text-blue-600" />
                  </div>
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-600">Total Orders</p>
                    <p className="text-xl font-bold text-gray-900">{reportData.orders}</p>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-lg shadow p-6">
                <div className="flex items-center">
                  <div className="h-10 w-10 bg-purple-100 rounded-full flex items-center justify-center">
                    <TrendingUp className="h-5 w-5 text-purple-600" />
                  </div>
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-600">Avg Order Value</p>
                    <p className="text-xl font-bold text-gray-900">
                      Rp {reportData.averageOrderValue.toLocaleString('id-ID')}
                    </p>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-lg shadow p-6">
                <div className="flex items-center">
                  <div className="h-10 w-10 bg-amber-100 rounded-full flex items-center justify-center">
                    <PieChart className="h-5 w-5 text-amber-600" />
                  </div>
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-600">Best Seller</p>
                    <p className="text-lg font-bold text-gray-900 truncate" title={reportData.bestSellingProduct}>
                      {reportData.bestSellingProduct}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Charts Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
            {/* Revenue Trend */}
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-lg font-semibold mb-4 flex items-center">
                <TrendingUp className="h-5 w-5 mr-2" />
                Revenue Trend
              </h3>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={timeSeriesData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <Tooltip 
                    formatter={(value: number) => [`Rp ${Number(value).toLocaleString('id-ID')}`, 'Revenue']}
                  />
                  <Legend />
                  <Line 
                    type="monotone" 
                    dataKey="revenue" 
                    stroke="#d97706" 
                    strokeWidth={3}
                    name="Revenue"
                    dot={{ fill: '#d97706', strokeWidth: 2, r: 4 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>

            {/* Orders Trend */}
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-lg font-semibold mb-4 flex items-center">
                <BarChart3 className="h-5 w-5 mr-2" />
                Orders Trend
              </h3>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={timeSeriesData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Bar 
                    dataKey="orders" 
                    fill="#b45309" 
                    name="Orders"
                    radius={[4, 4, 0, 0]} 
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Sales by Product Name - UPDATED PIE CHART */}
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-lg font-semibold mb-4 flex items-center">
                <PieChart className="h-5 w-5 mr-2" />
                Sales by Product Name
              </h3>
              
              {pieChartData.length > 0 ? (
                <>
                  <ResponsiveContainer width="100%" height={300}>
                    <RechartsPie>
                      <Pie
                        data={pieChartData}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        outerRadius={100}
                        fill="#8884d8"
                        dataKey="value"
                        label={({ percent }) => percent && percent > 0.05 ? `${(percent * 100).toFixed(0)}%` : ''}
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
                  <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
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
                            <span className="truncate" title={item.name}>
                              {item.name}
                            </span>
                          </div>
                          <div className="text-right shrink-0 ml-2">
                            <span className="text-gray-600 font-medium">
                              {percentage.toFixed(1)}%
                            </span>
                            <div className="text-xs text-gray-500">
                              Rp {item.value.toLocaleString('id-ID')}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </>
              ) : (
                <div className="flex items-center justify-center h-300">
                  <p className="text-gray-500">No sales data available for the selected period</p>
                </div>
              )}
            </div>

            {/* Top Products */}
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-lg font-semibold mb-4">Top 10 Products by Revenue</h3>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart
                  data={productSales}
                  layout="vertical"
                  margin={{ top: 5, right: 30, left: 100, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis 
                    type="number" 
                    tickFormatter={(value: number) => `Rp ${value.toLocaleString('id-ID')}`}
                  />
                  <YAxis 
                    type="category" 
                    dataKey="product_name" 
                    width={80}
                    tick={{ fontSize: 12 }}
                  />
                  <Tooltip 
                    formatter={(value: number) => [`Rp ${Number(value).toLocaleString('id-ID')}`, 'Revenue']}
                  />
                  <Legend />
                  <Bar 
                    dataKey="total_revenue" 
                    fill="#d97706" 
                    name="Revenue"
                    radius={[0, 4, 4, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Detailed Tables */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Product Sales Table */}
            <div className="bg-white rounded-lg shadow">
              <div className="p-6 border-b">
                <h3 className="text-lg font-semibold">Product Sales Details</h3>
              </div>
              <div className="p-6">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left py-2">Product Name</th>
                        <th className="text-left py-2">Category</th>
                        <th className="text-left py-2">Quantity</th>
                        <th className="text-left py-2">Revenue</th>
                      </tr>
                    </thead>
                    <tbody>
                      {productSales.map((product: ProductSales, index: number) => (
                        <tr key={index} className="border-b">
                          <td className="py-3 font-medium">{product.product_name}</td>
                          <td className="py-3">{product.category}</td>
                          <td className="py-3">{product.quantity_sold}</td>
                          <td className="py-3">Rp {product.total_revenue.toLocaleString('id-ID')}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* Category Sales Table */}
            <div className="bg-white rounded-lg shadow">
              <div className="p-6 border-b">
                <h3 className="text-lg font-semibold">Category Performance</h3>
              </div>
              <div className="p-6">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left py-2">Category</th>
                        <th className="text-left py-2">Quantity</th>
                        <th className="text-left py-2">Revenue</th>
                        <th className="text-left py-2">Percentage</th>
                      </tr>
                    </thead>
                    <tbody>
                      {categorySales.map((category: CategorySales, index: number) => (
                        <tr key={index} className="border-b">
                          <td className="py-3">{category.category}</td>
                          <td className="py-3">{category.quantity_sold}</td>
                          <td className="py-3">Rp {category.total_revenue.toLocaleString('id-ID')}</td>
                          <td className="py-3">{category.percentage.toFixed(1)}%</td>
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