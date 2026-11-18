import { useQuery } from "@tanstack/react-query";
import { FolderGit2, Plus, Github } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { authApi } from "@/lib/api";
import { useAuth } from "@/hooks/use-auth";

export function DashboardPage() {
  const { user: localUser } = useAuth();

  const { data: user } = useQuery({
    queryKey: ["currentUser"],
    queryFn: () => authApi.getMe(),
    initialData: localUser ?? undefined,
    staleTime: 60 * 1000,
  });

  const displayName = user?.name || localUser?.name || "Developer";

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-lg font-semibold text-[#fafafa]">Dashboard</h1>
        <p className="mt-1 text-sm text-[#a1a1aa]">
          Welcome back, {displayName}. Deploy and manage your applications.
        </p>
      </div>

      {/* Quick Actions */}
      <div className="grid gap-4 sm:grid-cols-2">
        <Card className="border-[#27272a] bg-[#111113]">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-[#fafafa]">
              Get Started
            </CardTitle>
            <CardDescription className="text-[#a1a1aa]">
              Connect a GitHub repository to deploy your first project.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              variant="outline"
              size="sm"
              className="gap-2 border-[#27272a] text-[#a1a1aa] hover:border-[#fafafa]/20 hover:text-[#fafafa]"
              disabled
            >
              <Github className="h-4 w-4" />
              Connect GitHub
            </Button>
          </CardContent>
        </Card>

        <Card className="border-[#27272a] bg-[#111113]">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-[#fafafa]">
              New Project
            </CardTitle>
            <CardDescription className="text-[#a1a1aa]">
              Create a new project from a connected repository.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              variant="outline"
              size="sm"
              className="gap-2 border-[#27272a] text-[#a1a1aa] hover:border-[#fafafa]/20 hover:text-[#fafafa]"
              disabled
            >
              <Plus className="h-4 w-4" />
              New Project
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Projects */}
      <div>
        <h2 className="mb-4 text-sm font-medium text-[#fafafa]">Projects</h2>
        <Card className="border-[#27272a] bg-[#111113]">
          <CardContent className="flex flex-col items-center justify-center py-16">
            <div className="rounded-full border border-[#27272a] bg-[#09090b] p-3">
              <FolderGit2 className="h-6 w-6 text-[#71717a]" />
            </div>
            <p className="mt-4 text-sm text-[#a1a1aa]">No projects yet</p>
            <p className="mt-1 text-xs text-[#71717a]">
              Connect a GitHub repository to get started.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
