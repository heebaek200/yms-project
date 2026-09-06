import { useEffect, useState } from "react";
import { getDashboardSchedule, type DashboardScheduleResponse } from "../../api/dashboard/schedule";
import SchedulerCalendar, { type SchedulerDateRange } from './SchedulerCalendar';
import { toFullCalendarEvents } from './schedulerCalendarAdapter';

function DashboardSchedule() {

    const [isLoading, setIsLoading] = useState(false);       // 초기 호출 동작 중 로딩
    const [mockData, setMockData] = useState<DashboardScheduleResponse | null>(null);

    const [dateRange, setDateRange] =
        useState<SchedulerDateRange | null>(
            null
        );

    useEffect(() => {
        const loadDashboardSchedule = async () => {
            try {
                if (!dateRange) {
                    return;
                }

                setIsLoading(true);

                const data =
                    await getDashboardSchedule({
                        startDate:
                            dateRange.startDate,

                        endDate:
                            dateRange.endDate
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
    }, [dateRange]);

    const handleRangeChange = (
        range: SchedulerDateRange
    ) => {
        setDateRange(prev => {

            if (
                prev?.startDate === range.startDate
                && prev?.endDate === range.endDate
            ) {
                return prev;
            }

            return range;
        });
    };

    const calendarEvents = mockData?.success
        ? toFullCalendarEvents(
            mockData.data.calendarEvents
        )
        : [];

    return (
        <>
            <SchedulerCalendar
                events={calendarEvents} onRangeChange={handleRangeChange}
            />

            {isLoading && (
                <p className="dashboard-loading">
                    일정을 불러오는 중...
                </p>
            )}

            <pre>
                {JSON.stringify(mockData, null, 2)}
            </pre>
        </>
    );
}

export default DashboardSchedule;