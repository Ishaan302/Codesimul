import { useState } from "react";
import { useNavigate } from "react-router-dom";

const fieldClass = "w-full rounded-lg border border-[#282c33] bg-[#090b0f] px-3 py-2.5 text-sm text-slate-100 placeholder:text-slate-600 outline-none transition focus:border-violet-500 focus:ring-1 focus:ring-violet-500";

function Home() {
  const navigate = useNavigate();
  const [showCreateRoom, setShowCreateRoom] = useState(false);
  const [roomCode, setRoomCode] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [username, setUsername] = useState("");
  const [createUsername, setCreateUsername] = useState("");
  const [joinPassword, setJoinPassword] = useState("");
  const [createPassword, setCreatePassword] = useState("");

  const generateRoomCode = () => {
    setRoomCode(Math.random().toString(36).substring(2, 8).toUpperCase());
    setShowCreateRoom(true);
  };

  const handleJoinRoom = () => {
    if (!joinCode.trim() || !username.trim()) return alert("Please enter both room code and username");
    navigate(`/room/${joinCode.trim()}`, { state: { username: username.trim(), password: joinPassword } });
  };

  const handleCreateRoom = () => {
    if (!createUsername.trim()) return alert("Please enter your username");
    navigate(`/room/${roomCode}`, { state: { username: createUsername.trim(), password: createPassword } });
  };

  return (
    <main className="min-h-screen bg-[#09090b] px-4 py-12 text-slate-100 flex items-center justify-center">
      <section className="w-full max-w-[400px]">
        <header className="mb-8 text-center">
          <h1 className="text-2xl font-semibold tracking-tight">Code <span className="text-violet-400">Simul</span></h1>
          <p className="mt-1 text-sm text-slate-500">Real-time collaborative coding</p>
        </header>

        <div className="rounded-xl border border-[#282b31] bg-[#17181c] p-7 shadow-2xl shadow-black/20">
          {!showCreateRoom ? (
            <>
              <label className="mb-2 block text-sm text-slate-300">Your name</label>
              <input className={fieldClass} value={username} onChange={(e) => setUsername(e.target.value)} placeholder="Enter your name" maxLength={20} />

              <label className="mb-2 mt-5 block text-sm text-slate-300">Room code</label>
              <div className="relative"><span className="pointer-events-none absolute left-3 top-2.5 font-mono text-sm text-sky-400">&gt;</span><input className={`${fieldClass} pl-7 font-mono tracking-widest`} value={joinCode} onChange={(e) => setJoinCode(e.target.value.toUpperCase())} placeholder="XXXXXX" maxLength={30} /></div>

              <label className="mb-2 mt-5 block text-sm text-slate-300">Room password <span className="text-slate-600">(optional)</span></label>
              <input className={fieldClass} type="password" value={joinPassword} onChange={(e) => setJoinPassword(e.target.value)} placeholder="Enter if the room is protected" maxLength={128} />

              <button onClick={handleJoinRoom} className="mt-5 w-full rounded-lg bg-[#8579e5] py-2.5 text-sm font-medium text-[#0c0c10] transition hover:bg-[#978cf0]">Join room</button>
              <div className="my-7 flex items-center gap-3 text-xs text-slate-600"><span className="h-px flex-1 bg-[#292c31]" />OR<span className="h-px flex-1 bg-[#292c31]" /></div>
              <button onClick={generateRoomCode} className="w-full rounded-lg border border-[#303238] py-2.5 text-sm font-medium transition hover:bg-[#202126]">Create new room</button>
            </>
          ) : (
            <>
              <p className="text-sm text-slate-400">Your room code</p>
              <p className="mt-2 rounded-lg border border-[#292d34] bg-[#0b0d11] px-4 py-3 text-center font-mono text-2xl font-semibold tracking-[0.25em] text-violet-300">{roomCode}</p>
              <label className="mb-2 mt-5 block text-sm text-slate-300">Your name</label>
              <input className={fieldClass} value={createUsername} onChange={(e) => setCreateUsername(e.target.value)} placeholder="Enter your name" maxLength={20} />
              <label className="mb-2 mt-5 block text-sm text-slate-300">Room password <span className="text-slate-600">(optional)</span></label>
              <input className={fieldClass} type="password" value={createPassword} onChange={(e) => setCreatePassword(e.target.value)} placeholder="Leave blank for an open room" maxLength={128} />
              <button onClick={handleCreateRoom} className="mt-5 w-full rounded-lg bg-[#8579e5] py-2.5 text-sm font-medium text-[#0c0c10] transition hover:bg-[#978cf0]">Enter room</button>
              <button onClick={() => setShowCreateRoom(false)} className="mt-3 w-full py-2 text-sm text-slate-500 hover:text-slate-200">Back</button>
            </>
          )}
        </div>
        <p className="mt-7 text-center text-xs text-slate-600">Powered by Socket.IO</p>
      </section>
    </main>
  );
}

export default Home;
