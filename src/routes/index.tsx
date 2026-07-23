import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Flame } from "lucide-react";

export const Route = createFileRoute("/")({
  ssr: false,
  component: IndexRedirect,
});

function IndexRedirect() {
  const navigate = useNavigate();
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/dashboard", replace: true });
      else navigate({ to: "/auth", replace: true });
    });
  }, [navigate]);
  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="flex items-center gap-3 animate-fade-in">
        <div className="h-10 w-10 rounded-lg gradient-primary flex items-center justify-center animate-pulse">
          <Flame className="h-5 w-5 text-primary-foreground" />
        </div>
        <span className="font-display text-lg font-bold">Fitness Dream</span>
      </div>
    </div>
  );
}
