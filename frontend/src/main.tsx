// src/main.tsx
import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { Provider } from "react-redux";
import { Toaster } from "react-hot-toast";
import { store } from "./store";
import App from "./App";
import "./styles/index.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <Provider store={store}>
      <BrowserRouter>
        <App />
        <Toaster
          position="top-right"
          toastOptions={{
            duration: 3000,
            style: {
              background: "#232f3e",
              color: "#fff",
              borderRadius: "8px",
              fontSize: "14px",
            },
            success: { iconTheme: { primary: "#ff9900", secondary: "#000" } },
          }}
        />
      </BrowserRouter>
    </Provider>
  </React.StrictMode>,
);
