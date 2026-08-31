// Notifications Mock API


// Mock 시나리오
type MockScenario =
    | 'SUCCESS'
    | 'EMPTY'
    | 'INVALID_LIMIT'
    | 'UNAUTHORIZED'
    | 'SERVER_ERROR';

let mockScenario: MockScenario = 'SUCCESS';
//let mockScenario: MockScenario = 'EMPTY';


// 테스트용 Mock 시나리오 변경
export function setNotificationsMockScenario(
    scenario: MockScenario
) {
    mockScenario = scenario;
}


// 알림 유형
export type NotificationType =
    | 'TASK_UPDATE'
    | 'NEW_CHAT';

// 알림 데이터
export type NotificationItem = {
    notificationId: number;
    notificationType: NotificationType;
    projectId: number | null;
    projectTitle: string | null;
    senderName: string | null;
    messageSummary: string;
    timestamp: string;
    read: boolean;
};

// GET 요청 Query Parameter
export type NotificationsRequest = {
    unreadOnly?: boolean;
    limit?: number;
};

// 성공 응답 데이터
export type NotificationsData = {
    unreadCount: number;
    notifications: NotificationItem[];
};

// 성공 응답
export type NotificationsSuccessResponse = {
    success: true;
    data: NotificationsData;
};

// 실패 응답
export type NotificationsFailureResponse = {
    success: false;
    errorCode: string;
    message: string;
};

// 최종 응답 타입
export type NotificationsResponse =
    | NotificationsSuccessResponse
    | NotificationsFailureResponse;


// GET /api/notifications
export async function getNotifications(
    request: NotificationsRequest = {}
): Promise<NotificationsResponse> {

    // TODO:
    // 백엔드 완성 후
    // GET /api/notifications
    // axios 호출로 교체

    await new Promise(resolve =>
        setTimeout(resolve, 500)
    );


    // 조회 개수 오류
    if (mockScenario === 'INVALID_LIMIT') {
        return {
            success: false,
            errorCode: 'INVALID_INPUT_VALUE',
            message:
                '알림 조회 개수는 1 이상 100 이하로 입력해 주세요.'
        };
    }


    // 인증 만료
    if (mockScenario === 'UNAUTHORIZED') {
        return {
            success: false,
            errorCode: 'UNAUTHORIZED',
            message:
                '로그인 정보가 만료되었습니다. 다시 로그인해 주세요.'
        };
    }


    // 서버 오류
    if (mockScenario === 'SERVER_ERROR') {
        return {
            success: false,
            errorCode: 'INTERNAL_SERVER_ERROR',
            message:
                '알림 정보를 불러오는 중 오류가 발생했습니다.'
        };
    }


    // 조회 결과 없음
    if (mockScenario === 'EMPTY') {
        return {
            success: true,
            data: {
                unreadCount: 0,
                notifications: []
            }
        };
    }


    // 정상 Mock 데이터
    const notifications: NotificationItem[] = [
        {
            notificationId: 501,
            notificationType: 'TASK_UPDATE',
            projectId: 12,
            projectTitle: '8월 여름 휴가 브이로그',
            senderName: '김편집',
            messageSummary:
                '가편집 작업 상태가 [검수요청]으로 변경되었습니다.',
            timestamp: '2026-09-01T07:05:00.123Z',
            read: false
        },
        {
            notificationId: 502,
            notificationType: 'NEW_CHAT',
            projectId: 12,
            projectTitle: '8월 여름 휴가 브이로그',
            senderName: '박편집',
            messageSummary:
                '가편집본 업로드했습니다! 피드백 주세요.',
            timestamp: '2026-09-01T07:10:10.456Z',
            read: false
        },
        {
            notificationId: 503,
            notificationType: 'TASK_UPDATE',
            projectId: 13,
            projectTitle: '신제품 카메라 리뷰',
            senderName: '이디자',
            messageSummary:
                '섬네일 작업이 완료 상태로 변경되었습니다.',
            timestamp: '2026-08-31T16:20:00.000Z',
            read: true
        }
    ];


    const unreadOnly =
        request.unreadOnly ?? true;

    const limit =
        request.limit ?? 20;


    const filteredNotifications =
        notifications
            .filter(notification =>
                unreadOnly
                    ? !notification.read
                    : true
            )
            .slice(0, limit);


    return {
        success: true,
        data: {
            unreadCount:
                notifications.filter(
                    notification => !notification.read
                ).length,

            notifications:
                filteredNotifications
        }
    };
}