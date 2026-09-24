// Create React App embeds REACT_APP_* variables at build time. Vercel does not
// read the local .env file, so keep a safe production default as well as the
// local-development default.
const defaultBackendUrl = process.env.NODE_ENV === "production"
  ? "https://codesimul-wlx1.onrender.com"
  : "http://localhost:5001";

const configuredBackendUrl = process.env.REACT_APP_BACKEND_URL || defaultBackendUrl;

export const BACKEND_URL = configuredBackendUrl.replace(/\/$/, "");
