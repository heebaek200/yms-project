import type {
    WorkspaceInvitationStatusFilter,
    WorkspaceSentInvitation
} from '../../types/workspaceSettings';
import type { WorkspaceRole } from '../../types/workspace';
import type { ApiResponse, ApiSuccessResponse } from '../types';
import { findMockWorkspaceMemberByEmail } from './members';
import {
    addMockWorkspaceInvitation,
    getMockWorkspaceInvitationStore,
    type MockWorkspaceInvitationRecord
} from './workspaceInvitationStore';

export type WorkspaceInvitationListRequest = {
    keyword?: string;
    status?: WorkspaceInvitationStatusFilter;
};

export type WorkspaceSentInvitationListResponse =
    ApiSuccessResponse<WorkspaceSentInvitation[]>;
export type WorkspaceSentInvitationResponse =
    ApiResponse<WorkspaceSentInvitation>;

/** PENDING 초대의 현재 만료 여부를 서버와 같은 시점 기준으로 판정합니다. */
export function isWorkspaceInvitationExpired(
    invitation: Pick<WorkspaceSentInvitation, 'status' | 'expiresAt'>
) {
    return invitation.status === 'PENDING'
        && Date.parse(invitation.expiresAt) <= Date.now();
}

/**
 * 제작팀이 발송한 초대를 이메일과 상태로 조회합니다.
 * EXPIRED는 별도 저장하지 않고 PENDING과 expiresAt으로 계산해 상태 충돌을 막습니다.
 */
export async function getWorkspaceSentInvitations(
    workspaceId: number,
    request: WorkspaceInvitationListRequest = {}
): Promise<WorkspaceSentInvitationListResponse> {
    await new Promise(resolve => setTimeout(resolve, 220));

    const keyword = request.keyword?.trim().toLocaleLowerCase() ?? '';
    const status = request.status ?? 'PENDING';
    const invitations = getMockWorkspaceInvitationStore()
        .filter(invitation => invitation.workspaceId === workspaceId)
        .filter(invitation => !keyword
            || invitation.email.toLocaleLowerCase().includes(keyword)
        )
        .filter(invitation => {
            if (status === 'ALL') {
                return true;
            }

            if (status === 'EXPIRED') {
                return isWorkspaceInvitationExpired(invitation);
            }

            if (status === 'PENDING') {
                return invitation.status === 'PENDING'
                    && !isWorkspaceInvitationExpired(invitation);
            }

            return invitation.status === status;
        })
        .sort((left, right) => Date.parse(right.sentAt) - Date.parse(left.sentAt));

    return { success: true, data: invitations.map(toWorkspaceSentInvitation) };
}

/** 공용 내부 초대 레코드에서 관리 화면에 필요한 발송 초대 필드만 반환합니다. */
function toWorkspaceSentInvitation(
    invitation: MockWorkspaceInvitationRecord
): WorkspaceSentInvitation {
    return {
        invitationId: invitation.invitationId,
        workspaceId: invitation.workspaceId,
        email: invitation.email,
        inviterName: invitation.inviterName,
        status: invitation.status,
        sentAt: invitation.sentAt,
        expiresAt: invitation.expiresAt,
        respondedAt: invitation.respondedAt
    };
}

/**
 * 이메일 하나로 일반 멤버 초대를 생성합니다.
 * ACTIVE 멤버와 아직 유효한 PENDING 초대는 중복 생성하지 않으며 이탈 멤버는 재초대합니다.
 */
export async function createWorkspaceMemberInvitation(
    workspaceId: number,
    workspaceName: string,
    activeProjectCount: number,
    emailValue: string,
    inviterName: string,
    actorRole: WorkspaceRole
): Promise<WorkspaceSentInvitationResponse> {
    await new Promise(resolve => setTimeout(resolve, 300));

    if (actorRole === 'MEMBER') {
        return {
            success: false,
            errorCode: 'WORKSPACE_INVITATION_FORBIDDEN',
            message: '멤버를 초대할 권한이 없습니다.',
            errors: null
        };
    }

    const email = emailValue.trim().toLocaleLowerCase();
    const isValidEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

    if (!isValidEmail || email.length > 255) {
        return {
            success: false,
            errorCode: 'INVALID_INPUT_VALUE',
            message: '입력값 검증에 실패했습니다.',
            errors: [{
                field: 'email',
                value: emailValue,
                reason: '올바른 이메일 주소를 입력해 주세요.'
            }]
        };
    }

    const member = findMockWorkspaceMemberByEmail(workspaceId, email);
    if (member?.status === 'ACTIVE') {
        return {
            success: false,
            errorCode: 'WORKSPACE_MEMBER_ALREADY_ACTIVE',
            message: '이미 활동 중인 제작팀 멤버입니다.',
            errors: null
        };
    }

    const hasPendingInvitation = getMockWorkspaceInvitationStore().some(invitation => (
        invitation.workspaceId === workspaceId
        && invitation.email.toLocaleLowerCase() === email
        && invitation.status === 'PENDING'
        && !isWorkspaceInvitationExpired(invitation)
    ));

    if (hasPendingInvitation) {
        return {
            success: false,
            errorCode: 'WORKSPACE_INVITATION_ALREADY_PENDING',
            message: '이미 유효한 초대를 보낸 이메일입니다.',
            errors: null
        };
    }

    const sentAt = new Date();
    const expiresAt = new Date(sentAt);
    expiresAt.setDate(expiresAt.getDate() + 7);
    const invitation = addMockWorkspaceInvitation({
        workspaceId,
        workspaceName,
        activeProjectCount,
        email,
        inviterName,
        status: 'PENDING',
        sentAt: sentAt.toISOString(),
        expiresAt: expiresAt.toISOString(),
        respondedAt: null
    });

    return {
        success: true,
        message: `${email} 주소로 멤버 초대를 보냈습니다.`,
        data: toWorkspaceSentInvitation(invitation)
    };
}

/** 유효한 PENDING 초대만 취소하고 처리 완료 시각을 기록합니다. */
export async function cancelWorkspaceMemberInvitation(
    workspaceId: number,
    invitationId: number,
    actorRole: WorkspaceRole
): Promise<WorkspaceSentInvitationResponse> {
    await new Promise(resolve => setTimeout(resolve, 300));

    if (actorRole === 'MEMBER') {
        return {
            success: false,
            errorCode: 'WORKSPACE_INVITATION_FORBIDDEN',
            message: '초대를 취소할 권한이 없습니다.',
            errors: null
        };
    }

    const invitation = getMockWorkspaceInvitationStore().find(item => (
        item.workspaceId === workspaceId
        && item.invitationId === invitationId
    ));

    if (!invitation) {
        return {
            success: false,
            errorCode: 'WORKSPACE_INVITATION_NOT_FOUND',
            message: '초대 내역을 찾을 수 없습니다.',
            errors: null
        };
    }

    if (invitation.status !== 'PENDING' || isWorkspaceInvitationExpired(invitation)) {
        return {
            success: false,
            errorCode: 'WORKSPACE_INVITATION_NOT_PENDING',
            message: '현재 취소할 수 없는 초대입니다.',
            errors: null
        };
    }

    invitation.status = 'CANCELLED';
    invitation.respondedAt = new Date().toISOString();

    return {
        success: true,
        message: '멤버 초대를 취소했습니다.',
        data: toWorkspaceSentInvitation(invitation)
    };
}
