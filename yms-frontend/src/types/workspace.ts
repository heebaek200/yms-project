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

// 필터와 선택 UI에서 공통으로 사용하는 Channel 요약 정보
export type ChannelSummary = {
    channelId: number;
    name: string;
};
