import { lazy, Suspense, useEffect, useState } from "react";
import { useAtomValue, useSetAtom } from "jotai";
import { Navigate, Route, Routes } from "react-router-dom";
import { onUnauthorized } from "./api";
import { homePathForRole, isAuthenticatedAtom, sessionAtom } from "./auth";
import Toast from "./components/Toast";
import { loadWorkspaceAtom, resetWorkspaceAtom } from "./workspace";

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

function SessionBootstrap({ children }) {
  const session = useAtomValue(sessionAtom);
  const loadWorkspace = useSetAtom(loadWorkspaceAtom);
  const resetWorkspace = useSetAtom(resetWorkspaceAtom);
  const [ready, setReady] = useState(!session);

  useEffect(() => {
    onUnauthorized(() => resetWorkspace());
    return () => onUnauthorized(null);
  }, [resetWorkspace]);

  useEffect(() => {
    let cancelled = false;
    async function run() {
      if (!session) {
        setReady(true);
        return;
      }
      setReady(false);
      try {
        await loadWorkspace();
      } catch {
        /* 401 already signs out via onUnauthorized */
      } finally {
        if (!cancelled) setReady(true);
      }
    }
    run();
    return () => {
      cancelled = true;
    };
  }, [session, loadWorkspace, resetWorkspace]);

  if (!ready) return <PageFallback />;
  return children;
}

export default function App() {
  return (
    <>
      <Suspense fallback={<PageFallback />}>
        <SessionBootstrap>
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
        </SessionBootstrap>
      </Suspense>
      <Toast />
    </>
  );
}
