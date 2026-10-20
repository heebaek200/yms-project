import {
    createBrowserRouter,
    createRoutesFromElements,
    Navigate,
    Route,
    RouterProvider
} from 'react-router';
import { useAuth } from '../contexts/AuthContext';
import { useWorkspace } from '../hooks/useWorkspace';
import type { ReactNode } from 'react';

import LoginPage from '../pages/LoginPage';
import ProfileSetupPage from '../pages/ProfileSetupPage';
import WorkspaceOnboardingPage from '../pages/WorkspaceOnboardingPage';
import DashboardPage from '../pages/DashboardPage';
import NotFoundPage from '../pages/NotFoundPage';
import ComingSoonPage from '../pages/ComingSoonPage';
import WorkspaceSettingsPage from '../pages/WorkspaceSettingsPage';
import ProjectsPage from '../pages/ProjectsPage';
import ProjectGroupPage from '../pages/ProjectGroupPage';
import AppLayout from '../layouts/AppLayout';
import WorkspaceRouteStatus from '../components/routing/WorkspaceRouteStatus';
import WorkspaceRoleRoute from '../components/routing/WorkspaceRoleRoute';
import { WORKSPACE_ADMIN_ROLES } from './navigation';

const MEMBER_ONLY_ROLES = ['MEMBER'] as const;

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


// 미저장 폼의 브라우저 뒤로·앞으로 이동까지 차단할 수 있도록 Data Router를 사용합니다.
const router = createBrowserRouter(
    createRoutesFromElements(
        <>
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

                {/* SCR-06 프로젝트 그룹 목록·상세 Route */}
                <Route
                    path="/project-groups"
                    element={
                        <WorkspaceRoleRoute allowedRoles={WORKSPACE_ADMIN_ROLES}>
                            <ProjectGroupPage />
                        </WorkspaceRoleRoute>
                    }
                />

                <Route
                    path="/project-groups/:projectGroupId"
                    element={
                        <WorkspaceRoleRoute allowedRoles={WORKSPACE_ADMIN_ROLES}>
                            <ProjectGroupPage />
                        </WorkspaceRoleRoute>
                    }
                />

                {/* SCR-07 프로젝트 목록 예정 Route */}
                <Route
                    path="/projects"
                    element={<ProjectsPage />}
                />

                <Route
                    path="/projects/:projectId"
                    element={<ProjectsPage />}
                />

                {/* SCR-09 메신저 예정 Route */}
                <Route
                    path="/messenger"
                    element={<ComingSoonPage featureName="메신저" />}
                />

                {/* SCR-11A 제작팀 정산 관리 예정 Route */}
                <Route
                    path="/workspace/settlements"
                    element={
                        <WorkspaceRoleRoute allowedRoles={WORKSPACE_ADMIN_ROLES}>
                            <ComingSoonPage featureName="정산 관리" />
                        </WorkspaceRoleRoute>
                    }
                />

                {/* SCR-11B 개인 정산 예정 Route */}
                <Route
                    path="/my/settlements"
                    element={
                        <WorkspaceRoleRoute allowedRoles={MEMBER_ONLY_ROLES}>
                            <ComingSoonPage featureName="내 정산" />
                        </WorkspaceRoleRoute>
                    }
                />

                {/* SCR-12 콘텐츠 및 재무 분석 예정 Route */}
                <Route
                    path="/analytics"
                    element={
                        <WorkspaceRoleRoute allowedRoles={WORKSPACE_ADMIN_ROLES}>
                            <ComingSoonPage featureName="분석" />
                        </WorkspaceRoleRoute>
                    }
                />

                {/* SCR-10 비용·수익 관리 예정 Route */}
                <Route
                    path="/finance"
                    element={
                        <WorkspaceRoleRoute allowedRoles={WORKSPACE_ADMIN_ROLES}>
                            <ComingSoonPage featureName="비용·수익" />
                        </WorkspaceRoleRoute>
                    }
                />

                {/* SCR-04 현재 제작팀 관리 Route */}
                <Route
                    path="/workspace/settings"
                    element={
                        <WorkspaceRoleRoute allowedRoles={WORKSPACE_ADMIN_ROLES}>
                            <WorkspaceSettingsPage />
                        </WorkspaceRoleRoute>
                    }
                />
            </Route>
        </>
    )
);

/**
 * 존재하는 화면별로 필요한 인증·프로필·Workspace Guard를 조합합니다.
 * 와일드카드 Route는 Guard 밖에 두어 알 수 없는 URL을 즉시 404로 처리합니다.
 * Workspace 하위 화면은 공통 레이아웃보다 먼저 통합 Guard를 통과합니다.
 */
function AppRoutes() {
    return <RouterProvider router={router} />;
}

export default AppRoutes;
