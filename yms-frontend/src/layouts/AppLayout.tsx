import { Outlet } from 'react-router';
import AppHeader from '../components/common/AppHeader';
import NotificationProvider from '../contexts/NotificationContext';

import './AppLayout.css';

/**
 * 인증 후 공통 Header와 하위 페이지가 표시되는 기본 레이아웃입니다.
 * NotificationProvider를 이 범위에 배치해 인증 화면끼리 알림 상태를 공유합니다.
 * 로그인·초기 설정 화면에서는 불필요한 알림 조회가 발생하지 않습니다.
 */
function AppLayout() {
    return (
        <NotificationProvider>
            <div className="app-layout">
                <AppHeader />

                <main className="app-main">
                    <Outlet />
                </main>
            </div>
        </NotificationProvider>
    );
}

export default AppLayout;
