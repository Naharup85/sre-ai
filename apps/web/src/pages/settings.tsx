import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import { Github, CheckCircle2, AlertCircle, Loader2, Unlink } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { githubApi } from "@/lib/api";

export function SettingsPage() {
  const [searchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const [actionError, setActionError] = useState<string | null>(null);

  const queryError = searchParams.get("error");
  const isJustConnected = searchParams.get("github") === "connected";
  const connectedAccountParam = searchParams.get("account");

  // Query GitHub installation status
  const { data, isLoading } = useQuery({
    queryKey: ["githubInstallation"],
    queryFn: () => githubApi.getInstallation(),
  });

  // Connect mutation
  const connectMutation = useMutation({
    mutationFn: () => githubApi.getInstallUrl(),
    onSuccess: (data) => {
      window.location.href = data.url;
    },
    onError: (err: unknown) => {
      const msg = err instanceof Error ? err.message : "Failed to initiate GitHub connection";
      setActionError(msg);
    },
  });

  // Disconnect mutation
  const disconnectMutation = useMutation({
    mutationFn: () => githubApi.disconnect(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["githubInstallation"] });
      queryClient.invalidateQueries({ queryKey: ["githubRepositories"] });
      queryClient.invalidateQueries({ queryKey: ["selectedRepositories"] });
      setActionError(null);
    },
    onError: (err: unknown) => {
      const msg = err instanceof Error ? err.message : "Failed to disconnect GitHub";
      setActionError(msg);
    },
  });

  const isConnected = data?.connected && data.installation;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-lg font-semibold text-[#fafafa]">Settings</h1>
        <p className="mt-1 text-sm text-[#a1a1aa]">
          Manage your integrations, GitHub App connection, and platform settings.
        </p>
      </div>

      {/* Notifications */}
      {isJustConnected && (
        <div className="flex items-center gap-2 rounded-md border border-green-500/20 bg-green-500/10 px-4 py-3 text-xs text-green-400">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          <span>
            GitHub App successfully connected
            {connectedAccountParam ? ` to @${connectedAccountParam}` : ""}. You can now select and import repositories.
          </span>
        </div>
      )}

      {(queryError || actionError) && (
        <div className="flex items-center gap-2 rounded-md border border-red-500/20 bg-red-500/10 px-4 py-3 text-xs text-red-400">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{actionError || queryError}</span>
        </div>
      )}

      {/* GitHub Integration Card */}
      <Card className="border-[#27272a] bg-[#111113]">
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-[#27272a] bg-[#09090b]">
                <Github className="h-5 w-5 text-[#fafafa]" />
              </div>
              <div>
                <CardTitle className="text-sm font-medium text-[#fafafa]">
                  GitHub App
                </CardTitle>
                <CardDescription className="text-xs text-[#a1a1aa]">
                  Connect your GitHub account or organization to deploy repositories.
                </CardDescription>
              </div>
            </div>

            {/* Status indicator */}
            {!isLoading && (
              <span
                className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${
                  isConnected
                    ? "bg-green-500/10 text-green-400 border border-green-500/20"
                    : "bg-[#27272a]/50 text-[#a1a1aa] border border-[#27272a]"
                }`}
              >
                <span
                  className={`h-1.5 w-1.5 rounded-full ${
                    isConnected ? "bg-green-400" : "bg-[#71717a]"
                  }`}
                />
                {isConnected ? "Connected" : "Disconnected"}
              </span>
            )}
          </div>
        </CardHeader>

        <CardContent className="border-t border-[#27272a] pt-4">
          {isLoading ? (
            <div className="flex items-center gap-2 text-xs text-[#a1a1aa] py-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>Loading GitHub integration status...</span>
            </div>
          ) : isConnected ? (
            <div className="space-y-4">
              <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between rounded-md border border-[#27272a] bg-[#09090b] px-4 py-3">
                <div className="space-y-0.5">
                  <p className="text-xs font-medium text-[#fafafa]">
                    @{data.installation?.accountLogin}
                  </p>
                  <p className="text-[11px] text-[#71717a]">
                    Type: {data.installation?.accountType} &bull; Installation ID:{" "}
                    {data.installation?.installationId}
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => disconnectMutation.mutate()}
                  disabled={disconnectMutation.isPending}
                  className="mt-2 sm:mt-0 gap-1.5 border-red-500/20 text-red-400 hover:bg-red-500/10 hover:text-red-300"
                >
                  {disconnectMutation.isPending ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Unlink className="h-3.5 w-3.5" />
                  )}
                  Disconnect
                </Button>
              </div>

              <p className="text-xs text-[#71717a]">
                SRE AI accesses only the repositories and metadata you selected when installing the app. No write access is requested.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              <p className="text-xs text-[#a1a1aa]">
                No GitHub account is currently connected. Click the button below to install the official SRE AI GitHub App on your personal account or organization.
              </p>
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
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
