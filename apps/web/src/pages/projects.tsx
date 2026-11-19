import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Github,
  Search,
  ExternalLink,
  GitBranch,
  Lock,
  Globe,
  Check,
  Loader2,
  FolderGit2,
  Trash2,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  githubApi,
  type AccessibleRepository,
  type SavedRepository,
} from "@/lib/api";

export function ProjectsPage() {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const perPage = 10;
  const queryClient = useQueryClient();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Check GitHub installation status
  const { data: installStatus, isLoading: isCheckingInstall } = useQuery({
    queryKey: ["githubInstallation"],
    queryFn: () => githubApi.getInstallation(),
  });

  const isConnected = installStatus?.connected;

  // Query accessible repositories with pagination & search
  const { data: repoData, isLoading: isLoadingRepos } = useQuery({
    queryKey: ["githubRepositories", search, page],
    queryFn: () => githubApi.getRepositories(search, page, perPage),
    enabled: !!isConnected,
  });

  const repositories = repoData?.repositories || [];
  const pagination = repoData?.pagination;

  // Query selected repositories from DB
  const { data: selectedRepos = [], isLoading: isLoadingSelected } = useQuery({
    queryKey: ["selectedRepositories"],
    queryFn: () => githubApi.getSelectedRepositories(),
  });

  // Select repository mutation
  const selectMutation = useMutation({
    mutationFn: (repo: AccessibleRepository) =>
      githubApi.selectRepository({
        repoId: repo.id,
        name: repo.name,
        fullName: repo.fullName,
        ownerLogin: repo.ownerLogin,
        defaultBranch: repo.defaultBranch,
        isPrivate: repo.isPrivate,
        htmlUrl: repo.htmlUrl,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["githubRepositories"] });
      queryClient.invalidateQueries({ queryKey: ["selectedRepositories"] });
      setErrorMessage(null);
    },
    onError: (err: unknown) => {
      const msg =
        err instanceof Error ? err.message : "Failed to select repository";
      setErrorMessage(msg);
    },
  });

  // Remove selected repository mutation
  const removeMutation = useMutation({
    mutationFn: (id: string) => githubApi.removeSelectedRepository(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["githubRepositories"] });
      queryClient.invalidateQueries({ queryKey: ["selectedRepositories"] });
      setErrorMessage(null);
    },
    onError: (err: unknown) => {
      const msg =
        err instanceof Error ? err.message : "Failed to remove repository";
      setErrorMessage(msg);
    },
  });

  // Connect mutation
  const connectMutation = useMutation({
    mutationFn: () => githubApi.getInstallUrl(),
    onSuccess: (data) => {
      window.location.href = data.url;
    },
    onError: (err: unknown) => {
      const msg =
        err instanceof Error
          ? err.message
          : "Failed to initiate GitHub connection";
      setErrorMessage(msg);
    },
  });

  if (isCheckingInstall) {
    return (
      <div className="flex h-64 items-center justify-center text-xs text-[#a1a1aa]">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        Loading GitHub integration...
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-lg font-semibold text-[#fafafa]">Projects</h1>
        <p className="mt-1 text-sm text-[#a1a1aa]">
          Import repositories from your connected GitHub account to configure deployments.
        </p>
      </div>

      {errorMessage && (
        <div className="rounded-md border border-red-500/20 bg-red-500/10 px-4 py-3 text-xs text-red-400">
          {errorMessage}
        </div>
      )}

      {/* When GitHub is not connected */}
      {!isConnected ? (
        <Card className="border-[#27272a] bg-[#111113]">
          <CardHeader className="text-center sm:text-left">
            <CardTitle className="text-base font-medium text-[#fafafa]">
              Connect GitHub to Import Repositories
            </CardTitle>
            <CardDescription className="text-xs text-[#a1a1aa]">
              To import and select repositories, first connect the SRE AI GitHub App to your account or organization.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              size="sm"
              onClick={() => connectMutation.mutate()}
              disabled={connectMutation.isPending}
              className="gap-2 bg-[#fafafa] text-[#09090b] hover:bg-[#fafafa]/90"
            >
              {connectMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Github className="h-4 w-4" />
              )}
              Connect GitHub
            </Button>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Repository Selection Section */}
          <Card className="border-[#27272a] bg-[#111113]">
            <CardHeader className="pb-3">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <CardTitle className="text-sm font-medium text-[#fafafa]">
                    Available Repositories
                  </CardTitle>
                  <CardDescription className="text-xs text-[#a1a1aa]">
                    Repositories accessible via @{installStatus.installation?.accountLogin}
                  </CardDescription>
                </div>
                {/* Search */}
                <div className="relative w-full sm:w-64">
                  <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-[#71717a]" />
                  <Input
                    type="text"
                    placeholder="Search repositories..."
                    value={search}
                    onChange={(e) => {
                      setSearch(e.target.value);
                      setPage(1);
                    }}
                    className="h-8 pl-8 text-xs"
                  />
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {isLoadingRepos ? (
                <div className="flex h-32 items-center justify-center text-xs text-[#a1a1aa]">
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Loading repositories from GitHub...
                </div>
              ) : repositories.length === 0 ? (
                <div className="py-8 text-center text-xs text-[#a1a1aa]">
                  No repositories found matching your search.
                </div>
              ) : (
                <>
                  <div className="divide-y divide-[#27272a]">
                    {repositories.map((repo) => (
                      <div
                        key={repo.id}
                        className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between first:pt-0 last:pb-0"
                      >
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-medium text-[#fafafa]">
                              {repo.fullName}
                            </span>
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
                          <div className="flex items-center gap-3 text-[11px] text-[#71717a]">
                            <span className="flex items-center gap-1">
                              <GitBranch className="h-3 w-3" />
                              {repo.defaultBranch}
                            </span>
                            <a
                              href={repo.htmlUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 hover:text-[#fafafa]"
                            >
                              GitHub <ExternalLink className="h-2.5 w-2.5" />
                            </a>
                          </div>
                        </div>

                        <Button
                          size="sm"
                          variant={repo.isSelected ? "outline" : "default"}
                          disabled={repo.isSelected || selectMutation.isPending}
                          onClick={() => selectMutation.mutate(repo)}
                          className={`h-7 px-3 text-xs ${
                            repo.isSelected
                              ? "border-[#27272a] bg-transparent text-[#71717a] cursor-default"
                              : "bg-[#fafafa] text-[#09090b] hover:bg-[#fafafa]/90"
                          }`}
                        >
                          {repo.isSelected ? (
                            <>
                              <Check className="mr-1 h-3 w-3 text-green-400" />
                              Imported
                            </>
                          ) : selectMutation.isPending &&
                            selectMutation.variables?.id === repo.id ? (
                            <>
                              <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                              Importing...
                            </>
                          ) : (
                            "Import"
                          )}
                        </Button>
                      </div>
                    ))}
                  </div>

                  {/* Pagination Controls */}
                  {pagination && pagination.totalPages > 1 && (
                    <div className="mt-4 flex items-center justify-between border-t border-[#27272a] pt-3 text-xs text-[#a1a1aa]">
                      <span>
                        Showing {repositories.length} of {pagination.total} repositories (Page {pagination.page} of {pagination.totalPages})
                      </span>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 px-2 text-xs border-[#27272a]"
                          disabled={pagination.page <= 1}
                          onClick={() => setPage((p) => Math.max(1, p - 1))}
                        >
                          <ChevronLeft className="h-3.5 w-3.5 mr-1" /> Prev
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 px-2 text-xs border-[#27272a]"
                          disabled={pagination.page >= pagination.totalPages}
                          onClick={() => setPage((p) => p + 1)}
                        >
                          Next <ChevronRight className="h-3.5 w-3.5 ml-1" />
                        </Button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>

          {/* Selected Repositories List */}
          <div>
            <h2 className="mb-4 text-sm font-medium text-[#fafafa]">
              Imported Projects ({selectedRepos.length})
            </h2>

            {isLoadingSelected ? (
              <div className="flex h-20 items-center justify-center text-xs text-[#a1a1aa]">
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Loading imported projects...
              </div>
            ) : selectedRepos.length === 0 ? (
              <Card className="border-[#27272a] bg-[#111113]">
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <div className="rounded-full border border-[#27272a] bg-[#09090b] p-3">
                    <FolderGit2 className="h-5 w-5 text-[#71717a]" />
                  </div>
                  <p className="mt-3 text-xs text-[#a1a1aa]">
                    No repositories imported yet
                  </p>
                  <p className="mt-1 text-[11px] text-[#71717a]">
                    Click &ldquo;Import&rdquo; on an available repository above.
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                {selectedRepos.map((repo: SavedRepository) => (
                  <Card
                    key={repo.id}
                    className="border-[#27272a] bg-[#111113] transition-colors hover:border-[#fafafa]/20"
                  >
                    <CardHeader className="pb-2">
                      <div className="flex items-start justify-between">
                        <div>
                          <CardTitle className="text-xs font-semibold text-[#fafafa]">
                            {repo.name}
                          </CardTitle>
                          <CardDescription className="text-[11px] text-[#71717a]">
                            {repo.ownerLogin}
                          </CardDescription>
                        </div>
                        <div className="flex items-center gap-2">
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
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 w-6 p-0 text-[#71717a] hover:text-red-400 hover:bg-red-500/10"
                            title="Remove repository"
                            disabled={removeMutation.isPending}
                            onClick={() => removeMutation.mutate(repo.id)}
                          >
                            {removeMutation.isPending &&
                            removeMutation.variables === repo.id ? (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            ) : (
                              <Trash2 className="h-3 w-3" />
                            )}
                          </Button>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="pt-0">
                      <div className="flex items-center justify-between text-[11px] text-[#71717a]">
                        <span className="flex items-center gap-1">
                          <GitBranch className="h-3 w-3" />
                          {repo.defaultBranch}
                        </span>
                        <a
                          href={repo.htmlUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 hover:text-[#fafafa]"
                        >
                          View on GitHub <ExternalLink className="h-2.5 w-2.5" />
                        </a>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
