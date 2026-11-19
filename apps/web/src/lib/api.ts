let inMemoryToken: string | null = null;

export function setAuthToken(token: string | null) {
  inMemoryToken = token;
}

export function getAuthToken(): string | null {
  return inMemoryToken;
}

export class ApiError extends Error {
  status: number;
  errors?: Record<string, string[]>;

  constructor(message: string, status: number, errors?: Record<string, string[]>) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.errors = errors;
  }
}

export interface User {
  id: string;
  name: string;
  email: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface AuthResponseData {
  user: User;
  accessToken: string;
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  message?: string;
  errors?: Record<string, string[]>;
}

export interface GitHubInstallation {
  id: string;
  installationId: string;
  accountLogin: string;
  accountType: string;
  createdAt: string;
}

export interface AccessibleRepository {
  id: number;
  name: string;
  fullName: string;
  ownerLogin: string;
  defaultBranch: string;
  isPrivate: boolean;
  htmlUrl: string;
  isSelected: boolean;
}

export interface SavedRepository {
  id: string;
  githubRepoId: number;
  name: string;
  fullName: string;
  ownerLogin: string;
  defaultBranch: string;
  isPrivate: boolean;
  htmlUrl: string;
  createdAt: string;
}

export interface PaginationInfo {
  page: number;
  perPage: number;
  total: number;
  totalPages: number;
}

export interface AccessibleRepositoriesResponse {
  repositories: AccessibleRepository[];
  pagination?: PaginationInfo;
}

const API_BASE_URL = import.meta.env.VITE_API_URL || "";

export async function apiRequest<T>(
  endpoint: string,
  options: RequestInit = {},
): Promise<T> {
  const headers = new Headers(options.headers || {});

  if (!headers.has("Content-Type") && options.body) {
    headers.set("Content-Type", "application/json");
  }

  const token = getAuthToken();
  if (token && !headers.has("Authorization")) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  const url = `${API_BASE_URL}${endpoint}`;

  const response = await fetch(url, {
    ...options,
    headers,
  });

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    const errorMessage = data?.message || "An unexpected error occurred";
    throw new ApiError(errorMessage, response.status, data?.errors);
  }

  return data;
}

export const authApi = {
  async register(body: {
    name: string;
    email: string;
    password: string;
  }): Promise<AuthResponseData> {
    const res = await apiRequest<ApiResponse<AuthResponseData>>(
      "/api/v1/auth/register",
      {
        method: "POST",
        body: JSON.stringify(body),
      },
    );
    if (!res.data) throw new Error("Missing auth response data");
    return res.data;
  },

  async login(body: {
    email: string;
    password: string;
  }): Promise<AuthResponseData> {
    const res = await apiRequest<ApiResponse<AuthResponseData>>(
      "/api/v1/auth/login",
      {
        method: "POST",
        body: JSON.stringify(body),
      },
    );
    if (!res.data) throw new Error("Missing auth response data");
    return res.data;
  },

  async getMe(): Promise<User> {
    const res = await apiRequest<ApiResponse<{ user: User }>>(
      "/api/v1/auth/me",
      {
        method: "GET",
      },
    );
    if (!res.data?.user) throw new Error("Missing user data");
    return res.data.user;
  },

  async logout(): Promise<void> {
    await apiRequest<ApiResponse<void>>("/api/v1/auth/logout", {
      method: "POST",
    });
  },
};

export const githubApi = {
  async getInstallUrl(): Promise<{ url: string; state: string }> {
    const res = await apiRequest<ApiResponse<{ url: string; state: string }>>(
      "/api/v1/github/install",
    );
    if (!res.data) throw new Error("Failed to get installation URL");
    return res.data;
  },

  async getInstallation(): Promise<{
    connected: boolean;
    installation: GitHubInstallation | null;
  }> {
    const res = await apiRequest<
      ApiResponse<{
        connected: boolean;
        installation: GitHubInstallation | null;
      }>
    >("/api/v1/github/installation");
    if (!res.data) throw new Error("Failed to get installation status");
    return res.data;
  },

  async disconnect(): Promise<void> {
    await apiRequest<ApiResponse<void>>("/api/v1/github/installation", {
      method: "DELETE",
    });
  },

  async getRepositories(
    search?: string,
    page?: number,
    perPage?: number,
  ): Promise<AccessibleRepositoriesResponse> {
    const params = new URLSearchParams();
    if (search) params.set("search", search);
    if (page) params.set("page", String(page));
    if (perPage) params.set("per_page", String(perPage));
    const query = params.toString() ? `?${params.toString()}` : "";
    const res = await apiRequest<
      ApiResponse<{
        repositories: AccessibleRepository[];
        pagination?: PaginationInfo;
      }>
    >(`/api/v1/github/repositories${query}`);
    return {
      repositories: res.data?.repositories || [],
      pagination: res.data?.pagination,
    };
  },

  async selectRepository(repo: {
    repoId: number;
    name: string;
    fullName: string;
    ownerLogin: string;
    defaultBranch: string;
    isPrivate: boolean;
    htmlUrl: string;
  }): Promise<SavedRepository> {
    const res = await apiRequest<
      ApiResponse<{ repository: SavedRepository }>
    >("/api/v1/github/repositories/select", {
      method: "POST",
      body: JSON.stringify(repo),
    });
    if (!res.data?.repository) throw new Error("Failed to save repository");
    return res.data.repository;
  },

  async getSelectedRepositories(): Promise<SavedRepository[]> {
    const res = await apiRequest<
      ApiResponse<{ repositories: SavedRepository[] }>
    >("/api/v1/github/repositories/selected");
    return res.data?.repositories || [];
  },

  async removeSelectedRepository(id: string): Promise<void> {
    await apiRequest<ApiResponse<void>>(
      `/api/v1/github/repositories/${encodeURIComponent(id)}`,
      {
        method: "DELETE",
      },
    );
  },
};
