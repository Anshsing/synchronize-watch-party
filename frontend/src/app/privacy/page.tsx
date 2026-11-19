export default function PrivacyPolicy() {
  return (
    <div className="min-h-screen bg-[#06080D] text-white p-8 md:p-16 font-sans">
      <div className="max-w-3xl mx-auto backdrop-blur-xl bg-white/5 p-10 rounded-3xl border border-white/10 shadow-[0_8px_32px_rgba(0,0,0,0.37)]">
        <h1 className="text-4xl font-black mb-8 text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-500 tracking-wide">Privacy Policy</h1>
        <div className="space-y-6 text-gray-300 leading-relaxed font-light">
          <p>Effective Date: {new Date().toLocaleDateString()}</p>
          <p>This Privacy Policy explains how we collect, use, and share information from users of our application.</p>
          
          <h2 className="text-2xl font-bold text-white mt-8 tracking-wide">Information Collection</h2>
          <p>We do not store your video feeds. All video communication is transmitted peer-to-peer via WebRTC and is not recorded by our servers. Video URLs provided to create rooms are stored temporarily in our database.</p>
          
          <h2 className="text-2xl font-bold text-white mt-8 tracking-wide">Usage Data</h2>
          <p>We may log anonymized usage data and room identifiers for debugging and scaling purposes, but no personal identification is permanently stored.</p>

          <h2 className="text-2xl font-bold text-white mt-8 tracking-wide">Rights & Ownership</h2>
          <p>All rights reserved by <strong>Ansh Singh</strong>.</p>
        </div>
      </div>
    </div>
  );
}
