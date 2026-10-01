import { useEffect, useMemo, useState } from 'react';

import type { NotificationItem } from '../../api/notifications/notifications';
import { useNotifications } from '../../hooks/useNotifications';
import NotificationList from './NotificationList';

import './NotificationDrawer.css';

type NotificationDrawerProps = {
    onClose: () => void;
};

type NotificationFilter = 'ALL' | 'UNREAD';

/**
 * 헤더에서 열리는 공통 알림 Drawer를 렌더링합니다.
 * 전체와 읽지 않음 필터를 제공하고 공통 Context의 읽음 기능을 호출합니다.
 * 관련 상세 라우트가 추가되면 항목 선택 처리에 대상별 이동만 연결하면 됩니다.
 */
function NotificationDrawer({ onClose }: NotificationDrawerProps) {
    const {
        notifications,
        unreadCount,
        isLoading,
        isUpdating,
        errorMessage,
        readNotification,
        readAllNotifications
    } = useNotifications();
    const [filter, setFilter] = useState<NotificationFilter>('ALL');

    // 키보드 사용자도 Drawer를 즉시 닫을 수 있도록 Escape 입력을 감지합니다.
    useEffect(() => {
        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                onClose();
            }
        };

        window.addEventListener('keydown', handleKeyDown);

        return () => {
            window.removeEventListener('keydown', handleKeyDown);
        };
    }, [onClose]);

    const visibleNotifications = useMemo(
        () => filter === 'UNREAD'
            ? notifications.filter(notification => !notification.read)
            : notifications,
        [filter, notifications]
    );

    /**
     * 선택한 미확인 알림을 읽음 상태로 변경합니다.
     * 현재 저장소에는 대상 상세 라우트가 없어 읽음 처리까지만 수행합니다.
     * 향후 projectId 등의 대상 ID를 사용한 navigate 호출을 이 지점에 연결합니다.
     */
    const handleNotificationSelect = async (notification: NotificationItem) => {
        if (!notification.read) {
            await readNotification(notification.notificationId);
        }

        // TODO: 프로젝트·메신저·초대·정산 라우트 구현 후 대상별 화면 이동을 연결합니다.
    };

    return (
        <>
            <button
                type="button"
                className="notification-drawer__backdrop"
                onClick={onClose}
                aria-label="알림 창 닫기"
            />

            <aside
                className="notification-drawer"
                role="dialog"
                aria-modal="true"
                aria-labelledby="notification-drawer-title"
            >
                <header className="notification-drawer__header">
                    <div>
                        <h2 id="notification-drawer-title">
                            알림
                        </h2>
                        <p>읽지 않은 알림 {unreadCount}개</p>
                    </div>

                    <button
                        type="button"
                        className="notification-drawer__close"
                        onClick={onClose}
                        aria-label="알림 창 닫기"
                    >
                        ×
                    </button>
                </header>

                <div className="notification-drawer__toolbar">
                    <div className="notification-drawer__filters" aria-label="알림 필터">
                        <button
                            type="button"
                            className={filter === 'ALL'
                                ? 'notification-drawer__filter notification-drawer__filter--active'
                                : 'notification-drawer__filter'
                            }
                            onClick={() => setFilter('ALL')}
                            aria-pressed={filter === 'ALL'}
                        >
                            전체
                        </button>

                        <button
                            type="button"
                            className={filter === 'UNREAD'
                                ? 'notification-drawer__filter notification-drawer__filter--active'
                                : 'notification-drawer__filter'
                            }
                            onClick={() => setFilter('UNREAD')}
                            aria-pressed={filter === 'UNREAD'}
                        >
                            읽지 않음
                        </button>
                    </div>

                    <button
                        type="button"
                        className="notification-drawer__read-all"
                        disabled={unreadCount === 0 || isUpdating}
                        onClick={() => readAllNotifications()}
                    >
                        모두 읽음
                    </button>
                </div>

                <div className="notification-drawer__content">
                    <NotificationList
                        notifications={visibleNotifications}
                        isLoading={isLoading}
                        isUpdating={isUpdating}
                        errorMessage={errorMessage}
                        emptyMessage={filter === 'UNREAD'
                            ? '읽지 않은 알림이 없습니다.'
                            : '알림이 없습니다.'
                        }
                        onNotificationSelect={handleNotificationSelect}
                    />
                </div>
            </aside>
        </>
    );
}

export default NotificationDrawer;
