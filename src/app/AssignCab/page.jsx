"use client"
import { useState, useEffect, useRef, useCallback } from "react"
import axios from "axios"
import Sidebar from "../slidebar/page"

import { motion } from "framer-motion"

import {
  FaCar,
  FaClipboardList,
  FaCalendarAlt,
  FaUpload,
  FaPlus,
  FaUser,
  FaMapMarkerAlt,
  FaRoute,
  FaTaxi,
  FaClock,
  FaRoad,
  FaDollarSign,
  FaStickyNote,
  FaMobileAlt,
} from "react-icons/fa"
import baseURL from "@/utils/api"
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

export default function AssignCab() {
  const router = useRouter()
  const [showAccessDenied, setShowAccessDenied] = useState(false)
  // SSR-safe initial state; hydrate from cache after mount
  const [drivers, setDrivers] = useState([])
  const [cabs, setCabs] = useState([])
  const [selectedDriver, setSelectedDriver] = useState("")
  const [selectedCab, setSelectedCab] = useState("")
  const [message, setMessage] = useState("")
  const [loading, setLoading] = useState(true)
  const [showAddCabForm, setShowAddCabForm] = useState(false)
  const [driverCash, setDriverCash] = useState({ cashOnHand: 0, loading: false, lastUpdated: null, error: null })
  const [lastCashUpdateLabel, setLastCashUpdateLabel] = useState(null)
  const [showCashSubmitModal, setShowCashSubmitModal] = useState(false)
  const [cashSubmitAmount, setCashSubmitAmount] = useState("")
  // Prevent duplicate booking submissions
  const [assigning, setAssigning] = useState(false)
  const assigningRef = useRef(false)

  // Trip assignment fields with added city and state
  const [tripData, setTripData] = useState({
    customerName: "",
    customerPhone: "",
    pickupLocation: "",
    pickupCity: "",
    pickupState: "",
    dropLocation: "",
    dropCity: "",
    dropState: "",
    optionalPickupLocations: [],
    optionalDropLocations: [],
    tripType: "One Way",
    vehicleType: "Sedan",
    scheduledPickupTime: "",
    estimatedDistance: "",
    estimatedFare: "",
    specialInstructions: "",
    duration: "",
    adminNotes: "",
  })

  const [cabFormData, setCabFormData] = useState({
    cabNumber: "",
    imei: "",
    insuranceNumber: "",
    insuranceExpiry: "",
    registrationNumber: "",
    cabImage: null,
    addedBy: "",
  })

  const [cabFormErrors, setCabFormErrors] = useState({})
  const [cabFormSuccess, setCabFormSuccess] = useState("")

  // Refs for Google Maps Autocomplete
  const pickupInputRef = useRef(null)
  const dropInputRef = useRef(null)
  const optionalPickupRefs = useRef([])
  const optionalDropRefs = useRef([])
  const optionalPickupAC = useRef([])
  const optionalDropAC = useRef([])
  // Temporary flag to disable optional Places while investigating TDZ error
  const ENABLE_OPTIONAL_PLACES = true
  const [autocompleteLoaded, setAutocompleteLoaded] = useState(false)
  const [shouldLoadPlaces, setShouldLoadPlaces] = useState(false)
  const [loadingPlaces, setLoadingPlaces] = useState(false)
  // Dynamic optional stops handlers (moved up to avoid TDZ in effects below)
  const [optionalPickupCount, setOptionalPickupCount] = useState(0)
  const [optionalDropCount, setOptionalDropCount] = useState(0)

  // Lazily load Google Maps script only when user interacts with location fields
  useEffect(() => {
    if (!shouldLoadPlaces) return
    const loadGoogleMaps = () => {
      if (window.google) {
        console.log("✅ Google Maps script already loaded")
        setAutocompleteLoaded(true)
        return
      }
      setLoadingPlaces(true)
      const script = document.createElement("script")
      script.src = `https://maps.googleapis.com/maps/api/js?key=AIzaSyAKjmBSUJ3XR8uD10vG2ptzqLJAZnOlzqI&libraries=places`
      script.async = true
      script.defer = true
      script.onload = () => {
        console.log("✅ Google Maps script loaded successfully")
        setAutocompleteLoaded(true)
        setLoadingPlaces(false)
      }
      script.onerror = () => {
        console.error("❌ Failed to load Google Maps script")
        setMessage("Failed to load location services. Please try again.")
        setLoadingPlaces(false)
      }
      document.head.appendChild(script)
    }
    loadGoogleMaps()
  }, [shouldLoadPlaces])

  // Initialize Google Maps Autocomplete
  useEffect(() => {
    if (autocompleteLoaded && pickupInputRef.current && dropInputRef.current) {
      const pickupAutocomplete = new window.google.maps.places.Autocomplete(pickupInputRef.current, {
        types: ["geocode"],
        componentRestrictions: { country: "in" },
      })
      const dropAutocomplete = new window.google.maps.places.Autocomplete(dropInputRef.current, {
        types: ["geocode"],
        componentRestrictions: { country: "in" },
      })

      pickupAutocomplete.addListener("place_changed", () => {
        const place = pickupAutocomplete.getPlace()
        console.log("📍 Pickup Place Response:", place)
        if (place.formatted_address && place.geometry) {
          const city = place.address_components?.find((comp) =>
            comp.types.includes("locality") || comp.types.includes("administrative_area_level_2")
          )?.long_name || ""
          const state = place.address_components?.find((comp) =>
            comp.types.includes("administrative_area_level_1")
          )?.long_name || ""
          const lat = place.geometry.location.lat()
          const lng = place.geometry.location.lng()
          setTripData((prev) => ({
            ...prev,
            pickupLocation: place.formatted_address,
            pickupCity: city,
            pickupState: state,
            pickupLatitude: lat,
            pickupLongitude: lng,
          }))
          console.log(`✅ Pickup: ${place.formatted_address}, City: ${city}, State: ${state}, Coords: ${lat}, ${lng}`)
        } else {
          console.log("⚠️ No formatted address or geometry found for pickup location")
        }
      })

      dropAutocomplete.addListener("place_changed", () => {
        const place = dropAutocomplete.getPlace()
        console.log("📍 Drop Place Response:", place)
        if (place.formatted_address && place.geometry) {
          const city = place.address_components?.find((comp) =>
            comp.types.includes("locality") || comp.types.includes("administrative_area_level_2")
          )?.long_name || ""
          const state = place.address_components?.find((comp) =>
            comp.types.includes("administrative_area_level_1")
          )?.long_name || ""
          const lat = place.geometry.location.lat()
          const lng = place.geometry.location.lng()
          setTripData((prev) => ({
            ...prev,
            dropLocation: place.formatted_address,
            dropCity: city,
            dropState: state,
            dropLatitude: lat,
            dropLongitude: lng,
          }))
          console.log(`✅ Drop: ${place.formatted_address}, City: ${city}, State: ${state}, Coords: ${lat}, ${lng}`)
        } else {
          console.log("⚠️ No formatted address or geometry found for drop location")
        }
      })
    }
  }, [autocompleteLoaded])

  // Initialize Autocomplete for dynamic optional inputs
  useEffect(() => {
    try {
      if (!ENABLE_OPTIONAL_PLACES) return
      if (typeof window === 'undefined' || !autocompleteLoaded || !window.google || !window.google.maps || !window.google.maps.places) return

    // Normalize refs to current counts to avoid stale indexes
    optionalPickupRefs.current.length = optionalPickupCount
    optionalDropRefs.current.length = optionalDropCount

    // Trim AC instances when counts decrease
    optionalPickupAC.current = (optionalPickupAC.current || []).slice(0, optionalPickupCount)
    optionalDropAC.current = (optionalDropAC.current || []).slice(0, optionalDropCount)

    const setupAC = (el, idx, store, setArray) => {
      if (!el || store[idx]) return
      if (!(el instanceof HTMLInputElement)) return
      try {
        const ac = new window.google.maps.places.Autocomplete(el, {
          types: ["geocode"],
          componentRestrictions: { country: "in" },
        })
        ac.addListener("place_changed", () => {
          const place = ac.getPlace()
          const addr = place?.formatted_address || el.value || ""
          setTripData(prev => {
            const arr = [...(prev[setArray] || [])]
            arr[idx] = addr
            return { ...prev, [setArray]: arr }
          })
        })
        store[idx] = ac
      } catch (e) {
        console.warn('Autocomplete init failed for', setArray, idx, e)
      }
    }

    // Defer to next frame to ensure inputs are mounted
    const rafId = window.requestAnimationFrame(() => {
      optionalPickupRefs.current.forEach((el, i) => setupAC(el, i, optionalPickupAC.current, 'optionalPickupLocations'))
      optionalDropRefs.current.forEach((el, i) => setupAC(el, i, optionalDropAC.current, 'optionalDropLocations'))
    })

    return () => {
      if (rafId) cancelAnimationFrame(rafId)
    }
    } catch (e) {
      console.warn('Optional Places setup skipped due to runtime error', e)
    }
  }, [autocompleteLoaded, optionalPickupCount, optionalDropCount])

  useEffect(() => {
    if (typeof window !== "undefined") {
      const addedBy = localStorage.getItem("id") || ""
      setCabFormData((prev) => ({ ...prev, addedBy }))
    }
  }, [])

  useEffect(() => {
    const fetchData = async () => {
      // Only block with loading when there is no cache available
      const hasCache = typeof window !== 'undefined' && localStorage.getItem('cache:freeCabsAndDrivers')
      try {
        if (!hasCache) setLoading(true)
        const token = localStorage.getItem("token")
        if (!token) return

        const res = await axios.get(`${baseURL}api/assigncab/freeCabsAndDrivers`, {
          headers: { Authorization: `Bearer ${token}` },
        })

        console.log("📊 API Response:", res.data)
        console.log("📊 Free Drivers:", res.data.freeDrivers)
        console.log("📊 Free Cabs:", res.data.freeCabs)

        setDrivers(res.data.freeDrivers || [])
        setCabs(res.data.freeCabs || [])
        try { localStorage.setItem('cache:freeCabsAndDrivers', JSON.stringify(res.data)) } catch {}
      } catch (error) {
        console.error("Error fetching data:", error)
        setMessage("Failed to load data.")
      } finally {
        // Always end loading state after attempt to fetch
        setLoading(false)
      }
    }
    fetchData()
  }, [cabFormSuccess])

  // Fetch selected driver's cash on hand for quick visibility
  const fetchDriverCash = useCallback(
    async (showLoading = true) => {
      if (!selectedDriver) {
        setDriverCash({ cashOnHand: 0, loading: false, lastUpdated: null, error: null })
        return
      }

      try {
        if (showLoading) {
          setDriverCash((prev) => ({ ...prev, loading: true, error: null }))
        }

        const token = localStorage.getItem("token")
        if (!token) {
          setDriverCash({ cashOnHand: 0, loading: false, lastUpdated: null, error: "Missing authentication token" })
          return
        }

        const res = await axios.get(`${baseURL}api/assigncab/cash/driver/${selectedDriver}`, {
          headers: { Authorization: `Bearer ${token}` },
        })

        const cashOnHand = Number(res.data?.cashOnHand || 0)
        const displayCash = Math.max(0, cashOnHand)

        const updatedAt = new Date().toISOString()
        setDriverCash({
          cashOnHand: displayCash,
          loading: false,
          lastUpdated: updatedAt,
          error: null,
        })
        setLastCashUpdateLabel(new Date(updatedAt).toLocaleTimeString())
      } catch (e) {
        console.error("Failed to fetch driver cash summary", e)
        setDriverCash({ cashOnHand: 0, loading: false, lastUpdated: null, error: "Unable to fetch driver cash" })
        setLastCashUpdateLabel(null)
      }
    },
    [selectedDriver],
  )

  useEffect(() => {
    if (!selectedDriver) {
      setDriverCash({ cashOnHand: 0, loading: false, lastUpdated: null, error: null })
      setLastCashUpdateLabel(null)
      return
    }

    fetchDriverCash()
    const intervalId = setInterval(() => {
      fetchDriverCash(false)
    }, 15000)

    return () => {
      clearInterval(intervalId)
    }
  }, [selectedDriver, fetchDriverCash])

  const handleAssign = async () => {
    console.log("🚀 Starting cab assignment process...")
    if (assigningRef.current) {
      console.log("⏳ Assignment in progress - ignoring duplicate click")
      return
    }

    console.log("Selected Driver ID:", selectedDriver)
    console.log("Selected Cab ID:", selectedCab)
    console.log("Trip Data:", tripData)

    // Enhanced validation
    if (!selectedDriver || selectedDriver === "") {
      console.log("❌ Validation failed: No driver selected")
      setMessage("⚠️ Please select a driver.")
      return
    }

    if (!selectedCab || selectedCab === "") {
      console.log("❌ Validation failed: No cab selected")
      setMessage("⚠️ Please select a cab.")
      return
    }

    if (!tripData.customerName.trim()) {
      console.log("❌ Validation failed: Missing customer name")
      setMessage("⚠️ Please enter customer name.")
      return
    }

    if (!tripData.customerPhone.trim()) {
      console.log("❌ Validation failed: Missing customer phone")
      setMessage("⚠️ Please enter customer phone number.")
      return
    }

    if (!tripData.pickupLocation.trim()) {
      console.log("❌ Validation failed: Missing pickup location")
      setMessage("⚠️ Please enter pickup location.")
      return
    }

    if (!tripData.dropLocation.trim()) {
      console.log("❌ Validation failed: Missing drop location")
      setMessage("⚠️ Please enter drop location.")
      return
    }

    try {
      const token = localStorage.getItem("token")
      const assignedBy = localStorage.getItem("id")

      console.log("🔐 Authentication check:")
      console.log("Token exists:", !!token)
      console.log("Assigned By ID:", assignedBy)

      if (!token || !assignedBy) {
        console.log("❌ Authentication failed")
        setMessage("⚠️ Authentication failed. Please log in again.")
        return
      }

      const selectedDriverObj = drivers.find((driver) => driver.id.toString() === selectedDriver.toString())
      const selectedCabObj = cabs.find((cab) => cab.id.toString() === selectedCab.toString())

      console.log("🔍 Selected Driver Object:", selectedDriverObj)
      console.log("🔍 Selected Cab Object:", selectedCabObj)

      if (!selectedDriverObj) {
        console.log("❌ Driver object not found")
        console.log(
          "Available drivers:",
          drivers.map((d) => ({ id: d.id, name: d.name })),
        )
        setMessage("⚠️ Selected driver not found. Please refresh and try again.")
        return
      }

      if (!selectedCabObj) {
        console.log("❌ Cab object not found")
        console.log(
          "Available cabs:",
          cabs.map((c) => ({ id: c.id, cabNumber: c.cabNumber })),
        )
        setMessage("⚠️ Selected cab not found. Please refresh and try again.")
        return
      }

      // Updated payload with city, state, and coordinates
      const payload = {
        driverId: selectedDriverObj.id,
        cabNumber: selectedCabObj.cabNumber,
        assignedBy: Number.parseInt(assignedBy),
        customerName: tripData.customerName.trim(),
        customerPhone: tripData.customerPhone.trim(),
        pickupLocation: tripData.pickupLocation.trim(),
        pickupCity: tripData.pickupCity.trim(),
        pickupState: tripData.pickupState.trim(),
        pickupLatitude: tripData.pickupLatitude ? Number.parseFloat(tripData.pickupLatitude) : null,
        pickupLongitude: tripData.pickupLongitude ? Number.parseFloat(tripData.pickupLongitude) : null,
        dropLocation: tripData.dropLocation.trim(),
        dropCity: tripData.dropCity.trim(),
        dropState: tripData.dropState.trim(),
        dropLatitude: tripData.dropLatitude ? Number.parseFloat(tripData.dropLatitude) : null,
        dropLongitude: tripData.dropLongitude ? Number.parseFloat(tripData.dropLongitude) : null,
        optionalPickupLocations: (tripData.optionalPickupLocations || []).filter(Boolean),
        optionalDropLocations: (tripData.optionalDropLocations || []).filter(Boolean),
        tripType: tripData.tripType,
        vehicleType: tripData.vehicleType,
        duration: tripData.duration ? Number.parseFloat(tripData.duration) : 0,
        estimatedDistance: tripData.estimatedDistance ? Number.parseFloat(tripData.estimatedDistance) : 0,
        estimatedFare: tripData.estimatedFare ? Number.parseFloat(tripData.estimatedFare) : 0,
        scheduledPickupTime: tripData.scheduledPickupTime
          ? new Date(tripData.scheduledPickupTime).toISOString()
          : new Date().toISOString(),
        specialInstructions: tripData.specialInstructions.trim() || "",
        adminNotes: tripData.adminNotes.trim() || "",
      }

      console.log("📤FINAL Payload being sent:", payload)

      // Additional validation
      if (!payload.driverId) {
        console.log("❌ Driver ID is still null/undefined")
        setMessage("⚠️ Driver ID not found. Please refresh and try again.")
        return
      }

      if (!payload.cabNumber) {
        console.log("❌ Cab number is still empty")
        setMessage("⚠️ Cab number not found. Please refresh and try again.")
        return
      }

      console.log("📡 Sending request to:", `${baseURL}api/assigncab`)
      // set mutex just before sending request
      assigningRef.current = true
      setAssigning(true)

      const response = await axios.post(`${baseURL}api/assigncab`, payload, {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      })

      console.log("✅ Assignment successful!", response.data)

      setMessage("✅ Cab assigned successfully!")
      try {
        const created = response?.data?.assignment || response?.data || null
        const createdId = created?.id ?? created?.assignmentId ?? null
        if (createdId) {
          sessionStorage.setItem('flash:newAssignmentId', String(createdId))
        }
      } catch {}
      // Navigate to bookings list where newest appear on top
      router.push('/CabInfo')

      // Reset form
      setSelectedDriver("")
      setSelectedCab("")
      setTripData({
        customerName: "",
        customerPhone: "",
        pickupLocation: "",
        pickupCity: "",
        pickupState: "",
        dropLocation: "",
        dropCity: "",
        dropState: "",
        optionalPickupLocations: [],
        optionalDropLocations: [],
        tripType: "One Way",
        vehicleType: "Sedan",
        scheduledPickupTime: "",
        estimatedDistance: "",
        estimatedFare: "",
        specialInstructions: "",
        duration: "",
        adminNotes: "",
      })
      setOptionalPickupCount(0)
      setOptionalDropCount(0)

      console.log("🔄 Form reset completed")
      setTimeout(() => setMessage(""), 3000)

      // Refresh available drivers and cabs
      const token2 = localStorage.getItem("token")
      const res = await axios.get(`${baseURL}api/assigncab/freeCabsAndDrivers`, {
        headers: { Authorization: `Bearer ${token2}` },
      })
      setDrivers(res.data.freeDrivers || [])
      setCabs(res.data.freeCabs || [])
    } catch (error) {
      console.error("❌ Assignment failed:", error.response?.data || error.message)
      const errorMessage = error.response?.data?.message || error.response?.data?.error || "Error assigning cab."
      setMessage(`❌ ${errorMessage}`)
    } finally {
      assigningRef.current = false
      setAssigning(false)
    }
  }

  const handleTripDataChange = (e) => {
    const { name, value } = e.target
    console.log(`📝 Trip data updated - ${name}:`, value)
    // Prevent onChange from overriding Autocomplete input
    // if (name === "pickupLocation" && !pickupInputRef.current?.value) return
    // if (name === "dropLocation" && !dropInputRef.current?.value) return
    setTripData((prev) => ({ ...prev, [name]: value }))
  }

  // Dynamic optional stops handlers

  const handleOptionalCountChange = (type, count) => {
    const n = Math.max(0, Number.parseInt(count || 0))
    if (type === 'pickup') {
      setOptionalPickupCount(n)
      setTripData(prev => {
        const arr = Array.from({ length: n }, (_, i) => prev.optionalPickupLocations[i] || "")
        return { ...prev, optionalPickupLocations: arr }
      })
    } else {
      setOptionalDropCount(n)
      setTripData(prev => {
        const arr = Array.from({ length: n }, (_, i) => prev.optionalDropLocations[i] || "")
        return { ...prev, optionalDropLocations: arr }
      })
    }
  }

  const handleOptionalInputChange = (type, index, value) => {
    setTripData(prev => {
      const key = type === 'pickup' ? 'optionalPickupLocations' : 'optionalDropLocations'
      const next = [...(prev[key] || [])]
      next[index] = value
      return { ...prev, [key]: next }
    })
  }

  const handleCabFormChange = (e) => {
    const { name, value, files } = e.target
    const updatedValue = name === "cabImage" ? files[0] : value
    setCabFormData({ ...cabFormData, [name]: updatedValue })
    setCabFormErrors({ ...cabFormErrors, [name]: "" })
  }

  const validateCabForm = () => {
    const errors = {}
    const cabNumberTrimmed = cabFormData.cabNumber.replace(/\s/g, "")
    if (!cabNumberTrimmed) errors.cabNumber = "Cab Number is required"
    else if (cabNumberTrimmed.length < 6 || cabNumberTrimmed.length > 12) errors.cabNumber = "Invalid Cab Number"
    setCabFormErrors(errors)
    return Object.keys(errors).length === 0
  }

  //   setLoading(true)
  //   setCabFormSuccess("")

  //   try {
  //     const token = localStorage.getItem("token")
  //     const formData = new FormData()
  //     Object.entries(cabFormData).forEach(([key, value]) => {
  //       formData.append(key, value)
  //     })

  //     const res = await fetch(`${baseURL}api/cabDetails/add`, {
  //       method: "PATCH",
  //       headers: { Authorization: `Bearer ${token}` },
  //       body: formData,
  //     })

  //     const data = await res.json()
  //     if (res.ok) {
  //       setCabFormSuccess("Cab added successfully!")
  //       setCabFormData({
  //         cabNumber: "",
  //         imei: "",  
  //         insuranceNumber: "",
  //         insuranceExpiry: "",
  //         registrationNumber: "",
  //         cabImage: null,
  //         addedBy: localStorage.getItem("id") || "",
  //       })
  //       setTimeout(() => setShowAddCabForm(false), 1500)
  //     } else {
  //       setCabFormErrors({ apiError: data.error || "Cab Already Exists" })
  //     }
  //   } catch (error) {
  //     setCabFormErrors({ apiError: "Server error, try again later" })
  //   } finally {
  //     setLoading(false)
  //   }
  // }

  const handleAddCabSubmit = async (e) => {
    e.preventDefault();
    if (!validateCabForm()) return;

    setLoading(true);
    setCabFormSuccess("");

    try {
      const token = localStorage.getItem("token");
      const formData = new FormData();
      Object.entries(cabFormData).forEach(([key, value]) => {
        formData.append(key, value);
      });

      const res = await fetch(`${baseURL}api/cabDetails/add`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });

      const data = await res.json();

      if (res.ok) {
        setCabFormSuccess("Cab added successfully!");
        setCabFormData({
          cabNumber: "",
          imei: "",
          insuranceNumber: "",
          insuranceExpiry: "",
          registrationNumber: "",
          cabImage: null,
          addedBy: localStorage.getItem("id") || "",
        });
        setTimeout(() => setShowAddCabForm(false), 1500);
      } else {
        // Handle specific error cases from backend
        if (res.status === 403) {
          // Show the exact error message from backend
          setCabFormErrors({ apiError: data.message || "Access denied" });
        } else if (res.status === 400) {
          setCabFormErrors({ apiError: data.message || "Cab Already Exists" });
        } else {
          setCabFormErrors({ apiError: data.error || "Failed to add cab" });
        }
      }
    } catch (error) {
      setCabFormErrors({ apiError: "Server error, try again later" });
    } finally {
      setLoading(false);
    }
  };

  const handleOpenCashSubmit = () => {
    setCashSubmitAmount("")
    setShowCashSubmitModal(true)
  }

  const handleSubmitCashAmount = async () => {
    const amountNumber = Number(cashSubmitAmount)
    if (!selectedDriver) {
      setMessage("⚠️ Please select a driver first.")
      return
    }
    if (!Number.isFinite(amountNumber) || amountNumber <= 0) {
      setMessage("⚠️ Please enter a valid cash amount.")
      return
    }

    try {
      const token = typeof window !== "undefined" ? localStorage.getItem("token") : null
      if (!token) {
        setMessage("⚠️ Authentication failed. Please log in again.")
        return
      }

      const res = await axios.post(
        `${baseURL}api/assigncab/cash/submit`,
        {
          driverId: selectedDriver,
          amount: amountNumber,
        },
        {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        },
      )

      const newCashOnHand = Number(res.data?.cashOnHand ?? res.data?.newCashOnHand ?? 0)
      setDriverCash((prev) => ({
        ...prev,
        cashOnHand: Math.max(0, Number.isFinite(newCashOnHand) ? newCashOnHand : prev.cashOnHand),
      }))
      const now = new Date()
      setLastCashUpdateLabel(now.toLocaleTimeString())
      setShowCashSubmitModal(false)
      setMessage("✅ Cash submitted successfully.")
      setTimeout(() => setMessage(""), 3000)
    } catch (error) {
      console.error("Error submitting driver cash:", error)
      const errorMessage = error.response?.data?.message || error.response?.data?.error || "Failed to submit cash."
      setMessage(`❌ ${errorMessage}`)
    }
  }

  useEffect(() => {
    const checkUserStatus = async () => {
      try {
        const id = localStorage.getItem("id")
        if (!id) return router.push("/")

        const res = await axios.get(`${baseURL}api/admin/getAllSubAdmins`)
        const user = res.data.subAdmins.find((e) => e._id === id)
        if (user?.status === "Inactive") {
          localStorage.clear()
          setShowAccessDenied(true)
        }
      } catch (err) {
        console.error("Error checking user status:", err)
      }
    }
    checkUserStatus()
  }, [router])

  if (loading) {
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
    <motion.div
      className="flex min-h-screen bg-gray-50"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.8 }}
    >
      <Sidebar />
      <div className="flex-1 p-4 md:p-6 md:mt-0 md:ml-60 mt-20 sm:mt-0 transition-all duration-300">
        {showAccessDenied && <AccessDeniedModal />}

        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900 mb-2">Assign Cab</h1>
          <p className="text-gray-600">Assign drivers to cabs and manage trip details</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Trip Assignment Form */}
          <motion.div
            className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm"
            initial={{ y: -50, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ duration: 0.8 }}
          >
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-semibold text-gray-900">Trip Assignment</h2>
              <button
                onClick={() => setShowAddCabForm(true)}
                className="flex items-center text-sm bg-yellow-500 hover:bg-yellow-600 text-white px-3 py-2 rounded-lg transition-colors"
              >
                <FaPlus className="mr-2" /> Add New Cab
              </button>
            </div>

            {loading ? (
              <div className="flex justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-yellow-500"></div>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Customer Details */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      <FaUser className="inline mr-2" />
                      Customer Name *
                    </label>
                    <input
                      type="text"
                      name="customerName"
                      value={tripData.customerName}
                      onChange={handleTripDataChange}
                      className="w-full border border-gray-300 rounded-lg px-3 text-black py-2 focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500"
                      placeholder="Enter customer name"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Customer Phone *</label>
                    <input
                      type="tel"
                      name="customerPhone"
                      value={tripData.customerPhone}
                      onChange={handleTripDataChange}
                      className="w-full border border-gray-300 text-black rounded-lg px-3 py-2 focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500"
                      placeholder="Enter phone number"
                      required
                    />
                  </div>
                </div>

                {/* Location Details */}
                {/* Row 1: Pickup and Drop */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      <FaMapMarkerAlt className="inline mr-2 text-green-500" />
                      Pickup Location *
                    </label>
                    <input
                      type="text"
                      name="pickupLocation"
                      ref={pickupInputRef}
                      value={tripData.pickupLocation}
                      onChange={handleTripDataChange}
                      onFocus={() => setShouldLoadPlaces(true)}
                      className="w-full border border-gray-300 text-black rounded-lg px-3 py-2 focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500"
                      placeholder={
                        autocompleteLoaded
                          ? "Enter pickup location"
                          : loadingPlaces
                            ? "Loading location suggestions..."
                            : "Enter pickup location (suggestions load on focus)"
                      }
                      required
                    />
                    {tripData.pickupCity && tripData.pickupState && (
                      <p className="text-xs text-gray-500 mt-1">
                        City: {tripData.pickupCity}, State: {tripData.pickupState}
                      </p>
                    )}
                    {!autocompleteLoaded && loadingPlaces && (
                      <p className="text-xs text-yellow-600 mt-1">Loading location suggestions...</p>
                    )}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      <FaMapMarkerAlt className="inline mr-2 text-red-500" />
                      Drop Location *
                    </label>
                    <input
                      type="text"
                      name="dropLocation"
                      ref={dropInputRef}
                      value={tripData.dropLocation}
                      onChange={handleTripDataChange}
                      onFocus={() => setShouldLoadPlaces(true)}
                      className="w-full border border-gray-300 text-black rounded-lg px-3 py-2 focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500"
                      placeholder={
                        autocompleteLoaded
                          ? "Enter drop location"
                          : loadingPlaces
                            ? "Loading location suggestions..."
                            : "Enter drop location (suggestions load on focus)"
                      }
                      required
                    />
                    {tripData.dropCity && tripData.dropState && (
                      <p className="text-xs text-gray-500 mt-1">
                        City: {tripData.dropCity}, State: {tripData.dropState}
                      </p>
                    )}
                    {!autocompleteLoaded && loadingPlaces && (
                      <p className="text-xs text-yellow-600 mt-1">Loading location suggestions...</p>
                    )}
                  </div>
                </div>

                {/* Row 2: counts and dynamic optional fields */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Optional pickups */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">How many optional pickups?</label>
                    <input
                      type="number"
                      min={0}
                      value={optionalPickupCount}
                      onChange={(e) => handleOptionalCountChange('pickup', e.target.value)}
                      className="w-full border border-gray-300 text-black rounded-lg px-3 py-2 focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500"
                      placeholder="0"
                    />
                    {optionalPickupCount > 0 && (
                      <div className="space-y-2 mt-2">
                        <div className="grid grid-cols-1 gap-3">
                          {Array.from({ length: optionalPickupCount }).map((_, i) => (
                            <div key={`op-p-wrap-${i}`} className="space-y-1">
                              <label className="block text-xs text-gray-600">Optional Pickup {i + 1}</label>
                              <input
                                type="text"
                                ref={(el) => (optionalPickupRefs.current[i] = el)}
                                value={tripData.optionalPickupLocations[i] || ""}
                                onChange={(e) => handleOptionalInputChange('pickup', i, e.target.value)}
                                onFocus={() => setShouldLoadPlaces(true)}
                                className="w-full border border-gray-300 text-black rounded-lg px-3 py-2 focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500"
                                placeholder={
                                  autocompleteLoaded
                                    ? `Search optional pickup ${i + 1}`
                                    : loadingPlaces
                                      ? "Loading location suggestions..."
                                      : `Optional Pickup ${i + 1}`
                                }
                              />
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Optional drops */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">How many optional drops?</label>
                    <input
                      type="number"
                      min={0}
                      value={optionalDropCount}
                      onChange={(e) => handleOptionalCountChange('drop', e.target.value)}
                      className="w-full border border-gray-300 text-black rounded-lg px-3 py-2 focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500"
                      placeholder="0"
                    />
                    {optionalDropCount > 0 && (
                      <div className="space-y-2 mt-2">
                        <div className="grid grid-cols-1 gap-3">
                          {Array.from({ length: optionalDropCount }).map((_, i) => (
                            <div key={`op-d-wrap-${i}`} className="space-y-1">
                              <label className="block text-xs text-gray-600">Optional Drop {i + 1}</label>
                              <input
                                type="text"
                                ref={(el) => (optionalDropRefs.current[i] = el)}
                                value={tripData.optionalDropLocations[i] || ""}
                                onChange={(e) => handleOptionalInputChange('drop', i, e.target.value)}
                                onFocus={() => setShouldLoadPlaces(true)}
                                className="w-full border border-gray-300 text-black rounded-lg px-3 py-2 focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500"
                                placeholder={
                                  autocompleteLoaded
                                    ? `Search optional drop ${i + 1}`
                                    : loadingPlaces
                                      ? "Loading location suggestions..."
                                      : `Optional Drop ${i + 1}`
                                }
                              />
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Trip Type and Vehicle Type */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      <FaRoute className="inline mr-2" />
                      Trip Type
                    </label>
                    <select
                      name="tripType"
                      value={tripData.tripType}
                      onChange={handleTripDataChange}
                      className="w-full border text-black border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500"
                    >
                      <option value="One Way">One Way</option>
                      <option value="Round Trip">Round Trip</option>
                      <option value="Hourly">Hourly</option>
                      <option value="Daily">Daily</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      <FaTaxi className="inline mr-2" />
                      Vehicle Type
                    </label>
                    <select
                      name="vehicleType"
                      value={tripData.vehicleType}
                      onChange={handleTripDataChange}
                      className="w-full border border-gray-300 text-black rounded-lg px-3 py-2 focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500"
                    >
                      <option value="Sedan">Sedan</option>
                      <option value="SUV">SUV</option>
                      <option value="Hatchback">Hatchback</option>
                      <option value="Luxury">Luxury</option>
                    </select>
                  </div>
                </div>

                {/* Scheduled Time and Trip Details */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      <FaClock className="inline mr-2" />
                      Scheduled Pickup Time
                    </label>
                    <input
                      type="datetime-local"
                      name="scheduledPickupTime"
                      value={tripData.scheduledPickupTime}
                      onChange={handleTripDataChange}
                      className="w-full border border-gray-300 text-black rounded-lg px-3 py-2 focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      <FaRoad className="inline mr-2" />
                      Estimated Distance (km)
                    </label>
                    <input
                      type="number"
                      name="estimatedDistance"
                      value={tripData.estimatedDistance}
                      onChange={handleTripDataChange}
                      className="w-full border border-gray-300 text-black rounded-lg px-3 py-2 focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500"
                      placeholder="Enter distance in km"
                      min="0"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      <FaDollarSign className="inline mr-2" />
                      Estimated Fare
                    </label>
                    <input
                      type="number"
                      name="estimatedFare"
                      value={tripData.estimatedFare}
                      onChange={handleTripDataChange}
                      className="w-full border border-gray-300 text-black rounded-lg px-3 py-2 focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500"
                      placeholder="Enter estimated fare"
                      min="0"
                      step="0.01"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      <FaClock className="inline mr-2" />
                      Duration (hours)
                    </label>
                    <input
                      type="number"
                      name="duration"
                      value={tripData.duration}
                      onChange={handleTripDataChange}
                      className="w-full border border-gray-300 text-black rounded-lg px-3 py-2 focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500"
                      placeholder="Enter trip duration in hours"
                      min="0"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      <FaStickyNote className="inline mr-2" />
                      Special Instructions
                    </label>
                    <input
                      type="text"
                      name="specialInstructions"
                      value={tripData.specialInstructions}
                      onChange={handleTripDataChange}
                      className="w-full border border-gray-300 text-black rounded-lg px-3 py-2 focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500"
                      placeholder="Any special instructions"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      <FaStickyNote className="inline mr-2" />
                      Admin Notes
                    </label>
                    <input
                      type="text"
                      name="adminNotes"
                      value={tripData.adminNotes}
                      onChange={handleTripDataChange}
                      className="w-full border border-gray-300 text-black rounded-lg px-3 py-2 focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500"
                      placeholder="Admin notes (optional)"
                    />
                  </div>
                </div>

                {/* Driver and Cab Selection */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Select Driver *</label>
                    <select
                      className="w-full border border-gray-300 text-black rounded-lg px-3 py-2 focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500"
                      value={selectedDriver}
                      onChange={(e) => {
                        const driverId = e.target.value
                        console.log("🚗 Driver selected - Raw value:", driverId)
                        const driverObj = drivers.find((driver) => driver.id.toString() === driverId.toString())
                        console.log("🚗 Driver object found:", driverObj)
                        setSelectedDriver(driverId)
                      }}
                      required
                    >
                      <option value="">Choose a driver</option>
                      {drivers.length > 0 ? (
                        drivers.map((driver) => (
                          <option key={driver.id} value={driver.id}>
                            {driver.name} - {driver.licenseNumber}
                          </option>
                        ))
                      ) : (
                        <option disabled>No drivers available</option>
                      )}
                    </select>
                    {selectedDriver && (
                      <div className="mt-2 flex flex-col gap-1 text-sm text-gray-700 bg-yellow-50 border border-yellow-200 rounded-md px-3 py-2">
                        <div className="flex items-center justify-between gap-2">
                          <span className="inline-block w-2 h-2 bg-yellow-500 rounded-full"></span>
                          <div className="flex-1">
                            {driverCash.loading ? (
                              <span>Checking cash on hand...</span>
                            ) : driverCash.error ? (
                              <span className="text-red-600">{driverCash.error}</span>
                            ) : (
                              <span>
                                Cash on Hand: <span className="font-semibold">₹{driverCash.cashOnHand?.toLocaleString?.() || driverCash.cashOnHand}</span>
                              </span>
                            )}
                          </div>
                          <button
                            type="button"
                            onClick={() => fetchDriverCash()}
                            className="text-xs font-medium text-yellow-700 hover:text-yellow-800 border border-yellow-300 rounded px-2 py-1"
                            disabled={driverCash.loading}
                          >
                            Refresh
                          </button>
                        </div>
                        {!driverCash.loading && !driverCash.error && lastCashUpdateLabel && (
                          <div className="mt-1 flex items-center justify-between gap-2">
                            <button
                              type="button"
                              onClick={handleOpenCashSubmit}
                              className="text-xs font-medium text-yellow-700 hover:text-yellow-800 border border-yellow-300 rounded px-2 py-1"
                            >
                              Cash Submit
                            </button>
                            <span className="text-xs text-gray-500 text-right">Updated at {lastCashUpdateLabel}</span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Select Cab *</label>
                    <select
                      className="w-full border border-gray-300 text-black rounded-lg px-3 py-2 focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500"
                      value={selectedCab}
                      onChange={(e) => {
                        const cabId = e.target.value
                        console.log("🚕 Cab selected - Raw value:", cabId)
                        const cabObj = cabs.find((cab) => cab.id.toString() === cabId.toString())
                        console.log("🚕 Cab object found:", cabObj)
                        setSelectedCab(cabId)
                      }}
                      required
                    >
                      <option value="">Choose a cab</option>
                      {cabs.length > 0 ? (
                        cabs.map((cab) => (
                          <option key={cab.id} value={cab.id}>
                            {cab.cabNumber} - {cab.model || ""}
                          </option>
                        ))
                      ) : (
                        <option disabled>No cabs available</option>
                      )}
                    </select>
                  </div>
                </div>

                <button
                  onClick={handleAssign}
                  disabled={assigning}
                  aria-busy={assigning}
                  className={`w-full px-4 py-3 rounded-lg transition-colors duration-300 font-medium ${assigning ? 'bg-yellow-300 cursor-not-allowed' : 'bg-yellow-500 hover:bg-yellow-600 text-white'}`}
                >
                  {assigning ? 'Assigning…' : 'Assign Cab & Create Trip'}
                </button>

                {message && (
                  <motion.p
                    className={`mt-4 text-center font-medium text-sm md:text-base ${message.startsWith("✅")
                        ? "text-green-600"
                        : message.startsWith("⚠️")
                          ? "text-yellow-600"
                          : "text-red-600"
                      }`}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                  >
                    {message}
                  </motion.p>
                )}
              </div>
            )}
          </motion.div>

          {/* Quick Stats */}
          <motion.div
            className="space-y-4"
            initial={{ y: -50, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ duration: 0.8, delay: 0.2 }}
          >
            <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Available Resources</h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="text-center">
                  <div className="text-2xl font-bold text-yellow-600">{drivers.length}</div>
                  <div className="text-sm text-gray-600">Free Drivers</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-yellow-600">{cabs.length}</div>
                  <div className="text-sm text-gray-600">Free Cabs</div>
                </div>
              </div>
            </div>

            <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Trip Types</h3>
              <div className="space-y-2 text-sm text-gray-600">
                <div className="flex justify-between">
                  <span>One Way</span>
                  <span>Single destination</span>
                </div>
                <div className="flex justify-between">
                  <span>Round Trip</span>
                  <span>Return journey</span>
                </div>
                <div className="flex justify-between">
                  <span>Hourly</span>
                  <span>Time-based booking</span>
                </div>
                <div className="flex justify-between">
                  <span>Daily</span>
                  <span>Full day rental</span>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </div>

      {/* Add Cab Modal */}
      {showAddCabForm && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <motion.div
            className="bg-white rounded-lg p-6 w-full max-w-md shadow-xl"
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
          >
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-bold text-gray-900">Add New Cab</h3>
              <button
                onClick={() => {
                  setShowAddCabForm(false)
                  setCabFormErrors({})
                  setCabFormSuccess("")
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                ✕
              </button>
            </div>

            {cabFormSuccess && <p className="text-green-600 text-center mb-4">{cabFormSuccess}</p>}

            {/* <form onSubmit={handleAddCabSubmit} encType="multipart/form-data">
              {[
                { name: "cabNumber", icon: <FaCar />, placeholder: "Cab Number" },
                { name: "imei", icon: <FaMobileAlt />, placeholder: "IMEI Number" },   // <-- NEW
                { name: "insuranceNumber", icon: <FaClipboardList />, placeholder: "Insurance Number" },
                {name: "insuranceExpiry",icon: <FaCalendarAlt />,placeholder: "Insurance Expiry Date",type: "date",},
                { name: "registrationNumber", icon: <FaClipboardList />, placeholder: "Registration Number" },
              ].map(({ name, icon, placeholder, type = "text" }, index) => (
                <div key={index} className="relative mt-4">
                  <div className="absolute left-3 top-3 text-gray-400">{icon}</div>
                  <input
                    type={type}
                    name={name}
                    placeholder={placeholder}
                    min={name === "insuranceExpiry" ? new Date().toISOString().split("T")[0] : undefined}
                    className="w-full bg-gray-50 text-gray-900 pl-10 p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500"
                    onChange={handleCabFormChange}
                    value={cabFormData[name]}
                  />
                  {cabFormErrors[name] && <p className="text-red-500 text-sm mt-1">{cabFormErrors[name]}</p>}
                </div>
              ))}

              <div className="relative mt-4">
                <FaUpload className="absolute left-3 top-3 text-gray-400" />
                <input
                  type="file"
                  name="cabImage"
                  accept="image/*"
                  className="w-full bg-gray-50 text-gray-900 p-3 pl-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500"
                  onChange={handleCabFormChange}
                />
                {cabFormErrors.cabImage && <p className="text-red-500 text-sm mt-1">{cabFormErrors.cabImage}</p>}
              </div>

              {cabFormErrors.apiError && <p className="text-red-500 text-sm mt-4">{cabFormErrors.apiError}</p>}

              <button
                type="submit"
                className="w-full px-4 py-3 bg-yellow-500 hover:bg-yellow-600 text-white rounded-lg mt-4 font-medium transition-colors"
                disabled={loading}
              >
                {loading ? "Adding..." : "Add Cab"}
              </button>
            </form> */}

            <form onSubmit={handleAddCabSubmit} encType="multipart/form-data">
              {[
                { name: "cabNumber", icon: <FaCar />, placeholder: "Cab Number" },
                { name: "imei", icon: <FaMobileAlt />, placeholder: "IMEI Number" },
                { name: "insuranceNumber", icon: <FaClipboardList />, placeholder: "Insurance Number" },
                { name: "insuranceExpiry", icon: <FaCalendarAlt />, placeholder: "Insurance Expiry Date", type: "date" },
                { name: "registrationNumber", icon: <FaClipboardList />, placeholder: "Registration Number" },
              ].map(({ name, icon, placeholder, type = "text" }, index) => (
                <div key={index} className="relative mt-4">
                  <div className="absolute left-3 top-3 text-gray-400">{icon}</div>
                  <input
                    type={type}
                    name={name}
                    placeholder={placeholder}
                    min={name === "insuranceExpiry" ? new Date().toISOString().split("T")[0] : undefined}
                    className="w-full bg-gray-50 text-gray-900 pl-10 p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500"
                    onChange={handleCabFormChange}
                    value={cabFormData[name]}
                  />
                  {cabFormErrors[name] && <p className="text-red-500 text-sm mt-1">{cabFormErrors[name]}</p>}
                </div>
              ))}

              <div className="relative mt-4">
                <FaUpload className="absolute left-3 top-3 text-gray-400" />
                <input
                  type="file"
                  name="cabImage"
                  accept="image/*"
                  className="w-full bg-gray-50 text-gray-900 p-3 pl-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500"
                  onChange={handleCabFormChange}
                />
                {cabFormErrors.cabImage && <p className="text-red-500 text-sm mt-1">{cabFormErrors.cabImage}</p>}
              </div>

              {/* Keep apiError here ONLY ONCE - after all fields */}
              {cabFormErrors.apiError && <p className="text-red-500 text-sm mt-4">{cabFormErrors.apiError}</p>}

              <button
                type="submit"
                className="w-full px-4 py-3 bg-yellow-500 hover:bg-yellow-600 text-white rounded-lg mt-4 font-medium transition-colors"
                disabled={loading}
              >
                {loading ? "Adding..." : "Add Cab"}
              </button>
            </form>

          </motion.div>
        </div>
      )}

      {showCashSubmitModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <motion.div
            className="bg-white rounded-lg p-6 w-full max-w-sm shadow-xl"
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
          >
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold text-gray-900">Submit Cash</h3>
              <button
                onClick={() => setShowCashSubmitModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                ✕
              </button>
            </div>

            <label className="block text-sm font-medium text-gray-700 mb-2">Cash Amount</label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={cashSubmitAmount}
              onChange={(e) => setCashSubmitAmount(e.target.value)}
              className="w-full border border-gray-300 text-black rounded-lg px-3 py-2 focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500"
              placeholder="Enter amount to submit"
            />

            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                className="px-4 py-2 text-sm border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
                onClick={() => setShowCashSubmitModal(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="px-4 py-2 text-sm bg-yellow-500 hover:bg-yellow-600 text-white rounded-lg"
                onClick={handleSubmitCashAmount}
              >
                Submit
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </motion.div>
  )
}