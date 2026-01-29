// src/App.tsx
import React from "react";
import AppRoutes from "./routes/AppRoutes";
import { SettingsProvider } from "./context/SettingsContext";
import { SelectionProvider } from "./context/SelectionContext";
import { AuthProvider } from "./context/AuthContext";
import ScrollToTop from "./components/ScrollToTop";

export default function App() {
  return (
    <SettingsProvider>
      <AuthProvider>
        <SelectionProvider>
          <ScrollToTop />
          <AppRoutes />
        </SelectionProvider>
      </AuthProvider>
    </SettingsProvider>
  );
}
