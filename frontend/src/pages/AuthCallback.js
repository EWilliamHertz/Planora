import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Loader2 } from "lucide-react";

const API_URL = process.env.REACT_APP_BACKEND_URL;

export default function AuthCallback() {
  const hasProcessed = useRef(false);
  const navigate = useNavigate();
  const { setUser, storeToken } = useAuth();

  useEffect(() => {
    if (hasProcessed.current) return;
    hasProcessed.current = true;

    const processAuth = async () => {
      try {
        const hash = window.location.hash;
        const sessionId = hash.split('session_id=')[1];

        if (!sessionId) {
          navigate('/login', { replace: true });
          return;
        }

        const res = await fetch(
          `${API_URL}/api/auth/session?session_id=${sessionId}`,
          { credentials: 'include' }
        );

        if (!res.ok) {
          throw new Error('Session validation failed');
        }

        const userData = await res.json();

        // Persist the token so it survives page refreshes
        if (userData.session_token) {
          storeToken(userData.session_token);
        }

        setUser(userData);
        navigate('/dashboard', { replace: true });
      } catch (err) {
        console.error('Auth callback error:', err);
        navigate('/login', { replace: true });
      }
    };

    processAuth();
  }, [navigate, setUser, storeToken]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background" data-testid="auth-callback">
      <div className="text-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto mb-4" />
        <p className="text-muted-foreground text-sm">Signing you in...</p>
      </div>
    </div>
  );
}
