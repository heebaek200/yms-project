import { createContext } from 'react';

import type { NotificationItem } from '../api/notifications/notifications';

export type NotificationContextValue = {
    notifications: NotificationItem[];
    unreadCount: number;
    isLoading: boolean;
    isUpdating: boolean;
    errorMessage: string | null;
    refreshNotifications: () => Promise<void>;
    readNotification: (notificationId: number) => Promise<boolean>;
    readAllNotifications: (workspaceId?: number) => Promise<boolean>;
};

// Provider와 Hook을 분리하여 Fast Refresh가 컴포넌트만 안전하게 갱신되도록 합니다.
export const NotificationContext =
    createContext<NotificationContextValue | null>(null);
