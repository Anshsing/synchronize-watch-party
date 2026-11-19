import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="w-full h-screen bg-[#06080D] flex flex-col items-center justify-center text-white font-sans px-4">
      <h1 className="text-9xl font-black text-transparent bg-clip-text bg-gradient-to-br from-blue-400 via-purple-500 to-indigo-600 mb-6 drop-shadow-2xl tracking-tighter">
        404
      </h1>
      <p className="text-2xl text-gray-400 mb-8 tracking-widest">NODE NOT FOUND</p>
      <Link href="/">
        <button className="bg-gradient-to-r from-blue-600 to-indigo-700 hover:from-blue-500 hover:to-indigo-600 text-white font-bold py-3 px-8 rounded-xl transition-all duration-300 shadow-[0_0_20px_rgba(79,70,229,0.3)] hover:shadow-[0_0_30px_rgba(79,70,229,0.5)] transform hover:-translate-y-0.5">
          RETURN TO CORE
        </button>
      </Link>
    </div>
  );
}
