import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { SuperAdminRoute } from "./components/SuperAdminRoute";
import { LoginPage } from "./pages/LoginPage";
import { EventsListPage } from "./pages/EventsListPage";
import { EventDetailPage } from "./pages/EventDetailPage";
import { UserManagementPage } from "./pages/UserManagementPage";

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route
            path="/events"
            element={
              <ProtectedRoute>
                <EventsListPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/events/:slug"
            element={
              <ProtectedRoute>
                <EventDetailPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/users"
            element={
              <SuperAdminRoute>
                <UserManagementPage />
              </SuperAdminRoute>
            }
          />
          <Route path="*" element={<Navigate to="/events" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
