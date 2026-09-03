import { useState } from "react";
import { AdminLogin } from "./AdminLogin";
import { AdminPanel } from "./AdminPanel";
import { isAdminAuthenticated, logoutAdmin } from "./auth";

export function AdminPage() {
  const [authenticated, setAuthenticated] = useState(isAdminAuthenticated);

  if (!authenticated) {
    return <AdminLogin onAuthenticated={() => setAuthenticated(true)} />;
  }

  return (
    <AdminPanel
      onLogout={() => {
        logoutAdmin();
        setAuthenticated(false);
      }}
    />
  );
}
