import type {
    NotificationItem,
    NotificationType
} from '../../api/notifications/notifications';

import './NotificationList.css';

type NotificationListProps = {
    notifications: NotificationItem[];
    isLoading?: boolean;
    updatingNotificationIds?: ReadonlySet<number>;
    isReadingAll?: boolean;
    errorMessage?: string | null;
    emptyMessage?: string;
    onNotificationSelect: (notification: NotificationItem) => void | Promise<void>;
};

type NotificationPresentation = {
    icon: string;
    label: string;
};

const NOTIFICATION_PRESENTATION: Record<
    NotificationType,
    NotificationPresentation
> = {
    TASK_UPDATE: {
        icon: '✓',
        label: '작업 변경'
    },
    NEW_CHAT: {
        icon: '💬',
        label: '새 메시지'
    },
    WORKSPACE_INVITATION: {
        icon: '✉',
        label: '제작팀 초대'
    },
    SETTLEMENT_UPDATE: {
        icon: '₩',
        label: '정산 변경'
    }
};

const EMPTY_UPDATING_NOTIFICATION_IDS: ReadonlySet<number> = new Set();

/**
 * API의 ISO 날짜 문자열을 사용자의 로컬 시간대에 맞춰 표시합니다.
 * 최근 날짜는 월·일과 시·분만 보여 목록의 정보 밀도를 낮춥니다.
 * 파싱할 수 없는 값은 원문을 반환하여 알림 자체가 사라지지 않게 합니다.
 */
function formatNotificationTime(timestamp: string) {
    const date = new Date(timestamp);

    if (Number.isNaN(date.getTime())) {
        return timestamp;
    }

    return new Intl.DateTimeFormat('ko-KR', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    }).format(date);
}

/**
 * 대시보드와 공통 Drawer에서 재사용하는 알림 목록을 렌더링합니다.
 * 조회 상태를 로딩·오류·빈 목록으로 명확히 구분하고 유형별 표현을 적용합니다.
 * 항목 선택 동작은 상위 컴포넌트에 위임해 읽음 처리와 화면 이동을 확장할 수 있습니다.
 */
function NotificationList({
    notifications,
    isLoading = false,
    updatingNotificationIds = EMPTY_UPDATING_NOTIFICATION_IDS,
    isReadingAll = false,
    errorMessage = null,
    emptyMessage = '표시할 알림이 없습니다.',
    onNotificationSelect
}: NotificationListProps) {
    if (isLoading) {
        return (
            <p className="notification-list__state" role="status">
                알림을 불러오는 중입니다.
            </p>
        );
    }

    if (errorMessage) {
        return (
            <p className="notification-list__state notification-list__state--error" role="alert">
                {errorMessage}
            </p>
        );
    }

    if (notifications.length === 0) {
        return (
            <p className="notification-list__state">
                {emptyMessage}
            </p>
        );
    }

    return (
        <ul className="notification-list">
            {notifications.map(notification => {
                const presentation =
                    NOTIFICATION_PRESENTATION[notification.notificationType];

                return (
                    <li
                        key={notification.notificationId}
                        className={notification.read
                            ? 'notification-list__item notification-list__item--read'
                            : 'notification-list__item notification-list__item--unread'
                        }
                    >
                        <button
                            type="button"
                            className="notification-list__button"
                            disabled={
                                isReadingAll
                                || updatingNotificationIds.has(notification.notificationId)
                            }
                            onClick={() => onNotificationSelect(notification)}
                            aria-label={`${presentation.label}: ${notification.messageSummary}`}
                        >
                            <span
                                className={`notification-list__icon notification-list__icon--${notification.notificationType.toLowerCase()}`}
                                aria-hidden="true"
                            >
                                {presentation.icon}
                            </span>

                            <span className="notification-list__content">
                                <span className="notification-list__meta">
                                    <span className="notification-list__type">
                                        {presentation.label}
                                    </span>

                                    <time dateTime={notification.timestamp}>
                                        {formatNotificationTime(notification.timestamp)}
                                    </time>
                                </span>

                                {/* 프로젝트가 없는 초대·정산 알림은 발신자를 제목으로 사용합니다. */}
                                {(notification.projectTitle || notification.senderName) && (
                                    <strong className="notification-list__title">
                                        {notification.projectTitle ?? notification.senderName}
                                    </strong>
                                )}

                                <span className="notification-list__message">
                                    {notification.messageSummary}
                                </span>

                                {notification.projectTitle && notification.senderName && (
                                    <span className="notification-list__sender">
                                        {notification.senderName}
                                    </span>
                                )}
                            </span>

                            {!notification.read && (
                                <span
                                    className="notification-list__unread-dot"
                                    aria-label="읽지 않음"
                                />
                            )}
                        </button>
                    </li>
                );
            })}
        </ul>
    );
}

export default NotificationList;
