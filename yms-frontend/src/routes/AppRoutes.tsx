import { Route, Routes } from 'react-router';
import LoginPage from '../pages/LoginPage';
import DashboardPage from '../pages/DashboardPage';

function AppRoutes() {
    return (
        <Routes>
            <Route
                path="/"
                element={<LoginPage />}
            />

            <Route
                path="/dashboard"
                element={<DashboardPage />}
            />
        </Routes>
    );
}

export default AppRoutes;