import type { WorkspaceSummary } from '../../types/workspace';
import type { ApiSuccessResponse } from '../types';

export type WorkspaceListResponse =
    ApiSuccessResponse<WorkspaceSummary[]>;

// SCR-03 Workspace 선택 화면이 구현되기 전까지 사용할 참여 Workspace Mock 데이터
const MOCK_WORKSPACES: WorkspaceSummary[] = [
    {
        workspaceId: 1,
        name: 'YMS Media Team',
        myRole: 'OWNER',
        activeProjectCount: 8
    },
    {
        workspaceId: 2,
        name: 'Sample Creator Team',
        myRole: 'MEMBER',
        activeProjectCount: 3
    }
];

// GET /api/workspaces
export async function getWorkspaces(): Promise<WorkspaceListResponse> {
    // TODO: 백엔드 완성 후 axios 호출로 교체
    await new Promise(resolve => setTimeout(resolve, 200));

    return {
        success: true,
        data: MOCK_WORKSPACES
    };
}
