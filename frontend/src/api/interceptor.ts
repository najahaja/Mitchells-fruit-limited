import axios from "axios";
import toast from "react-hot-toast";

const axiosInstance = axios.create({
  baseURL: import.meta.env.VITE_BASE_URL,
  headers: {
    "Content-Type": "application/json",
  },
});

// ✅ REQUEST INTERCEPTOR
axiosInstance.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem("token");

    // Don't attach token for auth routes
    if (token && !config.url?.includes("/auth/")) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    return config;
  },
  (error) => Promise.reject(error),
);

// ✅ RESPONSE INTERCEPTOR
axiosInstance.interceptors.response.use(
  (response) => response,
  (error) => {
    if (!error.response) {
      toast.error("Network error. Please check your connection.");
      return Promise.reject("Network Error");
    }

    const { status, config } = error.response;

    // If auth API fails → don't redirect, let component handle
    if (config.url?.includes("/auth/")) {
      return Promise.reject(
        error.response?.data?.detail || "Authentication request failed",
      );
    }

    // 401 — session expired
    if (status === 401 && localStorage.getItem("token")) {
      localStorage.removeItem("token");
      localStorage.removeItem("role");
      toast.error("Session expired. Please login again.");
      setTimeout(() => {
        window.location.href = "/signin";
      }, 1000);
    }

    if (status === 403) {
      toast.error("You are not authorized.");
    }

    if (status >= 500) {
      toast.error("Server error. Please try again later.");
    }

    return Promise.reject(error.response?.data?.detail || error.message);
  },
);

export default axiosInstance;
