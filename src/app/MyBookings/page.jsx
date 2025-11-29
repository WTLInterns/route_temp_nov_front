

'use client';

import { useState, useEffect } from 'react';
import Sidebar from "../slidebar/page";
import axios from "axios";

export default function MyBookingsPage() {
  const [activeTab, setActiveTab] = useState('all');
  const [bookingsData, setBookingsData] = useState([]);
  const [loading, setLoading] = useState(true);

  // ✅ Fetch data from backend API
  useEffect(() => {
    const fetchBookings = async () => {
      try {
        const token = localStorage.getItem("token"); // 👈 ensure token is stored
        const res = await axios.get("http://localhost:5000/api/jobMarket/my-accepted-jobs", {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (res.data.success) {
          setBookingsData(res.data.data);
        }
      } catch (error) {
        console.error("❌ Error fetching bookings:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchBookings();
  }, []);

  // ✅ Filter bookings based on active tab
  const filteredBookings = activeTab === 'all' 
    ? bookingsData 
    : bookingsData.filter((booking) => {
        if (activeTab === 'completed') return booking.status === 'completed';
        if (activeTab === 'progress') return booking.status === 'in-progress';
        if (activeTab === 'scheduled') return booking.status === 'scheduled';
        if (activeTab === 'cancelled') return booking.status === 'cancelled';
        return true;
      });

  // ✅ Count bookings by status
  const completedCount = bookingsData.filter(b => b.status === 'completed').length;
  const progressCount = bookingsData.filter(b => b.status === 'in-progress').length;
  const scheduledCount = bookingsData.filter(b => b.status === 'scheduled').length;
  const cancelledCount = bookingsData.filter(b => b.status === 'cancelled').length;

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar />
      <div className="flex-1 p-6 md:ml-60 mt-20 sm:mt-0 transition-all duration-300">
        <header className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900 mx-2">My Bookings</h1>
          <p className="text-gray-600 m-2">An overview of all the jobs you have accepted.</p>
        </header>

        {/* Loading State */}
        {loading ? (
          <div className="text-center py-10 text-gray-600">Loading bookings...</div>
        ) : (
          <>
            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
              <div 
                className={`bg-white p-4 rounded-lg shadow cursor-pointer transition-all ${activeTab === 'all' ? 'border-2 border-yellow-500' : 'border border-gray-200'}`}
                onClick={() => setActiveTab('all')}
              >
                <h3 className="text-sm font-medium text-gray-500">Total Bookings</h3>
                <p className="text-2xl font-bold text-gray-900">{bookingsData.length}</p>
              </div>
              <div 
                className={`bg-white p-4 rounded-lg shadow cursor-pointer transition-all ${activeTab === 'completed' ? 'border-2 border-yellow-500' : 'border border-gray-200'}`}
                onClick={() => setActiveTab('completed')}
              >
                <h3 className="text-sm font-medium text-gray-500">Completed Jobs</h3>
                <p className="text-2xl font-bold text-gray-900">{completedCount}</p>
              </div>
              <div 
                className={`bg-white p-4 rounded-lg shadow cursor-pointer transition-all ${activeTab === 'progress' ? 'border-2 border-yellow-500' : 'border border-gray-200'}`}
                onClick={() => setActiveTab('progress')}
              >
                <h3 className="text-sm font-medium text-gray-500">In Progress</h3>
                <p className="text-2xl font-bold text-gray-900">{progressCount}</p>
              </div>
              <div 
                className={`bg-white p-4 rounded-lg shadow cursor-pointer transition-all ${activeTab === 'scheduled' ? 'border-2 border-yellow-500' : 'border border-gray-200'}`}
                onClick={() => setActiveTab('scheduled')}
              >
                <h3 className="text-sm font-medium text-gray-500">Scheduled</h3>
                <p className="text-2xl font-bold text-gray-900">{scheduledCount}</p>
              </div>
            </div>

            {/* Bookings Table */}
            <div className="bg-white rounded-lg shadow overflow-hidden">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Trip ID</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Customer</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Route</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Driver Contact</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Assigned Cab</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {filteredBookings.map((booking, index) => (
                      <tr key={booking.id} className="hover:bg-gray-50">
                        {/* <td className="px-6 py-4">{booking.id}</td> */}
                        <td className="px-6 py-4">{index+1}</td>
                        <td className="px-6 py-4">{booking.name}</td>
                        <td className="px-6 py-4">{`${booking.pickupLocation} → ${booking.dropoffLocation}`}</td>
                        <td className="px-6 py-4">{booking.phone}</td>
                        <td className="px-6 py-4">{booking.vehicleType}</td>
                        <td className="px-6 py-4">
                          <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                            booking.status === 'completed'
                              ? 'bg-green-100 text-green-800'
                              : booking.status === 'in-progress'
                              ? 'bg-blue-100 text-blue-800'
                              : booking.status === 'scheduled'
                              ? 'bg-yellow-100 text-yellow-800'
                              : 'bg-red-100 text-red-800'
                          }`}>
                            {booking.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {filteredBookings.length === 0 && (
                <div className="text-center py-8">
                  <p className="text-gray-500">No bookings found</p>
                </div>
              )}
            </div>
          </>
        )}

        {/* Status Legend */}
        <div className="mt-6 flex flex-wrap gap-4">
          <div className="flex items-center"><span className="w-3 h-3 bg-blue-500 rounded-full mr-2"></span><span className="text-sm text-gray-600">In Progress</span></div>
          <div className="flex items-center"><span className="w-3 h-3 bg-yellow-500 rounded-full mr-2"></span><span className="text-sm text-gray-600">Scheduled</span></div>
          <div className="flex items-center"><span className="w-3 h-3 bg-green-500 rounded-full mr-2"></span><span className="text-sm text-gray-600">Completed</span></div>
          <div className="flex items-center"><span className="w-3 h-3 bg-red-500 rounded-full mr-2"></span><span className="text-sm text-gray-600">Cancelled</span></div>
        </div>
      </div>
    </div>
  );
}