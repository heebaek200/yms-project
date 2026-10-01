import {
    useCallback,
    useEffect,
    useMemo,
    useState,
    type ReactNode
} from 'react';

import {
    getNotifications,
    markAllNotificationsAsRead,
    markNotificationAsRead,
    type NotificationItem
} from '../api/notifications/notifications';
import { NotificationContext } from './notificationContextStore';

type NotificationProviderProps = {
    children: ReactNode;
};

/**
 * 인증 화면 전역에서 사용할 알림 목록과 읽음 상태를 관리합니다.
 * 최초 조회 결과를 헤더와 대시보드가 공유하여 중복 요청을 피합니다.
 * 읽음 API가 성공하면 로컬 상태도 함께 변경해 배지와 목록을 즉시 동기화합니다.
 */
function NotificationProvider({ children }: NotificationProviderProps) {
    const [notifications, setNotifications] = useState<NotificationItem[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isUpdating, setIsUpdating] = useState(false);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);

    /**
     * 읽음 항목을 포함한 최근 알림을 다시 조회합니다.
     * 공통 Drawer의 전체 필터를 지원하기 위해 unreadOnly를 false로 지정합니다.
     * 실패하면 기존 목록 대신 명확한 오류 상태를 화면에 제공합니다.
     */
    const refreshNotifications = useCallback(async () => {
        try {
            setIsLoading(true);
            setErrorMessage(null);

            const response = await getNotifications({
                unreadOnly: false,
                limit: 100
            });

            if (!response.success) {
                setNotifications([]);
                setErrorMessage(response.message);
                return;
            }

            setNotifications(response.data.notifications);
        } catch (error) {
            console.error(error);
            setNotifications([]);
            setErrorMessage('알림 정보를 불러오지 못했습니다.');
        } finally {
            setIsLoading(false);
        }
    }, []);

    // 공통 레이아웃이 처음 표시될 때 한 번만 알림을 조회합니다.
    useEffect(() => {
        refreshNotifications();
    }, [refreshNotifications]);

    /**
     * 알림 한 건을 서버에 읽음 처리한 뒤 공유 목록을 갱신합니다.
     * 실패 시 목록은 유지하고 오류 메시지를 노출합니다.
     * 호출부는 반환값으로 관련 화면 이동 여부를 결정할 수 있습니다.
     */
    const readNotification = useCallback(async (notificationId: number) => {
        try {
            setIsUpdating(true);
            setErrorMessage(null);

            const response = await markNotificationAsRead(notificationId);

            if (!response.success) {
                setErrorMessage(response.message);
                return false;
            }

            // 두 화면이 같은 객체 변경을 감지하도록 새 배열과 새 항목을 생성합니다.
            setNotifications(currentNotifications =>
                currentNotifications.map(notification =>
                    notification.notificationId === notificationId
                        ? { ...notification, read: true }
                        : notification
                )
            );

            return true;
        } catch (error) {
            console.error(error);
            setErrorMessage('알림을 읽음 처리하지 못했습니다.');
            return false;
        } finally {
            setIsUpdating(false);
        }
    }, []);

    /**
     * 전체 또는 특정 Workspace의 미확인 알림을 한 번에 읽음 처리합니다.
     * API 범위와 같은 조건으로 로컬 항목을 변경해 응답 직후 배지를 갱신합니다.
     * 실패 시 기존 읽음 상태를 보존하고 오류 메시지를 제공합니다.
     */
    const readAllNotifications = useCallback(async (workspaceId?: number) => {
        try {
            setIsUpdating(true);
            setErrorMessage(null);

            const response = await markAllNotificationsAsRead(workspaceId);

            if (!response.success) {
                setErrorMessage(response.message);
                return false;
            }

            // workspaceId가 없으면 Workspace 초대 등 전역 알림도 함께 처리합니다.
            setNotifications(currentNotifications =>
                currentNotifications.map(notification => {
                    const isTarget = workspaceId === undefined
                        || notification.workspaceId === workspaceId;

                    return isTarget && !notification.read
                        ? { ...notification, read: true }
                        : notification;
                })
            );

            return true;
        } catch (error) {
            console.error(error);
            setErrorMessage('알림을 모두 읽음 처리하지 못했습니다.');
            return false;
        } finally {
            setIsUpdating(false);
        }
    }, []);

    // 읽지 않은 개수는 목록에서 파생하여 별도 상태와 불일치할 가능성을 없앱니다.
    const unreadCount = useMemo(
        () => notifications.filter(notification => !notification.read).length,
        [notifications]
    );

    return (
        <NotificationContext
            value={{
                notifications,
                unreadCount,
                isLoading,
                isUpdating,
                errorMessage,
                refreshNotifications,
                readNotification,
                readAllNotifications
            }}
        >
            {children}
        </NotificationContext>
    );
}

export default NotificationProvider;
