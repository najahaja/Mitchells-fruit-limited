import { Outlet } from "react-router-dom";
import Sidebar from "./components/sidebar";

export default function Layout() {
  return (
    <div style={{ display: "flex", minHeight: "100vh", background: "#F8F8FC", fontFamily: "'Sora', sans-serif" }}>
      <Sidebar />
      <main className="flex-1 overflow-hidden">
        <Outlet />
      </main>
    </div>
  );
}
