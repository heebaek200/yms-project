import { useMemo } from 'react';
import { useNavigate } from 'react-router';

import type { NotificationItem } from '../../api/notifications/notifications';
import { useNotifications } from '../../hooks/useNotifications';
import NotificationList from '../common/NotificationList';

import './Notifications.css';

type DashboardNotificationsProps = {
    workspaceId: number;
};

const DASHBOARD_NOTIFICATION_LIMIT = 5;

/**
 * 현재 Workspace의 최근 미확인 알림을 대시보드 피드로 표시합니다.
 * 공통 Provider 목록에서 필요한 항목만 파생하여 헤더와 읽음 상태를 공유합니다.
 * 항목을 선택하면 읽음 처리하며 상세 화면 이동은 관련 라우트 추가 후 연결합니다.
 */
function DashboardNotifications({ workspaceId }: DashboardNotificationsProps) {
    const navigate = useNavigate();

    const {
        notifications,
        isLoading,
        updatingNotificationIds,
        isReadingAll,
        errorMessage,
        readNotification
    } = useNotifications();

    const workspaceUnreadNotifications = useMemo(
        () => notifications
            .filter(notification =>
                notification.workspaceId === workspaceId
                && !notification.read
            ),
        [notifications, workspaceId]
    );

    // 대시보드는 최근 항목만 보여주되 요약 개수는 Workspace의 전체 미확인 수를 유지합니다.
    const visibleNotifications = workspaceUnreadNotifications.slice(
        0,
        DASHBOARD_NOTIFICATION_LIMIT
    );

    /**
     * 대시보드에서 선택한 알림을 읽음 처리합니다.
     * 성공한 항목은 공통 상태가 갱신되면서 미확인 피드에서 자동으로 제거됩니다.
     * 프로젝트 알림만 상세로 이동하고 정산·초대 알림은 이번 범위에서 읽음 처리만 합니다.
     */
    const handleNotificationSelect = async (notification: NotificationItem) => {
        const succeeded = await readNotification(notification.notificationId);

        // 읽음 처리 실패 시 현재 화면과 알림을 유지하여 사용자가 실패를 확인할 수 있게 합니다.
        if (succeeded && notification.projectId !== null) {
            const target = notification.notificationType === 'TASK_UPDATE' && notification.taskId
                ? `/projects/${notification.projectId}/tasks?taskId=${notification.taskId}`
                : `/projects/${notification.projectId}`;
            navigate(target);
        }
    };

    return (
        <div className="dashboard-notification-feed">
            {!isLoading && !errorMessage && (
                <p className="dashboard-notification-feed__summary">
                    현재 제작팀의 읽지 않은 알림이{' '}
                    <strong>{workspaceUnreadNotifications.length}개</strong> 있습니다.
                </p>
            )}

            <NotificationList
                notifications={visibleNotifications}
                isLoading={isLoading}
                updatingNotificationIds={updatingNotificationIds}
                isReadingAll={isReadingAll}
                errorMessage={errorMessage}
                emptyMessage="새로운 알림이 없습니다."
                onNotificationSelect={handleNotificationSelect}
            />
        </div>
    );
}

export default DashboardNotifications;
