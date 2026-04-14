import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { SettingsProvider } from "@/contexts/SettingsContext";
import { ClientPreferencesProvider } from "@/contexts/ClientPreferencesContext";
import App from "@/App.jsx";
import "./index.css";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <SettingsProvider>
          <ClientPreferencesProvider>
            <App />
          </ClientPreferencesProvider>
        </SettingsProvider>
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>,
);
