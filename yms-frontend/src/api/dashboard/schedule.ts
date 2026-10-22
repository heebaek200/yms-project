// Dashboard Schedule Mock API

import type {
    ApiFailureResponse,
    ApiResponse,
    ApiSuccessResponse
} from '../types';
import type { UserRole } from '../../types/auth';
import { readProject } from '../projects/projectStore';
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

// 모든 제작팀 권한에 공통으로 제공하는 Calendar 작업 일정입니다.
type CalendarEventBase = {
    taskId: number;
    projectId: number;
    projectTitle: string;
    taskTypeId: number;
    taskTypeName: string;
    workerName: string;
    startDate: string;
    endDate: string;
    taskStatus: TaskStatus;
};

// 일반 MEMBER 응답은 작업 금액 필드를 구조 자체에서 제외합니다.
export type MemberCalendarEvent = CalendarEventBase & {
    workerAmount?: never;
};

// 제작팀 OWNER와 ADMIN 응답에만 작업 금액을 제공합니다.
export type ManagerCalendarEvent = CalendarEventBase & {
    workerAmount: string;
};

export type CalendarEvent = MemberCalendarEvent | ManagerCalendarEvent;

type WorkerRole = Exclude<ScheduleRoleFilter, 'ALL' | 'MY_TASK'>;

/**
 * Schedule Mock API 내부에서 필터 조건을 판단하기 위한 일정 타입입니다.
 * Project 소속·상태·보관 여부는 공통 Project 저장소에서 읽고 여기에는 Task 역할만 보관합니다.
 */
type MockCalendarEvent = ManagerCalendarEvent & {
    workerRole: WorkerRole;
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

// 응답에는 노출하지 않을 Task 역할을 Mock 타입에만 보관합니다.
type MockTodayDeadline = TodayDeadline & {
    workerRole: WorkerRole;
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

/**
 * 일정이 속한 Project를 공통 저장소에서 조회하고 현재 사용자의 접근 가능 범위를 검증합니다.
 * 삭제·보관 Project를 제외하고 MEMBER에게는 최신 ACTIVE 참여 관계가 있는 Project만 반환합니다.
 */
function readAccessibleScheduleProject(
    workspaceId: number,
    projectId: number,
    context: DashboardRequestContext
) {
    const project = readProject(workspaceId, projectId);

    if (!project || project.archivedAt !== null) {
        return null;
    }

    if (context.workspaceRole !== 'MEMBER') {
        return project;
    }

    return project.members.some(member => (
        member.userId === context.userId
        && member.active
    )) ? project : null;
}

/** MY_TASK 필터는 인증 사용자에게 실제 배정된 Task인지 식별자로 확인합니다. */
function isAssignedToCurrentUser(
    taskId: number,
    context: DashboardRequestContext
) {
    return MOCK_TASK_WORKER_USER_IDS[taskId] === context.userId;
}

// 성공 응답 데이터
export type DashboardScheduleData<TEvent extends CalendarEvent = CalendarEvent> = {
    calendarEvents: TEvent[];
    todayDeadlines: TodayDeadline[];
};

export type MemberDashboardScheduleData = DashboardScheduleData<MemberCalendarEvent>;
export type ManagerDashboardScheduleData = DashboardScheduleData<ManagerCalendarEvent>;

// 성공 응답
export type DashboardScheduleSuccessResponse =
    ApiSuccessResponse<DashboardScheduleData>;
export type MemberDashboardScheduleSuccessResponse =
    ApiSuccessResponse<MemberDashboardScheduleData>;
export type ManagerDashboardScheduleSuccessResponse =
    ApiSuccessResponse<ManagerDashboardScheduleData>;

// 실패 응답
export type DashboardScheduleFailureResponse = ApiFailureResponse;

// 최종 응답 타입
export type DashboardScheduleResponse = ApiResponse<DashboardScheduleData>;
export type MemberDashboardScheduleResponse = ApiResponse<MemberDashboardScheduleData>;
export type ManagerDashboardScheduleResponse = ApiResponse<ManagerDashboardScheduleData>;

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
        workerRole: 'EDITOR'
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
        workerRole: 'THUMBNAILER'
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
        workerRole: 'PLANNER'
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
        workerRole: 'EDITOR'
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
        workerRole: 'CREATOR'
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
        workerRole: 'CREATOR'
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
        workerRole: 'EDITOR'
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
        workerRole: 'PLANNER'
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
        workerRole: 'EDITOR'
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
        workerRole: 'EDITOR'
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
        workerRole: 'EDITOR'
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
        workerRole: 'PLANNER'
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
        workerRole: 'EDITOR'
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
        workerRole: 'EDITOR'
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

/** CANCELLED 기본 제외를 포함하여 Calendar와 오늘 마감에 같은 Project 상태 필터를 적용합니다. */
function matchesProjectStatus(
    projectStatus: ProjectStatus,
    requestedStatus?: ScheduleStatusFilter
) {
    if (requestedStatus === 'CANCELLED') {
        return projectStatus === 'CANCELLED';
    }

    if (projectStatus === 'CANCELLED') {
        return false;
    }

    return !requestedStatus
        || requestedStatus === 'ALL'
        || projectStatus === requestedStatus;
}

/** 내부 작업 금액은 유지하면서 제작팀 권한에 맞는 Calendar 응답 객체를 새로 구성합니다. */
function toCalendarEventResponse(
    event: MockCalendarEvent,
    context: DashboardRequestContext
): CalendarEvent {
    const { workerRole: _workerRole, ...managerEvent } = event;

    if (context.workspaceRole !== 'MEMBER') {
        return managerEvent;
    }

    // MEMBER 응답에는 undefined 값조차 남기지 않고 재무 필드 자체를 제거합니다.
    const { workerAmount: _workerAmount, ...memberEvent } = managerEvent;
    return memberEvent;
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
            // Project 저장소의 최신 Workspace·보관·참여 상태를 화면 필터보다 먼저 검증합니다.
            const project = readAccessibleScheduleProject(workspaceId, event.projectId, context);
            if (!project) {
                return false;
            }

            // 조회 기간과 일정 기간이 단 하루라도 겹치는지 확인합니다.
            const matchesDateRange =
                event.startDate <= request.endDate
                && event.endDate >= request.startDate;

            if (!matchesDateRange) {
                return false;
            }

            // Project의 최신 상태를 사용해 취소 및 상태 필터를 판정합니다.
            if (!matchesProjectStatus(project.status, request.status)) {
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
                && project.channelId !== request.channelId
            ) {
                return false;
            }

            // 프로젝트 제목과 Task Type 중 하나라도 검색어와 일치하면 일정을 유지합니다.
            if (!matchesScheduleKeyword(event, keyword)) {
                return false;
            }

            return true;
        })
        // Task 역할과 권한 없는 재무 정보는 실제 API 응답 경계에서 제거합니다.
        .map(event => toCalendarEventResponse(event, context));
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
            // Calendar와 같은 Project 저장소를 사용해 두 응답 배열의 권한 경계를 맞춥니다.
            const project = readAccessibleScheduleProject(workspaceId, deadline.projectId, context);
            if (!project) {
                return false;
            }

            if (!matchesProjectStatus(project.status, request.status)) {
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
                && project.channelId !== request.channelId
            ) {
                return false;
            }

            // Calendar와 동일한 공통 검색 규칙을 적용하여 두 결과의 불일치를 방지합니다.
            if (!matchesScheduleKeyword(deadline, keyword)) {
                return false;
            }

            return true;
        })
        // 필터링에만 사용한 Task 역할을 제거하고 실제 응답 타입으로 변환합니다.
        .map(({ workerRole: _workerRole, ...deadline }) => deadline);
}

/**
 * 현재 Workspace의 Calendar 일정과 오늘 마감 피드를 조회합니다.
 * 날짜 및 화면 필터를 Mock 데이터에 적용하여 실제 API와 같은 응답 구조를 반환하며,
 * 백엔드 연동 시 동일한 경로와 Query Parameter를 사용하는 HTTP 호출로 교체합니다.
 */
export function getDashboardSchedule(
    workspaceId: number,
    request: DashboardScheduleRequest,
    context: DashboardRequestContext & { workspaceRole: 'MEMBER' }
): Promise<MemberDashboardScheduleResponse>;
export function getDashboardSchedule(
    workspaceId: number,
    request: DashboardScheduleRequest,
    context: DashboardRequestContext & { workspaceRole: 'OWNER' | 'ADMIN' }
): Promise<ManagerDashboardScheduleResponse>;
export function getDashboardSchedule(
    workspaceId: number,
    request: DashboardScheduleRequest,
    context: DashboardRequestContext
): Promise<DashboardScheduleResponse>;
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
