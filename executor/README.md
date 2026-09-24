# CodeSimul Executor

This is the private, authenticated Docker execution service for CodeSimul. It is not a browser-facing service and does not expose the Docker daemon.

## Prerequisites

- Node.js 18 or later
- Docker Desktop or Docker Engine running locally
- The CodeSimul runner image:

  ```bash
  docker build -t codesimul-runner:latest -f ../backend/Dockerfile.sandbox ..
  ```

## Local setup

Install dependencies from this directory:

```bash
npm install
```

Set a token before starting. PowerShell:

```powershell
$env:EXECUTOR_TOKEN = "replace-with-a-long-random-secret"
npm start
```

macOS/Linux:

```bash
EXECUTOR_TOKEN=replace-with-a-long-random-secret npm start
```

The service listens on `http://localhost:5002` by default. `SANDBOX_IMAGE` defaults to `codesimul-runner:latest`; set `PORT` to use a different port.

## API

Every request requires:

```http
Authorization: Bearer <EXECUTOR_TOKEN>
```

`GET /health` returns `{ "status": "ok" }` and does not require authentication or execute code.

`POST /execute` accepts `code`, optional `input`, and optional `language` (`cpp`, `python`, or `java`). It returns `output`, Docker exit `status`, and `timedOut`.

`POST /execute-tests` accepts `code`, optional `language`, plus either one `input`/`expectedOutput` pair or a `testCases` array. It returns the evaluated result set for contest use.

Do not expose the Docker socket or a Docker TCP port. A future Render backend integration should call this service using HTTPS and the shared token.
