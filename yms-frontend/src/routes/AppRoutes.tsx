import { Navigate, Route, Routes } from 'react-router';
import { useAuth } from '../contexts/AuthContext';
import { useWorkspace } from '../hooks/useWorkspace';
import type { ReactNode } from 'react';

import LoginPage from '../pages/LoginPage';
import ProfileSetupPage from '../pages/ProfileSetupPage';
import WorkspaceOnboardingPage from '../pages/WorkspaceOnboardingPage';
import DashboardPage from '../pages/DashboardPage';
import NotFoundPage from '../pages/NotFoundPage';
import AppLayout from '../layouts/AppLayout';
import WorkspaceRouteStatus from '../components/routing/WorkspaceRouteStatus';

/**
 * 루트 접근을 인증, 프로필 설정, Workspace 복원 순서로 판정합니다.
 * 보호 URL에서 시작했더라도 별도 returnUrl 없이 이 표준 진입점으로 돌아옵니다.
 * Workspace 검증 실패는 잘못된 온보딩 이동 대신 전용 재시도 상태로 표시합니다.
 */
function RootRoute() {
    const { user, isAuthenticated } = useAuth();
    const {
        currentWorkspace,
        isLoading,
        isInitialized,
        errorMessage,
        refreshWorkspaces
    } = useWorkspace();

    if (!isAuthenticated || !user) {
        return <LoginPage />;
    }

    if (user.profileSetupRequired) {
        return <Navigate to="/profile-setup" replace />;
    }

    if (errorMessage) {
        return (
            <WorkspaceRouteStatus
                errorMessage={errorMessage}
                isRetrying={isLoading}
                onRetry={() => void refreshWorkspaces()}
            />
        );
    }

    if (!isInitialized || isLoading) {
        return <WorkspaceRouteStatus />;
    }

    return currentWorkspace
        ? <Navigate to="/dashboard" replace />
        : <Navigate to="/workspaces" replace />;
}

/**
 * 로그인 상태만 필요한 프로필 화면의 접근을 보호합니다.
 * 프로필 설정 완료 사용자도 같은 화면에서 기존 정보를 수정할 수 있도록 허용합니다.
 * 비인증 사용자는 표준 로그인 진입점으로 이동합니다.
 */
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

/**
 * SCR-03 접근 전에 인증과 프로필 설정 완료 여부를 순서대로 검증합니다.
 * 현재 Workspace 유무는 선택·생성 화면의 접근을 막지 않습니다.
 * 비인증 또는 미설정 사용자는 각 표준 온보딩 단계로 이동합니다.
 */
function ProfileCompletedRoute({
    children
}: {
    children: ReactNode
}) {
    const { user, isAuthenticated } = useAuth();

    if (!isAuthenticated || !user) {
        return <Navigate to="/" replace />;
    }

    if (user.profileSetupRequired) {
        return <Navigate to="/profile-setup" replace />;
    }

    return children;
}

/**
 * Dashboard와 이후 업무 화면에 인증, 프로필, Workspace 조건을 공통 적용합니다.
 * Workspace 조회 중에는 진행 상태를, 실패 시에는 이동 없는 재시도 상태를 제공합니다.
 * 검증된 현재 Workspace가 없을 때만 SCR-03 선택 화면으로 이동합니다.
 */
function WorkspaceRequiredRoute({
    children
}: {
    children: ReactNode
}) {
    const { user, isAuthenticated } = useAuth();
    const {
        currentWorkspace,
        isLoading,
        isInitialized,
        errorMessage,
        refreshWorkspaces
    } = useWorkspace();

    if (!isAuthenticated || !user) {
        return <Navigate to="/" replace />;
    }

    if (user.profileSetupRequired) {
        return <Navigate to="/profile-setup" replace />;
    }

    if (errorMessage) {
        return (
            <WorkspaceRouteStatus
                errorMessage={errorMessage}
                isRetrying={isLoading}
                onRetry={() => void refreshWorkspaces()}
            />
        );
    }

    if (!isInitialized || isLoading) {
        return <WorkspaceRouteStatus />;
    }

    if (!currentWorkspace) {
        return <Navigate to="/workspaces" replace />;
    }

    return children;
}


/**
 * 존재하는 화면별로 필요한 인증·프로필·Workspace Guard를 조합합니다.
 * 와일드카드 Route는 Guard 밖에 두어 알 수 없는 URL을 즉시 404로 처리합니다.
 * Workspace 하위 화면은 공통 레이아웃보다 먼저 통합 Guard를 통과합니다.
 */
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

            {/* SCR-02 프로필 설정 */}
            <Route
                path="/profile-setup"
                element={
                    <AuthenticatedRoute>
                        <ProfileSetupPage />
                    </AuthenticatedRoute>
                }
            />

            {/* SCR-03 Workspace 선택 / 생성 / 초대 확인 */}
            <Route
                path="/workspaces"
                element={
                    <ProfileCompletedRoute>
                        <WorkspaceOnboardingPage />
                    </ProfileCompletedRoute>
                }
            />

            {/* 공통 레이아웃 */}
            <Route
                element={
                    <WorkspaceRequiredRoute>
                        <AppLayout />
                    </WorkspaceRequiredRoute>
                }
            >

                {/* SCR-05 메인 대시보드 및 스케줄러 */}
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
