// app/admin/products/page.tsx
'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Product } from '@/types'
import { Plus, Edit, Trash2, X, Search, Filter } from 'lucide-react'

export default function ProductsPage() {
    const [products, setProducts] = useState<Product[]>([])
    const [showForm, setShowForm] = useState(false)
    const [editingProduct, setEditingProduct] = useState<Product | null>(null)
    const [loading, setLoading] = useState(true)
    const [searchTerm, setSearchTerm] = useState('')
    const [categoryFilter, setCategoryFilter] = useState('all')
    const [availabilityFilter, setAvailabilityFilter] = useState('all')
    const [isMobile, setIsMobile] = useState(false)
    const [formData, setFormData] = useState({
        name: '',
        price: '',
        category: '',
        description: '',
        is_available: true
    })

    useEffect(() => {
        fetchProducts()
        checkMobile()
        
        const handleResize = () => {
            checkMobile()
        }
        
        window.addEventListener('resize', handleResize)
        return () => window.removeEventListener('resize', handleResize)
    }, [])

    const checkMobile = () => {
        setIsMobile(window.innerWidth < 768)
    }

    const fetchProducts = async () => {
        try {
            setLoading(true)
            const { data, error } = await supabase
                .from('products')
                .select('*')
                .order('created_at', { ascending: false })

            if (error) throw error
            setProducts(data || [])
        } catch (error) {
            console.error('Error fetching products:', error)
        } finally {
            setLoading(false)
        }
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()

        try {
            const productData = {
                ...formData,
                price: parseFloat(formData.price)
            }

            if (editingProduct) {
                const { error } = await supabase
                    .from('products')
                    .update(productData)
                    .eq('id', editingProduct.id)

                if (error) throw error
            } else {
                const { error } = await supabase
                    .from('products')
                    .insert([productData])

                if (error) throw error
            }

            setShowForm(false)
            setEditingProduct(null)
            setFormData({
                name: '',
                price: '',
                category: '',
                description: '',
                is_available: true
            })
            fetchProducts()
        } catch (error) {
            console.error('Error saving product:', error)
        }
    }

    const handleEdit = (product: Product) => {
        setEditingProduct(product)
        setFormData({
            name: product.name,
            price: product.price.toString(),
            category: product.category,
            description: product.description || '',
            is_available: product.is_available
        })
        setShowForm(true)
    }

    const handleDelete = async (id: string) => {
        if (confirm('Are you sure you want to delete this product?')) {
            try {
                const { error } = await supabase
                    .from('products')
                    .delete()
                    .eq('id', id)

                if (error) throw error
                fetchProducts()
            } catch (error) {
                console.error('Error deleting product:', error)
            }
        }
    }

    // Filter products
    const filteredProducts = products.filter(product => {
        const matchesSearch = 
            product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            product.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            product.category.toLowerCase().includes(searchTerm.toLowerCase())
        
        const matchesCategory = categoryFilter === 'all' || product.category === categoryFilter
        const matchesAvailability = 
            availabilityFilter === 'all' || 
            (availabilityFilter === 'available' && product.is_available) ||
            (availabilityFilter === 'unavailable' && !product.is_available)
        
        return matchesSearch && matchesCategory && matchesAvailability
    })

    const categories = [
        'Hot Coffee',
        'Cold Coffee', 
        'Specialty',
        'Basic Coffee',
        'Mocktail',
        'Non-Coffee',
        'Snacks'
    ]

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-96 p-4">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-amber-600 mx-auto"></div>
                    <p className="mt-4 text-amber-700">Memuat data produk...</p>
                </div>
            </div>
        )
    }

    return (
        <div className="space-y-4 lg:space-y-6 p-4 lg:p-8">
            {/* Page Header */}
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                <div className="flex-1 min-w-0">
                    <h1 className="text-xl lg:text-3xl font-bold text-amber-900 truncate">Manajemen Produk</h1>
                    <p className="text-amber-600 mt-1 text-sm lg:text-base">Kelola semua produk kafe</p>
                </div>
                <button
                    onClick={() => setShowForm(true)}
                    className="w-full lg:w-auto bg-amber-600 text-white px-4 lg:px-6 py-3 rounded-lg hover:bg-amber-700 transition-colors flex items-center justify-center space-x-2 shadow-lg hover:shadow-xl"
                >
                    <Plus className="h-4 lg:h-5 w-4 lg:w-5" />
                    <span className="text-sm lg:text-base">Tambah Produk</span>
                </button>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4">
                <div className="bg-white rounded-xl p-3 lg:p-4 shadow-sm border border-amber-100">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-xs lg:text-sm text-gray-600">Total Produk</p>
                            <p className="text-lg lg:text-2xl font-bold text-gray-900">{products.length}</p>
                        </div>
                        <div className="h-6 lg:h-8 w-6 lg:w-8 bg-amber-100 rounded-full flex items-center justify-center">
                            <span className="text-amber-600 text-xs lg:text-sm font-bold">P</span>
                        </div>
                    </div>
                </div>
                
                <div className="bg-white rounded-xl p-3 lg:p-4 shadow-sm border border-amber-100">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-xs lg:text-sm text-gray-600">Tersedia</p>
                            <p className="text-lg lg:text-2xl font-bold text-green-600">
                                {products.filter(p => p.is_available).length}
                            </p>
                        </div>
                        <div className="h-6 lg:h-8 w-6 lg:w-8 bg-green-100 rounded-full flex items-center justify-center">
                            <span className="text-green-600 text-xs lg:text-sm font-bold">✓</span>
                        </div>
                    </div>
                </div>
                
                <div className="bg-white rounded-xl p-3 lg:p-4 shadow-sm border border-amber-100">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-xs lg:text-sm text-gray-600">Kategori</p>
                            <p className="text-lg lg:text-2xl font-bold text-blue-600">
                                {new Set(products.map(p => p.category)).size}
                            </p>
                        </div>
                        <div className="h-6 lg:h-8 w-6 lg:w-8 bg-blue-100 rounded-full flex items-center justify-center">
                            <span className="text-blue-600 text-xs lg:text-sm font-bold">C</span>
                        </div>
                    </div>
                </div>
                
                <div className="bg-white rounded-xl p-3 lg:p-4 shadow-sm border border-amber-100">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-xs lg:text-sm text-gray-600">Rata-rata Harga</p>
                            <p className="text-lg lg:text-2xl font-bold text-purple-600">
                                Rp {products.length > 0 ? 
                                    (products.reduce((sum, p) => sum + p.price, 0) / products.length).toLocaleString('id-ID', {maximumFractionDigits: 0}) 
                                    : '0'}
                            </p>
                        </div>
                        <div className="h-6 lg:h-8 w-6 lg:w-8 bg-purple-100 rounded-full flex items-center justify-center">
                            <span className="text-purple-600 text-xs lg:text-sm font-bold">$</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Filters */}
            <div className="bg-white rounded-xl p-4 shadow-sm border border-amber-100">
                <div className="flex flex-col lg:flex-row gap-3 lg:gap-4">
                    <div className="flex-1">
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                            <input
                                type="text"
                                placeholder="Cari nama produk, deskripsi, atau kategori..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent text-sm lg:text-base"
                            />
                        </div>
                    </div>
                    <div className="flex gap-2">
                        <select
                            value={categoryFilter}
                            onChange={(e) => setCategoryFilter(e.target.value)}
                            className="flex-1 lg:flex-none px-3 lg:px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent text-sm lg:text-base"
                        >
                            <option value="all">Semua Kategori</option>
                            {categories.map(category => (
                                <option key={category} value={category}>{category}</option>
                            ))}
                        </select>
                        <select
                            value={availabilityFilter}
                            onChange={(e) => setAvailabilityFilter(e.target.value)}
                            className="flex-1 lg:flex-none px-3 lg:px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent text-sm lg:text-base"
                        >
                            <option value="all">Semua Status</option>
                            <option value="available">Tersedia</option>
                            <option value="unavailable">Tidak Tersedia</option>
                        </select>
                    </div>
                </div>
            </div>

            {/* Products Table/Cards */}
            <div className="bg-white rounded-xl shadow-sm border border-amber-100 overflow-hidden">
                {isMobile ? (
                    /* Mobile View - Cards */
                    <div className="divide-y divide-amber-50">
                        {filteredProducts.map((product) => (
                            <div key={product.id} className="p-4 hover:bg-amber-50 transition-colors">
                                <div className="flex justify-between items-start mb-3">
                                    <div className="flex-1 min-w-0">
                                        <h3 className="font-semibold text-gray-900 truncate">{product.name}</h3>
                                        <p className="text-sm text-gray-600 mt-1">{product.category}</p>
                                        {product.description && (
                                            <p className="text-xs text-gray-500 mt-1 line-clamp-2">{product.description}</p>
                                        )}
                                    </div>
                                    <div className="flex space-x-2 ml-2">
                                        <button
                                            onClick={() => handleEdit(product)}
                                            className="text-blue-600 hover:text-blue-800 p-1 transition-colors"
                                        >
                                            <Edit className="h-4 w-4" />
                                        </button>
                                        <button
                                            onClick={() => handleDelete(product.id)}
                                            className="text-red-600 hover:text-red-800 p-1 transition-colors"
                                        >
                                            <Trash2 className="h-4 w-4" />
                                        </button>
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-3 text-sm">
                                    <div>
                                        <p className="text-gray-600">Harga</p>
                                        <p className="font-semibold text-gray-900">
                                            Rp {product.price.toLocaleString('id-ID')}
                                        </p>
                                    </div>
                                    <div>
                                        <p className="text-gray-600">Status</p>
                                        <span className={`px-2 py-1 rounded-full text-xs ${product.is_available
                                                ? 'bg-green-100 text-green-800'
                                                : 'bg-red-100 text-red-800'
                                            }`}>
                                            {product.is_available ? 'Tersedia' : 'Tidak Tersedia'}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    /* Desktop View - Table */
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead>
                                <tr className="border-b border-amber-100 bg-amber-50">
                                    <th className="text-left py-4 px-4 text-sm font-semibold text-amber-900">Nama Produk</th>
                                    <th className="text-left py-4 px-4 text-sm font-semibold text-amber-900">Kategori</th>
                                    <th className="text-left py-4 px-4 text-sm font-semibold text-amber-900">Harga</th>
                                    <th className="text-left py-4 px-4 text-sm font-semibold text-amber-900">Status</th>
                                    <th className="text-left py-4 px-4 text-sm font-semibold text-amber-900">Aksi</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredProducts.map((product) => (
                                    <tr key={product.id} className="border-b border-amber-50 hover:bg-amber-50 transition-colors">
                                        <td className="py-4 px-4">
                                            <div>
                                                <p className="font-medium text-gray-900">{product.name}</p>
                                                {product.description && (
                                                    <p className="text-sm text-gray-600 mt-1 line-clamp-2">{product.description}</p>
                                                )}
                                            </div>
                                        </td>
                                        <td className="py-4 px-4">
                                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800">
                                                {product.category}
                                            </span>
                                        </td>
                                        <td className="py-4 px-4">
                                            <div className="font-semibold text-gray-900">
                                                Rp {product.price.toLocaleString('id-ID')}
                                            </div>
                                        </td>
                                        <td className="py-4 px-4">
                                            <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${product.is_available
                                                    ? 'bg-green-100 text-green-800'
                                                    : 'bg-red-100 text-red-800'
                                                }`}>
                                                {product.is_available ? 'Tersedia' : 'Tidak Tersedia'}
                                            </span>
                                        </td>
                                        <td className="py-4 px-4">
                                            <div className="flex items-center space-x-2">
                                                <button
                                                    onClick={() => handleEdit(product)}
                                                    className="text-blue-600 hover:text-blue-800 p-1 transition-colors"
                                                    title="Edit Produk"
                                                >
                                                    <Edit className="h-4 w-4" />
                                                </button>
                                                <button
                                                    onClick={() => handleDelete(product.id)}
                                                    className="text-red-600 hover:text-red-800 p-1 transition-colors"
                                                    title="Hapus Produk"
                                                >
                                                    <Trash2 className="h-4 w-4" />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
                
                {filteredProducts.length === 0 && (
                    <div className="text-center py-12">
                        <div className="h-12 lg:h-16 w-12 lg:w-16 text-gray-300 mx-auto mb-4 flex items-center justify-center">
                            <span className="text-2xl">☕</span>
                        </div>
                        <p className="text-gray-500 text-sm lg:text-base">Tidak ada produk yang ditemukan</p>
                        <button
                            onClick={() => setShowForm(true)}
                            className="mt-4 text-amber-600 hover:text-amber-700 font-medium transition-colors text-sm lg:text-base"
                        >
                            Tambah produk pertama
                        </button>
                    </div>
                )}
            </div>

            {/* Product Form Modal */}
            {showForm && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-2 lg:p-4 z-50">
                    <div className="bg-white rounded-xl lg:rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
                        <div className="p-4 lg:p-6 border-b border-gray-200 flex items-center justify-between">
                            <h3 className="text-lg lg:text-xl font-semibold text-gray-900">
                                {editingProduct ? 'Edit Produk' : 'Tambah Produk'}
                            </h3>
                            <button
                                onClick={() => {
                                    setShowForm(false)
                                    setEditingProduct(null)
                                    setFormData({
                                        name: '',
                                        price: '',
                                        category: '',
                                        description: '',
                                        is_available: true
                                    })
                                }}
                                className="text-gray-400 hover:text-gray-600 transition-colors"
                            >
                                <X className="h-5 lg:h-6 w-5 lg:w-6" />
                            </button>
                        </div>

                        <form onSubmit={handleSubmit} className="p-4 lg:p-6 space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">Nama Produk</label>
                                <input
                                    type="text"
                                    value={formData.name}
                                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 text-sm lg:text-base"
                                    required
                                    placeholder="Masukkan nama produk"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">Harga</label>
                                <input
                                    type="number"
                                    value={formData.price}
                                    onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 text-sm lg:text-base"
                                    required
                                    placeholder="Masukkan harga"
                                    min="0"
                                    step="100"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">Kategori</label>
                                <select
                                    value={formData.category}
                                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 text-sm lg:text-base"
                                    required
                                >
                                    <option value="">Pilih Kategori</option>
                                    {categories.map(category => (
                                        <option key={category} value={category}>{category}</option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">Deskripsi</label>
                                <textarea
                                    value={formData.description}
                                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 text-sm lg:text-base"
                                    rows={3}
                                    placeholder="Masukkan deskripsi produk (opsional)"
                                />
                            </div>

                            <div className="flex items-center">
                                <input
                                    type="checkbox"
                                    checked={formData.is_available}
                                    onChange={(e) => setFormData({ ...formData, is_available: e.target.checked })}
                                    className="rounded border-gray-300 text-amber-600 focus:ring-amber-500 h-4 w-4"
                                />
                                <label className="ml-2 text-sm text-gray-700">Produk tersedia</label>
                            </div>

                            <div className="flex flex-col lg:flex-row gap-2 lg:gap-3 pt-4">
                                <button
                                    type="submit"
                                    className="flex-1 bg-amber-600 text-white py-2 lg:py-3 rounded-lg hover:bg-amber-700 transition-colors text-sm lg:text-base"
                                >
                                    {editingProduct ? 'Update Produk' : 'Tambah Produk'}
                                </button>
                                <button
                                    type="button"
                                    onClick={() => {
                                        setShowForm(false)
                                        setEditingProduct(null)
                                        setFormData({
                                            name: '',
                                            price: '',
                                            category: '',
                                            description: '',
                                            is_available: true
                                        })
                                    }}
                                    className="flex-1 bg-gray-300 text-gray-700 py-2 lg:py-3 rounded-lg hover:bg-gray-400 transition-colors text-sm lg:text-base"
                                >
                                    Batal
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    )
}
