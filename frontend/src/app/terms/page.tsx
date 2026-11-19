export default function TermsAndConditions() {
  return (
    <div className="min-h-screen bg-[#06080D] text-white p-8 md:p-16 font-sans">
      <div className="max-w-3xl mx-auto backdrop-blur-xl bg-white/5 p-10 rounded-3xl border border-white/10 shadow-[0_8px_32px_rgba(0,0,0,0.37)]">
        <h1 className="text-4xl font-black mb-8 text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-500 tracking-wide">Terms and Conditions</h1>
        <div className="space-y-6 text-gray-300 leading-relaxed font-light">
          <p>Welcome to our application. By accessing or using our service, you agree to be bound by these terms.</p>
          
          <h2 className="text-2xl font-bold text-white mt-8 tracking-wide">Usage Guidelines</h2>
          <p>You agree not to use the service for any illegal activities. You are solely responsible for the content you stream or share via URLs within your rooms.</p>
          
          <h2 className="text-2xl font-bold text-white mt-8 tracking-wide">Intellectual Property</h2>
          <p>The Service and its original content, features, architecture, and functionality are and will remain the exclusive property of <strong>Ansh Singh</strong> and its licensors. All rights reserved.</p>
          
          <h2 className="text-2xl font-bold text-white mt-8 tracking-wide">Limitation of Liability</h2>
          <p>We shall not be held liable for any damages that arise from the use of this service.</p>
        </div>
      </div>
    </div>
  );
}
