

'use client';

import { useState, useEffect, useRef } from 'react';
import { FiUser, FiPhone, FiMapPin, FiRefreshCw, FiLogOut } from "react-icons/fi";
import { useRouter } from 'next/navigation';
import Sidebar from "../slidebar/page";

export default function JobMarketPage() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isApiLoading, setIsApiLoading] = useState(true);
  const [jobs, setJobs] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [userInfo, setUserInfo] = useState(null);
  const router = useRouter();

  const [formData, setFormData] = useState({
    name: "",
    phone: "",
    tripType: "one-way",
    vehicleType: "",
    pickupDate: "",
    pickupTime: "",
    pickupLocation: "",
    dropoffLocation: "",
    endDate: "",
    endTime: "",
    numberOfDays: "",
    distance: "",
    rentalDateTime: "",
    rentalHours: "",
    fixedKM: "",
    extraHours: "",
    extraDistance: ""
  });

  const pickupInputRef = useRef(null);
  const dropoffInputRef = useRef(null);

  // Get auth token from localStorage with multiple fallbacks
  const getAuthToken = () => {
    if (typeof window !== 'undefined') {
      // Check all possible storage locations for the token
      const token = localStorage.getItem('authToken') ||
        localStorage.getItem('token') ||
        sessionStorage.getItem('authToken') ||
        sessionStorage.getItem('token') ||
        localStorage.getItem('adminToken');

      if (token) {
        // Clean the token (remove quotes if present)
        return token.replace(/^"(.*)"$/, '$1').trim();
      }
    }
    return null;
  };

  // Check authentication and redirect if not logged in
  const checkAuth = () => {
    const token = getAuthToken();
    if (!token) {
      alert("Please login first");
      router.push('/login');
      return false;
    }
    return true;
  };

  // Get user info from token
  const getUserInfoFromToken = () => {
    const token = getAuthToken();
    if (!token) return null;

    try {
      // Decode JWT token to get user info
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

  // Logout function
  const handleLogout = () => {
    localStorage.removeItem('authToken');
    localStorage.removeItem('token');
    localStorage.removeItem('adminToken');
    sessionStorage.removeItem('authToken');
    sessionStorage.removeItem('token');
    router.push('/login');
  };

  // ✅ Fetch all jobs on page load - Only get available jobs (not accepted)
  const fetchJobs = async () => {
    if (!checkAuth()) return;

    setIsLoading(true);
    try {
      const token = getAuthToken();
      const res = await fetch("http://localhost:5000/api/jobMarket/getAlljobs", {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      const data = await res.json();
      console.log("-------", data)
      if (res.ok) {
        // Filter out accepted jobs - only show available jobs
        const availableJobs = data.data.filter(job => job.status === "available");
        setJobs(availableJobs || []);
      } else {
        console.error("Failed to fetch jobs:", data.message);
        if (data.message === "Unauthorized" || res.status === 401) {
          handleLogout();
        }
      }
    } catch (error) {
      console.error("Error fetching jobs:", error);
    } finally {
      setIsLoading(false);
    }
  };

  // Update your JobMarketPage component - Add this function
  const handleAcceptJob = async (jobId) => {
    if (!window.confirm("Are you sure you want to accept this job?")) {
      return;
    }

    try {
      const token = getAuthToken();
      if (!token) {
        alert("Please login first");
        return;
      }

      const res = await fetch(`http://localhost:5000/api/jobMarket/accept-job/${jobId}`, {
        method: "PUT",
        headers: {
          "Authorization": `Bearer ${token}`
        },
      });

      const data = await res.json();
      if (res.ok) {
        alert("Job accepted successfully!");
        // Remove the job from local state
        setJobs(prev => prev.filter(job => job.id !== jobId));

        // Optional: Refresh the job list to ensure all users see the updated list
        // fetchJobs();
      } else {
        console.error("Failed to accept job:", data.message);
        alert("Failed to accept job: " + data.message);
      }
    } catch (error) {
      console.error("Error accepting job:", error);
      alert("Error accepting job. Please try again.");
    }
  };

  useEffect(() => {
    // Check authentication on component mount
    if (!checkAuth()) return;

    // Get user info from token
    const user = getUserInfoFromToken();
    setUserInfo(user);

    // Fetch jobs
    fetchJobs();
  }, []);

  useEffect(() => {
    if (typeof window.google === 'undefined') {
      const script = document.createElement('script');
      script.src = `https://maps.googleapis.com/maps/api/js?key=AIzaSyAKjmBSUJ3XR8uD10vG2ptzqLJAZnOlzqI&libraries=places`;
      script.async = true;
      script.defer = true;
      script.onerror = () => {
        console.error('Failed to load Google Maps API');
        setIsApiLoading(false);
      };
      document.head.appendChild(script);

      script.onload = () => {
        setIsApiLoading(false);
        if (isModalOpen) initializeAutocomplete();
      };

      return () => {
        document.head.removeChild(script);
      };
    } else {
      setIsApiLoading(false);
      if (isModalOpen) initializeAutocomplete();
    }
  }, [isModalOpen]);

  const initializeAutocomplete = () => {
    if (!pickupInputRef.current || !dropoffInputRef.current) {
      console.warn('Input refs not available, retrying...');
      setTimeout(initializeAutocomplete, 100);
      return;
    }
    if (typeof window.google === 'undefined') {
      console.error('Google Maps API not loaded');
      return;
    }

    const pickupAutocomplete = new window.google.maps.places.Autocomplete(pickupInputRef.current, {
      types: ['geocode'],
      componentRestrictions: { country: 'in' },
    });

    const dropoffAutocomplete = new window.google.maps.places.Autocomplete(dropoffInputRef.current, {
      types: ['geocode'],
      componentRestrictions: { country: 'in' },
    });

    pickupAutocomplete.addListener('place_changed', () => {
      const place = pickupAutocomplete.getPlace();
      if (place.formatted_address) {
        setFormData((prev) => ({ ...prev, pickupLocation: place.formatted_address }));
        pickupInputRef.current.value = place.formatted_address;
      }
    });

    dropoffAutocomplete.addListener('place_changed', () => {
      const place = dropoffAutocomplete.getPlace();
      if (place.formatted_address) {
        setFormData((prev) => ({ ...prev, dropoffLocation: place.formatted_address }));
        dropoffInputRef.current.value = place.formatted_address;
      }
    });
  };

  // ✅ Handle input changes
  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  // ✅ Submit form to backend
  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!checkAuth()) return;

    setIsSubmitting(true);

    try {
      const token = getAuthToken();
      const res = await fetch("http://localhost:5000/api/jobMarket/job-post", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify(formData),
      });

      const data = await res.json();
      if (res.ok) {
        // Add new job to UI and refresh the list
        setJobs((prev) => [data.data, ...prev]);
        setIsModalOpen(false);
        setFormData({
          name: "",
          phone: "",
          tripType: "one-way",
          vehicleType: "",
          pickupDate: "",
          pickupTime: "",
          pickupLocation: "",
          dropoffLocation: "",
          endDate: "",
          endTime: "",
          numberOfDays: "",
          distance: "",
          rentalDateTime: "",
          rentalHours: "",
          fixedKM: "",
          extraHours: "",
          extraDistance: ""
        });
        alert("Job posted successfully!");
      } else {
        console.error("Failed to post job:", data.message);
        alert("Failed to post job: " + data.message);
        if (data.message === "Unauthorized" || res.status === 401) {
          handleLogout();
        }
      }
    } catch (error) {
      console.error("Error posting job:", error);
      alert("Error posting job. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Format date for display
  const formatDate = (dateString) => {
    const options = { year: 'numeric', month: 'short', day: 'numeric' };
    return new Date(dateString).toLocaleDateString(undefined, options);
  };

  // Format time for display
  const formatTime = (timeString) => {
    if (!timeString) return '';
    return timeString.substring(0, 5); // Extract HH:MM from HH:MM:SS
  };

  if (!userInfo) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-yellow-500"></div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar />
      <div className="flex-1 p-6 md:ml-60 mt-20 sm:mt-0 transition-all duration-300">
        <header className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-2xl font-bold text-grey-900 m-2">Job Market</h1>
            {/* <p className="text-sm text-gray-600">
              Welcome, {userInfo.name} ({userInfo.role})
            </p> */}
          </div>
          <div className="flex gap-4 items-center">
            <button
              onClick={fetchJobs}
              disabled={isLoading}
              className="flex items-center bg-gray-200 text-gray-800 px-4 py-2 rounded-md hover:bg-gray-300 disabled:opacity-50"
            >
              <FiRefreshCw className={`mr-2 ${isLoading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
            <button
              onClick={() => setIsModalOpen(true)}
              className="bg-yellow-500 text-white font-semibold px-4 py-2 rounded-md"
            >
              Post a New Job
            </button>
            {/* <button
              onClick={handleLogout}
              className="flex items-center bg-red-500 text-white px-4 py-2 rounded-md hover:bg-red-600"
            >
              <FiLogOut className="mr-2" />
              Logout
            </button> */}
          </div>
        </header>
        <p className="text-gray-900 mb-8 mx-2">Find and apply for trips from individuals.</p>

        {isLoading ? (
          <div className="flex justify-center items-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-yellow-500"></div>
          </div>
        ) : jobs.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-500 text-lg">No jobs available yet.</p>
            <p className="text-gray-400">Be the first to post a job!</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {jobs.map((job) => (
              <div key={job.id} className="bg-white border-2 border-gray-200 shadow-sm p-4 rounded-xl">
                <div className="flex items-center mb-1">
                  <FiUser className="text-gray-700 mr-2" />
                  <h2 className="text-lg font-semibold text-gray-900">{job.name}</h2>
                </div>
                <div className="flex items-center text-gray-500 text-sm">
                  <FiPhone className="mr-2" />
                  <p>{job.phone}</p>
                </div>

                <div className="mt-3 text-sm text-gray-500">
                  <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded mr-2 capitalize">
                    {job.tripType}
                  </span>
                  <span className="bg-green-100 text-green-800 px-2 py-1 rounded capitalize">
                    {job.vehicleType}
                  </span>
                </div>

                <div className="mt-3 text-sm text-gray-500">
                  <p>📅 {formatDate(job.pickupDate)}</p>
                  <p>⏰ {formatTime(job.pickupTime)}</p>
                </div>

                <hr className="border-t border-gray-200 my-3" />

                <div className="mt-4">
                  <div className="flex items-center">
                    <FiMapPin className="text-yellow-500 mr-2" />
                    <p className="font-semibold text-gray-900">Pickup</p>
                  </div>
                  <p className="ml-6 text-gray-500 text-sm">{job.pickupLocation}</p>
                </div>

                <div className="mt-3">
                  <div className="flex items-center">
                    <FiMapPin className="text-green-500 mr-2" />
                    <p className="font-semibold text-gray-900">Drop-off</p>
                  </div>
                  <p className="ml-6 text-gray-500 text-sm">{job.dropoffLocation}</p>
                </div>

                <button onClick={() => handleAcceptJob(job.id)} className="w-full mt-4 bg-yellow-500 text-white font-bold py-2 rounded-md hover:bg-yellow-600">
                  Accept Job
                </button>
              </div>
            ))}
          </div>
        )}

        {isModalOpen && (
          <div className="fixed inset-0 flex items-center justify-center bg-black/75 z-50 overflow-y-auto">
            <div className="bg-white rounded-lg p-6 w-[90%] max-w-4xl max-h-[90vh] overflow-y-auto relative my-8">
              <button
                onClick={() => setIsModalOpen(false)}
                className="absolute top-4 right-4 text-gray-500 hover:text-gray-700 text-2xl"
                disabled={isSubmitting}
              >
                ×
              </button>

              <h2 className="text-xl font-bold mb-4">Post a New Trip Request</h2>
              <p className="text-gray-900 mb-6">Fill in the details below to add a job to the market. It will be visible to all available drivers.</p>

              {isApiLoading && <p className="text-gray-500 mb-4">Loading location suggestions...</p>}

              <form onSubmit={handleSubmit}>
                <div className="flex flex-col md:flex-row gap-4 mb-4">
                  <div className="w-full md:w-1/2">
                    <label className="block text-sm font-medium mb-1">Name *</label>
                    <input
                      type="text"
                      name="name"
                      value={formData.name}
                      onChange={handleChange}
                      placeholder="Enter your name"
                      className="w-full border border-gray-300 rounded-md px-3 py-2"
                      required
                    />
                  </div>
                  <div className="w-full md:w-1/2">
                    <label className="block text-sm font-medium mb-1">Phone *</label>
                    <input
                      type="tel"
                      name="phone"
                      value={formData.phone}
                      onChange={handleChange}
                      placeholder="Enter contact phone number"
                      className="w-full border border-gray-300 rounded-md px-3 py-2"
                      required
                    />
                  </div>
                </div>

                <div className="mb-4">
                  <label className="block text-sm font-medium mb-1">Trip Type *</label>
                  <div className="flex flex-wrap items-center gap-4">
                    <label className="flex items-center">
                      <input
                        type="radio"
                        name="tripType"
                        value="one-way"
                        checked={formData.tripType === "one-way"}
                        onChange={handleChange}
                        className="mr-2 accent-yellow-300"
                        required
                      />
                      One-way
                    </label>
                    <label className="flex items-center">
                      <input
                        type="radio"
                        name="tripType"
                        value="round-trip"
                        checked={formData.tripType === "round-trip"}
                        onChange={handleChange}
                        className="mr-2 accent-yellow-300"
                      />
                      Round Trip
                    </label>
                    <label className="flex items-center">
                      <input
                        type="radio"
                        name="tripType"
                        value="rental"
                        checked={formData.tripType === "rental"}
                        onChange={handleChange}
                        className="mr-2 accent-yellow-300"
                      />
                      Rental Trip
                    </label>
                  </div>
                </div>

                <div className="flex flex-row gap-4 mb-4">
                  <div className="w-1/2">
                    <label className="block text-sm font-medium mb-1">Vehicle Type *</label>
                    <select
                      name="vehicleType"
                      value={formData.vehicleType}
                      onChange={handleChange}
                      className="w-full border border-gray-300 rounded-md px-3 py-2"
                      required
                    >
                      <option value="">Select a vehicle type</option>
                      <option value="Sedan">Sedan</option>
                      <option value="SUV">SUV</option>
                      <option value="Hatchback">Hatchback</option>
                      <option value="Mini">Mini</option>
                    </select>
                  </div>

                  <div className="w-1/2">
                    <label className="block text-sm font-medium mb-1">Distance *</label>
                    <input
                      type="number"
                      name="distance"
                      value={formData.distance}
                      onChange={handleChange}
                      placeholder="Enter distance"
                      className="w-full border border-gray-300 rounded-md px-3 py-2"
                      required
                    />
                  </div>
                </div>



                {/* Fields for One-way and Round Trip */}
                {(formData.tripType === "one-way" || formData.tripType === "round-trip") && (
                  <>
                    <div className="flex flex-col md:flex-row gap-4 mb-4">
                      <div className="w-full md:w-1/2">
                        <label className="block text-sm font-medium mb-1">Pickup Date *</label>
                        <input
                          type="date"
                          name="pickupDate"
                          value={formData.pickupDate}
                          onChange={handleChange}
                          className="w-full border border-gray-300 rounded-md px-3 py-2"
                          required
                        />
                      </div>
                      <div className="w-full md:w-1/2">
                        <label className="block text-sm font-medium mb-1">Pickup Time *</label>
                        <input
                          type="time"
                          name="pickupTime"
                          value={formData.pickupTime}
                          onChange={handleChange}
                          className="w-full border border-gray-300 rounded-md px-3 py-2"
                          required
                        />
                      </div>
                    </div>

                    {/* Additional fields for round trip */}
                    {formData.tripType === "round-trip" && (
                      <>
                        <div className="flex flex-col md:flex-row gap-4 mb-4">
                          <div className="w-full md:w-1/2">
                            <label className="block text-sm font-medium mb-1">End Date *</label>
                            <input
                              type="date"
                              name="endDate"
                              value={formData.endDate}
                              onChange={handleChange}
                              className="w-full border border-gray-300 rounded-md px-3 py-2"
                              required
                            />
                          </div>
                          <div className="w-full md:w-1/2">
                            <label className="block text-sm font-medium mb-1">End Time *</label>
                            <input
                              type="time"
                              name="endTime"
                              value={formData.endTime}
                              onChange={handleChange}
                              className="w-full border border-gray-300 rounded-md px-3 py-2"
                              required
                            />
                          </div>
                        </div>

                        <div className="mb-4">
                          <label className="block text-sm font-medium mb-1">No. of Days *</label>
                          <input
                            type="number"
                            name="numberOfDays"
                            value={formData.numberOfDays}
                            onChange={handleChange}
                            placeholder="Enter number of days"
                            className="w-full border border-gray-300 rounded-md px-3 py-2"
                            required
                            min="1"
                          />
                        </div>
                      </>
                    )}
                  </>
                )}

                {/* Fields for Rental Trip */}
                {formData.tripType === "rental" && (
                  <>
                    <div className="flex flex-col md:flex-row gap-4 mb-4">
                      <div className="w-full md:w-1/2">
                        <label className="block text-sm font-medium mb-1">Distance (Km) *</label>
                        <input
                          type="number"
                          name="distance"
                          value={formData.distance}
                          onChange={handleChange}
                          placeholder="Enter distance in kilometers"
                          className="w-full border border-gray-300 rounded-md px-3 py-2"
                          required
                          min="1"
                        />
                      </div>
                      <div className="w-full md:w-1/2">
                        <label className="block text-sm font-medium mb-1">Date & Time *</label>
                        <input
                          type="datetime-local"
                          name="rentalDateTime"
                          value={formData.rentalDateTime}
                          onChange={handleChange}
                          className="w-full border border-gray-300 rounded-md px-3 py-2"
                          required
                        />
                      </div>
                    </div>

                    <div className="flex flex-col md:flex-row gap-4 mb-4">
                      <div className="w-full md:w-1/2">
                        <label className="block text-sm font-medium mb-1">Rental Hours *</label>
                        <input
                          type="number"
                          name="rentalHours"
                          value={formData.rentalHours}
                          onChange={handleChange}
                          placeholder="Enter rental hours"
                          className="w-full border border-gray-300 rounded-md px-3 py-2"
                          required
                          min="1"
                        />
                      </div>
                      <div className="w-full md:w-1/2">
                        <label className="block text-sm font-medium mb-1">Fixed KM *</label>
                        <input
                          type="number"
                          name="fixedKM"
                          value={formData.fixedKM}
                          onChange={handleChange}
                          placeholder="Enter fixed kilometers"
                          className="w-full border border-gray-300 rounded-md px-3 py-2"
                          required
                          min="1"
                        />
                      </div>
                    </div>

                    <div className="flex flex-col md:flex-row gap-4 mb-4">
                      <div className="w-full md:w-1/2">
                        <label className="block text-sm font-medium mb-1">Extra Hours</label>
                        <input
                          type="number"
                          name="extraHours"
                          value={formData.extraHours}
                          onChange={handleChange}
                          placeholder="Enter extra hours"
                          className="w-full border border-gray-300 rounded-md px-3 py-2"
                          min="0"
                        />
                      </div>
                      <div className="w-full md:w-1/2">
                        <label className="block text-sm font-medium mb-1">Extra Distance (KM)</label>
                        <input
                          type="number"
                          name="extraDistance"
                          value={formData.extraDistance}
                          onChange={handleChange}
                          placeholder="Enter extra distance in kilometers"
                          className="w-full border border-gray-300 rounded-md px-3 py-2"
                          min="0"
                        />
                      </div>
                    </div>
                  </>
                )}

                <div className="mb-4">
                  <label className="block text-sm font-medium mb-1">Pickup Location *</label>
                  <input
                    type="text"
                    name="pickupLocation"
                    value={formData.pickupLocation}
                    onChange={handleChange}
                    placeholder="Enter pickup address"
                    className="w-full border border-gray-300 rounded-md px-3 py-2"
                    ref={pickupInputRef}
                    autoComplete="off"
                    required
                  />
                </div>

                <div className="mb-6">
                  <label className="block text-sm font-medium mb-1">Drop-off Location *</label>
                  <input
                    type="text"
                    name="dropoffLocation"
                    value={formData.dropoffLocation}
                    onChange={handleChange}
                    placeholder="Enter drop-off address"
                    className="w-full border border-gray-300 rounded-md px-3 py-2"
                    ref={dropoffInputRef}
                    autoComplete="off"
                    required
                  />
                </div>

                <div className="flex justify-end gap-4">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="text-gray-600 px-4 py-2 hover:text-gray-800"
                    disabled={isSubmitting}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="bg-yellow-500 text-white px-4 py-2 rounded-md hover:bg-yellow-600 disabled:opacity-50"
                    disabled={isSubmitting}
                  >
                    {isSubmitting ? 'Posting...' : 'Post Job'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}