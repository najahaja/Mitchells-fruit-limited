import { useLayoutEffect } from "react";
import {
  createBrowserRouter,
  RouterProvider,
  Navigate,
  Outlet
} from "react-router-dom";
import Layout from "./layout";
import Overview from "./pages/user/Overview";
import CallsOrders from "./pages/user/CallOrder";
import SignIn from "./pages/Login";
import Register from "./pages/Register";
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";
import Menu from "./pages/user/Menu";
import Settings from "./pages/user/Settings";
import { Toaster } from "react-hot-toast";
import Report from "./pages/user/Report";
import Agents from "./pages/user/Agents";
import Complaints from "./pages/user/Complaints";
import OutboundDashboard from "./pages/outbound/OutboundDashboard";
import CampaignList from "./pages/outbound/CampaignList";
import CampaignDetail from "./pages/outbound/CampaignDetail";
import OutboundCalls from "./pages/outbound/OutboundCalls";
import OutboundCallDetail from "./pages/outbound/OutboundCallDetail";
function PrivateRoute() {
  const token = localStorage.getItem("token");
  return token ? <Outlet /> : <Navigate to="/signin" replace />;
}
function AuthRoute() {
  const token = localStorage.getItem("token");
  return token ? <Navigate to="/dashboard/menu" replace /> : <Outlet />;
}
const router = createBrowserRouter([
  {
    path: "/",
    element: <Navigate to="/signin" replace />
  },
  {
    element: <AuthRoute />,
    children: [
      {
        path: "/signin",
        element: <SignIn />
      },
      {
        path: "/register",
        element: <Register />
      },
      {
        path: "/forgot-password",
        element: <ForgotPassword />
      },
      {
        path: "/reset-password",
        element: <ResetPassword />
      }
    ]
  },
  {
    element: <PrivateRoute />,
    children: [
      {
        path: "/dashboard",
        element: <Layout />,
        children: [
          { index: true, element: <Overview /> },
          { path: "agents", element: <Agents /> },
          { path: "calls", element: <CallsOrders /> },
          { path: "calling/outbound", element: <OutboundDashboard /> },
          { path: "calling/outbound/campaigns", element: <CampaignList /> },
          { path: "calling/outbound/campaigns/:id", element: <CampaignDetail /> },
          { path: "calling/outbound/calls", element: <OutboundCalls /> },
          { path: "calling/outbound/calls/:id", element: <OutboundCallDetail /> },
          { path: "complaints", element: <Complaints /> },
          { path: "menu", element: <Menu /> },
          { path: "settings", element: <Settings /> },
          { path: "report", element: <Report /> }
        ]
      }
    ]
  },
  {
    path: "*",
    element: <Navigate to="/signin" replace />
  }
]);
function App() {
  useLayoutEffect(() => {
    const loader = document.getElementById("app-loader");
    if (!loader) return;
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        loader.classList.add("vx-hide");
        const cleanup = () => {
          if (loader.parentNode) loader.remove();
        };
        loader.addEventListener("transitionend", cleanup, { once: true });
        setTimeout(cleanup, 300);
      });
    });
  }, []);
  return <>
      {" "}
      <RouterProvider router={router} />
      <Toaster
    position="top-right"
    toastOptions={{
      duration: 3e3,
      style: {
        fontFamily: "'Sora', sans-serif",
        fontSize: "13px",
        borderRadius: "12px",
        padding: "12px 16px",
        boxShadow: "0 4px 20px rgba(0,0,0,0.1)"
      },
      success: {
        iconTheme: { primary: "#22c55e", secondary: "#fff" }
      },
      error: {
        iconTheme: { primary: "#ef4444", secondary: "#fff" }
      }
    }}
  />
    </>;
}
export {
  App as default
};
