import { Navigate, Route, Routes } from 'react-router';
import { useAuth } from '../contexts/AuthContext';
import type { ReactNode } from 'react';

import LoginPage from '../pages/LoginPage';
import ProfileSetupPage from '../pages/ProfileSetupPage';
import DashboardPage from '../pages/DashboardPage';
import NotFoundPage from '../pages/NotFoundPage';
import AppLayout from '../layouts/AppLayout';

/** 
인증 상태 및 사용자 설정 상태에 따른 라우팅 기준을 아래와 같이 정의합니다.

    / 접근 시

        로그인되어 있지 않음
        → SCR-01: 로그인 및 회원가입 페이지


        로그인되어 있음 + roles.length === 0
        → SCR-02: 프로필 및 채널 수익 설정 페이지


        로그인되어 있음 + roles.length > 0
        → SCR-03: 메인 대시보드 및 스케줄러 페이지
    

    /profile-setup 접근 시

        로그인되어 있지 않음
        → SCR-01: 로그인 및 회원가입 페이지


        로그인되어 있음
        → SCR-02: 프로필 및 채널 수익 설정 페이지


    이외의 존재하는 페이지 접근 시

        로그인되어 있지 않음
        → SCR-01: 로그인 및 회원가입 페이지


        로그인되어 있음 + roles.length === 0
        → SCR-02: 프로필 및 채널 수익 설정 페이지


        로그인되어 있음 + roles.length > 0
        → 사용자가 요청한 해당 페이지
        

    존재하지 않는 경로 접근 시

        인증 상태와 관계없이
        → 404 Not Found 페이지
*/
// 초기 페이지 : 로그인 화면 또는 대시보드 화면
function RootRoute() {
    const { user, isAuthenticated } = useAuth();

    if (!isAuthenticated || !user) {
        return <LoginPage />;
    }

    if (user && user.roles.length === 0) {
        return <Navigate to="/profile-setup" replace />;
    }

    return <Navigate to="/dashboard" replace />;
}

// 로그인만 필요한 페이지 (설정 화면)
function AuthenticatedRoute({
    children
}: {
    children: ReactNode
}) {
    const { user, isAuthenticated } = useAuth();

    if (!isAuthenticated || !user) {
        return <Navigate to="/" replace />;
    }

    return children;
}

// 로그인 + 초기 설정 완료가 필요한 페이지 (일반 화면)
function ProtectedRoute({
    children
}: {
    children: ReactNode
}) {
    const { user, isAuthenticated } = useAuth();

    if (!isAuthenticated || !user) {
        return <Navigate to="/" replace />;
    }

    if (user && user.roles.length === 0) {
        return <Navigate to="/profile-setup" replace />;
    }

    return children;
}


function AppRoutes() {
    return (
        <Routes>
            {/* SCR-01 인증 및 회원관리 화면 */}
            <Route
                path="/"
                element={<RootRoute />}
            />

            {/* 404 화면 */}
            <Route
                path="*"
                element={<NotFoundPage />}
            />

            {/* SCR-02 프로필 및 채널 수익 설정 */}
            <Route
                path="/profile-setup"
                element={
                    <AuthenticatedRoute>
                        <ProfileSetupPage />
                    </AuthenticatedRoute>
                }
            />

            {/* 공통 레이아웃 */}
            <Route
                element={
                    <ProtectedRoute>
                        <AppLayout />
                    </ProtectedRoute>
                }
            >

                {/* SCR-03 메인 대시보드 및 스케줄러 */}
                <Route
                    path="/dashboard"
                    element={<DashboardPage />}
                />

                {/* 향후 공통 레이아웃을 사용하는 화면 라우터 설정 */}



            </Route>
        </Routes>
    );
}

export default AppRoutes;