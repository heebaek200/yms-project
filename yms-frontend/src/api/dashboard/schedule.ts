// Dashboard Schedule Mock API

// Mock 시나리오
type MockScenario =
    | 'SUCCESS'
    | 'EMPTY_DEADLINES'
    | 'INVALID_DATE_RANGE'
    | 'UNAUTHORIZED'
    | 'SERVER_ERROR';

let mockScenario: MockScenario = 'SUCCESS';

/**
 * Dashboard Schedule Mock API가 반환할 시나리오를 변경합니다.
 * 정상·빈 마감 피드·요청 오류 등의 화면 상태를 수동 검증할 때 사용하며,
 * 다음 API 호출부터 전달받은 시나리오가 적용됩니다.
 */
export function setDashboardScheduleMockScenario(scenario: MockScenario) {
    mockScenario = scenario;
}

// 프로젝트 상태
export type ProjectStatus =
    | 'PLANNING'
    | 'EDITING'
    | 'REVIEW'
    | 'UPLOADED'
    | 'CANCELLED';

// 작업 진행 상태
export type TaskStatus =
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
    channelId?: number;
    keyword?: string;
};

// Calendar에 표시할 작업 일정
export type CalendarEvent = {
    taskId: number;
    projectId: number;
    projectTitle: string;
    taskTypeId: number;
    taskTypeName: string;
    workerName: string;
    startDate: string;
    endDate: string;
    workerAmount: string;
    taskStatus: TaskStatus;
};

type WorkerRole = Exclude<ScheduleRoleFilter, 'ALL' | 'MY_TASK'>;

/**
 * Schedule Mock API 내부에서 필터 조건을 판단하기 위한 일정 타입입니다.
 * 실제 Dashboard Schedule API 응답에는 포함되지 않는 Workspace, Channel,
 * 프로젝트 상태와 보관 여부 등의 테스트용 메타데이터를 보관합니다.
 * 필터링이 끝난 뒤에는 CalendarEvent 형태로 반환합니다.
 */
type MockCalendarEvent = CalendarEvent & {
    workspaceId: number;
    channelId: number;
    projectStatus: ProjectStatus;
    workerRole: WorkerRole;
    isMyTask: boolean;
    archived: boolean;
};

// 우측 마감 업무 피드
export type TodayDeadline = {
    taskId: number;
    projectId: number;
    projectTitle: string;
    taskTypeId: number;
    taskTypeName: string;
    workerName: string;
    endDate: string;
    taskStatus: TaskStatus;
};

// 응답에는 노출하지 않을 Workspace 및 필터 메타데이터를 Mock 타입에만 보관합니다.
type MockTodayDeadline = TodayDeadline & {
    workspaceId: number;
    channelId: number;
    projectStatus: ProjectStatus;
    workerRole: WorkerRole;
    isMyTask: boolean;
    archived: boolean;
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

// Workspace와 Channel 조건을 함께 검증할 수 있도록 구성한 일정 Mock 데이터
const MOCK_CALENDAR_EVENTS: MockCalendarEvent[] = [
    {
        taskId: 101,
        projectId: 12,
        projectTitle: '8월 여름 휴가 브이로그',
        taskTypeId: 2,
        taskTypeName: '종합 편집',
        workerName: '박편집',
        startDate: '2026-08-01',
        endDate: '2026-08-07',
        workerAmount: '400000.00',
        taskStatus: 'PROGRESS',
        workspaceId: 1,
        channelId: 1,
        projectStatus: 'EDITING',
        workerRole: 'EDITOR',
        isMyTask: true,
        archived: false
    },
    {
        taskId: 102,
        projectId: 12,
        projectTitle: '8월 여름 휴가 브이로그',
        taskTypeId: 4,
        taskTypeName: '썸네일',
        workerName: '이디자',
        startDate: '2026-08-05',
        endDate: '2026-08-10',
        workerAmount: '100000.00',
        taskStatus: 'WAITING',
        workspaceId: 1,
        channelId: 1,
        projectStatus: 'EDITING',
        workerRole: 'THUMBNAILER',
        isMyTask: false,
        archived: false
    },
    {
        taskId: 103,
        projectId: 13,
        projectTitle: '신제품 카메라 리뷰',
        taskTypeId: 1,
        taskTypeName: '가편집',
        workerName: '김편집',
        startDate: '2026-08-11',
        endDate: '2026-08-13',
        workerAmount: '150000.00',
        taskStatus: 'COMPLETED',
        workspaceId: 1,
        channelId: 3,
        projectStatus: 'REVIEW',
        workerRole: 'EDITOR',
        isMyTask: true,
        archived: false
    },
    {
        taskId: 104,
        projectId: 13,
        projectTitle: '신제품 카메라 리뷰',
        taskTypeId: 2,
        taskTypeName: '종합 편집',
        workerName: '김편집',
        startDate: '2026-08-14',
        endDate: '2026-08-21',
        workerAmount: '500000.00',
        taskStatus: 'REVIEW',
        workspaceId: 1,
        channelId: 3,
        projectStatus: 'REVIEW',
        workerRole: 'EDITOR',
        isMyTask: true,
        archived: false
    },
    {
        taskId: 105,
        projectId: 14,
        projectTitle: '9월 게임 신작 정리',
        taskTypeId: 4,
        taskTypeName: '썸네일',
        workerName: '최썸네일',
        startDate: '2026-08-27',
        endDate: '2026-08-31',
        workerAmount: '80000.00',
        taskStatus: 'PROGRESS',
        workspaceId: 1,
        channelId: 2,
        projectStatus: 'PLANNING',
        workerRole: 'THUMBNAILER',
        isMyTask: false,
        archived: false
    },
    {
        taskId: 106,
        projectId: 15,
        projectTitle: '송년 특집 및 신년 카운트다운',
        taskTypeId: 2,
        taskTypeName: '종합 편집',
        workerName: '윤편집',
        startDate: '2026-12-30',
        endDate: '2027-01-01',
        workerAmount: '650000.00',
        taskStatus: 'PROGRESS',
        workspaceId: 1,
        channelId: 1,
        projectStatus: 'UPLOADED',
        workerRole: 'CREATOR',
        isMyTask: true,
        archived: false
    },
    {
        taskId: 108,
        projectId: 17,
        projectTitle: '가을 신제품 언박싱',
        taskTypeId: 2,
        taskTypeName: '종합 편집',
        workerName: '김편집',
        startDate: '2026-09-25',
        endDate: '2026-09-29',
        workerAmount: '350000.00',
        taskStatus: 'PROGRESS',
        workspaceId: 1,
        channelId: 1,
        projectStatus: 'EDITING',
        workerRole: 'EDITOR',
        isMyTask: true,
        archived: false
    },
    {
        taskId: 109,
        projectId: 18,
        projectTitle: '가을 여행지 추천',
        taskTypeId: 4,
        taskTypeName: '썸네일',
        workerName: '이디자',
        startDate: '2026-09-27',
        endDate: '2026-09-29',
        workerAmount: '90000.00',
        taskStatus: 'REVIEW',
        workspaceId: 1,
        channelId: 2,
        projectStatus: 'REVIEW',
        workerRole: 'THUMBNAILER',
        isMyTask: false,
        archived: false
    },
    {
        taskId: 107,
        projectId: 16,
        projectTitle: '취소된 촬영 프로젝트',
        taskTypeId: 1,
        taskTypeName: '가편집',
        workerName: '김편집',
        startDate: '2026-09-07',
        endDate: '2026-09-09',
        workerAmount: '100000.00',
        taskStatus: 'COMPLETED',
        workspaceId: 1,
        channelId: 1,
        projectStatus: 'CANCELLED',
        workerRole: 'EDITOR',
        isMyTask: true,
        archived: false
    },
    {
        taskId: 201,
        projectId: 31,
        projectTitle: '샘플 채널 콘텐츠',
        taskTypeId: 21,
        taskTypeName: '편집',
        workerName: '테스트 사용자',
        startDate: '2026-09-14',
        endDate: '2026-09-18',
        workerAmount: '250000.00',
        taskStatus: 'PROGRESS',
        workspaceId: 2,
        channelId: 21,
        projectStatus: 'EDITING',
        workerRole: 'EDITOR',
        isMyTask: true,
        archived: false
    },
    {
        taskId: 202,
        projectId: 32,
        projectTitle: '두 번째 제작팀 마감 작업',
        taskTypeId: 21,
        taskTypeName: '편집',
        workerName: '테스트 사용자',
        startDate: '2026-09-26',
        endDate: '2026-09-29',
        workerAmount: '180000.00',
        taskStatus: 'WAITING',
        workspaceId: 2,
        channelId: 21,
        projectStatus: 'EDITING',
        workerRole: 'EDITOR',
        isMyTask: true,
        archived: false
    }
];

// 정상 항목과 함께 취소·보관 항목을 두어 피드 제외 규칙까지 검증합니다.
const MOCK_TODAY_DEADLINES: MockTodayDeadline[] = [
    {
        taskId: 108,
        projectId: 17,
        projectTitle: '가을 신제품 언박싱',
        taskTypeId: 2,
        taskTypeName: '종합 편집',
        workerName: '김편집',
        endDate: '2026-09-29',
        taskStatus: 'PROGRESS',
        workspaceId: 1,
        channelId: 1,
        projectStatus: 'EDITING',
        workerRole: 'EDITOR',
        isMyTask: true,
        archived: false
    },
    {
        taskId: 109,
        projectId: 18,
        projectTitle: '가을 여행지 추천',
        taskTypeId: 4,
        taskTypeName: '썸네일',
        workerName: '이디자',
        endDate: '2026-09-29',
        taskStatus: 'REVIEW',
        workspaceId: 1,
        channelId: 2,
        projectStatus: 'REVIEW',
        workerRole: 'THUMBNAILER',
        isMyTask: false,
        archived: false
    },
    {
        taskId: 110,
        projectId: 19,
        projectTitle: '취소된 라이브 방송',
        taskTypeId: 1,
        taskTypeName: '가편집',
        workerName: '김편집',
        endDate: '2026-09-29',
        taskStatus: 'WAITING',
        workspaceId: 1,
        channelId: 1,
        projectStatus: 'CANCELLED',
        workerRole: 'EDITOR',
        isMyTask: true,
        archived: false
    },
    {
        taskId: 111,
        projectId: 20,
        projectTitle: '보관된 프로젝트',
        taskTypeId: 2,
        taskTypeName: '종합 편집',
        workerName: '박편집',
        endDate: '2026-09-29',
        taskStatus: 'COMPLETED',
        workspaceId: 1,
        channelId: 1,
        projectStatus: 'UPLOADED',
        workerRole: 'EDITOR',
        isMyTask: false,
        archived: true
    },
    {
        taskId: 202,
        projectId: 32,
        projectTitle: '두 번째 제작팀 마감 작업',
        taskTypeId: 21,
        taskTypeName: '편집',
        workerName: '테스트 사용자',
        endDate: '2026-09-29',
        taskStatus: 'WAITING',
        workspaceId: 2,
        channelId: 21,
        projectStatus: 'EDITING',
        workerRole: 'EDITOR',
        isMyTask: true,
        archived: false
    }
];

/**
 * Schedule 검색어가 프로젝트 제목 또는 Task Type에 포함되는지 확인합니다.
 * Calendar와 마감 피드가 같은 검색 규칙을 공유하도록 응답 타입의 공통 필드만 사용하며,
 * 빈 검색어는 전체 항목을 허용합니다.
 */
function matchesScheduleKeyword(
    item: Pick<CalendarEvent, 'projectTitle' | 'taskTypeName'>,
    keyword: string
) {
    if (!keyword) {
        return true;
    }

    return item.projectTitle.toLowerCase().includes(keyword)
        || item.taskTypeName.toLowerCase().includes(keyword);
}

/**
 * Dashboard Schedule 요청 조건에 맞는 Mock 일정을 추출합니다.
 * 날짜 범위는 시작일과 종료일을 모두 포함하며,
 * Workspace, 상태, 역할, Channel, 검색어 조건은 함께 지정된 경우 AND로 적용합니다.
 */
function filterMockCalendarEvents(
    workspaceId: number,
    events: MockCalendarEvent[],
    request: DashboardScheduleRequest
): CalendarEvent[] {
    // 검색어 앞뒤 공백과 영문 대소문자 차이를 무시합니다.
    const keyword = request.keyword?.trim().toLowerCase() ?? '';

    return events
        .filter(event => {
            // 다른 Workspace의 일정과 보관된 프로젝트 일정은 기본 조회에서 제외합니다.
            if (event.workspaceId !== workspaceId || event.archived) {
                return false;
            }

            // 조회 기간과 일정 기간이 단 하루라도 겹치는지 확인합니다.
            const matchesDateRange =
                event.startDate <= request.endDate
                && event.endDate >= request.startDate;

            if (!matchesDateRange) {
                return false;
            }

            // CANCELLED는 명시적으로 선택한 경우에만 조회합니다.
            if (request.status === 'CANCELLED') {
                if (event.projectStatus !== 'CANCELLED') {
                    return false;
                }
            } else if (event.projectStatus === 'CANCELLED') {
                return false;
            } else if (
                request.status
                && request.status !== 'ALL'
                && event.projectStatus !== request.status
            ) {
                return false;
            }

            // 역할 필터는 일반 역할과 현재 사용자의 작업인 MY_TASK를 구분합니다.
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

            // Channel을 선택하지 않은 경우 모든 Channel의 일정을 허용합니다.
            if (
                request.channelId !== undefined
                && event.channelId !== request.channelId
            ) {
                return false;
            }

            // 프로젝트 제목과 Task Type 중 하나라도 검색어와 일치하면 일정을 유지합니다.
            if (!matchesScheduleKeyword(event, keyword)) {
                return false;
            }

            return true;
        })
        // Mock 필터 전용 메타데이터는 실제 API 응답에서 제거합니다.
        .map(({
            workspaceId: _workspaceId,
            channelId: _channelId,
            projectStatus: _projectStatus,
            workerRole: _workerRole,
            isMyTask: _isMyTask,
            archived: _archived,
            ...event
        }) => event);
}

/**
 * 마감 피드도 Calendar와 동일한 Workspace 및 화면 필터를 적용합니다.
 * 날짜 범위와 무관하게 오늘 마감 항목을 유지하되 보관 Project는 항상 제외합니다.
 */
function filterMockTodayDeadlines(
    workspaceId: number,
    deadlines: MockTodayDeadline[],
    request: DashboardScheduleRequest
): TodayDeadline[] {
    const keyword = request.keyword?.trim().toLowerCase() ?? '';

    return deadlines
        .filter(deadline => {
            if (deadline.workspaceId !== workspaceId || deadline.archived) {
                return false;
            }

            // CANCELLED는 사용자가 해당 상태를 명시적으로 선택한 경우에만 표시합니다.
            if (request.status === 'CANCELLED') {
                if (deadline.projectStatus !== 'CANCELLED') {
                    return false;
                }
            } else if (deadline.projectStatus === 'CANCELLED') {
                return false;
            } else if (
                request.status
                && request.status !== 'ALL'
                && deadline.projectStatus !== request.status
            ) {
                return false;
            }

            if (request.role === 'MY_TASK') {
                if (!deadline.isMyTask) {
                    return false;
                }
            } else if (
                request.role
                && request.role !== 'ALL'
                && deadline.workerRole !== request.role
            ) {
                return false;
            }

            // 선택한 Channel이 있으면 해당 Channel에 속한 마감 업무만 유지합니다.
            if (
                request.channelId !== undefined
                && deadline.channelId !== request.channelId
            ) {
                return false;
            }

            // Calendar와 동일한 공통 검색 규칙을 적용하여 두 결과의 불일치를 방지합니다.
            if (!matchesScheduleKeyword(deadline, keyword)) {
                return false;
            }

            return true;
        })
        // 필터링에만 사용한 Mock 메타데이터를 제거하고 실제 응답 타입으로 변환합니다.
        .map(({
            workspaceId: _workspaceId,
            channelId: _channelId,
            projectStatus: _projectStatus,
            workerRole: _workerRole,
            isMyTask: _isMyTask,
            archived: _archived,
            ...deadline
        }) => deadline);
}

/**
 * 현재 Workspace의 Calendar 일정과 오늘 마감 피드를 조회합니다.
 * 날짜 및 화면 필터를 Mock 데이터에 적용하여 실제 API와 같은 응답 구조를 반환하며,
 * 백엔드 연동 시 동일한 경로와 Query Parameter를 사용하는 HTTP 호출로 교체합니다.
 */
export async function getDashboardSchedule(
    workspaceId: number,
    request: DashboardScheduleRequest
): Promise<DashboardScheduleResponse> {
    // TODO:
    // 백엔드 완성 후
    // GET /api/workspaces/{workspaceId}/dashboard/schedule
    // 동일한 Query Parameter를 사용하는 axios 호출로 교체
    console.log('[Schedule Request]', { workspaceId, ...request });

    await new Promise(resolve => setTimeout(resolve, 500));

    // 날짜 범위 오류
    if (request.startDate > request.endDate || mockScenario === 'INVALID_DATE_RANGE') {
        return {
            success: false,
            errorCode: 'INVALID_DATE_RANGE',
            message: '조회 시작일은 종료일보다 이후일 수 없습니다.'
        };
    }

    // 인증 만료
    if (mockScenario === 'UNAUTHORIZED') {
        return {
            success: false,
            errorCode: 'UNAUTHORIZED_SESSION',
            message: '로그인 정보가 만료되었습니다. 다시 로그인해 주세요.'
        };
    }

    // 서버 오류
    if (mockScenario === 'SERVER_ERROR') {
        return {
            success: false,
            errorCode: 'INTERNAL_SERVER_ERROR',
            message: '스케줄 정보를 불러오는 중 오류가 발생했습니다.'
        };
    }

    // 정상 응답
    return {
        success: true,
        data: {
            calendarEvents: filterMockCalendarEvents(
                workspaceId,
                MOCK_CALENDAR_EVENTS,
                request
            ),
            todayDeadlines:
                mockScenario === 'EMPTY_DEADLINES'
                    ? []
                    : filterMockTodayDeadlines(
                        workspaceId,
                        MOCK_TODAY_DEADLINES,
                        request
                    )
        }
    };
}
