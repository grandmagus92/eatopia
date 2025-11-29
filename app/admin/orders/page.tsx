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
   {showDetailModal && selectedOrder && (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 px-4">
    <div
      className="
        bg-white w-full max-w-md md:max-w-2xl 
        rounded-lg shadow-lg overflow-hidden 
        max-h-[90vh] flex flex-col
      "
    >
      {/* HEADER */}
      <div className="flex justify-between items-center p-4 border-b">
        <h3 className="text-lg font-semibold">Order Details</h3>
        <button onClick={closeModals} className="text-gray-600 hover:text-gray-900">
          ✕
        </button>
      </div>

      {/* BODY */}
      <div className="p-4 space-y-5 overflow-y-auto flex-1">
        
        {/* CUSTOMER INFO */}
        <div className="bg-gray-50 p-4 rounded-lg border">
          <h4 className="font-semibold mb-3">Informasi Pelanggan</h4>
          <p><span className="text-gray-600">Nama:</span> {selectedOrder.customer_name || "Walk-in"}</p>
          <p><span className="text-gray-600">Telepon:</span> {selectedOrder.customer_phone || "-"}</p>
          <p><span className="text-gray-600">Catatan:</span> {selectedOrder.notes || "-"}</p>
        </div>

        {/* ITEM LIST */}
        <div className="bg-gray-50 p-4 rounded-lg border">
          <h4 className="font-semibold mb-3">Items</h4>

          <div className="space-y-3">
            {selectedOrder.order_items?.map((item: any) => (
              <div key={item.id} className="flex justify-between items-start">
                <div>
                  <p className="font-medium text-sm md:text-base">{item.products?.name}</p>
                  <p className="text-gray-500 text-xs md:text-sm">
                    {item.quantity} × Rp {item.price.toLocaleString("id-ID")}
                  </p>
                </div>
                <p className="font-semibold text-amber-700 text-sm md:text-base">
                  Rp {(item.quantity * item.price).toLocaleString("id-ID")}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* TOTAL */}
        <div className="bg-amber-50 p-4 rounded-lg border border-amber-200">
          <div className="flex justify-between text-lg font-semibold">
            <span>Total:</span>
            <span className="text-amber-700">
              Rp {selectedOrder.total_amount.toLocaleString("id-ID")}
            </span>
          </div>
        </div>

        {/* STATUS */}
        <div className="bg-gray-50 p-4 rounded-lg border">
          <h4 className="font-semibold mb-3">Status</h4>
          <select
            className="w-full px-3 py-2 border rounded-lg"
            value={selectedOrder.status}
            onChange={(e) =>
              updateOrderStatus(selectedOrder.id, e.target.value as any)
            }
          >
            <option value="pending">Pending</option>
            <option value="processing">Processing</option>
            <option value="completed">Completed</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>
      </div>

      {/* FOOTER */}
      <div className="p-4 border-t flex justify-end bg-white">
        <button
          onClick={closeModals}
          className="px-5 py-2 bg-gray-200 rounded-lg hover:bg-gray-300"
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