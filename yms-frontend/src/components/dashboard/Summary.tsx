
import { useEffect, useState } from 'react';
import { getDashboardSummary, type DashboardSummaryResponse } from '../../api/dashboard/summary';

type DashboardSummaryProps = {
    workspaceId: number;
};

function DashboardSummary({ workspaceId }: DashboardSummaryProps) {

    const [isLoading, setIsLoading] = useState(true);       // 초기 호출 동작 중 로딩
    const [mockData, setMockData] = useState<DashboardSummaryResponse | null>(null);

    // Header에서 Workspace를 전환하면 요약 카드도 같은 업무 범위로 다시 조회합니다.
    useEffect(() => {
        let isCurrentRequest = true;

        const loadDashboardSummary = async () => {
            try {
                setIsLoading(true);

                const data = await getDashboardSummary(workspaceId);

                // Workspace가 바뀐 뒤 도착한 이전 응답은 화면에 반영하지 않습니다.
                if (isCurrentRequest) {
                    setMockData(data);
                }
            } catch (error) {
                if (!isCurrentRequest) {
                    return;
                }

                console.error(error);

                // TODO 에러 처리
            } finally {
                if (isCurrentRequest) {
                    setIsLoading(false);
                }
            }
        };

        loadDashboardSummary();

        return () => {
            isCurrentRequest = false;
        };
    }, [workspaceId]);

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

export default DashboardSummary;
