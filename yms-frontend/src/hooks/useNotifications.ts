import { useContext } from 'react';

import { NotificationContext } from '../contexts/notificationContextStore';

/**
 * 공통 알림 목록과 읽음 처리 기능을 사용하는 Hook입니다.
 * 헤더와 대시보드가 같은 Provider 상태를 구독하도록 연결합니다.
 * Provider 밖에서 잘못 사용하면 즉시 원인을 알 수 있는 오류를 발생시킵니다.
 */
export function useNotifications() {
    const context = useContext(NotificationContext);

    if (!context) {
        throw new Error(
            'useNotifications는 NotificationProvider 내부에서 사용해야 합니다.'
        );
    }

    return context;
}
