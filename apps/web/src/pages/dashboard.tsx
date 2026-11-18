import { useQuery, useMutation } from "@tanstack/react-query";
import { Link, useNavigate } from "react-router-dom";
import {
  FolderGit2,
  Plus,
  Github,
  CheckCircle2,
  ExternalLink,
  GitBranch,
  Lock,
  Globe,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { authApi, githubApi } from "@/lib/api";
import { useAuth } from "@/hooks/use-auth";

export function DashboardPage() {
  const { user: localUser } = useAuth();
  const navigate = useNavigate();

  // Current authenticated user
  const { data: user } = useQuery({
    queryKey: ["currentUser"],
    queryFn: () => authApi.getMe(),
    initialData: localUser ?? undefined,
    staleTime: 60 * 1000,
  });

  // GitHub connection status
  const { data: githubData, isLoading: isCheckingGithub } = useQuery({
    queryKey: ["githubInstallation"],
    queryFn: () => githubApi.getInstallation(),
  });

  // Selected repositories
  const { data: repositories = [], isLoading: isLoadingRepos } = useQuery({
    queryKey: ["selectedRepositories"],
    queryFn: () => githubApi.getSelectedRepositories(),
  });

  // Connect GitHub mutation
  const connectMutation = useMutation({
    mutationFn: () => githubApi.getInstallUrl(),
    onSuccess: (data) => {
      window.location.href = data.url;
    },
  });

  const displayName = user?.name || localUser?.name || "Developer";
  const isConnected = Boolean(githubData?.connected && githubData.installation);

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
              {isConnected
                ? `GitHub connected to @${githubData?.installation?.accountLogin}.`
                : "Connect a GitHub repository to deploy your first project."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isCheckingGithub ? (
              <div className="flex items-center gap-2 text-xs text-[#a1a1aa]">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Checking status...
              </div>
            ) : isConnected ? (
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  asChild
                  className="gap-2 border-[#27272a] text-[#fafafa] hover:bg-[#27272a]/30"
                >
                  <Link to="/settings">
                    <CheckCircle2 className="h-4 w-4 text-green-400" />
                    Connected Settings
                  </Link>
                </Button>
              </div>
            ) : (
              <Button
                variant="outline"
                size="sm"
                onClick={() => connectMutation.mutate()}
                disabled={connectMutation.isPending}
                className="gap-2 border-[#27272a] text-[#fafafa] hover:border-[#fafafa]/20 hover:text-[#fafafa]"
              >
                {connectMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Github className="h-4 w-4" />
                )}
                Connect GitHub
              </Button>
            )}
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
              disabled={!isConnected}
              onClick={() => navigate("/projects")}
              className="gap-2 border-[#27272a] text-[#fafafa] hover:border-[#fafafa]/20 hover:text-[#fafafa] disabled:opacity-50"
            >
              <Plus className="h-4 w-4" />
              New Project
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Projects */}
      <div>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-sm font-medium text-[#fafafa]">
            Projects {repositories.length > 0 && `(${repositories.length})`}
          </h2>
          {isConnected && repositories.length > 0 && (
            <Button
              variant="outline"
              size="sm"
              asChild
              className="h-7 text-xs border-[#27272a] text-[#a1a1aa] hover:text-[#fafafa]"
            >
              <Link to="/projects">
                <Plus className="mr-1 h-3 w-3" />
                Add Repository
              </Link>
            </Button>
          )}
        </div>

        {isLoadingRepos ? (
          <div className="flex h-32 items-center justify-center text-xs text-[#a1a1aa]">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Loading projects...
          </div>
        ) : repositories.length === 0 ? (
          <Card className="border-[#27272a] bg-[#111113]">
            <CardContent className="flex flex-col items-center justify-center py-16">
              <div className="rounded-full border border-[#27272a] bg-[#09090b] p-3">
                <FolderGit2 className="h-6 w-6 text-[#71717a]" />
              </div>
              <p className="mt-4 text-sm text-[#a1a1aa]">No projects yet</p>
              <p className="mt-1 text-xs text-[#71717a]">
                {isConnected
                  ? "Import an available repository from your connected GitHub account."
                  : "Connect a GitHub repository to get started."}
              </p>
              {isConnected && (
                <Button
                  size="sm"
                  asChild
                  className="mt-4 gap-2 bg-[#fafafa] text-[#09090b] hover:bg-[#fafafa]/90"
                >
                  <Link to="/projects">
                    <Plus className="h-3.5 w-3.5" />
                    Select Repository
                  </Link>
                </Button>
              )}
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {repositories.map((repo) => (
              <Card
                key={repo.id}
                className="border-[#27272a] bg-[#111113] transition-colors hover:border-[#fafafa]/20"
              >
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="text-sm font-medium text-[#fafafa]">
                        {repo.name}
                      </CardTitle>
                      <CardDescription className="text-xs text-[#a1a1aa]">
                        {repo.ownerLogin}
                      </CardDescription>
                    </div>
                    <span className="inline-flex items-center gap-1 rounded border border-[#27272a] bg-[#09090b] px-1.5 py-0.5 text-[10px] text-[#a1a1aa]">
                      {repo.isPrivate ? (
                        <>
                          <Lock className="h-2.5 w-2.5" />
                          Private
                        </>
                      ) : (
                        <>
                          <Globe className="h-2.5 w-2.5" />
                          Public
                        </>
                      )}
                    </span>
                  </div>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="flex items-center justify-between border-t border-[#27272a]/50 pt-3 text-[11px] text-[#71717a]">
                    <span className="flex items-center gap-1">
                      <GitBranch className="h-3 w-3" />
                      {repo.defaultBranch}
                    </span>
                    <a
                      href={repo.htmlUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-[#a1a1aa] hover:text-[#fafafa]"
                    >
                      GitHub <ExternalLink className="h-3 w-3" />
                    </a>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
