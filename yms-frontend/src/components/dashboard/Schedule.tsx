import { useEffect, useState } from "react";
import { getDashboardSchedule, type DashboardScheduleResponse } from "../../api/dashboard/schedule";
import SchedulerCalendar, { type SchedulerDateRange, type SchedulerEventClickData } from './SchedulerCalendar';
import { toFullCalendarEvents } from './schedulerCalendarAdapter';

/**
 * 캘린더에서 선택된 작업 일정의 식별자를 전달받습니다.
 * TODO #17 프로젝트 상세 화면 연결
 * 현재 단계에서는 클릭 데이터가 정상 전달되는지만 검증하며,
 * 실제 프로젝트 상세 페이지 이동은 #17 구현 시 연결합니다.
 */
const handleEventClick = (
    event: SchedulerEventClickData
) => {
    console.log(
        '[Scheduler Event Click]',
        event
    );
};

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
                events={calendarEvents}
                onRangeChange={handleRangeChange}
                onEventClick={handleEventClick}
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