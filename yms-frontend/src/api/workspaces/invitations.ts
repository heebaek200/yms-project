import type {
    WorkspaceInvitation,
    WorkspaceSummary
} from '../../types/workspace';
import type {
    ApiResponse,
    ApiSuccessResponse
} from '../types';
import { addMockWorkspaceMembership } from './workspaces';

export type WorkspaceInvitationListResponse =
    ApiSuccessResponse<WorkspaceInvitation[]>;

export type AcceptWorkspaceInvitationData = {
    invitationId: number;
    status: 'ACCEPTED';
    workspace: WorkspaceSummary;
};

export type RejectWorkspaceInvitationData = {
    invitationId: number;
    status: 'REJECTED';
};

export type AcceptWorkspaceInvitationResponse =
    ApiResponse<AcceptWorkspaceInvitationData>;
export type RejectWorkspaceInvitationResponse =
    ApiResponse<RejectWorkspaceInvitationData>;

type MockWorkspaceInvitation = WorkspaceInvitation & {
    workspace: WorkspaceSummary;
};

let mockInvitations: MockWorkspaceInvitation[] = [
    {
        invitationId: 41,
        workspaceId: 7,
        workspaceName: 'Game Channel Studio',
        inviterName: '박관리자',
        status: 'PENDING',
        sentAt: '2026-10-01T14:30:00+09:00',
        expiresAt: '2026-10-08T14:30:00+09:00',
        workspace: {
            workspaceId: 7,
            name: 'Game Channel Studio',
            myRole: 'MEMBER',
            activeProjectCount: 4
        }
    }
];

/**
 * 현재 로그인 사용자에게 도착한 유효한 PENDING Workspace 초대를 조회합니다.
 * 만료된 항목은 실제 API 명세와 동일하게 대기 목록에서 제외하고 최신순으로 정렬합니다.
 * 실제 연동 시 GET /api/workspace-invitations?status=PENDING 요청으로 교체합니다.
 */
export async function getPendingWorkspaceInvitations():
Promise<WorkspaceInvitationListResponse> {
    await new Promise(resolve => setTimeout(resolve, 250));

    const now = Date.now();
    const invitations = mockInvitations
        .filter(invitation => invitation.status === 'PENDING')
        .filter(invitation => (
            invitation.expiresAt === null
            || Date.parse(invitation.expiresAt) > now
        ))
        .sort((left, right) => Date.parse(right.sentAt) - Date.parse(left.sentAt))
        .map(({ workspace: _workspace, ...invitation }) => ({ ...invitation }));

    return {
        success: true,
        data: invitations
    };
}

/**
 * 초대가 현재 처리 가능한지 확인하고 그렇지 않으면 공통 실패 응답을 반환합니다.
 * 조회 이후 취소되거나 만료되는 경합을 수락과 거절 시점에 다시 검사합니다.
 * 유효한 PENDING 초대라면 이후 상태 전이를 위해 Mock 원본 객체를 반환합니다.
 */
function findActionableInvitation(invitationId: number):
MockWorkspaceInvitation | ApiResponse<never> {
    const invitation = mockInvitations.find(
        item => item.invitationId === invitationId
    );

    if (!invitation) {
        return {
            success: false,
            errorCode: 'WORKSPACE_INVITATION_NOT_FOUND',
            message: 'Workspace 초대를 찾을 수 없습니다.',
            errors: null
        };
    }

    if (invitation.status !== 'PENDING') {
        return {
            success: false,
            errorCode: 'WORKSPACE_INVITATION_NOT_PENDING',
            message: '이미 처리되었거나 취소된 초대입니다.',
            errors: null
        };
    }

    if (
        invitation.expiresAt !== null
        && Date.parse(invitation.expiresAt) <= Date.now()
    ) {
        return {
            success: false,
            errorCode: 'WORKSPACE_INVITATION_EXPIRED',
            message: '만료된 초대입니다.',
            errors: null
        };
    }

    return invitation;
}

/**
 * 현재 사용자의 PENDING 초대를 수락하고 Workspace 멤버십을 목록에 반영합니다.
 * 성공 응답에는 즉시 화면 상태를 갱신할 수 있도록 새 Workspace 요약을 포함합니다.
 * 실제 연동 시 POST /api/workspace-invitations/{id}/accept 요청으로 교체합니다.
 */
export async function acceptWorkspaceInvitation(
    invitationId: number
): Promise<AcceptWorkspaceInvitationResponse> {
    await new Promise(resolve => setTimeout(resolve, 350));

    const result = findActionableInvitation(invitationId);

    if ('success' in result) {
        return result;
    }

    result.status = 'ACCEPTED';
    addMockWorkspaceMembership(result.workspace);

    return {
        success: true,
        message: 'Workspace 초대를 수락했습니다.',
        data: {
            invitationId,
            status: 'ACCEPTED',
            workspace: { ...result.workspace }
        }
    };
}

/**
 * 현재 사용자의 PENDING 초대를 거절하고 더 이상 대기 목록에 노출하지 않습니다.
 * 성공 응답에는 처리된 초대 ID와 최종 REJECTED 상태를 반환합니다.
 * 실제 연동 시 POST /api/workspace-invitations/{id}/reject 요청으로 교체합니다.
 */
export async function rejectWorkspaceInvitation(
    invitationId: number
): Promise<RejectWorkspaceInvitationResponse> {
    await new Promise(resolve => setTimeout(resolve, 350));

    const result = findActionableInvitation(invitationId);

    if ('success' in result) {
        return result;
    }

    result.status = 'REJECTED';

    return {
        success: true,
        message: 'Workspace 초대를 거절했습니다.',
        data: {
            invitationId,
            status: 'REJECTED'
        }
    };
}
