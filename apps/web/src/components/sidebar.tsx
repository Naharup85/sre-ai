import { NavLink, useNavigate } from "react-router-dom";
import {
  LayoutDashboard,
  FolderGit2,
  Settings,
  Rocket,
  LogOut,
  User as UserIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/use-auth";

const navigation = [
  { name: "Dashboard", href: "/", icon: LayoutDashboard },
  { name: "Projects", href: "/projects", icon: FolderGit2 },
  { name: "Deployments", href: "/deployments", icon: Rocket },
  { name: "Settings", href: "/settings", icon: Settings },
];

export function Sidebar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate("/login", { replace: true });
  };

  return (
    <aside className="flex h-screen w-56 flex-col border-r border-[#27272a] bg-[#09090b]">
      {/* Logo */}
      <div className="flex h-14 items-center gap-2 border-b border-[#27272a] px-4">
        <Rocket className="h-5 w-5 text-[#fafafa]" />
        <span className="text-sm font-semibold text-[#fafafa]">SRE AI</span>
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-1 px-2 py-3">
        {navigation.map((item) => (
          <NavLink
            key={item.name}
            to={item.href}
            className={({ isActive }) =>
              cn(
                "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                isActive
                  ? "bg-[#27272a]/50 text-[#fafafa]"
                  : "text-[#a1a1aa] hover:bg-[#27272a]/30 hover:text-[#fafafa]",
              )
            }
          >
            <item.icon className="h-4 w-4" />
            {item.name}
          </NavLink>
        ))}
      </nav>

      {/* User profile & Logout */}
      {user && (
        <div className="border-t border-[#27272a] p-3">
          <div className="mb-2 flex items-center gap-2 px-1">
            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-[#111113] border border-[#27272a] text-[#a1a1aa]">
              <UserIcon className="h-3.5 w-3.5" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-medium text-[#fafafa]">
                {user.name}
              </p>
              <p className="truncate text-[10px] text-[#71717a]">
                {user.email}
              </p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-xs text-[#a1a1aa] transition-colors hover:bg-[#27272a]/40 hover:text-[#fafafa]"
          >
            <LogOut className="h-3.5 w-3.5" />
            Sign out
          </button>
        </div>
      )}

      {/* Footer */}
      <div className="border-t border-[#27272a] px-4 py-2.5">
        <p className="text-[10px] text-[#71717a]">Phase 2 — Authentication</p>
      </div>
    </aside>
  );
}
