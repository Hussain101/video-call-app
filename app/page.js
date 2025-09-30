'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function Home() {
  const router = useRouter();
  const [callType, setCallType] = useState('video');
  const [receiverIds, setReceiverIds] = useState('');
  const [userName, setUserName] = useState('');

  const startCall = () => {
    if (!userName.trim()) {
      alert('Please enter your name');
      return;
    }

    const roomId = `room-${Date.now()}`;
    const userId = `user-${Math.random().toString(36).substr(2, 9)}`;
    
    const ids = receiverIds.split(',').map(id => id.trim()).filter(Boolean);
    const params = new URLSearchParams({
      callType,
      roomId,
      userId,
      userName
    });
    
    ids.forEach(id => params.append('receiverId', id));

    router.push(`/call?${params.toString()}`);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-2xl p-8 max-w-md w-full">
        <h1 className="text-3xl font-bold text-center mb-6 text-gray-800">
          Video Call App
        </h1>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Your Name
            </label>
            <input
              type="text"
              value={userName}
              onChange={(e) => setUserName(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Enter your name"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Call Type
            </label>
            <select
              value={callType}
              onChange={(e) => setCallType(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="audio">Audio Only</option>
              <option value="video">Video Call</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Receiver IDs (comma-separated for group)
            </label>
            <input
              type="text"
              value={receiverIds}
              onChange={(e) => setReceiverIds(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="e.g., 123, 456 (leave empty for random room)"
            />
            <p className="text-xs text-gray-500 mt-1">
              Leave empty for a random room, or enter IDs separated by commas for group calls
            </p>
          </div>

          <button
            onClick={startCall}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-4 rounded-lg transition duration-200 transform hover:scale-105"
          >
            Start Call
          </button>
        </div>

        <div className="mt-6 p-4 bg-gray-100 rounded-lg">
          <p className="text-sm text-gray-600">
            <strong>Share this link:</strong><br />
            Copy the URL after starting a call and share with participants
          </p>
        </div>
      </div>
    </div>
  );
}