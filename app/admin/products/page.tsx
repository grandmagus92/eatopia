// app/admin/products/page.tsx
'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Product } from '@/types'
import { Plus, Edit, Trash2 } from 'lucide-react'

export default function ProductsPage() {
    const [products, setProducts] = useState<Product[]>([])
    const [showForm, setShowForm] = useState(false)
    const [editingProduct, setEditingProduct] = useState<Product | null>(null)
    const [formData, setFormData] = useState({
        name: '',
        price: '',
        category: '',
        description: '',
        is_available: true
    })

    useEffect(() => {
        fetchProducts()
    }, [])

    const fetchProducts = async () => {
        try {
            const { data, error } = await supabase
                .from('products')
                .select('*')
                .order('created_at', { ascending: false })

            if (error) throw error
            setProducts(data || [])
        } catch (error) {
            console.error('Error fetching products:', error)
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

    return (
        <div className="p-8">
            <div className="flex justify-between items-center mb-8">
                <h1 className="text-3xl font-bold text-amber-900">Products</h1>
                <button
                    onClick={() => setShowForm(true)}
                    className="bg-amber-600 text-white px-4 py-2 rounded-lg flex items-center space-x-2 hover:bg-amber-700"
                >
                    <Plus className="h-4 w-4" />
                    <span>Add Product</span>
                </button>
            </div>

            {showForm && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-lg p-6 w-full max-w-md">
                        <h2 className="text-xl font-bold mb-4">
                            {editingProduct ? 'Edit Product' : 'Add Product'}
                        </h2>
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700">Name</label>
                                <input
                                    type="text"
                                    value={formData.name}
                                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                    className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-amber-500"
                                    required
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700">Price</label>
                                <input
                                    type="number"
                                    value={formData.price}
                                    onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                                    className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-amber-500"
                                    required
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700">Category</label>
                                <select
                                    value={formData.category}
                                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                                    className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-amber-500"
                                    required
                                >
                                    <option value="">Select Category</option>
                                    <option value="Hot Coffee">Hot Coffee</option>
                                    <option value="Cold Coffee">Cold Coffee</option>
                                    <option value="Specialty">Specialty</option>
                                    <option value="Basic">Basic Coffe</option>
                                    <option value="Mocktail">Mocktail</option>
                                    <option value="Non-Coffe">Non-Coffe</option>
                                    <option value="Snacks">Snacks</option>
                                </select>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700">Description</label>
                                <textarea
                                    value={formData.description}
                                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                    className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-amber-500"
                                    rows={3}
                                />
                            </div>

                            <div className="flex items-center">
                                <input
                                    type="checkbox"
                                    checked={formData.is_available}
                                    onChange={(e) => setFormData({ ...formData, is_available: e.target.checked })}
                                    className="rounded border-gray-300 text-amber-600 focus:ring-amber-500"
                                />
                                <label className="ml-2 text-sm text-gray-700">Available</label>
                            </div>

                            <div className="flex space-x-3 pt-4">
                                <button
                                    type="submit"
                                    className="flex-1 bg-amber-600 text-white py-2 rounded-md hover:bg-amber-700"
                                >
                                    {editingProduct ? 'Update' : 'Create'}
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
                                    className="flex-1 bg-gray-300 text-gray-700 py-2 rounded-md hover:bg-gray-400"
                                >
                                    Cancel
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            <div className="bg-white rounded-lg shadow">
                <div className="p-6 border-b">
                    <h3 className="text-lg font-semibold">Product List</h3>
                </div>
                <div className="p-6">
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead>
                                <tr className="border-b">
                                    <th className="text-left py-2">Name</th>
                                    <th className="text-left py-2">Category</th>
                                    <th className="text-left py-2">Price</th>
                                    <th className="text-left py-2">Status</th>
                                    <th className="text-left py-2">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {products.map((product) => (
                                    <tr key={product.id} className="border-b">
                                        <td className="py-3">
                                            <div>
                                                <p className="font-medium">{product.name}</p>
                                                <p className="text-sm text-gray-600">{product.description}</p>
                                            </div>
                                        </td>
                                        <td className="py-3">{product.category}</td>
                                        <td className="py-3">Rp {product.price.toLocaleString('id-ID')}</td>
                                        <td className="py-3">
                                            <span className={`px-2 py-1 rounded-full text-xs ${product.is_available
                                                    ? 'bg-green-100 text-green-800'
                                                    : 'bg-red-100 text-red-800'
                                                }`}>
                                                {product.is_available ? 'Available' : 'Unavailable'}
                                            </span>
                                        </td>
                                        <td className="py-3">
                                            <div className="flex space-x-2">
                                                <button
                                                    onClick={() => handleEdit(product)}
                                                    className="text-blue-600 hover:text-blue-800"
                                                >
                                                    <Edit className="h-4 w-4" />
                                                </button>
                                                <button
                                                    onClick={() => handleDelete(product.id)}
                                                    className="text-red-600 hover:text-red-800"
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
                </div>
            </div>
        </div>
    )
}