import { useEffect, useState } from "react";
import { getDashboardSchedule, type DashboardScheduleResponse, type ScheduleRoleFilter, type ScheduleStatusFilter } from '../../api/dashboard/schedule';
import SchedulerCalendar, { type SchedulerDateRange, type SchedulerEventClickData } from './SchedulerCalendar';
import { toFullCalendarEvents } from './schedulerCalendarAdapter';
import FeedbackMessage from "../common/FeedbackMessage";

type DashboardScheduleProps = {
    status: ScheduleStatusFilter;
    role: ScheduleRoleFilter;
    keyword: string;
};

function DashboardSchedule({status, role, keyword}: DashboardScheduleProps) {

    const [isLoading, setIsLoading] = useState(false);       // 초기 호출 동작 중 로딩
    const [mockData, setMockData] = useState<DashboardScheduleResponse | null>(null);

    const [dateRange, setDateRange] =
        useState<SchedulerDateRange | null>(
            null
        );

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

    useEffect(() => {
        if (!dateRange) {
            return;
        }

        let isCurrentRequest = true;

        /**
         * 현재 FullCalendar가 표시하고 있는 날짜 범위의 일정을 조회합니다.
         * 요청 도중 다른 날짜 범위로 이동한 경우 이전 응답은 반영하지 않습니다.
         * 실제 API 적용 시에는 AbortController 등을 이용한 요청 취소로 교체할 수 있습니다.
         */
        const loadDashboardSchedule = async () => {
            try {
                setIsLoading(true);

                const data =
                    await getDashboardSchedule({
                        startDate: dateRange.startDate,
                        endDate: dateRange.endDate,
                        status,
                        role,
                        keyword
                    });

                // 이미 다른 날짜 범위로 이동했다면 이전 응답은 무시합니다.
                if (!isCurrentRequest) {
                    return;
                }

                setMockData(data);

            } catch (error) {
                if (!isCurrentRequest) {
                    return;
                }

                console.error(error);

                setMockData({
                    success: false,
                    errorCode: 'UNKNOWN_ERROR',
                    message: '일정을 불러오지 못했습니다.'
                });

            } finally {
                if (isCurrentRequest) {
                    setIsLoading(false);
                }
            }
        };

        loadDashboardSchedule();

        return () => {
            isCurrentRequest = false;
        };
        
    }, [
        dateRange,
        status,
        role,
        keyword
    ]);

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

    const errorMessage =
        mockData && !mockData.success
            ? mockData.message
            : null;

    return (
        <>
            {errorMessage && (
                <FeedbackMessage
                    type="error"
                    message={errorMessage}
                />
            )}

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
        </>
    );
}

export default DashboardSchedule;