import { Link, useRouterState } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  LayoutDashboard,
  Users,
  UserCog,
  Receipt,
  Calendar,
  Dumbbell,
  Settings,
  Flame,
  Sparkles,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { supabase } from "@/integrations/supabase/client";

const items = [
  { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard },
  { title: "Leads", url: "/leads", icon: Sparkles },
  { title: "Members", url: "/members", icon: Users },
  { title: "Staff", url: "/staff", icon: UserCog },
  { title: "Billing", url: "/billing", icon: Receipt },
  { title: "Attendance", url: "/attendance", icon: Calendar },
  { title: "Personal Training", url: "/pt", icon: Dumbbell },
  { title: "Settings", url: "/settings", icon: Settings },
];

function useFollowUpDueCount() {
  const { data } = useQuery({
    queryKey: ["leads-due-count"],
    queryFn: async () => {
      const [stagesRes, leadsRes] = await Promise.all([
        supabase.from("lead_stages").select("id, follow_up_days"),
        supabase.from("leads").select("id, stage_id, last_contacted_at, next_follow_up_at, created_at, converted_member_id"),
      ]);
      const stages = stagesRes.data ?? [];
      const leads = leadsRes.data ?? [];
      const now = Date.now();
      return leads.filter(l => {
        if (l.converted_member_id) return false;
        if (l.next_follow_up_at && new Date(l.next_follow_up_at).getTime() <= now) return true;
        const stage = stages.find(s => s.id === l.stage_id);
        if (!stage?.follow_up_days) return false;
        const anchor = l.last_contacted_at ?? l.created_at;
        return now - new Date(anchor).getTime() > stage.follow_up_days * 86400000;
      }).length;
    },
    refetchInterval: 60000,
  });
  return data ?? 0;
}

export function AppSidebar() {
  const currentPath = useRouterState({ select: (r) => r.location.pathname });
  const isActive = (url: string) =>
    currentPath === url || currentPath.startsWith(url + "/");
  const dueCount = useFollowUpDueCount();

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="border-b border-sidebar-border">
        <Link to="/dashboard" className="flex items-center gap-2 px-2 py-2 group">
          <div className="h-8 w-8 rounded-lg gradient-primary flex items-center justify-center shadow-sm">
            <Flame className="h-4 w-4 text-primary-foreground" />
          </div>
          <div className="flex flex-col leading-tight group-data-[collapsible=icon]:hidden">
            <span className="font-display font-bold text-sm tracking-tight">Fitness Dream</span>
            <span className="text-[10px] uppercase tracking-widest text-muted-foreground">
              Gym OS
            </span>
          </div>
        </Link>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Manage</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((item) => (
                <SidebarMenuItem key={item.url}>
                  <SidebarMenuButton asChild isActive={isActive(item.url)}>
                    <Link to={item.url} className="flex items-center gap-2">
                      <item.icon className="h-4 w-4" />
                      <span className="flex-1">{item.title}</span>
                      {item.url === "/leads" && dueCount > 0 && (
                        <span className="ml-auto inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold group-data-[collapsible=icon]:hidden">
                          {dueCount}
                        </span>
                      )}
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}
