import { io } from "socket.io-client";
import { BACKEND_URL } from "./config/backend";

const socket = io(BACKEND_URL, {
  autoConnect: false,
  transports: ['websocket', 'polling'],
  reconnection: true,
  reconnectionDelay: 1000,
  reconnectionAttempts: 5
});

export default socket;
