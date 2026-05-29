// src/services/api.ts
import axios from "axios";
import { API_URL } from "./http";

const api = axios.create({
  baseURL: API_URL,
  headers: {
    "Content-Type": "application/json",
    Accept: "application/json",
  },
  timeout: 15000,
});

//intercepteur : on ajoute automatiquement le token JWT dans les headers de la requête

api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem("access");
    if (token) config.headers.Authorization = `Bearer ${token}`;
    return config;
  },
  (error) => {
    return Promise.reject(error);
  },
);

// intercepteur de reponse : on gère les erreurs globales du serveur (ex: 401 Unauthorized)

api.interceptors.response.use(
  (res) => res,
  async (err) => {
    const orig = err.config;
    if (err.response?.status === 401 && !orig._retry) {
      orig._retry = true;
      try {
        const refresh = localStorage.getItem("refresh");
        if (!refresh) throw new Error("No refresh token");
        const { data } = await axios.post(
          // `${api.defaults.baseURL}/auth/token/refresh/`,
          `${API_URL}/auth/token/refresh/`,
          { refresh },
        );
        localStorage.setItem("access", data.access);
        orig.headers.Authorization = `Bearer ${data.access}`;
        return api(orig);
      } catch {
        localStorage.clear();
        window.location.href = "/login";
      }
    }
    return Promise.reject(err);
  },
);

export default api;
