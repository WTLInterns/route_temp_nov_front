"use client"

import { useState, useEffect } from "react"
import Sidebar from "../slidebar/page"
import { saveAs } from "file-saver"
import baseURL from "@/utils/api"
import { useRouter } from "next/navigation"
import axios from "axios"

const AccessDeniedModal = () => {
  const router = useRouter()

  const handleClose = () => {
    router.push("/")
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-70">
      <div className="bg-white text-gray-800 p-8 rounded-lg shadow-lg max-w-sm w-full">
        <h2 className="text-xl font-semibold mb-4 text-gray-800">Access Denied</h2>
        <p className="mb-6 text-gray-600">Your access has been restricted. Please contact the administrator.</p>
        <button onClick={handleClose} className="bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700 transition">
          Close
        </button>
      </div>
    </div>
  )
}

const CabExpenses = () => {
  const router = useRouter()

  const normalizeLocation = (value) => {
    if (typeof value !== "string") {
      return value ?? null
    }
    const trimmed = value.trim()
    return trimmed.length ? trimmed : null
  }

  const mapExpenses = (items = []) =>
    items.map((item) => ({
      ...item,
      pickupLocation: normalizeLocation(
        item.pickupLocation ?? item.locationFrom ?? item.pickupHistory ?? null
      ),
      dropLocation: normalizeLocation(
        item.dropLocation ?? item.locationTo ?? item.dropHistory ?? null
      ),
    }))

  const [showAccessDenied, setShowAccessDenied] = useState(false)
  const [allExpenses, setAllExpenses] = useState(() => {
    // Prime from local cache for instant render
    try {
      const cached = localStorage.getItem("cache:expenses")
      return cached ? mapExpenses(JSON.parse(cached)) : []
    } catch {
      return []
    }
  })
  const [filteredExpenses, setFilteredExpenses] = useState(() => {
    try {
      const cached = localStorage.getItem("cache:expenses")
      return cached ? mapExpenses(JSON.parse(cached)) : []
    } catch {
      return []
    }
  })
  const [searchQuery, setSearchQuery] = useState("")
  const [fromDate, setFromDate] = useState("")
  const [toDate, setToDate] = useState("")
  const [loading, setLoading] = useState(false)
  const [isInitialLoad, setIsInitialLoad] = useState(() => {
    try { return !localStorage.getItem("cache:expenses") } catch { return true }
  })
  const [cabNumbers, setCabNumbers] = useState({}) // To store cabId to cabNumber mapping
  // Admin-only export controls
  const [adminCabs, setAdminCabs] = useState([])
  const [exportCabId, setExportCabId] = useState("")
  const [exportFrom, setExportFrom] = useState("")
  const [exportTo, setExportTo] = useState("")
  const [exporting, setExporting] = useState(false)

  useEffect(() => {
    const checkUserStatus = async () => {
      try {
        const id = localStorage.getItem("id")
        if (!id) {
          router.push("/")
          return
        }

        const subAdminsRes = await axios.get(`${baseURL}api/admin/getAllSubAdmins`)
        const loggedInUser = subAdminsRes.data.subAdmins.find((e) => e._id === id)

        if (loggedInUser?.status === "Inactive") {
          localStorage.clear()
          setShowAccessDenied(true)
          return
        }
      } catch (err) {
        console.error("Error checking user status:", err)
      }
    }

    checkUserStatus()
  }, [router])

  useEffect(() => {
    const fetchCabNumbers = async () => {
      try {
        const response = await axios.get(`${baseURL}api/cabDetails`, {
          headers: {
            Authorization: `Bearer ${localStorage.getItem("token")}`
          }
        })
        const cabMap = {}
        response.data.forEach(cab => {
          cabMap[cab.id] = cab.cabNumber
        })
        setCabNumbers(cabMap)
      } catch (error) {
        console.error("Error fetching cab details:", error)
      }
    }

    fetchCabNumbers()
  }, [])

  // Fetch only this admin's cabs for header export control
  useEffect(() => {
    const fetchAdminCabs = async () => {
      try {
        const token = localStorage.getItem("token")
        if (!token) return
        const res = await axios.get(`${baseURL}api/assigncab/admin-cabs`, {
          headers: { Authorization: `Bearer ${token}` },
        })
        setAdminCabs(Array.isArray(res.data?.cabs) ? res.data.cabs : [])
      } catch (e) {
        console.warn("Failed to fetch admin cabs", e)
        setAdminCabs([])
      }
    }
    fetchAdminCabs()
  }, [])

  const getCabNumber = (cabId) => {
    return cabNumbers[cabId] || `Cab ${cabId}`
  }

  const getPickupLocation = (cab) =>
    cab.pickupLocation || cab.locationFrom || cab.pickupHistory || null

  const getDropLocation = (cab) =>
    cab.dropLocation || cab.locationTo || cab.dropHistory || null

  const exportToExcel = async () => {
    if (filteredExpenses.length === 0) {
      alert("No data to export!")
      return
    }

    setLoading(true)
    try {
      const formattedData = filteredExpenses.map((cab, index) => ({
        ID: index + 1,
        "Cab Number": getCabNumber(cab.cabId),
        "Pickup Location": getPickupLocation(cab) || "-",
        "Drop Location": getDropLocation(cab) || "-",
        Date: cab.cabDate ? new Date(cab.cabDate).toLocaleDateString() : "N/A",
        "Cash Collected (₹)": cab.cashCollected || 0,
        "Fuel (₹)": cab.breakdown.fuel || 0,
        "FastTag (₹)": cab.breakdown.fastTag || 0,
        "Tyre Repair (₹)": cab.breakdown.tyrePuncture || 0,
        "Other Expenses (₹)": cab.breakdown.otherProblems || 0,
        "Total Expense (₹)": cab.totalExpense,
        "Net Cash (₹)": (cab.cashCollected || 0) - (cab.totalExpense || 0),
      }))

      const ExcelJS = (await import('exceljs')).default
      const workbook = new ExcelJS.Workbook()
      const worksheet = workbook.addWorksheet("Cab Expenses")

      if (formattedData.length > 0) {
        const headers = Object.keys(formattedData[0])
        worksheet.columns = headers.map((header) => ({ header, key: header }))
        worksheet.addRows(formattedData)
        worksheet.getRow(1).font = { bold: true }
      }

      const excelBuffer = await workbook.xlsx.writeBuffer()
      const data = new Blob([excelBuffer], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      })

      saveAs(data, "CabExpenses.xlsx")
      alert("Export successful!")
    } catch (error) {
      console.error("Error exporting data:", error)
      alert("Failed to export data")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    const fetchAllExpenses = async () => {
      setLoading(true)
      try {
        const response = await axios.get(`${baseURL}api/cabs/cabExpensive`, {
          headers: {
            Authorization: `Bearer ${localStorage.getItem("token")}`
          }
        })

        if (response.data.success) {
          const data = response.data.data || []
          const normalized = mapExpenses(data)
          setAllExpenses(normalized)
          setFilteredExpenses(normalized)
          // recache for next instant render
          try {
            localStorage.setItem("cache:expenses", JSON.stringify(normalized))
          } catch {}
        } else {
          setAllExpenses([])
          setFilteredExpenses([])
        }
      } catch (error) {
        console.error("Error fetching expenses:", error)
        setAllExpenses([])
        setFilteredExpenses([])
      } finally {
        setTimeout(() => {
          setLoading(false)
          setIsInitialLoad(false)
        }, 500)
      }
    }

    fetchAllExpenses()
  }, [])

  const applyFilters = () => {
    setLoading(true)
    setTimeout(() => {
      let results = [...allExpenses]

      if (searchQuery.trim()) {
        results = results.filter(expense => 
          getCabNumber(expense.cabId).toLowerCase().includes(searchQuery.toLowerCase())
        )
      }

      if (fromDate && toDate) {
        const fromDateObj = new Date(fromDate)
        const toDateObj = new Date(toDate)
        toDateObj.setHours(23, 59, 59, 999)

        results = results.filter(expense => {
          const expenseDate = new Date(expense.cabDate)
          return expenseDate >= fromDateObj && expenseDate <= toDateObj
        })
      }

      setFilteredExpenses(results)
      setLoading(false)
    }, 500)
  }

  const handleSearch = (e) => {
    e.preventDefault()
    applyFilters()
  }

  const handleDateFilter = () => {
    if (!fromDate || !toDate) {
      alert("Please select both start and end dates")
      return
    }
    applyFilters()
  }

  const resetFilters = () => {
    setLoading(true)
    setTimeout(() => {
      setSearchQuery("")
      setFromDate("")
      setToDate("")
      setFilteredExpenses(allExpenses)
      setLoading(false)
    }, 500)
  }

  if (loading && isInitialLoad) {
    return (
      <div className="flex bg-gray-50 min-h-screen">
        <Sidebar />
        <div className="flex-1 p-6 mt-20 sm:mt-0 md:ml-60 flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-yellow-500 mx-auto mb-4"></div>
            <p className="text-gray-600">Loading...</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar />

      <div className="flex-1 md:ml-60 p-4 md:p-6 mt-20 sm:mt-0 transition-all duration-300">
        {showAccessDenied && <AccessDeniedModal />}

        <div className="mb-6">
          <h1 className="text-2xl md:text-3xl font-bold text-gray-800 mb-2">Expenses</h1>
          <p className="text-gray-600">Manage and track your cab expenses</p>
        </div>

        {/* Filters Section */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-800 mb-4">Filter Expenses</h2>
          
          <div className="space-y-4">
            {/* Search */}
            <form onSubmit={handleSearch} className="flex flex-col sm:flex-row gap-3">
              <div className="flex-1">
                <input
                  type="text"
                  placeholder="Search by Cab Number"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-500 focus:border-transparent text-gray-800 bg-white"
                />
              </div>
              <button
                type="submit"
                className="bg-yellow-500 hover:bg-yellow-600 text-white px-6 py-2 rounded-lg font-medium transition-colors duration-200 disabled:opacity-50"
                disabled={loading || isInitialLoad}
              >
                {loading ? "Searching..." : "Search"}
              </button>
            </form>

            {/* Date Filter */}
            <div className="flex flex-col lg:flex-row gap-4 items-start lg:items-end">
              <div className="flex flex-col sm:flex-row gap-4 flex-1">
                <div className="flex-1">
                  <label className="block text-sm font-medium text-gray-700 mb-2">From Date</label>
                  <input
                    type="date"
                    value={fromDate}
                    onChange={(e) => setFromDate(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-500 focus:border-transparent text-gray-800 bg-white"
                  />
                </div>
                <div className="flex-1">
                  <label className="block text-sm font-medium text-gray-700 mb-2">To Date</label>
                  <input
                    type="date"
                    value={toDate}
                    onChange={(e) => setToDate(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-500 focus:border-transparent text-gray-800 bg-white"
                  />
                </div>
              </div>
              
              <div className="flex flex-col sm:flex-row gap-3">
                <button
                  onClick={handleDateFilter}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg font-medium transition-colors duration-200 disabled:opacity-50"
                  disabled={loading || isInitialLoad}
                >
                  Filter by Date
                </button>
                <button
                  onClick={resetFilters}
                  className="bg-gray-600 hover:bg-gray-700 text-white px-6 py-2 rounded-lg font-medium transition-colors duration-200 disabled:opacity-50"
                  disabled={loading || isInitialLoad}
                >
                  Reset Filters
                </button>
                <button
                  onClick={exportToExcel}
                  disabled={loading || filteredExpenses.length === 0}
                  className="bg-green-600 hover:bg-green-700 text-white px-6 py-2 rounded-lg font-medium transition-colors duration-200 disabled:opacity-50"
                >
                  {loading ? "Exporting..." : "Export to Excel"}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Results Section */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-800">
              Expense Records ({filteredExpenses.length})
            </h2>
          </div>

          {loading || isInitialLoad ? (
            <div className="p-6">
              <div className="animate-pulse space-y-4">
                {[...Array(5)].map((_, i) => (
                  <div key={i} className="bg-gray-200 h-16 rounded-md"></div>
                ))}
              </div>
            </div>
          ) : (
            <>
              {/* Desktop Table */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Cab Number
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Date
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Cash & Expenses
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Total Expense
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {filteredExpenses.length > 0 ? (
                      filteredExpenses.map((cab, index) => (
                        <tr key={`${cab.cabId}-${index}`} className="hover:bg-gray-50 transition-colors duration-150">
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm font-medium text-gray-900">{getCabNumber(cab.cabId)}</div>
                            {(getPickupLocation(cab) || getDropLocation(cab)) && (
                              <div className="mt-1 text-xs text-gray-500 space-y-0.5">
                                {getPickupLocation(cab) && <div>Pickup: {getPickupLocation(cab)}</div>}
                                {getDropLocation(cab) && <div>Drop: {getDropLocation(cab)}</div>}
                              </div>
                            )}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm text-gray-900">
                              {cab.cabDate ? new Date(cab.cabDate).toLocaleDateString() : "N/A"}
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <div className="text-sm text-gray-900 space-y-1">
                              {/* <div className="flex justify-between">
                                <span className="font-medium">Cash Collected:</span>
                                <span className="font-semibold text-green-600">₹{cab.cashCollected?.toLocaleString() || 0}</span>
                              </div> */}
                              <div className="flex">
                                <span className="w-20">Fuel:</span>
                                <span className="font-medium">₹{cab.breakdown.fuel?.toLocaleString() || 0}</span>
                              </div>
                              <div className="flex">
                                <span className="w-20">FastTag:</span>
                                <span className="font-medium">₹{cab.breakdown.fastTag?.toLocaleString() || 0}</span>
                              </div>
                              <div className="flex">
                                <span className="w-20">Tyre:</span>
                                <span className="font-medium">₹{cab.breakdown.tyrePuncture?.toLocaleString() || 0}</span>
                              </div>
                              <div className="flex">
                                <span className="w-20">Other:</span>
                                <span className="font-medium">₹{cab.breakdown.otherProblems?.toLocaleString() || 0}</span>
                              </div>
                              {/* <div className="flex justify-between border-t border-gray-300 pt-1 mt-1">
                                <span className="font-medium">Net cash:</span>
                                <span className={`font-semibold ${(cab.cashCollected || 0) - (cab.totalExpense || 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                  ₹{((cab.cashCollected || 0) - (cab.totalExpense || 0)).toLocaleString()}
                                </span>
                              </div> */}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm font-bold text-gray-900">₹{cab.totalExpense?.toLocaleString() || 0}</div>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan="4" className="px-6 py-12 text-center text-gray-500">
                          <div className="flex flex-col items-center">
                            <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mb-4">
                              <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                              </svg>
                            </div>
                            <p className="text-lg font-medium">No expenses found</p>
                            <p className="text-sm">Try adjusting your search criteria</p>
                          </div>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
              {/* Mobile Cards */}
              <div className="md:hidden p-4 space-y-4">
                {filteredExpenses.length > 0 ? (
                  filteredExpenses.map((cab, index) => (
                    <div key={`${cab.cabId}-${index}`} className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                      <div className="flex justify-between items-start mb-3">
                        <div>
                          <p className="text-gray-600 text-xs uppercase tracking-wide">Cab Number</p>
                          <p className="text-lg font-semibold text-gray-900">{getCabNumber(cab.cabId)}</p>
                          {(cab.pickupLocation || cab.dropLocation) && (
                            <div className="mt-1 text-xs text-gray-500 space-y-0.5">
                              {cab.pickupLocation && <div>Pickup: {cab.pickupLocation}</div>}
                              {cab.dropLocation && <div>Drop: {cab.dropLocation}</div>}
                            </div>
                          )}
                        </div>
                        <div className="text-right">
                          <p className="text-gray-600 text-xs uppercase tracking-wide">Date</p>
                          <p className="text-lg font-bold text-gray-900">{cab.cabDate ? new Date(cab.cabDate).toLocaleDateString() : "N/A"}</p>
                          <p className="text-sm font-medium text-gray-700 mt-1">₹{cab.totalExpense?.toLocaleString() || 0}</p>
                        </div>
                      </div>

                      <div className="border-t border-gray-200 pt-3 space-y-3">
                        <div className="grid grid-cols-2 gap-2 text-sm">
                          <div className="flex justify-between">
                            <span className="text-gray-600">Fuel:</span>
                            <span className="font-medium text-gray-900">₹{cab.breakdown.fuel?.toLocaleString() || 0}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-600">FastTag:</span>
                            <span className="font-medium text-gray-900">₹{cab.breakdown.fastTag?.toLocaleString() || 0}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-600">Tyre:</span>
                            <span className="font-medium text-gray-900">₹{cab.breakdown.tyrePuncture?.toLocaleString() || 0}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-600">Other:</span>
                            <span className="font-medium text-gray-900">₹{cab.breakdown.otherProblems?.toLocaleString() || 0}</span>
                          </div>
                        </div>

                        {(getPickupLocation(cab) || getDropLocation(cab)) && (
                          <div className="text-xs text-gray-500 space-y-1">
                            {getPickupLocation(cab) && <div>Pickup: {getPickupLocation(cab)}</div>}
                            {getDropLocation(cab) && <div>Drop: {getDropLocation(cab)}</div>}
                          </div>
                        )}

                        <div className="flex justify-between text-sm border-t border-gray-200 pt-2">
                          <span className="font-medium text-gray-700">Net Cash:</span>
                          <span className={`font-semibold ${(cab.cashCollected || 0) - (cab.totalExpense || 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                            ₹{((cab.cashCollected || 0) - (cab.totalExpense || 0)).toLocaleString()}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-12">
                    <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                      <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                    </div>
                    <p className="text-lg font-medium text-gray-900">No expenses found</p>
                    <p className="text-sm text-gray-600">Try adjusting your search criteria</p>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

export default CabExpenses