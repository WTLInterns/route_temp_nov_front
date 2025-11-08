"use client"

import { useState, useEffect } from "react"
import {
  FiEdit,
  FiTrash2,
  FiUserPlus,
  FiUser,
  FiMail,
  FiPhone,
  FiCreditCard,
  FiFileText,
  FiImage,
  FiX,
  FiChevronLeft,
  FiChevronRight,
} from "react-icons/fi"
import { IoIosContact } from "react-icons/io";
import Sidebar from "../slidebar/page"
import { ToastContainer, toast } from "react-toastify"
import "react-toastify/dist/ReactToastify.css"
import axios from "axios"
import { motion } from "framer-motion"
import baseURL from "@/utils/api"
import Image from "next/image"
import AddDriver from "./component/AddDriver";
import { useRouter } from "next/navigation"

const AccessDeniedModal = () => {
  const router = useRouter()

  const handleClose = () => {
    router.push("/")
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-70">
      <div className="bg-white text-black p-8 rounded-lg shadow-lg max-w-sm w-full">
        <h2 className="text-xl font-semibold mb-4">Access Denied</h2>
        <p className="mb-6">Your access has been restricted. Please contact the administrator.</p>
        <button onClick={handleClose} className="bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700 transition">
          Close
        </button>
      </div>
    </div>
  )
}

const Driver = () => {
  const router = useRouter()
  const [showAccessDenied, setShowAccessDenied] = useState(false)
  const [profileImageName, setProfileImageName] = useState('');
  const [licenseImageName, setLicenseImageName] = useState('');
  const [adharImageName, setAdharImageName] = useState('');
  const [drivers, setDrivers] = useState([])
  const [salaries, setSalaries] = useState({})
  const [salaryTypes, setSalaryTypes] = useState({})
  const [perTripRates, setPerTripRates] = useState({})
  const [loading, setLoading] = useState(true)
  const [selectedDriver, setSelectedDriver] = useState(null)
  const [isEditMode, setIsEditMode] = useState(false)
  const [isAddDriverModalOpen, setIsAddDriverModalOpen] = useState(false)
  const [editFormData, setEditFormData] = useState({
    name: "",
    email: "",
    adharNo: "",
    licenseNo: "",
    phone: "",
    salary: "",
    salaryType: "fixed",
    perTripRate: "",
  })
  const [errors, setErrors] = useState({})

  // Edit image states (previews and files)
  const [editProfilePreview, setEditProfilePreview] = useState(null)
  const [editLicensePreview, setEditLicensePreview] = useState(null)
  const [editAdharPreview, setEditAdharPreview] = useState(null)
  const [editProfileFile, setEditProfileFile] = useState(null)
  const [editLicenseFile, setEditLicenseFile] = useState(null)
  const [editAdharFile, setEditAdharFile] = useState(null)

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1)
  const [driversPerPage] = useState(5)

  // Add driver form state
  const [addDriverFormData, setAddDriverFormData] = useState({
    name: "",
    email: "",
    phone: "",
    licenseNo: "",
    adharNo: "",
    addedBy: "",
  })
  const [profileImage, setProfileImage] = useState(null)
  const [licenseImage, setLicenseImage] = useState(null)
  const [adharImage, setAdharImage] = useState(null)
  const [addDriverErrors, setAddDriverErrors] = useState({})
  const [addDriverLoading, setAddDriverLoading] = useState(false)

  // to show images
  const [modalImage, setModalImage] = useState(null);
  const [showModal, setShowModal] = useState(false);

  const handleImageClick = (imageUrl) => {
    setModalImage(imageUrl);
    setShowModal(true);
  };

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
    fetchDrivers()

    // Set admin ID for add driver form
    const adminId = localStorage.getItem("id")
    if (adminId) {
      setAddDriverFormData((prev) => ({ ...prev, addedBy: adminId }))
    }
  }, [])

  const fetchDrivers = async () => {
    const token = localStorage.getItem("token")
    const subAdminId = localStorage.getItem("id")
    if (!token) {
      toast.error("Authentication token missing!")
      return
    }

    try {
      setLoading(true)
      const res = await axios.get(`${baseURL}api/driver/profile`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      const driverList = res.data || []
      setDrivers(driverList)
      
      // Fetch salary for each driver
      const salaryData = {}
      const salaryTypeData = {}
      const perTripRateData = {}
      for (const driver of driverList) {
        try {
          const salaryRes = await axios.get(`${baseURL}api/salary/${subAdminId}/${driver.id}`, {
            headers: { Authorization: `Bearer ${token}` }
          })
          if (salaryRes.data) {
            salaryData[driver.id] = salaryRes.data.baseSalary || 0
            salaryTypeData[driver.id] = salaryRes.data.salaryType || 'fixed'
            perTripRateData[driver.id] = salaryRes.data.perTripRate || 0
          }
        } catch (err) {
          // Silently handle 404 errors for drivers without salary records
          if (err.response?.status === 404) {
            salaryData[driver.id] = 0
            salaryTypeData[driver.id] = 'fixed'
            perTripRateData[driver.id] = 0
          } else {
            // Log other errors but don't show toast
            console.warn(`Could not fetch salary for driver ${driver.id}:`, err.response?.status)
            salaryData[driver.id] = 0
            salaryTypeData[driver.id] = 'fixed'
            perTripRateData[driver.id] = 0
          }
        }
      }
      setSalaries(salaryData)
      setSalaryTypes(salaryTypeData)
      setPerTripRates(perTripRateData)
    } catch (error) {
      console.error("Error fetching driver data:", error)
      toast.error("There is no any driver data .")
    } finally {
      setLoading(false)
    }
  }

  // Edit driver handlers
  const handleEdit = async (driver) => {
    const token = localStorage.getItem("token")
    const subAdminId = localStorage.getItem("id")
    
    // Fetch current salary details
    let salaryType = 'fixed'
    let perTripRate = ''
    let baseSalary = salaries[driver.id] || 0
    
    try {
      const salaryRes = await axios.get(`${baseURL}api/salary/${subAdminId}/${driver.id}`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      if (salaryRes.data) {
        salaryType = salaryRes.data.salaryType || 'fixed'
        perTripRate = salaryRes.data.perTripRate || ''
        baseSalary = salaryRes.data.baseSalary || 0
      }
    } catch (err) {
      console.error('Error fetching salary details:', err)
    }
    
    setEditFormData({ 
      ...driver,
      salary: baseSalary,
      salaryType: salaryType,
      perTripRate: perTripRate
    })
    // Initialize previews with existing images and clear selected files
    setEditProfilePreview(driver.profileImage || null)
    setEditLicensePreview(driver.licenseNoImage || null)
    setEditAdharPreview(driver.adharNoImage || null)
    setEditProfileFile(null)
    setEditLicenseFile(null)
    setEditAdharFile(null)
    setIsEditMode(true)
    setSelectedDriver(driver)
    setErrors({})
  }

  // Edit image change handlers
  const handleEditProfileChange = (e) => {
    const file = e.target.files?.[0]
    if (file) {
      setEditProfileFile(file)
      setEditProfilePreview(URL.createObjectURL(file))
    }
  }

  const handleEditLicenseChange = (e) => {
    const file = e.target.files?.[0]
    if (file) {
      setEditLicenseFile(file)
      setEditLicensePreview(URL.createObjectURL(file))
    }
  }

  const handleEditAdharChange = (e) => {
    const file = e.target.files?.[0]
    if (file) {
      setEditAdharFile(file)
      setEditAdharPreview(URL.createObjectURL(file))
    }
  }

  const handleDelete = async (id) => {
    if (!window.confirm("Are you sure you want to delete this driver?")) return

    try {
      await axios.delete(`${baseURL}api/driver/profile/${id}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
      })

      setDrivers((prevDrivers) => prevDrivers.filter((driver) => driver.id !== id))
      toast.success("Driver deleted successfully!")
    } catch (error) {
      console.error("Error deleting driver:", error)
      toast.error("Failed to delete driver.")
    }
  }

  const handleEditSubmit = async () => {
    // Validate edit form
    const newErrors = {}

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors)
      return
    }

    try {
      const token = localStorage.getItem("token")
      const url = `${baseURL}api/driver/profile/${editFormData.id}`

      let response
      if (editProfileFile || editLicenseFile || editAdharFile) {
        const formData = new FormData()
        // append text fields
        formData.append("name", editFormData.name || "")
        formData.append("email", editFormData.email || "")
        formData.append("adharNo", editFormData.adharNo || "")
        formData.append("licenseNo", editFormData.licenseNo || "")
        formData.append("phone", editFormData.phone || "")
        // append files if present
        if (editProfileFile) formData.append("profileImage", editProfileFile)
        if (editLicenseFile) formData.append("licenseNoImage", editLicenseFile)
        if (editAdharFile) formData.append("adharNoImage", editAdharFile)

        response = await axios.put(url, formData, {
          headers: { Authorization: `Bearer ${token}` },
        })
      } else {
        response = await axios.put(url, editFormData, {
          headers: { Authorization: `Bearer ${token}` },
        })
      }

      // Update salary if changed
      const subAdminId = localStorage.getItem("id")
      if (editFormData.salary || editFormData.perTripRate) {
        try {
          const salaryPayload = {
            salaryType: editFormData.salaryType
          }
          
          if (editFormData.salaryType === 'fixed') {
            salaryPayload.baseSalary = Number(editFormData.salary) || 0
          } else {
            salaryPayload.baseSalary = Number(editFormData.salary) || 0
            salaryPayload.perTripRate = Number(editFormData.perTripRate) || 0
          }
          
          await axios.post(`${baseURL}api/salary/${subAdminId}/${editFormData.id}/set`, 
            salaryPayload,
            { headers: { Authorization: `Bearer ${token}` } }
          )
          // Update local salary state
          setSalaries(prev => ({ ...prev, [editFormData.id]: Number(editFormData.salary) || 0 }))
          setSalaryTypes(prev => ({ ...prev, [editFormData.id]: editFormData.salaryType }))
          setPerTripRates(prev => ({ ...prev, [editFormData.id]: Number(editFormData.perTripRate) || 0 }))
        } catch (err) {
          console.error('Error updating salary:', err)
          toast.warning('Driver updated but salary update failed')
        }
      }

      const updatedDriver = response?.data?.updatedDriver || editFormData
      setDrivers((prevDrivers) => prevDrivers.map((d) => (d.id === updatedDriver.id ? { ...d, ...updatedDriver } : d)))

      setIsEditMode(false)
      setSelectedDriver(null)
      // clear selected files after save
      setEditProfileFile(null)
      setEditLicenseFile(null)
      setEditAdharFile(null)
      toast.success("Driver details updated successfully!")
    } catch (error) {
      console.error("Error updating driver:", error)
      toast.error("Failed to update driver.")
    }
  }

  // Add driver handlers
  const handleAddDriverChange = (e) => {
    setAddDriverFormData({ ...addDriverFormData, [e.target.name]: e.target.value })
    setAddDriverErrors({ ...addDriverErrors, [e.target.name]: "" })
  }

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    setProfileImage(e.target.files[0])
    setAddDriverErrors({ ...addDriverErrors, profileImage: "" })
    if (file) {
      setProfileImageName(file.name);
    }
  }

  const handleLicenseImageChange = (e) => {
    const file = e.target.files[0];
    setLicenseImage(e.target.files[0])
    setAddDriverErrors({ ...addDriverErrors, licenseImage: "" })
    if (file) setLicenseImageName(file.name);
  };

  const handleAdharImageChange = (e) => {
    const file = e.target.files[0];
    setAdharImage(e.target.files[0])
    setAddDriverErrors({ ...addDriverErrors, adharImage: "" })
    if (file) setAdharImageName(file.name);
  };

  const licenseCleaned = addDriverFormData.licenseNo.replace(/-/g, "");
  const validateAddDriverForm = () => {
    const newErrors = {}
    if (!addDriverFormData.name.trim()) newErrors.name = "Name is required"
    if (!addDriverFormData.email.trim()) newErrors.email = "Email is required"
    else if (!/^[a-zA-Z0-9._%+-]+@gmail\.com$/.test(addDriverFormData.email)) {
      newErrors.email = "Please Enter valid Gmail (e.g., user@gmail.com)";
    }    if (!addDriverFormData.phone.trim()) newErrors.phone = "Phone is required"
    else if (!/^\d{10}$/.test(addDriverFormData.phone)) newErrors.phone = "Phone must be 10 digits"
    if (!addDriverFormData.licenseNo.trim()) newErrors.licenseNo = "License No is required";   
    if (!addDriverFormData.adharNo.trim()) newErrors.adharNo = "Aadhar No is required"
    else if (!/^\d{12}$/.test(addDriverFormData.adharNo)) newErrors.adharNo = "Aadhar must be 12 digits"
    if (!addDriverFormData.addedBy) newErrors.addedBy = "Admin ID is missing"
    if (!profileImage) newErrors.profileImage = "Profile image is required"
    if (!licenseImage) newErrors.licenseImage = "License image is required"
    if (!adharImage) newErrors.adharImage = "Aadhar image is required"

    setAddDriverErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleAddDriverSubmit = async (e) => {
    e.preventDefault()
    if (!validateAddDriverForm()) return

    setAddDriverLoading(true)

    try {
      const formDataToSend = new FormData()

      Object.keys(addDriverFormData).forEach((key) => {
        formDataToSend.append(key, addDriverFormData[key])
      })

      formDataToSend.append("profileImage", profileImage)
      formDataToSend.append("licenseNoImage", licenseImage)
      formDataToSend.append("adharNoImage", adharImage)

      const response = await fetch(`${baseURL}api/register`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
        body: formDataToSend,
      })

      const data = await response.json()

      if (response.ok) {
        // Reset form
        setAddDriverFormData({
          name: "",
          email: "",
          phone: "",
          licenseNo: "",
          adharNo: "",
          addedBy: localStorage.getItem("id") || "",
        })
        setProfileImage(null)
        if (document.getElementById("profileInput")) {
          document.getElementById("profileInput").value = ""
        }
        setLicenseImage(null)
        if (document.getElementById("licenseInput")) {
          document.getElementById("licenseInput").value = ""
        }
        setAdharImage(null)
        if (document.getElementById("adharInput")) {
          document.getElementById("adharInput").value = ""
        }

        // Close modal and refresh driver list
        setIsAddDriverModalOpen(false)
        fetchDrivers()
        toast.success("Driver added successfully!")
      } else {
        setAddDriverErrors({ apiError: data.error || "❌ Something went wrong" })
      }
    } catch (error) {
      console.error("Fetch Error:", error)
      setAddDriverErrors({ apiError: "❌ Server error, try again later" })
    } finally {
      setAddDriverLoading(false)
    }
  }

  // Pagination logic
  const indexOfLastDriver = currentPage * driversPerPage
  const indexOfFirstDriver = indexOfLastDriver - driversPerPage
  const currentDrivers = drivers.slice(indexOfFirstDriver, indexOfLastDriver)
  const totalPages = Math.ceil(drivers.length / driversPerPage)

  const paginate = (pageNumber) => setCurrentPage(pageNumber)

  const nextPage = () => {
    if (currentPage < totalPages) {
      setCurrentPage(currentPage + 1)
    }
  }

  const prevPage = () => {
    if (currentPage > 1) {
      setCurrentPage(currentPage - 1)
    }
  }

  if (loading) {
  return (
    <div className="flex bg-gray-50 min-h-screen">
      <Sidebar />
      <div className="flex-1 p-6 mt-20 sm:mt-0 md:ml-60 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-yellow-400 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    </div>
  )
}


  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar />

      <div className="flex-1 p-4 md:p-6 md:ml-60 mt-20 sm:mt-0 transition-all duration-300">
      {showAccessDenied && <AccessDeniedModal />}
       <ToastContainer />
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-xl md:text-2xl font-bold mb-4 text-gray-800">Driver Details</h1>
          <button
            onClick={() => setIsAddDriverModalOpen(true)}
            className="flex items-center gap-2 bg-yellow-400 hover:bg-yellow-500 text-black px-4 py-2 rounded-lg transition-all duration-200 font-medium shadow-sm"
          >
            <FiUserPlus size={18} />
            <span className="hidden md:inline">Add New Driver</span>
          </button>
        </div>

        {loading ? (
          <div className="animate-pulse space-y-4">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="bg-white h-16 rounded-lg shadow-sm"></div>
            ))}
          </div>
        ) : (
          <>
            {/* Desktop Table View */}
            <div className="hidden md:block bg-white shadow-sm rounded-lg overflow-hidden border border-gray-200">
              <table className="min-w-full table-auto">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="p-4 text-left text-sm font-semibold text-gray-700">Profile</th>
                    <th className="p-4 text-left text-sm font-semibold text-gray-700">Driver Name</th>
                    <th className="p-4 text-left text-sm font-semibold text-gray-700">Email</th>
                    <th className="p-4 text-left text-sm font-semibold text-gray-700">Salary</th>
                    <th className="p-4 text-left text-sm font-semibold text-gray-700">Adhar Image</th>
                    <th className="p-4 text-left text-sm font-semibold text-gray-700">License</th>
                    <th className="p-4 text-left text-sm font-semibold text-gray-700">License Image</th>
                    <th className="p-4 text-left text-sm font-semibold text-gray-700">Contact</th>
                    <th className="p-4 text-left text-sm font-semibold text-gray-700">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {currentDrivers.map((driver) => (
                    <tr key={driver.id} className="hover:bg-gray-50 transition-colors">
                      <td className="p-4">
                        <Image
                          src={driver.profileImage || "/images/default-driver.jpg"}
                          alt="Driver"
                          width={40}
                          height={40}
                          className="rounded-full object-cover cursor-pointer"
                          unoptimized
                          onClick={() => handleImageClick(driver.profileImage)}
                        />
                      </td>
                      <td className="p-4 text-gray-900 font-medium">{driver.name}</td>
                      <td className="p-4 text-gray-600">{driver.email}</td>
                      <td className="p-4 text-gray-900 font-semibold whitespace-nowrap">
                        ₹ {salaryTypes[driver.id] === 'per-trip' 
                          ? (perTripRates[driver.id] ? (Number(perTripRates[driver.id]) % 1 === 0 ? Number(perTripRates[driver.id]).toFixed(0) : Number(perTripRates[driver.id]).toFixed(2)) : '0')
                          : (salaries[driver.id] ? (Number(salaries[driver.id]) % 1 === 0 ? Number(salaries[driver.id]).toFixed(0) : Number(salaries[driver.id]).toFixed(2)) : '0')
                        }
                        <span className="text-xs text-gray-500 ml-1">
                          {salaryTypes[driver.id] === 'per-trip' ? '/trip' : '/month'}
                        </span>
                      </td>
                      <td className="p-4">
                        <Image
                          src={driver.adharNoImage || "/images/default-driver.jpg"}
                          alt="Adhar Card"
                          width={40}
                          height={40}
                          className="rounded object-cover cursor-pointer"
                          unoptimized
                          onClick={() => handleImageClick(driver.adharNoImage)}
                        />
                      </td>
                      <td className="p-4 text-gray-600">{driver.licenseNo}</td>
                      <td className="p-4">
                        <Image
                          src={driver.licenseNoImage || "/images/default-driver.jpg"}
                          alt="License"
                          width={40}
                          height={40}
                          className="rounded object-cover cursor-pointer"
                          unoptimized
                          onClick={() => handleImageClick(driver.licenseNoImage)}
                        />
                      </td>
                      <td className="p-4 text-gray-600">{driver.phone}</td>
                      <td className="p-4">
                        <div className="flex gap-2">
                          <button 
                            onClick={() => handleEdit(driver)} 
                            className="p-2 bg-blue-50 hover:bg-blue-100 text-blue-600 rounded-lg transition-colors"
                          >
                            <FiEdit size={16} />
                          </button>
                          <button 
                            onClick={() => handleDelete(driver.id)} 
                            className="p-2 bg-red-50 hover:bg-red-100 text-red-600 rounded-lg transition-colors"
                          >
                            <FiTrash2 size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile Card View */}
            <div className="md:hidden space-y-4">
              {currentDrivers.map((driver) => (
                <div key={driver.id} className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
                  <div className="flex items-center space-x-4 mb-3">
                    <Image
                      src={driver.profileImage || "/images/default-driver.jpg"}
                      alt="Driver"
                      width={60}
                      height={60}
                      className="rounded-full object-cover"
                      unoptimized
                    />
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900">{driver.name}</h3>
                      <p className="text-gray-600">{driver.email}</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <p className="text-gray-500 font-medium">Salary</p>
                      <p className="text-gray-900 font-semibold whitespace-nowrap">
                        ₹ {salaryTypes[driver.id] === 'per-trip' 
                          ? (perTripRates[driver.id] ? (Number(perTripRates[driver.id]) % 1 === 0 ? Number(perTripRates[driver.id]).toFixed(0) : Number(perTripRates[driver.id]).toFixed(2)) : '0')
                          : (salaries[driver.id] ? (Number(salaries[driver.id]) % 1 === 0 ? Number(salaries[driver.id]).toFixed(0) : Number(salaries[driver.id]).toFixed(2)) : '0')
                        }
                        <span className="text-xs text-gray-500 ml-1">
                          {salaryTypes[driver.id] === 'per-trip' ? '/trip' : '/month'}
                        </span>
                      </p>
                    </div>
                    <div>
                      <p className="text-gray-500 font-medium">Contact</p>
                      <p className="text-gray-900">{driver.phone}</p>
                    </div>
                    <div>
                      <p className="text-gray-500 font-medium">License</p>
                      <p className="text-gray-900">{driver.licenseNo}</p>
                    </div>
                  </div>
                  <div className="flex justify-between mt-4">
                    <div className="flex space-x-3">
                      <div>
                        <p className="text-gray-500 text-xs mb-1">License Image</p>
                        <Image
                          src={driver.licenseNoImage || "/images/default-driver.jpg"}
                          alt="License"
                          width={50}
                          height={50}
                          className="rounded object-cover"
                          unoptimized
                        />
                      </div>
                      <div>
                        <p className="text-gray-500 text-xs mb-1">Adhar Image</p>
                        <Image
                          src={driver.adharNoImage || "/images/default-driver.jpg"}
                          alt="Adhar Card"
                          width={50}
                          height={50}
                          className="rounded object-cover"
                          unoptimized
                        />
                      </div>
                    </div>
                    <div className="flex flex-col space-y-2">
                      <button 
                        onClick={() => handleEdit(driver)} 
                        className="p-2 bg-blue-50 hover:bg-blue-100 text-blue-600 rounded-lg"
                      >
                        <FiEdit size={16} />
                      </button>
                      <button
                        onClick={() => handleDelete(driver.id)}
                        className="p-2 bg-red-50 hover:bg-red-100 text-red-600 rounded-lg"
                      >
                        <FiTrash2 size={16} />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Pagination Controls */}
            {drivers.length > 0 && (
              <div className="flex justify-center mt-8">
                <nav className="flex items-center gap-1">
                  <button
                    onClick={prevPage}
                    disabled={currentPage === 1}
                    className={`p-2 rounded-lg ${currentPage === 1 ? 'text-gray-400 cursor-not-allowed' : 'text-gray-600 hover:bg-gray-100'}`}
                  >
                    <FiChevronLeft size={20} />
                  </button>

                  {Array.from({ length: totalPages }, (_, i) => i + 1).map((number) => (
                    <button
                      key={number}
                      onClick={() => paginate(number)}
                      className={`px-3 py-2 rounded-lg text-sm font-medium ${
                        currentPage === number 
                          ? 'bg-yellow-400 text-black' 
                          : 'text-gray-600 hover:bg-gray-100'
                      }`}
                    >
                      {number}
                    </button>
                  ))}

                  <button
                    onClick={nextPage}
                    disabled={currentPage === totalPages}
                    className={`p-2 rounded-lg ${currentPage === totalPages ? 'text-gray-400 cursor-not-allowed' : 'text-gray-600 hover:bg-gray-100'}`}
                  >
                    <FiChevronRight size={20} />
                  </button>
                </nav>
              </div>
            )}
          </>
        )}

        {/* Edit Driver Modal */}
        {isEditMode && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center  bg-opacity-50 p-4">
            <div className="bg-white rounded-lg w-full max-w-2xl p-6 relative shadow-xl flex flex-col">
              <button
                className="absolute top-3 right-3 text-gray-400 hover:text-gray-600 transition-colors"
                onClick={() => setIsEditMode(false)}
              >
                <FiX size={24} />
              </button>
              <h2 className="text-2xl font-semibold mb-4 text-gray-900">Edit Driver</h2>
              <div className="space-y-3">
                {/* Image previews and replace inputs */}
                <div className="grid grid-cols-3 gap-3">
                  <div className="text-center">
                    <div className="w-24 h-24 mx-auto border rounded overflow-hidden bg-gray-50">
                      {editProfilePreview ? (
                        <Image src={editProfilePreview} alt="Profile" width={96} height={96} className="w-full h-full object-cover" unoptimized />
                       ) : (
                        <div className="w-full h-full flex items-center justify-center text-gray-400 text-xs">No Image</div>
                      )}
                    </div>
                    <label className="mt-1 inline-block text-[11px] text-blue-600 hover:underline cursor-pointer">
                      Replace
                      <input type="file" accept="image/*" className="hidden" onChange={handleEditProfileChange} />
                    </label>
                  </div>
                  <div className="text-center">
                    <div className="w-24 h-24 mx-auto border rounded overflow-hidden bg-gray-50">
                      {editLicensePreview ? (
                        <Image src={editLicensePreview} alt="License" width={96} height={96} className="w-full h-full object-cover" unoptimized />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-gray-400 text-xs">No Image</div>
                      )}
                    </div>
                    <label className="mt-1 inline-block text-[11px] text-blue-600 hover:underline cursor-pointer">
                      Replace
                      <input type="file" accept="image/*" className="hidden" onChange={handleEditLicenseChange} />
                    </label>
                  </div>
                  <div className="text-center">
                    <div className="w-24 h-24 mx-auto border rounded overflow-hidden bg-gray-50">
                      {editAdharPreview ? (
                        <Image src={editAdharPreview} alt="Aadhaar" width={96} height={96} className="w-full h-full object-cover" unoptimized />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-gray-400 text-xs">No Image</div>
                      )}
                    </div>
                    <label className="mt-1 inline-block text-[11px] text-blue-600 hover:underline cursor-pointer">
                      Replace
                      <input type="file" accept="image/*" className="hidden" onChange={handleEditAdharChange} />
                    </label>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                {[
                  { label: "Driver Name", field: "name" },
                  { label: "Email", field: "email", type: "email" },
                  { label: "Aadhar No", field: "adharNo" },
                  { label: "Driving License", field: "licenseNo" },
                  { label: "Contact", field: "phone" },
                ].map(({ label, field, type = "text", disabled = false }) => (
                  <div key={field}>
                    <label className="block text-sm font-medium mb-1 text-gray-700">{label}</label>
                    <input
                      type={type}
                      value={editFormData[field] || ""}
                      onChange={(e) => setEditFormData({ ...editFormData, [field]: e.target.value })}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-base bg-white text-gray-900 focus:ring-2 focus:ring-yellow-400 focus:border-transparent"
                      disabled={disabled}
                      min={type === "number" ? "0" : undefined}
                      step={type === "number" ? "0.01" : undefined}
                    />
                    {errors[field] && <p className="text-red-500 text-sm mt-1">{errors[field]}</p>}
                  </div>
                ))}
                </div>
                
                {/* Salary Type Selector */}
                <div className="grid grid-cols-2 gap-4">
                  <label className="block text-sm font-medium mb-1 text-gray-700">Salary Type</label>
                  <select
                    value={editFormData.salaryType || "fixed"}
                    onChange={(e) => setEditFormData({ ...editFormData, salaryType: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-base bg-white text-gray-900 focus:ring-2 focus:ring-yellow-400 focus:border-transparent"
                  >
                    <option value="fixed">Fixed Monthly Salary</option>
                    <option value="per-trip">Per Trip Salary</option>
                  </select>
                </div>

                {/* Conditional Salary Fields */}
                {editFormData.salaryType === "fixed" ? (
                  <div className="grid grid-cols-2 gap-4">
                    <label className="block text-sm font-medium mb-1 text-gray-700">Fixed Monthly Salary</label>
                    <input
                      type="number"
                      value={editFormData.salary || ""}
                      onChange={(e) => setEditFormData({ ...editFormData, salary: e.target.value })}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-base bg-white text-gray-900 focus:ring-2 focus:ring-yellow-400 focus:border-transparent"
                      min="0"
                      step="0.01"
                    />
                    {errors.salary && <p className="text-red-500 text-sm mt-1">{errors.salary}</p>}
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-4">
                    <label className="block text-sm font-medium mb-1 text-gray-700">Per Trip Rate</label>
                    <input
                      type="number"
                      value={editFormData.perTripRate || ""}
                      onChange={(e) => setEditFormData({ ...editFormData, perTripRate: e.target.value })}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-base bg-white text-gray-900 focus:ring-2 focus:ring-yellow-400 focus:border-transparent"
                      min="0"
                      step="0.01"
                    />
                    {errors.perTripRate && <p className="text-red-500 text-sm mt-1">{errors.perTripRate}</p>}
                  </div>
                )}
              </div>
              <div className="mt-4 flex justify-end gap-3 pt-4 border-t border-gray-200">
                <button
                  onClick={() => setIsEditMode(false)}
                  className="px-4 py-2 text-base border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleEditSubmit}
                  className="px-4 py-2 text-base bg-yellow-400 hover:bg-yellow-500 text-black rounded-lg transition-colors font-medium"
                >
                  Save Changes
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Show image modal */}
        {showModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-4 max-w-md w-full relative shadow-xl">
              <button
                className="absolute top-2 right-2 text-gray-500 hover:text-gray-700 font-bold text-lg"
                onClick={() => setShowModal(false)}
              >
                ✕
              </button>
              <Image
                src={modalImage}
                alt="Preview"
                width={200}
                height={200}
                className="w-full h-[400px] object-contain rounded-lg border border-gray-200"
              />
            </div>
          </div>
        )}

        {/* Add Driver Modal */}
        {isAddDriverModalOpen && (
          // <div className="fixed inset-0 z-50 flex items-center justify-center  bg-opacity-50 p-4">
          //   <motion.div
          //     className="bg-white rounded-lg w-full max-w-3xl shadow-xl overflow-auto max-h-[90vh]"
          //     initial={{ opacity: 0, scale: 0.9 }}
          //     animate={{ opacity: 1, scale: 1 }}
          //     transition={{ duration: 0.3 }}
          //   >
          //     <div className="flex justify-between items-center p-6 border-b border-gray-200">
          //       <h2 className="text-2xl font-semibold text-gray-900">Add New Driver</h2>
          //       <button
          //         onClick={() => setIsAddDriverModalOpen(false)}
          //         className="text-gray-400 hover:text-gray-600 transition-colors"
          //       >
          //         <FiX size={24} />
          //       </button>
          //     </div>

          //     <div className="p-6">
          //       {addDriverErrors.apiError && (
          //         <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700">
          //           {addDriverErrors.apiError}
          //         </div>
          //       )}

          //       <form onSubmit={handleAddDriverSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
          //         {[
          //           { name: "name", icon: FiUser, placeholder: "Full Name" },
          //           { name: "email", icon: FiMail, placeholder: "Email Address", type: "email" },
          //           { name: "phone", icon: FiPhone, placeholder: "Phone Number" },
          //           { name: "licenseNo", icon: FiCreditCard, placeholder: "License Number" },
          //           { name: "adharNo", icon: FiFileText, placeholder: "Aadhar Number (12 digits)" },
          //         ].map((field) => (
          //           <div key={field.name} className="relative">
          //             <label className="block text-sm font-medium mb-2 text-gray-700">
          //               {field.placeholder}
          //             </label>
          //             <div className="relative">
          //               <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400">
          //                 <field.icon />
          //               </span>
          //               <input
          //                 type={field.type || "text"}
          //                 name={field.name}
          //                 placeholder={field.placeholder}
          //                 className="w-full p-3 pl-10 bg-white text-gray-900 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-400 focus:border-transparent"
          //                 onChange={handleAddDriverChange}
          //                 value={addDriverFormData[field.name]}
          //               />
          //             </div>
          //             {addDriverErrors[field.name] && (
          //               <p className="text-red-500 text-sm mt-1">{addDriverErrors[field.name]}</p>
          //             )}
          //           </div>
          //         ))}

          //         <div className="col-span-1 md:col-span-2">
          //           <label className="block text-sm font-medium mb-2 text-gray-700">
          //             Driver Profile Image
          //           </label>
          //           <label
          //             htmlFor="profileInput"
          //             className="flex items-center gap-3 w-full p-4 bg-gray-50 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:bg-gray-100 transition-colors"
          //           >
          //             <FiImage className="text-xl text-gray-400" />
          //             <span className="text-gray-600">
          //               {profileImageName || "Choose profile image"}
          //             </span>
          //           </label>
          //           <input
          //             type="file"
          //             id="profileInput"
          //             accept="image/*"
          //             onChange={handleImageChange}
          //             className="hidden"
          //           />
          //           {addDriverErrors.profileImage && (
          //             <p className="text-red-500 text-sm mt-1">{addDriverErrors.profileImage}</p>
          //           )}
          //         </div>

          //         <div className="col-span-1 md:col-span-2">
          //           <label className="block text-sm font-medium mb-2 text-gray-700">
          //             License Image
          //           </label>
          //           <label
          //             htmlFor="licenseInput"
          //             className="flex items-center gap-3 w-full p-4 bg-gray-50 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:bg-gray-100 transition-colors"
          //           >
          //             <FiImage className="text-xl text-gray-400" />
          //             <span className="text-gray-600">
          //               {licenseImageName || "Choose license image"}
          //             </span>
          //           </label>
          //           <input
          //             type="file"
          //             id="licenseInput"
          //             accept="image/*"
          //             onChange={handleLicenseImageChange}
          //             className="hidden"
          //           />
          //           {addDriverErrors.licenseImage && (
          //             <p className="text-red-500 text-sm mt-1">{addDriverErrors.licenseImage}</p>
          //           )}
          //         </div>

          //         <div className="col-span-1 md:col-span-2">
          //           <label className="block text-sm font-medium mb-2 text-gray-700">
          //             Aadhaar Image
          //           </label>
          //           <label
          //             htmlFor="adharInput"
          //             className="flex items-center gap-3 w-full p-4 bg-gray-50 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:bg-gray-100 transition-colors"
          //           >
          //             <FiImage className="text-xl text-gray-400" />
          //             <span className="text-gray-600">
          //               {adharImageName || "Choose Aadhaar image"}
          //             </span>
          //           </label>
          //           <input
          //             type="file"
          //             id="adharInput"
          //             accept="image/*"
          //             onChange={handleAdharImageChange}
          //             className="hidden"
          //           />
          //           {addDriverErrors.adharImage && (
          //             <p className="text-red-500 text-sm mt-1">{addDriverErrors.adharImage}</p>
          //           )}
          //         </div>

          //         <div className="col-span-1 md:col-span-2 flex justify-end gap-3 mt-4">
          //           <button
          //             type="button"
          //             onClick={() => setIsAddDriverModalOpen(false)}
          //             className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
          //           >
          //             Cancel
          //           </button>
          //           <button
          //             type="submit"
          //             className="px-6 py-2 bg-yellow-400 hover:bg-yellow-500 text-black rounded-lg transition-colors font-medium"
          //             disabled={addDriverLoading}
          //           >
          //             {addDriverLoading ? "Adding Driver..." : "Add Driver"}
          //           </button>
          //         </div>
          //       </form>
          //     </div>
          //   </motion.div>
          // </div>
          <div>
     <AddDriver 
  isOpen={isAddDriverModalOpen}
  onClose={() => setIsAddDriverModalOpen(false)}
  onDriverAdded={fetchDrivers}
/>
          </div>
          
        )}
      </div>
    </div>
  )
}

export default Driver