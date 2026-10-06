// Workspace 안에서 사용자가 가지는 관리 권한
export type WorkspaceRole =
    | 'OWNER'
    | 'ADMIN'
    | 'MEMBER';

// 로그인한 사용자가 참여 중인 Workspace 목록 항목
export type WorkspaceSummary = {
    workspaceId: number;
    name: string;
    myRole: WorkspaceRole;
    activeProjectCount: number;
};

// 현재 사용자에게 발송된 Workspace 초대 상태
export type WorkspaceInvitationStatus =
    | 'PENDING'
    | 'ACCEPTED'
    | 'REJECTED'
    | 'CANCELLED';

// SCR-03 대기 초대 목록에서 사용하는 수신 초대 정보
export type WorkspaceInvitation = {
    invitationId: number;
    workspaceId: number;
    workspaceName: string;
    inviterName: string;
    status: WorkspaceInvitationStatus;
    sentAt: string;
    expiresAt: string | null;
};

// 필터와 선택 UI에서 공통으로 사용하는 Channel 요약 정보
export type ChannelSummary = {
    channelId: number;
    name: string;
};
