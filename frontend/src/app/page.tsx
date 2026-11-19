"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Canvas, useFrame } from "@react-three/fiber";
import { ScrollControls, Scroll, useScroll } from "@react-three/drei";
import * as THREE from "three";

// 3D Particles Component (The Data Stream)
function Particles() {
  const count = 4000;
  const mesh = useRef<THREE.Points>(null);
  const scroll = useScroll();

  const particlesPosition = useMemo(() => {
    const positions = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      positions[i * 3] = (Math.random() - 0.5) * 25; // x
      positions[i * 3 + 1] = (Math.random() - 0.5) * 25; // y
      positions[i * 3 + 2] = (Math.random() - 0.5) * 20 - 5; // z
    }
    return positions;
  }, [count]);

  useFrame((state, delta) => {
    if (!mesh.current) return;
    // Ambient slow rotation
    mesh.current.rotation.y += delta * 0.03;
    mesh.current.rotation.x += delta * 0.01;

    // Scroll-driven dive effect
    if (scroll) {
      mesh.current.position.z = scroll.offset * 12; // Dive into the particles
      mesh.current.rotation.z = scroll.offset * Math.PI * 0.2; // Slight twist
    }
  });

  return (
    <points ref={mesh}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          args={[particlesPosition, 3]}
        />
      </bufferGeometry>
      <pointsMaterial
        size={0.04}
        color="#8B5CF6"
        sizeAttenuation
        transparent
        opacity={0.6}
        blending={THREE.AdditiveBlending}
      />
    </points>
  );
}

export default function Home() {
  const router = useRouter();

  // Form States
  const [name, setName] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [videoUrl, setVideoUrl] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [joinRoomId, setJoinRoomId] = useState("");

  useEffect(() => {
    const savedName = localStorage.getItem("watchparty-name");
    if (savedName) setName(savedName);
  }, []);

  const saveName = () => {
    if (name) localStorage.setItem("watchparty-name", name);
  }

  const handleCreateRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name) return alert("Please enter your name first!");
    if (!file && !videoUrl) return alert("Please provide a video file or a URL.");

    saveName();
    setIsCreating(true);
    const formData = new FormData();
    if (file) {
      formData.append("video", file);
    } else {
      formData.append("videoUrl", videoUrl);
    }

    try {
      const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:3001";
      const res = await fetch(`${backendUrl}/api/create-room`, {
        method: "POST",
        body: formData,
      });
      const data = await res.json();

      if (data.roomId) {
        localStorage.setItem(`hostToken-${data.roomId}`, data.hostToken);
        router.push(`/room/${data.roomId}`);
      } else {
        alert("Failed to create room.");
      }
    } catch (err) {
      console.error(err);
      alert("Error creating room.");
    } finally {
      setIsCreating(false);
    }
  };

  const handleJoinRoom = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name) return alert("Please enter your name first!");
    if (!joinRoomId) return;
    saveName();
    router.push(`/room/${joinRoomId.toUpperCase()}`);
  };

  return (
    <div className="w-full h-screen bg-[#06080D] overflow-hidden text-white font-sans">
      <Canvas camera={{ position: [0, 0, 5], fov: 75 }}>
        <color attach="background" args={["#06080D"]} />
        <ambientLight intensity={0.5} />

        {/* ScrollControls sets up a scrollable container over the canvas */}
        <ScrollControls pages={2} damping={0.2}>
          <Particles />

          <Scroll html style={{ width: "100%", height: "100%" }}>

            {/* Page 1: Hero Section */}
            <div className="w-screen h-screen flex flex-col items-center justify-center text-center px-4 relative">
              <h1 className="text-6xl md:text-8xl font-black text-transparent bg-clip-text bg-gradient-to-br from-blue-400 via-purple-500 to-indigo-600 mb-6 drop-shadow-2xl tracking-tighter">
                SYNCHRONIZE
              </h1>
              <p className="text-xl md:text-2xl text-gray-400 max-w-2xl font-light tracking-wide">
                Scroll down to enter the data stream and initialize your watch party.
              </p>
              <div className="absolute bottom-12 animate-bounce text-gray-500 opacity-70">
                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                </svg>
              </div>
            </div>

            {/* Page 2: Interactive Forms */}
            <div className="w-screen h-screen flex flex-col items-center justify-center px-4 pt-20">

              <div className="w-full max-w-sm mb-10 backdrop-blur-xl bg-white/5 p-5 rounded-2xl border border-white/10 shadow-[0_8px_32px_rgba(0,0,0,0.37)]">
                <label className="block text-sm font-semibold text-gray-300 mb-2 tracking-wider uppercase">Identity Setup</label>
                <input
                  type="text"
                  placeholder="Enter your alias"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-4 py-3 bg-black/40 border border-white/10 rounded-xl text-white focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 font-medium text-center transition-all"
                  required
                />
              </div>

              <div className="flex flex-col md:flex-row gap-8 w-full max-w-5xl">

                {/* Create Room Card */}
                <div className="flex-1 backdrop-blur-xl bg-black/30 p-8 rounded-3xl shadow-[0_8px_32px_rgba(0,0,0,0.37)] border border-white/10 relative overflow-hidden group hover:border-white/20 transition-all duration-500">
                  <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-500"></div>
                  <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse"></span>
                    Create Session
                  </h2>
                  <form onSubmit={handleCreateRoom} className="space-y-6">
                    <div>
                      <label className="block text-xs font-semibold text-gray-400 mb-2 tracking-wider uppercase">Data Source (MP4 Upload)</label>
                      <input
                        type="file"
                        accept="video/mp4"
                        onChange={(e) => {
                          setFile(e.target.files?.[0] || null);
                          setVideoUrl("");
                        }}
                        className="w-full text-sm text-gray-300 file:mr-4 file:py-2.5 file:px-4 file:rounded-xl file:border-0 file:text-sm file:font-semibold file:bg-white/10 file:text-white hover:file:bg-white/20 cursor-pointer bg-black/40 rounded-xl border border-white/5 transition-all"
                      />
                    </div>

                    <div className="flex items-center text-gray-500 text-xs font-bold py-2">
                      <div className="flex-1 border-t border-white/5"></div>
                      <span className="px-4 tracking-widest text-white/30">OR URL</span>
                      <div className="flex-1 border-t border-white/5"></div>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-gray-400 mb-2 tracking-wider uppercase">Stream Link</label>
                      <input
                        type="url"
                        placeholder="https://server.com/video.mp4"
                        value={videoUrl}
                        onChange={(e) => {
                          setVideoUrl(e.target.value);
                          setFile(null);
                        }}
                        className="w-full px-4 py-3 bg-black/40 border border-white/5 rounded-xl text-white focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all"
                      />
                    </div>

                    <button
                      type="submit"
                      disabled={isCreating}
                      className="w-full mt-2 bg-gradient-to-r from-blue-600 to-indigo-700 hover:from-blue-500 hover:to-indigo-600 text-white font-bold py-3.5 px-4 rounded-xl transition-all duration-300 disabled:opacity-50 shadow-[0_0_20px_rgba(79,70,229,0.3)] hover:shadow-[0_0_30px_rgba(79,70,229,0.5)] transform hover:-translate-y-0.5"
                    >
                      {isCreating ? "INITIALIZING..." : "INITIALIZE NODE"}
                    </button>
                  </form>
                </div>

                {/* Join Room Card */}
                <div className="flex-1 backdrop-blur-xl bg-black/30 p-8 rounded-3xl shadow-[0_8px_32px_rgba(0,0,0,0.37)] border border-white/10 relative overflow-hidden group hover:border-white/20 transition-all duration-500">
                  <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-teal-400 to-emerald-600"></div>
                  <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                    Join Session
                  </h2>
                  <form onSubmit={handleJoinRoom} className="space-y-6">
                    <div>
                      <label className="block text-xs font-semibold text-gray-400 mb-2 tracking-wider uppercase">Node ID</label>
                      <input
                        type="text"
                        placeholder="e.g. AB12CD"
                        value={joinRoomId}
                        onChange={(e) => setJoinRoomId(e.target.value.toUpperCase())}
                        className="w-full px-4 py-4 bg-black/40 border border-white/5 rounded-xl text-white focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 uppercase font-mono tracking-[0.3em] text-2xl text-center transition-all"
                      />
                    </div>

                    <button
                      type="submit"
                      className="w-full mt-2 bg-gradient-to-r from-emerald-600 to-teal-700 hover:from-emerald-500 hover:to-teal-600 text-white font-bold py-3.5 px-4 rounded-xl transition-all duration-300 shadow-[0_0_20px_rgba(16,185,129,0.3)] hover:shadow-[0_0_30px_rgba(16,185,129,0.5)] transform hover:-translate-y-0.5"
                    >
                      CONNECT TO NODE
                    </button>
                  </form>
                </div>
              </div>
              <h1 className="text-xs font-semibold text-gray-400 top pt-4 mb-2 tracking-wider uppercase">*By creating a room you agree to <u><a href="/terms">terms</a></u> and the <u><a href="/privacy">privacy policy</a></u></h1>
            </div>
          </Scroll>
        </ScrollControls>
      </Canvas>
    </div>
  );
}
