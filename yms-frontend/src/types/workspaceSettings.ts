import type { ChannelSummary } from './workspace';
import type {
    WorkspaceInvitationStatus,
    WorkspaceRole
} from './workspace';
import type { UserRole } from './auth';

// YouTube 연결 여부와 실패 상태를 Channel 정보와 함께 표시합니다.
export type ChannelIntegrationStatus =
    | 'MANUAL'
    | 'CONNECTED'
    | 'DISCONNECTED'
    | 'ERROR';

// 제작팀 관리 화면에서 사용하는 Channel 상세 정보입니다.
export type WorkspaceChannel = ChannelSummary & {
    youtubeChannelId: string | null;
    youtubeChannelUrl: string | null;
    description: string | null;
    integrationStatus: ChannelIntegrationStatus;
    active: boolean;
};

// 제작팀에서 자유롭게 확장하는 작업 종류 정보입니다.
export type WorkspaceTaskType = {
    taskTypeId: number;
    name: string;
    active: boolean;
};

// 제작팀 멤버십의 현재 참여 상태입니다.
export type WorkspaceMemberStatus = 'ACTIVE' | 'LEFT' | 'REMOVED';

// 제작팀 관리 화면에서 조회하는 멤버 정보입니다.
export type WorkspaceMember = {
    workspaceMemberId: number;
    userId: number;
    name: string;
    email: string;
    professionalRoles: UserRole[];
    workspaceRole: WorkspaceRole;
    status: WorkspaceMemberStatus;
    joinedAt: string;
    leftAt: string | null;
};

// 제작팀이 발송한 초대 내역입니다. EXPIRED는 PENDING과 만료 시각으로 계산합니다.
export type WorkspaceSentInvitation = {
    invitationId: number;
    workspaceId: number;
    email: string;
    inviterName: string;
    status: WorkspaceInvitationStatus;
    sentAt: string;
    expiresAt: string;
    respondedAt: string | null;
};

export type WorkspaceInvitationStatusFilter =
    | 'ALL'
    | WorkspaceInvitationStatus
    | 'EXPIRED';
