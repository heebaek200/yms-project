import { useEffect, useState } from "react";
import { getDashboardSchedule, type DashboardScheduleResponse } from "../../api/dashboard/schedule";
import SchedulerCalendar from './SchedulerCalendar';


function DashboardSchedule() {

    const [isLoading, setIsLoading] = useState(true);       // 초기 호출 동작 중 로딩
    const [mockData, setMockData] = useState<DashboardScheduleResponse | null>(null);

    useEffect(() => {
        const loadDashboardSchedule = async () => {
            try {
                const data = await getDashboardSchedule({
                    startDate: '2026-08-01',
                    endDate: '2026-08-31'
                });

                setMockData(data);
            } catch (error) {
                console.error(error);

                // TODO 에러 처리
            } finally {
                setIsLoading(false);
            }
        };

        loadDashboardSchedule();
    }, []);

    if (isLoading) {
        return (
            <p className="dashboard-loading">
                정보를 불러오는 중...
            </p>
        );
    }

    return (
        <>
            <SchedulerCalendar />
            <pre style={{ background: '#f4f4f4', padding: '16px', borderRadius: '4px' }}>
                {JSON.stringify(mockData, null, 2)}
            </pre>
        </>
    );
}

export default DashboardSchedule;