# CodeSimul

CodeSimul is a real-time collaborative coding platform for practising programming problems together. Participants work in a shared room with a Monaco editor, whiteboard, problem links, code execution, and timed contests.

## Features

- Create or join collaborative rooms with an optional password.
- Synchronize code edits, selected language, typing status, and participant updates through Socket.IO.
- Use a shared live whiteboard with drawing and clearing controls.
- Edit C++, Python, and Java in Monaco Editor.
- Run code with custom standard input and view output in the room.
- Share problem URLs. Recognized Codeforces problem URLs load public metadata; LeetCode URLs are opened and shared, but do not have a metadata loader in this repository.
- Start a timed contest, submit solutions, and view a leaderboard of accepted participants.

## Tech Stack

| Area | Technologies |
| --- | --- |
| Frontend | React, React Router, Create React App, Monaco Editor |
| Backend | Node.js, Express, Helmet, express-rate-limit |
| Real-time communication | Socket.IO client and server |
| Code execution | Docker, Debian, g++, Python 3, headless JDK |
| Deployment | Vercel frontend; Render Node/Express backend |

## Architecture

```text
Browser
  |
  v
Vercel React frontend (Monaco Editor)
  |
  | HTTPS API requests / Socket.IO
  v
Render Node.js + Express + Socket.IO backend
  |
  | Authenticated HTTPS request
  v
Dedicated executor service
  |
  | Local Docker CLI
  v
codesimul-runner:latest Docker sandbox
```

The executor is separate from the normal frontend-to-backend connection. The Render backend owns the public API, Socket.IO rooms, contest state, and hidden contest data; it sends execution work to the executor with a private bearer token.

## Requirements

- Node.js 18 or later (the backend uses the built-in `fetch` API)
- npm
- Docker Desktop on Windows/macOS or Docker Engine on Linux, running on the executor host before code execution is used

Docker is not needed for frontend-only development, but it is required for the local executor.

## Run Locally

Clone the repository and install both dependency sets:

```bash
git clone https://github.com/YOUR_USERNAME/YOUR_REPOSITORY.git
cd Codesimul
npm install
npm install --prefix backend
npm install --prefix executor
```

Build the execution image once:

```bash
docker build -t codesimul-runner:latest -f backend/Dockerfile.sandbox .
```

### Start local services

Set the same private token in both the executor and backend terminals. On PowerShell:

```powershell
# Terminal 1: executor
cd executor
$env:EXECUTOR_TOKEN = "codesimul-local-test-token"
npm start

# Terminal 2: backend, from the project root
$env:EXECUTOR_URL = "http://localhost:5002"
$env:EXECUTOR_TOKEN = "codesimul-local-test-token"
npm start
```

The executor listens on <http://localhost:5002>; the backend remains at <http://localhost:5001>. The frontend continues to call only the backend.

### Serve a production-style local build

Build the React application, then start the root server script. The backend serves `build/` when it exists.

```bash
npm run build
npm start
```

Open <http://localhost:5001>.

### Frontend-only development

Run the executor using the commands above, then run the backend in another terminal:

```bash
npm start
```

Run the Create React App development server in another:

```bash
npm run dev
```

The development frontend runs on <http://localhost:3000> and uses the backend at <http://localhost:5001> by default. Docker must be running only on the executor host when using Run Code or contest submission evaluation.

## Environment Variables

### Frontend

Create React App exposes only variables prefixed with `REACT_APP_` to the browser. The repository includes this in `.env.example`:

```env
REACT_APP_BACKEND_URL=https://codesimul-wlx1.onrender.com
```

For local development, either omit the variable (the code defaults to `http://localhost:5001`) or set:

```env
REACT_APP_BACKEND_URL=http://localhost:5001
```

### Backend

| Variable | Purpose |
| --- | --- |
| `PORT` | Listener port. The server uses `process.env.PORT || 5001`. |
| `NODE_ENV` | Enables production CORS behavior when set to `production`. |
| `APP_ORIGIN` | Comma-separated allow-list of approved frontend origins for Express and Socket.IO CORS. |
| `EXECUTOR_URL` | Private base URL for the executor, such as `http://localhost:5002` locally. |
| `EXECUTOR_TOKEN` | Long shared secret used only between the backend and executor. Never expose it to React. |

For a production Vercel frontend, `APP_ORIGIN` must contain its exact HTTPS origin without a trailing slash, for example:

```env
APP_ORIGIN=https://your-project.vercel.app
```

## Production Deployment

### Vercel

Deploy the React application from the project root. Configure this Vercel environment variable for Production, and for Preview if preview deployments need backend access:

```env
REACT_APP_BACKEND_URL=https://codesimul-wlx1.onrender.com
```

Production frontend requests and Socket.IO connections must use the Render HTTPS URL, not `localhost`. Vercel embeds this value during the build, so redeploy the frontend after adding or changing it.

### Render

Deploy the Node/Express backend from the `backend` directory, using its `npm start` script, or run `node backend/index.js` when deploying from the repository root. The current backend URL is:

```text
https://codesimul-wlx1.onrender.com
```

Configure the backend service with:

```env
NODE_ENV=production
APP_ORIGIN=https://your-project.vercel.app
EXECUTOR_URL=https://executor.example.com
EXECUTOR_TOKEN=replace-with-a-long-random-secret
```

Use the actual Vercel production origin for `APP_ORIGIN`; list multiple permitted origins with commas if needed. Render provides `PORT`, so do not hard-code a Render port. `EXECUTOR_URL` and `EXECUTOR_TOKEN` are backend-only Render environment variables.

The repository does not include a Render configuration that supplies a Docker daemon. Standard Render Node hosting is therefore used for HTTP and Socket.IO; deploy the executor to a separate Docker-capable host and keep its Docker daemon private.

## Code Execution

The authenticated executor invokes Docker to run code in `codesimul-runner:latest`, built from `backend/Dockerfile.sandbox`. The image is based on `debian:bookworm-slim` and installs:

- `g++` for C++ (`g++ -std=c++17 -O2`)
- `python3` for Python
- `default-jdk-headless` for Java (`javac` and `java`)

Java source is written to `Main.java`; Java submissions declaring a public class must use `public class Main`.

The backend starts each container with these restrictions:

- no network access
- read-only container filesystem
- a writable, no-exec `/tmp` tmpfs limited to 64 MB
- a mounted temporary working directory at `/work`
- 256 MB memory and memory-swap limits
- 0.5 CPU limit and 64-process limit
- dropped Linux capabilities and `no-new-privileges`
- five-second program limit; normal Run Code requests have a 15-second outer execution limit

Code and input are each limited to 50,000 characters. If the executor, Docker daemon, or runner image is unavailable, `POST /run` responds with `Execution service unavailable` (HTTP 503); the contest submission path reports the same execution-service error. Executor authentication failures are also treated as unavailable infrastructure and do not reveal internal details to the browser.

### Local and production execution

```text
Local:       Node backend -> local executor -> local Docker daemon -> sandbox container
Production:  Render backend -> authenticated executor -> Docker daemon -> sandbox container
```

The executor host must provide compatible Docker access. Do not expose the Docker socket or Docker TCP API; the executor exposes only authenticated execution endpoints plus its non-executing health check.

## Contest Flow

1. The first participant to join a room becomes its host.
2. The host starts a contest, chooses a duration from 1 to 180 minutes, and provides expected output for the current input. A problem link may also be included.
3. The backend keeps the contest input and expected output out of the public contest-state payload sent to clients.
4. While a contest is active, Run Code sends a `contest-submit` Socket.IO event instead of the normal `/run` request.
5. The backend executes the submission against the hidden input and compares trimmed output with the expected output.
6. Every submission is recorded in the room state; accepted submissions are shown on the leaderboard.
7. The leaderboard sorts accepted submissions by timestamp and displays only each participant's first accepted submission. The contest ends at its configured deadline.

## Persistence

There is no database or external persistence layer.

- The backend keeps room membership, password hashes, language, host, contest configuration, and submissions in an in-memory `Map`.
- Empty rooms are removed after one hour of inactivity.
- Code edits and whiteboard strokes are relayed live to connected peers but are not retained as room state by the backend.
- Restarting the backend clears rooms, passwords, memberships, active contests, submissions, and leaderboard data. A reconnect also does not restore previously relayed code or whiteboard strokes.

## Useful Commands

```bash
# Install dependencies
npm install
npm install --prefix backend

# Start the backend (serves build/ when it exists)
npm start

# Start the executor from its directory (requires EXECUTOR_TOKEN)
cd executor && npm start

# Start the React development server
npm run dev

# Create the React production build
npm run build

# Run the frontend test command
npm test

# Check backend syntax
node --check backend/index.js

# Check executor syntax
npm run check --prefix executor

# Build and inspect the local Docker sandbox image
docker build -t codesimul-runner:latest -f backend/Dockerfile.sandbox .
docker image inspect codesimul-runner:latest
```

The backend package also has an `npm start` script when run from `backend/`. Its `npm test` script is only a placeholder and does not run a backend test suite.

## Manual Testing Checklist

### Collaboration

- [ ] Join the same room from two separate browsers or profiles.
- [ ] Confirm participant join and leave updates.
- [ ] Edit code in one browser and confirm it appears in the other.
- [ ] Change language and confirm both browsers update.
- [ ] Draw and clear the whiteboard; confirm the other browser receives both actions.

### Code Execution

- [ ] Run a valid C++ program.
- [ ] Run a valid Python program.
- [ ] Run a valid Java program using `public class Main`.
- [ ] Supply standard input and verify output.
- [ ] Test multi-case input using a program that reads a case count and loops.
- [ ] Test a compilation error.
- [ ] Test a runtime error.
- [ ] Test a program that exceeds the five-second execution limit.

### Problems

- [ ] Paste a supported Codeforces problem URL and verify its metadata loads.
- [ ] Paste a LeetCode URL and verify it opens and is shared with room participants. Metadata loading for LeetCode is not implemented.

### Contest

- [ ] Have the room host start a contest with a duration, input, and expected output.
- [ ] Join the room from a second browser while the contest is active.
- [ ] Submit a correct solution and confirm it appears on the leaderboard.
- [ ] Submit an incorrect solution and confirm it is not listed as accepted.
- [ ] Verify the leaderboard retains only the first accepted submission per participant.

### Production

- [ ] Open the Vercel frontend and confirm requests target `https://codesimul-wlx1.onrender.com`.
- [ ] Confirm the Socket.IO connection succeeds and room collaboration works.
- [ ] Confirm API requests, including Codeforces metadata and Run Code, are not blocked by CORS.
- [ ] Confirm Render is available; a free-tier cold start can delay the first request.
- [ ] Verify the production environment has a functioning code-execution environment before expecting Run Code or contest evaluation to work.

## Project Status

The repository implements collaborative rooms, real-time editor/language/whiteboard events, Codeforces metadata loading, and in-memory timed contests. The Vercel frontend and Render HTTP/Socket.IO backend communicate through the Render URL and CORS allow-list. Code execution is delegated to an authenticated Docker executor; deployment of that executor remains a separate step.
