import { useEffect, useState } from "react";
import {
    getDashboardSchedule,
    type DashboardScheduleResponse,
    type ScheduleRoleFilter,
    type ScheduleStatusFilter,
    type TodayDeadline
} from '../../api/dashboard/schedule';
import SchedulerCalendar, { type SchedulerDateRange, type SchedulerEventClickData } from './SchedulerCalendar';
import { toFullCalendarEvents } from './schedulerCalendarAdapter';
import DeadlineFeed from './DeadlineFeed';
import FeedbackMessage from '../common/FeedbackMessage';

import './Schedule.css';

type DashboardScheduleProps = {
    workspaceId: number;
    status: ScheduleStatusFilter;
    role: ScheduleRoleFilter;
    channelId: number | null;
    keyword: string;
};

/**
 * 현재 Workspace와 필터에 맞는 Schedule API를 한 번 호출합니다.
 * 동일한 응답을 Calendar와 오늘 마감 피드로 나누어 전달하고 로딩·오류 상태를 공유하며,
 * Calendar 범위 또는 필터가 바뀌면 최신 조건으로 데이터를 다시 조회합니다.
 */
function DashboardSchedule({
    workspaceId,
    status,
    role,
    channelId,
    keyword
}: DashboardScheduleProps) {

    const [isLoading, setIsLoading] = useState(true);       // 초기 호출 동작 중 로딩
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

    /**
     * TODO #17 SCR-08 프로젝트 상세 라우트가 추가되면 projectId와 taskId로 이동합니다.
     * 현재는 피드 항목이 상세 화면 식별자를 정상 전달하는 연결 지점만 제공합니다.
     */
    const handleDeadlineClick = (
        deadline: TodayDeadline
    ) => {
        console.log(
            '[Deadline Feed Click]',
            {
                projectId: deadline.projectId,
                taskId: deadline.taskId
            }
        );
    };

    /**
     * Workspace, 날짜 범위 또는 필터가 바뀔 때마다 새 조건으로 조회합니다.
     * Workspace ID는 실제 API URL의 업무 데이터 경계를 결정합니다.
     */
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
                // 재조회 중 이전 성공 또는 오류 응답이 현재 조건의 결과처럼 남지 않도록 비웁니다.
                setMockData(null);

                const data =
                    await getDashboardSchedule(
                        workspaceId,
                        {
                            startDate: dateRange.startDate,
                            endDate: dateRange.endDate,
                            status,
                            role,
                            channelId: channelId ?? undefined,
                            keyword
                        }
                    );

                // Workspace나 필터가 다시 바뀌었다면 이전 요청의 응답은 무시합니다.
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
        workspaceId,
        status,
        role,
        channelId,
        keyword
    ]);

    const handleRangeChange = (
        range: SchedulerDateRange
    ) => {
        // FullCalendar가 동일 범위를 다시 전달할 때 불필요한 재조회를 막습니다.
        if (
            dateRange?.startDate === range.startDate
            && dateRange?.endDate === range.endDate
        ) {
            return;
        }

        // View 전환 직후 빈 결과가 먼저 보이지 않도록 범위 변경 시점에 즉시 로딩으로 전환합니다.
        setIsLoading(true);
        setMockData(null);
        setDateRange(range);
    };

    const calendarEvents = mockData?.success
        ? toFullCalendarEvents(
            mockData.data.calendarEvents
        )
        : [];

    const todayDeadlines = mockData?.success
        ? mockData.data.todayDeadlines
        : [];

    const errorMessage =
        mockData && !mockData.success
            ? mockData.message
            : null;

    // Calendar와 마감 피드가 공유하는 요청 오류는 두 영역보다 상위에서 한 번만 표시합니다.
    if (errorMessage) {
        return (
            <FeedbackMessage
                type="error"
                message={errorMessage}
            />
        );
    }

    return (
        <div className="dashboard-schedule-layout">
            {/* Calendar는 넓은 주 영역을 사용하고 조회 중임을 별도 상태 문구로 알립니다. */}
            <div className="dashboard-schedule-calendar">
                <SchedulerCalendar
                    events={calendarEvents}
                    isLoading={isLoading}
                    onRangeChange={handleRangeChange}
                    onEventClick={handleEventClick}
                />
            </div>

            {/* 같은 Schedule 응답의 마감 목록을 우측 피드로 전달해 중복 호출을 방지합니다. */}
            <DeadlineFeed
                deadlines={todayDeadlines}
                isLoading={isLoading}
                onDeadlineClick={handleDeadlineClick}
            />
        </div>
    );
}

export default DashboardSchedule;
