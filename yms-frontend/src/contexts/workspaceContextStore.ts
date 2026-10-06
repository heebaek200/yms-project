import { createContext } from 'react';

import type { WorkspaceSummary } from '../types/workspace';

export type WorkspaceContextValue = {
    workspaces: WorkspaceSummary[];
    currentWorkspace: WorkspaceSummary | null;
    isLoading: boolean;
    errorMessage: string | null;
    selectWorkspace: (workspaceId: number) => void;
    refreshWorkspaces: () => Promise<WorkspaceSummary[]>;
};

// Provider와 Hook을 분리하여 Fast Refresh가 컴포넌트만 안전하게 갱신되도록 합니다.
export const WorkspaceContext =
    createContext<WorkspaceContextValue | null>(null);
