// Dashboard Schedule Mock API

// Mock 시나리오
type MockScenario =
    | 'SUCCESS'
    | 'EMPTY'
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

    void request;

    // TODO:
    // 백엔드 완성 후
    // GET /api/dashboard/schedule
    // axios 호출로 교체

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


    // 조회 결과 없음
    if (mockScenario === 'EMPTY') {
        return {
            success: true,
            data: {
                calendarEvents: [],
                todayDeadlines: []
            }
        };
    }


    // 정상 응답
    return {
        success: true,
        data: {
            calendarEvents: [
                {
                    assignmentId: 101,
                    projectId: 12,
                    projectTitle: '8월 여름 휴가 브이로그',
                    taskType: 'MAIN_EDIT',
                    workerName: '박편집',
                    startDate: '2026-08-01',
                    endDate: '2026-08-07',
                    cost: 400000,
                    assignmentStatus: 'PROGRESS'
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
                    assignmentStatus: 'WAITING'
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
                    assignmentStatus: 'COMPLETED'
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
                    assignmentStatus: 'REVIEW'
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
                    assignmentStatus: 'PROGRESS'
                }
            ],

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