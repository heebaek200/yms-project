import type { UserRole } from '../../types/auth';
import type { TaskStatus } from '../../types/projectTask';
export type { TaskStatus } from '../../types/projectTask';
import type { ApiFailureResponse, ApiResponse, ApiSuccessResponse } from '../types';
import { readProjects } from '../projects/projectStore';
import { readStoredProjectTasks } from '../projects/projectTaskStore';
import { readWorkspaceMembers } from '../workspaces/members';
import { readWorkspaceTaskTypes } from '../workspaces/taskTypes';
import type { DashboardRequestContext } from './types';

type MockScenario = 'SUCCESS' | 'EMPTY_DEADLINES' | 'INVALID_DATE_RANGE' | 'UNAUTHORIZED' | 'SERVER_ERROR';
let mockScenario: MockScenario = 'SUCCESS';

export type ProjectStatus = 'PLANNING' | 'EDITING' | 'REVIEW' | 'UPLOADED' | 'CANCELLED';
export type ScheduleRoleFilter = 'ALL' | 'MY_TASK' | UserRole;
export type ScheduleStatusFilter = 'ALL' | ProjectStatus;
export type DashboardScheduleRequest = { startDate: string; endDate: string; status?: ScheduleStatusFilter; role?: ScheduleRoleFilter; channelId?: number; keyword?: string };

export type CalendarEvent = {
    taskId: number;
    projectId: number;
    projectTitle: string;
    taskTypeId: number;
    taskTypeName: string;
    workerName: string;
    startDate: string;
    endDate: string;
    taskStatus: TaskStatus;
    workerAmount?: string;
};
export type MemberCalendarEvent = CalendarEvent;
export type ManagerCalendarEvent = CalendarEvent & { workerAmount: string };
export type TodayDeadline = Omit<CalendarEvent, 'startDate' | 'workerAmount'>;
export type DashboardScheduleData<TEvent extends CalendarEvent = CalendarEvent> = { calendarEvents: TEvent[]; todayDeadlines: TodayDeadline[] };
export type MemberDashboardScheduleData = DashboardScheduleData<MemberCalendarEvent>;
export type ManagerDashboardScheduleData = DashboardScheduleData<ManagerCalendarEvent>;
export type DashboardScheduleSuccessResponse = ApiSuccessResponse<DashboardScheduleData>;
export type MemberDashboardScheduleSuccessResponse = ApiSuccessResponse<MemberDashboardScheduleData>;
export type ManagerDashboardScheduleSuccessResponse = ApiSuccessResponse<ManagerDashboardScheduleData>;
export type DashboardScheduleFailureResponse = ApiFailureResponse;
export type DashboardScheduleResponse = ApiResponse<DashboardScheduleData>;
export type MemberDashboardScheduleResponse = ApiResponse<MemberDashboardScheduleData>;
export type ManagerDashboardScheduleResponse = ApiResponse<ManagerDashboardScheduleData>;

/** Dashboard Schedule Mock의 성공·빈 목록·오류 시나리오를 수동 테스트용으로 변경합니다. */
export function setDashboardScheduleMockScenario(scenario: MockScenario) {
    mockScenario = scenario;
}

/** 날짜가 하나만 입력된 작업도 하루 일정으로 보이도록 Calendar 범위를 계산합니다. */
function resolveScheduleRange(startDate: string | null, endDate: string | null) {
    const singleDate = startDate ?? endDate;
    if (!singleDate) return null;
    return { startDate: startDate ?? singleDate, endDate: endDate ?? singleDate };
}

/** MEMBER에게는 활성 참여 Project만 노출하고 관리자에게는 제작팀 전체 활성 Project를 제공합니다. */
function canViewProject(project: ReturnType<typeof readProjects>[number], context: DashboardRequestContext): boolean {
    return context.workspaceRole !== 'MEMBER'
        || project.members.some(member => member.userId === context.userId && member.active);
}

/** 일반 멤버의 작업 금액은 Project EDIT 참여 또는 자기 담당 작업에만 포함합니다. */
function canViewAmount(project: ReturnType<typeof readProjects>[number], assigneeUserId: number, context: DashboardRequestContext): boolean {
    return context.workspaceRole !== 'MEMBER'
        || assigneeUserId === context.userId
        || project.members.some(member => member.userId === context.userId && member.active && member.permission === 'EDIT');
}

/** 상태·역할·채널·검색어를 Project와 Task 원본에 동시에 적용합니다. */
function matchesFilters(project: ReturnType<typeof readProjects>[number], task: ReturnType<typeof readStoredProjectTasks>[number], request: DashboardScheduleRequest, context: DashboardRequestContext) {
    if (request.status === 'CANCELLED' ? project.status !== 'CANCELLED' : project.status === 'CANCELLED') return false;
    if (request.status && request.status !== 'ALL' && project.status !== request.status) return false;
    if (request.channelId !== undefined && project.channelId !== request.channelId) return false;
    const member = readWorkspaceMembers(project.workspaceId).find(item => item.workspaceMemberId === task.assigneeWorkspaceMemberId);
    if (request.role === 'MY_TASK' && member?.userId !== context.userId) return false;
    if (request.role && request.role !== 'ALL' && request.role !== 'MY_TASK' && !member?.professionalRoles.includes(request.role)) return false;
    const taskType = readWorkspaceTaskTypes(project.workspaceId).find(item => item.taskTypeId === task.taskTypeId);
    const keyword = request.keyword?.trim().toLocaleLowerCase() ?? '';
    return !keyword || [project.title, taskType?.name, task.content, member?.name].some(value => value?.toLocaleLowerCase().includes(keyword));
}

/** Task 저장소의 최신 일정과 삭제 상태를 사용해 Calendar 및 오늘 마감 응답을 만듭니다. */
function buildSchedule(workspaceId: number, request: DashboardScheduleRequest, context: DashboardRequestContext): DashboardScheduleData {
    const projects = readProjects().filter(project => project.workspaceId === workspaceId && !project.archivedAt && canViewProject(project, context));
    const projectById = new Map(projects.map(project => [project.projectId, project]));
    const events: CalendarEvent[] = [];
    readStoredProjectTasks(workspaceId).filter(task => task.deletedAt === null).forEach(task => {
        const project = projectById.get(task.projectId);
        const range = resolveScheduleRange(task.startDate, task.endDate);
        if (!project || !range || !matchesFilters(project, task, request, context)) return;
        if (range.startDate > request.endDate || range.endDate < request.startDate) return;
        const member = readWorkspaceMembers(workspaceId).find(item => item.workspaceMemberId === task.assigneeWorkspaceMemberId);
        const taskType = readWorkspaceTaskTypes(workspaceId).find(item => item.taskTypeId === task.taskTypeId);
        events.push({ taskId: task.taskId, projectId: project.projectId, projectTitle: project.title, taskTypeId: task.taskTypeId, taskTypeName: taskType?.name ?? '삭제된 작업 종류', workerName: member?.name ?? '참여 종료 멤버', startDate: range.startDate, endDate: range.endDate, taskStatus: task.status, ...(canViewAmount(project, member?.userId ?? 0, context) ? { workerAmount: task.workerAmount } : {}) });
    });
    const today = new Date().toLocaleDateString('sv-SE');
    const todayDeadlines = mockScenario === 'EMPTY_DEADLINES' ? [] : events.filter(event => event.endDate === today && event.taskStatus !== 'COMPLETED').map(({ workerAmount: _amount, startDate: _startDate, ...deadline }) => deadline);
    return { calendarEvents: events, todayDeadlines };
}

export function getDashboardSchedule(workspaceId: number, request: DashboardScheduleRequest, context: DashboardRequestContext & { workspaceRole: 'MEMBER' }): Promise<MemberDashboardScheduleResponse>;
export function getDashboardSchedule(workspaceId: number, request: DashboardScheduleRequest, context: DashboardRequestContext & { workspaceRole: 'OWNER' | 'ADMIN' }): Promise<ManagerDashboardScheduleResponse>;
export function getDashboardSchedule(workspaceId: number, request: DashboardScheduleRequest, context: DashboardRequestContext): Promise<DashboardScheduleResponse>;
/** 현재 제작팀의 최신 Task 일정과 마감 피드를 조회합니다. */
export async function getDashboardSchedule(workspaceId: number, request: DashboardScheduleRequest, context: DashboardRequestContext): Promise<DashboardScheduleResponse> {
    await new Promise(resolve => setTimeout(resolve, 300));
    if (request.startDate > request.endDate || mockScenario === 'INVALID_DATE_RANGE') return { success: false, errorCode: 'INVALID_DATE_RANGE', message: '조회 시작일은 종료일보다 이후일 수 없습니다.', errors: null };
    if (mockScenario === 'UNAUTHORIZED') return { success: false, errorCode: 'UNAUTHORIZED_SESSION', message: '로그인 정보가 만료되었습니다. 다시 로그인해 주세요.', errors: null };
    if (mockScenario === 'SERVER_ERROR') return { success: false, errorCode: 'INTERNAL_SERVER_ERROR', message: '스케줄 정보를 불러오는 중 오류가 발생했습니다.', errors: null };
    return { success: true, data: buildSchedule(workspaceId, request, context) };
}
