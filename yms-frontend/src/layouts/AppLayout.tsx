import { Outlet } from 'react-router';
import AppHeader from '../components/common/AppHeader';

import './AppLayout.css';

function AppLayout() {
    return (
        <div className="app-layout">
            <AppHeader />

            <main className="app-main">
                <Outlet />
            </main>
        </div>
    );
}

export default AppLayout;