const ADMIN_SESSION_KEY = "ocr-admin-authenticated";

export function authenticateAdmin(username: string, password: string): boolean {
  const configuredUsername = import.meta.env.VITE_ADMIN_USERNAME;
  const configuredPassword = import.meta.env.VITE_ADMIN_PASSWORD;
  const authenticated =
    Boolean(configuredUsername && configuredPassword) &&
    username === configuredUsername &&
    password === configuredPassword;
  if (authenticated) {
    window.sessionStorage.setItem(ADMIN_SESSION_KEY, "true");
  }
  return authenticated;
}

export function isAdminAuthenticated(): boolean {
  return window.sessionStorage.getItem(ADMIN_SESSION_KEY) === "true";
}

export function logoutAdmin(): void {
  window.sessionStorage.removeItem(ADMIN_SESSION_KEY);
}
