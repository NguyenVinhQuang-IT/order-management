import { lazy, Suspense } from "react";
import { useAtomValue } from "jotai";
import { Navigate, Route, Routes } from "react-router-dom";
import { homePathForRole, isAuthenticatedAtom, sessionAtom } from "./auth";
import Toast from "./components/Toast";

const Login = lazy(() => import("./pages/Login.jsx"));
const Dashboard = lazy(() => import("./pages/Dashboard.jsx"));
const Stats = lazy(() => import("./pages/Stats.jsx"));
const Employees = lazy(() => import("./pages/Employees.jsx"));
const EmployeeDetail = lazy(() => import("./pages/EmployeeDetail.jsx"));

function PageFallback() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-parchment">
      <p className="m-0 text-[17px] font-normal leading-[1.47] tracking-[-0.374px] text-ink-muted-48">
        Đang tải.
      </p>
    </div>
  );
}

function PrivateRoute({ children }) {
  const authenticated = useAtomValue(isAuthenticatedAtom);
  return authenticated ? children : <Navigate to="/login" replace />;
}

function GuestRoute({ children }) {
  const session = useAtomValue(sessionAtom);
  if (!session) return children;
  return <Navigate to={homePathForRole(session.role)} replace />;
}

function ManagerRoute({ children }) {
  const session = useAtomValue(sessionAtom);
  if (!session) return <Navigate to="/login" replace />;
  if (session.role !== "manager") return <Navigate to="/" replace />;
  return children;
}

function HomeRedirect() {
  const session = useAtomValue(sessionAtom);
  if (!session) return <Navigate to="/login" replace />;
  return <Navigate to={homePathForRole(session.role)} replace />;
}

export default function App() {
  return (
    <>
      <Suspense fallback={<PageFallback />}>
        <Routes>
          <Route
            path="/login"
            element={
              <GuestRoute>
                <Login />
              </GuestRoute>
            }
          />
          <Route
            path="/"
            element={
              <PrivateRoute>
                <Dashboard />
              </PrivateRoute>
            }
          />
          <Route
            path="/thong-ke"
            element={
              <ManagerRoute>
                <Stats />
              </ManagerRoute>
            }
          />
          <Route
            path="/nhan-vien"
            element={
              <ManagerRoute>
                <Employees />
              </ManagerRoute>
            }
          />
          <Route
            path="/nhan-vien/:employeeId"
            element={
              <ManagerRoute>
                <EmployeeDetail />
              </ManagerRoute>
            }
          />
          <Route path="*" element={<HomeRedirect />} />
        </Routes>
      </Suspense>
      <Toast />
    </>
  );
}
