export type TaskStatus = 'WAITING' | 'PROGRESS' | 'REVIEW' | 'COMPLETED';
export type TaskDeletionState = 'ACTIVE' | 'DELETED';
export type TaskAssigneeIssue = 'NONE' | 'PERMISSION' | 'INACTIVE';
export type TaskHistoryEvent =
    | 'CREATED'
    | 'UPDATED'
    | 'STATUS_CHANGED'
    | 'REJECTED'
    | 'DELETED'
    | 'RESTORED';

export type TaskChangedField = {
    field: 'taskTypeId' | 'content' | 'assigneeProjectMemberId' | 'startDate' | 'endDate' | 'workerAmount';
    label: string;
    previousValue: string | null;
    nextValue: string | null;
};

export type ProjectTaskHistory = {
    historyId: number;
    eventType: TaskHistoryEvent;
    fromStatus: TaskStatus | null;
    toStatus: TaskStatus | null;
    rejectionReason: string | null;
    changedFields: TaskChangedField[];
    processedByName: string;
    processedAt: string;
};

export type ProjectTask = {
    taskId: number;
    workspaceId: number;
    projectId: number;
    taskTypeId: number;
    taskTypeName: string;
    content: string | null;
    assigneeProjectMemberId: number;
    assigneeWorkspaceMemberId: number;
    assigneeUserId: number;
    assigneeName: string;
    startDate: string | null;
    endDate: string | null;
    workerAmount?: string;
    status: TaskStatus;
    completedAt: string | null;
    version: number;
    createdAt: string;
    deletedAt: string | null;
    deletedByName: string | null;
    settled: boolean;
    assigneeIssue: TaskAssigneeIssue;
    latestRejectionReason: string | null;
    canEdit: boolean;
    canDelete: boolean;
    canRestore: boolean;
    canChangeStatus: boolean;
};

export type ProjectTaskListPage = {
    items: ProjectTask[];
    page: number;
    pageSize: number;
    totalCount: number;
    totalPages: number;
    filtersOverridden: boolean;
    anchorMatched: boolean;
};

export type ProjectTaskListRequest = {
    keyword?: string;
    taskTypeId?: number | null;
    assigneeProjectMemberId?: number | null;
    status?: TaskStatus | 'ALL';
    mineOnly?: boolean;
    deletedState?: TaskDeletionState;
    anchorTaskId?: number | null;
    page?: number;
    size?: number;
};

export type SaveProjectTaskRequest = {
    taskTypeId: number;
    assigneeProjectMemberId: number;
    content?: string | null;
    startDate?: string | null;
    endDate?: string | null;
    workerAmount: string;
};

export type UpdateProjectTaskRequest = SaveProjectTaskRequest & {
    expectedVersion: number;
};

export type ChangeProjectTaskStatusRequest = {
    status: TaskStatus;
    rejectionReason?: string | null;
    expectedVersion: number;
};

export type VersionedProjectTaskRequest = {
    expectedVersion: number;
};
