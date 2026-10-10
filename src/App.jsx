import { Navigate, Route, Routes } from 'react-router-dom';
import AuthenticatedLayout from './components/AuthenticatedLayout.jsx';
import RequireAuth from './components/RequireAuth.jsx';
import HomePage from './features/home/HomePage.jsx';
import BorrowPage from './features/borrow/BorrowPage.jsx';
import BorrowBookDetailPage from './features/borrow/BorrowBookDetailPage.jsx';
import AIAssistantPage from './features/ai-assistant/AIAssistantPage.jsx';
import RepositoryPage from './features/repository/RepositoryPage.jsx';
import TAUploadPage from './features/ta-upload/TAUploadPage.jsx';
import StaffDashboardPage from './features/staff/StaffDashboardPage.jsx';
import StaffCatalogPage from './features/staff/StaffCatalogPage.jsx';
import MyLoansPage from './features/loans/MyLoansPage.jsx';
import VisitTracker from './features/home/tracking/VisitTracker.jsx';
import LoginPage from './pages/LoginPage.jsx';
import RegisterPage from './pages/RegisterPage.jsx';
import RequireStaff from './components/RequireStaff.jsx';
import RequireMember from './components/RequireMember.jsx';

export default function App() {
  return (
    <>
      <VisitTracker />
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route element={<RequireAuth />}>
          <Route element={<AuthenticatedLayout />}>
            <Route index element={<HomePage />} />
            <Route path="/admin" element={<RequireStaff><StaffDashboardPage /></RequireStaff>} />
            <Route path="/admin/catalog" element={<RequireStaff><StaffCatalogPage /></RequireStaff>} />
            <Route path="repository" element={<RepositoryPage />} />
            <Route path="borrow" element={<RequireMember><BorrowPage /></RequireMember>} />
            <Route path="borrow/:bookId" element={<RequireMember><BorrowBookDetailPage /></RequireMember>} />
            <Route path="my-loans" element={<RequireMember><MyLoansPage /></RequireMember>} />
            <Route path="ta-upload" element={<RequireMember><TAUploadPage /></RequireMember>} />
            <Route path="ai-assistant" element={<AIAssistantPage />} />
          </Route>
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  );
}
