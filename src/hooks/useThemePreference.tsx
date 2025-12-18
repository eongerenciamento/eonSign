import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { supabase } from "@/integrations/supabase/client";

export function useThemePreference() {
  const { theme, setTheme, resolvedTheme } = useTheme();
  const [userId, setUserId] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    
    const loadUserAndTheme = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setUserId(user.id);
        // Load user-specific theme preference
        const savedTheme = localStorage.getItem(`theme-preference-${user.id}`);
        if (savedTheme) {
          setTheme(savedTheme);
        }
      }
    };

    loadUserAndTheme();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        if (session?.user) {
          setUserId(session.user.id);
          const savedTheme = localStorage.getItem(`theme-preference-${session.user.id}`);
          if (savedTheme) {
            setTheme(savedTheme);
          }
        } else {
          setUserId(null);
        }
      }
    );

    return () => subscription.unsubscribe();
  }, [setTheme]);

  const toggleTheme = () => {
    const newTheme = resolvedTheme === "dark" ? "light" : "dark";
    setTheme(newTheme);
    if (userId) {
      localStorage.setItem(`theme-preference-${userId}`, newTheme);
    }
  };

  const setUserTheme = (newTheme: "light" | "dark") => {
    setTheme(newTheme);
    if (userId) {
      localStorage.setItem(`theme-preference-${userId}`, newTheme);
    }
  };

  return {
    theme: resolvedTheme,
    setTheme: setUserTheme,
    toggleTheme,
    isDark: resolvedTheme === "dark",
    mounted,
  };
}
