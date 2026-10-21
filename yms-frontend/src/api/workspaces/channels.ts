import type {
    ChannelIntegrationStatus,
    WorkspaceChannel
} from '../../types/workspaceSettings';
import type { ApiResponse } from '../types';
import { readProjects } from '../projects/projectStore';

export type ChannelListRequest = {
    activeOnly?: boolean;
    keyword?: string;
};

export type SaveChannelRequest = {
    name: string;
    youtubeChannelId?: string | null;
    youtubeChannelUrl?: string | null;
    description?: string | null;
    longFormRate?: string;
    shortFormRate?: string;
};

export type UpdateChannelRequest = SaveChannelRequest & {
    active: boolean;
};

export type ChannelListResponse = ApiResponse<WorkspaceChannel[]>;
export type ChannelMutationResponse = ApiResponse<WorkspaceChannel>;
export type ChannelDeleteResponse = ApiResponse<{ channelId: number }>;

type ChannelMockScenario = 'SUCCESS' | 'EMPTY' | 'SERVER_ERROR';

let mockScenario: ChannelMockScenario = 'SUCCESS';
let nextChannelId = 31;
const RATE_PATTERN = /^\d+(\.\d{1,6})?$/;

// 생성·수정 결과가 다음 조회에도 유지되도록 제작팀별 Mock 저장소를 관리합니다.
let mockChannelsByWorkspace: Record<number, WorkspaceChannel[]> = {
    1: [
        {
            channelId: 1,
            name: 'YMS 메인 채널',
            youtubeChannelId: 'UCYMSMAIN001',
            youtubeChannelUrl: 'https://youtube.com/@yms-main',
            description: '롱폼 콘텐츠를 운영하는 메인 채널입니다.',
            integrationStatus: 'CONNECTED',
            active: true,
            longFormRate: '3.00',
            shortFormRate: '0.20'
        },
        {
            channelId: 2,
            name: 'YMS Shorts',
            youtubeChannelId: null,
            youtubeChannelUrl: 'https://youtube.com/@yms-shorts',
            description: '쇼츠 실험 콘텐츠를 수동으로 관리합니다.',
            integrationStatus: 'MANUAL',
            active: true,
            longFormRate: '2.50',
            shortFormRate: '0.18'
        },
        {
            channelId: 3,
            name: '테크 리뷰',
            youtubeChannelId: 'UCTECHERROR003',
            youtubeChannelUrl: 'https://youtube.com/@yms-tech',
            description: '최근 동기화 오류를 확인할 수 있는 테스트 채널입니다.',
            integrationStatus: 'ERROR',
            active: true,
            longFormRate: '4.00',
            shortFormRate: '0.25'
        },
        {
            channelId: 4,
            name: '지난 시즌 채널',
            youtubeChannelId: null,
            youtubeChannelUrl: null,
            description: '기존 프로젝트 이력에만 남아 있는 비활성 채널입니다.',
            integrationStatus: 'MANUAL',
            active: false,
            longFormRate: '0',
            shortFormRate: '0'
        }
    ],
    2: [
        {
            channelId: 21,
            name: 'Sample Creator',
            youtubeChannelId: null,
            youtubeChannelUrl: null,
            description: null,
            integrationStatus: 'MANUAL',
            active: true,
            longFormRate: '3.00',
            shortFormRate: '0.20'
        }
    ]
};

// Project 등 업무 데이터 연결을 흉내 내어 Channel 삭제 가능 여부를 서버 Mock에서 판정합니다.
const mockUsedChannelIdsByWorkspace: Record<number, ReadonlySet<number>> = {
    1: new Set([1, 2, 3]),
    2: new Set([21])
};

/**
 * Channel Mock의 정상·빈 목록·서버 오류 시나리오를 변경합니다.
 * 화면의 로딩과 오류 상태를 수동 검증할 때 사용하며 저장된 항목은 초기화하지 않습니다.
 */
export function setChannelsMockScenario(scenario: ChannelMockScenario) {
    mockScenario = scenario;
}

/** 실제 API 통신과 유사한 짧은 지연을 조회와 변경에 공통 적용합니다. */
async function waitForMockResponse() {
    await new Promise(resolve => setTimeout(resolve, 300));
}

/** 선택 입력값의 공백을 제거하고 빈 문자열을 API용 null로 통일합니다. */
function normalizeOptionalValue(value?: string | null) {
    const normalizedValue = value?.trim() ?? '';
    return normalizedValue || null;
}

/**
 * Channel 생성·수정 입력을 공통 규칙으로 검증합니다.
 * 필드별 오류를 반환하여 관리 모달의 각 입력과 직접 연결합니다.
 */
function validateChannelRequest(request: SaveChannelRequest) {
    const errors = [];
    const name = request.name.trim();
    const youtubeChannelId = normalizeOptionalValue(request.youtubeChannelId);
    const youtubeChannelUrl = normalizeOptionalValue(request.youtubeChannelUrl);
    const description = normalizeOptionalValue(request.description);
    const longFormRate = request.longFormRate?.trim() || '0';
    const shortFormRate = request.shortFormRate?.trim() || '0';

    if (!name) {
        errors.push({
            field: 'name',
            value: request.name,
            reason: '채널 이름을 입력해 주세요.'
        });
    } else if (name.length > 150) {
        errors.push({
            field: 'name',
            value: request.name,
            reason: '채널 이름은 150자 이하로 입력해 주세요.'
        });
    }

    if (youtubeChannelId && youtubeChannelId.length > 64) {
        errors.push({
            field: 'youtubeChannelId',
            value: request.youtubeChannelId ?? null,
            reason: 'YouTube Channel ID는 64자 이하로 입력해 주세요.'
        });
    }

    if (youtubeChannelUrl && youtubeChannelUrl.length > 255) {
        errors.push({
            field: 'youtubeChannelUrl',
            value: request.youtubeChannelUrl ?? null,
            reason: 'YouTube Channel URL은 255자 이하로 입력해 주세요.'
        });
    }

    if (description && description.length > 500) {
        errors.push({
            field: 'description',
            value: request.description ?? null,
            reason: '설명은 500자 이하로 입력해 주세요.'
        });
    }

    // 단가는 계산 정밀도를 보존하도록 number가 아닌 최대 소수점 6자리 문자열로 검증합니다.
    for (const [field, value] of [
        ['longFormRate', longFormRate],
        ['shortFormRate', shortFormRate]
    ] as const) {
        if (!RATE_PATTERN.test(value)) {
            errors.push({
                field,
                value,
                reason: '단가는 0 이상의 숫자로 입력해 주세요. 소수점 여섯째 자리까지 허용됩니다.'
            });
        }
    }

    return {
        errors,
        normalized: {
            name,
            youtubeChannelId,
            youtubeChannelUrl,
            description,
            longFormRate,
            shortFormRate
        }
    };
}

/** Project Mock이 생성 시점 Channel 단가를 조회할 수 있도록 복사본을 동기적으로 제공합니다. */
export function findWorkspaceChannel(
    workspaceId: number,
    channelId: number
): WorkspaceChannel | null {
    const channel = (mockChannelsByWorkspace[workspaceId] ?? []).find(
        item => item.channelId === channelId
    );
    return channel ? { ...channel } : null;
}

/** 현재 제작팀의 Channel을 활성 상태와 검색어 기준으로 조회합니다. */
export async function getWorkspaceChannels(
    workspaceId: number,
    request: ChannelListRequest = {}
): Promise<ChannelListResponse> {
    // TODO: GET /api/workspaces/{workspaceId}/channels 호출로 교체합니다.
    await waitForMockResponse();

    if (mockScenario === 'SERVER_ERROR') {
        return {
            success: false,
            errorCode: 'INTERNAL_SERVER_ERROR',
            message: '채널 목록을 불러오지 못했습니다.',
            errors: null
        };
    }

    if (mockScenario === 'EMPTY') {
        return { success: true, data: [] };
    }

    const activeOnly = request.activeOnly ?? true;
    const keyword = request.keyword?.trim().toLocaleLowerCase() ?? '';
    const channels = (mockChannelsByWorkspace[workspaceId] ?? [])
        .filter(channel => !activeOnly || channel.active)
        .filter(channel => !keyword || channel.name.toLocaleLowerCase().includes(keyword))
        .map(channel => ({ ...channel }));

    return { success: true, data: channels };
}

/**
 * 이름만으로도 새 Channel을 수동 등록합니다.
 * YouTube ID나 URL을 입력해도 실제 연동 전이므로 MANUAL 상태를 유지합니다.
 */
export async function createWorkspaceChannel(
    workspaceId: number,
    request: SaveChannelRequest
): Promise<ChannelMutationResponse> {
    // TODO: POST /api/workspaces/{workspaceId}/channels 호출로 교체합니다.
    await waitForMockResponse();

    if (mockScenario === 'SERVER_ERROR') {
        return {
            success: false,
            errorCode: 'INTERNAL_SERVER_ERROR',
            message: '채널을 등록하지 못했습니다.',
            errors: null
        };
    }

    const { errors, normalized } = validateChannelRequest(request);

    if (errors.length > 0) {
        return {
            success: false,
            errorCode: 'INVALID_INPUT_VALUE',
            message: '입력값을 다시 확인해 주세요.',
            errors
        };
    }

    const channel: WorkspaceChannel = {
        channelId: nextChannelId,
        ...normalized,
        integrationStatus: 'MANUAL',
        active: true
    };

    nextChannelId += 1;
    mockChannelsByWorkspace = {
        ...mockChannelsByWorkspace,
        [workspaceId]: [
            ...(mockChannelsByWorkspace[workspaceId] ?? []),
            channel
        ]
    };

    return {
        success: true,
        message: '채널을 등록했습니다.',
        data: { ...channel }
    };
}

/**
 * Channel 정보와 활성 상태를 함께 변경합니다.
 * 연동 상태는 일반 수정 폼의 입력 대상이 아니므로 기존 값을 그대로 보존합니다.
 */
export async function updateWorkspaceChannel(
    workspaceId: number,
    channelId: number,
    request: UpdateChannelRequest
): Promise<ChannelMutationResponse> {
    // TODO: PATCH /api/workspaces/{workspaceId}/channels/{channelId} 호출로 교체합니다.
    await waitForMockResponse();

    if (mockScenario === 'SERVER_ERROR') {
        return {
            success: false,
            errorCode: 'INTERNAL_SERVER_ERROR',
            message: '채널 정보를 변경하지 못했습니다.',
            errors: null
        };
    }

    const workspaceChannels = mockChannelsByWorkspace[workspaceId] ?? [];
    const currentChannel = workspaceChannels.find(
        channel => channel.channelId === channelId
    );

    if (!currentChannel) {
        return {
            success: false,
            errorCode: 'CHANNEL_NOT_FOUND',
            message: '현재 제작팀에서 채널을 찾을 수 없습니다.',
            errors: null
        };
    }

    const { errors, normalized } = validateChannelRequest(request);

    if (errors.length > 0) {
        return {
            success: false,
            errorCode: 'INVALID_INPUT_VALUE',
            message: '입력값을 다시 확인해 주세요.',
            errors
        };
    }

    const updatedChannel: WorkspaceChannel = {
        ...currentChannel,
        ...normalized,
        active: request.active
    };

    mockChannelsByWorkspace = {
        ...mockChannelsByWorkspace,
        [workspaceId]: workspaceChannels.map(channel =>
            channel.channelId === channelId ? updatedChannel : channel
        )
    };

    return {
        success: true,
        message: updatedChannel.active
            ? '채널 정보를 저장했습니다.'
            : '채널을 비활성화했습니다.',
        data: { ...updatedChannel }
    };
}

/**
 * Project 등 업무 데이터에서 참조하지 않는 Channel만 물리 삭제합니다.
 * 화면 상태가 아니라 삭제 요청 시점의 서버 Mock 연결 여부를 최종 기준으로 사용합니다.
 */
export async function deleteWorkspaceChannel(
    workspaceId: number,
    channelId: number
): Promise<ChannelDeleteResponse> {
    // TODO: DELETE /api/workspaces/{workspaceId}/channels/{channelId} 호출로 교체합니다.
    await waitForMockResponse();

    if (mockScenario === 'SERVER_ERROR') {
        return {
            success: false,
            errorCode: 'INTERNAL_SERVER_ERROR',
            message: '채널을 삭제하지 못했습니다.',
            errors: null
        };
    }

    const workspaceChannels = mockChannelsByWorkspace[workspaceId] ?? [];
    const targetChannel = workspaceChannels.find(
        channel => channel.channelId === channelId
    );

    if (!targetChannel) {
        return {
            success: false,
            errorCode: 'CHANNEL_NOT_FOUND',
            message: '현재 제작팀에서 채널을 찾을 수 없습니다.',
            errors: null
        };
    }

    const isUsedByProject = readProjects().some(project => (
        project.workspaceId === workspaceId && project.channelId === channelId
    ));
    if (isUsedByProject || mockUsedChannelIdsByWorkspace[workspaceId]?.has(channelId)) {
        return {
            success: false,
            errorCode: 'CHANNEL_IN_USE',
            message: '기존 프로젝트나 업무 데이터에서 사용 중인 채널이라 관리에서 제거할 수 없습니다. 더 이상 새 프로젝트에서 사용하지 않으려면 비활성화해 주세요.',
            errors: null
        };
    }

    mockChannelsByWorkspace = {
        ...mockChannelsByWorkspace,
        [workspaceId]: workspaceChannels.filter(
            channel => channel.channelId !== channelId
        )
    };

    return {
        success: true,
        message: 'YMS 관리 목록에서 채널을 제거했습니다. YouTube 채널에는 영향을 주지 않습니다.',
        data: { channelId }
    };
}

// 연결 상태 문구가 필요한 화면에서 빠짐없이 처리하도록 타입을 다시 내보냅니다.
export type { ChannelIntegrationStatus };
