"use client"
import { GoogleMap, LoadScript, Marker } from "@react-google-maps/api"
import { useEffect, useState } from "react"

const containerStyle = {
  width: "100%",
  height: "400px",
  borderRadius: "8px",
}

export default function RealTimeMap({ cabs, selectedCab, onCabSelect }) {
  const [mapCenter, setMapCenter] = useState({ lat: 18.5204, lng: 73.8567 })

  useEffect(() => {
    if (selectedCab) {
      setMapCenter({ lat: selectedCab.latitude, lng: selectedCab.longitude })
    } else if (cabs.length > 0) {
      const avgLat = cabs.reduce((sum, cab) => sum + cab.latitude, 0) / cabs.length
      const avgLng = cabs.reduce((sum, cab) => sum + cab.longitude, 0) / cabs.length
      setMapCenter({ lat: avgLat, lng: avgLng })
    }
  }, [selectedCab, cabs])

  return (
    <div className="w-full h-full">
      <LoadScript googleMapsApiKey="AIzaSyAKjmBSUJ3XR8uD10vG2ptzqLJAZnOlzqI">
        <GoogleMap mapContainerStyle={containerStyle} center={mapCenter} zoom={selectedCab ? 15 : 8}>
          {cabs.map((cab) => (
            <Marker
              key={cab.id}
              position={{ lat: cab.latitude, lng: cab.longitude }}
              onClick={() => onCabSelect?.(cab)}
              label={{
                text: cab.cabNumber,
                fontSize: "12px",
                color: "black",
                fontWeight: "bold"
              }}
            />
          ))}
        </GoogleMap>
      </LoadScript>

      <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-2">
        {cabs.map((cab) => (
          <button
            key={cab.id}
            onClick={() => onCabSelect?.(cab)}
            className={`p-2 rounded text-sm transition-colors ${
              selectedCab?.id === cab.id
                ? "bg-blue-600 text-white"
                : "bg-gray-700 text-gray-300 hover:bg-gray-600"
            }`}
          >
            <div className="font-semibold">{cab.cabNumber}</div>
            <div className="text-xs">{Math.round(cab.speed)} km/h</div>
          </button>
        ))}
      </div>
    </div>
  )
}
