'use client';

import { useState, useEffect } from 'react';
import { FiSearch, FiDownload, FiChevronLeft, FiChevronRight } from "react-icons/fi";
import { useRouter } from 'next/navigation';
import Sidebar from "../slidebar/page";
import * as XLSX from "xlsx";
import { saveAs } from "file-saver";


export default function TripLogPage() {
  const [trips, setTrips] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(5);
  const [searchTerm, setSearchTerm] = useState('');
  const [userInfo, setUserInfo] = useState(null);
  const router = useRouter();

  // ✅ Get auth token from localStorage with multiple fallbacks
  const getAuthToken = () => {
    if (typeof window !== 'undefined') {
      const token = localStorage.getItem('authToken') ||
        localStorage.getItem('token') ||
        sessionStorage.getItem('authToken') ||
        sessionStorage.getItem('token') ||
        localStorage.getItem('adminToken');

      if (token) {
        return token.replace(/^"(.*)"$/, '$1').trim();
      }
    }
    return null;
  };

  // ✅ Check authentication and redirect if not logged in
  const checkAuth = () => {
    const token = getAuthToken();
    if (!token) {
      alert("Please login first");
      router.push('/login');
      return false;
    }
    return true;
  };

  // ✅ Decode user info from JWT token
  const getUserInfoFromToken = () => {
    const token = getAuthToken();
    if (!token) return null;

    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      return {
        id: payload.id,
        role: payload.role,
        name: payload.name || 'Admin'
      };
    } catch (error) {
      console.error('Error decoding token:', error);
      return null;
    }
  };

  // ✅ Logout
  const handleLogout = () => {
    localStorage.removeItem('authToken');
    localStorage.removeItem('token');
    localStorage.removeItem('adminToken');
    sessionStorage.removeItem('authToken');
    sessionStorage.removeItem('token');
    router.push('/login');
  };

  // ✅ Fetch trips from backend API
  const fetchTrips = async () => {
    if (!checkAuth()) return;

    setIsLoading(true);
    try {
      const token = getAuthToken();
      const res = await fetch("http://localhost:5000/api/jobMarket/my-accepted-jobs1", {
        headers: { "Authorization": `Bearer ${token}` }
      });

      const data = await res.json();

      if (data.success) {
        const formattedTrips = data.data.map((job) => ({
          id: job.id,   // adjust if you have jobId
          customer: job.name,
          route: `${job.pickupLocation} → ${job.dropoffLocation}`,
          assignedDriver: job.vehicleType || "Not Assigned",
          driverContact: job.phone || "N/A",
          assignedCab: job.acceptedAdmin?.name || "N/A",
          status: job.status,
          statusColor:
            job.status === "accepted"
              ? "bg-yellow-100 text-yellow-800"
              : job.status === "completed"
                ? "bg-green-100 text-green-800"
                : "bg-blue-100 text-blue-800"
        }));

        setTrips(formattedTrips);
      } else {
        console.error("❌ API Error:", data.message);
        setTrips([]);
      }
    } catch (error) {
      console.error("Error fetching trips:", error);
      setTrips([]);
    } finally {
      setIsLoading(false);
    }
  };

  // ✅ Initial load
  useEffect(() => {
    if (!checkAuth()) return;
    const user = getUserInfoFromToken();
    setUserInfo(user);
    fetchTrips();
  }, []);

  // ✅ Search filter
  const filteredTrips = trips.filter(trip =>
    trip.id?.toString().toLowerCase().includes(searchTerm.toLowerCase()) ||
    trip.customer?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    trip.assignedDriver?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    trip.assignedCab?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // ✅ Pagination
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentTrips = filteredTrips.slice(indexOfFirstItem, indexOfLastItem);
  const totalPages = Math.ceil(filteredTrips.length / itemsPerPage);

  const paginate = (pageNumber) => setCurrentPage(pageNumber);

  // ✅ Loader before user is known
  if (!userInfo) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-yellow-500"></div>
      </div>
    );
  }


  // ✅ Export trips to Excel
  const exportToExcel = () => {
    if (filteredTrips.length === 0) {
      alert("No data to export!");
      return;
    }

    // Step 1: Format the data (flat structure for Excel)
    const formattedData = filteredTrips.map((trip, index) => ({
      "S.No": index + 1,
      "Trip ID": trip.id,
      "Customer Name": trip.customer,
      "Route": trip.route,
      "Job Posted By": trip.assignedCab,
      "Driver Contact": trip.driverContact,
      "Assigned Cab": trip.assignedDriver,
      "Status": trip.status
    }));

    // Step 2: Convert JSON → Sheet
    const worksheet = XLSX.utils.json_to_sheet(formattedData);

    // Step 3: Create Workbook & Append Sheet
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Trip Log");

    // Step 4: Write to Excel Buffer
    const excelBuffer = XLSX.write(workbook, { bookType: "xlsx", type: "array" });

    // Step 5: Save as File
    const data = new Blob([excelBuffer], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });

    saveAs(data, "TripLog.xlsx");
  };


  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar />
      <div className="flex-1 p-6 md:ml-60 mt-20 sm:mt-0 transition-all duration-300">
        <header className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-2xl font-bold text-grey-900 mx-2">Trip Log's</h1>
            {/* <p className="text-sm text-gray-600">
              Welcome, {userInfo.name} ({userInfo.role})
            </p> */}
          </div>
          {/* <button
            onClick={handleLogout}
            className="flex items-center bg-red-500 text-white px-4 py-2 rounded-md hover:bg-red-600"
          >
            Logout
          </button> */}
        </header>

        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-6">
            <p className="text-gray-900 font-semibold text-2xl mb-4 md:mb-0">View you'r accepted job's</p>

            <div className="flex flex-col sm:flex-row gap-4">
              <div className="relative">
                <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                  <FiSearch className="text-gray-500" />
                </div>
                <input
                  type="text"
                  placeholder="Search trips..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500"
                />
              </div>

              <div className="flex gap-2">
                {/* <button className="flex items-center bg-gray-200 text-gray-800 px-4 py-2 rounded-md hover:bg-gray-300">
                  <FiPrinter className="mr-2" />
                  Print
                </button> */}
                {/* <button className="flex items-center bg-gray-200 text-gray-800 px-4 py-2 rounded-md hover:bg-gray-300">
                  <FiDownload className="mr-2" />
                  Export
                </button> */}
                <button
                  onClick={exportToExcel}
                  className="flex items-center bg-green-600 hover:bg-green-700 text-white px-6 py-2 rounded-lg font-medium transition-colors duration-200 disabled:opacity-50"
                >
                  <FiDownload className="mr-2" />
                  Export
                </button>

              </div>
            </div>
          </div>

          {isLoading ? (
            <div className="flex justify-center items-center h-64">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-yellow-500"></div>
            </div>
          ) : filteredTrips.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-gray-500 text-lg">No trips found.</p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Trip ID</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Customer Name</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Route</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Job Posted By</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Driver Contact</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Assigned Cab</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {currentTrips.map((trip, index) => (
                      <tr key={index} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-medium text-gray-900">{index+1}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-900">{trip.customer}</div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="text-sm text-gray-900">{trip.route}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-900">{trip.assignedCab}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-900">{trip.driverContact}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-900">{trip.assignedDriver}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${trip.statusColor}`}>
                            {trip.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* ✅ Pagination */}
              <div className="flex items-center justify-between mt-4">
                <div className="text-sm text-gray-700">
                  Showing <span className="font-medium">{indexOfFirstItem + 1}</span> to{' '}
                  <span className="font-medium">
                    {indexOfLastItem > filteredTrips.length ? filteredTrips.length : indexOfLastItem}
                  </span> of{' '}
                  <span className="font-medium">{filteredTrips.length}</span> results
                </div>

                <div className="flex space-x-2">
                  <button
                    onClick={() => paginate(currentPage - 1)}
                    disabled={currentPage === 1}
                    className="relative inline-flex items-center px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <FiChevronLeft className="w-4 h-4" />
                    Previous
                  </button>
                  <button
                    onClick={() => paginate(currentPage + 1)}
                    disabled={currentPage === totalPages}
                    className="relative inline-flex items-center px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Next
                    <FiChevronRight className="w-4 h-4 ml-1" />
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}