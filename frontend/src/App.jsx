import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import { ConfirmProvider } from "./components/ui/ConfirmProvider";
import { NotifyProvider } from "./components/ui/NotifyProvider";
import ProtectedRoute from "./components/ProtectedRoute";
import Layout from "./components/Layout";

import Landing from "./pages/Landing";
import Login from "./pages/Login";
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";
import ChangePassword from "./pages/ChangePassword";
import Reports from "./pages/Reports";

import SuperuserDashboard from "./pages/superuser/SuperuserDashboard";
import SuperuserProfile from "./pages/superuser/SuperuserProfile";

import ManagerDashboard from "./pages/manager/ManagerDashboard";
import AcademicYears from "./pages/manager/AcademicYears";
import Classes from "./pages/manager/Classes";
import Modules from "./pages/manager/Modules";
import Teachers from "./pages/manager/Teachers";
import Students from "./pages/manager/Students";
import Assignments from "./pages/manager/Assignments";
import Statistics from "./pages/manager/Statistics";
import ManagerProfile from "./pages/manager/ManagerProfile";

import MarksEntry from "./pages/teacher/MarksEntry";
import MarksStatus from "./pages/teacher/MarksStatus";
import TeacherDashboard from "./pages/teacher/TeacherDashboard";
import TeacherProfile from "./pages/teacher/TeacherProfile";

export default function App() {
  return (
    <AuthProvider>
      <ConfirmProvider>
      <NotifyProvider>
      <BrowserRouter>
        <Layout>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route path="/change-password" element={<ChangePassword />} />
            <Route path="/" element={<Landing />} />

            <Route
              path="/superuser"
              element={
                <ProtectedRoute roles={["superuser"]}>
                  <SuperuserDashboard />
                </ProtectedRoute>
              }
            />
            <Route
              path="/superuser/profile"
              element={
                <ProtectedRoute roles={["superuser"]}>
                  <SuperuserProfile />
                </ProtectedRoute>
              }
            />

            <Route
              path="/manager"
              element={
                <ProtectedRoute roles={["manager"]}>
                  <ManagerDashboard />
                </ProtectedRoute>
              }
            />
            <Route
              path="/manager/academic-years"
              element={
                <ProtectedRoute roles={["manager"]}>
                  <AcademicYears />
                </ProtectedRoute>
              }
            />
            <Route
              path="/manager/classes"
              element={
                <ProtectedRoute roles={["manager"]}>
                  <Classes />
                </ProtectedRoute>
              }
            />
            <Route
              path="/manager/modules"
              element={
                <ProtectedRoute roles={["manager"]}>
                  <Modules />
                </ProtectedRoute>
              }
            />
            <Route
              path="/manager/teachers"
              element={
                <ProtectedRoute roles={["manager"]}>
                  <Teachers />
                </ProtectedRoute>
              }
            />
            <Route
              path="/manager/students"
              element={
                <ProtectedRoute roles={["manager"]}>
                  <Students />
                </ProtectedRoute>
              }
            />
            <Route
              path="/manager/assignments"
              element={
                <ProtectedRoute roles={["manager"]}>
                  <Assignments />
                </ProtectedRoute>
              }
            />
            <Route
              path="/manager/reports"
              element={
                <ProtectedRoute roles={["manager"]}>
                  <Reports />
                </ProtectedRoute>
              }
            />
            <Route
              path="/manager/statistics"
              element={
                <ProtectedRoute roles={["manager"]}>
                  <Statistics />
                </ProtectedRoute>
              }
            />
            <Route
              path="/manager/profile"
              element={
                <ProtectedRoute roles={["manager"]}>
                  <ManagerProfile />
                </ProtectedRoute>
              }
            />

            <Route
              path="/teacher"
              element={
                <ProtectedRoute roles={["teacher"]}>
                  <TeacherDashboard />
                </ProtectedRoute>
              }
            />
            <Route
              path="/teacher/marks"
              element={
                <ProtectedRoute roles={["teacher"]}>
                  <MarksEntry />
                </ProtectedRoute>
              }
            />
            <Route
              path="/teacher/marks-status"
              element={
                <ProtectedRoute roles={["teacher"]}>
                  <MarksStatus />
                </ProtectedRoute>
              }
            />
            <Route
              path="/teacher/reports"
              element={
                <ProtectedRoute roles={["teacher"]}>
                  <Reports />
                </ProtectedRoute>
              }
            />
            <Route
              path="/teacher/profile"
              element={
                <ProtectedRoute roles={["teacher"]}>
                  <TeacherProfile />
                </ProtectedRoute>
              }
            />

            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Layout>
      </BrowserRouter>
      </NotifyProvider>
      </ConfirmProvider>
    </AuthProvider>
  );
}
