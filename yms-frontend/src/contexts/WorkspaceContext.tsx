import {
    useEffect,
    useMemo,
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

    /**
     * 로그인한 사용자가 참여 중인 Workspace를 조회합니다.
     * 이전에 선택한 Workspace가 여전히 유효하면 복원하고,
     * 그렇지 않으면 첫 번째 Workspace를 기본값으로 사용합니다.
     */
    useEffect(() => {
        if (!isAuthenticated || !user) {
            setWorkspaces([]);
            setCurrentWorkspaceId(null);
            setIsLoading(false);
            setErrorMessage(null);
            return;
        }

        let isCurrentRequest = true;

        const loadWorkspaces = async () => {
            try {
                setIsLoading(true);
                setErrorMessage(null);

                const response = await getWorkspaces();

                if (!isCurrentRequest) {
                    return;
                }

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
            } catch (error) {
                if (!isCurrentRequest) {
                    return;
                }

                console.error(error);
                setWorkspaces([]);
                setCurrentWorkspaceId(null);
                setErrorMessage('제작팀 목록을 불러오지 못했습니다.');
            } finally {
                if (isCurrentRequest) {
                    setIsLoading(false);
                }
            }
        };

        loadWorkspaces();

        return () => {
            isCurrentRequest = false;
        };
    }, [isAuthenticated, user]);

    // ID와 목록으로부터 화면에서 사용할 현재 Workspace 객체를 계산합니다.
    const currentWorkspace = useMemo(
        () => workspaces.find(
            workspace => workspace.workspaceId === currentWorkspaceId
        ) ?? null,
        [currentWorkspaceId, workspaces]
    );

    // 목록에 존재하는 Workspace만 선택하고 다음 화면 진입을 위해 저장합니다.
    const selectWorkspace = (workspaceId: number) => {
        if (!user || !workspaces.some(
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
                selectWorkspace
            }}
        >
            {children}
        </WorkspaceContext>
    );
}

export default WorkspaceProvider;
