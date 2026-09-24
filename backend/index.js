const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const fs = require("fs");
const path = require("path");
const http = require("http");
const { Server } = require("socket.io");
const https = require("https");
const crypto = require("crypto");
const rateLimit = require("express-rate-limit");

const app = express();
const PORT = process.env.PORT || 5001;
const EXECUTOR_URL = (process.env.EXECUTOR_URL || "").replace(/\/$/, "");
const EXECUTOR_TOKEN = process.env.EXECUTOR_TOKEN || "";
const EXECUTOR_REQUEST_TIMEOUT_MS = 35_000;
const MAX_CODE_LENGTH = 50000;
const MAX_INPUT_LENGTH = 50000;
const MAX_SOCKET_CODE_LENGTH = 100000;
const LANGUAGE_CONFIG = {
  cpp: { filename: "main.cpp", monaco: "cpp", label: "C++", compile: "g++ -std=c++17 -O2 main.cpp -o program", run: "./program" },
  python: { filename: "main.py", monaco: "python", label: "Python", compile: "true", run: "python3 main.py" },
  java: { filename: "Main.java", monaco: "java", label: "Java", compile: "javac Main.java", run: "java Main" },
};

const runLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { output: "Too many requests — please wait a moment and try again." },
});
const testRunLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many test runs — please wait a moment and try again." },
});

// APP_ORIGIN is a comma-separated allow-list of the deployed frontend URLs.
// A production browser request must have one of these origins; without it,
// CORS correctly rejects the request instead of accepting every website.
const configuredOrigins = (process.env.APP_ORIGIN || "")
  .split(",")
  .map((origin) => origin.trim().replace(/\/$/, ""))
  .filter(Boolean);
const localOrigins = ["http://localhost:3000", "http://localhost:3001"];
const allowedOrigins = process.env.NODE_ENV === "production"
  ? configuredOrigins
  : [...new Set([...localOrigins, ...configuredOrigins])];
const corsOptions = {
  origin(origin, callback) {
    // Requests without an Origin header (health checks, server-to-server calls)
    // do not need browser CORS permission.
    callback(null, !origin || allowedOrigins.includes(origin));
  },
  methods: ["GET", "POST"],
};

if (process.env.NODE_ENV === "production" && allowedOrigins.length === 0) {
  console.warn("APP_ORIGIN is not set; browser requests will be rejected by CORS.");
}

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      baseUri: ["'self'"],
      objectSrc: ["'none'"],
      frameAncestors: ["'none'"],
      scriptSrc: ["'self'", "'wasm-unsafe-eval'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "blob:"],
      connectSrc: ["'self'", "https://codeforces.com"],
      workerSrc: ["'self'", "blob:"],
    },
  },
}));
app.use(cors(corsOptions));
app.use(express.json({ limit: "100kb" }));
app.use((error, req, res, next) => {
  if (error instanceof SyntaxError && "body" in error) {
    return res.status(400).json({ output: "Invalid request" });
  }
  return next(error);
});

const agent = new https.Agent({ keepAlive: true });
const cfCache = new Map();
const CF_CACHE_TTL_MS = 60 * 60 * 1000;
// roomId -> { users, lastActivity, passwordHash? }
const roomUsers = new Map();
const ROOM_INACTIVITY_LIMIT_MS = 60 * 60 * 1000;

function touchRoom(roomId) {
  const room = roomUsers.get(roomId);
  if (room) room.lastActivity = Date.now();
}

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

function verifyPassword(password, storedHash) {
  const [salt, expectedHash] = storedHash.split(":");
  if (!salt || !expectedHash) return false;
  const actualHash = crypto.scryptSync(password, salt, 64).toString("hex");
  return crypto.timingSafeEqual(Buffer.from(actualHash, "hex"), Buffer.from(expectedHash, "hex"));
}

function isRoomMember(socket, roomId) {
  return typeof roomId === "string" && socket.rooms.has(roomId);
}

function createSocketRateLimiter(socket) {
  const windows = new Map();
  return (event, max, windowMs) => {
    const now = Date.now();
    const current = windows.get(event);
    if (!current || now - current.startedAt >= windowMs) {
      windows.set(event, { startedAt: now, count: 1 });
      return true;
    }
    if (current.count >= max) return false;
    current.count += 1;
    return true;
  };
}

function getLanguageConfig(language) {
  return LANGUAGE_CONFIG[language || "cpp"];
}

function validateSubmission(code, language) {
  const config = getLanguageConfig(language);
  if (!config) return "Unsupported language. Choose C++, Python, or Java.";
  if (language === "java" && /public\s+class\s+(?!Main\b)/.test(code)) {
    return "Java submissions must declare `public class Main`.";
  }
  return null;
}

class ExecutorUnavailableError extends Error {}
class ExecutorRequestError extends Error {}

async function requestExecutor(endpoint, payload) {
  if (!EXECUTOR_URL || !EXECUTOR_TOKEN) throw new ExecutorUnavailableError();

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), EXECUTOR_REQUEST_TIMEOUT_MS);
  let response;
  try {
    response = await fetch(`${EXECUTOR_URL}${endpoint}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${EXECUTOR_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
  } catch {
    throw new ExecutorUnavailableError();
  } finally {
    clearTimeout(timeout);
  }

  let data;
  try {
    data = await response.json();
  } catch {
    throw new ExecutorUnavailableError();
  }
  if (response.status === 400) throw new ExecutorRequestError();
  if (!response.ok) throw new ExecutorUnavailableError();
  return data;
}

function contestState(room) {
  if (!room.contest) return { active: false, submissions: [] };
  const { input, expectedOutput, ...publicContest } = room.contest;
  return publicContest;
}

function endExpiredContest(room, roomId) {
  if (!room.contest?.active || Date.now() < room.contest.startTime + room.contest.durationMs) return false;
  room.contest.active = false;
  room.contest.endedAt = Date.now();
  io.to(roomId).emit("contest-ended", contestState(room));
  io.to(roomId).emit("contest-state", contestState(room));
  return true;
}

async function executeTestCases({ code, language, testCases }) {
  const validationError = validateSubmission(code, language);
  if (validationError) return { error: validationError };
  return requestExecutor("/execute-tests", { code, language, testCases });
}

app.get("/api/health", (req, res) => res.send("Backend is running"));

app.post("/run", runLimiter, async (req, res) => {
  const { code, input, language = "cpp" } = req.body;
  if (typeof code !== "string" || !code) return res.json({ output: "No code provided" });
  const config = getLanguageConfig(language);
  const validationError = validateSubmission(code, language);
  if (validationError) return res.status(400).json({ output: validationError });
  if (code.length > MAX_CODE_LENGTH || (typeof input === "string" && input.length > MAX_INPUT_LENGTH)) {
    return res.status(413).json({ output: "Code or input too large" });
  }

  try {
    const result = await requestExecutor("/execute", {
      code,
      input: typeof input === "string" ? input : "",
      language,
    });
    if (result.status === 124 || result.timedOut) {
      return res.json({ output: "Execution timed out", timedOut: true });
    }
    return res.json({ output: result.output || "No output", timedOut: false });
  } catch (error) {
    if (error instanceof ExecutorRequestError) return res.status(400).json({ output: "Invalid execution request" });
    console.error("Executor request failed");
    return res.status(503).json({ output: "Execution service unavailable" });
  }
});


app.get("/cf/meta", async (req, res) => {
  const { contestId, index } = req.query;
  if (!contestId || !index) return res.status(400).json({ status: "FAILED", error: "Missing contestId or index" });
  const cacheKey = `${contestId}-${index}`;
  const cached = cfCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CF_CACHE_TTL_MS) return res.json(cached.data);
  try {
    const response = await fetch(`https://codeforces.com/api/problemset.problem?contestId=${contestId}&index=${index}`, {
      agent,
      headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)", Accept: "application/json", Connection: "keep-alive" },
    });
    const data = await response.json();
    if (data.status !== "OK") return res.status(404).json({ status: "FAILED", error: "Problem not found" });
    cfCache.set(cacheKey, { data, timestamp: Date.now() });
    return res.json(data);
  } catch (err) {
    console.error("CF error:", err);
    return res.status(500).json({ status: "FAILED", error: "CF fetch failed" });
  }
});

const server = http.createServer(app);
const io = new Server(server, {
  maxHttpBufferSize: 1e6,
  cors: corsOptions,
  transports: ["websocket", "polling"],
});

io.on("connection", (socket) => {
  console.log("🟢 User connected:", socket.id);
  const allow = createSocketRateLimiter(socket);

  socket.on("join-room", ({ roomId, username, password } = {}) => {
    if (!allow("join-room", 5, 60 * 1000)) return;
    if (typeof roomId !== "string" || !/^[A-Za-z0-9]{1,30}$/.test(roomId)) return socket.emit("error-message", "Invalid room code");
    if (typeof username !== "string" || !username.trim() || username.length > 20) return socket.emit("error-message", "Invalid username");
    if (password !== undefined && (typeof password !== "string" || password.length > 128)) return socket.emit("error-message", "Invalid room password");

    let room = roomUsers.get(roomId);
    if (!room) {
      room = { users: [], lastActivity: Date.now(), passwordHash: password ? hashPassword(password) : undefined, language: "cpp", hostSocketId: socket.id, contest: null };
      roomUsers.set(roomId, room);
    } else if (room.passwordHash && (!password || !verifyPassword(password, room.passwordHash))) {
      return socket.emit("error-message", "Room password is required or incorrect");
    }
    if (socket.rooms.has(roomId)) return;
    socket.join(roomId);
    room.users.push({ socketId: socket.id, username: username.trim() });
    room.lastActivity = Date.now();
    socket.emit("room-users", room.users);
    socket.emit("room-language", room.language || "cpp");
    socket.emit("contest-state", contestState(room));
    socket.to(roomId).emit("user-joined", { username: username.trim(), socketId: socket.id });
    io.to(roomId).emit("room-users", room.users);
  });

  socket.on("draw", ({ roomId, x0, y0, x1, y1, color } = {}) => {
    if (!allow("draw", 120, 1000) || !isRoomMember(socket, roomId)) return;
    if (![x0, y0, x1, y1].every(Number.isFinite) || typeof color !== "string" || color.length > 30) return;
    touchRoom(roomId);
    socket.to(roomId).emit("draw", { x0, y0, x1, y1, color });
  });
  socket.on("clear-board", (roomId) => {
    if (!allow("clear-board", 5, 10 * 1000) || !isRoomMember(socket, roomId)) return;
    touchRoom(roomId);
    socket.to(roomId).emit("clear-board");
  });
  socket.on("code-change", ({ roomId, code } = {}) => {
    if (!allow("code-change", 60, 1000) || !isRoomMember(socket, roomId)) return;
    if (typeof code !== "string" || code.length > MAX_SOCKET_CODE_LENGTH) return socket.emit("error-message", "Code is too large to sync (maximum 100 KB)");
    touchRoom(roomId);
    socket.to(roomId).emit("code-update", code);
  });
  socket.on("language-change", ({ roomId, language } = {}) => {
    if (!allow("language-change", 10, 10 * 1000) || !isRoomMember(socket, roomId)) return;
    if (!getLanguageConfig(language)) return socket.emit("error-message", "Unsupported language");
    const room = roomUsers.get(roomId);
    if (!room) return;
    room.language = language;
    touchRoom(roomId);
    io.to(roomId).emit("room-language", language);
  });
  socket.on("start-contest", ({ roomId, durationMinutes, problemLink, input, expectedOutput } = {}, acknowledgement) => {
    if (!allow("start-contest", 3, 60 * 1000) || !isRoomMember(socket, roomId)) return;
    const room = roomUsers.get(roomId);
    if (!room || room.hostSocketId !== socket.id) return socket.emit("error-message", "Only the room host can start a contest");
    const durationMs = Number(durationMinutes) * 60 * 1000;
    if (!Number.isFinite(durationMs) || durationMs < 60_000 || durationMs > 3 * 60 * 60 * 1000) return socket.emit("error-message", "Contest duration must be between 1 and 180 minutes");
    if (typeof input !== "string" || typeof expectedOutput !== "string" || input.length > MAX_INPUT_LENGTH || expectedOutput.length > MAX_INPUT_LENGTH) return socket.emit("error-message", "Provide contest input and expected output");
    room.contest = { active: true, problemLink: typeof problemLink === "string" ? problemLink : "", startTime: Date.now(), durationMs, input, expectedOutput, submissions: [] };
    const state = contestState(room);
    io.to(roomId).emit("contest-state", state);
    if (typeof acknowledgement === "function") acknowledgement({ ok: true, state });
  });
  socket.on("contest-submit", async ({ roomId, code, language } = {}, acknowledgement) => {
    if (!allow("contest-submit", 5, 60 * 1000) || !isRoomMember(socket, roomId)) return;
    const room = roomUsers.get(roomId);
    if (!room?.contest?.active || endExpiredContest(room, roomId)) {
      if (typeof acknowledgement === "function") acknowledgement({ error: "Contest is not active" });
      return socket.emit("error-message", "Contest is not active");
    }
    try {
      const outcome = await executeTestCases({ code, language, testCases: [{ input: room.contest.input, expectedOutput: room.contest.expectedOutput }] });
      const result = outcome.results?.[0];
      const passed = result?.passed === true;
      room.contest.submissions.push({ username: room.users.find((user) => user.socketId === socket.id)?.username || "Guest", socketId: socket.id, timestamp: Date.now(), passed });
      const state = contestState(room);
      io.to(roomId).emit("contest-state", state);
      if (typeof acknowledgement === "function") acknowledgement(outcome.error ? outcome : { output: result?.error || result?.actualOutput || "No output", passed, state });
    } catch (error) {
      console.error("Contest sandbox execution failed:", error.message);
      if (typeof acknowledgement === "function") acknowledgement({ error: "Execution service unavailable" });
    }
  });
  socket.on("open-problem", ({ roomId, link, sender } = {}) => {
    if (!allow("open-problem", 5, 10 * 1000) || !isRoomMember(socket, roomId)) return;
    if (typeof link !== "string" || link.length > 2048 || typeof sender !== "string") return;
    touchRoom(roomId);
    io.to(roomId).emit("open-problem", { link, sender });
  });
  ["typing-start", "typing-stop"].forEach((event) => socket.on(event, ({ roomId, username } = {}) => {
    if (!allow(event, 10, 1000) || !isRoomMember(socket, roomId)) return;
    if (typeof username !== "string" || username.length > 20) return;
    touchRoom(roomId);
    socket.to(roomId).emit("user-typing", { username, isTyping: event === "typing-start" });
  }));

  socket.on("disconnect", () => {
    console.log("🔴 User disconnected:", socket.id);
    roomUsers.forEach((room, roomId) => {
      const userIndex = room.users.findIndex((user) => user.socketId === socket.id);
      if (userIndex === -1) return;
      const [user] = room.users.splice(userIndex, 1);
      if (room.hostSocketId === socket.id) room.hostSocketId = room.users[0]?.socketId || null;
      room.lastActivity = Date.now();
      io.to(roomId).emit("user-left", { username: user.username, socketId: socket.id });
      io.to(roomId).emit("room-users", room.users);
      // Keep an empty room until the stale-room sweep so its optional password
      // remains effective when its creator or members reconnect.
    });
  });
});

const buildPath = path.join(__dirname, "..", "build");
if (fs.existsSync(buildPath)) {
  app.use(express.static(buildPath));
  app.get(/.*/, (req, res) => res.sendFile(path.join(buildPath, "index.html")));
} else console.warn("build folder not found — frontend won't be served");

setInterval(() => {
  const now = Date.now();
  roomUsers.forEach((room, roomId) => {
    if (room.users.length === 0 && now - room.lastActivity > ROOM_INACTIVITY_LIMIT_MS) roomUsers.delete(roomId);
  });
}, 15 * 60 * 1000);

setInterval(() => {
  roomUsers.forEach((room, roomId) => endExpiredContest(room, roomId));
}, 1000);

server.listen(PORT, () => console.log(`🚀 Backend running on port ${PORT}`));
