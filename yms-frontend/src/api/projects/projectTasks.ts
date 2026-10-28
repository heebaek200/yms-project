import type { ProjectDetail } from '../../types/project';
import type {
    ChangeProjectTaskStatusRequest,
    ProjectTask,
    ProjectTaskHistory,
    ProjectTaskListPage,
    ProjectTaskListRequest,
    SaveProjectTaskRequest,
    TaskChangedField,
    TaskStatus,
    UpdateProjectTaskRequest,
    VersionedProjectTaskRequest
} from '../../types/projectTask';
import type { WorkspaceRole } from '../../types/workspace';
import { normalizeMoneyInput, sumMoney } from '../../utils/decimal';
import type { ApiFailureResponse, ApiResponse } from '../types';
import { appendTaskNotification } from '../notifications/notifications';
import { findActiveWorkspaceMemberByUserId, readWorkspaceMembers } from '../workspaces/members';
import { readWorkspaceTaskTypes } from '../workspaces/taskTypes';
import {
    getProjectMemberId,
    readProject,
    readProjectMemberMeta,
    replaceProject,
    saveProjectMemberMeta
} from './projectStore';
import {
    appendProjectTaskHistory,
    insertStoredProjectTask,
    readProjectTaskHistories,
    readStoredProjectTask,
    readStoredProjectTasks,
    replaceStoredProjectTask,
    type StoredProjectTask
} from './projectTaskStore';

export type ProjectTaskRequestContext = {
    userId: number;
    userName: string;
    workspaceRole: WorkspaceRole;
};

export type ProjectTaskMutationData = {
    task: ProjectTask;
    dueDateWarning: boolean;
    suggestProjectUpload: boolean;
};

/** 실제 API 왕복에 가까운 로딩 상태를 제공해 중복 제출과 화면 전환을 검증합니다. */
async function waitForMockResponse() {
    await new Promise(resolve => setTimeout(resolve, 220));
}

/** 업무 오류 응답을 같은 Envelope로 만들어 화면의 공통 피드백 처리와 연결합니다. */
function failure(errorCode: string, message: string, field?: string, value?: string | null): ApiFailureResponse {
    return {
        success: false,
        errorCode,
        message,
        errors: field ? [{ field, value: value ?? null, reason: message }] : null
    };
}

/** 현재 사용자의 활성 Workspace Member와 Project Member를 함께 찾습니다. */
function findActor(project: ProjectDetail, context: ProjectTaskRequestContext) {
    const workspaceMember = findActiveWorkspaceMemberByUserId(project.workspaceId, context.userId);
    const projectMember = workspaceMember
        ? project.members.find(member => member.workspaceMemberId === workspaceMember.workspaceMemberId) ?? null
        : null;
    return { workspaceMember, projectMember };
}

/** Workspace 관리자 또는 활성 Project 참여자만 작업을 조회할 수 있습니다. */
function canView(project: ProjectDetail, context: ProjectTaskRequestContext): boolean {
    if (context.workspaceRole !== 'MEMBER') return true;
    return findActor(project, context).projectMember?.active === true;
}

/** 보관되지 않은 Project의 Owner·EDIT 참여자·Workspace 관리자에게 동일한 작업 관리 권한을 줍니다. */
function canManage(project: ProjectDetail, context: ProjectTaskRequestContext): boolean {
    if (project.archivedAt) return false;
    if (context.workspaceRole !== 'MEMBER') return true;
    const { projectMember } = findActor(project, context);
    return projectMember?.active === true && projectMember.permission === 'EDIT';
}

/** 작업 담당자가 현재도 ACTIVE EDIT 참여자인지 판정하고 이력 보존용 문제 상태를 반환합니다. */
function getAssigneeIssue(project: ProjectDetail, task: StoredProjectTask): ProjectTask['assigneeIssue'] {
    const member = project.members.find(item => item.workspaceMemberId === task.assigneeWorkspaceMemberId);
    const workspaceMember = readWorkspaceMembers(project.workspaceId).find(item => item.workspaceMemberId === task.assigneeWorkspaceMemberId);
    if (!member?.active || workspaceMember?.status !== 'ACTIVE') return 'INACTIVE';
    return member.permission === 'EDIT' ? 'NONE' : 'PERMISSION';
}

/** 이력에 보존된 참조 ID를 현재 작업 종류명과 사용자명으로 조회해 화면 표시값을 만듭니다. */
function resolveHistoryFieldValue(
    workspaceId: number,
    projectId: number,
    field: TaskChangedField['field'],
    value: string | null
): string | null {
    if (value === null) return null;

    const referenceId = Number(value);
    if (field === 'taskTypeId') {
        return readWorkspaceTaskTypes(workspaceId)
            .find(taskType => taskType.taskTypeId === referenceId)?.name
            ?? '알 수 없는 작업 종류';
    }

    if (field === 'assigneeProjectMemberId') {
        return readWorkspaceMembers(workspaceId)
            .find(member => getProjectMemberId(projectId, member.workspaceMemberId) === referenceId)?.name
            ?? '알 수 없는 사용자';
    }

    return value;
}

/** 저장된 변경 필드는 그대로 두고 조회 응답에서만 참조 ID를 현재 표시명으로 변환합니다. */
function toHistoryChangedField(
    workspaceId: number,
    projectId: number,
    field: TaskChangedField
): TaskChangedField {
    return {
        ...field,
        previousValue: resolveHistoryFieldValue(workspaceId, projectId, field.field, field.previousValue),
        nextValue: resolveHistoryFieldValue(workspaceId, projectId, field.field, field.nextValue)
    };
}

/** 내부 작업 모델을 이름·권한·금액 마스킹이 적용된 사용자 응답으로 변환합니다. */
function toResponse(project: ProjectDetail, task: StoredProjectTask, context: ProjectTaskRequestContext): ProjectTask {
    const workspaceMember = readWorkspaceMembers(project.workspaceId).find(item => item.workspaceMemberId === task.assigneeWorkspaceMemberId);
    const taskType = readWorkspaceTaskTypes(project.workspaceId).find(item => item.taskTypeId === task.taskTypeId);
    const manager = canManage(project, context);
    const ownTask = workspaceMember?.userId === context.userId;
    const latestRejection = readProjectTaskHistories(task.taskId).find(history => history.eventType === 'REJECTED');
    const assigneeIssue = getAssigneeIssue(project, task);

    const { workerAmount, ...safeTask } = task;
    return {
        ...safeTask,
        taskTypeName: taskType?.name ?? '삭제된 작업 종류',
        assigneeUserId: workspaceMember?.userId ?? 0,
        assigneeName: workspaceMember?.name ?? '참여 종료 멤버',
        ...(manager || ownTask ? { workerAmount } : {}),
        assigneeIssue,
        latestRejectionReason: latestRejection?.rejectionReason ?? null,
        canEdit: manager && task.deletedAt === null && !task.settled && (task.status === 'WAITING' || task.status === 'PROGRESS'),
        canDelete: manager && task.deletedAt === null && !task.settled,
        canRestore: manager && task.deletedAt !== null && !task.settled,
        canChangeStatus: manager && task.deletedAt === null && !task.settled && assigneeIssue === 'NONE'
    };
}

/** Project와 조회 권한을 한 번에 검증해 이후 API가 동일한 경계를 사용하게 합니다. */
function resolveProject(workspaceId: number, projectId: number, context: ProjectTaskRequestContext): ProjectDetail | ApiFailureResponse {
    const project = readProject(workspaceId, projectId);
    if (!project) return failure('PROJECT_NOT_FOUND', '프로젝트를 찾을 수 없습니다.');
    if (!canView(project, context)) return failure('PROJECT_ACCESS_DENIED', '이 프로젝트를 확인할 권한이 없습니다.');
    return project;
}

/** 생성·수정 입력을 검증하고 서버 저장 형식으로 정규화합니다. */
function validateInput(project: ProjectDetail, request: SaveProjectTaskRequest, currentTaskTypeId?: number): ApiFailureResponse | {
    taskTypeId: number;
    assigneeProjectMemberId: number;
    assigneeWorkspaceMemberId: number;
    content: string | null;
    startDate: string | null;
    endDate: string | null;
    workerAmount: string;
} {
    const taskType = readWorkspaceTaskTypes(project.workspaceId).find(item => item.taskTypeId === request.taskTypeId);
    if (!taskType || (!taskType.active && taskType.taskTypeId !== currentTaskTypeId)) return failure('TASK_TYPE_NOT_AVAILABLE', '사용 가능한 작업 종류를 선택해 주세요.', 'taskTypeId', String(request.taskTypeId));

    const exactAssignee = project.members.find(member => (
        project.projectId * 100_000 + member.workspaceMemberId === request.assigneeProjectMemberId
        && member.active
        && member.permission === 'EDIT'
    ));
    if (!exactAssignee) return failure('TASK_ASSIGNEE_NOT_AVAILABLE', '현재 편집 참여자 중 담당자를 선택해 주세요.', 'assigneeProjectMemberId', String(request.assigneeProjectMemberId));
    const activeWorkspaceMember = readWorkspaceMembers(project.workspaceId).find(member => member.workspaceMemberId === exactAssignee.workspaceMemberId && member.status === 'ACTIVE');
    if (!activeWorkspaceMember) return failure('TASK_ASSIGNEE_NOT_AVAILABLE', '현재 제작팀에 참여 중인 담당자를 선택해 주세요.', 'assigneeProjectMemberId', String(request.assigneeProjectMemberId));

    const content = request.content?.trim() || null;
    if (content && content.length > 150) return failure('INVALID_INPUT_VALUE', '작업 내용은 150자 이하로 입력해 주세요.', 'content', request.content);
    const startDate = request.startDate || null;
    const endDate = request.endDate || null;
    if (startDate && endDate && startDate > endDate) return failure('INVALID_TASK_DATE_RANGE', '시작일은 종료일보다 늦을 수 없습니다.', 'endDate', endDate);
    const amount = normalizeMoneyInput(request.workerAmount);
    if (!amount.success) return failure('INVALID_INPUT_VALUE', amount.message, 'workerAmount', request.workerAmount);

    return {
        taskTypeId: request.taskTypeId,
        assigneeProjectMemberId: request.assigneeProjectMemberId,
        assigneeWorkspaceMemberId: exactAssignee.workspaceMemberId,
        content,
        startDate,
        endDate,
        workerAmount: amount.value
    };
}

/** 논리 삭제를 제외한 작업 원본으로 Project 요약 금액·건수와 참여자 미완료 건수를 동기화합니다. */
function synchronizeAggregates(project: ProjectDetail) {
    const activeTasks = readStoredProjectTasks(project.workspaceId, project.projectId).filter(task => task.deletedAt === null);
    replaceProject({
        ...project,
        taskCount: activeTasks.length,
        completedTaskCount: activeTasks.filter(task => task.status === 'COMPLETED').length,
        workerAmount: sumMoney(activeTasks.map(task => task.workerAmount)),
        updatedAt: new Date().toISOString()
    });

    project.members.forEach(member => {
        const meta = readProjectMemberMeta(project.projectId, member.workspaceMemberId);
        if (!meta) return;
        const incompleteTaskCount = activeTasks.filter(task => (
            task.assigneeWorkspaceMemberId === member.workspaceMemberId && task.status !== 'COMPLETED'
        )).length;
        saveProjectMemberMeta({ ...meta, incompleteTaskCount });
    });
}

/** 작업 사건의 실제 수신자에게만 사용자별 알림을 만들고 요청자 자신의 알림은 생략합니다. */
function notifyTask(project: ProjectDetail, task: StoredProjectTask, context: ProjectTaskRequestContext, recipientUserId: number | undefined, messageSummary: string) {
    if (!recipientUserId || recipientUserId === context.userId) return;
    appendTaskNotification({
        recipientUserId,
        workspaceId: project.workspaceId,
        projectId: project.projectId,
        taskId: task.taskId,
        projectTitle: project.title,
        senderName: context.userName,
        messageSummary,
        timestamp: new Date().toISOString()
    });
}

/** 상태 변경으로 카드가 움직이지 않도록 활성은 생성일, 삭제 목록은 삭제일의 최신순으로 정렬합니다. */
function compareTasks(left: StoredProjectTask, right: StoredProjectTask, deletionState: ProjectTaskListRequest['deletedState']): number {
    const leftDate = deletionState === 'DELETED' ? left.deletedAt : left.createdAt;
    const rightDate = deletionState === 'DELETED' ? right.deletedAt : right.createdAt;
    const byDate = (rightDate ?? '').localeCompare(leftDate ?? '');
    return byDate !== 0 ? byDate : right.taskId - left.taskId;
}

/** URL 필터와 직접 진입 anchor를 적용한 작업 목록을 페이지 단위로 반환합니다. */
export async function getProjectTasks(workspaceId: number, projectId: number, request: ProjectTaskListRequest, context: ProjectTaskRequestContext): Promise<ApiResponse<ProjectTaskListPage>> {
    await waitForMockResponse();
    const resolved = resolveProject(workspaceId, projectId, context);
    if (!('projectId' in resolved)) return resolved;
    const project = resolved;
    const deletionState = request.deletedState ?? 'ACTIVE';
    const keyword = request.keyword?.trim().toLocaleLowerCase() ?? '';
    const actor = findActor(project, context).workspaceMember;
    let items = readStoredProjectTasks(workspaceId, projectId).filter(task => deletionState === 'DELETED' ? task.deletedAt !== null : task.deletedAt === null);
    const anchored = request.anchorTaskId ? items.find(task => task.taskId === request.anchorTaskId) : null;
    let filtersOverridden = false;

    items = items.filter(task => {
        const type = readWorkspaceTaskTypes(workspaceId).find(item => item.taskTypeId === task.taskTypeId);
        const member = readWorkspaceMembers(workspaceId).find(item => item.workspaceMemberId === task.assigneeWorkspaceMemberId);
        const matchesKeyword = !keyword || [type?.name, task.content, member?.name].some(value => value?.toLocaleLowerCase().includes(keyword));
        return matchesKeyword
            && (!request.taskTypeId || task.taskTypeId === request.taskTypeId)
            && (!request.assigneeProjectMemberId || task.assigneeProjectMemberId === request.assigneeProjectMemberId)
            && (!request.status || request.status === 'ALL' || task.status === request.status)
            && (!request.mineOnly || actor?.workspaceMemberId === task.assigneeWorkspaceMemberId);
    });

    if (anchored && !items.some(task => task.taskId === anchored.taskId)) {
        items = [anchored, ...items];
        filtersOverridden = true;
    }
    items.sort((left, right) => compareTasks(left, right, deletionState));
    const size = request.size === 20 ? 20 : 20;
    const requestedPage = Math.max(1, request.page ?? 1);
    const anchorIndex = anchored ? items.findIndex(task => task.taskId === anchored.taskId) : -1;
    const page = anchorIndex >= 0 ? Math.floor(anchorIndex / size) + 1 : requestedPage;
    const totalPages = Math.max(1, Math.ceil(items.length / size));
    const safePage = Math.min(page, totalPages);
    const pageItems = items.slice((safePage - 1) * size, safePage * size);

    return { success: true, data: {
        items: pageItems.map(task => toResponse(project, task, context)),
        page: safePage,
        pageSize: size,
        totalCount: items.length,
        totalPages,
        filtersOverridden,
        anchorMatched: anchorIndex >= 0
    } };
}

/** 직접 링크와 알림 이동에서 필터에 가려지기 전 작업 한 건을 먼저 조회합니다. */
export async function getProjectTask(workspaceId: number, projectId: number, taskId: number, context: ProjectTaskRequestContext): Promise<ApiResponse<ProjectTask>> {
    await waitForMockResponse();
    const resolved = resolveProject(workspaceId, projectId, context);
    if (!('projectId' in resolved)) return resolved;
    const task = readStoredProjectTask(workspaceId, projectId, taskId);
    if (!task) return failure('TASK_NOT_FOUND', '작업을 찾을 수 없습니다.');
    return { success: true, data: toResponse(resolved, task, context) };
}

/** 새 작업을 대기 상태로 생성하고 Project 집계를 즉시 갱신합니다. */
export async function createProjectTask(workspaceId: number, projectId: number, request: SaveProjectTaskRequest, context: ProjectTaskRequestContext): Promise<ApiResponse<ProjectTaskMutationData>> {
    await waitForMockResponse();
    const resolved = resolveProject(workspaceId, projectId, context);
    if (!('projectId' in resolved)) return resolved;
    if (!canManage(resolved, context)) return failure('TASK_MANAGEMENT_FORBIDDEN', '작업을 생성할 권한이 없습니다.');
    const validated = validateInput(resolved, request);
    if ('success' in validated) return validated;
    const now = new Date().toISOString();
    const task = insertStoredProjectTask({ ...validated, workspaceId, projectId, status: 'WAITING', completedAt: null, version: 1, createdAt: now, deletedAt: null, deletedByName: null, settled: false });
    appendProjectTaskHistory(task.taskId, { eventType: 'CREATED', toStatus: 'WAITING', processedByName: context.userName, processedAt: now });
    const assignee = readWorkspaceMembers(workspaceId).find(member => member.workspaceMemberId === task.assigneeWorkspaceMemberId);
    notifyTask(resolved, task, context, assignee?.userId, `${readWorkspaceTaskTypes(workspaceId).find(type => type.taskTypeId === task.taskTypeId)?.name ?? '작업'} 담당자로 배정되었습니다.`);
    synchronizeAggregates(resolved);
    return { success: true, message: '작업을 추가했습니다.', data: { task: toResponse(readProject(workspaceId, projectId)!, task, context), dueDateWarning: Boolean(task.endDate && resolved.dueDate && task.endDate > resolved.dueDate), suggestProjectUpload: false } };
}

/** 대기·진행 중 작업의 일반 필드만 수정하고 실제 변경 필드를 감사 이력에 남깁니다. */
export async function updateProjectTask(workspaceId: number, projectId: number, taskId: number, request: UpdateProjectTaskRequest, context: ProjectTaskRequestContext): Promise<ApiResponse<ProjectTaskMutationData>> {
    await waitForMockResponse();
    const resolved = resolveProject(workspaceId, projectId, context);
    if (!('projectId' in resolved)) return resolved;
    const current = readStoredProjectTask(workspaceId, projectId, taskId);
    if (!current) return failure('TASK_NOT_FOUND', '작업을 찾을 수 없습니다.');
    if (current.settled) return failure('TASK_ALREADY_SETTLED', '정산이 확정된 작업은 수정할 수 없습니다.');
    if (!canManage(resolved, context) || current.deletedAt || !['WAITING', 'PROGRESS'].includes(current.status)) return failure('TASK_EDIT_NOT_ALLOWED', '현재 상태에서는 작업 정보를 수정할 수 없습니다.');
    if (current.version !== request.expectedVersion) return failure('TASK_VERSION_CONFLICT', '다른 사용자가 먼저 변경했습니다. 최신 내용을 다시 확인해 주세요.');
    const validated = validateInput(resolved, request, current.taskTypeId);
    if ('success' in validated) return validated;
    const labels: Record<keyof typeof validated, string> = { taskTypeId: '작업 종류', assigneeProjectMemberId: '담당자', assigneeWorkspaceMemberId: '담당자', content: '작업 내용', startDate: '시작일', endDate: '종료일', workerAmount: '작업 금액' };
    const changedFields = (Object.keys(validated) as (keyof typeof validated)[])
        .filter(field => field !== 'assigneeWorkspaceMemberId' && String(current[field]) !== String(validated[field]))
        .map(field => ({ field, label: labels[field], previousValue: current[field] === null ? null : String(current[field]), nextValue: validated[field] === null ? null : String(validated[field]) })) as TaskChangedField[];
    if (changedFields.length === 0) {
        return { success: true, message: '변경된 내용이 없습니다.', data: { task: toResponse(resolved, current, context), dueDateWarning: Boolean(current.endDate && resolved.dueDate && current.endDate > resolved.dueDate), suggestProjectUpload: false } };
    }
    const updated = { ...current, ...validated, version: current.version + 1 };
    replaceStoredProjectTask(updated);
    appendProjectTaskHistory(taskId, { eventType: 'UPDATED', changedFields, processedByName: context.userName, processedAt: new Date().toISOString() });
    if (current.assigneeWorkspaceMemberId !== updated.assigneeWorkspaceMemberId) {
        const members = readWorkspaceMembers(workspaceId);
        const previousAssignee = members.find(member => member.workspaceMemberId === current.assigneeWorkspaceMemberId);
        const nextAssignee = members.find(member => member.workspaceMemberId === updated.assigneeWorkspaceMemberId);
        notifyTask(resolved, updated, context, previousAssignee?.userId, '작업 담당자에서 해제되었습니다.');
        notifyTask(resolved, updated, context, nextAssignee?.userId, '작업 담당자로 새로 배정되었습니다.');
    }
    synchronizeAggregates(resolved);
    return { success: true, message: '작업 정보를 수정했습니다.', data: { task: toResponse(readProject(workspaceId, projectId)!, updated, context), dueDateWarning: Boolean(updated.endDate && resolved.dueDate && updated.endDate > resolved.dueDate), suggestProjectUpload: false } };
}

const NEXT_STATUSES: Record<TaskStatus, TaskStatus[]> = { WAITING: ['PROGRESS'], PROGRESS: ['REVIEW'], REVIEW: ['PROGRESS', 'COMPLETED'], COMPLETED: ['REVIEW'] };

/** 인접 상태 전이만 허용하고 반려 사유·완료 시각·마지막 작업 안내를 함께 처리합니다. */
export async function changeProjectTaskStatus(workspaceId: number, projectId: number, taskId: number, request: ChangeProjectTaskStatusRequest, context: ProjectTaskRequestContext): Promise<ApiResponse<ProjectTaskMutationData>> {
    await waitForMockResponse();
    const resolved = resolveProject(workspaceId, projectId, context);
    if (!('projectId' in resolved)) return resolved;
    const current = readStoredProjectTask(workspaceId, projectId, taskId);
    if (!current) return failure('TASK_NOT_FOUND', '작업을 찾을 수 없습니다.');
    if (current.settled) return failure('TASK_ALREADY_SETTLED', '정산이 확정된 작업은 상태를 변경할 수 없습니다.');
    if (!canManage(resolved, context) || current.deletedAt) return failure('TASK_STATUS_CHANGE_FORBIDDEN', '작업 상태를 변경할 권한이 없습니다.');
    if (current.version !== request.expectedVersion) return failure('TASK_VERSION_CONFLICT', '다른 사용자가 먼저 변경했습니다. 최신 내용을 다시 확인해 주세요.');
    if (getAssigneeIssue(resolved, current) !== 'NONE') return failure('TASK_ASSIGNEE_REASSIGNMENT_REQUIRED', '담당자를 현재 ACTIVE EDIT 참여자로 다시 지정해 주세요.');
    if (!NEXT_STATUSES[current.status].includes(request.status)) return failure('INVALID_TASK_STATUS_TRANSITION', '현재 상태에서 선택한 상태로 바로 변경할 수 없습니다.');
    const rejectionReason = request.rejectionReason?.trim() || null;
    if (current.status === 'REVIEW' && request.status === 'PROGRESS' && (!rejectionReason || rejectionReason.length > 500)) return failure('INVALID_REJECTION_REASON', '반려 사유를 1자 이상 500자 이하로 입력해 주세요.', 'rejectionReason', request.rejectionReason);
    const now = new Date().toISOString();
    const updated = { ...current, status: request.status, completedAt: request.status === 'COMPLETED' ? now : null, version: current.version + 1 };
    replaceStoredProjectTask(updated);
    appendProjectTaskHistory(taskId, { eventType: rejectionReason ? 'REJECTED' : 'STATUS_CHANGED', fromStatus: current.status, toStatus: request.status, rejectionReason, processedByName: context.userName, processedAt: now });
    const assignee = readWorkspaceMembers(workspaceId).find(member => member.workspaceMemberId === updated.assigneeWorkspaceMemberId);
    if (current.status === 'PROGRESS' && request.status === 'REVIEW') {
        const owner = resolved.members.find(member => member.workspaceMemberId === resolved.ownerWorkspaceMemberId);
        notifyTask(resolved, updated, context, owner?.userId, '작업 검수를 요청했습니다.');
    } else if (rejectionReason) {
        notifyTask(resolved, updated, context, assignee?.userId, `작업이 반려되었습니다. 사유: ${rejectionReason}`);
    } else if (request.status === 'COMPLETED') {
        notifyTask(resolved, updated, context, assignee?.userId, '작업이 완료되었습니다.');
    }
    synchronizeAggregates(resolved);
    const active = readStoredProjectTasks(workspaceId, projectId).filter(task => task.deletedAt === null);
    const suggestProjectUpload = request.status === 'COMPLETED' && active.length > 0 && active.every(task => task.status === 'COMPLETED') && !['UPLOADED', 'CANCELLED'].includes(resolved.status);
    return { success: true, message: request.status === 'PROGRESS' && rejectionReason ? '작업을 반려했습니다.' : '작업 상태를 변경했습니다.', data: { task: toResponse(readProject(workspaceId, projectId)!, updated, context), dueDateWarning: false, suggestProjectUpload } };
}

/** 확인된 정산 작업은 보호하고 그 외 작업을 논리 삭제합니다. */
export async function deleteProjectTask(workspaceId: number, projectId: number, taskId: number, request: VersionedProjectTaskRequest, context: ProjectTaskRequestContext): Promise<ApiResponse<ProjectTask>> {
    await waitForMockResponse();
    const resolved = resolveProject(workspaceId, projectId, context);
    if (!('projectId' in resolved)) return resolved;
    const current = readStoredProjectTask(workspaceId, projectId, taskId);
    if (!current) return failure('TASK_NOT_FOUND', '작업을 찾을 수 없습니다.');
    if (current.settled) return failure('TASK_ALREADY_SETTLED', '정산이 확정된 작업은 삭제할 수 없습니다.');
    if (!canManage(resolved, context) || current.deletedAt) return failure('TASK_DELETE_FORBIDDEN', '작업을 삭제할 수 없습니다.');
    if (current.version !== request.expectedVersion) return failure('TASK_VERSION_CONFLICT', '다른 사용자가 먼저 변경했습니다. 최신 내용을 다시 확인해 주세요.');
    const now = new Date().toISOString();
    const updated = { ...current, deletedAt: now, deletedByName: context.userName, version: current.version + 1 };
    replaceStoredProjectTask(updated);
    appendProjectTaskHistory(taskId, { eventType: 'DELETED', processedByName: context.userName, processedAt: now });
    const assignee = readWorkspaceMembers(workspaceId).find(member => member.workspaceMemberId === updated.assigneeWorkspaceMemberId);
    notifyTask(resolved, updated, context, assignee?.userId, '작업이 삭제되었습니다.');
    synchronizeAggregates(resolved);
    return { success: true, message: '작업을 삭제했습니다.', data: toResponse(readProject(workspaceId, projectId)!, updated, context) };
}

/** 삭제 목록의 작업을 같은 ID와 이력으로 복원해 활성 집계에 다시 포함합니다. */
export async function restoreProjectTask(workspaceId: number, projectId: number, taskId: number, request: VersionedProjectTaskRequest, context: ProjectTaskRequestContext): Promise<ApiResponse<ProjectTask>> {
    await waitForMockResponse();
    const resolved = resolveProject(workspaceId, projectId, context);
    if (!('projectId' in resolved)) return resolved;
    const current = readStoredProjectTask(workspaceId, projectId, taskId);
    if (!current) return failure('TASK_NOT_FOUND', '작업을 찾을 수 없습니다.');
    if (current.settled) return failure('TASK_ALREADY_SETTLED', '정산이 확정된 작업은 복원할 수 없습니다.');
    if (!canManage(resolved, context) || !current.deletedAt) return failure('TASK_RESTORE_FORBIDDEN', '작업을 복원할 수 없습니다.');
    if (current.version !== request.expectedVersion) return failure('TASK_VERSION_CONFLICT', '다른 사용자가 먼저 변경했습니다. 최신 내용을 다시 확인해 주세요.');
    const now = new Date().toISOString();
    const updated = { ...current, deletedAt: null, deletedByName: null, version: current.version + 1 };
    replaceStoredProjectTask(updated);
    appendProjectTaskHistory(taskId, { eventType: 'RESTORED', processedByName: context.userName, processedAt: now });
    const assignee = readWorkspaceMembers(workspaceId).find(member => member.workspaceMemberId === updated.assigneeWorkspaceMemberId);
    notifyTask(resolved, updated, context, assignee?.userId, '작업이 복원되었습니다.');
    synchronizeAggregates(resolved);
    return { success: true, message: '작업을 복원했습니다.', data: toResponse(readProject(workspaceId, projectId)!, updated, context) };
}

/** 조회 가능한 작업의 생성·수정·상태·삭제·복원 이력을 최신순으로 반환합니다. */
export async function getProjectTaskHistories(workspaceId: number, projectId: number, taskId: number, context: ProjectTaskRequestContext): Promise<ApiResponse<ProjectTaskHistory[]>> {
    await waitForMockResponse();
    const resolved = resolveProject(workspaceId, projectId, context);
    if (!('projectId' in resolved)) return resolved;
    const task = readStoredProjectTask(workspaceId, projectId, taskId);
    if (!task) return failure('TASK_NOT_FOUND', '작업을 찾을 수 없습니다.');
    const canSeeAmount = toResponse(resolved, task, context).workerAmount !== undefined;
    const histories = readProjectTaskHistories(taskId).map(history => ({
        ...history,
        changedFields: (canSeeAmount
            ? history.changedFields
            : history.changedFields.filter(field => field.field !== 'workerAmount'))
            .map(field => toHistoryChangedField(workspaceId, projectId, field))
    }));
    return { success: true, data: histories };
}
