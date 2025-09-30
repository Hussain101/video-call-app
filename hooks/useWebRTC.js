import { useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';

const SOCKET_SERVER = process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:3001';

export const useWebRTC = (roomId, userId, userName, callType) => {
  const [peers, setPeers] = useState([]);
  const [localStream, setLocalStream] = useState(null);
  const [isAudioEnabled, setIsAudioEnabled] = useState(true);
  const [isVideoEnabled, setIsVideoEnabled] = useState(callType === 'video');
  
  const socketRef = useRef();
  const peersRef = useRef([]);
  const localStreamRef = useRef();

  useEffect(() => {
    // Initialize socket
    socketRef.current = io(SOCKET_SERVER);

    // Get user media
    const initMedia = async () => {
      try {
        const constraints = {
          audio: true,
          video: callType === 'video' ? {
            width: { ideal: 1280 },
            height: { ideal: 720 }
          } : false
        };

        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        localStreamRef.current = stream;
        setLocalStream(stream);

        // Join room
        socketRef.current.emit('join-room', { roomId, userId, userName });
      } catch (error) {
        console.error('Error accessing media devices:', error);
        alert('Please allow camera and microphone access');
      }
    };

    initMedia();

    // Socket event handlers
    socketRef.current.on('existing-users', (users) => {
      users.forEach(user => {
        createPeerConnection(user.socketId, true);
      });
    });

    socketRef.current.on('user-joined', (user) => {
      createPeerConnection(user.socketId, false);
    });

    socketRef.current.on('offer', async ({ offer, from }) => {
      const peer = peersRef.current.find(p => p.socketId === from);
      if (peer) {
        await peer.pc.setRemoteDescription(new RTCSessionDescription(offer));
        const answer = await peer.pc.createAnswer();
        await peer.pc.setLocalDescription(answer);
        socketRef.current.emit('answer', { answer, to: from, from: socketRef.current.id });
      }
    });

    socketRef.current.on('answer', async ({ answer, from }) => {
      const peer = peersRef.current.find(p => p.socketId === from);
      if (peer) {
        await peer.pc.setRemoteDescription(new RTCSessionDescription(answer));
      }
    });

    socketRef.current.on('ice-candidate', async ({ candidate, from }) => {
      const peer = peersRef.current.find(p => p.socketId === from);
      if (peer && candidate) {
        await peer.pc.addIceCandidate(new RTCIceCandidate(candidate));
      }
    });

    socketRef.current.on('user-left', (socketId) => {
      const peer = peersRef.current.find(p => p.socketId === socketId);
      if (peer) {
        peer.pc.close();
        peersRef.current = peersRef.current.filter(p => p.socketId !== socketId);
        setPeers(prev => prev.filter(p => p.socketId !== socketId));
      }
    });

    socketRef.current.on('user-toggled-audio', ({ socketId, isEnabled }) => {
      setPeers(prev => prev.map(p => 
        p.socketId === socketId ? { ...p, isAudioEnabled: isEnabled } : p
      ));
    });

    socketRef.current.on('user-toggled-video', ({ socketId, isEnabled }) => {
      setPeers(prev => prev.map(p => 
        p.socketId === socketId ? { ...p, isVideoEnabled: isEnabled } : p
      ));
    });

    return () => {
      // Cleanup
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach(track => track.stop());
      }
      peersRef.current.forEach(peer => peer.pc.close());
      socketRef.current.disconnect();
    };
  }, [roomId, userId, userName, callType]);

  const createPeerConnection = (socketId, isInitiator) => {
    const configuration = {
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' }
      ]
    };

    const pc = new RTCPeerConnection(configuration);

    // Add local stream tracks
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => {
        pc.addTrack(track, localStreamRef.current);
      });
    }

    // Handle incoming stream
    pc.ontrack = (event) => {
      setPeers(prev => {
        const existing = prev.find(p => p.socketId === socketId);
        if (existing) {
          return prev.map(p => 
            p.socketId === socketId 
              ? { ...p, stream: event.streams[0] }
              : p
          );
        } else {
          return [...prev, {
            socketId,
            stream: event.streams[0],
            isAudioEnabled: true,
            isVideoEnabled: callType === 'video'
          }];
        }
      });
    };

    // Handle ICE candidates
    pc.onicecandidate = (event) => {
      if (event.candidate) {
        socketRef.current.emit('ice-candidate', {
          candidate: event.candidate,
          to: socketId,
          from: socketRef.current.id
        });
      }
    };

    // Create and send offer if initiator
    if (isInitiator) {
      pc.createOffer()
        .then(offer => pc.setLocalDescription(offer))
        .then(() => {
          socketRef.current.emit('offer', {
            offer: pc.localDescription,
            to: socketId,
            from: socketRef.current.id
          });
        });
    }

    peersRef.current.push({ socketId, pc });
  };

  const toggleAudio = () => {
    if (localStreamRef.current) {
      const audioTrack = localStreamRef.current.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setIsAudioEnabled(audioTrack.enabled);
        socketRef.current.emit('toggle-audio', { roomId, isEnabled: audioTrack.enabled });
      }
    }
  };

  const toggleVideo = () => {
    if (localStreamRef.current && callType === 'video') {
      const videoTrack = localStreamRef.current.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        setIsVideoEnabled(videoTrack.enabled);
        socketRef.current.emit('toggle-video', { roomId, isEnabled: videoTrack.enabled });
      }
    }
  };

  const endCall = () => {
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => track.stop());
    }
    socketRef.current.emit('leave-room', roomId);
    socketRef.current.disconnect();
  };

  return {
    localStream,
    peers,
    isAudioEnabled,
    isVideoEnabled,
    toggleAudio,
    toggleVideo,
    endCall
  };
};