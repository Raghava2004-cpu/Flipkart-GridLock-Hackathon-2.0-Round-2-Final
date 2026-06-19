import axios from "axios";

const BASE = process.env.REACT_APP_BACKEND_URL;
export const API = `${BASE}/api`;

export const apiClient = axios.create({ baseURL: API, timeout: 30000 });

export const fetchMeta = () => apiClient.get("/meta").then((r) => r.data);
export const fetchStations = () => apiClient.get("/police-stations").then((r) => r.data);
export const fetchModelStatus = () => apiClient.get("/model-status").then((r) => r.data);
export const fetchActive = () => apiClient.get("/incidents/active").then((r) => r.data);
export const fetchAll = () => apiClient.get("/incidents").then((r) => r.data);
export const fetchStats = () => apiClient.get("/stats").then((r) => r.data);

export const createIncident = (payload) =>
  apiClient.post("/incidents", payload).then((r) => r.data);

export const resolveIncident = (id, actual_minutes) =>
  apiClient.post(`/incidents/${id}/resolve`, { actual_minutes }).then((r) => r.data);

export const fetchAnalytics = () => apiClient.get("/analytics/summary").then((r) => r.data);
export const fetchActiveDiversions = () => apiClient.get("/diversions/active").then((r) => r.data);
export const clearAll = () => apiClient.post("/incidents/clear-all").then((r) => r.data);
export const fetchDiversion = (id) => apiClient.get(`/incidents/${id}/diversion`).then((r) => r.data);
