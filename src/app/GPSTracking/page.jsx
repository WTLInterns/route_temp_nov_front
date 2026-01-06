"use client"

import { useState, useEffect, useRef } from "react"
import {
  Search,
  Settings,
  Bell,
  Home,
  ChevronRight,
  Car,
  Share,
  Phone,
  MessageCircle,
  X,
  Truck,
  Route,
  AlertTriangle,
  Menu,
  Zap,
  MapPin,
  CheckCircle,
} from "lucide-react"
import Sidebar from "../slidebar/page"

// Function to convert decimal coordinates to DMS format (degrees, minutes, seconds)
const convertToDMS = (coordinate, isLatitude) => {
  const absolute = Math.abs(coordinate)
  const degrees = Math.floor(absolute)
  const minutesNotTruncated = (absolute - degrees) * 60
  const minutes = Math.floor(minutesNotTruncated)
  const seconds = ((minutesNotTruncated - minutes) * 60).toFixed(1)

  const direction = isLatitude ? (coordinate >= 0 ? "N" : "S") : coordinate >= 0 ? "E" : "W"

  return `${degrees}°${minutes}'${seconds}"${direction}`
}

// Enhanced Google Maps Component with custom markers
const GoogleMapsComponent = ({ cabs, selectedCab, onCabSelect }) => {
  const mapRef = useRef(null)
  const mapInstanceRef = useRef(null)
  const markersRef = useRef([])
  const [isClient, setIsClient] = useState(false)
  const [isGoogleMapsLoaded, setIsGoogleMapsLoaded] = useState(false)

  // Persistent location storage using sessionStorage
  const getStoredLocation = (imei) => {
    try {
      const stored = sessionStorage.getItem(`location_${imei}`)
      return stored ? JSON.parse(stored) : null
    } catch {
      return null
    }
  }

  const storeLocation = (imei, location) => {
    try {
      sessionStorage.setItem(
        `location_${imei}`,
        JSON.stringify({
          lat: location.lat,
          lng: location.lng,
          timestamp: Date.now(),
        }),
      )
    } catch (error) {
      console.warn("Failed to store location:", error)
    }
  }

  const lastKnownLocations = new Map()

  useEffect(() => {
    setIsClient(true)
  }, [])

  useEffect(() => {
    if (!isClient) return

    const loadGoogleMaps = () => {
      if (window.google && window.google.maps) {
        setIsGoogleMapsLoaded(true)
        initializeMap()
        return
      }

      const script = document.createElement("script")
      script.src = `https://maps.googleapis.com/maps/api/js?key=AIzaSyAKjmBSUJ3XR8uD10vG2ptzqLJAZnOlzqI&libraries=geometry`
      script.async = true
      script.defer = true
      script.onload = () => {
        setIsGoogleMapsLoaded(true)
        initializeMap()
      }
      script.onerror = () => {
        console.error("Failed to load Google Maps")
      }
      document.head.appendChild(script)
    }

    const initializeMap = () => {
      if (!mapRef.current) return

      const map = new window.google.maps.Map(mapRef.current, {
        zoom: 13,
        center: { lat: 18.5204, lng: 73.8567 },
        styles: [
          {
            featureType: "poi",
            elementType: "labels",
            stylers: [{ visibility: "off" }],
          },
          {
            featureType: "water",
            elementType: "geometry",
            stylers: [{ color: "#e9e9e9" }, { lightness: 17 }],
          },
          {
            featureType: "landscape",
            elementType: "geometry",
            stylers: [{ color: "#f5f5f5" }, { lightness: 20 }],
          },
        ],
        mapTypeControl: false,
        streetViewControl: false,
        fullscreenControl: false,
      })

      mapInstanceRef.current = map
      createMarkers()
    }

    loadGoogleMaps()

    return () => {
      markersRef.current.forEach((marker) => marker.setMap(null))
      markersRef.current = []
    }
  }, [isClient])

  useEffect(() => {
    if (mapInstanceRef.current && isGoogleMapsLoaded) {
      createMarkers()
    }
  }, [cabs, selectedCab, isGoogleMapsLoaded])

  const createMarkers = () => {
    if (!mapInstanceRef.current || !cabs || cabs.length === 0 || !window.google) return

    markersRef.current.forEach((marker) => marker.setMap(null))
    markersRef.current = []

    cabs.forEach((cab) => {
      const isSelected = selectedCab?.id === cab.id

      // Use current location, fallback to sessionStorage, then lastKnownLocations
      let currentLocation = cab.location
      if (
        !currentLocation ||
        typeof currentLocation.lat !== "number" ||
        typeof currentLocation.lng !== "number" ||
        !isFinite(currentLocation.lat) ||
        !isFinite(currentLocation.lng)
      ) {
        currentLocation = getStoredLocation(cab.imei)

        if (!currentLocation) {
          currentLocation = lastKnownLocations.get(cab.id)
        }
      } else {
        lastKnownLocations.set(cab.id, currentLocation)
        storeLocation(cab.imei, currentLocation)
      }

      if (!currentLocation) return

      // Get vehicle icon based on status and heading
      const getVehicleIcon = (status, ignition, isSelected, heading = 0) => {
        let iconUrl

        // Choose icon based on vehicle status and selection
        if (isSelected) {
          // Use car icon for selected cab
          iconUrl = "https://maps.google.com/mapfiles/kml/shapes/cabs.png"
        } else {
          // For non-selected cabs, use status-based icons
          if (!ignition) {
            iconUrl = "https://maps.google.com/mapfiles/kml/shapes/caution.png" // Caution for ignition OFF
          } else if (status === "Moving") {
            iconUrl = "https://maps.google.com/mapfiles/kml/shapes/cabs.png" // Cab for moving
          } else if (status === "Idle") {
            iconUrl = "https://maps.google.com/mapfiles/kml/shapes/parking_lot.png" // Parking for idle
          } else {
            iconUrl = "https://maps.google.com/mapfiles/kml/shapes/truck.png" // Default
          }
        }

        return {
          url: iconUrl,
          scaledSize: new window.google.maps.Size(isSelected ? 40 : 32, isSelected ? 40 : 32),
          origin: new window.google.maps.Point(0, 0),
          anchor: new window.google.maps.Point(isSelected ? 20 : 16, isSelected ? 20 : 16),
        }
      }

      const marker = new window.google.maps.Marker({
        position: currentLocation,
        map: mapInstanceRef.current,
        icon: getVehicleIcon(cab.status, cab.ignition, isSelected, cab.heading || 0),
        title: cab.cabNumber,
        zIndex: isSelected ? 1000 : 1,
        animation: isSelected ? window.google.maps.Animation.BOUNCE : null,
      })

      // Enhanced info window with professional styling
      const ignitionStatus = cab.ignition ? "ON" : "OFF"
      const ignitionColor = cab.ignition ? "#10B981" : "#EF4444"

      const infoWindow = new window.google.maps.InfoWindow({
        content: `
          <div style="padding: 16px; min-width: 280px; font-family: 'Inter', sans-serif;">
            <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px;">
              <div style="font-weight: 700; font-size: 18px; color: #1F2937;">${cab.cabNumber}</div>
              <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 4px 12px; border-radius: 20px; font-size: 12px; font-weight: 600;">
                ${cab.speed || 0} km/h
              </div>
            </div>
            
            <div style="color: #6B7280; margin-bottom: 12px; font-size: 14px;">
              <div style="display: flex; align-items: center; margin-bottom: 4px;">
                <span style="margin-right: 8px;">👤</span>
                <span>Driver: ${cab.driverName || "N/A"}</span>
              </div>
            </div>
            
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
              <span style="padding: 6px 12px; border-radius: 16px; font-size: 12px; font-weight: 600;
                 background: ${cab.status === "Moving" ? "linear-gradient(135deg, #10B981, #059669)" : cab.status === "Idle" ? "linear-gradient(135deg, #F59E0B, #D97706)" : "linear-gradient(135deg, #6B7280, #4B5563)"};
                color: white; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                ${cab.status}
              </span>
            </div>
            
            <div style="display: flex; align-items: center; margin-bottom: 12px; padding: 8px; background: ${cab.ignition ? "#F0FDF4" : "#FEF2F2"}; border-radius: 8px;">
              <span style="margin-right: 8px; font-size: 16px;">${cab.ignition ? "🔥" : "⚫"}</span>
              <span style="font-size: 13px; color: ${ignitionColor}; font-weight: 600;">
                Ignition: ${ignitionStatus}
              </span>
            </div>
            
            <div style="display: flex; align-items: center; justify-content: space-between;">
              <div style="font-size: 11px; color: #9CA3AF;">
                📍 ${currentLocation.lat.toFixed(6)}, ${currentLocation.lng.toFixed(6)}
              </div>
              ${cab.lastUpdated ? `<div style="font-size: 10px; color: #9CA3AF;">${new Date(cab.lastUpdated).toLocaleTimeString()}</div>` : ""}
            </div>
          </div>
        `,
      })

      marker.addListener("click", () => {
        markersRef.current.forEach((m) => {
          if (m.infoWindow) m.infoWindow.close()
        })
        infoWindow.open(mapInstanceRef.current, marker)
        onCabSelect(cab)
        if (currentLocation) mapInstanceRef.current.panTo(currentLocation)
      })

      marker.infoWindow = infoWindow

      if (isSelected) {
        infoWindow.open(mapInstanceRef.current, marker)
        if (currentLocation) {
          mapInstanceRef.current.panTo(currentLocation)
        }
      }

      markersRef.current.push(marker)
    })
  }

  if (!isClient) {
    return (
      <div className="w-full h-full relative">
        <div className="w-full h-full rounded-xl bg-gradient-to-br from-gray-100 to-gray-200 animate-pulse"></div>
      </div>
    )
  }

  return (
    <div className="w-full h-full relative">
      <div ref={mapRef} className="w-full h-full rounded-xl shadow-lg" style={{ minHeight: "350px" }} />

      {/* Enhanced floating controls */}
      <div className="absolute top-4 right-4 flex flex-col space-y-3">
        {selectedCab && (
          <button
            onClick={() => {
              if (mapInstanceRef.current && selectedCab && isGoogleMapsLoaded) {
                const location =
                  selectedCab.location || getStoredLocation(selectedCab.imei) || lastKnownLocations.get(selectedCab.id)
                if (location) {
                  mapInstanceRef.current.panTo(location)
                  mapInstanceRef.current.setZoom(16)
                }
              }
            }}
            className="bg-white backdrop-blur-sm bg-opacity-90 text-blue-600 shadow-lg rounded-xl px-4 py-3 text-sm font-semibold hover:bg-blue-50 transition-all duration-200 border border-blue-100 hover:shadow-xl transform hover:scale-105"
            disabled={!isGoogleMapsLoaded}
          >
            <div className="flex items-center space-x-2">
              <MapPin size={16} />
              <span>Center View</span>
            </div>
          </button>
        )}
      </div>

      {/* Enhanced status legend */}
      <div className="absolute bottom-4 left-4 bg-white backdrop-blur-sm bg-opacity-95 shadow-xl rounded-xl p-4 border border-gray-100">
        <div className="text-sm font-bold text-gray-900 mb-3 flex items-center">
          <Route className="mr-2" size={16} />
          Status Legend
        </div>
        <div className="space-y-2">
          <div className="flex items-center space-x-3">
            <div className="w-4 h-4 rounded-full bg-gradient-to-r from-green-400 to-green-600 shadow-sm"></div>
            <span className="text-xs text-gray-700 font-medium">Moving (Ignition ON)</span>
          </div>
          <div className="flex items-center space-x-3">
            <div className="w-4 h-4 rounded-full bg-gradient-to-r from-yellow-400 to-yellow-600 shadow-sm"></div>
            <span className="text-xs text-gray-700 font-medium">Idle/Ignition OFF</span>
          </div>
          <div className="flex items-center space-x-3">
            <div className="w-4 h-4 rounded-full bg-gradient-to-r from-gray-400 to-gray-600 shadow-sm"></div>
            <span className="text-xs text-gray-700 font-medium">Parked</span>
          </div>
        </div>
      </div>

      {!isGoogleMapsLoaded && (
        <div className="absolute inset-0 bg-gradient-to-br from-gray-100 to-gray-200 rounded-xl flex items-center justify-center">
          <div className="text-center">
            <div className="w-20 h-20 bg-gradient-to-br from-blue-400 to-blue-600 rounded-full flex items-center justify-center mx-auto mb-4 animate-pulse shadow-lg">
              <Route className="w-10 h-10 text-white" />
            </div>
            <p className="text-gray-700 font-semibold text-lg">Loading Maps...</p>
            <p className="text-gray-500 text-sm">Initializing GPS tracking</p>
          </div>
        </div>
      )}
    </div>
  )
}

const DynamicGPSTracking = () => {
  const [activeTab, setActiveTab] = useState("Cabs")
  const [searchTerm, setSearchTerm] = useState("")
  const [selectedCab, setSelectedCab] = useState(null)
  const [sortBy, setSortBy] = useState("Cab ID")
  const [showShareModal, setShowShareModal] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [copySuccess, setCopySuccess] = useState(false)

  const [cabs, setCabs] = useState([])
  const [drivers, setDrivers] = useState([])
  const [assignments, setAssignments] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  // WebSocket state with better tracking
  const [wsConnected, setWsConnected] = useState(false)
  const [wsError, setWsError] = useState(null)
  const [reconnectAttempts, setReconnectAttempts] = useState(0)
  const wsRef = useRef(null)
  const reconnectTimeoutRef = useRef(null)

  const API_BASE_URL = "https://api.routebudget.com/api"
  // Single WebSocket server (attached to HTTP server). Allow override via env.
  const WS_URL = "wss://api.routebudget.com"

  const getAuthHeaders = () => {
    const token = localStorage.getItem("token")
    if (!token) {
      throw new Error("No authentication token found. Please log in again.")
    }

    return {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    }
  }

  // Enhanced WebSocket initialization with ignition and speed handling
  const initializeWebSocket = () => {
    if (wsRef.current) {
      wsRef.current.close()
      wsRef.current = null
    }

    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current)
      reconnectTimeoutRef.current = null
    }

    try {
      console.log(`🔌 Attempting WebSocket connection to ${WS_URL}...`)
      console.log(`📡 Attempt #${reconnectAttempts + 1}`)

      const ws = new WebSocket(WS_URL)

      const connectionTimeout = setTimeout(() => {
        if (ws.readyState === WebSocket.CONNECTING) {
          console.log("⏰ WebSocket connection timeout")
          ws.close()
        }
      }, 10000)

      ws.onopen = () => {
        clearTimeout(connectionTimeout)
        console.log("✅ WebSocket connected successfully!")
        setWsConnected(true)
        setWsError(null)
        setReconnectAttempts(0)

        const validCabs = cabs.filter((cab) => cab.imei)
        console.log(`📡 Subscribing to ${validCabs.length} cab IMEIs:`)

        validCabs.forEach((cab) => {
          const subscribeMessage = JSON.stringify({ type: "subscribe_imei", imei: cab.imei })
          ws.send(subscribeMessage)
          console.log(`   ✓ Subscribed to IMEI: ${cab.imei} (${cab.cabNumber})`)
        })

        if (validCabs.length === 0) {
          console.log("⚠️  No valid IMEIs found to subscribe to")
        }
      }

      ws.onmessage = (event) => {
        console.log("📨 Raw WebSocket message received:", event.data)

        try {
          const gpsData = JSON.parse(event.data)
          console.log("🛰️  Parsed GPS Data:", gpsData)

          if (gpsData.type === "subscription_confirmed") {
            console.log(`✅ Subscription confirmed for IMEI ${gpsData.imei}`)
            return
          }

          if (gpsData.type !== "gps_update") {
            console.warn("⚠️  Ignoring unknown message type", gpsData.type)
            return
          }

          if (!gpsData.imei || gpsData.lat === undefined || gpsData.lon === undefined) {
            console.warn("⚠️  Invalid GPS data structure:", gpsData)
            return
          }

          // Enhanced: Update cab location with ignition and speed from WebSocket
          setCabs((prevCabs) => {
            const updatedCabs = prevCabs.map((cab) => {
              if (cab.imei === gpsData.imei) {
                console.log(`🎯 Updating cab ${cab.cabNumber} (${gpsData.imei}):`)
                console.log(`   📍 Old position: ${cab.location?.lat}, ${cab.location?.lng}`)
                console.log(`   📍 New position: ${gpsData.lat}, ${gpsData.lon}`)

                const newLocation = {
                  lat: gpsData.lat,
                  lng: gpsData.lon,
                }

                // Store location in sessionStorage for persistence
                try {
                  sessionStorage.setItem(
                    `location_${cab.imei}`,
                    JSON.stringify({
                      ...newLocation,
                      timestamp: Date.now(),
                    }),
                  )
                } catch (error) {
                  console.warn("Failed to store location:", error)
                }

                // Enhanced status determination based on ignition and speed from WebSocket
                const speed = gpsData.speed || 0
                const ignition = gpsData.ignition !== undefined ? gpsData.ignition : true

                let newStatus = "Parked"
                if (!ignition) {
                  newStatus = "Idle" // If ignition is off, always idle regardless of speed
                } else if (speed > 5) {
                  newStatus = "Moving"
                } else if (speed > 0) {
                  newStatus = "Idle"
                } else {
                  newStatus = "Parked"
                }

                const updatedCab = {
                  ...cab,
                  location: newLocation,
                  speed: speed,
                  ignition: ignition, // Add ignition status from WebSocket
                  status: newStatus,
                  heading: gpsData.heading || 0, // Add heading for marker rotation
                  lastUpdated: new Date().toISOString(),
                  hasGPSData: true,
                }

                console.log(`   ✅ Updated cab data:`, {
                  cabNumber: updatedCab.cabNumber,
                  speed: updatedCab.speed,
                  ignition: updatedCab.ignition,
                  status: updatedCab.status,
                })

                return updatedCab
              }
              return cab
            })

            return updatedCabs
          })
        } catch (parseError) {
          console.error("❌ Error parsing GPS data:", parseError)
          console.error("📋 Raw data that failed to parse:", event.data)
        }
      }

      ws.onclose = (event) => {
        clearTimeout(connectionTimeout)
        console.log(`🔌 WebSocket disconnected. Code: ${event.code}, Reason: ${event.reason}`)
        setWsConnected(false)

        if (reconnectAttempts < 5) {
          const delay = Math.min(1000 * Math.pow(2, reconnectAttempts), 30000)
          console.log(`🔄 Scheduling reconnection attempt ${reconnectAttempts + 1} in ${delay}ms`)

          reconnectTimeoutRef.current = setTimeout(() => {
            setReconnectAttempts((prev) => prev + 1)
            if (cabs.length > 0) {
              initializeWebSocket()
            }
          }, delay)
        } else {
          console.log("❌ Max reconnection attempts reached")
          setWsError("Failed to connect after multiple attempts")
        }
      }

      ws.onerror = (error) => {
        clearTimeout(connectionTimeout)
        console.error("❌ WebSocket error:", error)
        setWsConnected(false)
        setWsError("WebSocket connection error")
      }

      wsRef.current = ws
    } catch (err) {
      console.error("❌ Failed to initialize WebSocket:", err)
      setWsConnected(false)
      setWsError(err.message)
    }
  }

  const reconnectWebSocket = () => {
    console.log("🔄 Manual WebSocket reconnection triggered")
    setReconnectAttempts(0)
    setWsError(null)
    initializeWebSocket()
  }

  // Fetch data from APIs
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true)
      setError(null)

      try {
        const token = localStorage.getItem("token")
        if (!token) {
          throw new Error("Authentication token not found. Please log in again.")
        }

        const headers = getAuthHeaders()

        const [cabsResponse, driversResponse, assignmentsResponse] = await Promise.all([
          fetch(`${API_BASE_URL}/cabDetails`, {
            method: "GET",
            headers: headers,
          }),
          fetch(`${API_BASE_URL}/driver/profile`, {
            method: "GET",
            headers: headers,
          }),
          fetch(`${API_BASE_URL}/assigncab`, {
            method: "GET",
            headers: headers,
          }),
        ])

        if (cabsResponse.status === 401 || driversResponse.status === 401 || assignmentsResponse.status === 401) {
          localStorage.removeItem("token")
          throw new Error("Authentication failed. Please log in again.")
        }

        if (!cabsResponse.ok || !driversResponse.ok || !assignmentsResponse.ok) {
          throw new Error("Failed to fetch data from one or more APIs")
        }

        const cabsData = await cabsResponse.json()
        const driversData = await driversResponse.json()
        const assignmentsData = await assignmentsResponse.json()

        console.log("📊 Fetched data:", {
          cabs: cabsData.length,
          drivers: driversData.length,
          assignments: assignmentsData.assignments?.length || 0,
        })

        const processedCabs = processCabData(cabsData, driversData, assignmentsData)

        setCabs(processedCabs)
        setDrivers(driversData)
        setAssignments(assignmentsData)
      } catch (err) {
        console.error("Error fetching data:", err)
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }

    fetchData()

    const interval = setInterval(fetchData, 30000)
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    if (cabs.length > 0 && !wsRef.current) {
      console.log(`🚀 Initializing WebSocket with ${cabs.length} cabs`)
      initializeWebSocket()
    }

    return () => {
      if (wsRef.current) {
        console.log("🧹 Cleaning up WebSocket connection")
        wsRef.current.close()
        wsRef.current = null
      }

      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current)
        reconnectTimeoutRef.current = null
      }
    }
  }, [cabs.length])

  // Enhanced process cab data to include ignition status and persistent location
  const processCabData = (cabsData, driversData, assignmentsData) => {
    return cabsData.map((cab) => {
      const assignmentList = assignmentsData.assignments || []
      const assignment = assignmentList.find((assign) => assign.cabId === cab.id)

      let driverName = "Unassigned"
      if (assignment?.driverId) {
        const driver = driversData.find((d) => d.id === assignment.driverId)
        driverName = driver?.name || "Unknown Driver"
      }

      // Enhanced location handling with sessionStorage fallback
      let location = null
      let hasGPSData = false
      let status = "Parked"

      if (cab.lastKnownLat && cab.lastKnownLng) {
        location = {
          lat: Number.parseFloat(cab.lastKnownLat),
          lng: Number.parseFloat(cab.lastKnownLng),
        }
        hasGPSData = true
        status = "Parked"

        if (cab.lastGPSUpdate) {
          const lastUpdate = new Date(cab.lastGPSUpdate)
          const now = new Date()
          const hoursOld = (now - lastUpdate) / (1000 * 60 * 60)

          if (hoursOld > 24) {
            status = "GPS Stale"
          }
        }
      } else {
        // Fallback to stored location if no current GPS
        const storedLocation = sessionStorage.getItem(`location_${cab.imei}`)
        if (storedLocation) {
          try {
            location = JSON.parse(storedLocation)
            hasGPSData = true
            status = "Parked" // Default status for stored locations
          } catch (error) {
            console.warn("Failed to parse stored location:", error)
          }
        }
      }

      if (hasGPSData && status !== "GPS Stale") {
        if (assignment) {
          if (assignment.status === "assigned") {
            status = "Idle"
          } else if (assignment.actualPickupTime && !assignment.dropTime) {
            status = "Moving"
          }
        }
      }

      return {
        id: cab.id,
        cabNumber: cab.cabNumber,
        registrationNumber: cab.registrationNumber,
        imei: cab.imei,
        status,
        speed: 0,
        ignition: true, // Default ignition status (will be updated by WebSocket)
        heading: 0, // Default heading
        driverName,
        location,
        isOnTrip: assignment?.actualPickupTime && !assignment?.dropTime,
        assignment,
        insuranceExpiry: cab.insuranceExpiry,
        cabImage: cab.cabImage,
        lastUpdated: cab.lastGPSUpdate || null,
        hasGPSData,
      }
    })
  }

  // Enhanced statistics calculations considering ignition
  const totalCabs = cabs.length
  const onTrip = cabs.filter((cab) => cab.status === "Moving" && cab.ignition).length
  const idle = cabs.filter((cab) => cab.status === "Idle" || !cab.ignition).length
  const issues = cabs.filter((cab) => {
    if (!cab.insuranceExpiry) return false
    const expiryDate = new Date(cab.insuranceExpiry)
    const today = new Date()
    const daysUntilExpiry = Math.ceil((expiryDate - today) / (1000 * 60 * 60 * 24))
    return daysUntilExpiry <= 30
  }).length

  const filteredCabs = cabs.filter(
    (cab) =>
      cab.cabNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      cab.driverName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      cab.registrationNumber.toLowerCase().includes(searchTerm.toLowerCase()),
  )

  const filteredDrivers = drivers.filter(
    (driver) =>
      driver.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      driver.phone.toLowerCase().includes(searchTerm.toLowerCase()) ||
      driver.email.toLowerCase().includes(searchTerm.toLowerCase()),
  )

  const handleShareClick = () => {
    setShowShareModal(true)
  }

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopySuccess(true)
      setTimeout(() => setCopySuccess(false), 2000)
    })
  }

  const handleCabSelect = (cab) => {
    setSelectedCab(cab)
  }

  const handleRetry = () => {
    setError(null)
    window.location.reload()
  }

  return (
    <div className="bg-gradient-to-br from-gray-50 to-gray-100 min-h-screen flex">
      <Sidebar />
      <div className="flex-1 md:ml-64">
        <div className="flex-1 flex flex-col">
          {/* Enhanced Header with professional styling */}
          <div className="bg-white backdrop-blur-sm bg-opacity-95 border-b border-gray-200 px-4 md:px-6 py-4 shadow-sm">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => setSidebarOpen(!sidebarOpen)}
                  className="md:hidden p-2 rounded-lg hover:bg-gray-100 transition-colors"
                >
                  <Menu size={20} />
                </button>
                <div className="hidden md:flex items-center space-x-2 text-sm text-gray-500">
                  <Home size={16} />
                  <ChevronRight size={16} />
                  <span className="font-medium">Live Tracking Dashboard</span>
                </div>
              </div>

              {/* Enhanced WebSocket Status Indicator */}
              <div className="flex items-center space-x-2 md:space-x-4">
                <div className="flex items-center space-x-2 bg-gray-50 rounded-full px-3 py-1">
                  <div
                    className={`w-3 h-3 rounded-full ${wsConnected ? "bg-green-500 animate-pulse" : "bg-red-500"} shadow-sm`}
                  ></div>
                  <span
                    className={`text-xs md:text-sm font-semibold ${wsConnected ? "text-green-700" : "text-red-700"}`}
                  >
                    {wsConnected ? "GPS Live" : "GPS Offline"}
                  </span>
                  {wsError && (
                    <button
                      onClick={reconnectWebSocket}
                      className="text-xs px-2 py-1 bg-red-100 text-red-700 rounded-full hover:bg-red-200 transition-colors font-medium"
                      title={wsError}
                    >
                      Reconnect
                    </button>
                  )}
                </div>
                <div className="relative">
                  <Bell size={20} className="text-gray-400 hover:text-gray-600 cursor-pointer transition-colors" />
                  <div className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full animate-pulse"></div>
                </div>
                <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center shadow-md">
                  <span className="text-white text-sm font-bold">A</span>
                </div>
              </div>
            </div>
          </div>

          <div className="flex-1 flex flex-col md:flex-row">
            {/* Enhanced Left Panel - Professional styling */}
            <div className="w-full md:w-1/2 bg-white md:border-r border-gray-200 flex flex-col max-h-[50vh] md:max-h-none overflow-auto">
              {/* Enhanced Tabs */}
              <div className="flex border-b border-gray-200 bg-gray-50">
                <button
                  onClick={() => setActiveTab("Cabs")}
                  className={`flex-1 px-4 md:px-6 py-3 md:py-4 text-sm font-semibold transition-all duration-200 ${
                    activeTab === "Cabs"
                      ? "text-blue-600 border-b-2 border-blue-600 bg-white"
                      : "text-gray-500 hover:text-gray-700 hover:bg-gray-100"
                  }`}
                >
                  <div className="flex items-center justify-center space-x-2">
                    <Car size={16} />
                    <span>Cabs ({totalCabs})</span>
                  </div>
                </button>
                <button
                  onClick={() => setActiveTab("Drivers")}
                  className={`flex-1 px-4 md:px-6 py-3 md:py-4 text-sm font-semibold transition-all duration-200 ${
                    activeTab === "Drivers"
                      ? "text-blue-600 border-b-2 border-blue-600 bg-white"
                      : "text-gray-500 hover:text-gray-700 hover:bg-gray-100"
                  }`}
                >
                  <div className="flex items-center justify-center space-x-2">
                    <span>👤</span>
                    <span>Drivers ({drivers.length})</span>
                  </div>
                </button>
              </div>

              {/* Search and Stats */}
              <div className="flex-1 p-4 md:p-6 overflow-y-auto">
                <div className="relative mb-4 md:mb-6">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
                  <input
                    type="text"
                    placeholder="Search cabs, drivers, or registration..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-10 pr-10 py-3 border border-gray-300 rounded-xl text-black focus:ring-2 focus:ring-blue-500 focus:border-transparent shadow-sm transition-all duration-200 bg-gray-50 focus:bg-white"
                  />
                  <Settings
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 cursor-pointer transition-colors"
                    size={20}
                  />
                </div>

                {/* Enhanced Statistics Grid with gradients and animations */}
                <div className="grid grid-cols-2 md:grid-cols-2 gap-3 md:gap-4 mb-4 md:mb-6">
                  <div className="bg-gradient-to-br from-yellow-50 to-yellow-100 p-3 md:p-4 rounded-xl shadow-sm hover:shadow-md transition-all duration-200 border border-yellow-200">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-xs md:text-sm text-yellow-700 font-medium">Total Cabs</p>
                        <p className="text-lg md:text-2xl font-bold text-yellow-800">{totalCabs}</p>
                      </div>
                      <div className="p-2 bg-yellow-200 rounded-lg">
                        <Truck className="text-yellow-700" size={20} />
                      </div>
                    </div>
                  </div>

                  <div className="bg-gradient-to-br from-green-50 to-green-100 p-3 md:p-4 rounded-xl shadow-sm hover:shadow-md transition-all duration-200 border border-green-200">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-xs md:text-sm text-green-700 font-medium">Moving</p>
                        <p className="text-lg md:text-2xl font-bold text-green-800">{onTrip}</p>
                      </div>
                      <div className="p-2 bg-green-200 rounded-lg">
                        <Route className="text-green-700" size={20} />
                      </div>
                    </div>
                  </div>

                  <div className="bg-gradient-to-br from-gray-50 to-gray-100 p-3 md:p-4 rounded-xl shadow-sm hover:shadow-md transition-all duration-200 border border-gray-200">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-xs md:text-sm text-gray-700 font-medium">Idle</p>
                        <p className="text-lg md:text-2xl font-bold text-gray-800">{idle}</p>
                      </div>
                      <div className="p-2 bg-gray-200 rounded-lg">
                        <Car className="text-gray-700" size={20} />
                      </div>
                    </div>
                  </div>

                  <div className="bg-gradient-to-br from-red-50 to-red-100 p-3 md:p-4 rounded-xl shadow-sm hover:shadow-md transition-all duration-200 border border-red-200">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-xs md:text-sm text-red-700 font-medium">Issues</p>
                        <p className="text-lg md:text-2xl font-bold text-red-800">{issues}</p>
                      </div>
                      <div className="p-2 bg-red-200 rounded-lg">
                        <AlertTriangle className="text-red-700" size={20} />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Enhanced Sorting */}
                <div className="flex items-center justify-between mb-4 p-3 bg-gray-50 rounded-lg">
                  <span className="text-sm text-gray-600 font-medium">Sort by:</span>
                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value)}
                    className="text-sm border border-gray-300 rounded-lg px-3 py-2 text-black focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white shadow-sm"
                  >
                    <option>Cab ID</option>
                    <option>Driver Name</option>
                    <option>Status</option>
                  </select>
                </div>

                {/* Enhanced List with professional styling */}
                <div className="space-y-3 mb-6">
                  {activeTab === "Cabs"
                    ? filteredCabs.map((cab) => (
                        <div
                          key={cab.id}
                          className={`p-4 border rounded-xl cursor-pointer transition-all duration-200 hover:shadow-lg transform hover:scale-[1.02] ${
                            selectedCab?.id === cab.id
                              ? "border-blue-500 bg-gradient-to-r from-blue-50 to-blue-100 shadow-md"
                              : "border-gray-200 hover:border-gray-300 bg-white hover:bg-gray-50"
                          }`}
                          onClick={() => setSelectedCab(cab)}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-3">
                              <div className="flex flex-col items-center space-y-1">
                                <div
                                  className={`w-4 h-4 rounded-full shadow-sm ${
                                    cab.status === "Moving" && cab.ignition
                                      ? "bg-gradient-to-r from-green-400 to-green-600"
                                      : cab.status === "Idle" || !cab.ignition
                                        ? "bg-gradient-to-r from-yellow-400 to-yellow-600"
                                        : "bg-gradient-to-r from-gray-400 to-gray-600"
                                  }`}
                                />
                                {/* Enhanced ignition indicator */}
                                <div className={`text-sm ${cab.ignition ? "text-green-600" : "text-red-600"}`}>
                                  {cab.ignition ? "🔥" : "⚫"}
                                </div>
                              </div>
                              <div>
                                <p className="font-bold text-gray-900 text-sm md:text-base">{cab.cabNumber}</p>
                                <div className="flex items-center space-x-2">
                                  <span
                                    className={`inline-block px-2 py-1 rounded-full text-xs font-semibold ${
                                      cab.status === "Moving" && cab.ignition
                                        ? "bg-green-100 text-green-800"
                                        : cab.status === "Idle" || !cab.ignition
                                          ? "bg-yellow-100 text-yellow-800"
                                          : "bg-gray-100 text-gray-800"
                                    }`}
                                  >
                                    {cab.status}
                                  </span>
                                </div>
                                <p className="text-xs text-gray-600 font-medium">{cab.driverName}</p>
                                {/* Enhanced info with ignition status */}
                                <div className="flex items-center space-x-2 text-xs text-gray-500 mt-1">
                                  <span className={`font-medium ${cab.ignition ? "text-green-600" : "text-red-600"}`}>
                                    Ignition: {cab.ignition ? "ON" : "OFF"}
                                  </span>
                                  {cab.lastUpdated && <span>• {new Date(cab.lastUpdated).toLocaleTimeString()}</span>}
                                </div>
                              </div>
                            </div>
                            <div className="text-right">
                              <p className="font-bold text-gray-900 text-sm md:text-base">{cab.speed}</p>
                              <p className="text-xs md:text-sm text-gray-500">km/h</p>
                            </div>
                          </div>
                        </div>
                      ))
                    : filteredDrivers.map((driver) => (
                        <div
                          key={driver.id}
                          className="p-4 border border-gray-200 rounded-xl hover:border-gray-300 transition-all duration-200 cursor-pointer hover:shadow-lg bg-white hover:bg-gray-50 transform hover:scale-[1.02]"
                        >
                          <div className="flex items-center space-x-3">
                            <div className="w-10 h-10 rounded-full overflow-hidden bg-gradient-to-br from-blue-400 to-purple-600 flex items-center justify-center shadow-md">
                              {driver.profileImage ? (
                                <img
                                  src={driver.profileImage || "/placeholder.svg"}
                                  alt={driver.name}
                                  className="w-full h-full object-cover"
                                />
                              ) : (
                                <span className="font-bold text-white text-sm">
                                  {driver.name
                                    .split(" ")
                                    .map((n) => n[0])
                                    .join("")
                                    .slice(0, 2)}
                                </span>
                              )}
                            </div>
                            <div className="flex-1">
                              <p className="font-bold text-gray-900 text-sm md:text-base">{driver.name}</p>
                              <p className="text-xs md:text-sm text-gray-600">📞 {driver.phone}</p>
                              <p className="text-xs text-gray-500">🆔 {driver.licenseNo}</p>
                            </div>
                          </div>
                        </div>
                      ))}
                </div>
              </div>

              {/* Enhanced Selected Cab Details Card */}
              {selectedCab && (
                <div className="border-t border-gray-200 p-4 bg-gradient-to-r from-gray-50 to-gray-100">
                  <div className="bg-white rounded-xl p-4 shadow-lg border border-gray-100">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center space-x-2">
                        <div className="p-2 bg-blue-100 rounded-lg">
                          <Car className="text-blue-600" size={18} />
                        </div>
                        <h3 className="font-bold text-gray-900 text-base md:text-lg">{selectedCab.cabNumber}</h3>
                      </div>
                      <div className="flex items-center space-x-1 bg-gradient-to-r from-blue-500 to-purple-600 text-white px-3 py-1 rounded-full">
                        <span className="text-lg md:text-xl font-bold">{selectedCab.speed}</span>
                        <span className="text-xs md:text-sm">km/h</span>
                      </div>
                    </div>

                    <div className="flex items-center space-x-2 mb-3">
                      <div
                        className={`inline-block px-3 py-1 rounded-full text-xs md:text-sm font-semibold ${
                          selectedCab.status === "Moving" && selectedCab.ignition
                            ? "bg-gradient-to-r from-green-100 to-green-200 text-green-800"
                            : selectedCab.status === "Idle" || !selectedCab.ignition
                              ? "bg-gradient-to-r from-yellow-100 to-yellow-200 text-yellow-800"
                              : "bg-gradient-to-r from-gray-100 to-gray-200 text-gray-800"
                        }`}
                      >
                        {selectedCab.status}
                      </div>
                      {/* Enhanced ignition status badge */}
                      <div
                        className={`flex items-center space-x-1 px-3 py-1 rounded-full text-xs font-semibold ${
                          selectedCab.ignition
                            ? "bg-gradient-to-r from-green-100 to-green-200 text-green-800"
                            : "bg-gradient-to-r from-red-100 to-red-200 text-red-800"
                        }`}
                      >
                        <Zap size={12} />
                        <span>Ignition {selectedCab.ignition ? "ON" : "OFF"}</span>
                      </div>
                    </div>

                    <div className="space-y-2 mb-4">
                      <p className="text-gray-700 text-sm">
                        <span className="font-semibold">Driver:</span> {selectedCab.driverName}
                      </p>
                      <p className="text-gray-700 text-sm">
                        <span className="font-semibold">Registration:</span> {selectedCab.registrationNumber}
                      </p>
                      <p className="text-gray-700 text-sm">
                        <span className="font-semibold">IMEI:</span> {selectedCab.imei}
                      </p>
                      {selectedCab.lastUpdated && (
                        <p className="text-gray-700 text-sm">
                          <span className="font-semibold">Last Update:</span>{" "}
                          {new Date(selectedCab.lastUpdated).toLocaleString()}
                        </p>
                      )}
                    </div>

                    <div className="flex space-x-2">
                      <button className="flex items-center space-x-2 px-3 py-2 bg-gradient-to-r from-green-100 to-green-200 hover:from-green-200 hover:to-green-300 rounded-lg transition-all duration-200 transform hover:scale-105">
                        <Phone size={14} />
                        <span className="text-xs md:text-sm font-semibold text-green-800">Call</span>
                      </button>
                      <button className="flex items-center space-x-2 px-3 py-2 bg-gradient-to-r from-blue-100 to-blue-200 hover:from-blue-200 hover:to-blue-300 rounded-lg transition-all duration-200 transform hover:scale-105">
                        <MessageCircle size={14} />
                        <span className="text-xs md:text-sm font-semibold text-blue-800">Message</span>
                      </button>
                      <button
                        onClick={handleShareClick}
                        className="flex items-center space-x-2 px-3 py-2 bg-gradient-to-r from-purple-100 to-purple-200 hover:from-purple-200 hover:to-purple-300 rounded-lg transition-all duration-200 transform hover:scale-105"
                      >
                        <Share size={14} />
                        <span className="text-xs md:text-sm font-semibold text-purple-800">Share</span>
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Right Panel - Enhanced Map Area */}
            <div className="flex-1 p-4 md:p-6 h-[50vh] md:h-auto md:min-h-[calc(100vh-4rem)]">
              <GoogleMapsComponent cabs={cabs} selectedCab={selectedCab} onCabSelect={handleCabSelect} />
            </div>
          </div>
        </div>

        {/* Enhanced Share Modal with Google Maps link */}
        {showShareModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4 backdrop-blur-sm">
            <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full mx-4 p-6 transform transition-all duration-300 scale-100">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-bold text-gray-900 flex items-center">
                  <Share className="mr-2 text-blue-600" size={24} />
                  Share Location
                </h3>
                <button
                  onClick={() => setShowShareModal(false)}
                  className="text-gray-400 hover:text-gray-600 p-1 rounded-full hover:bg-gray-100 transition-colors"
                >
                  <X size={24} />
                </button>
              </div>

              <div className="space-y-6">
                {/* Google Maps Link Section */}
                <div className="p-4 bg-gradient-to-r from-blue-50 to-purple-50 rounded-xl border border-blue-200">
                  <h4 className="font-bold text-gray-900 mb-3 flex items-center">
                    <MapPin className="mr-2 text-blue-600" size={16} />
                    Live Location
                  </h4>
                  <p className="text-sm text-gray-600 mb-3">
                    Current location of <span className="font-semibold">{selectedCab?.cabNumber}</span> with{" "}
                    <span className="font-semibold">{selectedCab?.driverName}</span>
                  </p>

                  {selectedCab?.location && (
                    <div className="space-y-3">
                      {/* Google Maps Link */}
                      <div className="flex items-center space-x-2">
                        <input
                          type="text"
                          value={
                            selectedCab?.location
                              ? `https://www.google.com/maps/place/${convertToDMS(selectedCab.location.lat, true)}+${convertToDMS(selectedCab.location.lng, false)}/@${selectedCab.location.lat},${selectedCab.location.lng},17z`
                              : ""
                          }
                          readOnly
                          className="flex-1 px-3 py-2 border text-black border-gray-300 rounded-lg bg-gray-50 text-sm font-mono overflow-x-auto"
                        />
                        <button
                          onClick={() => {
                            if (selectedCab?.location) {
                              const dmsLat = convertToDMS(selectedCab.location.lat, true)
                              const dmsLng = convertToDMS(selectedCab.location.lng, false)
                              copyToClipboard(
                                `https://www.google.com/maps/place/${dmsLat}+${dmsLng}/@${selectedCab.location.lat},${selectedCab.location.lng},17z`,
                              )
                            }
                          }}
                          className={`px-4 py-2 rounded-lg transition-all duration-200 font-semibold text-sm ${
                            copySuccess ? "bg-green-600 text-white" : "bg-blue-600 text-white hover:bg-blue-700"
                          }`}
                        >
                          {copySuccess ? (
                            <div className="flex items-center space-x-1">
                              <CheckCircle size={16} />
                              <span>Copied!</span>
                            </div>
                          ) : (
                            "Copy"
                          )}
                        </button>
                      </div>

                      {/* Open in Google Maps button */}
                      <a
                        href={
                          selectedCab?.location
                            ? `https://www.google.com/maps/place/${convertToDMS(selectedCab.location.lat, true)}+${convertToDMS(selectedCab.location.lng, false)}/@${selectedCab.location.lat},${selectedCab.location.lng},17z`
                            : "#"
                        }
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block w-full text-center px-4 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-all duration-200 font-semibold text-sm shadow-lg"
                      >
                        Open in Google Maps
                      </a>
                    </div>
                  )}
                </div>

                {/* Quick Share Actions */}
                <div className="flex space-x-3">
                  <button
                    onClick={() => {
                      if (selectedCab?.location) {
                        const dmsLat = convertToDMS(selectedCab.location.lat, true)
                        const dmsLng = convertToDMS(selectedCab.location.lng, false)
                        const mapsUrl = `https://www.google.com/maps/place/${dmsLat}+${dmsLng}/@${selectedCab.location.lat},${selectedCab.location.lng},17z`
                        copyToClipboard(mapsUrl)
                        window.open(
                          `https://wa.me/?text=${encodeURIComponent(`Track ${selectedCab.cabNumber}: ${mapsUrl}`)}`,
                          "_blank",
                        )
                      }
                    }}
                    className="flex-1 px-4 py-3 bg-gradient-to-r from-green-500 to-green-600 text-white rounded-xl hover:from-green-600 hover:to-green-700 transition-all duration-200 font-semibold text-sm transform hover:scale-105 shadow-lg"
                  >
                    📱 WhatsApp
                  </button>
                  <button
                    onClick={() => {
                      if (selectedCab?.location) {
                        const dmsLat = convertToDMS(selectedCab.location.lat, true)
                        const dmsLng = convertToDMS(selectedCab.location.lng, false)
                        const mapsUrl = `https://www.google.com/maps/place/${dmsLat}+${dmsLng}/@${selectedCab.location.lat},${selectedCab.location.lng},17z`
                        copyToClipboard(mapsUrl)
                        window.open(
                          `sms:?&body=${encodeURIComponent(`Track ${selectedCab.cabNumber}: ${mapsUrl}`)}`,
                          "_blank",
                        )
                      }
                    }}
                    className="flex-1 px-4 py-3 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-xl hover:from-blue-600 hover:to-blue-700 transition-all duration-200 font-semibold text-sm transform hover:scale-105 shadow-lg"
                  >
                    💬 SMS
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default DynamicGPSTracking