import type { WorkspaceInvitationStatus } from '../../types/workspace';

// 발송·수신 초대 API가 서로 다른 응답 모양으로 조회하는 내부 공용 Mock 레코드입니다.
export type MockWorkspaceInvitationRecord = {
    invitationId: number;
    workspaceId: number;
    workspaceName: string;
    activeProjectCount: number;
    email: string;
    inviterName: string;
    status: WorkspaceInvitationStatus;
    sentAt: string;
    expiresAt: string;
    respondedAt: string | null;
};

let nextInvitationId = 306;

// 한 저장소를 공유하여 발송 측 취소와 수신 측 수락·거절이 양쪽 목록에 함께 반영됩니다.
const mockWorkspaceInvitations: MockWorkspaceInvitationRecord[] = [
    {
        invitationId: 41,
        workspaceId: 7,
        workspaceName: 'Game Channel Studio',
        activeProjectCount: 4,
        email: 'test@test.com',
        inviterName: '박관리자',
        status: 'PENDING',
        sentAt: '2026-10-15T09:30:00+09:00',
        expiresAt: '2099-10-22T09:30:00+09:00',
        respondedAt: null
    },
    {
        invitationId: 301,
        workspaceId: 1,
        workspaceName: 'YMS Media Team',
        activeProjectCount: 8,
        email: 'pending@yms.test',
        inviterName: '테스트 사용자',
        status: 'PENDING',
        sentAt: '2026-10-14T10:00:00+09:00',
        expiresAt: '2099-10-21T10:00:00+09:00',
        respondedAt: null
    },
    {
        invitationId: 302,
        workspaceId: 1,
        workspaceName: 'YMS Media Team',
        activeProjectCount: 8,
        email: 'expired@yms.test',
        inviterName: '테스트 사용자',
        status: 'PENDING',
        sentAt: '2026-09-01T10:00:00+09:00',
        expiresAt: '2026-09-08T10:00:00+09:00',
        respondedAt: null
    },
    {
        invitationId: 303,
        workspaceId: 1,
        workspaceName: 'YMS Media Team',
        activeProjectCount: 8,
        email: 'accepted@yms.test',
        inviterName: '테스트 사용자',
        status: 'ACCEPTED',
        sentAt: '2026-09-20T10:00:00+09:00',
        expiresAt: '2026-09-27T10:00:00+09:00',
        respondedAt: '2026-09-21T08:30:00+09:00'
    },
    {
        invitationId: 304,
        workspaceId: 1,
        workspaceName: 'YMS Media Team',
        activeProjectCount: 8,
        email: 'rejected@yms.test',
        inviterName: '테스트 사용자',
        status: 'REJECTED',
        sentAt: '2026-09-22T10:00:00+09:00',
        expiresAt: '2026-09-29T10:00:00+09:00',
        respondedAt: '2026-09-23T08:30:00+09:00'
    },
    {
        invitationId: 305,
        workspaceId: 1,
        workspaceName: 'YMS Media Team',
        activeProjectCount: 8,
        email: 'cancelled@yms.test',
        inviterName: '테스트 사용자',
        status: 'CANCELLED',
        sentAt: '2026-09-24T10:00:00+09:00',
        expiresAt: '2026-10-01T10:00:00+09:00',
        respondedAt: '2026-09-25T08:30:00+09:00'
    }
];

/** 발송·수신 API가 상태를 공유하도록 동일한 내부 저장소 참조를 반환합니다. */
export function getMockWorkspaceInvitationStore() {
    return mockWorkspaceInvitations;
}

/** 새 발송 초대에 중복되지 않는 Mock 식별자를 부여하고 공용 저장소에 추가합니다. */
export function addMockWorkspaceInvitation(
    invitation: Omit<MockWorkspaceInvitationRecord, 'invitationId'>
) {
    const createdInvitation: MockWorkspaceInvitationRecord = {
        ...invitation,
        invitationId: nextInvitationId
    };

    nextInvitationId += 1;
    mockWorkspaceInvitations.unshift(createdInvitation);
    return createdInvitation;
}
