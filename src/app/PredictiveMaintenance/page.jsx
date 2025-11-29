"use client";

import React, { useState } from "react";
import Sidebar from "../slidebar/page";
import { Bot } from "lucide-react";

const Page = () => {
  const [prompt, setPrompt] = useState("");
  const [loading, setLoading] = useState(false);
  const [response, setResponse] = useState("");

  const handleGetRecommendation = async () => {
    setLoading(true);
    setResponse("");

    try {
      const res = await fetch("http://localhost:5000/api/ai-response", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt }),
      });

      const data = await res.json();
      if (res.ok) {
        setResponse(data.result);
      } else {
        setResponse("❌ Failed to get recommendation.");
      }
    } catch (err) {
      setResponse("❌ Server error occurred.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white min-h-screen flex">
      <Sidebar />
      <div className="p-8 mt-20 md:ml-60 sm:mt-0 flex-1">
        <div className="flex-1 bg-gray-50 p-6 overflow-auto">
          <div className="flex items-center text-sm text-gray-600 mb-8">
            <span>🏠</span>
            <span className="mx-2">›</span>
            <span>Predictive Maintenance</span>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div className="bg-white rounded-lg shadow-sm p-6">
              <h1 className="text-2xl font-bold text-gray-900 mb-2">
                Predictive Maintenance
              </h1>
              <p className="text-black mb-4">
                Enter historical expense and servicing data or ask anything about cab maintenance.
              </p>

              <textarea
                rows="5"
                className="w-full p-4 text-black border rounded-md mb-4"
                placeholder="e.g., Cab ID: MH12AB1234, Expense: Brake replacement ₹2500, Last service: 2023-07-01"
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
              />

              <button
                onClick={handleGetRecommendation}
                disabled={loading || !prompt}
                className="bg-yellow-400 hover:bg-yellow-500 text-black font-medium px-6 py-3 rounded-lg flex items-center gap-2 transition-colors"
              >
                <span className="text-lg">✨</span>
                {loading ? "Thinking..." : "Get Recommendations"}
              </button>
            </div>

            <div className="bg-white rounded-lg shadow-sm p-6">
              <h2 className="text-2xl font-bold text-gray-900 mb-2">AI Recommendations</h2>
              <p className="text-gray-600 mb-4">Your results will appear here:</p>

              <div className="min-h-[300px] bg-gray-50 border p-4 rounded-lg text-gray-700 overflow-auto whitespace-pre-wrap">
                {loading ? (
                  <p>🧠 Generating recommendation...</p>
                ) : response ? (
                  response
                ) : (
                  <div className="text-center text-gray-400">
                    <Bot size={48} className="mx-auto mb-2" />
                    <p>Ask the AI for maintenance suggestions!</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Page;
