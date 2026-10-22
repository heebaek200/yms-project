// Dashboard Schedule Mock API

import type {
    ApiFailureResponse,
    ApiResponse,
    ApiSuccessResponse
} from '../types';
import type { UserRole } from '../../types/auth';
import type { DashboardRequestContext } from './types';

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
    | UserRole;

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

// Task 저장소가 분리되기 전에도 인증 사용자별 담당 업무와 프로젝트 참여 범위를 검증합니다.
const MOCK_TASK_WORKER_USER_IDS: Record<number, number> = {
    101: 24601,
    102: 24604,
    103: 24602,
    104: 24604,
    105: 24601,
    106: 24601,
    108: 24601,
    109: 24602,
    111: 24604,
    201: 24601,
    202: 24601
};

const MOCK_PROJECT_PARTICIPANT_USER_IDS: Record<number, number[]> = {
    11: [24601, 24604],
    12: [24602],
    13: [24602],
    14: [24601, 24604],
    15: [24601],
    31: [24601, 24621],
    32: [24601, 24621]
};

/** MEMBER는 자신이 참여한 프로젝트의 일정만 조회할 수 있습니다. */
function canAccessScheduleProject(
    projectId: number,
    context: DashboardRequestContext
) {
    return context.workspaceRole !== 'MEMBER'
        || MOCK_PROJECT_PARTICIPANT_USER_IDS[projectId]?.includes(context.userId) === true;
}

/** MY_TASK 필터는 인증 사용자에게 실제 배정된 Task인지 식별자로 확인합니다. */
function isAssignedToCurrentUser(
    taskId: number,
    context: DashboardRequestContext
) {
    return MOCK_TASK_WORKER_USER_IDS[taskId] === context.userId;
}

// 성공 응답 데이터
export type DashboardScheduleData = {
    calendarEvents: CalendarEvent[];
    todayDeadlines: TodayDeadline[];
};

// 성공 응답
export type DashboardScheduleSuccessResponse =
    ApiSuccessResponse<DashboardScheduleData>;

// 실패 응답
export type DashboardScheduleFailureResponse = ApiFailureResponse;

// 최종 응답 타입
export type DashboardScheduleResponse = ApiResponse<DashboardScheduleData>;

// Workspace와 Channel 조건을 함께 검증할 수 있도록 구성한 일정 Mock 데이터
const MOCK_CALENDAR_EVENTS: MockCalendarEvent[] = [
    {
        taskId: 101,
        projectId: 11,
        projectTitle: '카메라 롱폼 리뷰',
        taskTypeId: 2,
        taskTypeName: '종합 편집',
        workerName: '테스트 사용자',
        startDate: '2026-10-14',
        endDate: '2026-10-22',
        workerAmount: '400000.00',
        taskStatus: 'PROGRESS',
        workspaceId: 1,
        channelId: 1,
        projectStatus: 'REVIEW',
        workerRole: 'EDITOR',
        isMyTask: true,
        archived: false
    },
    {
        taskId: 102,
        projectId: 11,
        projectTitle: '카메라 롱폼 리뷰',
        taskTypeId: 4,
        taskTypeName: '썸네일',
        workerName: '이편집',
        startDate: '2026-10-20',
        endDate: '2026-10-24',
        workerAmount: '100000.00',
        taskStatus: 'WAITING',
        workspaceId: 1,
        channelId: 1,
        projectStatus: 'REVIEW',
        workerRole: 'THUMBNAILER',
        isMyTask: false,
        archived: false
    },
    {
        taskId: 103,
        projectId: 13,
        projectTitle: '가을 굿즈 티저',
        taskTypeId: 1,
        taskTypeName: '가편집',
        workerName: '윤공동',
        startDate: '2026-10-20',
        endDate: '2026-10-24',
        workerAmount: '150000.00',
        taskStatus: 'WAITING',
        workspaceId: 1,
        channelId: 2,
        projectStatus: 'PLANNING',
        workerRole: 'PLANNER',
        isMyTask: false,
        archived: false
    },
    {
        taskId: 104,
        projectId: 14,
        projectTitle: '10월 편집 비하인드',
        taskTypeId: 2,
        taskTypeName: '종합 편집',
        workerName: '이편집',
        startDate: '2026-10-20',
        endDate: '2026-10-28',
        workerAmount: '500000.00',
        taskStatus: 'REVIEW',
        workspaceId: 1,
        channelId: 1,
        projectStatus: 'EDITING',
        workerRole: 'EDITOR',
        isMyTask: false,
        archived: false
    },
    {
        taskId: 105,
        projectId: 15,
        projectTitle: '장비 세팅 Shorts',
        taskTypeId: 4,
        taskTypeName: '썸네일',
        workerName: '테스트 사용자',
        startDate: '2026-10-22',
        endDate: '2026-10-24',
        workerAmount: '80000.00',
        taskStatus: 'PROGRESS',
        workspaceId: 1,
        channelId: 3,
        projectStatus: 'PLANNING',
        workerRole: 'CREATOR',
        isMyTask: true,
        archived: false
    },
    {
        taskId: 106,
        projectId: 12,
        projectTitle: '카메라 Shorts #1',
        taskTypeId: 2,
        taskTypeName: '종합 편집',
        workerName: '테스트 사용자',
        startDate: '2026-10-01',
        endDate: '2026-10-03',
        workerAmount: '650000.00',
        taskStatus: 'PROGRESS',
        workspaceId: 1,
        channelId: 2,
        projectStatus: 'UPLOADED',
        workerRole: 'CREATOR',
        isMyTask: true,
        archived: true
    },
    {
        taskId: 108,
        projectId: 14,
        projectTitle: '10월 편집 비하인드',
        taskTypeId: 2,
        taskTypeName: '종합 편집',
        workerName: '테스트 사용자',
        startDate: '2026-10-22',
        endDate: '2026-10-28',
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
        projectId: 13,
        projectTitle: '가을 굿즈 티저',
        taskTypeId: 1,
        taskTypeName: '기획',
        workerName: '윤공동',
        startDate: '2026-10-22',
        endDate: '2026-10-24',
        workerAmount: '90000.00',
        taskStatus: 'WAITING',
        workspaceId: 1,
        channelId: 2,
        projectStatus: 'PLANNING',
        workerRole: 'PLANNER',
        isMyTask: false,
        archived: false
    },
    {
        taskId: 201,
        projectId: 31,
        projectTitle: '샘플 채널 콘텐츠',
        taskTypeId: 21,
        taskTypeName: '편집',
        workerName: '테스트 사용자',
        startDate: '2026-10-20',
        endDate: '2026-10-24',
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
        startDate: '2026-10-22',
        endDate: '2026-10-29',
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
        projectId: 14,
        projectTitle: '10월 편집 비하인드',
        taskTypeId: 2,
        taskTypeName: '종합 편집',
        workerName: '테스트 사용자',
        endDate: '2026-10-22',
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
        projectId: 13,
        projectTitle: '가을 굿즈 티저',
        taskTypeId: 1,
        taskTypeName: '기획',
        workerName: '윤공동',
        endDate: '2026-10-22',
        taskStatus: 'WAITING',
        workspaceId: 1,
        channelId: 2,
        projectStatus: 'PLANNING',
        workerRole: 'PLANNER',
        isMyTask: false,
        archived: false
    },
    {
        taskId: 111,
        projectId: 12,
        projectTitle: '카메라 Shorts #1',
        taskTypeId: 2,
        taskTypeName: '종합 편집',
        workerName: '윤공동',
        endDate: '2026-10-22',
        taskStatus: 'COMPLETED',
        workspaceId: 1,
        channelId: 2,
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
        endDate: '2026-10-22',
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
    request: DashboardScheduleRequest,
    context: DashboardRequestContext
): CalendarEvent[] {
    // 검색어 앞뒤 공백과 영문 대소문자 차이를 무시합니다.
    const keyword = request.keyword?.trim().toLowerCase() ?? '';

    return events
        .filter(event => {
            // 다른 Workspace의 일정과 보관된 프로젝트 일정은 기본 조회에서 제외합니다.
            if (event.workspaceId !== workspaceId || event.archived) {
                return false;
            }

            // 화면 필터보다 먼저 인증 사용자의 프로젝트 접근 범위를 적용합니다.
            if (!canAccessScheduleProject(event.projectId, context)) {
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
                if (!isAssignedToCurrentUser(event.taskId, context)) {
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
    request: DashboardScheduleRequest,
    context: DashboardRequestContext
): TodayDeadline[] {
    const keyword = request.keyword?.trim().toLowerCase() ?? '';

    return deadlines
        .filter(deadline => {
            if (deadline.workspaceId !== workspaceId || deadline.archived) {
                return false;
            }

            // Calendar와 동일한 인증 범위를 먼저 적용해 두 응답 배열의 경계를 맞춥니다.
            if (!canAccessScheduleProject(deadline.projectId, context)) {
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
                if (!isAssignedToCurrentUser(deadline.taskId, context)) {
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
    request: DashboardScheduleRequest,
    context: DashboardRequestContext
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
            message: '조회 시작일은 종료일보다 이후일 수 없습니다.',
            errors: null
        };
    }

    // 인증 만료
    if (mockScenario === 'UNAUTHORIZED') {
        return {
            success: false,
            errorCode: 'UNAUTHORIZED_SESSION',
            message: '로그인 정보가 만료되었습니다. 다시 로그인해 주세요.',
            errors: null
        };
    }

    // 서버 오류
    if (mockScenario === 'SERVER_ERROR') {
        return {
            success: false,
            errorCode: 'INTERNAL_SERVER_ERROR',
            message: '스케줄 정보를 불러오는 중 오류가 발생했습니다.',
            errors: null
        };
    }

    // 정상 응답
    return {
        success: true,
        data: {
            calendarEvents: filterMockCalendarEvents(
                workspaceId,
                MOCK_CALENDAR_EVENTS,
                request,
                context
            ),
            todayDeadlines:
                mockScenario === 'EMPTY_DEADLINES'
                    ? []
                    : filterMockTodayDeadlines(
                        workspaceId,
                        MOCK_TODAY_DEADLINES,
                        request,
                        context
                    )
        }
    };
}
