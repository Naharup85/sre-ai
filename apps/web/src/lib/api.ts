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
