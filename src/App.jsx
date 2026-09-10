import { Navigate, Route, Routes } from "react-router-dom";
import { isAuthenticated } from "./auth";
import { ToastProvider } from "./components/Toast";
import Dashboard from "./pages/Dashboard";
import Login from "./pages/Login";

function PrivateRoute({ children }) {
  return isAuthenticated() ? children : <Navigate to="/login" replace />;
}

function GuestRoute({ children }) {
  return isAuthenticated() ? <Navigate to="/" replace /> : children;
}

export default function App() {
  return (
    <ToastProvider>
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
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </ToastProvider>
  );
}
