import { useEffect, useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Session } from "@supabase/supabase-js";
import { LoadingSpinner } from "@/components/ui/loading-spinner";

interface ProtectedRouteProps {
  children: React.ReactNode;
}

export default function ProtectedRoute({ children }: ProtectedRouteProps) {
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [hasSubscription, setHasSubscription] = useState<boolean | null>(null);
  const location = useLocation();

  useEffect(() => {
    // Set up auth state listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setSession(session);
        if (!session) {
          setIsLoading(false);
          setHasSubscription(null);
        }
      }
    );

    // Check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (!session) {
        setIsLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  // Check subscription when session is available
  useEffect(() => {
    const checkSubscription = async () => {
      if (!session) return;

      try {
        const { data, error } = await supabase.functions.invoke("check-subscription");
        
        if (error) {
          console.error("Error checking subscription:", error);
          setHasSubscription(false);
        } else {
          setHasSubscription(data?.hasAccess === true);
          
          if (!data?.hasAccess) {
            console.log("No access:", data?.reason, data?.message);
          }
        }
      } catch (error) {
        console.error("Error checking subscription:", error);
        setHasSubscription(false);
      } finally {
        setIsLoading(false);
      }
    };

    if (session) {
      checkSubscription();
    }
  }, [session]);

  if (isLoading) {
    return <LoadingSpinner fullPage />;
  }

  if (!session) {
    return <Navigate to="/auth" replace />;
  }

  if (hasSubscription === false) {
    return <Navigate to="/planos" replace state={{ from: location }} />;
  }

  return <>{children}</>;
}
