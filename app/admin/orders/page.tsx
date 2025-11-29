"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/utils/supabaseClient";
import { X } from "lucide-react";

export default function OrdersPage() {
  const [orders, setOrders] = useState<any[]>([]);
  const [selectedOrder, setSelectedOrder] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [detailOpen, setDetailOpen] = useState(false);

  // Fetch orders
  useEffect(() => {
    fetchOrders();
  }, []);

  async function fetchOrders() {
    setLoading(true);
    const { data, error } = await supabase
      .from("orders")
      .select(`*, order_items(*, products(*))`)
      .order("created_at", { ascending: false });

    if (!error) setOrders(data || []);
    setLoading(false);
  }

  function openDetailModal(order: any) {
    setSelectedOrder(order);
    setDetailOpen(true);
  }

  function closeModals() {
    setDetailOpen(false);
    setSelectedOrder(null);
  }

  async function updateOrderStatus(id: number, status: string) {
    await supabase.from("orders").update({ status }).eq("id", id);
    fetchOrders();
  }

  return (
    <div className="p-4 md:p-8">
      <h1 className="text-2xl font-bold mb-4">Order List</h1>

      {/* ====================== TABLE RESPONSIVE ======================= */}
      <div className="overflow-x-auto bg-white rounded-lg shadow">
        <table className="w-full min-w-[600px]">
          <thead className="bg-gray-100">
            <tr className="text-left text-gray-600">
              <th className="px-4 py-3">Order ID</th>
              <th className="px-4 py-3 hidden md:table-cell">Customer</th>
              <th className="px-4 py-3">Total</th>
              <th className="px-4 py-3 hidden md:table-cell">Status</th>
              <th className="px-4 py-3 text-right">Action</th>
            </tr>
          </thead>

          <tbody>
            {loading ? (
              <tr>
                <td className="p-4 text-center" colSpan={5}>Loading...</td>
              </tr>
            ) : (
              orders.map((order) => (
                <tr
                  key={order.id}
                  className="border-b hover:bg-gray-50 transition"
                >
                  <td className="px-4 py-3 font-semibold">#{order.id}</td>

                  {/* Hide customer on mobile */}
                  <td className="px-4 py-3 hidden md:table-cell">
                    {order.customer_name || "Walk-in"}
                  </td>

                  <td className="px-4 py-3">
                    Rp {order.total_amount.toLocaleString("id-ID")}
                  </td>

                  {/* Hide status on mobile */}
                  <td className="px-4 py-3 hidden md:table-cell">
                    <span
                      className={`px-2 py-1 rounded text-sm ${
                        order.status === "completed"
                          ? "bg-green-200 text-green-700"
                          : order.status === "pending"
                          ? "bg-yellow-200 text-yellow-700"
                          : order.status === "cancelled"
                          ? "bg-red-200 text-red-700"
                          : "bg-blue-200 text-blue-700"
                      }`}
                    >
                      {order.status}
                    </span>
                  </td>

                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => openDetailModal(order)}
                      className="px-3 py-1 rounded bg-amber-600 text-white hover:bg-amber-700 text-sm"
                    >
                      Detail
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* ====================== DETAIL MODAL ======================= */}
      {detailOpen && selectedOrder && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-xl">
            
            {/* Header */}
            <div className="flex justify-between p-4 border-b">
              <h2 className="text-xl font-bold">Order Detail #{selectedOrder.id}</h2>
              <button onClick={closeModals}>
                <X className="h-6 w-6" />
              </button>
            </div>

            <div className="p-4 space-y-6">
              {/* Customer Info */}
              <div className="bg-gray-50 p-4 rounded-lg border">
                <h3 className="font-semibold mb-3">Informasi Pelanggan</h3>

                <div className="space-y-1 text-sm">
                  <p><strong>Nama:</strong> {selectedOrder.customer_name || "Walk-in"}</p>
                  <p><strong>Telepon:</strong> {selectedOrder.customer_phone || "-"}</p>
                  <p><strong>Catatan:</strong> {selectedOrder.notes || "-"}</p>
                </div>
              </div>

              {/* Items */}
              <div className="bg-gray-50 p-4 rounded-lg border">
                <h3 className="font-semibold mb-3">Items</h3>

                <div className="space-y-4">
                  {selectedOrder.order_items.map((item: any) => (
                    <div key={item.id} className="flex justify-between">
                      <div>
                        <p className="font-medium">{item.products?.name}</p>
                        <p className="text-sm text-gray-500">
                          {item.quantity} × Rp {item.price.toLocaleString("id-ID")}
                        </p>
                      </div>

                      <p className="font-semibold">
                        Rp {(item.quantity * item.price).toLocaleString("id-ID")}
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Total */}
              <div className="bg-amber-50 p-4 rounded-lg border border-amber-200 flex justify-between">
                <span className="font-semibold text-lg">Total</span>
                <span className="font-bold text-amber-700 text-lg">
                  Rp {selectedOrder.total_amount.toLocaleString("id-ID")}
                </span>
              </div>

              {/* Status */}
              <div className="bg-gray-50 p-4 rounded-lg border">
                <h3 className="font-semibold mb-2">Status Order</h3>

                <select
                  value={selectedOrder.status}
                  onChange={(e) => updateOrderStatus(selectedOrder.id, e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg"
                >
                  <option value="pending">Pending</option>
                  <option value="processing">Processing</option>
                  <option value="completed">Completed</option>
                  <option value="cancelled">Cancelled</option>
                </select>
              </div>
            </div>

            {/* Footer */}
            <div className="flex justify-end p-4 border-t">
              <button
                onClick={closeModals}
                className="px-4 py-2 bg-gray-200 rounded hover:bg-gray-300"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}