import type { ChannelSummary } from './workspace';

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
