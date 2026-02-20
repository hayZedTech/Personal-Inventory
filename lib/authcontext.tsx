import { createContext, useContext, useEffect, useState } from "react"
import { ID, Models } from "react-native-appwrite";
import { account } from "./appwrite";

type AuthType = {
    user: Models.User<Models.Preferences> | null;
    isLoading: boolean;
    signUp: (email: string, password: string) => Promise<string | null>;
    signIn: (email: string, password: string) => Promise<string | null>;
    logout: () => Promise<void>;
    forgotPassword: (email: string) => Promise<string | null>;
    confirmPasswordReset: (userId: string, secret: string, pass: string) => Promise<string | null>;
}

export const AuthContext = createContext<AuthType | undefined>(undefined);

export default function AuthProvider({ children }: { children: React.ReactNode }) {
    const [user, setUser] = useState<Models.User<Models.Preferences> | null>(null);
    const [isLoading, setIsLoading] = useState<boolean>(true);

    useEffect(() => {
        getUser();
    }, []);

    const getUser = async () => {
        try {
            // STEP 1: Request the user account from Appwrite
            const session = await account.get();
            
            // If successful, update the global user state
            setUser(session);
            console.log("Session active for:", session.email);
        } catch (error: any) {
            // STEP 2: The Resilience Check
            // 401 means "Unauthorized" (Session is expired or doesn't exist)
            if (error.code === 401) {
                setUser(null);
                console.log("Status: No active session (User is guest).");
            } else {
                // This handles network timeouts or server issues
                // We DON'T set user to null here, so the app doesn't 
                // accidentally kick them out during a network blink.
                console.warn("Network/Server Error during startup:", error.message);
            }
        } finally {
            // STEP 3: Stop the loading spinner
            setIsLoading(false);
        }
    };

    const logout = async () => {
        try {
            await account.deleteSession({ sessionId: "current" });
            setUser(null);
        } catch (error) {
            console.log("Logout error:", error);
            setUser(null); // Force clear state anyway
        }
    }

    const signUp = async (email: string, password: string) => {
        try {
            // Create the account
            await account.create({ userId: ID.unique(), email, password });
            
            // Log them in immediately.
            // IMPORTANT: In your AuthPage, ensure the result of this saves to SecureStore!
            return await signIn(email, password);
        } catch (error: any) {
            console.log("Signup Error:", error);
            return error.message || "Error during Sign up!";
        }
    }

    const signIn = async (email: string, password: string) => {
        try {
            // STEP 1: Clear any "Ghost Sessions"
            // Appwrite throws an error if you try to login while another session is active.
            try {
                await account.deleteSession({ sessionId: "current" });
            } catch (e) { /* No session exists, ignore */ }

            // STEP 2: Create the new session
            await account.createEmailPasswordSession({ email, password });
            
            // STEP 3: Refresh user data in state
            const userData = await account.get();
            setUser(userData);
            return null; // Success
        } catch (error: any) {
            console.log("Sign-in Error:", error); 
            if (error.type === 'user_invalid_credentials') {
                return "Invalid email or password.";
            }
            return error.message || "Error during Sign in!";
        }
    }

    const forgotPassword = async (email: string) => {
        try {
            // Replace with your actual production URL
            await account.createRecovery(email, 'https://port-frontend-u36j.vercel.app/reset-password');
            return null;
        } catch (error: any) {
            return error.message || "Error sending reset email!";
        }
    }

    const confirmPasswordReset = async (userId: string, secret: string, pass: string) => {
        try {
            await account.updateRecovery(userId, secret, pass);
            return null;
        } catch (error: any) {
            return error.message || "Failed to update password.";
        }
    };

    return (
        <AuthContext.Provider value={{ user, isLoading, signUp, signIn, logout, forgotPassword, confirmPasswordReset }}>
            {children}
        </AuthContext.Provider>
    )
}

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error("useAuth must be used within an AuthProvider");
    }
    return context;
}