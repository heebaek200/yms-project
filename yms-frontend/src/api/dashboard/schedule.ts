// Dashboard Schedule Mock API

// Mock 시나리오
type MockScenario =
    | 'SUCCESS'
    | 'INVALID_DATE_RANGE'
    | 'UNAUTHORIZED'
    | 'SERVER_ERROR';

let mockScenario: MockScenario = 'SUCCESS';
//let mockScenario: MockScenario = 'SERVER_ERROR';


// 테스트용 Mock 시나리오 변경
export function setDashboardScheduleMockScenario(
    scenario: MockScenario
) {
    mockScenario = scenario;
}


// 프로젝트 상태
export type ProjectStatus =
    | 'PLANNING'
    | 'EDITING'
    | 'REVIEW'
    | 'UPLOADED';

// 작업 유형
export type TaskType =
    | 'PRE_EDIT'
    | 'MAIN_EDIT'
    | 'THUMBNAIL';

// 작업 진행 상태
export type AssignmentStatus =
    | 'WAITING'
    | 'PROGRESS'
    | 'REVIEW'
    | 'COMPLETED';

// 담당 역할 필터
export type ScheduleRoleFilter =
    | 'ALL'
    | 'MY_TASK'
    | 'CREATOR'
    | 'EDITOR'
    | 'THUMBNAILER';

// 프로젝트 상태 필터
export type ScheduleStatusFilter =
    | 'ALL'
    | ProjectStatus;


// GET 요청 Query Parameter
export type DashboardScheduleRequest = {
    startDate: string;
    endDate: string;
    status?: ScheduleStatusFilter;
    role?: ScheduleRoleFilter;
    keyword?: string;
};


// Calendar에 표시할 작업 일정
export type CalendarEvent = {
    assignmentId: number;
    projectId: number;
    projectTitle: string;
    taskType: TaskType;
    workerName: string;
    startDate: string;
    endDate: string;
    cost: number;
    assignmentStatus: AssignmentStatus;
};

/**
 * Schedule Mock API 내부에서 필터 조건을 판단하기 위한 일정 타입입니다.
 * 실제 Dashboard Schedule API 응답에는 포함되지 않는 테스트용 메타데이터를 보관합니다.
 * 필터링이 끝난 뒤에는 CalendarEvent 형태로 반환합니다.
 */
type MockCalendarEvent = CalendarEvent & {
    projectStatus: ProjectStatus;
    workerRole: Exclude<
        ScheduleRoleFilter,
        'ALL' | 'MY_TASK'
    >;
    isMyTask: boolean;
};

// 우측 마감 업무 피드
export type TodayDeadline = {
    assignmentId: number;
    projectId: number;
    projectTitle: string;
    taskType: TaskType;
    workerName: string;
    endDate: string;
    assignmentStatus: AssignmentStatus;
};

// 성공 응답 데이터
export type DashboardScheduleData = {
    calendarEvents: CalendarEvent[];
    todayDeadlines: TodayDeadline[];
};

// 성공 응답
export type DashboardScheduleSuccessResponse = {
    success: true;
    data: DashboardScheduleData;
};

// 실패 응답
export type DashboardScheduleFailureResponse = {
    success: false;
    errorCode: string;
    message: string;
};

// 최종 응답 타입
export type DashboardScheduleResponse =
    | DashboardScheduleSuccessResponse
    | DashboardScheduleFailureResponse;


// GET /api/dashboard/schedule
export async function getDashboardSchedule(
    request: DashboardScheduleRequest
): Promise<DashboardScheduleResponse> {

    // TODO:
    // 백엔드 완성 후
    // GET /api/dashboard/schedule
    // axios 호출로 교체
    console.log('[Schedule Request]', request);

    await new Promise(resolve =>
        setTimeout(resolve, 500)
    );

    // 날짜 범위 오류
    if (mockScenario === 'INVALID_DATE_RANGE') {
        return {
            success: false,
            errorCode: 'INVALID_INPUT_VALUE',
            message:
                '조회 시작일은 종료일보다 이후일 수 없습니다.'
        };
    }


    // 인증 만료
    if (mockScenario === 'UNAUTHORIZED') {
        return {
            success: false,
            errorCode: 'UNAUTHORIZED',
            message:
                '로그인 정보가 만료되었습니다. 다시 로그인해 주세요.'
        };
    }


    // 서버 오류
    if (mockScenario === 'SERVER_ERROR') {
        return {
            success: false,
            errorCode: 'INTERNAL_SERVER_ERROR',
            message:
                '스케줄 정보를 불러오는 중 오류가 발생했습니다.'
        };
    }

    /**
     * Dashboard Schedule 요청 조건에 맞는 Mock 일정을 추출합니다.
     * 날짜 범위는 시작일과 종료일을 모두 포함하며,
     * 상태, 역할, 검색어 조건은 함께 지정된 경우 AND 조건으로 적용합니다.
     */
    function filterMockCalendarEvents(
        events: MockCalendarEvent[],
        request: DashboardScheduleRequest
    ): CalendarEvent[] {

        const keyword =
            request.keyword
                ?.trim()
                .toLowerCase()
            ?? '';

        return events
            .filter(event => {

                // 조회 기간과 일정 기간이 단 하루라도 겹치는지 확인합니다.
                const matchesDateRange =
                    event.startDate <= request.endDate
                    && event.endDate >= request.startDate;

                if (!matchesDateRange) {
                    return false;
                }

                // 프로젝트 상태가 ALL이면 상태 조건을 적용하지 않습니다.
                if (
                    request.status
                    && request.status !== 'ALL'
                    && event.projectStatus !== request.status
                ) {
                    return false;
                }

                // 역할 필터는 일반 역할과 MY_TASK를 구분하여 처리합니다.
                if (request.role === 'MY_TASK') {
                    if (!event.isMyTask) {
                        return false;
                    }
                } else if (
                    request.role
                    && request.role !== 'ALL'
                    && event.workerRole !== request.role
                ) {
                    return false;
                }

                // 검색어는 프로젝트 제목을 기준으로 부분 일치합니다.
                if (
                    keyword
                    && !event.projectTitle
                        .toLowerCase()
                        .includes(keyword)
                ) {
                    return false;
                }

                return true;
            })
            .map(({
                projectStatus: _projectStatus,
                workerRole: _workerRole,
                isMyTask: _isMyTask,
                ...event
            }) => event);
    }

    const MOCK_CALENDAR_EVENTS: MockCalendarEvent[] = [
        {
            assignmentId: 101,
            projectId: 12,
            projectTitle: '8월 여름 휴가 브이로그',
            taskType: 'MAIN_EDIT',
            workerName: '박편집',
            startDate: '2026-08-01',
            endDate: '2026-08-07',
            cost: 400000,
            assignmentStatus: 'PROGRESS',

            projectStatus: 'EDITING',
            workerRole: 'EDITOR',
            isMyTask: true
        },
        {
            assignmentId: 102,
            projectId: 12,
            projectTitle: '8월 여름 휴가 브이로그',
            taskType: 'THUMBNAIL',
            workerName: '이디자',
            startDate: '2026-08-05',
            endDate: '2026-08-10',
            cost: 100000,
            assignmentStatus: 'WAITING',

            projectStatus: 'EDITING',
            workerRole: 'THUMBNAILER',
            isMyTask: false
        },
        {
            assignmentId: 103,
            projectId: 13,
            projectTitle: '신제품 카메라 리뷰',
            taskType: 'PRE_EDIT',
            workerName: '김편집',
            startDate: '2026-08-11',
            endDate: '2026-08-13',
            cost: 150000,
            assignmentStatus: 'COMPLETED',

            projectStatus: 'REVIEW',
            workerRole: 'EDITOR',
            isMyTask: true
        },
        {
            assignmentId: 104,
            projectId: 13,
            projectTitle: '신제품 카메라 리뷰',
            taskType: 'MAIN_EDIT',
            workerName: '김편집',
            startDate: '2026-08-14',
            endDate: '2026-08-21',
            cost: 500000,
            assignmentStatus: 'REVIEW',

            projectStatus: 'REVIEW',
            workerRole: 'EDITOR',
            isMyTask: true
        },
        {
            assignmentId: 105,
            projectId: 14,
            projectTitle: '9월 게임 신작 정리',
            taskType: 'THUMBNAIL',
            workerName: '최썸네일',
            startDate: '2026-08-27',
            endDate: '2026-08-31',
            cost: 80000,
            assignmentStatus: 'PROGRESS',

            projectStatus: 'PLANNING',
            workerRole: 'THUMBNAILER',
            isMyTask: false
        },
        {
            assignmentId: 106,
            projectId: 15,
            projectTitle: '송년 특집 및 신년 카운트다운',
            taskType: 'MAIN_EDIT',
            workerName: '윤편집',
            startDate: '2026-12-30',
            endDate: '2027-01-01',
            cost: 650000,
            assignmentStatus: 'PROGRESS',

            projectStatus: 'UPLOADED',
            workerRole: 'CREATOR',
            isMyTask: true
        }
    ];

    const calendarEvents =
        filterMockCalendarEvents(
            MOCK_CALENDAR_EVENTS,
            request
        );

    // 정상 응답
    return {
        success: true,
        data: {
            calendarEvents,

            todayDeadlines: [
                {
                    assignmentId: 99,
                    projectId: 11,
                    projectTitle: '7화 테크 리뷰 쇼츠',
                    taskType: 'PRE_EDIT',
                    workerName: '김편집',
                    endDate: '2026-09-01',
                    assignmentStatus: 'REVIEW'
                },
                {
                    assignmentId: 105,
                    projectId: 14,
                    projectTitle: '9월 게임 신작 정리',
                    taskType: 'THUMBNAIL',
                    workerName: '최썸네일',
                    endDate: '2026-09-01',
                    assignmentStatus: 'PROGRESS'
                }
            ]
        }
    };
}