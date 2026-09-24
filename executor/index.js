const express = require("express");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const { spawn } = require("child_process");
const fs = require("fs/promises");
const os = require("os");
const path = require("path");
const crypto = require("crypto");

const app = express();
const PORT = process.env.PORT || 5002;
const EXECUTOR_TOKEN = process.env.EXECUTOR_TOKEN;
const SANDBOX_IMAGE = process.env.SANDBOX_IMAGE || "codesimul-runner:latest";
const RUN_TIMEOUT_MS = 5000;
const MAX_CODE_LENGTH = 50000;
const MAX_INPUT_LENGTH = 50000;
const LANGUAGE_CONFIG = {
  cpp: { filename: "main.cpp", compile: "g++ -std=c++17 -O2 main.cpp -o program", run: "./program" },
  python: { filename: "main.py", compile: "true", run: "python3 main.py" },
  java: { filename: "Main.java", compile: "javac Main.java", run: "java Main" },
};

if (!EXECUTOR_TOKEN) {
  throw new Error("EXECUTOR_TOKEN is required");
}

const executeLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many execution requests. Please wait a moment and try again." },
});
const testLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many test execution requests. Please wait a moment and try again." },
});

app.use(helmet());
app.use(express.json({ limit: "100kb" }));
app.use((error, req, res, next) => {
  if (error instanceof SyntaxError && "body" in error) {
    return res.status(400).json({ error: "Invalid request" });
  }
  return next(error);
});

function hasValidToken(req) {
  const authorization = req.get("authorization");
  if (!authorization?.startsWith("Bearer ")) return false;
  const supplied = Buffer.from(authorization.slice("Bearer ".length));
  const expected = Buffer.from(EXECUTOR_TOKEN);
  return supplied.length === expected.length && crypto.timingSafeEqual(supplied, expected);
}

function requireExecutorToken(req, res, next) {
  if (!hasValidToken(req)) return res.status(401).json({ error: "Unauthorized" });
  return next();
}

function getLanguageConfig(language) {
  return LANGUAGE_CONFIG[language || "cpp"];
}

function validateSubmission(code, language) {
  const config = getLanguageConfig(language);
  if (!config) return "Unsupported language. Choose C++, Python, or Java.";
  if (typeof code !== "string" || !code) return "No code provided";
  if (code.length > MAX_CODE_LENGTH) return "Code is too large";
  if (language === "java" && /public\s+class\s+(?!Main\b)/.test(code)) {
    return "Java submissions must declare `public class Main`.";
  }
  return null;
}

function validateInput(input) {
  if (typeof input !== "string") return "Input must be a string.";
  if (input.length > MAX_INPUT_LENGTH) return "Input is too large.";
  return null;
}

async function prepareSubmission(tempDir, code, input, language) {
  const config = getLanguageConfig(language);
  await Promise.all([
    fs.writeFile(path.join(tempDir, config.filename), code),
    fs.writeFile(path.join(tempDir, "input.txt"), `${input}\n`),
  ]);
  return config;
}

function buildBatchScript(config, testCaseCount) {
  const lines = ["#!/bin/sh", "set +e", `${config.compile} > compile.stdout 2> compile.stderr`, "if [ $? -ne 0 ]; then exit 20; fi"];
  for (let index = 0; index < testCaseCount; index += 1) {
    lines.push(
      `started=$(date +%s%3N)`,
      `timeout 5s ${config.run} < input_${index}.txt > actual_${index}.txt 2> stderr_${index}.txt`,
      "status=$?",
      "finished=$(date +%s%3N)",
      `printf '%s\n%s\n' "$status" "$((finished-started))" > result_${index}.meta`
    );
  }
  lines.push("exit 0");
  return lines.join("\n");
}

async function readFileOrEmpty(filePath) {
  try { return await fs.readFile(filePath, "utf8"); } catch { return ""; }
}

function comparableOutput(value) {
  return value.replace(/\r\n/g, "\n").trimEnd();
}

function runSandbox(tempDir, containerName, command, timeoutMs = RUN_TIMEOUT_MS) {
  return new Promise((resolve, reject) => {
    // Keep this invocation aligned with the existing CodeSimul sandbox.
    const args = [
      "run", "--rm", "--name", containerName,
      "--network", "none", "--read-only",
      "--memory", "256m", "--memory-swap", "256m", "--cpus", "0.5", "--pids-limit", "64",
      "--cap-drop", "ALL", "--security-opt", "no-new-privileges",
      "--tmpfs", "/tmp:rw,nosuid,nodev,noexec,size=64m",
      "--mount", `type=bind,src=${tempDir},dst=/work,bind-propagation=rprivate`,
      "--workdir", "/work", SANDBOX_IMAGE,
      "sh", "-c", command,
    ];
    const child = spawn("docker", args, { windowsHide: true });
    let stdout = "";
    let stderr = "";
    let timedOut = false;
    let started = false;
    const timer = setTimeout(() => {
      timedOut = true;
      spawn("docker", ["kill", containerName], { windowsHide: true }).on("error", () => {});
    }, timeoutMs);

    child.stdout.on("data", (data) => { stdout += data.toString(); });
    child.stderr.on("data", (data) => { stderr += data.toString(); });
    child.on("spawn", () => { started = true; });
    child.on("error", (error) => {
      clearTimeout(timer);
      reject({ type: "service", error });
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      if (!started) return;
      // GNU timeout uses status 124 when it terminates the user program. Keep
      // that signal distinct from compilation and runtime failures.
      if (timedOut || code === 124) return resolve({ output: "Execution timed out", status: 124, timedOut: true });
      if (code === 125) return reject({ type: "service", error: new Error(stderr || "Docker failed to start the sandbox") });
      resolve({ output: code === 0 ? stdout : (stderr || "Execution failed"), status: code, timedOut: false });
    });
  });
}

async function executeSubmission({ code, input, language }) {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "codesimul-run-"));
  const containerName = `codesimul-${crypto.randomUUID()}`;
  try {
    const config = await prepareSubmission(tempDir, code, input, language);
    return await runSandbox(tempDir, containerName, `${config.compile} && timeout 5s ${config.run} < input.txt`, 15_000);
  } finally {
    spawn("docker", ["rm", "-f", containerName], { windowsHide: true }).on("error", () => {});
    await fs.rm(tempDir, { recursive: true, force: true });
  }
}

async function executeTestCases({ code, language, testCases }) {
  const config = getLanguageConfig(language);
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "codesimul-tests-"));
  const containerName = `codesimul-tests-${crypto.randomUUID()}`;
  try {
    await fs.writeFile(path.join(tempDir, config.filename), code);
    await Promise.all(testCases.map((testCase, index) => fs.writeFile(path.join(tempDir, `input_${index}.txt`), `${testCase.input}\n`)));
    await fs.writeFile(path.join(tempDir, "run-tests.sh"), buildBatchScript(config, testCases.length));
    const sandboxResult = await runSandbox(tempDir, containerName, "sh run-tests.sh", 30_000);
    const compileError = await readFileOrEmpty(path.join(tempDir, "compile.stderr"));
    if (compileError || sandboxResult.status === 20) {
      return { error: `Compilation failed:\n${compileError || sandboxResult.output}` };
    }
    const results = await Promise.all(testCases.map(async (testCase, index) => {
      const [actualOutput, stderr, meta] = await Promise.all([
        readFileOrEmpty(path.join(tempDir, `actual_${index}.txt`)),
        readFileOrEmpty(path.join(tempDir, `stderr_${index}.txt`)),
        readFileOrEmpty(path.join(tempDir, `result_${index}.meta`)),
      ]);
      const [statusText = sandboxResult.timedOut ? "124" : "1", timeText = "0"] = meta.trim().split("\n");
      const status = Number(statusText);
      return {
        input: testCase.input,
        expectedOutput: testCase.expectedOutput,
        actualOutput,
        passed: status === 0 && comparableOutput(actualOutput) === comparableOutput(testCase.expectedOutput),
        timeMs: Number(timeText) || 0,
        error: status === 124 ? "Execution timed out" : (status !== 0 ? (stderr || "Runtime error") : undefined),
      };
    }));
    return { results };
  } finally {
    spawn("docker", ["rm", "-f", containerName], { windowsHide: true }).on("error", () => {});
    await fs.rm(tempDir, { recursive: true, force: true });
  }
}

function parseTestCases(body) {
  if (Array.isArray(body.testCases) && body.testCases.length > 0) return body.testCases;
  return [{ input: body.input, expectedOutput: body.expectedOutput }];
}

function validateTestCases(testCases) {
  if (!Array.isArray(testCases) || testCases.length === 0) return "At least one test case is required.";
  for (const testCase of testCases) {
    if (!testCase || typeof testCase.input !== "string" || typeof testCase.expectedOutput !== "string") {
      return "Each test case requires string input and expectedOutput values.";
    }
    if (testCase.input.length > MAX_INPUT_LENGTH || testCase.expectedOutput.length > MAX_INPUT_LENGTH) {
      return "Test case input or expected output is too large.";
    }
  }
  return null;
}

app.get("/health", (req, res) => res.json({ status: "ok" }));

app.post("/execute", requireExecutorToken, executeLimiter, async (req, res) => {
  const { code, language = "cpp" } = req.body;
  const input = req.body.input === undefined ? "" : req.body.input;
  const validationError = validateSubmission(code, language) || validateInput(input);
  if (validationError) return res.status(400).json({ error: validationError });

  try {
    const result = await executeSubmission({ code, input, language });
    return res.json({ output: result.output, status: result.status, timedOut: result.timedOut });
  } catch (error) {
    console.error("Sandbox execution failed:", error.error?.message || error.message);
    return res.status(503).json({ error: "Execution service unavailable" });
  }
});

app.post("/execute-tests", requireExecutorToken, testLimiter, async (req, res) => {
  const { code, language = "cpp" } = req.body;
  const testCases = parseTestCases(req.body);
  const validationError = validateSubmission(code, language) || validateTestCases(testCases);
  if (validationError) return res.status(400).json({ error: validationError });

  try {
    const outcome = await executeTestCases({ code, language, testCases });
    return res.json(outcome);
  } catch (error) {
    console.error("Contest sandbox execution failed:", error.error?.message || error.message);
    return res.status(503).json({ error: "Execution service unavailable" });
  }
});

app.listen(PORT, () => console.log(`CodeSimul executor listening on port ${PORT}`));
