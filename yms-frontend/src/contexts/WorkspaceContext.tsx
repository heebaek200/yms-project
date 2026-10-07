import {
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useState,
    type ReactNode
} from 'react';

import { getWorkspaces } from '../api/workspaces/workspaces';
import { useAuth } from './AuthContext';
import type { WorkspaceSummary } from '../types/workspace';
import {
    WORKSPACE_INVALIDATION_EVENT_KEY,
    broadcastWorkspaceInvalidation,
    clearCurrentWorkspaceSelection,
    loadWorkspaceSelectionCandidate,
    parseWorkspaceInvalidationEvent,
    removeInvalidWorkspaceSelection,
    saveWorkspaceSelection
} from '../workspace/workspaceSelectionStorage';
import { WorkspaceContext } from './workspaceContextStore';

type WorkspaceProviderProps = {
    children: ReactNode;
};

/**
 * 인증 사용자에게 참여 Workspace 목록과 탭별 현재 선택 상태를 제공합니다.
 * 서버 목록으로 저장값을 검증하고 다중 탭 권한 무효화 이벤트를 동기화합니다.
 * Route Guard가 초기 조회, 실패와 선택 없음 상태를 구분할 수 있게 상태를 노출합니다.
 */
function WorkspaceProvider({ children }: WorkspaceProviderProps) {
    const { user, isAuthenticated } = useAuth();
    const [workspaces, setWorkspaces] = useState<WorkspaceSummary[]>([]);
    const [currentWorkspaceId, setCurrentWorkspaceId] = useState<number | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const [initializedUserId, setInitializedUserId] =
        useState<number | null>(null);
    const workspacesRef = useRef<WorkspaceSummary[]>([]);
    const latestRequestIdRef = useRef(0);
    const previousUserIdRef = useRef<number | null>(null);

    /**
     * 로그인 사용자의 Workspace 목록을 다시 조회하고 Context 상태를 갱신합니다.
     * 현재 탭 또는 사용자별 마지막 선택값이 목록에 있을 때만 현재 Workspace로 복원합니다.
     * 저장값이 무효하면 다른 탭에 권한 상실을 알리고 자동 대체 선택 없이 null을 유지합니다.
     * 생성과 초대 수락 화면에서도 호출할 수 있도록 최신 목록을 반환합니다.
     */
    const refreshWorkspaces = useCallback(async () => {
        if (!isAuthenticated || !user || user.profileSetupRequired) {
            latestRequestIdRef.current += 1;
            workspacesRef.current = [];
            setWorkspaces([]);
            setCurrentWorkspaceId(null);
            setIsLoading(false);
            setErrorMessage(null);
            setInitializedUserId(null);
            return [];
        }

        const requestId = latestRequestIdRef.current + 1;
        latestRequestIdRef.current = requestId;

        try {
            setIsLoading(true);

            const response = await getWorkspaces();

            if (requestId !== latestRequestIdRef.current) {
                return response.data;
            }

            workspacesRef.current = response.data;
            setWorkspaces(response.data);

            // 탭별 선택값 또는 마지막 선택값을 서버 기준 참여 목록으로 다시 검증합니다.
            const storedWorkspaceId = loadWorkspaceSelectionCandidate(
                user.userId
            );
            const storedWorkspace = response.data.find(
                workspace => workspace.workspaceId === storedWorkspaceId
            );

            if (storedWorkspaceId !== null && !storedWorkspace) {
                broadcastWorkspaceInvalidation(
                    user.userId,
                    storedWorkspaceId
                );
            }

            const nextWorkspaceId = storedWorkspace?.workspaceId ?? null;
            setCurrentWorkspaceId(nextWorkspaceId);

            if (nextWorkspaceId !== null) {
                saveWorkspaceSelection(user.userId, nextWorkspaceId);
            }

            setErrorMessage(null);
            setInitializedUserId(user.userId);
            return response.data;
        } catch (error) {
            if (requestId !== latestRequestIdRef.current) {
                return [];
            }

            console.error(error);
            setErrorMessage('제작팀 목록을 불러오지 못했습니다.');
            setInitializedUserId(user.userId);
            return [];
        } finally {
            if (requestId === latestRequestIdRef.current) {
                setIsLoading(false);
            }
        }
    }, [isAuthenticated, user]);

    /**
     * 인증 사용자가 바뀌면 이전 계정의 현재 탭 선택을 제거하고 새 목록 검증을 시작합니다.
     * 사용자별 마지막 Workspace는 로그아웃 후에도 유지하여 다음 로그인 복원 후보로 사용합니다.
     * 초기화 완료 사용자 ID를 비워 Guard가 이전 계정 상태를 사용하지 않게 합니다.
     */
    useEffect(() => {
        const nextUserId = isAuthenticated && user ? user.userId : null;
        const previousUserId = previousUserIdRef.current;

        if (previousUserId !== null && previousUserId !== nextUserId) {
            clearCurrentWorkspaceSelection(previousUserId);
        }

        if (previousUserId !== nextUserId) {
            workspacesRef.current = [];
            setWorkspaces([]);
            setCurrentWorkspaceId(null);
            setErrorMessage(null);
        }

        previousUserIdRef.current = nextUserId;
        setInitializedUserId(null);
        void refreshWorkspaces();
    }, [isAuthenticated, refreshWorkspaces, user]);

    /**
     * 다른 탭에서 확인한 Workspace 권한 상실을 현재 탭의 목록과 선택에 반영합니다.
     * 같은 계정의 같은 Workspace를 사용 중일 때만 현재 선택을 해제합니다.
     * 다른 Workspace에서 작업 중인 탭의 현재 컨텍스트는 그대로 유지합니다.
     */
    useEffect(() => {
        if (!user) {
            return;
        }

        const handleWorkspaceInvalidation = (event: StorageEvent) => {
            if (event.key !== WORKSPACE_INVALIDATION_EVENT_KEY) {
                return;
            }

            const invalidation = parseWorkspaceInvalidationEvent(
                event.newValue
            );

            if (!invalidation || invalidation.userId !== user.userId) {
                return;
            }

            removeInvalidWorkspaceSelection(
                user.userId,
                invalidation.workspaceId
            );
            workspacesRef.current = workspacesRef.current.filter(
                workspace => workspace.workspaceId !== invalidation.workspaceId
            );
            setWorkspaces(workspaces => workspaces.filter(
                workspace => workspace.workspaceId !== invalidation.workspaceId
            ));
            setCurrentWorkspaceId(currentId => (
                currentId === invalidation.workspaceId ? null : currentId
            ));
        };

        window.addEventListener('storage', handleWorkspaceInvalidation);

        return () => {
            window.removeEventListener('storage', handleWorkspaceInvalidation);
        };
    }, [user]);

    // ID와 목록으로부터 화면에서 사용할 현재 Workspace 객체를 계산합니다.
    const currentWorkspace = useMemo(
        () => workspaces.find(
            workspace => workspace.workspaceId === currentWorkspaceId
        ) ?? null,
        [currentWorkspaceId, workspaces]
    );

    const isInitialized = user !== null
        && initializedUserId === user.userId;

    /**
     * 조회된 참여 목록에 존재하는 Workspace만 현재 탭의 작업 범위로 선택합니다.
     * 성공한 선택은 탭 세션과 사용자별 마지막 선택 저장소에 함께 기록합니다.
     * 다른 탭의 현재 선택에는 일반 Workspace 전환 이벤트를 보내지 않습니다.
     */
    const selectWorkspace = (workspaceId: number) => {
        if (!user || !workspacesRef.current.some(
            workspace => workspace.workspaceId === workspaceId
        )) {
            return;
        }

        setCurrentWorkspaceId(workspaceId);
        saveWorkspaceSelection(user.userId, workspaceId);
    };

    // Header와 Workspace 하위 화면이 동일한 현재 Workspace 상태를 공유합니다.
    return (
        <WorkspaceContext
            value={{
                workspaces,
                currentWorkspace,
                isLoading,
                isInitialized,
                errorMessage,
                selectWorkspace,
                refreshWorkspaces
            }}
        >
            {children}
        </WorkspaceContext>
    );
}

export default WorkspaceProvider;
