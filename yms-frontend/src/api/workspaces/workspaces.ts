import type { WorkspaceSummary } from '../../types/workspace';
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

// 실제 API 연동 전까지 생성과 초대 수락 결과가 목록 조회에 유지되는 Mock 저장소입니다.
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
export async function getWorkspaces(): Promise<WorkspaceListResponse> {
    await new Promise(resolve => setTimeout(resolve, 200));

    return {
        success: true,
        data: mockWorkspaces.map(workspace => ({ ...workspace }))
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
