import type {
    ProjectTaskHistory,
    TaskChangedField,
    TaskHistoryEvent,
    TaskStatus
} from '../../types/projectTask';
import { getProjectMemberId } from './projectStore';

export type StoredProjectTask = {
    taskId: number;
    workspaceId: number;
    projectId: number;
    taskTypeId: number;
    content: string | null;
    assigneeProjectMemberId: number;
    assigneeWorkspaceMemberId: number;
    startDate: string | null;
    endDate: string | null;
    workerAmount: string;
    status: TaskStatus;
    completedAt: string | null;
    version: number;
    createdAt: string;
    deletedAt: string | null;
    deletedByName: string | null;
    settled: boolean;
};

let nextTaskId = 301;
let nextHistoryId = 1;

/** 프로젝트의 기존 요약 수치와 일치하는 작업 원본을 준비해 목록·집계·일정 검증에 함께 사용합니다. */
let projectTasks: StoredProjectTask[] = [
    { taskId: 101, workspaceId: 1, projectId: 11, taskTypeId: 1, content: '촬영본 1차 컷 정리', assigneeProjectMemberId: getProjectMemberId(11, 104), assigneeWorkspaceMemberId: 104, startDate: '2026-10-10', endDate: '2026-10-13', workerAmount: '250000.00', status: 'COMPLETED', completedAt: '2026-10-13T18:00:00+09:00', version: 1, createdAt: '2026-10-09T09:00:00+09:00', deletedAt: null, deletedByName: null, settled: false },
    { taskId: 102, workspaceId: 1, projectId: 11, taskTypeId: 2, content: '최종 리뷰 편집', assigneeProjectMemberId: getProjectMemberId(11, 104), assigneeWorkspaceMemberId: 104, startDate: '2026-10-14', endDate: '2026-10-22', workerAmount: '650000.00', status: 'REVIEW', completedAt: null, version: 2, createdAt: '2026-10-09T09:10:00+09:00', deletedAt: null, deletedByName: null, settled: false },
    { taskId: 103, workspaceId: 1, projectId: 11, taskTypeId: 3, content: null, assigneeProjectMemberId: getProjectMemberId(11, 101), assigneeWorkspaceMemberId: 101, startDate: '2026-10-17', endDate: '2026-10-20', workerAmount: '180000.00', status: 'COMPLETED', completedAt: '2026-10-20T16:00:00+09:00', version: 1, createdAt: '2026-10-09T09:20:00+09:00', deletedAt: null, deletedByName: null, settled: false },
    { taskId: 104, workspaceId: 1, projectId: 11, taskTypeId: 4, content: '메인 썸네일 시안', assigneeProjectMemberId: getProjectMemberId(11, 101), assigneeWorkspaceMemberId: 101, startDate: '2026-10-18', endDate: '2026-10-21', workerAmount: '120000.00', status: 'COMPLETED', completedAt: '2026-10-21T13:00:00+09:00', version: 1, createdAt: '2026-10-09T09:30:00+09:00', deletedAt: null, deletedByName: null, settled: false },
    { taskId: 111, workspaceId: 1, projectId: 12, taskTypeId: 1, content: null, assigneeProjectMemberId: getProjectMemberId(12, 104), assigneeWorkspaceMemberId: 104, startDate: '2026-09-28', endDate: '2026-09-29', workerAmount: '100000.00', status: 'COMPLETED', completedAt: '2026-09-29T18:00:00+09:00', version: 1, createdAt: '2026-09-27T09:00:00+09:00', deletedAt: null, deletedByName: null, settled: true },
    { taskId: 112, workspaceId: 1, projectId: 12, taskTypeId: 2, content: '쇼츠 본편 편집', assigneeProjectMemberId: getProjectMemberId(12, 104), assigneeWorkspaceMemberId: 104, startDate: '2026-09-29', endDate: '2026-10-02', workerAmount: '200000.00', status: 'COMPLETED', completedAt: '2026-10-02T18:00:00+09:00', version: 1, createdAt: '2026-09-27T09:10:00+09:00', deletedAt: null, deletedByName: null, settled: false },
    { taskId: 113, workspaceId: 1, projectId: 12, taskTypeId: 4, content: null, assigneeProjectMemberId: getProjectMemberId(12, 102), assigneeWorkspaceMemberId: 102, startDate: null, endDate: '2026-10-03', workerAmount: '50000.00', status: 'COMPLETED', completedAt: '2026-10-03T10:00:00+09:00', version: 1, createdAt: '2026-09-27T09:20:00+09:00', deletedAt: null, deletedByName: null, settled: false },
    { taskId: 141, workspaceId: 1, projectId: 14, taskTypeId: 2, content: '비하인드 본편 편집', assigneeProjectMemberId: getProjectMemberId(14, 104), assigneeWorkspaceMemberId: 104, startDate: '2026-10-20', endDate: '2026-10-28', workerAmount: '500000.00', status: 'REVIEW', completedAt: null, version: 2, createdAt: '2026-10-19T09:00:00+09:00', deletedAt: null, deletedByName: null, settled: false },
    { taskId: 142, workspaceId: 1, projectId: 14, taskTypeId: 3, content: '최종 자막 검수', assigneeProjectMemberId: getProjectMemberId(14, 104), assigneeWorkspaceMemberId: 104, startDate: '2026-10-18', endDate: '2026-10-20', workerAmount: '100000.00', status: 'COMPLETED', completedAt: '2026-10-20T17:00:00+09:00', version: 1, createdAt: '2026-10-18T09:00:00+09:00', deletedAt: null, deletedByName: null, settled: false },
    { taskId: 151, workspaceId: 1, projectId: 15, taskTypeId: 4, content: '장비 배치 썸네일', assigneeProjectMemberId: getProjectMemberId(15, 101), assigneeWorkspaceMemberId: 101, startDate: null, endDate: '2026-10-31', workerAmount: '200000.00', status: 'WAITING', completedAt: null, version: 1, createdAt: '2026-10-17T11:00:00+09:00', deletedAt: null, deletedByName: null, settled: false },
    { taskId: 152, workspaceId: 1, projectId: 15, taskTypeId: 5, content: '지난 시즌 더빙 확인', assigneeProjectMemberId: getProjectMemberId(15, 101), assigneeWorkspaceMemberId: 101, startDate: null, endDate: null, workerAmount: '50000.00', status: 'WAITING', completedAt: null, version: 2, createdAt: '2026-09-10T11:00:00+09:00', deletedAt: '2026-09-12T14:00:00+09:00', deletedByName: '테스트 사용자', settled: false },
    { taskId: 201, workspaceId: 2, projectId: 31, taskTypeId: 21, content: '샘플 콘텐츠 편집', assigneeProjectMemberId: getProjectMemberId(31, 201), assigneeWorkspaceMemberId: 201, startDate: '2026-10-20', endDate: '2026-10-24', workerAmount: '250000.00', status: 'PROGRESS', completedAt: null, version: 1, createdAt: '2026-09-14T09:00:00+09:00', deletedAt: null, deletedByName: null, settled: false },
    { taskId: 202, workspaceId: 2, projectId: 32, taskTypeId: 21, content: '마감본 편집', assigneeProjectMemberId: getProjectMemberId(32, 202), assigneeWorkspaceMemberId: 202, startDate: '2026-10-22', endDate: '2026-10-29', workerAmount: '180000.00', status: 'WAITING', completedAt: null, version: 1, createdAt: '2026-09-26T09:00:00+09:00', deletedAt: null, deletedByName: null, settled: false }
];

let taskHistories: ProjectTaskHistory[] = projectTasks.map(task => ({
    historyId: nextHistoryId++,
    eventType: 'CREATED',
    fromStatus: null,
    toStatus: 'WAITING',
    rejectionReason: null,
    changedFields: [],
    processedByName: 'SYSTEM',
    processedAt: task.createdAt
}));
const taskHistoryOwners = new Map<number, number>(taskHistories.map((history, index) => [history.historyId, projectTasks[index].taskId]));

/** 저장 객체가 호출자에 의해 바뀌지 않도록 작업 원본을 복사합니다. */
function cloneTask(task: StoredProjectTask): StoredProjectTask {
    return { ...task };
}

/** Workspace 또는 Project 기준으로 논리 삭제 항목을 포함한 작업 원본 복사본을 반환합니다. */
export function readStoredProjectTasks(workspaceId: number, projectId?: number): StoredProjectTask[] {
    return projectTasks
        .filter(task => task.workspaceId === workspaceId && (projectId === undefined || task.projectId === projectId))
        .map(cloneTask);
}

/** Task ID와 Project 경계를 함께 검증해 작업 한 건을 반환합니다. */
export function readStoredProjectTask(workspaceId: number, projectId: number, taskId: number): StoredProjectTask | null {
    const task = projectTasks.find(item => item.workspaceId === workspaceId && item.projectId === projectId && item.taskId === taskId);
    return task ? cloneTask(task) : null;
}

/** 검증된 신규 작업에 ID를 발급하고 저장합니다. */
export function insertStoredProjectTask(task: Omit<StoredProjectTask, 'taskId'>): StoredProjectTask {
    const created = { ...task, taskId: nextTaskId++ };
    projectTasks = [...projectTasks, created];
    return cloneTask(created);
}

/** 낙관적 잠금 검증이 끝난 작업의 최신 상태를 교체합니다. */
export function replaceStoredProjectTask(task: StoredProjectTask) {
    projectTasks = projectTasks.map(item => item.taskId === task.taskId ? cloneTask(task) : item);
}

/** Task Type 물리 삭제 검증에서 논리 삭제 작업까지 포함한 참조 존재 여부를 제공합니다. */
export function isTaskTypeReferenced(workspaceId: number, taskTypeId: number): boolean {
    return projectTasks.some(task => task.workspaceId === workspaceId && task.taskTypeId === taskTypeId);
}

/** 변경 사건을 append-only 이력으로 기록하고 작업과의 소유 관계를 별도로 보존합니다. */
export function appendProjectTaskHistory(taskId: number, history: {
    eventType: TaskHistoryEvent;
    fromStatus?: TaskStatus | null;
    toStatus?: TaskStatus | null;
    rejectionReason?: string | null;
    changedFields?: TaskChangedField[];
    processedByName: string;
    processedAt: string;
}) {
    const stored: ProjectTaskHistory = {
        historyId: nextHistoryId++,
        eventType: history.eventType,
        fromStatus: history.fromStatus ?? null,
        toStatus: history.toStatus ?? null,
        rejectionReason: history.rejectionReason ?? null,
        changedFields: history.changedFields?.map(field => ({ ...field })) ?? [],
        processedByName: history.processedByName,
        processedAt: history.processedAt
    };
    taskHistories = [...taskHistories, stored];
    taskHistoryOwners.set(stored.historyId, taskId);
}

/** 선택한 작업의 통합 변경 이력을 최신순 복사본으로 반환합니다. */
export function readProjectTaskHistories(taskId: number): ProjectTaskHistory[] {
    return taskHistories
        .filter(history => taskHistoryOwners.get(history.historyId) === taskId)
        .sort((left, right) => right.processedAt.localeCompare(left.processedAt))
        .map(history => ({ ...history, changedFields: history.changedFields.map(field => ({ ...field })) }));
}

// 논리 삭제·복원과 비활성 작업 종류 참조를 즉시 검증할 수 있도록 기존 삭제 사건을 보존합니다.
appendProjectTaskHistory(152, {
    eventType: 'DELETED',
    processedByName: '테스트 사용자',
    processedAt: '2026-09-12T14:00:00+09:00'
});
