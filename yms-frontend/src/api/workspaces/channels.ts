import type { ChannelSummary } from '../../types/workspace';
import type { ApiSuccessResponse } from '../types';

export type ChannelListResponse =
    ApiSuccessResponse<ChannelSummary[]>;

// Workspace 경계와 Channel 필터 동작을 확인하기 위한 Mock 데이터
const MOCK_CHANNELS_BY_WORKSPACE: Record<number, ChannelSummary[]> = {
    1: [
        { channelId: 1, name: 'YMS 메인 채널' },
        { channelId: 2, name: 'YMS Shorts' },
        { channelId: 3, name: '테크 리뷰' }
    ],
    2: [
        { channelId: 21, name: 'Sample Creator' }
    ]
};

// GET /api/workspaces/{workspaceId}/channels?activeOnly=true
export async function getWorkspaceChannels(
    workspaceId: number
): Promise<ChannelListResponse> {
    // TODO: 백엔드 완성 후 axios 호출로 교체
    await new Promise(resolve => setTimeout(resolve, 200));

    return {
        success: true,
        data: MOCK_CHANNELS_BY_WORKSPACE[workspaceId] ?? []
    };
}
