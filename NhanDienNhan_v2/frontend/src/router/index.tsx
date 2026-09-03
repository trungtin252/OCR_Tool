import { Navigate, Route, Routes } from "react-router";
import App from "../App";
import { AdminPage } from "../admin/AdminPage";

export function AppRouter() {
  return (
    <Routes>
      <Route element={<App />} path="/" />
      <Route element={<AdminPage />} path="/admin" />
      <Route element={<Navigate replace to="/" />} path="*" />
    </Routes>
  );
}
