# Code Simul - Collaborative Coding Platform

## Overview
Code Simul is a real-time collaborative coding platform that enables multiple users to code together in shared rooms with features like:
- Real-time code editing (Monaco Editor)
- Collaborative whiteboard/drawing
- C++ code compilation and execution
- Codeforces problem integration
- User presence and typing indicators
- Room-based collaboration system

## Architecture

### Frontend (React)
- **Framework**: React 19 with Create React App
- **Styling**: Tailwind CSS
- **State Management**: React hooks (useState, useEffect, useContext)
- **Real-time Communication**: Socket.IO client
- **Code Editor**: @monaco-editor/react
- **Routing**: React Router DOM v7

#### Key Frontend Components
- `src/App.js`: Main application routing
- `src/pages/Home.jsx`: Lobby page for creating/joining rooms
- `src/pages/room.jsx`: Main collaboration room interface
- `src/socket.js`: Socket.IO client configuration

### Backend (Node.js/Express)
- **Framework**: Express.js
- **Real-time**: Socket.IO server
- **Code Execution**: Child process for C++ compilation/execution
- **External API**: Codeforces API integration
- **Static File Serving**: Serves React build in production

#### Key Backend Features
- `/api/health`: Health check endpoint
- `/run`: C++ code execution endpoint
- `/cf/meta`: Codeforces problem metadata proxy
- Socket.IO events for real-time collaboration:
  - `join-room`: User joins a collaboration room
  - `code-change`: Real-time code synchronization
  - `draw`: Collaborative whiteboard drawing
  - `clear-board`: Whiteboard clearing
  - `open-problem`: Sharing problem links
  - `user-typing`: Typing indicators
  - `room-users`: User list synchronization
  - `user-joined`/`user-left`: User presence updates

## Key Functionalities

### Room System
- Users can create rooms with auto-generated 6-character codes
- Users can join rooms using room codes and usernames
- Each room maintains isolated state for code, whiteboard, and user list

### Real-time Code Collaboration
- Monaco Editor for syntax-highlighted code editing
- Code changes broadcast via Socket.IO to all room members
- Local optimistic updates with remote update detection to prevent loops
- Support for C++ language (configurable in editor options)

### Collaborative Whiteboard
- HTML5 Canvas-based drawing interface
- Real-time line drawing with color selection
- Clear board functionality
- Pressure-sensitive stroke width (fixed at 3px)
- Canvas resizing on window resize

### Code Execution
- Backend endpoint compiles and runs C++ code with gcc
- 5-second timeout for execution safety
- Input/stdin support via textarea
- Error handling for compilation/runtime errors
- Output displayed in frontend terminal

### Codeforces Integration
- Fetch problem metadata from Codeforces API
- Support for parsing problem URLs:
  - `https://codeforces.com/problemset/problem/<contestId>/<index>`
  - `https://codeforces.com/contest/<contestId>/problem/<index>`
- Display problem name, rating, and tags
- One-click problem link opening in new tab
- Broadcast problem links to room members

### User Presence & Indicators
- User list with color-coded avatars
- Visual indicator for current user in room
- Typing indicators with 2-second timeout
- Join/leave notifications
- User count display

## Technical Details

### Dependencies
#### Frontend
- react: ^19.2.3
- react-dom: ^19.2.3
- react-router-dom: ^7.12.0
- @monaco-editor/react: ^4.7.0
- socket.io-client: ^4.8.3
- Tailwind CSS ecosystem (tailwindcss, postcss, autoprefixer)

#### Backend
- express
- cors
- socket.io
- Child process built-in modules (exec, fs, path, http, https)

### Environment Variables
- PORT: Backend port (defaults to 5001)
- NODE_TLS_REJECT_UNAUTHORIZED: Set to "0" for Codeforces TLS compatibility

### Service Ports
- Frontend: Port 3000 (development via react-scripts start)
- Backend: Port 5001 (Node.js/Express server)
- Proxy: Frontend dev server proxies `/run` and `/cf/meta` to backend

### Security Considerations
- CORS enabled for all origins (development convenience)
- Input sanitization limited to basic validation
- Code execution sandboxed via timeout and child process isolation
- No authentication system (rooms accessed via shared codes)

## Development Setup

### Prerequisites
- Node.js (v16+ recommended)
- npm or yarn
- g++ compiler (for C++ execution)

### Installation
```bash
npm install
```

### Development Commands
```bash
# Start backend server
npm start

# Start frontend development server
npm run dev

# Build for production
npm run build

# Run tests
npm test

# Eject from CRA (not recommended)
npm run eject
```

### Heroku Deployment
- heroku-postbuild script installs backend dependencies and builds frontend
- Procfile not shown but implied by npm start command

## File Structure
```
Codesimul/
├── backend/
│   ├── index.js          # Main server entry point
│   ├── main.cpp          # Temporary C++ execution file
│   ├── input.txt         # Temporary stdin file
│   ├── package.json      # Backend dependencies
│   └── package-lock.json
├── node_modules/         # Project dependencies
├── public/               # React static assets
├── src/
│   ├── pages/
│   │   ├── Home.jsx      # Lobby/room creation page
│   │   └── room.jsx      # Main collaboration interface
│   ├── App.js            # React routing
│   ├── index.js          # React entry point
│   ├── socket.js         # Socket.IO client config
│   ├── App.css           # Global styles
│   └── index.css         # Root styles
├── package.json          # Frontend dependencies & scripts
├── package-lock.json     # Locked dependency versions
├── postcss.config.js     # Postcss configuration
├── tailwind.config.js    # Tailwind CSS configuration
└── README.md             # Create React App default documentation
```

## Data Flow

### User Joins Room
1. User enters username and room code on Home page
2. Frontend navigates to `/room/:roomId` with username in state
3. Room component verifies username, connects socket
4. Socket emits `join-room` with `{roomId, username}`
5. Backend adds user to roomUsers map, notifies room members
6. Backend emits `room-users` with updated user list

### Code Collaboration
1. User edits code in Monaco Editor
2. onChange handler calls `handleCodeChange`
3. If not remote update, emits `code-change` to socket
4. Backend broadcasts to all clients in room except sender
5. Receiving clients update editor value (with isRemoteUpdate flag to prevent loops)

### Whiteboard Collaboration
1. User draws on canvas (mouse down/move/up)
2. Draw handler captures coordinates and color
3. Emit `draw` event with line coordinates
4. Receiving clients render line on their canvas

### Problem Sharing
1. User pastes Codeforces link and clicks Load
2. Frontend parses URL, fetches problem data from backend proxy
3. Backend fetches from Codeforces API with keep-alive agent
4. Problem data displayed in left panel
5. Link broadcast via `open-problem` socket event
6. Receiving users see notification to open problem

### Code Execution
1. User clicks "Run Code" button
2. Frontend sends POST to `/run` with `{code, input}`
3. Backend writes code to main.cpp, input to input.txt
4. Backend executes: `g++ main.cpp -o main && ./main < input.txt`
5. Backend returns `{output: stdout|error}` JSON
6. Frontend displays output in terminal pane

## Room Lifecycle
- Rooms exist in memory only (backend's roomUsers Map)
- No persistence - rooms disappear when last user leaves
- Empty rooms automatically cleaned up by backend
- No user accounts or persistent profiles

## Known Limitations & Considerations
1. **No Persistence**: All room data is lost when backend restarts
2. **Limited Language Support**: Currently only C++ execution supported
3. **Basic Security**: No authentication, authorization, or input sanitization beyond basics
4. **Scalability**: Memory-based room storage limits horizontal scaling
5. **Browser Compatibility**: Modern browsers required for canvas, Monaco Editor, Socket.IO
6. **Mobile Support**: Not optimized for mobile touch interfaces

## Future Enhancements
1. Add persistence layer (database) for room recovery
2. Support multiple programming languages
3. Implement user accounts and profile system
4. Add room history and replay functionality
5. Improve mobile responsiveness
6. Add voice/video chat integration
7. Implement role-based permissions (owner, admin, participant)
8. Add file upload/download capabilities
9. Enhance problem integration with more platforms (LeetCode, HackerRank, etc.)
10. Add custom problem creation and sharing

## Design Decisions
1. **Socket.IO**: Chosen for reliable real-time communication with fallback mechanisms
2. **Monaco Editor**: Provides VS Code-like editing experience in browser
3. **Tailwind CSS**: Enables rapid UI development with consistent styling
4. **Codeforces Proxy**: Backend fetches to avoid CORS issues and enable caching
5. **Optimistic Updates**: Frontend assumes success for better UX, corrects on failure
6. **Room Codes**: Short, shareable codes instead of complex URLs for easy collaboration
7. **Stateless Rooms**: Simplicity over persistence for MVP approach

## Error Handling
- Backend returns JSON error responses for API endpoints
- Socket.IO connection handling with reconnect attempts
- Frontend shows notifications for user actions (joins, leaves, errors)
- Code execution errors displayed in output terminal
- Invalid URL detection for problem sharing
- Empty room cleanup to prevent memory leaks

## Performance Considerations
- Debounced typing indicators (2-second timeout)
- Canvas redraw optimization with device pixel ratio handling
- Editor layout recalculation on panel resizes
- Socket.IO efficient broadcasting (to room except sender)
- Minimal state updates to prevent unnecessary re-renders