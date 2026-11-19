"use client";

import { useEffect, useRef, useState, use, useMemo } from "react";
import { io, Socket } from "socket.io-client";
import { useRouter, useParams } from "next/navigation";
import { Canvas, useFrame } from "@react-three/fiber";
import * as THREE from "three";

// 3D Particles Component (Passive Background)
function PassiveParticles() {
  const count = 3000;
  const mesh = useRef<THREE.Points>(null);
  
  const particlesPosition = useMemo(() => {
    const positions = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      positions[i * 3] = (Math.random() - 0.5) * 30;
      positions[i * 3 + 1] = (Math.random() - 0.5) * 30;
      positions[i * 3 + 2] = (Math.random() - 0.5) * 20 - 10;
    }
    return positions;
  }, [count]);

  useFrame((state, delta) => {
    if (!mesh.current) return;
    mesh.current.rotation.y += delta * 0.01;
    mesh.current.rotation.x += delta * 0.005;
  });

  return (
    <points ref={mesh}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[particlesPosition, 3]} />
      </bufferGeometry>
      <pointsMaterial size={0.03} color="#38BDF8" sizeAttenuation transparent opacity={0.3} blending={THREE.AdditiveBlending} />
    </points>
  );
}

interface User {
  name: string;
  isHost: boolean;
  hasCamera?: boolean;
}

interface ChatMessage {
  senderName: string;
  message: string;
  timestamp: string;
  senderId: string;
}

export const dynamic = "force-dynamic";

export default function RoomPage() {
  const router = useRouter();
  const params = useParams();
  const roomId = params.roomId as string;

  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [error, setError] = useState<{title: string, message: string} | null>(null);

  // User States
  const [myName, setMyName] = useState<string>("Anonymous");
  const [amIHost, setAmIHost] = useState(false);
  const [users, setUsers] = useState<{ [socketId: string]: User }>({});
  
  // New Features States
  const [controlsLocked, setControlsLocked] = useState(false);
  const [hasCamera, setHasCamera] = useState(true);
  const [isVideoOn, setIsVideoOn] = useState(true);
  const [isAudioOn, setIsAudioOn] = useState(true);
  
  // Chat States
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState("");
  const chatScrollRef = useRef<HTMLDivElement>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const [socket, setSocket] = useState<Socket | null>(null);
  const isSyncingRef = useRef(false);

  // WebRTC States
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStreams, setRemoteStreams] = useState<{ [id: string]: MediaStream }>({});
  const peersRef = useRef<{ [id: string]: RTCPeerConnection }>({});

  useEffect(() => {
    if (chatScrollRef.current) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
    }
  }, [chatMessages]);

  useEffect(() => {
    const fetchRoom = async () => {
      try {
        const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:3001";
        const res = await fetch(`${backendUrl}/api/room/${roomId}`);
        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          return setError({ title: 'Access Denied', message: errData.error || 'Room not found or has expired.' });
        }
        const data = await res.json();
        setVideoUrl(data.videoUrl);
        setControlsLocked(data.controlsLocked);
      } catch (err) {
        setError({ title: 'Server Error', message: 'Failed to connect to the signaling server.' });
      }
    };
    fetchRoom();
  }, [roomId]);

  useEffect(() => {
    navigator.mediaDevices.getUserMedia({ video: true, audio: true })
      .then((stream) => {
        setLocalStream(stream);
        setHasCamera(true);
        if (localVideoRef.current) localVideoRef.current.srcObject = stream;
      })
      .catch((err) => {
        console.warn("Camera/Mic not found or denied. Joining without media.", err);
        setHasCamera(false);
        setLocalStream(null); // Allow joining without camera
      });
  }, []);

  useEffect(() => {
    // Only connect socket if we have fetched the videoUrl (so room is valid)
    // We do NOT block on localStream anymore, allowing cameraless join.
    if (!videoUrl) return;

    const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:3001";
    const newSocket = io(backendUrl);
    setSocket(newSocket);

    const savedName = localStorage.getItem("watchparty-name") || "Anonymous";
    setMyName(savedName);
    const hostToken = localStorage.getItem(`hostToken-${roomId}`);

    const createPeer = (userId: string, isInitiator: boolean) => {
      const peer = new RTCPeerConnection({ iceServers: [{ urls: "stun:stun.l.google.com:19302" }] });
      
      // Only add tracks if we have a stream
      if (localStream) {
        localStream.getTracks().forEach(track => peer.addTrack(track, localStream));
      }

      peer.onicecandidate = (event) => {
        if (event.candidate) newSocket.emit("webrtc-ice-candidate", { to: userId, candidate: event.candidate });
      };

      peer.ontrack = (event) => {
        setRemoteStreams(prev => ({ ...prev, [userId]: event.streams[0] }));
      };

      peersRef.current[userId] = peer;
      return peer;
    };

    newSocket.on("connect", () => {
      newSocket.emit("join-room", { roomId, name: savedName, hostToken, hasCamera: localStream !== null });
    });

    newSocket.on("room-joined", ({ users, isHost, controlsLocked }) => {
      setUsers(users);
      setAmIHost(isHost);
      setControlsLocked(controlsLocked);
    });

    newSocket.on("user-joined", async (data: { socketId: string, name: string, isHost: boolean, hasCamera: boolean }) => {
      setUsers(prev => ({ ...prev, [data.socketId]: { name: data.name, isHost: data.isHost, hasCamera: data.hasCamera } }));
      const peer = createPeer(data.socketId, true);
      const offer = await peer.createOffer();
      await peer.setLocalDescription(offer);
      newSocket.emit("webrtc-offer", { to: data.socketId, offer });
    });

    newSocket.on("user-left", (socketId: string) => {
      setUsers(prev => { const newUsers = { ...prev }; delete newUsers[socketId]; return newUsers; });
      setRemoteStreams(prev => { const newStreams = { ...prev }; delete newStreams[socketId]; return newStreams; });
      if (peersRef.current[socketId]) { peersRef.current[socketId].close(); delete peersRef.current[socketId]; }
    });

    newSocket.on("error", (errData: { title: string, message: string }) => setError(errData));
    newSocket.on("kicked", () => setError({ title: 'Terminated', message: 'You were removed by the host.' }));
    newSocket.on("controls-toggled", (locked: boolean) => setControlsLocked(locked));

    newSocket.on("receive-message", (msg: ChatMessage) => {
      setChatMessages(prev => [...prev, msg]);
    });

    // WebRTC Signaling
    newSocket.on("webrtc-offer", async ({ from, offer }) => {
      const peer = createPeer(from, false);
      await peer.setRemoteDescription(new RTCSessionDescription(offer));
      const answer = await peer.createAnswer();
      await peer.setLocalDescription(answer);
      newSocket.emit("webrtc-answer", { to: from, answer });
    });

    newSocket.on("webrtc-answer", async ({ from, answer }) => {
      const peer = peersRef.current[from];
      if (peer) await peer.setRemoteDescription(new RTCSessionDescription(answer));
    });

    newSocket.on("webrtc-ice-candidate", async ({ from, candidate }) => {
      const peer = peersRef.current[from];
      if (peer) await peer.addIceCandidate(new RTCIceCandidate(candidate));
    });

    // Video Syncing
    newSocket.on("play", (time: number) => {
      if (videoRef.current) {
        isSyncingRef.current = true;
        if (Math.abs(videoRef.current.currentTime - time) > 1) videoRef.current.currentTime = time;
        videoRef.current.play().catch(e => console.error(e));
      }
    });

    newSocket.on("pause", (time: number) => {
      if (videoRef.current) {
        isSyncingRef.current = true;
        videoRef.current.currentTime = time;
        videoRef.current.pause();
      }
    });

    newSocket.on("seek", (time: number) => {
      if (videoRef.current) {
        isSyncingRef.current = true;
        videoRef.current.currentTime = time;
      }
    });

    return () => {
      newSocket.disconnect();
      Object.values(peersRef.current).forEach(peer => peer.close());
      peersRef.current = {};
    };
  }, [roomId, videoUrl, localStream]); // re-run only if videoUrl or initial stream resolves

  const canIControl = amIHost || !controlsLocked;

  const handlePlay = () => {
    if (!canIControl) return;
    if (isSyncingRef.current) { isSyncingRef.current = false; return; }
    if (socket && videoRef.current) socket.emit("play", { roomId, time: videoRef.current.currentTime });
  };

  const handlePause = () => {
    if (!canIControl) return;
    if (isSyncingRef.current) { isSyncingRef.current = false; return; }
    if (socket && videoRef.current) socket.emit("pause", { roomId, time: videoRef.current.currentTime });
  };

  const handleSeeked = () => {
    if (!canIControl) return;
    if (isSyncingRef.current) { isSyncingRef.current = false; return; }
    if (socket && videoRef.current) socket.emit("seek", { roomId, time: videoRef.current.currentTime });
  };

  const toggleVideo = () => {
    if (localStream) {
      const videoTrack = localStream.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        setIsVideoOn(videoTrack.enabled);
      }
    }
  };

  const toggleAudio = () => {
    if (localStream) {
      const audioTrack = localStream.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setIsAudioOn(audioTrack.enabled);
      }
    }
  };

  const toggleControls = () => {
    if (socket && amIHost) {
      socket.emit('toggle-controls', { roomId, locked: !controlsLocked });
    }
  };

  const kickUser = (targetSocketId: string) => {
    if (socket && amIHost) socket.emit("kick-user", { roomId, targetSocketId });
  };

  const sendChat = (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim() || !socket) return;
    socket.emit("send-message", { roomId, senderName: myName, message: chatInput.trim() });
    setChatInput("");
  };

  if (error) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#06080D] text-white px-4">
        <div className="max-w-md w-full backdrop-blur-xl bg-red-900/20 p-10 rounded-3xl border border-red-500/30 text-center shadow-[0_0_50px_rgba(239,68,68,0.2)]">
          <svg className="w-16 h-16 text-red-500 mx-auto mb-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <h1 className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-red-400 to-red-600 mb-4 uppercase tracking-widest">{error.title}</h1>
          <p className="text-red-200/80 mb-8 font-light leading-relaxed">{error.message}</p>
          <button onClick={() => router.push('/')} className="w-full px-6 py-4 bg-red-600/20 border border-red-500 hover:bg-red-600 hover:shadow-[0_0_20px_rgba(239,68,68,0.4)] text-white font-bold rounded-xl transition-all duration-300 transform hover:-translate-y-1">RETURN TO CORE</button>
        </div>
      </div>
    );
  }

  if (!videoUrl) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#06080D] text-white">
        <div className="animate-pulse flex flex-col items-center">
          <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mb-4"></div>
          <p className="text-xl text-blue-300 font-light tracking-widest">INITIALIZING NODE...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#06080D] relative font-sans text-white overflow-hidden">
      {/* 3D Background */}
      <div className="fixed inset-0 z-0 pointer-events-none">
        <Canvas camera={{ position: [0, 0, 5], fov: 75 }}>
          <color attach="background" args={["#06080D"]} />
          <ambientLight intensity={0.5} />
          <PassiveParticles />
        </Canvas>
      </div>

      <main className="relative z-10 flex flex-col lg:flex-row h-screen">
        
        {/* Main Video Section */}
        <div className="flex-1 p-4 md:p-8 flex flex-col items-center overflow-y-auto">
          
          <div className="w-full max-w-6xl flex flex-wrap gap-4 justify-between items-center mb-6 backdrop-blur-md bg-black/20 p-4 rounded-2xl border border-white/5 shadow-lg">
            <h1 className="text-xl md:text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-500 tracking-widest uppercase">
              Stream Core
            </h1>
            <div className="flex flex-wrap gap-4 items-center">
              {amIHost && (
                <button 
                  onClick={toggleControls}
                  className={`text-xs font-bold tracking-widest uppercase px-3 py-1.5 rounded-lg border transition-all ${controlsLocked ? 'bg-red-900/30 border-red-500/50 text-red-400 shadow-[0_0_10px_rgba(239,68,68,0.2)]' : 'bg-green-900/30 border-green-500/50 text-green-400 shadow-[0_0_10px_rgba(34,197,94,0.2)]'}`}
                >
                  {controlsLocked ? 'Controls: Host Only' : 'Controls: Everyone'}
                </button>
              )}
              {!amIHost && !controlsLocked && (
                <span className="text-xs text-green-400 font-bold tracking-widest uppercase bg-green-900/30 border border-green-500/50 px-3 py-1.5 rounded-lg">
                  Unlocked Player
                </span>
              )}
              <div className="bg-black/40 px-4 py-2 rounded-lg border border-white/10 flex items-center gap-3">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                <span className="text-gray-400 text-xs font-semibold tracking-wider">NODE ID</span>
                <span className="text-emerald-400 font-mono font-bold tracking-widest">{roomId}</span>
              </div>
            </div>
          </div>
          
          <div className="w-full max-w-6xl relative group">
            <div className="absolute -inset-1 bg-gradient-to-r from-blue-600 via-purple-600 to-indigo-600 rounded-2xl blur opacity-20 group-hover:opacity-40 transition duration-1000"></div>
            <div className="relative bg-black/80 rounded-2xl overflow-hidden shadow-[0_8px_32px_rgba(0,0,0,0.5)] border border-white/10 backdrop-blur-xl">
              <video
                ref={videoRef}
                src={videoUrl}
                controls={canIControl}
                crossOrigin="anonymous"
                playsInline
                preload="auto"
                className="w-full h-auto aspect-video"
                onPlay={handlePlay}
                onPause={handlePause}
                onSeeked={handleSeeked}
              />
            </div>
          </div>

          {/* Chat Interface (Mobile below video, Desktop uses fixed sidebar space but let's put it here for better wide layout) */}
          <div className="w-full max-w-6xl mt-8 flex-1 min-h-[300px] flex flex-col backdrop-blur-xl bg-black/40 border border-white/10 rounded-2xl overflow-hidden shadow-2xl">
            <div className="p-4 border-b border-white/10 bg-white/5">
              <h2 className="text-gray-300 text-sm font-bold tracking-[0.2em] uppercase">Comm Link</h2>
            </div>
            
            <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar" ref={chatScrollRef}>
              {chatMessages.length === 0 && <p className="text-gray-500 text-center text-sm mt-10 italic">No messages yet. Start the conversation!</p>}
              {chatMessages.map((msg, i) => (
                <div key={i} className={`flex flex-col ${msg.senderId === socket?.id ? 'items-end' : 'items-start'}`}>
                  <span className="text-[10px] text-gray-500 uppercase tracking-wider mb-1">{msg.senderName} • {new Date(msg.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                  <div className={`px-4 py-2 rounded-xl text-sm max-w-[80%] break-words ${msg.senderId === socket?.id ? 'bg-blue-600/50 border border-blue-500/30' : 'bg-white/10 border border-white/5'}`}>
                    {msg.message}
                  </div>
                </div>
              ))}
            </div>

            <form onSubmit={sendChat} className="p-4 bg-black/60 border-t border-white/10 flex gap-2">
              <input 
                type="text" 
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                placeholder="Send a message (Emojis supported 🚀)..."
                className="flex-1 bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-sm focus:outline-none focus:border-blue-500"
              />
              <button type="submit" className="bg-blue-600 hover:bg-blue-700 px-6 font-bold rounded-lg transition-colors">SEND</button>
            </form>
          </div>
        </div>

        {/* Spatial Participants Sidebar */}
        <div className="w-full lg:w-96 backdrop-blur-2xl bg-black/50 border-l border-white/10 flex flex-col h-full lg:h-auto overflow-hidden">
          <div className="p-6 border-b border-white/10 bg-gradient-to-b from-white/5 to-transparent">
            <h2 className="text-gray-300 text-sm font-bold tracking-[0.2em] uppercase flex justify-between items-center">
              Active Nodes
              <span className="bg-blue-600/30 text-blue-400 px-2 py-0.5 rounded text-xs border border-blue-500/30">
                {Object.keys(users).length}
              </span>
            </h2>
          </div>
          
          <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">
            
            {/* Local Video Card */}
            <div className="relative group">
              <div className="absolute -inset-0.5 bg-gradient-to-b from-blue-500 to-purple-600 rounded-xl blur opacity-30"></div>
              <div className="relative rounded-xl overflow-hidden border border-white/20 bg-black/60 shadow-xl aspect-video flex items-center justify-center">
                {hasCamera && isVideoOn ? (
                  <video ref={localVideoRef} autoPlay playsInline muted className="w-full h-full object-cover mix-blend-screen" />
                ) : (
                  <div className="text-gray-600 flex flex-col items-center">
                    <svg className="w-8 h-8 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
                    <span className="text-xs tracking-widest font-bold">NO SIGNAL</span>
                  </div>
                )}
                
                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black via-black/80 to-transparent pt-8 pb-3 px-4 flex justify-between items-end">
                  <p className="text-sm font-bold text-white tracking-wide flex items-center gap-2">
                    {myName} (You) {amIHost && <span className="text-yellow-400 text-xs">👑 HOST</span>}
                  </p>
                  {hasCamera && (
                    <div className="flex gap-2">
                      <button onClick={toggleAudio} className={`p-1.5 rounded-md ${isAudioOn ? 'bg-white/20 hover:bg-white/30' : 'bg-red-500/50 text-red-200 hover:bg-red-500/70'}`}>
                        🎤
                      </button>
                      <button onClick={toggleVideo} className={`p-1.5 rounded-md ${isVideoOn ? 'bg-white/20 hover:bg-white/30' : 'bg-red-500/50 text-red-200 hover:bg-red-500/70'}`}>
                        📹
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Remote Videos */}
            {Object.entries(remoteStreams).map(([peerSocketId, stream]) => {
              const user = users[peerSocketId] || { name: "Connecting...", isHost: false, hasCamera: true };
              
              return (
                <div key={peerSocketId} className="relative group">
                  <div className="absolute -inset-0.5 bg-white/10 rounded-xl blur opacity-20 transition duration-300 group-hover:opacity-40"></div>
                  <div className="relative rounded-xl overflow-hidden border border-white/10 bg-black/60 shadow-lg aspect-video flex items-center justify-center">
                    {user.hasCamera !== false ? (
                      <video
                        autoPlay
                        playsInline
                        className="w-full h-full object-cover mix-blend-screen"
                        ref={el => { if (el) el.srcObject = stream; }}
                      />
                    ) : (
                      <div className="text-gray-600 flex flex-col items-center">
                        <svg className="w-8 h-8 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
                        <span className="text-xs tracking-widest font-bold">NO SIGNAL</span>
                      </div>
                    )}

                    <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black via-black/80 to-transparent pt-8 pb-3 px-4 flex justify-between items-end">
                      <p className="text-sm font-semibold text-gray-200 tracking-wide">
                        {user.name} {user.isHost && <span className="text-yellow-400 text-xs">👑</span>}
                      </p>
                      
                      {amIHost && !user.isHost && (
                        <button 
                          onClick={() => kickUser(peerSocketId)}
                          className="opacity-0 translate-y-2 group-hover:opacity-100 group-hover:translate-y-0 bg-red-500/20 hover:bg-red-600 border border-red-500/50 hover:border-red-500 text-white text-xs font-bold px-3 py-1.5 rounded-lg transition-all duration-300 shadow-[0_0_10px_rgba(239,68,68,0.3)] backdrop-blur-md"
                        >
                          TERMINATE
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </main>
      
      <style dangerouslySetInnerHTML={{__html: `
        .custom-scrollbar::-webkit-scrollbar { width: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: rgba(255,255,255,0.2); }
      `}} />
    </div>
  );
}
