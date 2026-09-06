# CodeSimul

CodeSimul is a real-time collaborative coding room for practising programming
problems together. It combines a Monaco code editor, shared whiteboard, code
execution for C++, Python, and Java, Codeforces problem metadata, and a simple
contest leaderboard.

## Features

- Create and join password-protected coding rooms.
- Collaborate live on code, language selection, and a shared whiteboard.
- Run C++, Python, and Java in isolated Docker containers.
- Provide stdin in a permanent Input panel and inspect results in the adjacent
  Output panel.
- Use multi-case stdin in your program (for example, read `t` and loop) rather
  than configuring separate test cases in the UI.
- Start timed contests with one hidden input/expected-output pair; submissions
  are ranked by first accepted solve time.
- Load a Codeforces problem link and fetch its public metadata.

## Tech stack

- React 19 and React Router
- Monaco Editor
- Node.js, Express, Socket.IO, Helmet, and rate limiting
- Docker sandbox running Debian, `g++`, Python 3, and a headless JDK

## Requirements

- Node.js 20 or newer
- npm
- Docker Desktop (Windows/macOS) or Docker Engine (Linux), running before the
  backend starts

## Run locally

Clone the repository and install the frontend and backend dependencies:

```bash
git clone https://github.com/YOUR_USERNAME/YOUR_REPOSITORY.git
cd Codesimul
npm install
npm install --prefix backend
```

Build the sandbox image once from the project root:

```bash
docker build -t codesimul-runner:latest -f backend/Dockerfile.sandbox .
```

Start the complete application:

```bash
npm start
```

Open <http://localhost:5001>. The backend serves the built React application
when a `build/` directory exists. For frontend-only development, run:

```bash
npm run dev
```

The development frontend runs on port 3000 and talks to the backend on port
5001.

## Build for production

```bash
npm run build
docker build -t codesimul-runner:latest -f backend/Dockerfile.sandbox .
npm start
```

## Code execution sandbox

User programs execute in the `codesimul-runner:latest` Docker image. The
runner is deliberately restricted:

- no network access
- read-only container filesystem
- 256 MB memory limit
- 0.5 CPU limit
- 64 process limit
- five-second program timeout

Java submissions must define `public class Main`, because the runner writes
Java source to `Main.java`.

Docker must be available to the backend process. If it is not, execution
returns `Execution service unavailable` instead of running code on the host.

## Contest flow

1. The first room member is the host.
2. The host enters normal stdin in the Input panel, clicks **Start contest**,
   chooses a duration, and provides the expected output.
3. While the contest is active, **Run code** is an official submission.
4. The server executes submissions against the hidden contest input and checks
   the output. The first accepted submission per participant appears on the
   leaderboard.

Contest rooms and whiteboard state are stored in memory. Restarting the
backend clears them; add Redis or a database before relying on the app for
persistent sessions.

## Deploying

Because the backend launches Docker containers, deploy it to a Linux VPS rather
than a static host or typical serverless platform. An Oracle Cloud Always Free
Ubuntu VM is a practical option for a small demo.

Before deployment:

1. In `backend/index.js`, replace
   `https://your-production-domain.com` with your real HTTPS domain in
   `allowedOrigins`.
2. In `src/pages/room.jsx` and `src/socket.js`, set
   `REACT_APP_BACKEND_URL` to the public backend URL during the production
   build, or use a same-origin reverse proxy.
3. Build the React app and the sandbox image.
4. Run the Node process with a service manager such as systemd.
5. Put Caddy or Nginx in front of the app for HTTPS and reverse proxying.
6. Expose only ports 80 and 443 publicly. Keep port 5001 private.

The Docker image is built from `debian:bookworm-slim`, which supports common
Linux architectures including ARM-based cloud instances.

## Useful commands

```bash
# Run the React test runner
npm test

# Create the production frontend bundle
npm run build

# Check backend syntax
node --check backend/index.js

# View the local sandbox image
docker image inspect codesimul-runner:latest
```

## Manual test checklist

1. Open the same room in two browsers and confirm code, language, and
   whiteboard updates are shared.
2. Run a C++, Python, and Java solution. Use `public class Main` for Java.
3. Paste multi-case stdin such as `2\n5 6\n2 4` into Input and verify that a
   loop-based solution prints both results.
4. Start a contest; submit a correct and incorrect solution from separate
   browsers, then verify the leaderboard only accepts the correct submission.

