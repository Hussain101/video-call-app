'use client';

import { useSearchParams, useRouter } from 'next/navigation';
import { Suspense, useRef, useEffect, useState } from 'react';
import { useWebRTC } from '@/hooks/useWebRTC';
import roomService from '@/lib/appwrite';

function ThankYou() {
  return (
    <div className="min-h-screen bg-gray-900 flex flex-col items-center justify-center text-white">
      <h1 className="text-3xl font-bold mb-4">Thank you!</h1>
      <p className="text-lg">Your call has ended.</p>
      <p className="text-lg">Double-tap the back button to exit</p>
    </div>
  );
}

function LeavePopup({ onConfirm, onCancel }) {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-8 shadow-lg flex flex-col items-center w-[90vw] max-w-sm">
        <h2 className="text-xl font-bold mb-4 text-gray-900">End Call?</h2>
        <p className="mb-6 text-gray-700 text-center">Are you sure you want to leave the call?</p>
        <div className="flex gap-4 w-full">
          <button
            onClick={onConfirm}
            className="flex-1 px-4 py-2 rounded bg-red-600 text-white font-semibold hover:bg-red-700"
          >
            Yes, End Call
          </button>
          <button
            onClick={onCancel}
            className="flex-1 px-4 py-2 rounded bg-gray-300 text-gray-900 font-semibold hover:bg-gray-400"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

function CallComponent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [callEnded, setCallEnded] = useState(false);
  const [showLeavePopup, setShowLeavePopup] = useState(false);

  const callType = searchParams.get('callType') || 'audio';
  const receiverIds = searchParams.getAll('receiverId');
  const roomId = searchParams.get('roomId') || null;
  const userId = searchParams.get('userId') || null;
  const userName = searchParams.get('userName') || 'Anonymous';

  const {
    localStream,
    peers,
    isAudioEnabled,
    isVideoEnabled,
    toggleAudio,
    toggleVideo,
    endCall
  } = useWebRTC(roomId, userId, userName, callType);

  const localVideoRef = useRef();

  useEffect(() => {
    if (localVideoRef.current && localStream) {
      localVideoRef.current.srcObject = localStream;
    }
  }, [localStream]);

  // Handle mobile back button (Android/iOS)
  useEffect(() => {
    const handlePopState = () => {
      setShowLeavePopup(true);
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // Prevent accidental navigation away
  useEffect(() => {
    const handleBeforeUnload = (e) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, []);

  const handleEndCall = () => {
    setShowLeavePopup(true);
  };

  // Update status to 'ended' on call leave
  const confirmLeave = async () => {
    try {
      await roomService.updateStatusByCallerId(roomId, 'ended');
    } catch (e) {
      console.error('Failed to update status:', e);
    }
    endCall();
    setCallEnded(true);
    setShowLeavePopup(false);
    window.history.pushState({}, '');
  };

  const cancelLeave = () => {
    setShowLeavePopup(false);
    // Optionally, push a new history state so back doesn't trigger again
    window.history.pushState({}, '');
  };

  const addUser = async () => {
    if (!userId) return;
    // Save room entry to Appwrite
    const meetingUrl = ` ${process.env.NEXT_PUBLIC_HOST}/call?roomId=${roomId}&callType=${callType}`;
    await roomService.saveRoomEntry(meetingUrl, roomId, userId, receiverIds, userName);
  }
  useEffect(() => {
    if (userId) {
      addUser();
    }
  }, []);

  useEffect(() => {
    // Push a new history state so back triggers popstate
    window.history.pushState({ callActive: true }, '');
  }, []);

  useEffect(() => {
    let timeoutId;
    // If only one person (yourself) in the room, start a 30s timer
    if (peers.length === 0 && !callEnded) {
      timeoutId = setTimeout(async () => {
        try {
          await roomService.updateStatusByCallerId(roomId, 'ended');
        } catch (e) {
          console.error('Failed to update status:', e);
        }
        endCall();
        setCallEnded(true);
        setShowLeavePopup(false);
        window.history.pushState({}, '');
      }, 30000); // 30 seconds
    }
    // If someone joins, clear the timer
    return () => clearTimeout(timeoutId);
  }, [peers.length, callEnded, endCall, userId]);

  if (callEnded) {
    return <ThankYou />;
  }

  return (
    <div className="min-h-screen bg-gray-900 p-2 sm:p-4">
      {showLeavePopup && (
        <LeavePopup onConfirm={confirmLeave} onCancel={cancelLeave} />
      )}
      <div className="max-w-7xl mx-auto">
        <div className="text-white mb-4">
          <h1 className="text-2xl font-bold">
            {receiverIds.length > 1 ? 'Group' : '1-to-1'} {callType === 'video' ? 'Video' : 'Audio'} Call
          </h1>
          <p className="text-sm text-gray-400 break-all">Room: {userName}</p>
        </div>

        {/* Video Grid */}
        <div className={`grid gap-2 sm:gap-4 mb-4 ${
          peers.length === 0 ? 'grid-cols-1' :
          peers.length === 1 ? 'grid-cols-1 sm:grid-cols-2' :
          peers.length <= 4 ? 'grid-cols-1 sm:grid-cols-2' :
          'grid-cols-1 sm:grid-cols-3'
        }`}>
          {/* Local Video */}
          <div className="relative bg-gray-800 rounded-lg overflow-hidden aspect-video flex items-center justify-center">
            {callType === 'video' ? (
              <video
                ref={localVideoRef}
                autoPlay
                muted
                playsInline
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <div className="w-16 h-16 sm:w-24 sm:h-24 rounded-full bg-blue-500 flex items-center justify-center text-white text-2xl sm:text-3xl font-bold">
                  {userName.charAt(0).toUpperCase()}
                </div>
              </div>
            )}
            <div className="absolute bottom-2 left-2 bg-black bg-opacity-50 px-2 py-1 rounded text-white text-xs sm:text-sm">
              You {!isVideoEnabled && callType === 'video' && '(Camera Off)'}
            </div>
            {!isAudioEnabled && (
              <div className="absolute top-2 right-2 bg-red-500 p-2 rounded-full">
                🔇
              </div>
            )}
          </div>

          {/* Remote Videos */}
          {peers.map((peer, index) => (
            <RemoteVideo key={peer.socketId} peer={peer} index={index} callType={callType} />
          ))}
        </div>

        {/* Controls */}
        <div className="flex flex-col sm:flex-row justify-center gap-4 mt-2">
          <button
            onClick={toggleAudio}
            className={`p-4 rounded-full ${
              isAudioEnabled ? 'bg-gray-700 hover:bg-gray-600' : 'bg-red-600 hover:bg-red-700'
            } text-white transition flex-1`}
          >
            {isAudioEnabled ? '🎤' : '🔇'}
          </button>

          {callType === 'video' && (
            <button
              onClick={toggleVideo}
              className={`p-4 rounded-full ${
                isVideoEnabled ? 'bg-gray-700 hover:bg-gray-600' : 'bg-red-600 hover:bg-red-700'
              } text-white transition flex-1`}
            >
              {isVideoEnabled ? '📹' : '📹❌'}
            </button>
          )}

          <button
            onClick={handleEndCall}
            className="p-4 rounded-full bg-red-600 hover:bg-red-700 text-white transition flex-1"
          >
            ☎️ End Call
          </button>
        </div>
      </div>
    </div>
  );
}

function RemoteVideo({ peer, index, callType }) {
  const videoRef = useRef();
  const audioRef = useRef();

  useEffect(() => {
    if (videoRef.current && peer.stream && peer.isVideoEnabled && callType === 'video') {
      videoRef.current.srcObject = peer.stream;
    }
    if (audioRef.current && peer.stream) {
      audioRef.current.srcObject = peer.stream;
    }
  }, [peer.stream, peer.isVideoEnabled, callType]);

  return (
    <div className="relative bg-gray-800 rounded-lg overflow-hidden aspect-video flex items-center justify-center">
      {callType === 'video' && peer.isVideoEnabled ? (
        <video
          ref={videoRef}
          autoPlay
          playsInline
          className="w-full h-full object-cover"
        />
      ) : (
        <div className="w-full h-full flex items-center justify-center">
          <div className="w-16 h-16 sm:w-24 sm:h-24 rounded-full bg-green-500 flex items-center justify-center text-white text-2xl sm:text-3xl font-bold">
            {index + 1}
          </div>
        </div>
      )}
      {/* Always render audio element for remote peer */}
      <audio
        ref={audioRef}
        autoPlay
        controls={false}
        style={{ display: 'none' }}
      />
      <div className="absolute bottom-2 left-2 bg-black bg-opacity-50 px-2 py-1 rounded text-white text-xs sm:text-sm">
        Participant {index + 1} {!peer.isVideoEnabled && callType === 'video' && '(Camera Off)'}
      </div>
      {!peer.isAudioEnabled && (
        <div className="absolute top-2 right-2 bg-red-500 p-2 rounded-full">
          🔇
        </div>
      )}
    </div>
  );
}

export default function CallPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-gray-900 flex items-center justify-center text-white">Loading...</div>}>
      <CallComponent />
    </Suspense>
  );
}