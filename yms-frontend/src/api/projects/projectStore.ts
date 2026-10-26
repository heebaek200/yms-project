import type {
    ProjectDetail,
    ProjectMemberAuditEvent,
    ProjectMemberPermission
} from '../../types/project';

let nextProjectId = 33;
type DeletedProjectFinance = Pick<ProjectDetail, 'projectId' | 'projectGroupId' | 'workerAmount' | 'directExpenseAmount' | 'directRevenueAmount' | 'videoContents'>;
let deletedProjectFinance: DeletedProjectFinance[] = [];

// 프로젝트·프로젝트 그룹·멤버 제외 검증이 같은 Mock 데이터를 사용하도록 한 저장소에서 관리합니다.
let projects: ProjectDetail[] = [
    {
        projectId: 11, workspaceId: 1, title: '카메라 롱폼 리뷰', content: '신제품 카메라의 실제 촬영 결과를 리뷰합니다.',
        channelId: 1, channelName: 'YMS 메인 채널', projectGroupId: 1, projectGroupName: '신제품 카메라 협찬', videoType: 'LONG', status: 'REVIEW',
        ownerWorkspaceMemberId: 101, ownerName: '테스트 사용자', dueDate: '2026-10-22', plannedUploadDate: '2026-10-25',
        archivedAt: null, updatedAt: '2026-10-19T14:10:00+09:00', taskCount: 4, completedTaskCount: 3, isParticipant: true,
        workerAmount: '1200000.00', directExpenseAmount: '300000.00', directRevenueAmount: '450000.00',
        members: [{ workspaceMemberId: 101, userId: 24601, name: '테스트 사용자', permission: 'EDIT', active: true, isOwner: true }, { workspaceMemberId: 104, userId: 24604, name: '이편집', permission: 'EDIT', active: true, isOwner: false }, { workspaceMemberId: 103, userId: 24603, name: '김관리', permission: 'VIEW', active: false, isOwner: false }],
        statusHistory: [{ status: 'PLANNING', changedAt: '2026-09-01T09:00:00+09:00', changedByName: '테스트 사용자' }, { status: 'REVIEW', changedAt: '2026-10-19T14:10:00+09:00', changedByName: '테스트 사용자' }],
        videoContents: [{
            videoContentId: 101, title: '카메라 롱폼 리뷰 완성본', videoType: 'LONG', primaryProjectId: 11, connectedProjectIds: [11], primaryProjectHistory: [{ fromProjectId: null, toProjectId: 11, fromProjectGroupId: null, toProjectGroupId: 1, changedByName: '테스트 사용자', changedAt: '2026-10-01T17:00:00+09:00', reason: '영상 결과물 생성' }],
            currentPerformance: { viewCount: 50000, likeCount: 3200, commentCount: 180, estimatedRevenue: '150000.00', completeness: 'COMPLETE', includedPublicationCount: 1, missingPublicationCount: 0 },
            cumulativePerformance: { viewCount: 170000, likeCount: 11100, commentCount: 590, estimatedRevenue: '480000.00', completeness: 'COMPLETE', includedPublicationCount: 3, missingPublicationCount: 0 },
            publications: [
                { publicationId: 1000, channelId: 1, channelName: 'YMS 메인 채널', youtubeVideoId: 'a7Kx_9Qm2Lp', youtubeVideoUrl: 'https://www.youtube.com/watch?v=a7Kx_9Qm2Lp', lifecycleStatus: 'REMOVED', removalReason: 'UNAVAILABLE', supersededByPublicationId: null, revenueOption: 'CUSTOM', appliedRate: '2.50', publishedAt: '2026-09-20T18:00:00+09:00', createdAt: '2026-09-20T18:00:00+09:00', performance: { viewCount: 20000, likeCount: 1200, commentCount: 60, syncStatus: 'SUCCESS', lastAttemptedAt: '2026-09-28T13:00:00+09:00', lastSuccessAt: '2026-09-28T13:00:00+09:00', lastErrorMessage: null }, statusHistory: [{ fromStatus: null, toStatus: 'CURRENT', fromRemovalReason: null, toRemovalReason: null, relatedPublicationId: null, changedByName: '테스트 사용자', changedAt: '2026-09-20T18:00:00+09:00', reason: '최초 게시' }, { fromStatus: 'CURRENT', toStatus: 'REMOVED', fromRemovalReason: null, toRemovalReason: 'UNAVAILABLE', relatedPublicationId: null, changedByName: '테스트 사용자', changedAt: '2026-09-29T09:00:00+09:00', reason: '외부 게시 종료' }] },
                { publicationId: 1001, channelId: 1, channelName: 'YMS 메인 채널', youtubeVideoId: 'V3n-pR8zX1c', youtubeVideoUrl: 'https://www.youtube.com/watch?v=V3n-pR8zX1c', lifecycleStatus: 'SUPERSEDED', removalReason: null, supersededByPublicationId: 1002, revenueOption: 'CUSTOM', appliedRate: '2.80', publishedAt: '2026-10-01T18:00:00+09:00', createdAt: '2026-10-01T18:00:00+09:00', performance: { viewCount: 100000, likeCount: 6700, commentCount: 350, syncStatus: 'SUCCESS', lastAttemptedAt: '2026-10-12T13:00:00+09:00', lastSuccessAt: '2026-10-12T13:00:00+09:00', lastErrorMessage: null }, statusHistory: [{ fromStatus: null, toStatus: 'CURRENT', fromRemovalReason: null, toRemovalReason: null, relatedPublicationId: null, changedByName: '테스트 사용자', changedAt: '2026-10-01T18:00:00+09:00', reason: '최초 게시' }, { fromStatus: 'CURRENT', toStatus: 'SUPERSEDED', fromRemovalReason: null, toRemovalReason: null, relatedPublicationId: 1002, changedByName: '테스트 사용자', changedAt: '2026-10-13T18:00:00+09:00', reason: '수정본으로 교체' }] },
                { publicationId: 1002, channelId: 1, channelName: 'YMS 메인 채널', youtubeVideoId: 'qM5tY_2wK9B', youtubeVideoUrl: 'https://www.youtube.com/watch?v=qM5tY_2wK9B', lifecycleStatus: 'CURRENT', removalReason: null, supersededByPublicationId: null, revenueOption: 'DEFAULT', appliedRate: '3.00', publishedAt: '2026-10-13T18:00:00+09:00', createdAt: '2026-10-13T18:00:00+09:00', performance: { viewCount: 50000, likeCount: 3200, commentCount: 180, syncStatus: 'SUCCESS', lastAttemptedAt: '2026-10-19T13:00:00+09:00', lastSuccessAt: '2026-10-19T13:00:00+09:00', lastErrorMessage: null }, statusHistory: [{ fromStatus: null, toStatus: 'CURRENT', fromRemovalReason: null, toRemovalReason: null, relatedPublicationId: 1001, changedByName: '테스트 사용자', changedAt: '2026-10-13T18:00:00+09:00', reason: '수정본 게시' }] }
            ]
        }]
    },
    {
        projectId: 12, workspaceId: 1, title: '카메라 Shorts #1', content: '핵심 기능 30초 요약', channelId: 2, channelName: 'YMS Shorts', projectGroupId: 1, projectGroupName: '신제품 카메라 협찬', videoType: 'SHORTS', status: 'UPLOADED', ownerWorkspaceMemberId: 102, ownerName: '윤공동', dueDate: '2026-10-03', plannedUploadDate: '2026-10-05', archivedAt: '2026-10-12T09:00:00+09:00', updatedAt: '2026-10-12T09:00:00+09:00', taskCount: 3, completedTaskCount: 3, isParticipant: false, workerAmount: '350000.00', directExpenseAmount: '100000.00', directRevenueAmount: '150000.00', members: [{ workspaceMemberId: 102, userId: 24602, name: '윤공동', permission: 'EDIT', active: true, isOwner: true }, { workspaceMemberId: 104, userId: 24604, name: '이편집', permission: 'EDIT', active: true, isOwner: false }], statusHistory: [{ status: 'UPLOADED', changedAt: '2026-10-05T18:00:00+09:00', changedByName: '윤공동' }], videoContents: []
    },
    {
        projectId: 13, workspaceId: 1, title: '가을 굿즈 티저', content: null, channelId: 2, channelName: 'YMS Shorts', projectGroupId: 2, projectGroupName: '가을 굿즈 소개', videoType: 'SHORTS', status: 'PLANNING', ownerWorkspaceMemberId: 102, ownerName: '윤공동', dueDate: null, plannedUploadDate: null, archivedAt: null, updatedAt: '2026-10-18T08:00:00+09:00', taskCount: 0, completedTaskCount: 0, isParticipant: false, workerAmount: '0.00', directExpenseAmount: '0.00', directRevenueAmount: '0.00', members: [{ workspaceMemberId: 102, userId: 24602, name: '윤공동', permission: 'EDIT', active: true, isOwner: true }], statusHistory: [{ status: 'PLANNING', changedAt: '2026-10-18T08:00:00+09:00', changedByName: '윤공동' }], videoContents: []
    },
    {
        projectId: 14, workspaceId: 1, title: '10월 편집 비하인드', content: '편집자의 작업 과정을 소개합니다.', channelId: 1, channelName: 'YMS 메인 채널', projectGroupId: null, projectGroupName: null, videoType: 'LONG', status: 'EDITING', ownerWorkspaceMemberId: 104, ownerName: '이편집', dueDate: '2026-10-28', plannedUploadDate: '2026-10-31', archivedAt: null, updatedAt: '2026-10-20T09:00:00+09:00', taskCount: 2, completedTaskCount: 1, isParticipant: true, workerAmount: '600000.00', directExpenseAmount: '180000.00', directRevenueAmount: '0.00', members: [{ workspaceMemberId: 104, userId: 24604, name: '이편집', permission: 'EDIT', active: true, isOwner: true }, { workspaceMemberId: 101, userId: 24601, name: '테스트 사용자', permission: 'VIEW', active: true, isOwner: false }], statusHistory: [{ status: 'EDITING', changedAt: '2026-10-20T09:00:00+09:00', changedByName: '이편집' }], videoContents: []
    },
    {
        projectId: 15, workspaceId: 1, title: '장비 세팅 Shorts', content: null, channelId: 3, channelName: '테크 리뷰', projectGroupId: null, projectGroupName: null, videoType: 'SHORTS', status: 'PLANNING', ownerWorkspaceMemberId: 101, ownerName: '테스트 사용자', dueDate: null, plannedUploadDate: null, archivedAt: null, updatedAt: '2026-10-17T11:00:00+09:00', taskCount: 1, completedTaskCount: 0, isParticipant: true, workerAmount: '200000.00', directExpenseAmount: '0.00', directRevenueAmount: '0.00', members: [{ workspaceMemberId: 101, userId: 24601, name: '테스트 사용자', permission: 'EDIT', active: true, isOwner: true }], statusHistory: [{ status: 'PLANNING', changedAt: '2026-10-17T11:00:00+09:00', changedByName: '테스트 사용자' }], videoContents: []
    },
    {
        // 일반 멤버가 소유권 없이 참여한 프로젝트의 조회·권한 경계를 확인하는 가벼운 Mock입니다.
        projectId: 31, workspaceId: 2, title: '샘플 채널 콘텐츠', content: 'Sample Creator Team의 일반 멤버 참여 화면을 확인합니다.',
        channelId: 21, channelName: 'Sample Creator', projectGroupId: null, projectGroupName: null, videoType: 'LONG', status: 'EDITING',
        ownerWorkspaceMemberId: 201, ownerName: '샘플 크리에이터', dueDate: '2026-09-18', plannedUploadDate: '2026-09-20',
        archivedAt: null, updatedAt: '2026-09-14T09:00:00+09:00', taskCount: 1, completedTaskCount: 0, isParticipant: true,
        workerAmount: '250000.00', directExpenseAmount: '0.00', directRevenueAmount: '0.00',
        members: [{ workspaceMemberId: 201, userId: 24621, name: '샘플 크리에이터', permission: 'EDIT', active: true, isOwner: true }, { workspaceMemberId: 202, userId: 24601, name: '테스트 사용자', permission: 'VIEW', active: true, isOwner: false }],
        statusHistory: [{ status: 'PLANNING', changedAt: '2026-09-01T09:00:00+09:00', changedByName: '샘플 크리에이터' }, { status: 'EDITING', changedAt: '2026-09-14T09:00:00+09:00', changedByName: '샘플 크리에이터' }], videoContents: []
    },
    {
        // 일반 멤버가 소유권 없이 편집에 참여한 프로젝트의 수정 권한 경계를 확인합니다.
        projectId: 32, workspaceId: 2, title: '두 번째 제작팀 마감 작업', content: '편집 참여자는 제작 정보만 수정할 수 있는지 확인합니다.',
        channelId: 21, channelName: 'Sample Creator', projectGroupId: null, projectGroupName: null, videoType: 'SHORTS', status: 'EDITING',
        ownerWorkspaceMemberId: 201, ownerName: '샘플 크리에이터', dueDate: '2026-09-29', plannedUploadDate: '2026-09-30',
        archivedAt: null, updatedAt: '2026-09-26T09:00:00+09:00', taskCount: 1, completedTaskCount: 0, isParticipant: true,
        workerAmount: '180000.00', directExpenseAmount: '0.00', directRevenueAmount: '0.00',
        members: [{ workspaceMemberId: 201, userId: 24621, name: '샘플 크리에이터', permission: 'EDIT', active: true, isOwner: true }, { workspaceMemberId: 202, userId: 24601, name: '테스트 사용자', permission: 'EDIT', active: true, isOwner: false }],
        statusHistory: [{ status: 'PLANNING', changedAt: '2026-09-10T09:00:00+09:00', changedByName: '샘플 크리에이터' }, { status: 'EDITING', changedAt: '2026-09-26T09:00:00+09:00', changedByName: '샘플 크리에이터' }], videoContents: []
    }
];

// 합본 결과물의 N:M 조회와 대표 Project 삭제 이전을 검증하도록 Project #12에도 같은 결과물을 연결합니다.
const sharedCameraContent = projects.find(project => project.projectId === 11)?.videoContents[0];
if (sharedCameraContent) {
    sharedCameraContent.connectedProjectIds = [11, 12];
    projects = projects.map(project => project.projectId === 12
        ? { ...project, videoContents: [sharedCameraContent] }
        : project);
}

export type StoredProjectMemberMeta = {
    projectMemberId: number;
    projectId: number;
    workspaceMemberId: number;
    joinedAt: string;
    leftAt: string | null;
    incompleteTaskCount: number;
};

export type StoredProjectMemberHistory = {
    historyId: number;
    projectMemberId: number;
    eventType: ProjectMemberAuditEvent;
    fromPermission: ProjectMemberPermission | null;
    toPermission: ProjectMemberPermission | null;
    fromActive: boolean | null;
    toActive: boolean;
    changeSource: 'SYSTEM' | 'PROJECT_MEMBER_MANAGEMENT' | 'WORKSPACE_MEMBERSHIP';
    changedByWorkspaceMemberId: number | null;
    changedByName: string;
    changedAt: string;
};

export type StoredProjectOwnerHistory = {
    historyId: number;
    projectId: number;
    fromProjectMemberId: number;
    toProjectMemberId: number;
    changedByWorkspaceMemberId: number;
    changedByName: string;
    changedAt: string;
};

const projectMemberMeta = new Map<number, StoredProjectMemberMeta>();
let projectMemberHistories: StoredProjectMemberHistory[] = [];
let projectOwnerHistories: StoredProjectOwnerHistory[] = [];
let nextMemberHistoryId = 1;
let nextOwnerHistoryId = 1;

/** Project와 Workspace Member 조합으로 Mock에서 재사용할 안정적인 Project Member ID를 만듭니다. */
export function getProjectMemberId(projectId: number, workspaceMemberId: number): number {
    return projectId * 100_000 + workspaceMemberId;
}

/** 감사 기능 도입 전에 존재한 Project 데이터에 SYSTEM BASELINE을 한 번만 준비합니다. */
function initializeExistingProjectMemberRecords(project: ProjectDetail) {
    const baselineAt = project.statusHistory[0]?.changedAt ?? project.updatedAt;
    const incompleteTaskCount = Math.max(0, project.taskCount - project.completedTaskCount);
    const primaryAssignee = project.members.find(member => !member.isOwner && member.permission === 'EDIT')
        ?? project.members.find(member => member.permission === 'EDIT');

    project.members.forEach(member => {
        const projectMemberId = getProjectMemberId(project.projectId, member.workspaceMemberId);
        if (projectMemberMeta.has(projectMemberId)) return;

        // 담당 Task 저장소가 없는 현재 Mock에서는 미완료 작업을 대표 EDIT 참여자에게 배정해 영향 수를 검증합니다.
        projectMemberMeta.set(projectMemberId, {
            projectMemberId,
            projectId: project.projectId,
            workspaceMemberId: member.workspaceMemberId,
            joinedAt: baselineAt,
            leftAt: member.active ? null : project.updatedAt,
            incompleteTaskCount: primaryAssignee?.workspaceMemberId === member.workspaceMemberId
                ? incompleteTaskCount
                : 0
        });
        projectMemberHistories.push({
            historyId: nextMemberHistoryId++,
            projectMemberId,
            eventType: 'BASELINE',
            fromPermission: null,
            toPermission: member.permission,
            fromActive: null,
            toActive: member.active,
            changeSource: 'SYSTEM',
            changedByWorkspaceMemberId: null,
            changedByName: 'SYSTEM',
            changedAt: baselineAt
        });
    });
}

projects.forEach(initializeExistingProjectMemberRecords);

/** 새 Project의 최초 참여자를 실제 생성 시점의 JOINED 감사 사건으로 기록합니다. */
function initializeCreatedProjectMemberRecords(project: ProjectDetail) {
    const joinedAt = project.statusHistory[0]?.changedAt ?? project.updatedAt;
    const changedByName = project.statusHistory[0]?.changedByName ?? project.ownerName;

    project.members.forEach(member => {
        const projectMemberId = getProjectMemberId(project.projectId, member.workspaceMemberId);
        projectMemberMeta.set(projectMemberId, {
            projectMemberId,
            projectId: project.projectId,
            workspaceMemberId: member.workspaceMemberId,
            joinedAt,
            leftAt: member.active ? null : joinedAt,
            incompleteTaskCount: 0
        });
        projectMemberHistories.push({
            historyId: nextMemberHistoryId++,
            projectMemberId,
            eventType: 'JOINED',
            fromPermission: null,
            toPermission: member.permission,
            fromActive: null,
            toActive: member.active,
            changeSource: 'SYSTEM',
            changedByWorkspaceMemberId: project.ownerWorkspaceMemberId,
            changedByName,
            changedAt: joinedAt
        });
    });
}

/** Project Member의 현재 참여 기간과 Mock 담당 작업 수를 복사해 반환합니다. */
export function readProjectMemberMeta(projectId: number, workspaceMemberId: number): StoredProjectMemberMeta | null {
    const meta = projectMemberMeta.get(getProjectMemberId(projectId, workspaceMemberId));
    return meta ? { ...meta } : null;
}

/** 새 참여 또는 재참여의 현재 메타를 저장하고 같은 Project Member ID를 계속 사용합니다. */
export function saveProjectMemberMeta(meta: StoredProjectMemberMeta) {
    projectMemberMeta.set(meta.projectMemberId, { ...meta });
}

/** 참여·권한 변경 사건을 append-only 감사 이력에 기록합니다. */
export function appendProjectMemberHistory(history: Omit<StoredProjectMemberHistory, 'historyId'>) {
    projectMemberHistories = [...projectMemberHistories, {
        ...history,
        historyId: nextMemberHistoryId++
    }];
}

/** 관리 화면의 멤버별 이력 모달에서 사용할 참여·권한 감사 이력을 반환합니다. */
export function readProjectMemberHistories(projectMemberId: number): StoredProjectMemberHistory[] {
    return projectMemberHistories
        .filter(history => history.projectMemberId === projectMemberId)
        .map(history => ({ ...history }));
}

/** 소유권 이전 사건을 참여 권한 이력과 분리해 append-only로 기록합니다. */
export function appendProjectOwnerHistory(history: Omit<StoredProjectOwnerHistory, 'historyId'>) {
    projectOwnerHistories = [...projectOwnerHistories, {
        ...history,
        historyId: nextOwnerHistoryId++
    }];
}

/** 선택한 멤버가 이전·신규 Owner였던 소유권 변경 이력을 반환합니다. */
export function readProjectOwnerHistories(projectId: number, projectMemberId: number): StoredProjectOwnerHistory[] {
    return projectOwnerHistories
        .filter(history => history.projectId === projectId && (
            history.fromProjectMemberId === projectMemberId
            || history.toProjectMemberId === projectMemberId
        ))
        .map(history => ({ ...history }));
}

/** 공유 결과물의 중첩 게시물·성과·상태 이력까지 복사합니다. */
function cloneVideoContent(content: ProjectDetail['videoContents'][number]) {
    return {
        ...content,
        connectedProjectIds: [...content.connectedProjectIds],
        primaryProjectHistory: content.primaryProjectHistory.map(history => ({ ...history })),
        currentPerformance: { ...content.currentPerformance },
        cumulativePerformance: { ...content.cumulativePerformance },
        publications: content.publications.map(publication => ({
            ...publication,
            performance: publication.performance ? { ...publication.performance } : null,
            statusHistory: publication.statusHistory.map(history => ({ ...history }))
        }))
    };
}

/** 중첩 배열까지 복사해 API 호출자가 Mock 원본을 직접 수정하지 못하게 합니다. */
function cloneProject(project: ProjectDetail): ProjectDetail {
    return {
        ...project,
        members: project.members.map(member => ({ ...member })),
        statusHistory: project.statusHistory.map(history => ({ ...history })),
        // 결과물은 여러 Project에 표시될 수 있으므로 게시물·성과·상태 이력까지 깊은 복사합니다.
        videoContents: project.videoContents.map(cloneVideoContent)
    };
}

/** 삭제되지 않은 프로젝트 전체를 조회 API와 프로젝트 그룹 집계에 제공합니다. */
export function readProjects(): ProjectDetail[] {
    return projects.map(cloneProject);
}

/** Workspace와 ID가 일치하는 삭제되지 않은 프로젝트를 반환합니다. */
export function readProject(workspaceId: number, projectId: number): ProjectDetail | null {
    const project = projects.find(item => item.workspaceId === workspaceId && item.projectId === projectId);
    return project ? cloneProject(project) : null;
}

/** 검증된 프로젝트에 ID를 발급해 저장합니다. */
export function insertProject(project: Omit<ProjectDetail, 'projectId'>): ProjectDetail {
    const created = { ...project, projectId: nextProjectId };
    nextProjectId += 1;
    projects = [...projects, cloneProject(created)];
    initializeCreatedProjectMemberRecords(created);
    return cloneProject(created);
}

/** 프로젝트의 최신 전체 상태를 교체합니다. */
export function replaceProject(project: ProjectDetail) {
    projects = projects.map(item => item.projectId === project.projectId ? cloneProject(project) : item);
}

/** 공유 VideoContent를 참조하는 모든 Project 복사본을 함께 교체해 Mock의 N:M 관계를 일관되게 유지합니다. */
export function replaceVideoContent(videoContentId: number, nextContent: ProjectDetail['videoContents'][number]) {
    projects = projects.map(project => {
        if (!project.videoContents.some(content => content.videoContentId === videoContentId)) return project;
        const videoContents = project.videoContents.map(content => (
            content.videoContentId === videoContentId ? nextContent : content
        ));
        return cloneProject({ ...project, videoContents, updatedAt: new Date().toISOString() });
    });
}

/** Workspace 안에서 중복 게시물과 공유 결과물을 검증할 수 있도록 고유 VideoContent 목록을 반환합니다. */
export function readWorkspaceVideoContents(workspaceId: number) {
    const contents = new Map<number, ProjectDetail['videoContents'][number]>();
    projects.filter(project => project.workspaceId === workspaceId).forEach(project => {
        project.videoContents.forEach(content => contents.set(content.videoContentId, content));
    });
    return [...contents.values()].map(cloneVideoContent);
}

/** 논리 삭제된 프로젝트를 일반 조회 경계 밖으로 이동합니다. */
export function removeProject(projectId: number) {
    const target = projects.find(project => project.projectId === projectId);
    if (target) {
        // 일반 조회에서는 제거하되 비용·수익·정산 집계가 끊기지 않도록 귀속 금액을 별도 보존합니다.
        deletedProjectFinance = [...deletedProjectFinance, {
            projectId: target.projectId,
            projectGroupId: target.projectGroupId,
            workerAmount: target.workerAmount,
            directExpenseAmount: target.directExpenseAmount,
            directRevenueAmount: target.directRevenueAmount,
            // 활성 집계에서는 제외하지만 결과물과 게시 이력은 논리 삭제 이력 안에 보존합니다.
            videoContents: target.videoContents
        }];
    }
    projects = projects.filter(project => project.projectId !== projectId);
}

/** 삭제 프로젝트의 보존 재무 금액을 ProjectGroup 실제 집계에 제공합니다. */
export function readDeletedProjectFinanceByGroup(projectGroupId: number) {
    return deletedProjectFinance
        .filter(project => project.projectGroupId === projectGroupId)
        .map(project => ({ ...project }));
}

/** ProjectGroup 기능에서 여러 프로젝트의 그룹 연결만 변경합니다. */
export function setProjectGroup(projectIds: readonly number[], projectGroupId: number | null, projectGroupName: string | null = null) {
    const ids = new Set(projectIds);
    projects = projects.map(project => ids.has(project.projectId) ? { ...project, projectGroupId, projectGroupName, updatedAt: new Date().toISOString() } : project);
}

/** 비삭제 프로젝트 소유 수를 반환해 제작팀 이탈·제외를 사전에 차단합니다. */
export function countOwnedProjects(workspaceId: number, workspaceMemberId: number): number {
    return projects.filter(project => project.workspaceId === workspaceId && project.ownerWorkspaceMemberId === workspaceMemberId).length;
}

/** 제작팀 제외 시 남아 있는 프로젝트 참여를 비활성화합니다. */
export function deactivateProjectMemberships(workspaceId: number, workspaceMemberId: number, changedByName = 'SYSTEM', changedByWorkspaceMemberId: number | null = null) {
    const changedAt = new Date().toISOString();
    projects = projects.map(project => {
        if (project.workspaceId !== workspaceId) return project;
        const target = project.members.find(member => member.workspaceMemberId === workspaceMemberId && member.active);
        if (!target) return project;

        // Workspace 이탈도 Project Member의 동일 ID와 담당 이력을 보존한 채 LEFT 사건으로 남깁니다.
        const projectMemberId = getProjectMemberId(project.projectId, workspaceMemberId);
        const meta = readProjectMemberMeta(project.projectId, workspaceMemberId);
        if (meta) saveProjectMemberMeta({ ...meta, leftAt: changedAt });
        appendProjectMemberHistory({
            projectMemberId,
            eventType: 'LEFT',
            fromPermission: target.permission,
            toPermission: target.permission,
            fromActive: true,
            toActive: false,
            changeSource: 'WORKSPACE_MEMBERSHIP',
            changedByWorkspaceMemberId,
            changedByName,
            changedAt
        });
        return {
            ...project,
            members: project.members.map(member => member.workspaceMemberId === workspaceMemberId
                ? { ...member, active: false }
                : member)
        };
    });
}
