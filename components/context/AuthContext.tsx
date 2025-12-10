// src/context/AuthContext.tsx
import {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
} from 'react';
import axios from 'axios';
import { useRouter } from 'next/navigation';

// Define the shape of your authentication state
// You can replace 'any' with a more specific interface if you know the user object structure
interface AuthState {
  accessToken: string | null;
  email: string | null;
  user: any | null; // user can be null if not logged in
}

// Define the shape of the context value
interface AuthContextType extends AuthState {
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  isLoading: boolean;
}

// Define default state
const defaultAuthState: AuthState = {
  accessToken: null,
  email: null,
  user: null,
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
}

const ACCESS_TOKEN_STORAGE_KEY = 'accessToken';
const USER_EMAIL_STORAGE_KEY = 'email';
const USER_STORAGE_KEY = 'user';

export const AuthProvider = ({ children }: AuthProviderProps) => {
  const [auth, setAuth] = useState<AuthState>(defaultAuthState);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();

  // Effect to read from localStorage on mount
  useEffect(() => {
    const storedToken = localStorage.getItem(ACCESS_TOKEN_STORAGE_KEY);
    const storedEmail = localStorage.getItem(USER_EMAIL_STORAGE_KEY);
    const storedUserString = localStorage.getItem(USER_STORAGE_KEY); // Get the string

    let storedUser = null;
    if (storedUserString) {
      try {
        storedUser = JSON.parse(storedUserString); // Safely parse the string
      } catch (error) {
        console.error('Failed to parse stored user data:', error);
        // Handle parsing error, maybe clear local storage
        localStorage.removeItem(USER_STORAGE_KEY);
      }
    }

    if (storedToken) {
      setAuth({
        accessToken: storedToken,
        user: storedUser, // Set the parsed object directly
        email: storedEmail,
      });
    }
    setIsLoading(false);
  }, []); // Run only on mount

  // Effect to write to localStorage when auth state changes
  useEffect(() => {
    // Only save to localStorage on the client side
    if (typeof window === 'undefined') {
      return;
    }

    if (auth.accessToken) {
      localStorage.setItem(ACCESS_TOKEN_STORAGE_KEY, auth.accessToken);
      if (auth.email) {
        localStorage.setItem(USER_EMAIL_STORAGE_KEY, auth.email);
      } else {
        localStorage.removeItem(USER_EMAIL_STORAGE_KEY);
      }

      // Only store user object if it exists in auth state
      if (auth.user) {
        localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(auth.user)); // Stringify the object for storage
      } else {
        localStorage.removeItem(USER_STORAGE_KEY);
      }
    } else {
      // Remove all auth related items from storage on logout
      localStorage.removeItem(ACCESS_TOKEN_STORAGE_KEY);
      localStorage.removeItem(USER_EMAIL_STORAGE_KEY);
      localStorage.removeItem(USER_STORAGE_KEY);
    }
    // Depend on accessToken, email, and user object changes
    // Note: Tracking changes in a complex object (auth.user) might require
    // more sophisticated comparison if objects are modified internally without creating new ones.
    // For simple assignment like `user: res.data.user`, this dependency is fine.
  }, [auth.accessToken, auth.email, auth.user]);

  // Login function
  const login = async (email: string, password: string) => {
    try {
      // IMPORTANT: Ensure your backend /login endpoint returns the user object
      // along with the access_token, e.g., { access_token: "...", user: { ... } }
      const res = await axios.post(`${process.env.NEXT_PUBLIC_API_URL}/auth/login`, {
        // Use NEXT_PUBLIC_
        email,
        password,
      });

      // Assuming res.data is { access_token: string, user: object }
      const { access_token, user } = res.data;

      if (access_token && user) {
        // Check for both token and user object
        setAuth({
          accessToken: access_token,
          user: user, // <--- Store the object directly here
          email: email, // Use the email from the form input or res.data.user.email
        });
        // Redirect is often handled by the component calling login
        // router.push('/dashboard');
      } else {
        console.error(
          'Login successful but missing access token or user data.'
        );
        // Optionally throw an error or set a specific state for UI feedback
        throw new Error('Login response missing token or user data.');
      }
    } catch (error) {
      console.error('Login failed:', error);
      throw error; // Propagate the error
    }
  };

  // Logout function
  const logout = () => {
    setAuth(defaultAuthState);
    // Redirect is often handled by the component calling logout
    router.push('/login');
  };

  const contextValue: AuthContextType = {
    ...auth,
    login,
    logout,
    isLoading,
  };

  return (
    <AuthContext.Provider value={contextValue}>{children}</AuthContext.Provider>
  );
};

// Custom Hook to Consume Context
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
