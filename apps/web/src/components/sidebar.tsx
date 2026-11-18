import { NavLink } from "react-router-dom";
import {
  LayoutDashboard,
  FolderGit2,
  Settings,
  Rocket,
} from "lucide-react";
import { cn } from "@/lib/utils";

const navigation = [
  { name: "Dashboard", href: "/", icon: LayoutDashboard },
  { name: "Projects", href: "/projects", icon: FolderGit2 },
  { name: "Deployments", href: "/deployments", icon: Rocket },
  { name: "Settings", href: "/settings", icon: Settings },
];

export function Sidebar() {
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

      {/* Footer */}
      <div className="border-t border-[#27272a] px-4 py-3">
        <p className="text-xs text-[#71717a]">Phase 1 — Foundation</p>
      </div>
    </aside>
  );
}
