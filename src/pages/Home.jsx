import { useState } from "react";
import { useNavigate } from "react-router-dom";
import DotGrid from "../components/DotGrid";

const fieldClass =
  "w-full rounded-xl border border-[#282c33] bg-[#090b0f]/80 px-4 py-3.5 text-base text-slate-100 placeholder:text-slate-600 outline-none transition focus:border-[#00C2D7] focus:ring-1 focus:ring-[#00C2D7]";

function Home() {
  const navigate = useNavigate();

  const [showCreateRoom, setShowCreateRoom] =
    useState(false);

  const [roomCode, setRoomCode] =
    useState("");

  const [joinCode, setJoinCode] =
    useState("");

  const [username, setUsername] =
    useState("");

  const [createUsername, setCreateUsername] =
    useState("");

  const [joinPassword, setJoinPassword] =
    useState("");

  const [createPassword, setCreatePassword] =
    useState("");

  /*
   * ----------------------------------------
   * CREATE ROOM CODE
   * ----------------------------------------
   */

  const generateRoomCode = () => {
    setRoomCode(
      Math.random()
        .toString(36)
        .substring(2, 8)
        .toUpperCase()
    );

    setShowCreateRoom(true);
  };

  /*
   * ----------------------------------------
   * JOIN ROOM
   * ----------------------------------------
   */

  const handleJoinRoom = () => {
    if (
      !joinCode.trim() ||
      !username.trim()
    ) {
      return alert(
        "Please enter both room code and username"
      );
    }

    navigate(
      `/room/${joinCode.trim()}`,
      {
        state: {
          username:
            username.trim(),
          password:
            joinPassword,
        },
      }
    );
  };

  /*
   * ----------------------------------------
   * CREATE ROOM
   * ----------------------------------------
   */

  const handleCreateRoom = () => {
    if (!createUsername.trim()) {
      return alert(
        "Please enter your username"
      );
    }

    navigate(
      `/room/${roomCode}`,
      {
        state: {
          username:
            createUsername.trim(),
          password:
            createPassword,
        },
      }
    );
  };

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#090909] px-4 py-12 text-slate-100">

      {/* =====================================
          DOT GRID BACKGROUND
          ===================================== */}

      <DotGrid
        dotSize={5}
        gap={22}
        baseColor="#202A2A"
        activeColor="#00C2D7"
        proximity={180}
        shockRadius={220}
        shockStrength={60}
        resistance={1650}
        returnDuration={1.5}
        className="absolute inset-0 z-0"
      />

      {/* =====================================
          MAIN CONTENT
          ===================================== */}

      <div className="relative z-10 w-full max-w-[540px]">

        <section className="w-full">

          {/* =================================
              HEADER
              ================================= */}

          <header className="mb-10 text-center">

            <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">
              Code{" "}
              <span className="text-[#00C2D7]">
                Simul
              </span>
            </h1>

            <p className="mt-2 text-base text-slate-500 sm:text-lg">
              Real-time collaborative coding
            </p>

          </header>

          {/* =================================
              CARD
              ================================= */}

          <div className="relative overflow-hidden rounded-2xl p-8 sm:p-10">

            {/* =================================
                DOT GRID INSIDE CARD
                ================================= */}

            <div className="absolute inset-0 z-0 pointer-events-none">

              <DotGrid
                dotSize={5}
                gap={22}
                baseColor="#202A2A"
                activeColor="#00C2D7"
                proximity={180}
                shockRadius={340}
                shockStrength={11}
                resistance={1650}
                returnDuration={1.5}
              />

            </div>

            {/* =================================
                CARD CONTENT
                ================================= */}

            <div className="relative z-10">

              {!showCreateRoom ? (
                <>
                  {/* ===========================
                      USERNAME
                      =========================== */}

                  <label className="mb-2.5 block text-base text-slate-300">
                    Your name
                  </label>

                  <input
                    className={fieldClass}
                    value={username}
                    onChange={(e) =>
                      setUsername(
                        e.target.value
                      )
                    }
                    placeholder="Enter your name"
                    maxLength={20}
                  />

                  {/* ===========================
                      ROOM CODE
                      =========================== */}

                  <label className="mb-2.5 mt-6 block text-base text-slate-300">
                    Room code
                  </label>

                  <div className="relative">

                    <span className="pointer-events-none absolute left-4 top-3.5 font-mono text-base text-[#00C2D7]">
                      &gt;
                    </span>

                    <input
                      className={`${fieldClass} pl-9 font-mono tracking-widest`}
                      value={joinCode}
                      onChange={(e) =>
                        setJoinCode(
                          e.target.value.toUpperCase()
                        )
                      }
                      placeholder="XXXXXX"
                      maxLength={30}
                    />

                  </div>

                  {/* ===========================
                      PASSWORD
                      =========================== */}

                  <label className="mb-2.5 mt-6 block text-base text-slate-300">
                    Room password{" "}
                    <span className="text-slate-600">
                      (optional)
                    </span>
                  </label>

                  <input
                    className={fieldClass}
                    type="password"
                    value={joinPassword}
                    onChange={(e) =>
                      setJoinPassword(
                        e.target.value
                      )
                    }
                    placeholder="Enter if the room is protected"
                    maxLength={128}
                  />

                  {/* ===========================
                      JOIN ROOM
                      =========================== */}

                  <button
                    onClick={handleJoinRoom}
                    className="mt-6 w-full rounded-xl bg-[#00C2D7] py-3.5 text-base font-medium text-[#0c0c10] transition hover:bg-[#20D9EA]"
                  >
                    Join room
                  </button>

                  {/* ===========================
                      DIVIDER
                      =========================== */}

                  <div className="my-8 flex items-center gap-4 text-sm text-slate-600">

                    <span className="h-px flex-1 bg-[#292c31]" />

                    OR

                    <span className="h-px flex-1 bg-[#292c31]" />

                  </div>

                  {/* ===========================
                      CREATE ROOM
                      =========================== */}

                  <button
                    onClick={generateRoomCode}
                    className="w-full rounded-xl border border-[#303238] py-3.5 text-base font-medium transition hover:bg-[#202126]"
                  >
                    Create new room
                  </button>
                </>
              ) : (
                <>
                  {/* ===========================
                      ROOM CODE
                      =========================== */}

                  <p className="text-base text-slate-400">
                    Your room code
                  </p>

                  <p className="mt-3 rounded-xl border border-[#292d34] bg-[#0b0d11]/80 px-4 py-4 text-center font-mono text-3xl font-semibold tracking-[0.25em] text-[#00C2D7]">
                    {roomCode}
                  </p>

                  {/* ===========================
                      USERNAME
                      =========================== */}

                  <label className="mb-2.5 mt-6 block text-base text-slate-300">
                    Your name
                  </label>

                  <input
                    className={fieldClass}
                    value={createUsername}
                    onChange={(e) =>
                      setCreateUsername(
                        e.target.value
                      )
                    }
                    placeholder="Enter your name"
                    maxLength={20}
                  />

                  {/* ===========================
                      PASSWORD
                      =========================== */}

                  <label className="mb-2.5 mt-6 block text-base text-slate-300">
                    Room password{" "}
                    <span className="text-slate-600">
                      (optional)
                    </span>
                  </label>

                  <input
                    className={fieldClass}
                    type="password"
                    value={createPassword}
                    onChange={(e) =>
                      setCreatePassword(
                        e.target.value
                      )
                    }
                    placeholder="Leave blank for an open room"
                    maxLength={128}
                  />

                  {/* ===========================
                      ENTER ROOM
                      =========================== */}

                  <button
                    onClick={handleCreateRoom}
                    className="mt-6 w-full rounded-xl bg-[#00C2D7] py-3.5 text-base font-medium text-[#0c0c10] transition hover:bg-[#20D9EA]"
                  >
                    Enter room
                  </button>

                  {/* ===========================
                      BACK
                      =========================== */}

                  <button
                    onClick={() =>
                      setShowCreateRoom(false)
                    }
                    className="mt-4 w-full py-2.5 text-base text-slate-500 hover:text-slate-200"
                  >
                    Back
                  </button>
                </>
              )}

            </div>
          </div>

          {/* =================================
              FOOTER
              ================================= */}

          <p className="mt-8 text-center text-sm text-slate-600">
            Powered by Socket.IO
          </p>

        </section>

      </div>

    </main>
  );
}

export default Home;