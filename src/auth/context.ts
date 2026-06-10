import { createContext } from 'react';
import type { User } from 'firebase/auth';

export interface AuthState {
  user: User | null;
  /** True until the first auth state resolution arrives. */
  loading: boolean;
  signIn: () => Promise<void>;
  logOut: () => Promise<void>;
}

export const AuthContext = createContext<AuthState | null>(null);
