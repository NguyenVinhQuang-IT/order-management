import { useAtomValue } from "jotai";
import { Navigate, Route, Routes } from "react-router-dom";
import { homePathForRole, isAuthenticatedAtom, sessionAtom } from "./auth";
import Toast from "./components/Toast";
import Dashboard from "./pages/Dashboard";
import Login from "./pages/Login";
import Stats from "./pages/Stats";

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
        <Route path="*" element={<HomeRedirect />} />
      </Routes>
      <Toast />
    </>
  );
}
