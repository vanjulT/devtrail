import { createContext, useContext } from "react";

// Shared login state: the user, and the login / register / logout functions
export const AuthContext = createContext(null);

export function useAuth() {
  return useContext(AuthContext);
}
