import { useState, useRef, useEffect, useCallback } from "react";
import { useNavigate, useParams, useLocation } from "react-router-dom";
import Editor from "@monaco-editor/react";
import socket from "../socket";

const BACKEND_URL =
  process.env.REACT_APP_BACKEND_URL || "http://localhost:5001";

const LANGUAGES = {
  cpp: { label: "C++", fileName: "main.cpp", monaco: "cpp" },
  python: { label: "Python", fileName: "main.py", monaco: "python" },
  java: { label: "Java", fileName: "Main.java", monaco: "java" },
};

function Room() {
  const navigate = useNavigate();
  const location = useLocation();
  const { roomId } = useParams();

  const isRemoteUpdate = useRef(false);
  const hasJoined = useRef(false);

  const username = location.state?.username || "Guest";
  const password = location.state?.password || "";

  /* =========================================================
     CODEFORCES
  ========================================================= */

  const fetchCFMeta = async (contestId, index) => {
    try {
      const res = await fetch(
        `${BACKEND_URL}/cf/meta?contestId=${contestId}&index=${index}`
      );

      const data = await res.json();

      if (
        data.status === "OK" &&
        data.result &&
        data.result.problem
      ) {
        return data.result.problem;
      }

      return null;
    } catch (err) {
      console.error("CF fetch error:", err);
      return null;
    }
  };

  const parseCodeforcesLink = (link) => {
    try {
      const url = new URL(link);
      const path = url.pathname;
      const parts = path.split("/").filter(Boolean);

      if (
        parts[0] === "problemset" &&
        parts[1] === "problem"
      ) {
        return {
          contestId: parts[2],
          index: parts[3],
        };
      }

      if (
        parts[0] === "contest" &&
        parts[2] === "problem"
      ) {
        return {
          contestId: parts[1],
          index: parts[3],
        };
      }

      return null;
    } catch {
      return null;
    }
  };

  /* =========================================================
     STATE
  ========================================================= */

  const [, setParsedQuestion] = useState(null);
  const [problemData, setProblemData] = useState(null);

  // Manual horizontal resizing
  const [leftWidth, setLeftWidth] = useState(245);
  const [rightWidth, setRightWidth] = useState(300);

  // Manual vertical resizing
  const [topRightHeight, setTopRightHeight] = useState(80);

  const [isResizingX, setIsResizingX] = useState(false);
  const [isResizingY, setIsResizingY] = useState(false);

  const [questionLink, setQuestionLink] = useState("");

  const [code, setCode] = useState(
    "// Start coding here...\n"
  );
  const [language, setLanguage] = useState("cpp");

  const [output, setOutput] = useState("");
  const [input, setInput] = useState("");

  const [, setIncomingProblem] =
    useState(null);

  const [members, setMembers] = useState([]);

  const [, setNotifications] =
    useState([]);

  const [typingUsers, setTypingUsers] =
    useState(new Set());

  const [contest, setContest] = useState({ active: false, submissions: [] });
  const [contestRemainingMs, setContestRemainingMs] = useState(0);

  const [whiteboardOpen, setWhiteboardOpen] =
    useState(true);

  const canvasRef = useRef(null);
  const drawing = useRef(false);
  const editorRef = useRef(null);

  // Whiteboard color
  const [strokeColor, setStrokeColor] =
    useState("black");

  const typingTimeoutRef = useRef(null);

  /* =========================================================
     NOTIFICATIONS
  ========================================================= */

  const showNotification = useCallback(
    (message, type = "info") => {
      const id = Date.now();

      setNotifications((prev) => [
        ...prev,
        {
          id,
          message,
          type,
        },
      ]);

      setTimeout(() => {
        setNotifications((prev) =>
          prev.filter(
            (n) => n.id !== id
          )
        );
      }, 3000);
    },
    []
  );

  /* =========================================================
     USER COLORS
  ========================================================= */

  const getColorForUser = (index) => {
    const colors = [
      "bg-[#7c72d9]",
      "bg-[#e05b2f]",
      "bg-[#16a085]",
      "bg-[#5b8def]",
      "bg-[#a66dd4]",
      "bg-[#d97732]",
      "bg-[#3b82f6]",
      "bg-[#22c55e]",
    ];

    return colors[
      index % colors.length
    ];
  };

  /* =========================================================
     SOCKET CONNECTION
  ========================================================= */

  useEffect(() => {
    if (
      !username ||
      username === "Guest"
    ) {
      alert(
        "Please enter your name first"
      );

      navigate("/");
      return;
    }

    console.log(
      "🔌 Connecting socket..."
    );

    socket.connect();

    const handleConnect = () => {
      console.log(
        "✅ Connected:",
        socket.id
      );

      // Execution output is local to this browser session. Clear any result
      // preserved by Fast Refresh or a reconnect so it is never mistaken for
      // the result of a new run after restarting either server.
      setOutput("");

      if (!hasJoined.current) {
        socket.emit("join-room", {
          roomId,
          username,
          password,
        });

        hasJoined.current = true;
      }
    };

    const handleDisconnect = () => {
      console.log("❌ Disconnected");

      hasJoined.current = false;
    };

    const handleRoomUsers = (
      users
    ) => {
      console.log(
        "👥 Room users:",
        users
      );

      setMembers(users);
    };

    const handleUserJoined = ({
      username: newUser,
      socketId,
    }) => {
      if (
        socketId !== socket.id
      ) {
        console.log(
          `🟢 ${newUser} joined`
        );

        showNotification(
          `${newUser} joined the room`,
          "join"
        );
      }
    };

    const handleUserLeft = ({
      username: leftUser,
    }) => {
      console.log(
        `🔴 ${leftUser} left`
      );

      showNotification(
        `${leftUser} left the room`,
        "leave"
      );
    };

    const handleCodeUpdate = (
      newCode
    ) => {
      console.log(
        "📝 Code update received"
      );

      isRemoteUpdate.current =
        true;

      setCode(newCode);

      setTimeout(
        () =>
        (isRemoteUpdate.current =
          false),
        0
      );
    };

    const handleRoomLanguage = (nextLanguage) => {
      if (LANGUAGES[nextLanguage]) setLanguage(nextLanguage);
    };

    const handleContestState = (nextContest) => {
      setContest(nextContest || { active: false, submissions: [] });
    };

    const handleDraw = ({
      x0,
      y0,
      x1,
      y1,
      color,
    }) => {
      const canvas =
        canvasRef.current;

      if (!canvas) return;

      const ctx =
        canvas.getContext("2d");

      ctx.strokeStyle = color;

      ctx.beginPath();
      ctx.moveTo(x0, y0);
      ctx.lineTo(x1, y1);
      ctx.stroke();
    };

    const handleClearBoard = () => {
      const canvas =
        canvasRef.current;

      if (!canvas) return;

      const ctx =
        canvas.getContext("2d");

      ctx.clearRect(
        0,
        0,
        canvas.width,
        canvas.height
      );
    };

    const handleOpenProblem = ({
      link,
      sender,
    }) => {
      if (
        sender !== socket.id
      ) {
        setIncomingProblem(
          link
        );
      }
    };

    const handleUserTyping = ({
      username,
      isTyping,
    }) => {
      setTypingUsers((prev) => {
        const newSet = new Set(
          prev
        );

        if (isTyping) {
          newSet.add(username);
        } else {
          newSet.delete(username);
        }

        return newSet;
      });
    };

    const handleErrorMessage = (
      message
    ) => {
      showNotification(
        message,
        "error"
      );

      if (
        /password/i.test(
          message
        )
      ) {
        hasJoined.current =
          false;

        alert(message);

        navigate("/");
      }
    };

    if (
      socket.connected &&
      !hasJoined.current
    ) {
      handleConnect();
    }

    socket.on(
      "connect",
      handleConnect
    );

    socket.on(
      "disconnect",
      handleDisconnect
    );

    socket.on(
      "room-users",
      handleRoomUsers
    );

    socket.on(
      "user-joined",
      handleUserJoined
    );

    socket.on(
      "user-left",
      handleUserLeft
    );

    socket.on(
      "code-update",
      handleCodeUpdate
    );

    socket.on(
      "room-language",
      handleRoomLanguage
    );
    socket.on("contest-state", handleContestState);
    socket.on("contest-ended", handleContestState);

    socket.on(
      "draw",
      handleDraw
    );

    socket.on(
      "clear-board",
      handleClearBoard
    );

    socket.on(
      "open-problem",
      handleOpenProblem
    );

    socket.on(
      "user-typing",
      handleUserTyping
    );

    socket.on(
      "error-message",
      handleErrorMessage
    );

    return () => {
      console.log(
        "🧹 Cleanup"
      );

      socket.off(
        "connect",
        handleConnect
      );

      socket.off(
        "disconnect",
        handleDisconnect
      );

      socket.off(
        "room-users",
        handleRoomUsers
      );

      socket.off(
        "user-joined",
        handleUserJoined
      );

      socket.off(
        "user-left",
        handleUserLeft
      );

      socket.off(
        "code-update",
        handleCodeUpdate
      );

      socket.off(
        "room-language",
        handleRoomLanguage
      );
      socket.off("contest-state", handleContestState);
      socket.off("contest-ended", handleContestState);

      socket.off(
        "draw",
        handleDraw
      );

      socket.off(
        "clear-board",
        handleClearBoard
      );

      socket.off(
        "open-problem",
        handleOpenProblem
      );

      socket.off(
        "user-typing",
        handleUserTyping
      );

      socket.off(
        "error-message",
        handleErrorMessage
      );

      socket.disconnect();

      hasJoined.current =
        false;
    };
  }, [
    roomId,
    username,
    password,
    navigate,
    showNotification,
  ]);

  useEffect(() => {
    const updateCountdown = () => {
      if (!contest.active) return setContestRemainingMs(0);
      setContestRemainingMs(Math.max(0, contest.startTime + contest.durationMs - Date.now()));
    };
    updateCountdown();
    const timerId = setInterval(updateCountdown, 1000);
    return () => clearInterval(timerId);
  }, [contest]);

  /* =========================================================
     CANVAS RESIZE
  ========================================================= */

  useEffect(() => {
    const canvas =
      canvasRef.current;

    if (!canvas) return;

    const resizeCanvas = () => {
      const rect =
        canvas.getBoundingClientRect();

      if (
        rect.width <= 0 ||
        rect.height <= 0
      ) {
        return;
      }

      const ctx =
        canvas.getContext("2d");

      const dpr =
        window.devicePixelRatio ||
        1;

      canvas.width =
        rect.width * dpr;

      canvas.height =
        rect.height * dpr;

      ctx.setTransform(
        dpr,
        0,
        0,
        dpr,
        0,
        0
      );

      ctx.lineWidth = 3;
      ctx.lineCap = "round";
    };

    resizeCanvas();

    window.addEventListener(
      "resize",
      resizeCanvas
    );

    return () => {
      window.removeEventListener(
        "resize",
        resizeCanvas
      );
    };
  }, [
    leftWidth,
    rightWidth,
    topRightHeight,
  ]);

  /* =========================================================
     WHITEBOARD
  ========================================================= */

  const getCanvasPos = (e) => {
    const canvas =
      canvasRef.current;

    if (!canvas) {
      return {
        x: 0,
        y: 0,
      };
    }

    const rect =
      canvas.getBoundingClientRect();

    return {
      x:
        e.clientX -
        rect.left,

      y:
        e.clientY -
        rect.top,
    };
  };

  const startDraw = (e) => {
    const canvas =
      canvasRef.current;

    if (!canvas) return;

    const ctx =
      canvas.getContext("2d");

    drawing.current = true;

    const {
      x,
      y,
    } = getCanvasPos(e);

    ctx.beginPath();
    ctx.moveTo(x, y);

    ctx.strokeStyle =
      strokeColor;

    ctx.currentX = x;
    ctx.currentY = y;
  };

  const draw = (e) => {
    if (!drawing.current)
      return;

    const canvas =
      canvasRef.current;

    if (!canvas) return;

    const ctx =
      canvas.getContext("2d");

    const {
      x,
      y,
    } = getCanvasPos(e);

    const prevX =
      ctx.currentX || x;

    const prevY =
      ctx.currentY || y;

    ctx.lineTo(x, y);
    ctx.stroke();

    socket.emit("draw", {
      roomId,
      x0: prevX,
      y0: prevY,
      x1: x,
      y1: y,
      color: strokeColor,
    });

    ctx.currentX = x;
    ctx.currentY = y;
  };

  const stopDraw = () => {
    drawing.current = false;
  };

  const clearBoard = () => {
    const canvas =
      canvasRef.current;

    if (!canvas) return;

    const ctx =
      canvas.getContext("2d");

    ctx.clearRect(
      0,
      0,
      canvas.width,
      canvas.height
    );

    socket.emit(
      "clear-board",
      roomId
    );
  };

  /* =========================================================
     LOAD PROBLEM
  ========================================================= */

  const handleLoadProblem =
    async () => {
      if (
        !questionLink ||
        questionLink.trim() === ""
      ) {
        alert(
          "Please paste a valid problem link"
        );

        return;
      }

      const trimmedLink =
        questionLink.trim();

      if (
        !trimmedLink.startsWith(
          "http://"
        ) &&
        !trimmedLink.startsWith(
          "https://"
        )
      ) {
        alert(
          "Please enter a valid URL"
        );

        return;
      }

      const parsed =
        parseCodeforcesLink(
          trimmedLink
        );

      if (parsed) {
        try {
          const data =
            await fetchCFMeta(
              parsed.contestId,
              parsed.index
            );

          if (data) {
            setProblemData(
              data
            );

            setParsedQuestion(
              parsed
            );
          }
        } catch (err) {
          console.error(
            "Failed to fetch CF metadata:",
            err
          );
        }
      }

      window.open(
        trimmedLink,
        "_blank"
      );

      socket.emit(
        "open-problem",
        {
          roomId,
          link: trimmedLink,
          sender: socket.id,
        }
      );
    };

  /* =========================================================
     RUN CODE
  ========================================================= */

  const handleRunCode =
    async () => {
      setOutput(
        "Running code..."
      );

      try {
        if (contest.active) {
          const data = await new Promise((resolve) => socket.emit("contest-submit", { roomId, code, language }, resolve));
          if (data?.error) throw new Error(data.error);
          setOutput(data?.output || "No output");
          showNotification(data?.passed ? "Contest submission accepted" : "Contest submission did not match the expected output", data?.passed ? "success" : "error");
          return;
        }

        const res =
          await fetch(
            `${BACKEND_URL}/run`,
            {
              method: "POST",

              headers: {
                "Content-Type":
                  "application/json",
              },

              body: JSON.stringify({
                code,
                input,
                language,
              }),
            }
          );

        const data =
          await res.json();

        setOutput(
          data.output ||
          "No output"
        );
      } catch {
        setOutput(
          "Error connecting to backend"
        );
      }
    };

  const handleLanguageChange = (nextLanguage) => {
    if (!LANGUAGES[nextLanguage]) return;
    setLanguage(nextLanguage);
    socket.emit("language-change", { roomId, language: nextLanguage });
  };

  const handleStartContest = () => {
    const durationMinutes = Number(window.prompt("Contest duration in minutes (1–180):", "30"));
    if (!Number.isFinite(durationMinutes)) return;
    const expectedOutput = window.prompt("Expected output for the current input:", "");
    if (expectedOutput === null) return;
    socket.emit("start-contest", { roomId, durationMinutes, problemLink: questionLink, input, expectedOutput }, (response) => {
      if (!response?.ok) showNotification(response?.error || "Could not start contest", "error");
    });
  };

  const contestLeaderboard = [...(contest.submissions || [])]
    .filter((submission) => submission.passed)
    .sort((a, b) => a.timestamp - b.timestamp)
    .filter((submission, index, all) => all.findIndex((candidate) => candidate.socketId === submission.socketId) === index);

  const formatCountdown = (milliseconds) => {
    const totalSeconds = Math.ceil(milliseconds / 1000);
    return `${String(Math.floor(totalSeconds / 60)).padStart(2, "0")}:${String(totalSeconds % 60).padStart(2, "0")}`;
  };

  /* =========================================================
     LEAVE
  ========================================================= */

  const handleLeaveRoom =
    () => {
      if (
        window.confirm(
          "Leave the room?"
        )
      ) {
        navigate("/");
      }
    };
  
  /* =========================================================
     CODE CHANGE
  ========================================================= */
  

  const handleCodeChange =
    (value) => {
      const newCode =
        value || "";

      setCode(newCode);

      if (
        !isRemoteUpdate.current
      ) {
        socket.emit(
          "code-change",
          {
            roomId,
            code: newCode,
          }
        );

        socket.emit(
          "typing-start",
          {
            roomId,
            username,
          }
        );

        if (
          typingTimeoutRef.current
        ) {
          clearTimeout(
            typingTimeoutRef.current
          );
        }

        typingTimeoutRef.current =
          setTimeout(() => {
            socket.emit(
              "typing-stop",
              {
                roomId,
                username,
              }
            );
          }, 2000);
      }
    };

  /* =========================================================
     RENDER
  ========================================================= */

  return (
    <div className="h-screen w-full overflow-hidden bg-[#0b0b0d] text-[#d4d4d8] flex flex-col">

      {/* =====================================================
          HEADER
      ====================================================== */}

      <header className="h-[52px] shrink-0 border-b border-[#27272a] bg-[#0b0b0d] px-5 flex items-center justify-between">

        {/* LEFT SIDE */}

        <div className="flex items-center gap-4">

          <span className="font-semibold text-[15px] tracking-tight text-[#e4e4e7]">
            Code Simul
          </span>

          <span className="rounded-md border border-[#27272a] bg-[#18181b] px-2.5 py-1 font-mono text-[11px] text-[#8b7fe8]">
            {roomId}
          </span>

          <span className="flex items-center text-[12px] text-[#a1a1aa]">

            <span className="mr-2 h-1.5 w-1.5 rounded-full bg-[#8b7fe8]" />

            {members.length} connected

          </span>

          {contest.active && (
            <span className="font-mono text-[11px] text-[#fbbf24]">
              CONTEST {formatCountdown(contestRemainingMs)}
            </span>
          )}

        </div>

        {/* RIGHT SIDE */}

        <div className="flex items-center gap-3">

          {/* USER AVATARS */}

          <div className="flex -space-x-1.5 mr-2">

            {members
              .slice(0, 4)
              .map(
                (
                  member,
                  idx
                ) => (
                  <span
                    key={
                      member.socketId
                    }
                    title={
                      member.username
                    }
                    className={`h-7 w-7 rounded-full border-2 border-[#0b0b0d] ${getColorForUser(
                      idx
                    )} flex items-center justify-center font-mono text-[9px] font-semibold text-[#09090b]`}
                  >
                    {member.username?.[0]?.toUpperCase()}
                  </span>
                )
              )}

          </div>

          <button
            onClick={handleLeaveRoom}
            className="rounded-lg border border-[#27272a] bg-transparent px-4 py-2 text-[12px] font-medium text-[#d4d4d8] hover:bg-[#18181b]"
          >
            Leave
          </button>

          <button
            onClick={
              handleRunCode
            }
            className="rounded-lg bg-[#8176dc] px-4 py-2 text-[12px] font-semibold text-white hover:bg-[#7569d1]"
          >
            Run code
          </button>

          <button
            onClick={handleStartContest}
            disabled={contest.active}
            className="rounded-lg border border-[#f59e0b] px-4 py-2 text-[12px] font-semibold text-[#fbbf24] hover:bg-[#2a2112] disabled:opacity-50"
          >
            {contest.active ? "Contest active" : "Start contest"}
          </button>

        </div>

      </header>

      {/* =====================================================
          MAIN LAYOUT
      ====================================================== */}

      <main
        className="min-w-0 min-h-0 flex-1 grid"
        style={{
          gridTemplateColumns: `${leftWidth}px 6px minmax(0,1fr) 6px ${rightWidth}px`,
        }}
      >

        {/* ===================================================
            LEFT PROBLEM PANEL
        ==================================================== */}

        <aside className="min-w-0 min-h-0 overflow-y-auto overflow-x-hidden bg-[#0d0d0f] px-[14px] pt-[18px]">

          <p className="mb-[10px] text-[11px] font-medium tracking-wide text-[#71717a]">
            PROBLEM
          </p>

          <div className="rounded-[9px] bg-[#19191c] p-[14px]">

            {problemData ? (
              <>

                <p className="text-[14px] font-semibold text-[#e4e4e7]">
                  {
                    problemData.name
                  }
                </p>

                {problemData.tags &&
                  problemData.tags
                    .length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-1.5">

                      {problemData.tags
                        .slice(
                          0,
                          3
                        )
                        .map(
                          (
                            tag
                          ) => (
                            <span
                              key={
                                tag
                              }
                              className="rounded bg-[#27272a] px-2 py-1 text-[10px] text-[#a1a1aa]"
                            >
                              {
                                tag
                              }
                            </span>
                          )
                        )}

                    </div>
                  )}

                <p className="mt-3 text-[11px] font-medium text-[#f97316]">
                  Rating{" "}
                  {
                    problemData.rating ||
                    "—"
                  }
                </p>

              </>
            ) : (
              <>

                <p className="text-[14px] font-semibold text-[#e4e4e7]">
                  Problem
                </p>

                <p className="mt-2 text-[11px] text-[#71717a]">
                  Paste a Codeforces
                  link to begin.
                </p>

                <input
                  value={
                    questionLink
                  }
                  onChange={(e) =>
                    setQuestionLink(
                      e.target.value
                    )
                  }
                  placeholder="Paste problem link"
                  className="mt-3 w-full rounded-md border border-[#27272a] bg-[#111113] px-2.5 py-2 text-[11px] text-[#d4d4d8] outline-none placeholder:text-[#52525b] focus:border-[#8176dc]"
                />

                <button
                  onClick={
                    handleLoadProblem
                  }
                  className="mt-2 text-[11px] text-[#8b7fe8] hover:text-[#a49bea]"
                >
                  Load problem ↗
                </button>

              </>
            )}

          </div>

          {/* PARTICIPANTS */}

          <p className="mb-3 mt-6 text-[11px] font-medium tracking-wide text-[#71717a]">
            PARTICIPANTS
          </p>

          <div className="space-y-3">

            {members.map(
              (
                member,
                idx
              ) => (
                <div
                  key={
                    member.socketId
                  }
                  className="flex items-center gap-3"
                >

                  <span
                    className={`h-5 w-5 shrink-0 rounded-full ${getColorForUser(
                      idx
                    )} flex items-center justify-center font-mono text-[8px] font-semibold text-[#09090b]`}
                  >
                    {member.username?.[0]?.toUpperCase()}
                  </span>

                  <span className="truncate font-mono text-[11px] text-[#d4d4d8]">
                    {
                      member.username
                    }
                  </span>

                </div>
              )
            )}

          </div>

          {typingUsers.size >
            0 && (
              <p className="mt-3 font-mono text-[11px] italic text-[#71717a]">
                {Array.from(
                  typingUsers
                ).join(", ")}{" "}
                {typingUsers.size ===
                  1
                  ? "is"
                  : "are"}{" "}
                typing...
              </p>
            )}

        </aside>

        {/* ===================================================
            RESIZER: SIDEBAR ↔ EDITOR
        ==================================================== */}

        <div
          className="w-[6px] bg-[#27272a] hover:bg-[#8176dc] cursor-col-resize transition-colors"
          onMouseDown={(e) => {

            e.preventDefault();

            const startX =
              e.clientX;

            const startWidth =
              leftWidth;

            setIsResizingX(true);

            document.body.style.userSelect =
              "none";

            document.body.style.cursor =
              "col-resize";

            const move = (
              event
            ) => {

              const delta =
                event.clientX -
                startX;

              setLeftWidth(
                Math.min(
                  480,
                  Math.max(
                    180,
                    startWidth +
                    delta
                  )
                )
              );
            };

            const stop = () => {

              document.removeEventListener(
                "mousemove",
                move
              );

              document.removeEventListener(
                "mouseup",
                stop
              );

              document.body.style.userSelect =
                "";

              document.body.style.cursor =
                "";

              setIsResizingX(
                false
              );

              editorRef.current?.layout();
            };

            document.addEventListener(
              "mousemove",
              move
            );

            document.addEventListener(
              "mouseup",
              stop
            );

          }}
        />

        {/* ===================================================
            EDITOR + OUTPUT
        ==================================================== */}

        <section
          className="min-w-0 min-h-0 grid overflow-hidden bg-[#0d0d0f]"
          style={{
            gridTemplateRows: `minmax(0, ${topRightHeight}fr) 6px minmax(0, ${100 -
              topRightHeight
              }fr)`,
          }}
        >

          {/* =================================================
              CODE EDITOR
          ================================================== */}

          <div className="min-w-0 min-h-0 flex flex-col overflow-hidden bg-[#20203c]">

            {/* TAB */}

            <div className="h-[40px] shrink-0 border-b border-[#27272a] px-5 flex items-end justify-between">

              <span className="pb-[10px] font-mono text-[12px] text-[#d4d4d8]">
                {LANGUAGES[language].fileName}
              </span>

              <select
                value={language}
                onChange={(event) => handleLanguageChange(event.target.value)}
                className="mb-2 rounded border border-[#30303a] bg-[#15151a] px-2 py-1 font-mono text-[11px] text-[#d4d4d8] outline-none focus:border-[#8176dc]"
                aria-label="Programming language"
              >
                {Object.entries(LANGUAGES).map(([value, config]) => (
                  <option key={value} value={value}>{config.label}</option>
                ))}
              </select>

            </div>

            {/* MONACO */}

            <div
              className="min-w-0 min-h-0 flex-1"
              style={{
                pointerEvents:
                  isResizingX ||
                    isResizingY
                    ? "none"
                    : "auto",
              }}
            >

              <Editor
                height="100%"
                language={LANGUAGES[language].monaco}
                theme="codeSimulDark"
                value={code}
                onChange={
                  handleCodeChange
                }
                onMount={(
                  editor,
                  monaco
                ) => {

                  monaco.editor.defineTheme(
                    "codeSimulDark",
                    {
                      base: "vs-dark",
                      inherit: true,

                      rules: [
                        {
                          token:
                            "comment",
                          foreground:
                            "6A9955",
                        },

                        {
                          token:
                            "keyword",
                          foreground:
                            "569CD6",
                        },

                        {
                          token:
                            "string",
                          foreground:
                            "CE9178",
                        },

                        {
                          token:
                            "number",
                          foreground:
                            "B5CEA8",
                        },

                        {
                          token:
                            "type",
                          foreground:
                            "4EC9B0",
                        },
                      ],

                      colors: {
                        "editor.background":
                          "#0a1128",
                        "editor.foreground":
                          "#c9d1d9",
                        "editorLineNumber.foreground":
                          "#3a5a8c",
                        "editorLineNumber.activeForeground":
                          "#79c0ff",
                        "editor.selectionBackground":
                          "#1c3a6e",
                        "editor.lineHighlightBackground":
                          "#0f1a3d",
                        "editorCursor.foreground":
                          "#58a6ff",
                        "editorGutter.background":
                          "#0a1128",
                        "editorWidget.background":
                          "#0d1836",
                        "editorWidget.border":
                          "#1c2f5c",
                      },
                    }
                  );

                  monaco.editor.setTheme("codeSimulDark");

                  editorRef.current = editor;
                  editor.layout();
                }}
                options={{
                  fontSize: 14,

                  fontFamily:
                    "'JetBrains Mono', monospace",

                  fontLigatures: true,

                  minimap: {
                    enabled: false,
                  },

                  automaticLayout:
                    true,

                  scrollBeyondLastLine:
                    false,

                  wordWrap: "on",

                  smoothScrolling:
                    true,

                  cursorBlinking:
                    "smooth",

                  padding: {
                    top: 20,
                    bottom: 20,
                  },

                  renderLineHighlight:
                    "line",

                  lineNumbers:
                    "on",

                  folding: true,

                  glyphMargin: false,

                  overviewRulerLanes:
                    0,
                }}
              />

            </div>

          </div>

          {/* =================================================
              RESIZER: EDITOR ↔ OUTPUT
          ================================================== */}

          <div
            className="h-[6px] bg-[#27272a] hover:bg-[#8176dc] cursor-row-resize transition-colors"
            onMouseDown={(e) => {

              e.preventDefault();

              const startY =
                e.clientY;

              const startHeight =
                topRightHeight;

              setIsResizingY(true);

              document.body.style.userSelect =
                "none";

              document.body.style.cursor =
                "row-resize";

              const move = (
                event
              ) => {

                const delta =
                  ((event.clientY -
                    startY) /
                    window.innerHeight) *
                  100;

                setTopRightHeight(
                  Math.min(
                    90,
                    Math.max(
                      30,
                      startHeight +
                      delta
                    )
                  )
                );
              };

              const stop = () => {

                document.removeEventListener(
                  "mousemove",
                  move
                );

                document.removeEventListener(
                  "mouseup",
                  stop
                );

                document.body.style.userSelect =
                  "";

                document.body.style.cursor =
                  "";

                setIsResizingY(
                  false
                );

                editorRef.current?.layout();
              };

              document.addEventListener(
                "mousemove",
                move
              );

              document.addEventListener(
                "mouseup",
                stop
              );

            }}
          />

          {/* =================================================
              OUTPUT / INPUT
          ================================================== */}

          <div className="min-w-0 min-h-0 overflow-hidden bg-[#0d0d0f] flex flex-col">

            <div className="grid min-h-0 flex-1 grid-cols-2 divide-x divide-[#27272a]">
              <div className="flex min-w-0 min-h-0 flex-col">
                <div className="border-b border-[#27272a] px-4 py-3 font-mono text-[10px] uppercase tracking-wide text-[#a1a1aa]">INPUT</div>
                <textarea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="stdin"
                  className="m-4 min-h-0 flex-1 resize-none rounded-md border border-[#27272a] bg-[#09090b] p-3 font-mono text-[12px] text-[#d4d4d8] outline-none focus:border-[#8176dc]"
                />
              </div>
              <div className="flex min-w-0 min-h-0 flex-col">
                <div className="border-b border-[#27272a] px-4 py-3 font-mono text-[10px] uppercase tracking-wide text-[#a1a1aa]">OUTPUT</div>
                <pre className="m-4 min-h-0 flex-1 overflow-auto whitespace-pre-wrap font-mono text-[12px] leading-5 text-[#22c55e]">
                  {output || "Program output will appear here."}
                </pre>
              </div>
            </div>

          </div>

        </section>

        {/* ===================================================
            RESIZER: EDITOR ↔ WHITEBOARD
        ==================================================== */}

        <div
          className="w-[6px] bg-[#27272a] hover:bg-[#8176dc] cursor-col-resize transition-colors"
          onMouseDown={(e) => {

            e.preventDefault();

            const startX =
              e.clientX;

            const startWidth =
              rightWidth;

            setIsResizingX(true);

            document.body.style.userSelect =
              "none";

            document.body.style.cursor =
              "col-resize";

            const move = (
              event
            ) => {

              const delta =
                startX -
                event.clientX;

              setRightWidth(
                Math.min(
                  560,
                  Math.max(
                    220,
                    startWidth +
                    delta
                  )
                )
              );
            };

            const stop = () => {

              document.removeEventListener(
                "mousemove",
                move
              );

              document.removeEventListener(
                "mouseup",
                stop
              );

              document.body.style.userSelect =
                "";

              document.body.style.cursor =
                "";

              setIsResizingX(
                false
              );

              editorRef.current?.layout();
            };

            document.addEventListener(
              "mousemove",
              move
            );

            document.addEventListener(
              "mouseup",
              stop
            );

          }}
        />

        {/* ===================================================
            WHITEBOARD
        ==================================================== */}

        <aside className="min-w-0 min-h-0 overflow-hidden bg-[#0d0d0f] px-[18px] pt-[18px] flex flex-col">

          {/* HEADER */}

          <div className="mb-[10px] flex items-center justify-between">

            <button
              onClick={() =>
                setWhiteboardOpen(
                  !whiteboardOpen
                )
              }
              className="text-[11px] font-medium tracking-wide text-[#71717a] hover:text-[#a1a1aa]"
            >
              WHITEBOARD
            </button>

            <button
              onClick={
                clearBoard
              }
              className="text-[11px] text-[#52525b] hover:text-[#a1a1aa]"
            >
              Clear
            </button>

          </div>

          {(contest.active || contest.submissions?.length > 0) && (
            <div className="mb-3 rounded-md border border-[#27272a] p-3">
              <p className="mb-2 font-mono text-[10px] tracking-wide text-[#a1a1aa]">CONTEST LEADERBOARD</p>
              {contestLeaderboard.length === 0 ? (
                <p className="font-mono text-[11px] text-[#71717a]">No accepted submissions yet.</p>
              ) : contestLeaderboard.map((submission, index) => (
                <div key={submission.socketId} className="flex justify-between font-mono text-[11px] text-[#d4d4d8]">
                  <span>{index + 1}. {submission.username}</span>
                  <span className="text-[#a78bfa]">{Math.max(0, Math.round((submission.timestamp - contest.startTime) / 1000))}s</span>
                </div>
              ))}
            </div>
          )}

          {/* CANVAS */}

          <div
            className={`${whiteboardOpen
                ? "flex-1"
                : "hidden"
              } relative min-w-0 min-h-0 overflow-hidden rounded-[9px] border border-[#27272a] bg-[#d9dde3]`}
          >

            <canvas
              ref={canvasRef}
              className="h-full w-full cursor-crosshair bg-[#d9dde3]"
              style={{
                pointerEvents:
                  isResizingX
                    ? "none"
                    : "auto",
              }}
              onMouseDown={
                startDraw
              }
              onMouseMove={draw}
              onMouseUp={
                stopDraw
              }
              onMouseLeave={
                stopDraw
              }
            />

            {/* =================================================
                WHITEBOARD COLORS
            ================================================== */}

            <div className="absolute left-3 top-3 flex gap-2">

              {/* BLACK */}

              <button
                onClick={() =>
                  setStrokeColor(
                    "black"
                  )
                }
                title="Black"
                className={`h-5 w-5 rounded-sm bg-black border-2 ${strokeColor ===
                    "black"
                    ? "border-[#8176dc] ring-1 ring-[#8176dc]"
                    : "border-[#52525b]"
                  }`}
              />

              {/* RED */}

              <button
                onClick={() =>
                  setStrokeColor(
                    "red"
                  )
                }
                title="Red"
                className={`h-5 w-5 rounded-sm bg-red-500 border-2 ${strokeColor ===
                    "red"
                    ? "border-[#8176dc] ring-1 ring-[#8176dc]"
                    : "border-[#52525b]"
                  }`}
              />

              {/* BLUE */}

              <button
                onClick={() =>
                  setStrokeColor(
                    "blue"
                  )
                }
                title="Blue"
                className={`h-5 w-5 rounded-sm bg-blue-500 border-2 ${strokeColor ===
                    "blue"
                    ? "border-[#8176dc] ring-1 ring-[#8176dc]"
                    : "border-[#52525b]"
                  }`}
              />

              {/* GREEN */}

              <button
                onClick={() =>
                  setStrokeColor(
                    "green"
                  )
                }
                title="Green"
                className={`h-5 w-5 rounded-sm bg-green-500 border-2 ${strokeColor ===
                    "green"
                    ? "border-[#8176dc] ring-1 ring-[#8176dc]"
                    : "border-[#52525b]"
                  }`}
              />

            </div>

          </div>

        </aside>

      </main>

    </div>
  );
}

export default Room;
