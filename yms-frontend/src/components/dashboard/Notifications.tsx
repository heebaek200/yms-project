import { useEffect, useState } from "react";
import { getNotifications, type NotificationsResponse } from "../../api/notifications/notifications";


function DashboardNotifications() {
    const [isLoading, setIsLoading] = useState(true);       // 초기 호출 동작 중 로딩
    const [mockData, setMockData] = useState<NotificationsResponse | null>(null);

    useEffect(() => {
        const loadNotifications = async () => {
            try {
                const data = await getNotifications();

                setMockData(data);
            } catch (error) {
                console.error(error);

                // TODO 에러 처리
            } finally {
                setIsLoading(false);
            }
        };

        loadNotifications();
    }, []);

    if (isLoading) {
        return (
            <p className="dashboard-loading">
                정보를 불러오는 중...
            </p>
        );
    }

    return (
        <pre style={{ background: '#f4f4f4', padding: '16px', borderRadius: '4px' }}>
            {JSON.stringify(mockData, null, 2)}
        </pre>
    );
}

export default DashboardNotifications;