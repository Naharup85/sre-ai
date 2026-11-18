import { createBrowserRouter } from "react-router-dom";
import { DashboardLayout } from "@/layouts/dashboard-layout";
import { DashboardPage } from "@/pages/dashboard";
import { LoginPage } from "@/pages/login";
import { RegisterPage } from "@/pages/register";
import { ProtectedRoute } from "@/components/protected-route";

export const router = createBrowserRouter([
  {
    path: "/login",
    element: <LoginPage />,
  },
  {
    path: "/register",
    element: <RegisterPage />,
  },
  {
    element: <ProtectedRoute />,
    children: [
      {
        element: <DashboardLayout />,
        children: [
          {
            path: "/",
            element: <DashboardPage />,
          },
        ],
      },
    ],
  },
]);
