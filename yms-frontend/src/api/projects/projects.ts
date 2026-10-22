import type { WorkspaceRole } from '../../types/workspace';
import type { ProjectStatus } from '../../types/projectGroup';
import type {
    ProjectDetail,
    ProjectDetailResponse,
    ProjectAccessRole,
    ProjectListPageResponse,
    ProjectVideoType
} from '../../types/project';
import type { ApiResponse } from '../types';
import { findWorkspaceChannel } from '../workspaces/channels';
import {
    findActiveWorkspaceMemberByUserId,
    getWorkspaceMembers
} from '../workspaces/members';
import { readProjectGroup, readProjectGroups } from '../projectGroups/projectGroupStore';
import {
    insertProject,
    readProject,
    readProjects,
    removeProject,
    replaceVideoContent,
    replaceProject
} from './projectStore';
import {
    toProjectDetailResponse,
    toProjectListItemResponse
} from './projectResponses';
import { requiresContentPerformanceMoveConfirmation } from './projectGroupChangePolicy';

export type ProjectListRequest = {
    view?: 'active' | 'archived';
    status?: ProjectStatus | 'ALL';
    channelId?: number | null;
    projectGroupId?: number | null;
    participation?: 'ALL' | 'MINE';
    keyword?: string;
    page?: number;
};

export type SaveProjectRequest = {
    title: string;
    content?: string | null;
    channelId: number;
    projectGroupId?: number | null;
    videoType: ProjectVideoType;
    status: ProjectStatus;
    dueDate?: string | null;
    plannedUploadDate?: string | null;
};

export type UpdateProjectRequest = SaveProjectRequest & {
    confirmContentPerformanceMove?: boolean;
};

export type DeleteProjectRequest = {
    primaryProjectReassignments?: Array<{
        videoContentId: number;
        newPrimaryProjectId: number;
    }>;
    confirmContentPerformanceMove?: boolean;
};

type ProjectMutationContext = {
    userId: number;
    userName: string;
    workspaceRole: WorkspaceRole;
};

const EDITABLE_STATUSES: ProjectStatus[] = ['PLANNING', 'EDITING', 'REVIEW', 'UPLOADED', 'CANCELLED'];
const ACTIVE_STATUSES: ProjectStatus[] = ['PLANNING', 'EDITING', 'REVIEW'];

/** 실제 API의 로딩 상태를 확인할 수 있도록 Project Mock 호출을 잠시 지연합니다. */
async function waitForMockResponse() {
    await new Promise(resolve => setTimeout(resolve, 250));
}

/** 날짜와 선택 텍스트의 빈 값을 REST 응답의 null로 정규화합니다. */
function optional(value?: string | null): string | null {
    return value?.trim() || null;
}

/** 조회 권한이 있는지 제작팀 관리 권한과 활성 참여 정보를 함께 확인합니다. */
function canViewProject(project: ProjectDetail, context: ProjectMutationContext): boolean {
    return context.workspaceRole !== 'MEMBER'
        || project.members.some(member => member.userId === context.userId && member.active);
}

/** 수정 권한을 소유자, EDIT 참여자와 제작팀 관리자 기준으로 판정합니다. */
function canEditProject(project: ProjectDetail, context: ProjectMutationContext): boolean {
    return context.workspaceRole !== 'MEMBER'
        || project.ownerWorkspaceMemberId === findActiveWorkspaceMemberByUserId(project.workspaceId, context.userId)?.workspaceMemberId
        || project.members.some(member => member.userId === context.userId && member.active && member.permission === 'EDIT');
}

/** 프로젝트와의 직접 관계를 우선해 목록 카드에 표시할 현재 사용자의 접근 역할을 계산합니다. */
function getProjectAccessRole(project: ProjectDetail, context: ProjectMutationContext): ProjectAccessRole | null {
    const member = project.members.find(item => item.userId === context.userId && item.active);

    if (member?.isOwner) return 'PROJECT_OWNER';
    if (member?.permission === 'EDIT') return 'PROJECT_EDITOR';
    if (member?.permission === 'VIEW') return 'PROJECT_VIEWER';
    if (context.workspaceRole === 'ADMIN') return 'WORKSPACE_ADMIN';
    if (context.workspaceRole === 'OWNER') return 'WORKSPACE_OWNER';
    return null;
}

/** 현재 Project가 성과 집계 대상인 VideoContent만 사용해 목록 성과를 중복 없이 합산합니다. */
function getProjectCurrentPerformance(project: ProjectDetail) {
    const aggregates = project.videoContents
        .filter(content => content.primaryProjectId === project.projectId)
        .map(content => content.currentPerformance);
    const includedPublicationCount = aggregates.reduce((sum, item) => sum + item.includedPublicationCount, 0);
    const missingPublicationCount = aggregates.reduce((sum, item) => sum + item.missingPublicationCount, 0);

    return {
        viewCount: aggregates.reduce((sum, item) => sum + item.viewCount, 0),
        likeCount: aggregates.reduce((sum, item) => sum + item.likeCount, 0),
        commentCount: aggregates.reduce((sum, item) => sum + item.commentCount, 0),
        estimatedRevenue: aggregates.reduce((sum, item) => sum + Number(item.estimatedRevenue), 0).toFixed(2),
        completeness: includedPublicationCount === 0 ? 'UNAVAILABLE' as const : missingPublicationCount > 0 ? 'PARTIAL' as const : 'COMPLETE' as const,
        includedPublicationCount,
        missingPublicationCount
    };
}

/** 공통 생성·수정 필드를 서버 경계에서 검증하고 정규화합니다. */
function validateProjectRequest(workspaceId: number, request: SaveProjectRequest) {
    const errors = [];
    const title = request.title.trim();
    const content = optional(request.content);
    const dueDate = optional(request.dueDate);
    const plannedUploadDate = optional(request.plannedUploadDate);
    const channel = findWorkspaceChannel(workspaceId, request.channelId);

    if (!title || title.length > 150) errors.push({ field: 'title', value: request.title, reason: '프로젝트 제목은 1자 이상 150자 이하로 입력해 주세요.' });
    if (content && content.length > 2000) errors.push({ field: 'content', value: request.content ?? null, reason: '내용은 2000자 이하로 입력해 주세요.' });
    if (!channel || !channel.active) errors.push({ field: 'channelId', value: String(request.channelId), reason: '사용 중인 채널을 선택해 주세요.' });
    if (request.videoType !== 'LONG' && request.videoType !== 'SHORTS') errors.push({ field: 'videoType', value: request.videoType, reason: '영상 유형을 선택해 주세요.' });
    if (!EDITABLE_STATUSES.includes(request.status)) errors.push({ field: 'status', value: request.status, reason: '올바른 프로젝트 상태를 선택해 주세요.' });
    if (dueDate && plannedUploadDate && dueDate > plannedUploadDate) errors.push({ field: 'plannedUploadDate', value: plannedUploadDate, reason: '업로드 예정일은 마감일보다 빠를 수 없습니다.' });
    if (request.projectGroupId != null && !readProjectGroup(workspaceId, request.projectGroupId)) errors.push({ field: 'projectGroupId', value: String(request.projectGroupId), reason: '현재 제작팀의 프로젝트 그룹을 선택해 주세요.' });

    return { errors, normalized: { title, content, dueDate, plannedUploadDate, channel } };
}

/** 프로젝트 목록에 URL 기반 AND 필터와 참여 권한, 최신순 페이지네이션을 적용합니다. */
export async function getWorkspaceProjects(
    workspaceId: number,
    request: ProjectListRequest,
    context: ProjectMutationContext
): Promise<ApiResponse<ProjectListPageResponse>> {
    await waitForMockResponse();
    const view = request.view ?? 'active';
    const page = Math.max(1, request.page ?? 1);
    const pageSize = 6;
    const keyword = request.keyword?.trim().toLocaleLowerCase() ?? '';

    const filtered = readProjects()
        .filter(project => project.workspaceId === workspaceId && canViewProject(project, context))
        .filter(project => view === 'archived' ? project.archivedAt !== null : project.archivedAt === null)
        .filter(project => !request.status || request.status === 'ALL' || project.status === request.status)
        .filter(project => !request.channelId || project.channelId === request.channelId)
        .filter(project => !request.projectGroupId || project.projectGroupId === request.projectGroupId)
        .filter(project => request.participation !== 'MINE' || project.members.some(member => member.userId === context.userId && member.active))
        .filter(project => !keyword || project.title.toLocaleLowerCase().includes(keyword) || project.content?.toLocaleLowerCase().includes(keyword))
        .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
    const items = filtered.slice((page - 1) * pageSize, page * pageSize).map(project => (
        toProjectListItemResponse(
            project,
            {
                isParticipant: project.members.some(member => member.userId === context.userId && member.active),
                // canViewProject를 통과한 항목은 프로젝트 관계 또는 제작팀 관리 역할 중 하나가 반드시 존재합니다.
                myAccessRole: getProjectAccessRole(project, context) as ProjectAccessRole
            },
            getProjectCurrentPerformance(project),
            context.workspaceRole
        )
    ));

    return { success: true, data: { items, page, pageSize, totalCount: filtered.length, totalPages: Math.max(1, Math.ceil(filtered.length / pageSize)) } };
}

/** 프로젝트 상세를 Workspace와 조회 권한 경계 안에서 반환합니다. */
export async function getWorkspaceProject(workspaceId: number, projectId: number, context: ProjectMutationContext): Promise<ApiResponse<ProjectDetailResponse>> {
    await waitForMockResponse();
    const project = readProject(workspaceId, projectId);
    if (!project || !canViewProject(project, context)) return { success: false, errorCode: 'PROJECT_NOT_FOUND', message: '현재 제작팀에서 확인할 수 있는 프로젝트가 없습니다.', errors: null };
    return { success: true, data: toProjectDetailResponse(project, context.workspaceRole) };
}

/** ACTIVE 멤버를 소유자 겸 EDIT 참여자로 등록하며 결과물·게시물은 별도 흐름에서 생성합니다. */
export async function createWorkspaceProject(workspaceId: number, request: SaveProjectRequest, context: ProjectMutationContext): Promise<ApiResponse<ProjectDetailResponse>> {
    await waitForMockResponse();
    const member = findActiveWorkspaceMemberByUserId(workspaceId, context.userId);
    if (!member) return { success: false, errorCode: 'WORKSPACE_MEMBER_NOT_ACTIVE', message: '현재 제작팀의 활동 중인 멤버만 프로젝트를 만들 수 있습니다.', errors: null };
    if (context.workspaceRole === 'MEMBER' && request.projectGroupId != null) {
        return { success: false, errorCode: 'PROJECT_GROUP_EDIT_FORBIDDEN', message: '프로젝트 그룹은 제작팀 소유자 또는 관리자만 지정할 수 있습니다.', errors: null };
    }
    const validation = validateProjectRequest(workspaceId, request);
    if (request.status !== 'PLANNING' && request.status !== 'EDITING') validation.errors.push({ field: 'status', value: request.status, reason: '생성 상태는 준비 중 또는 편집 중에서 선택해 주세요.' });
    if (validation.errors.length > 0 || !validation.normalized.channel) return { success: false, errorCode: 'INVALID_INPUT_VALUE', message: '입력값을 다시 확인해 주세요.', errors: validation.errors };

    const group = request.projectGroupId ? readProjectGroup(workspaceId, request.projectGroupId) : null;
    const now = new Date().toISOString();
    const created = insertProject({ workspaceId, title: validation.normalized.title, content: validation.normalized.content, channelId: validation.normalized.channel.channelId, channelName: validation.normalized.channel.name, projectGroupId: group?.projectGroupId ?? null, projectGroupName: group?.name ?? null, videoType: request.videoType, status: request.status, ownerWorkspaceMemberId: member.workspaceMemberId, ownerName: member.name, dueDate: validation.normalized.dueDate, plannedUploadDate: validation.normalized.plannedUploadDate, archivedAt: null, updatedAt: now, taskCount: 0, completedTaskCount: 0, isParticipant: true, workerAmount: '0.00', directExpenseAmount: '0.00', directRevenueAmount: '0.00', members: [{ workspaceMemberId: member.workspaceMemberId, userId: member.userId, name: member.name, permission: 'EDIT', active: true, isOwner: true }], statusHistory: [{ status: request.status, changedAt: now, changedByName: context.userName }], videoContents: [] });
    return { success: true, message: '프로젝트를 만들었습니다.', data: toProjectDetailResponse(created, context.workspaceRole) };
}

/** 수정 권한과 ProjectGroup 권한을 분리하고 Project 기본값만 변경합니다. */
export async function updateWorkspaceProject(workspaceId: number, projectId: number, request: UpdateProjectRequest, context: ProjectMutationContext): Promise<ApiResponse<ProjectDetailResponse>> {
    await waitForMockResponse();
    const project = readProject(workspaceId, projectId);
    if (!project || !canEditProject(project, context)) return { success: false, errorCode: 'PROJECT_EDIT_FORBIDDEN', message: '프로젝트를 수정할 권한이 없습니다.', errors: null };
    const validation = validateProjectRequest(workspaceId, request);
    if (validation.errors.length > 0 || !validation.normalized.channel) return { success: false, errorCode: 'INVALID_INPUT_VALUE', message: '입력값을 다시 확인해 주세요.', errors: validation.errors };
    const isAdmin = context.workspaceRole !== 'MEMBER';
    if (!isAdmin && (
        request.projectGroupId !== project.projectGroupId
    )) return { success: false, errorCode: 'PROJECT_GROUP_EDIT_FORBIDDEN', message: '프로젝트 그룹은 제작팀 소유자 또는 관리자만 변경할 수 있습니다.', errors: null };

    const contentPerformanceMoves = requiresContentPerformanceMoveConfirmation(
        [project],
        request.projectGroupId ?? null
    );
    if (contentPerformanceMoves && !request.confirmContentPerformanceMove) {
        return { success: false, errorCode: 'CONTENT_PERFORMANCE_MOVE_CONFIRMATION_REQUIRED', message: '프로젝트 그룹을 변경하면 이 프로젝트가 성과 집계 대상인 영상 결과물의 콘텐츠 성과도 이동합니다.', errors: null };
    }

    const now = new Date().toISOString();
    const group = request.projectGroupId ? readProjectGroup(workspaceId, request.projectGroupId) : null;
    const updated: ProjectDetail = { ...project, title: validation.normalized.title, content: validation.normalized.content, channelId: validation.normalized.channel.channelId, channelName: validation.normalized.channel.name, projectGroupId: isAdmin ? group?.projectGroupId ?? null : project.projectGroupId, projectGroupName: isAdmin ? group?.name ?? null : project.projectGroupName, videoType: request.videoType, status: request.status, dueDate: validation.normalized.dueDate, plannedUploadDate: validation.normalized.plannedUploadDate, archivedAt: project.archivedAt && ACTIVE_STATUSES.includes(request.status) ? null : project.archivedAt, updatedAt: now, statusHistory: request.status === project.status ? project.statusHistory : [...project.statusHistory, { status: request.status, changedAt: now, changedByName: context.userName }] };
    replaceProject(updated);
    return { success: true, message: '프로젝트를 저장했습니다.', data: toProjectDetailResponse(updated, context.workspaceRole) };
}

/** 완료·취소 프로젝트를 보관하거나 다시 활성 목록으로 복원합니다. */
export async function setWorkspaceProjectArchived(workspaceId: number, projectId: number, archived: boolean, context: ProjectMutationContext): Promise<ApiResponse<ProjectDetailResponse>> {
    await waitForMockResponse();
    const project = readProject(workspaceId, projectId);
    const member = findActiveWorkspaceMemberByUserId(workspaceId, context.userId);
    const canManage = context.workspaceRole !== 'MEMBER' || project?.ownerWorkspaceMemberId === member?.workspaceMemberId;
    if (!project || !canManage) return { success: false, errorCode: 'PROJECT_ARCHIVE_FORBIDDEN', message: '프로젝트를 보관할 권한이 없습니다.', errors: null };
    if (archived && project.status !== 'UPLOADED' && project.status !== 'CANCELLED') return { success: false, errorCode: 'PROJECT_STATUS_NOT_ARCHIVABLE', message: '업로드 완료 또는 취소 상태의 프로젝트만 보관할 수 있습니다.', errors: null };
    const updated = { ...project, archivedAt: archived ? new Date().toISOString() : null, updatedAt: new Date().toISOString() };
    replaceProject(updated);
    return { success: true, message: archived ? '프로젝트를 보관했습니다.' : '프로젝트를 활성 목록으로 복원했습니다.', data: toProjectDetailResponse(updated, context.workspaceRole) };
}

/** 소유자 또는 제작팀 관리자가 프로젝트를 논리 삭제해 모든 일반 조회에서 제외합니다. */
export async function deleteWorkspaceProject(workspaceId: number, projectId: number, context: ProjectMutationContext, request: DeleteProjectRequest = {}): Promise<ApiResponse<{ projectId: number }>> {
    await waitForMockResponse();
    const project = readProject(workspaceId, projectId);
    const member = findActiveWorkspaceMemberByUserId(workspaceId, context.userId);
    if (!project || (context.workspaceRole === 'MEMBER' && project.ownerWorkspaceMemberId !== member?.workspaceMemberId)) return { success: false, errorCode: 'PROJECT_DELETE_FORBIDDEN', message: '프로젝트를 삭제할 권한이 없습니다.', errors: null };

    const replacements = new Map(
        request.primaryProjectReassignments?.map(item => [item.videoContentId, item.newPrimaryProjectId]) ?? []
    );
    const primaryContents = project.videoContents.filter(content => content.primaryProjectId === projectId);
    for (const content of primaryContents) {
        const activeCandidates = content.connectedProjectIds
            .filter(candidateId => candidateId !== projectId)
            .map(candidateId => readProject(workspaceId, candidateId))
            .filter((candidate): candidate is ProjectDetail => candidate !== null);
        if (activeCandidates.length === 0) continue;

        const replacementId = replacements.get(content.videoContentId);
        const replacement = activeCandidates.find(candidate => candidate.projectId === replacementId);
        if (!replacement) return { success: false, errorCode: 'PRIMARY_PROJECT_REASSIGNMENT_REQUIRED', message: `${content.title} 결과물의 새 성과 집계 프로젝트를 선택해 주세요.`, errors: null };

        const crossesGroupBoundary = project.projectGroupId !== replacement.projectGroupId;
        if (crossesGroupBoundary && context.workspaceRole === 'MEMBER') return { success: false, errorCode: 'PRIMARY_PROJECT_GROUP_PERMISSION_REQUIRED', message: '프로젝트 그룹 경계를 넘는 집계 프로젝트 변경은 제작팀 소유자 또는 관리자만 할 수 있습니다.', errors: null };
        if (!crossesGroupBoundary && !canEditProject(replacement, context)) return { success: false, errorCode: 'PRIMARY_PROJECT_EDIT_FORBIDDEN', message: '새 성과 집계 프로젝트를 관리할 권한이 없습니다.', errors: null };
        if (
            crossesGroupBoundary
            && content.cumulativePerformance.includedPublicationCount > 0
            && !request.confirmContentPerformanceMove
        ) return { success: false, errorCode: 'CONTENT_PERFORMANCE_MOVE_CONFIRMATION_REQUIRED', message: '프로젝트를 삭제하면 영상 결과물의 콘텐츠 성과가 새 프로젝트 그룹으로 이동합니다. 실제 비용·수익은 이동하지 않습니다.', errors: null };

        // 모든 검증이 끝난 뒤 아래에서 일괄 적용할 수 있도록 다음 루프까지 변경하지 않습니다.
    }

    primaryContents.forEach(content => {
        const replacementId = replacements.get(content.videoContentId);
        const replacement = replacementId ? readProject(workspaceId, replacementId) : null;
        if (replacement) replaceVideoContent(content.videoContentId, {
            ...content,
            primaryProjectId: replacement.projectId,
            primaryProjectHistory: [...content.primaryProjectHistory, {
                fromProjectId: project.projectId,
                toProjectId: replacement.projectId,
                fromProjectGroupId: project.projectGroupId,
                toProjectGroupId: replacement.projectGroupId,
                changedByName: context.userName,
                changedAt: new Date().toISOString(),
                reason: '성과 집계 프로젝트 삭제에 따른 이전'
            }]
        });
    });
    removeProject(projectId);
    return { success: true, message: '프로젝트를 삭제했습니다. 비용·수익과 정산 이력은 유지됩니다.', data: { projectId } };
}

/** 프로젝트 그룹 선택지를 관리자 전체 또는 MEMBER가 참여 중인 프로젝트 범위로 제한합니다. */
export function getProjectGroupOptions(workspaceId: number, context: ProjectMutationContext) {
    const visibleGroupIds = context.workspaceRole === 'MEMBER'
        ? new Set(readProjects()
            .filter(project => project.workspaceId === workspaceId && canViewProject(project, context))
            .map(project => project.projectGroupId)
            .filter((projectGroupId): projectGroupId is number => projectGroupId !== null))
        : null;
    return readProjectGroups()
        .filter(group => group.workspaceId === workspaceId)
        .filter(group => visibleGroupIds === null || visibleGroupIds.has(group.projectGroupId))
        .map(group => ({ projectGroupId: group.projectGroupId, name: group.name }));
}

/** 같은 Workspace ACTIVE 멤버에게 소유권을 넘기고 EDIT 참여를 보장합니다. */
export async function transferProjectOwner(
    workspaceId: number,
    projectId: number,
    newOwnerWorkspaceMemberId: number,
    context: ProjectMutationContext
): Promise<ApiResponse<ProjectDetailResponse>> {
    await waitForMockResponse();
    const project = readProject(workspaceId, projectId);
    const actor = findActiveWorkspaceMemberByUserId(workspaceId, context.userId);
    const canTransfer = project && (
        context.workspaceRole !== 'MEMBER'
        || project.ownerWorkspaceMemberId === actor?.workspaceMemberId
    );
    const candidates = await getWorkspaceMembers(
        workspaceId,
        { status: 'ACTIVE' }
    );
    const newOwner = candidates.data.find(
        member => member.workspaceMemberId === newOwnerWorkspaceMemberId
    );
    if (!project || !canTransfer) return { success: false, errorCode: 'PROJECT_OWNER_TRANSFER_FORBIDDEN', message: '프로젝트 소유권을 이전할 권한이 없습니다.', errors: null };
    if (!newOwner) return { success: false, errorCode: 'PROJECT_OWNER_TARGET_INVALID', message: '같은 제작팀의 활동 중인 멤버를 선택해 주세요.', errors: null };

    const members = project.members.map(member => ({ ...member, isOwner: member.workspaceMemberId === newOwnerWorkspaceMemberId ? true : member.isOwner ? false : member.isOwner, permission: member.workspaceMemberId === newOwnerWorkspaceMemberId ? 'EDIT' as const : member.permission }));
    if (!members.some(member => member.workspaceMemberId === newOwnerWorkspaceMemberId)) members.push({ workspaceMemberId: newOwner.workspaceMemberId, userId: newOwner.userId, name: newOwner.name, permission: 'EDIT', active: true, isOwner: true });
    const updated = { ...project, ownerWorkspaceMemberId: newOwner.workspaceMemberId, ownerName: newOwner.name, members: members.map(member => member.workspaceMemberId === newOwnerWorkspaceMemberId ? { ...member, active: true, permission: 'EDIT' as const } : member), updatedAt: new Date().toISOString() };
    replaceProject(updated);
    return { success: true, message: `${newOwner.name} 님에게 프로젝트 소유권을 이전했습니다.`, data: toProjectDetailResponse(updated, context.workspaceRole) };
}
