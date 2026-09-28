import { useContext } from 'react';

import { WorkspaceContext } from '../contexts/workspaceContextStore';

// 현재 Workspace와 Workspace 전환 기능을 사용하는 공통 Hook
export function useWorkspace() {
    const context = useContext(WorkspaceContext);

    if (!context) {
        throw new Error(
            'useWorkspace는 WorkspaceProvider 내부에서 사용해야 합니다.'
        );
    }

    return context;
}
