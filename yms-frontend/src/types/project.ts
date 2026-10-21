import type { ProjectStatus } from './projectGroup';

export type ProjectVideoType = 'LONG' | 'SHORTS';
export type ProjectRevenueOption = 'DEFAULT' | 'CUSTOM' | 'DISABLED';
export type YouTubePublicationStatus = 'CURRENT' | 'SUPERSEDED' | 'REMOVED';
export type YouTubeRemovalReason = 'UNAVAILABLE' | 'INCORRECT';
export type PerformanceCompleteness = 'COMPLETE' | 'PARTIAL' | 'UNAVAILABLE';
export type ProjectMemberPermission = 'EDIT' | 'VIEW';
export type ProjectAccessRole =
    | 'PROJECT_OWNER'
    | 'PROJECT_EDITOR'
    | 'PROJECT_VIEWER'
    | 'WORKSPACE_ADMIN'
    | 'WORKSPACE_OWNER';

export type ProjectMemberSummary = {
    workspaceMemberId: number;
    userId: number;
    name: string;
    permission: ProjectMemberPermission;
    active: boolean;
    isOwner: boolean;
};

export type ProjectStatusHistory = {
    status: ProjectStatus;
    changedAt: string;
    changedByName: string;
};

export type VideoPerformance = {
    viewCount: number;
    likeCount: number;
    commentCount: number;
    syncStatus: 'SUCCESS' | 'ERROR';
    lastAttemptedAt: string | null;
    lastSuccessAt: string | null;
    lastErrorMessage: string | null;
};

export type YouTubePublicationStatusHistory = {
    fromStatus: YouTubePublicationStatus | null;
    toStatus: YouTubePublicationStatus;
    fromRemovalReason: YouTubeRemovalReason | null;
    toRemovalReason: YouTubeRemovalReason | null;
    relatedPublicationId: number | null;
    changedByName: string;
    changedAt: string;
    reason: string | null;
};

export type YouTubePublication = {
    publicationId: number;
    channelId: number;
    channelName: string;
    youtubeVideoId: string;
    youtubeVideoUrl: string;
    lifecycleStatus: YouTubePublicationStatus;
    removalReason: YouTubeRemovalReason | null;
    supersededByPublicationId: number | null;
    revenueOption: ProjectRevenueOption;
    appliedRate: string;
    publishedAt: string | null;
    createdAt: string;
    performance: VideoPerformance | null;
    statusHistory: YouTubePublicationStatusHistory[];
};

export type PerformanceAggregate = {
    viewCount: number;
    likeCount: number;
    commentCount: number;
    estimatedRevenue: string;
    completeness: PerformanceCompleteness;
    includedPublicationCount: number;
    missingPublicationCount: number;
};

export type PrimaryProjectHistory = {
    fromProjectId: number | null;
    toProjectId: number;
    fromProjectGroupId: number | null;
    toProjectGroupId: number | null;
    changedByName: string;
    changedAt: string;
    reason: string;
};

export type VideoContent = {
    videoContentId: number;
    title: string;
    videoType: ProjectVideoType;
    primaryProjectId: number;
    connectedProjectIds: number[];
    primaryProjectHistory: PrimaryProjectHistory[];
    publications: YouTubePublication[];
    currentPerformance: PerformanceAggregate;
    cumulativePerformance: PerformanceAggregate;
};

export type ProjectSummary = {
    projectId: number;
    title: string;
    content: string | null;
    channelId: number;
    channelName: string;
    projectGroupId: number | null;
    projectGroupName: string | null;
    videoType: ProjectVideoType;
    status: ProjectStatus;
    ownerName: string;
    dueDate: string | null;
    plannedUploadDate: string | null;
    archivedAt: string | null;
    updatedAt: string;
    taskCount: number;
    completedTaskCount: number;
    isParticipant: boolean;
};

export type ProjectDetail = ProjectSummary & {
    workspaceId: number;
    ownerWorkspaceMemberId: number;
    workerAmount: string;
    directExpenseAmount: string;
    directRevenueAmount: string;
    members: ProjectMemberSummary[];
    statusHistory: ProjectStatusHistory[];
    videoContents: VideoContent[];
};

export type ProjectListPage = {
    items: ProjectListItem[];
    page: number;
    pageSize: number;
    totalCount: number;
    totalPages: number;
};

export type ProjectListItem = ProjectSummary & {
    myAccessRole: ProjectAccessRole;
    currentPerformance: PerformanceAggregate;
};
