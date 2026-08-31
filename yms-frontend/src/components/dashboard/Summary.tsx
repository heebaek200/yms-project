
import { useEffect, useState } from 'react';
import { getDashboardSummary, type DashboardSummaryResponse } from '../../api/dashboard/summary';

function DashboardSummary() {

    const [isLoading, setIsLoading] = useState(true);       // 초기 호출 동작 중 로딩
    const [mockData, setMockData] = useState<DashboardSummaryResponse | null>(null);

    useEffect(() => {
        const loadDashboardSummary = async () => {
            try {
                const data = await getDashboardSummary();

                setMockData(data);
            } catch (error) {
                console.error(error);

                // TODO 에러 처리
            } finally {
                setIsLoading(false);
            }
        };

        loadDashboardSummary();
    });

    if (isLoading) {
        return (
            <main className="setup-page">
                <p>정보를 불러오는 중...</p>
            </main>
        );
    }

    return (
        <pre style={{ background: '#f4f4f4', padding: '16px', borderRadius: '4px' }}>
            { JSON.stringify(mockData, null, 2) }
        </pre>
    );
}

export default DashboardSummary;