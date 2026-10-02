// Notifications Mock API

import type {
    ApiFailureResponse,
    ApiResponse,
    ApiSuccessResponse
} from '../types';

type MockScenario =
    | 'SUCCESS'
    | 'EMPTY'
    | 'INVALID_LIMIT'
    | 'UNAUTHORIZED'
    | 'SERVER_ERROR';

let mockScenario: MockScenario = 'SUCCESS';

// REST 조회와 향후 STOMP 이벤트에서 공통으로 사용할 알림 유형입니다.
export type NotificationType =
    | 'TASK_UPDATE'
    | 'NEW_CHAT'
    | 'WORKSPACE_INVITATION'
    | 'SETTLEMENT_UPDATE';

// 관련 화면이 없는 유형도 같은 구조를 사용하도록 각 대상 ID를 nullable로 둡니다.
export type NotificationItem = {
    notificationId: number;
    notificationType: NotificationType;
    workspaceId: number | null;
    projectId: number | null;
    projectTitle: string | null;
    settlementId: number | null;
    workspaceInvitationId: number | null;
    senderName: string | null;
    messageSummary: string;
    timestamp: string;
    read: boolean;
};

export type NotificationsRequest = {
    workspaceId?: number;
    unreadOnly?: boolean;
    limit?: number;
};

export type NotificationsData = {
    unreadCount: number;
    notifications: NotificationItem[];
};

export type NotificationsSuccessResponse =
    ApiSuccessResponse<NotificationsData>;

export type NotificationReadSuccessResponse = {
    success: true;
};

export type NotificationsFailureResponse = ApiFailureResponse;

export type NotificationsResponse = ApiResponse<NotificationsData>;

export type NotificationReadResponse =
    | NotificationReadSuccessResponse
    | NotificationsFailureResponse;

// 읽음 API 호출 뒤에도 변경 상태가 유지되도록 Mock 목록을 모듈 범위에서 관리합니다.
let mockNotifications: NotificationItem[] = [
    {
        notificationId: 501,
        notificationType: 'TASK_UPDATE',
        workspaceId: 1,
        projectId: 12,
        projectTitle: '8월 여름 휴가 브이로그',
        settlementId: null,
        workspaceInvitationId: null,
        senderName: '김편집',
        messageSummary: '가편집 작업 상태가 [검수요청]으로 변경되었습니다.',
        timestamp: '2026-09-29T09:05:00+09:00',
        read: false
    },
    {
        notificationId: 502,
        notificationType: 'NEW_CHAT',
        workspaceId: 1,
        projectId: 12,
        projectTitle: '8월 여름 휴가 브이로그',
        settlementId: null,
        workspaceInvitationId: null,
        senderName: '박편집',
        messageSummary: '가편집본 업로드했습니다! 피드백 주세요.',
        timestamp: '2026-09-29T08:10:10+09:00',
        read: false
    },
    {
        notificationId: 503,
        notificationType: 'SETTLEMENT_UPDATE',
        workspaceId: 1,
        projectId: null,
        projectTitle: null,
        settlementId: 41,
        workspaceInvitationId: null,
        senderName: 'YMS 메인 채널',
        messageSummary: '9월 정산이 지급 완료 상태로 변경되었습니다.',
        timestamp: '2026-09-28T17:20:00+09:00',
        read: true
    },
    {
        notificationId: 504,
        notificationType: 'WORKSPACE_INVITATION',
        workspaceId: null,
        projectId: null,
        projectTitle: null,
        settlementId: null,
        workspaceInvitationId: 71,
        senderName: '최크리에이터',
        messageSummary: '새 제작팀에 초대했습니다.',
        timestamp: '2026-09-28T14:30:00+09:00',
        read: false
    },
    {
        notificationId: 505,
        notificationType: 'TASK_UPDATE',
        workspaceId: 2,
        projectId: 32,
        projectTitle: '두 번째 제작팀 마감 작업',
        settlementId: null,
        workspaceInvitationId: null,
        senderName: '이디자',
        messageSummary: '썸네일 작업 담당자로 배정되었습니다.',
        timestamp: '2026-09-27T11:00:00+09:00',
        read: false
    }
];

/**
 * 실제 통신과 비슷한 지연을 만들어 화면의 로딩 상태를 확인합니다.
 * 모든 Mock API가 같은 지연 시간을 사용하도록 처리합니다.
 * 백엔드 연결 후에는 axios 요청으로 대체합니다.
 */
async function waitForMockResponse() {
    await new Promise(resolve => setTimeout(resolve, 500));
}

/**
 * 현재 Mock 시나리오에 해당하는 공통 실패 응답을 반환합니다.
 * 조회와 읽음 API가 인증·서버 오류 메시지를 동일하게 사용합니다.
 * 성공 시에는 null을 반환하여 각 API의 정상 처리를 계속합니다.
 */
function getScenarioFailure(): NotificationsFailureResponse | null {
    if (mockScenario === 'UNAUTHORIZED') {
        return {
            success: false,
            errorCode: 'UNAUTHORIZED_SESSION',
            message: '로그인 정보가 만료되었습니다. 다시 로그인해 주세요.',
            errors: null
        };
    }

    if (mockScenario === 'SERVER_ERROR') {
        return {
            success: false,
            errorCode: 'INTERNAL_SERVER_ERROR',
            message: '알림 정보를 처리하는 중 오류가 발생했습니다.',
            errors: null
        };
    }

    return null;
}

/**
 * 테스트할 알림 API 응답 시나리오를 변경합니다.
 * 로딩·빈 목록·오류 상태를 백엔드 없이 확인할 때 사용합니다.
 * 시나리오 변경 자체는 기존 알림의 읽음 상태를 초기화하지 않습니다.
 */
export function setNotificationsMockScenario(scenario: MockScenario) {
    mockScenario = scenario;
}

/**
 * 사용자의 알림을 Workspace, 읽음 여부와 조회 개수 기준으로 조회합니다.
 * unreadCount는 unreadOnly 적용 전의 동일 Workspace 목록에서 계산합니다.
 * 반환 배열은 가장 최근에 발생한 알림부터 정렬합니다.
 */
export async function getNotifications(
    request: NotificationsRequest = {}
): Promise<NotificationsResponse> {
    // TODO: 백엔드 완성 후 GET /api/notifications axios 호출로 교체합니다.
    await waitForMockResponse();

    const limit = request.limit ?? 20;

    // 명세 범위를 벗어난 값은 Mock 시나리오와 관계없이 입력 오류로 처리합니다.
    if (mockScenario === 'INVALID_LIMIT' || limit < 1 || limit > 100) {
        return {
            success: false,
            errorCode: 'INVALID_INPUT_VALUE',
            message: '알림 조회 개수는 1 이상 100 이하로 입력해 주세요.',
            errors: null
        };
    }

    const scenarioFailure = getScenarioFailure();

    if (scenarioFailure) {
        return scenarioFailure;
    }

    if (mockScenario === 'EMPTY') {
        return {
            success: true,
            data: {
                unreadCount: 0,
                notifications: []
            }
        };
    }

    const unreadOnly = request.unreadOnly ?? true;
    const workspaceNotifications = mockNotifications.filter(notification =>
        request.workspaceId === undefined
        || notification.workspaceId === request.workspaceId
    );

    // 읽지 않은 수는 화면 필터와 무관하게 전체 미확인 수를 표시하도록 계산합니다.
    const unreadCount = workspaceNotifications.filter(
        notification => !notification.read
    ).length;
    const notifications = workspaceNotifications
        .filter(notification => !unreadOnly || !notification.read)
        .toSorted((left, right) =>
            Date.parse(right.timestamp) - Date.parse(left.timestamp)
        )
        .slice(0, limit);

    return {
        success: true,
        data: {
            unreadCount,
            notifications
        }
    };
}

/**
 * 지정한 알림 한 건을 읽음 상태로 변경합니다.
 * 이미 읽은 알림에도 성공을 반환하는 멱등 동작으로 구성합니다.
 * 존재하지 않는 ID는 실제 API 검증을 예상해 NOT_FOUND로 구분합니다.
 */
export async function markNotificationAsRead(
    notificationId: number
): Promise<NotificationReadResponse> {
    // TODO: 백엔드 완성 후 PATCH /api/notifications/{notificationId}/read 호출로 교체합니다.
    await waitForMockResponse();

    const scenarioFailure = getScenarioFailure();

    if (scenarioFailure) {
        return scenarioFailure;
    }

    const notificationExists = mockNotifications.some(
        notification => notification.notificationId === notificationId
    );

    if (!notificationExists) {
        return {
            success: false,
            errorCode: 'NOT_FOUND',
            message: '알림을 찾을 수 없습니다.',
            errors: null
        };
    }

    // 새 배열을 만들어 Context에서도 같은 방식으로 불변 상태 갱신을 적용합니다.
    mockNotifications = mockNotifications.map(notification =>
        notification.notificationId === notificationId
            ? { ...notification, read: true }
            : notification
    );

    return { success: true };
}

/**
 * 전체 또는 특정 Workspace에 속한 모든 알림을 읽음 처리합니다.
 * workspaceId가 없으면 초대 알림을 포함한 사용자의 전체 알림이 대상입니다.
 * 이미 읽은 항목은 그대로 유지하여 불필요한 데이터 변경을 피합니다.
 */
export async function markAllNotificationsAsRead(
    workspaceId?: number
): Promise<NotificationReadResponse> {
    // TODO: 백엔드 완성 후 PATCH /api/notifications/read-all 호출로 교체합니다.
    await waitForMockResponse();

    const scenarioFailure = getScenarioFailure();

    if (scenarioFailure) {
        return scenarioFailure;
    }

    mockNotifications = mockNotifications.map(notification => {
        const isTarget = workspaceId === undefined
            || notification.workspaceId === workspaceId;

        return isTarget && !notification.read
            ? { ...notification, read: true }
            : notification;
    });

    return { success: true };
}
