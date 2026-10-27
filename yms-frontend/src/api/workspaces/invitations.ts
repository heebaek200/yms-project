import type { AuthUser } from '../../types/auth';
import type {
    WorkspaceInvitation,
    WorkspaceSummary
} from '../../types/workspace';
import type {
    ApiResponse,
    ApiSuccessResponse
} from '../types';
import { activateMockWorkspaceMember } from './members';
import { addMockWorkspaceMembership } from './workspaces';
import {
    getMockWorkspaceInvitationStore,
    type MockWorkspaceInvitationRecord
} from './workspaceInvitationStore';

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

/** 공용 내부 초대 레코드를 SCR-03의 수신 초대 응답 모양으로 변환합니다. */
function toWorkspaceInvitation(
    invitation: MockWorkspaceInvitationRecord
): WorkspaceInvitation {
    return {
        invitationId: invitation.invitationId,
        workspaceId: invitation.workspaceId,
        workspaceName: invitation.workspaceName,
        inviterName: invitation.inviterName,
        status: invitation.status,
        sentAt: invitation.sentAt,
        expiresAt: invitation.expiresAt
    };
}

/** 내부 초대 레코드로 현재 사용자가 참여할 Workspace 요약을 구성합니다. */
function toWorkspaceSummary(
    invitation: MockWorkspaceInvitationRecord
): WorkspaceSummary {
    return {
        workspaceId: invitation.workspaceId,
        name: invitation.workspaceName,
        myRole: 'MEMBER',
        activeProjectCount: invitation.activeProjectCount
    };
}

/**
 * 현재 로그인 사용자의 이메일로 도착한 유효한 PENDING 초대를 조회합니다.
 * 발송 관리 API와 같은 저장소를 사용해 취소·수락·거절 상태가 양쪽에 즉시 반영됩니다.
 */
export async function getPendingWorkspaceInvitations(
    userEmail: string
): Promise<WorkspaceInvitationListResponse> {
    await new Promise(resolve => setTimeout(resolve, 250));

    const normalizedEmail = userEmail.trim().toLocaleLowerCase();
    const now = Date.now();
    const invitations = getMockWorkspaceInvitationStore()
        .filter(invitation => (
            invitation.email.toLocaleLowerCase() === normalizedEmail
        ))
        .filter(invitation => invitation.status === 'PENDING')
        .filter(invitation => Date.parse(invitation.expiresAt) > now)
        .sort((left, right) => Date.parse(right.sentAt) - Date.parse(left.sentAt))
        .map(toWorkspaceInvitation);

    return {
        success: true,
        data: invitations
    };
}

/**
 * 초대가 현재 사용자에게 속하고 처리 가능한지 요청 시점에 다시 확인합니다.
 * 발송 이후 취소·만료되거나 다른 계정이 ID를 추측한 경우 상태 변경을 차단합니다.
 */
function findActionableInvitation(
    invitationId: number,
    userEmail: string
): MockWorkspaceInvitationRecord | ApiResponse<never> {
    const invitation = getMockWorkspaceInvitationStore().find(
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

    if (
        invitation.email.toLocaleLowerCase()
        !== userEmail.trim().toLocaleLowerCase()
    ) {
        return {
            success: false,
            errorCode: 'FORBIDDEN_WORKSPACE_INVITATION',
            message: '현재 사용자의 초대가 아닙니다.',
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

    if (Date.parse(invitation.expiresAt) <= Date.now()) {
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
 * PENDING 초대를 수락하고 기존 LEFT·REMOVED 멤버를 ACTIVE·MEMBER로 복구합니다.
 * 기존 행이 없으면 새 멤버를 생성한 뒤 Workspace 목록과 공용 초대 상태를 갱신합니다.
 */
export async function acceptWorkspaceInvitation(
    invitationId: number,
    user: AuthUser
): Promise<AcceptWorkspaceInvitationResponse> {
    await new Promise(resolve => setTimeout(resolve, 350));

    const result = findActionableInvitation(invitationId, user.email);

    if ('success' in result) {
        return result;
    }

    // 멤버십 갱신이 실패하면 초대 상태를 먼저 소비하지 않고 PENDING으로 유지합니다.
    const membershipResponse = activateMockWorkspaceMember(
        result.workspaceId,
        user
    );

    if (!membershipResponse.success) {
        return membershipResponse;
    }

    const workspace = toWorkspaceSummary(result);
    result.status = 'ACCEPTED';
    result.respondedAt = new Date().toISOString();
    addMockWorkspaceMembership(workspace, user.userId);

    return {
        success: true,
        message: 'Workspace 초대를 수락했습니다.',
        data: {
            invitationId,
            status: 'ACCEPTED',
            workspace
        }
    };
}

/** 현재 사용자의 PENDING 초대를 거절하고 공용 발송 목록에도 처리 결과를 반영합니다. */
export async function rejectWorkspaceInvitation(
    invitationId: number,
    userEmail: string
): Promise<RejectWorkspaceInvitationResponse> {
    await new Promise(resolve => setTimeout(resolve, 350));

    const result = findActionableInvitation(invitationId, userEmail);

    if ('success' in result) {
        return result;
    }

    result.status = 'REJECTED';
    result.respondedAt = new Date().toISOString();

    return {
        success: true,
        message: 'Workspace 초대를 거절했습니다.',
        data: {
            invitationId,
            status: 'REJECTED'
        }
    };
}
