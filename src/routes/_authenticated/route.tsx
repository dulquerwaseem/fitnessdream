import { Outlet, createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { AppTopbar } from "@/components/app-topbar";
import { AppLoadingScreen } from "@/components/app-loading-screen";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  component: AuthedLayout,
});

// The fade-out delay below must match .animate-fade-out's duration in
// styles.css (280ms) so the splash finishes animating before it unmounts.
const FADE_OUT_MS = 280;

function AuthedLayout() {
  const navigate = useNavigate();
  const [authed, setAuthed] = useState(false);
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    let active = true;
    supabase.auth.getUser().then(({ data }) => {
      if (!active) return;
      if (data.user) {
        setLeaving(true);
        setTimeout(() => { if (active) setAuthed(true); }, FADE_OUT_MS);
      } else {
        navigate({ to: "/auth", replace: true });
      }
    });
    return () => { active = false; };
  }, [navigate]);

  if (!authed) {
    return <AppLoadingScreen leaving={leaving} />;
  }

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full bg-background">
        <AppSidebar />
        <SidebarInset className="flex-1 min-w-0">
          <AppTopbar />
          <main className="flex-1 p-4 sm:p-6 lg:p-8 animate-fade-in">
            <Outlet />
          </main>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
}
