const configuredBackendUrl = process.env.REACT_APP_BACKEND_URL || "http://localhost:5001";

export const BACKEND_URL = configuredBackendUrl.replace(/\/$/, "");
