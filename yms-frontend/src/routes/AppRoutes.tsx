import { Route, Routes } from 'react-router';
import LoginPage from '../pages/LoginPage';

function AppRoutes() {
    return (
        <Routes>
            <Route
                path="/"
                element={<LoginPage />}
            />
        </Routes>
    );
}

export default AppRoutes;