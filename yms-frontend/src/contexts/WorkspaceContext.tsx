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
import { WorkspaceContext } from './workspaceContextStore';

type WorkspaceProviderProps = {
    children: ReactNode;
};

// 사용자별로 마지막 선택 Workspace를 별도 보관합니다.
function getStorageKey(userId: number) {
    return `yms-current-workspace:${userId}`;
}

function WorkspaceProvider({ children }: WorkspaceProviderProps) {
    const { user, isAuthenticated } = useAuth();
    const [workspaces, setWorkspaces] = useState<WorkspaceSummary[]>([]);
    const [currentWorkspaceId, setCurrentWorkspaceId] = useState<number | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const workspacesRef = useRef<WorkspaceSummary[]>([]);
    const latestRequestIdRef = useRef(0);

    /**
     * 로그인 사용자의 Workspace 목록을 다시 조회하고 Context 상태를 갱신합니다.
     * 저장된 선택값이 유효하면 복원하며 현재 #30 적용 전 정책에 따라 첫 항목을 대체값으로 사용합니다.
     * 생성과 초대 수락 화면에서도 호출할 수 있도록 최신 목록을 반환합니다.
     */
    const refreshWorkspaces = useCallback(async () => {
        if (!isAuthenticated || !user) {
            latestRequestIdRef.current += 1;
            workspacesRef.current = [];
            setWorkspaces([]);
            setCurrentWorkspaceId(null);
            setIsLoading(false);
            setErrorMessage(null);
            return [];
        }

        const requestId = latestRequestIdRef.current + 1;
        latestRequestIdRef.current = requestId;

        try {
            setIsLoading(true);
            setErrorMessage(null);

            const response = await getWorkspaces();

            if (requestId !== latestRequestIdRef.current) {
                return response.data;
            }

            workspacesRef.current = response.data;
            setWorkspaces(response.data);

            // 저장된 선택값이 현재 참여 Workspace 목록에도 존재하는지 확인합니다.
            const storedId = Number(
                sessionStorage.getItem(getStorageKey(user.userId))
            );
            const storedWorkspace = response.data.find(
                workspace => workspace.workspaceId === storedId
            );

            const nextWorkspaceId =
                storedWorkspace?.workspaceId
                ?? response.data[0]?.workspaceId
                ?? null;

            setCurrentWorkspaceId(nextWorkspaceId);

            if (nextWorkspaceId !== null) {
                sessionStorage.setItem(
                    getStorageKey(user.userId),
                    String(nextWorkspaceId)
                );
            }

            return response.data;
        } catch (error) {
            if (requestId !== latestRequestIdRef.current) {
                return [];
            }

            console.error(error);
            workspacesRef.current = [];
            setWorkspaces([]);
            setCurrentWorkspaceId(null);
            setErrorMessage('제작팀 목록을 불러오지 못했습니다.');
            return [];
        } finally {
            if (requestId === latestRequestIdRef.current) {
                setIsLoading(false);
            }
        }
    }, [isAuthenticated, user]);

    // 인증 사용자가 바뀌면 해당 사용자의 Workspace 목록과 저장된 선택값을 복원합니다.
    useEffect(() => {
        void refreshWorkspaces();
    }, [refreshWorkspaces]);

    // ID와 목록으로부터 화면에서 사용할 현재 Workspace 객체를 계산합니다.
    const currentWorkspace = useMemo(
        () => workspaces.find(
            workspace => workspace.workspaceId === currentWorkspaceId
        ) ?? null,
        [currentWorkspaceId, workspaces]
    );

    // 목록에 존재하는 Workspace만 선택하고 다음 화면 진입을 위해 저장합니다.
    const selectWorkspace = (workspaceId: number) => {
        if (!user || !workspacesRef.current.some(
            workspace => workspace.workspaceId === workspaceId
        )) {
            return;
        }

        setCurrentWorkspaceId(workspaceId);
        sessionStorage.setItem(
            getStorageKey(user.userId),
            String(workspaceId)
        );
    };

    // Header와 Workspace 하위 화면이 동일한 현재 Workspace 상태를 공유합니다.
    return (
        <WorkspaceContext
            value={{
                workspaces,
                currentWorkspace,
                isLoading,
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
