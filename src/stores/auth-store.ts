
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

type UserRole = 'user' | 'admin' | 'owner';

interface AuthState {
  email: string | null;
  role: UserRole | null;
  isAuthenticated: boolean;
  passwordChangeRequired: boolean;
  login: (email: string, role: UserRole) => void;
  setPasswordChangeRequired: (email: string, role: UserRole) => void;
  completePasswordChange: () => void;
  logout: () => void;
}

const initialState = {
  email: null,
  role: null,
  isAuthenticated: false,
  passwordChangeRequired: false,
};

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      ...initialState,
      login: (email, role) => set({ 
        email, 
        role, 
        isAuthenticated: true, 
        passwordChangeRequired: false 
      }),
      setPasswordChangeRequired: (email, role) => set({
        email,
        role,
        isAuthenticated: true,
        passwordChangeRequired: true,
      }),
      completePasswordChange: () => set({
        passwordChangeRequired: false
      }),
      logout: () => set(initialState),
    }),
    {
      name: 'auth-storage',
    }
  )
);
