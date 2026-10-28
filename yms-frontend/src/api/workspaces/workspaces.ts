import type { WorkspaceSummary } from '../../types/workspace';
import type { WorkspaceRole } from '../../types/workspace';
import type {
    ApiResponse,
    ApiSuccessResponse
} from '../types';

export type WorkspaceListResponse =
    ApiSuccessResponse<WorkspaceSummary[]>;

export type CreateWorkspaceRequest = {
    name: string;
    description?: string;
};

export type CreateWorkspaceResponse = ApiResponse<WorkspaceSummary>;

// 실제 API 연동 전까지 생성·초대·탈퇴 결과를 현재 탭 생명주기 동안 유지합니다.
// 페이지 새로고침 시 Member·Project Mock과 ID 발급값을 포함한 전체 초기 상태가 함께 복구됩니다.
let mockWorkspaces: WorkspaceSummary[] = [
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

let nextWorkspaceId = 3;

/**
 * 로그인 사용자가 ACTIVE MEMBER로 참여 중인 Workspace 목록을 조회합니다.
 * 실제 연동 시 GET /api/workspaces 요청으로 교체할 Mock 함수입니다.
 * 호출부가 Mock 저장소를 직접 변경하지 못하도록 각 항목을 복사해 반환합니다.
 */
export async function getWorkspaces(userId?: number): Promise<WorkspaceListResponse> {
    await new Promise(resolve => setTimeout(resolve, 200));

    // 샘플 크리에이터 계정은 Sample Creator Team의 OWNER 경계를 검증하는 전용 계정입니다.
    const visibleWorkspaces = userId === 24621
        ? mockWorkspaces
            .filter(workspace => workspace.workspaceId === 2)
            .map(workspace => ({ ...workspace, myRole: 'OWNER' as const }))
        : mockWorkspaces;

    return {
        success: true,
        data: visibleWorkspaces.map(workspace => ({ ...workspace }))
    };
}

/**
 * 새 Workspace를 생성하고 생성 사용자를 OWNER로 등록한 요약 정보를 반환합니다.
 * 이름은 trim 후 1~100자, 선택 설명은 최대 500자로 현재 DB 설계와 맞춥니다.
 * 실제 연동 시 POST /api/workspaces 요청으로 교체할 Mock 함수입니다.
 */
export async function createWorkspace(
    request: CreateWorkspaceRequest
): Promise<CreateWorkspaceResponse> {
    await new Promise(resolve => setTimeout(resolve, 350));

    const name = request.name.trim();
    const description = request.description?.trim() ?? '';

    if (!name || name.length > 100) {
        return {
            success: false,
            errorCode: 'INVALID_INPUT_VALUE',
            message: '입력값 검증에 실패했습니다.',
            errors: [{
                field: 'name',
                value: request.name,
                reason: '제작팀 이름은 1자 이상 100자 이하로 입력해 주세요.'
            }]
        };
    }

    if (description.length > 500) {
        return {
            success: false,
            errorCode: 'INVALID_INPUT_VALUE',
            message: '입력값 검증에 실패했습니다.',
            errors: [{
                field: 'description',
                value: request.description ?? null,
                reason: '설명은 500자 이하로 입력해 주세요.'
            }]
        };
    }

    const workspace: WorkspaceSummary = {
        workspaceId: nextWorkspaceId,
        name,
        myRole: 'OWNER',
        activeProjectCount: 0
    };

    nextWorkspaceId += 1;
    mockWorkspaces = [...mockWorkspaces, workspace];

    return {
        success: true,
        message: '새 제작팀을 만들었습니다.',
        data: { ...workspace }
    };
}

/**
 * 초대 수락 Mock이 생성한 Workspace 멤버십을 목록 저장소에 반영합니다.
 * 이미 같은 Workspace가 있으면 중복으로 추가하지 않고 기존 목록을 유지합니다.
 * 실제 API 연동 시 수락 후 GET /api/workspaces 재조회로 대체되는 보조 함수입니다.
 */
export function addMockWorkspaceMembership(workspace: WorkspaceSummary) {
    if (mockWorkspaces.some(item => item.workspaceId === workspace.workspaceId)) {
        return;
    }

    mockWorkspaces = [...mockWorkspaces, { ...workspace }];
}

/**
 * 멤버 관리 Mock에서 현재 사용자의 제작팀 권한 변경을 목록 저장소에 반영합니다.
 * Context는 이후 목록을 재조회하여 Route Guard와 Header에 최신 권한을 전달합니다.
 */
export function updateMockWorkspaceRole(
    workspaceId: number,
    workspaceRole: WorkspaceRole
) {
    mockWorkspaces = mockWorkspaces.map(workspace => (
        workspace.workspaceId === workspaceId
            ? { ...workspace, myRole: workspaceRole }
            : workspace
    ));
}

/** 현재 탭 또는 무효화 이벤트를 받은 다른 탭의 ACTIVE 목록에서 제작팀을 제거합니다. */
export function removeMockWorkspaceMembership(workspaceId: number) {
    mockWorkspaces = mockWorkspaces.filter(
        workspace => workspace.workspaceId !== workspaceId
    );
}
