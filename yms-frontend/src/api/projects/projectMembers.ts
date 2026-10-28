import type { WorkspaceRole } from '../../types/workspace';
import type {
    ProjectDetail,
    ProjectMemberCandidate,
    ProjectMemberHistoryItem,
    ProjectMemberItem,
    ProjectMemberListData,
    ProjectMemberPermission
} from '../../types/project';
import type { ApiResponse } from '../types';
import {
    findActiveWorkspaceMemberByUserId,
    readWorkspaceMembers
} from '../workspaces/members';
import { withWorkspaceMutation } from '../workspaces/workspaceMutationQueue';
import {
    appendProjectMemberHistory,
    appendProjectOwnerHistory,
    getProjectMemberId,
    readProject,
    readProjectMemberHistories,
    readProjectMemberMeta,
    readProjectOwnerHistories,
    replaceProject,
    saveProjectMemberMeta
} from './projectStore';

export type ProjectMemberRequestContext = {
    userId: number;
    userName: string;
    workspaceRole: WorkspaceRole;
};

export type AddProjectMembersRequest = {
    workspaceMemberIds: number[];
    permissionLevel: ProjectMemberPermission;
};

/** 실제 REST 왕복과 동일한 로딩 상태를 검증하도록 조회·변경 전에 짧게 대기합니다. */
async function waitForMockResponse() {
    await new Promise(resolve => setTimeout(resolve, 220));
}

/** 프로젝트 조회 권한을 활성 참여 또는 Workspace 관리 권한으로 판정합니다. */
function canViewProject(project: ProjectDetail, context: ProjectMemberRequestContext): boolean {
    const actor = findActiveWorkspaceMemberByUserId(project.workspaceId, context.userId);
    if (!actor) return false;
    return actor.workspaceRole !== 'MEMBER'
        || project.members.some(member => member.workspaceMemberId === actor.workspaceMemberId && member.active);
}

/** Project Member 변경 권한을 현재 Owner 또는 Workspace OWNER·ADMIN으로 제한합니다. */
function canManageMembers(project: ProjectDetail, context: ProjectMemberRequestContext): boolean {
    const actor = findActiveWorkspaceMemberByUserId(project.workspaceId, context.userId);
    return actor !== null && (actor.workspaceRole !== 'MEMBER'
        || project.ownerWorkspaceMemberId === actor.workspaceMemberId
    );
}

/** 현재 Owner가 같은 Project의 ACTIVE EDIT 참여자인 핵심 불변식을 확인합니다. */
function hasValidOwner(project: ProjectDetail): boolean {
    const owner = project.members.find(member => (
        member.workspaceMemberId === project.ownerWorkspaceMemberId
    ));
    const workspaceOwner = readWorkspaceMembers(project.workspaceId).find(member => (
        member.workspaceMemberId === project.ownerWorkspaceMemberId
    ));
    return owner?.active === true
        && owner.permission === 'EDIT'
        && owner.isOwner
        && workspaceOwner?.status === 'ACTIVE';
}

/** 내부 Project Member와 Workspace 프로필·현재 참여 메타를 화면 응답으로 조합합니다. */
function toProjectMemberItem(project: ProjectDetail, workspaceMemberId: number): ProjectMemberItem | null {
    const member = project.members.find(item => item.workspaceMemberId === workspaceMemberId);
    const workspaceMember = readWorkspaceMembers(project.workspaceId).find(item => (
        item.workspaceMemberId === workspaceMemberId
    ));
    const meta = readProjectMemberMeta(project.projectId, workspaceMemberId);
    if (!member || !workspaceMember || !meta) return null;

    return {
        ...member,
        projectMemberId: meta.projectMemberId,
        email: workspaceMember.email,
        professionalRoles: [...workspaceMember.professionalRoles],
        workspaceMemberStatus: workspaceMember.status,
        joinedAt: meta.joinedAt,
        leftAt: meta.leftAt,
        incompleteTaskCount: meta.incompleteTaskCount
    };
}

/** 최신 Project 상태로 활성·종료 참여자 목록과 관리 가능 여부를 만듭니다. */
function buildMemberList(project: ProjectDetail, context: ProjectMemberRequestContext): ProjectMemberListData {
    const members = project.members
        .map(member => toProjectMemberItem(project, member.workspaceMemberId))
        .filter((member): member is ProjectMemberItem => member !== null);
    const byOwnerThenName = (left: ProjectMemberItem, right: ProjectMemberItem) => (
        Number(right.isOwner) - Number(left.isOwner)
        || left.name.localeCompare(right.name, 'ko-KR')
    );

    return {
        projectId: project.projectId,
        projectTitle: project.title,
        channelName: project.channelName,
        ownerName: project.ownerName,
        status: project.status,
        archived: project.archivedAt !== null,
        canManage: canManageMembers(project, context),
        activeMembers: members.filter(member => member.active).sort(byOwnerThenName),
        inactiveMembers: members.filter(member => !member.active).sort(byOwnerThenName)
    };
}

/** 현재 사용자에게 허용된 Project Member 목록을 활성·종료 상태로 나누어 반환합니다. */
export async function getProjectMembers(
    workspaceId: number,
    projectId: number,
    context: ProjectMemberRequestContext
): Promise<ApiResponse<ProjectMemberListData>> {
    await waitForMockResponse();
    const project = readProject(workspaceId, projectId);
    if (!project || !canViewProject(project, context)) {
        return { success: false, errorCode: 'PROJECT_NOT_FOUND', message: '프로젝트를 찾거나 접근할 수 없습니다.', errors: null };
    }
    return { success: true, data: buildMemberList(project, context) };
}

/** ACTIVE Workspace Member 중 현재 활성 참여자가 아닌 추가·재참여 후보를 반환합니다. */
export async function getProjectMemberCandidates(
    workspaceId: number,
    projectId: number,
    context: ProjectMemberRequestContext
): Promise<ApiResponse<ProjectMemberCandidate[]>> {
    await waitForMockResponse();
    const project = readProject(workspaceId, projectId);
    if (!project || !canManageMembers(project, context)) {
        return { success: false, errorCode: 'PROJECT_MEMBER_FORBIDDEN', message: '참여자를 관리할 권한이 없습니다.', errors: null };
    }
    if (project.archivedAt) {
        return { success: false, errorCode: 'INVALID_RESOURCE_STATE', message: '보관된 프로젝트에는 참여자를 추가할 수 없습니다.', errors: null };
    }

    const activeIds = new Set(project.members.filter(member => member.active).map(member => member.workspaceMemberId));
    const candidates = readWorkspaceMembers(workspaceId)
        .filter(member => member.status === 'ACTIVE' && !activeIds.has(member.workspaceMemberId))
        .map<ProjectMemberCandidate>(member => {
            const existing = project.members.find(item => item.workspaceMemberId === member.workspaceMemberId);
            const meta = existing ? readProjectMemberMeta(projectId, member.workspaceMemberId) : null;
            return {
                workspaceMemberId: member.workspaceMemberId,
                projectMemberId: existing ? getProjectMemberId(projectId, member.workspaceMemberId) : null,
                name: member.name,
                email: member.email,
                professionalRoles: [...member.professionalRoles],
                rejoining: Boolean(existing),
                incompleteTaskCount: meta?.incompleteTaskCount ?? 0
            };
        });
    return { success: true, data: candidates };
}

/** 복수 후보를 한 권한으로 추가하며 한 명이라도 최신 조건을 벗어나면 전체 요청을 취소합니다. */
export async function addProjectMembers(
    workspaceId: number,
    projectId: number,
    request: AddProjectMembersRequest,
    context: ProjectMemberRequestContext
): Promise<ApiResponse<ProjectMemberListData & { restoredIncompleteTaskCount: number }>> {
    await waitForMockResponse();
    return withWorkspaceMutation(workspaceId, () => {
        const project = readProject(workspaceId, projectId);
        const ids = [...new Set(request.workspaceMemberIds)];
        if (!project || !canManageMembers(project, context)) return { success: false, errorCode: 'PROJECT_MEMBER_FORBIDDEN', message: '참여자를 관리할 권한이 없습니다.', errors: null };
        if (project.archivedAt) return { success: false, errorCode: 'INVALID_RESOURCE_STATE', message: '보관된 프로젝트에는 참여자를 추가할 수 없습니다.', errors: null };
        if (ids.length === 0 || ids.length !== request.workspaceMemberIds.length) return { success: false, errorCode: 'INVALID_PROJECT_MEMBERS', message: '추가할 참여자를 중복 없이 한 명 이상 선택해 주세요.', errors: null };

        const workspaceMembers = readWorkspaceMembers(workspaceId);
        const invalidId = ids.find(id => {
            const workspaceMember = workspaceMembers.find(member => member.workspaceMemberId === id);
            const current = project.members.find(member => member.workspaceMemberId === id);
            return workspaceMember?.status !== 'ACTIVE' || current?.active === true;
        });
        if (invalidId !== undefined) return { success: false, errorCode: 'PROJECT_MEMBER_STATE_CHANGED', message: '후보 상태가 변경되었습니다. 최신 목록에서 다시 선택해 주세요.', errors: null };

        const now = new Date().toISOString();
        const actorWorkspaceMemberId = findActiveWorkspaceMemberByUserId(workspaceId, context.userId)?.workspaceMemberId ?? null;
        let restoredIncompleteTaskCount = 0;
        const members = project.members.map(member => ({ ...member }));
        const pendingMemberRecords: Array<{
            meta: Parameters<typeof saveProjectMemberMeta>[0];
            history: Parameters<typeof appendProjectMemberHistory>[0];
        }> = [];
        ids.forEach(workspaceMemberId => {
            const workspaceMember = workspaceMembers.find(item => item.workspaceMemberId === workspaceMemberId)!;
            const existingIndex = members.findIndex(member => member.workspaceMemberId === workspaceMemberId);
            const projectMemberId = getProjectMemberId(projectId, workspaceMemberId);
            const previousMeta = readProjectMemberMeta(projectId, workspaceMemberId);
            const rejoining = existingIndex >= 0;
            const previousPermission = rejoining ? members[existingIndex].permission : null;
            if (rejoining) members[existingIndex] = { ...members[existingIndex], active: true, permission: request.permissionLevel };
            else members.push({ workspaceMemberId, userId: workspaceMember.userId, name: workspaceMember.name, permission: request.permissionLevel, active: true, isOwner: false });

            const incompleteTaskCount = previousMeta?.incompleteTaskCount ?? 0;
            if (rejoining && request.permissionLevel === 'EDIT') restoredIncompleteTaskCount += incompleteTaskCount;
            pendingMemberRecords.push({
                meta: { projectMemberId, projectId, workspaceMemberId, joinedAt: now, leftAt: null, incompleteTaskCount },
                history: {
                    projectMemberId,
                    eventType: rejoining ? 'REJOINED' : 'JOINED',
                    fromPermission: previousPermission,
                    toPermission: request.permissionLevel,
                    fromActive: rejoining ? false : null,
                    toActive: true,
                    changeSource: 'PROJECT_MEMBER_MANAGEMENT',
                    changedByWorkspaceMemberId: actorWorkspaceMemberId,
                    changedByName: context.userName,
                    changedAt: now
                }
            });
        });

        const updated = { ...project, members, updatedAt: now };
        if (!hasValidOwner(updated)) return { success: false, errorCode: 'PROJECT_MEMBER_STATE_CHANGED', message: '프로젝트 소유자 상태가 변경되었습니다. 다시 시도해 주세요.', errors: null };

        // 모든 검증이 끝난 뒤 메타·감사 이력·Project를 연속 반영해 실패 요청의 흔적을 남기지 않습니다.
        pendingMemberRecords.forEach(record => {
            saveProjectMemberMeta(record.meta);
            appendProjectMemberHistory(record.history);
        });
        replaceProject(updated);
        return { success: true, message: `${ids.length}명을 프로젝트 참여자로 추가했습니다.`, data: { ...buildMemberList(updated, context), restoredIncompleteTaskCount } };
    });
}

/** Project Member 권한을 변경하고 Owner 불변식과 미완료 Task 영향을 함께 검증합니다. */
export async function updateProjectMemberPermission(
    workspaceId: number,
    projectId: number,
    projectMemberId: number,
    permissionLevel: ProjectMemberPermission,
    context: ProjectMemberRequestContext
): Promise<ApiResponse<ProjectMemberListData>> {
    await waitForMockResponse();
    return withWorkspaceMutation(workspaceId, () => {
        const project = readProject(workspaceId, projectId);
        const target = project?.members.find(member => getProjectMemberId(projectId, member.workspaceMemberId) === projectMemberId);
        if (!project || !target || !canManageMembers(project, context)) return { success: false, errorCode: 'PROJECT_MEMBER_FORBIDDEN', message: '참여자 권한을 변경할 수 없습니다.', errors: null };
        if (project.archivedAt) return { success: false, errorCode: 'INVALID_RESOURCE_STATE', message: '보관된 프로젝트에서는 권한을 변경할 수 없습니다.', errors: null };
        if (!target.active) return { success: false, errorCode: 'PROJECT_MEMBER_STATE_CHANGED', message: '현재 참여 중인 멤버가 아닙니다.', errors: null };
        if (target.isOwner && permissionLevel !== 'EDIT') return { success: false, errorCode: 'PROJECT_OWNER_CANNOT_BE_REMOVED', message: '프로젝트 소유자는 VIEW로 변경할 수 없습니다. 소유권을 먼저 이전해 주세요.', errors: null };

        const now = new Date().toISOString();
        const actorWorkspaceMemberId = findActiveWorkspaceMemberByUserId(workspaceId, context.userId)?.workspaceMemberId ?? null;
        const updated = { ...project, members: project.members.map(member => member === target ? { ...member, permission: permissionLevel } : member), updatedAt: now };
        if (!hasValidOwner(updated)) return { success: false, errorCode: 'PROJECT_MEMBER_STATE_CHANGED', message: '프로젝트 소유자 상태가 변경되었습니다. 다시 시도해 주세요.', errors: null };
        if (target.permission !== permissionLevel) appendProjectMemberHistory({ projectMemberId, eventType: 'PERMISSION_CHANGED', fromPermission: target.permission, toPermission: permissionLevel, fromActive: true, toActive: true, changeSource: 'PROJECT_MEMBER_MANAGEMENT', changedByWorkspaceMemberId: actorWorkspaceMemberId, changedByName: context.userName, changedAt: now });
        replaceProject(updated);
        return { success: true, message: `${target.name} 님의 권한을 변경했습니다.`, data: buildMemberList(updated, context) };
    });
}

/** Owner가 아닌 참여자를 비활성화하고 담당·감사 이력을 같은 Project Member ID에 보존합니다. */
export async function removeProjectMember(
    workspaceId: number,
    projectId: number,
    projectMemberId: number,
    context: ProjectMemberRequestContext
): Promise<ApiResponse<ProjectMemberListData>> {
    await waitForMockResponse();
    return withWorkspaceMutation(workspaceId, () => {
        const project = readProject(workspaceId, projectId);
        const target = project?.members.find(member => getProjectMemberId(projectId, member.workspaceMemberId) === projectMemberId);
        if (!project || !target || !canManageMembers(project, context)) return { success: false, errorCode: 'PROJECT_MEMBER_FORBIDDEN', message: '참여자를 제외할 수 없습니다.', errors: null };
        if (project.archivedAt) return { success: false, errorCode: 'INVALID_RESOURCE_STATE', message: '보관된 프로젝트에서는 참여자를 제외할 수 없습니다.', errors: null };
        if (!target.active) return { success: false, errorCode: 'PROJECT_MEMBER_STATE_CHANGED', message: '이미 참여 종료된 멤버입니다.', errors: null };
        if (target.isOwner) return { success: false, errorCode: 'PROJECT_OWNER_CANNOT_BE_REMOVED', message: '프로젝트 소유자는 제외할 수 없습니다. 소유권을 먼저 이전해 주세요.', errors: null };

        const now = new Date().toISOString();
        const actorWorkspaceMemberId = findActiveWorkspaceMemberByUserId(workspaceId, context.userId)?.workspaceMemberId ?? null;
        const meta = readProjectMemberMeta(projectId, target.workspaceMemberId);
        const updated = { ...project, members: project.members.map(member => member === target ? { ...member, active: false } : member), updatedAt: now };
        if (!hasValidOwner(updated)) return { success: false, errorCode: 'PROJECT_MEMBER_STATE_CHANGED', message: '프로젝트 소유자 상태가 변경되었습니다. 다시 시도해 주세요.', errors: null };

        // Owner 불변식까지 확인한 뒤에만 참여 기간과 감사 이력을 확정합니다.
        if (meta) saveProjectMemberMeta({ ...meta, leftAt: now });
        appendProjectMemberHistory({ projectMemberId, eventType: 'LEFT', fromPermission: target.permission, toPermission: target.permission, fromActive: true, toActive: false, changeSource: 'PROJECT_MEMBER_MANAGEMENT', changedByWorkspaceMemberId: actorWorkspaceMemberId, changedByName: context.userName, changedAt: now });
        replaceProject(updated);
        return { success: true, message: `${target.name} 님의 프로젝트 참여를 종료했습니다.`, data: buildMemberList(updated, context) };
    });
}

/** 같은 Project의 ACTIVE EDIT 참여자에게 소유권을 이전하고 별도 Owner 이력을 기록합니다. */
export async function transferProjectOwnership(
    workspaceId: number,
    projectId: number,
    newOwnerProjectMemberId: number,
    context: ProjectMemberRequestContext
): Promise<ApiResponse<ProjectMemberListData>> {
    await waitForMockResponse();
    return withWorkspaceMutation(workspaceId, () => {
        const project = readProject(workspaceId, projectId);
        const target = project?.members.find(member => getProjectMemberId(projectId, member.workspaceMemberId) === newOwnerProjectMemberId);
        const previous = project?.members.find(member => member.isOwner);
        const targetWorkspaceMember = target ? readWorkspaceMembers(workspaceId).find(member => member.workspaceMemberId === target.workspaceMemberId) : null;
        if (!project || !previous || !target || !canManageMembers(project, context)) return { success: false, errorCode: 'PROJECT_OWNER_TRANSFER_FORBIDDEN', message: '프로젝트 소유권을 이전할 수 없습니다.', errors: null };
        if (!target.active || target.permission !== 'EDIT' || targetWorkspaceMember?.status !== 'ACTIVE' || target.isOwner) return { success: false, errorCode: 'PROJECT_MEMBER_STATE_CHANGED', message: '소유권은 다른 ACTIVE EDIT 참여자에게만 이전할 수 있습니다.', errors: null };

        const now = new Date().toISOString();
        const actorWorkspaceMemberId = findActiveWorkspaceMemberByUserId(workspaceId, context.userId)?.workspaceMemberId;
        const previousProjectMemberId = getProjectMemberId(projectId, previous.workspaceMemberId);
        const updated = {
            ...project,
            ownerWorkspaceMemberId: target.workspaceMemberId,
            ownerName: target.name,
            members: project.members.map(member => ({
                ...member,
                isOwner: member.workspaceMemberId === target.workspaceMemberId
            })),
            updatedAt: now
        };
        if (!hasValidOwner(updated)) return { success: false, errorCode: 'PROJECT_MEMBER_STATE_CHANGED', message: '프로젝트 소유자 상태가 변경되었습니다. 다시 시도해 주세요.', errors: null };
        if (!actorWorkspaceMemberId) return { success: false, errorCode: 'PROJECT_OWNER_TRANSFER_FORBIDDEN', message: '프로젝트 소유권을 이전할 권한이 없습니다.', errors: null };
        appendProjectOwnerHistory({ projectId, fromProjectMemberId: previousProjectMemberId, toProjectMemberId: newOwnerProjectMemberId, changedByWorkspaceMemberId: actorWorkspaceMemberId, changedByName: context.userName, changedAt: now });
        replaceProject(updated);
        return { success: true, message: `${target.name} 님에게 프로젝트 소유권을 이전했습니다.`, data: buildMemberList(updated, context) };
    });
}

/** 관리 권한 사용자에게 멤버 권한·참여와 관련 Owner 변경 이력을 하나의 시간순 목록으로 제공합니다. */
export async function getProjectMemberHistories(
    workspaceId: number,
    projectId: number,
    projectMemberId: number,
    context: ProjectMemberRequestContext
): Promise<ApiResponse<ProjectMemberHistoryItem[]>> {
    await waitForMockResponse();
    const project = readProject(workspaceId, projectId);
    if (!project || !canManageMembers(project, context)) return { success: false, errorCode: 'PROJECT_MEMBER_HISTORY_FORBIDDEN', message: '변경 이력을 조회할 권한이 없습니다.', errors: null };
    const member = project.members.find(item => getProjectMemberId(projectId, item.workspaceMemberId) === projectMemberId);
    if (!member) return { success: false, errorCode: 'PROJECT_MEMBER_NOT_FOUND', message: '프로젝트 참여자를 찾을 수 없습니다.', errors: null };

    const memberItems: ProjectMemberHistoryItem[] = readProjectMemberHistories(projectMemberId).map(history => ({
        historyId: history.historyId,
        eventType: history.eventType,
        label: history.eventType === 'BASELINE' ? '초기 참여 정보' : history.eventType === 'JOINED' ? '프로젝트 참여' : history.eventType === 'REJOINED' ? '프로젝트 재참여' : history.eventType === 'LEFT' ? '참여 종료' : '권한 변경',
        fromPermission: history.fromPermission,
        toPermission: history.toPermission,
        changeSource: history.changeSource,
        changedByName: history.changedByName,
        changedAt: history.changedAt
    }));
    const ownerItems: ProjectMemberHistoryItem[] = readProjectOwnerHistories(projectId, projectMemberId).flatMap(history => {
        const items: ProjectMemberHistoryItem[] = [];
        if (history.fromProjectMemberId === projectMemberId) items.push({ historyId: 1_000_000 + history.historyId * 2, eventType: 'OWNER_RELEASED', label: '프로젝트 소유자 해제', fromPermission: 'EDIT', toPermission: 'EDIT', changeSource: 'PROJECT_MEMBER_MANAGEMENT', changedByName: history.changedByName, changedAt: history.changedAt });
        if (history.toProjectMemberId === projectMemberId) items.push({ historyId: 1_000_001 + history.historyId * 2, eventType: 'OWNER_ASSIGNED', label: '프로젝트 소유자 지정', fromPermission: 'EDIT', toPermission: 'EDIT', changeSource: 'PROJECT_MEMBER_MANAGEMENT', changedByName: history.changedByName, changedAt: history.changedAt });
        return items;
    });
    return { success: true, data: [...memberItems, ...ownerItems].sort((left, right) => right.changedAt.localeCompare(left.changedAt)) };
}
