import type { WorkspaceRole } from '../../types/workspace';
import type {
    PerformanceAggregate,
    ProjectDetail,
    ProjectDetailResponse,
    ProjectVideoType,
    VideoContent,
    YouTubePublication,
    YouTubeRemovalReason
} from '../../types/project';
import type { ApiResponse } from '../types';
import { findWorkspaceChannel } from '../workspaces/channels';
import { findActiveWorkspaceMemberByUserId } from '../workspaces/members';
import {
    readProject,
    readWorkspaceVideoContents,
    replaceProject,
    replaceVideoContent
} from './projectStore';
import { toProjectDetailResponse } from './projectResponses';

type YouTubeContext = { userId: number; userName: string; workspaceRole: WorkspaceRole };
type CreateVideoContentRequest = { title?: string; videoType?: ProjectVideoType };
type CreatePublicationRequest = {
    channelId: number;
    youtubeVideo: string;
    supersedesPublicationId?: number | null;
};
type ChangePrimaryProjectRequest = {
    newPrimaryProjectId: number;
    confirmContentPerformanceMove?: boolean;
};

const VIDEO_ID_PATTERN = /^[A-Za-z0-9_-]{11}$/;
let nextVideoContentId = 102;
let nextPublicationId = 1003;

/** YouTube URL 또는 11자 ID에서 내부 게시 이력용 Video ID를 추출합니다. */
function normalizeVideoId(value: string): string | null {
    const trimmed = value.trim();
    if (VIDEO_ID_PATTERN.test(trimmed)) return trimmed;

    try {
        const url = new URL(trimmed);
        const id = url.hostname === 'youtu.be'
            ? url.pathname.split('/').filter(Boolean)[0]
            : url.pathname.startsWith('/shorts/')
                ? url.pathname.split('/')[2]
                : url.searchParams.get('v');
        return id && VIDEO_ID_PATTERN.test(id) ? id : null;
    } catch {
        return null;
    }
}

/** 소유자·EDIT 참여자·제작팀 관리자의 결과물과 게시물 관리 권한을 확인합니다. */
function canManage(project: ProjectDetail, context: YouTubeContext) {
    const member = findActiveWorkspaceMemberByUserId(project.workspaceId, context.userId);
    return context.workspaceRole !== 'MEMBER'
        || project.ownerWorkspaceMemberId === member?.workspaceMemberId
        || project.members.some(item => (
            item.userId === context.userId
            && item.active
            && item.permission === 'EDIT'
        ));
}

/** 현재 또는 누적 기준에 포함되는 게시물의 마지막 성공 성과를 합산합니다. */
function aggregatePublications(
    publications: YouTubePublication[],
    mode: 'current' | 'cumulative'
): PerformanceAggregate {
    const targets = publications.filter(publication => {
        if (mode === 'current') return publication.lifecycleStatus === 'CURRENT';
        if (publication.lifecycleStatus !== 'REMOVED') return true;
        return publication.removalReason === 'UNAVAILABLE';
    });
    const measured = targets.filter(publication => publication.performance?.lastSuccessAt);
    const missingPublicationCount = targets.length - measured.length;
    const completeness = targets.length === 0 || measured.length === 0
        ? 'UNAVAILABLE'
        : missingPublicationCount > 0 ? 'PARTIAL' : 'COMPLETE';

    const sums = measured.reduce((total, publication) => {
        const performance = publication.performance;
        if (!performance) return total;
        return {
            viewCount: total.viewCount + performance.viewCount,
            likeCount: total.likeCount + performance.likeCount,
            commentCount: total.commentCount + performance.commentCount,
            estimatedRevenue: total.estimatedRevenue
                + performance.viewCount * Number(publication.appliedRate)
        };
    }, { viewCount: 0, likeCount: 0, commentCount: 0, estimatedRevenue: 0 });

    return {
        ...sums,
        estimatedRevenue: sums.estimatedRevenue.toFixed(2),
        completeness,
        includedPublicationCount: measured.length,
        missingPublicationCount
    };
}

/** 게시물 변경 뒤 현재·누적 파생 집계를 같은 규칙으로 다시 계산합니다. */
function recalculateContent(content: VideoContent): VideoContent {
    return {
        ...content,
        currentPerformance: aggregatePublications(content.publications, 'current'),
        cumulativePerformance: aggregatePublications(content.publications, 'cumulative')
    };
}

/** Project 상세 안에서 관리 대상 VideoContent를 찾아 권한과 소속 경계를 함께 검증합니다. */
function findManageableContent(
    workspaceId: number,
    projectId: number,
    videoContentId: number,
    context: YouTubeContext
) {
    const project = readProject(workspaceId, projectId);
    const content = project?.videoContents.find(item => item.videoContentId === videoContentId) ?? null;
    return project && content && canManage(project, context) ? { project, content } : null;
}

/** Project 기본값을 제안값으로 사용해 게시 전 영상 결과물을 생성합니다. */
export async function createProjectVideoContent(
    workspaceId: number,
    projectId: number,
    request: CreateVideoContentRequest,
    context: YouTubeContext
): Promise<ApiResponse<ProjectDetailResponse>> {
    await new Promise(resolve => setTimeout(resolve, 250));
    const project = readProject(workspaceId, projectId);
    if (!project || !canManage(project, context)) {
        return { success: false, errorCode: 'VIDEO_CONTENT_FORBIDDEN', message: '영상 결과물을 추가할 권한이 없습니다.', errors: null };
    }

    const title = request.title?.trim() || project.title;
    const videoType = request.videoType ?? project.videoType;
    if (title.length > 150) {
        return { success: false, errorCode: 'INVALID_INPUT_VALUE', message: '결과물 제목은 150자 이하로 입력해 주세요.', errors: null };
    }

    const content: VideoContent = {
        videoContentId: nextVideoContentId++,
        title,
        videoType,
        primaryProjectId: projectId,
        connectedProjectIds: [projectId],
        primaryProjectHistory: [{ fromProjectId: null, toProjectId: projectId, fromProjectGroupId: null, toProjectGroupId: project.projectGroupId, changedByName: context.userName, changedAt: new Date().toISOString(), reason: '영상 결과물 생성' }],
        publications: [],
        currentPerformance: aggregatePublications([], 'current'),
        cumulativePerformance: aggregatePublications([], 'cumulative')
    };
    const updated = {
        ...project,
        videoContents: [...project.videoContents, content],
        updatedAt: new Date().toISOString()
    };
    replaceProject(updated);
    return { success: true, message: '영상 결과물을 추가했습니다.', data: toProjectDetailResponse(updated, context.workspaceRole) };
}

/** 동일 Workspace의 중복과 Channel별 단일 CURRENT 규칙을 확인해 게시 이력을 추가합니다. */
export async function createYouTubePublication(
    workspaceId: number,
    projectId: number,
    videoContentId: number,
    request: CreatePublicationRequest,
    context: YouTubeContext
): Promise<ApiResponse<ProjectDetailResponse>> {
    await new Promise(resolve => setTimeout(resolve, 250));
    const target = findManageableContent(workspaceId, projectId, videoContentId, context);
    const videoId = normalizeVideoId(request.youtubeVideo);
    const channel = findWorkspaceChannel(workspaceId, request.channelId);
    if (!target) return { success: false, errorCode: 'VIDEO_CONTENT_FORBIDDEN', message: '게시물을 추가할 권한이 없습니다.', errors: null };
    if (!videoId) return { success: false, errorCode: 'INVALID_YOUTUBE_VIDEO', message: '올바른 YouTube 영상 URL 또는 11자리 ID를 입력해 주세요.', errors: null };
    if (!channel?.active) return { success: false, errorCode: 'CHANNEL_NOT_FOUND', message: '사용 중인 채널을 선택해 주세요.', errors: null };

    const duplicate = readWorkspaceVideoContents(workspaceId)
        .flatMap(content => content.publications)
        .some(publication => publication.youtubeVideoId === videoId);
    if (duplicate) return { success: false, errorCode: 'DUPLICATE_YOUTUBE_VIDEO', message: '이 제작팀에 이미 등록된 YouTube 영상입니다.', errors: null };

    const current = target.content.publications.find(publication => (
        publication.channelId === channel.channelId
        && publication.lifecycleStatus === 'CURRENT'
    ));
    if (current && request.supersedesPublicationId !== current.publicationId) {
        return { success: false, errorCode: 'CURRENT_PUBLICATION_EXISTS', message: `${channel.name}에는 게시 중인 영상이 있습니다. 기존 게시물을 대체할지 확인해 주세요.`, errors: null };
    }

    const now = new Date().toISOString();
    const publicationId = nextPublicationId++;
    const appliedRate = target.content.videoType === 'LONG'
        ? channel.longFormRate
        : channel.shortFormRate;
    const publication: YouTubePublication = {
        publicationId,
        channelId: channel.channelId,
        channelName: channel.name,
        youtubeVideoId: videoId,
        youtubeVideoUrl: `https://www.youtube.com/watch?v=${videoId}`,
        lifecycleStatus: 'CURRENT',
        removalReason: null,
        supersededByPublicationId: null,
        revenueOption: 'DEFAULT',
        appliedRate,
        publishedAt: now,
        createdAt: now,
        performance: null,
        statusHistory: [{
            fromStatus: null,
            toStatus: 'CURRENT',
            fromRemovalReason: null,
            toRemovalReason: null,
            relatedPublicationId: current?.publicationId ?? null,
            changedByName: context.userName,
            changedAt: now,
            reason: current ? '기존 게시물 대체' : '최초 게시'
        }]
    };

    const publications = target.content.publications.map(item => item.publicationId !== current?.publicationId ? item : ({
        ...item,
        lifecycleStatus: 'SUPERSEDED' as const,
        removalReason: null,
        supersededByPublicationId: publicationId,
        statusHistory: [...item.statusHistory, {
            fromStatus: 'CURRENT' as const,
            toStatus: 'SUPERSEDED' as const,
            fromRemovalReason: null,
            toRemovalReason: null,
            relatedPublicationId: publicationId,
            changedByName: context.userName,
            changedAt: now,
            reason: '새 게시물로 대체'
        }]
    }));
    replaceVideoContent(videoContentId, recalculateContent({
        ...target.content,
        publications: [...publications, publication]
    }));
    const updated = readProject(workspaceId, projectId) as ProjectDetail;
    return { success: true, message: current ? '새 게시물을 등록하고 기존 게시물을 대체됨으로 변경했습니다.' : 'YouTube 게시물을 등록했습니다.', data: toProjectDetailResponse(updated, context.workspaceRole) };
}

/** 연결된 Project 사이에서 권한과 그룹 경계를 검증한 뒤 콘텐츠 성과의 집계 대상을 변경합니다. */
export async function changeVideoContentPrimaryProject(
    workspaceId: number,
    projectId: number,
    videoContentId: number,
    request: ChangePrimaryProjectRequest,
    context: YouTubeContext
): Promise<ApiResponse<ProjectDetailResponse>> {
    await new Promise(resolve => setTimeout(resolve, 250));
    const target = findManageableContent(workspaceId, projectId, videoContentId, context);
    const oldPrimary = target ? readProject(workspaceId, target.content.primaryProjectId) : null;
    const newPrimary = target ? readProject(workspaceId, request.newPrimaryProjectId) : null;
    if (!target || !oldPrimary || !newPrimary || !target.content.connectedProjectIds.includes(request.newPrimaryProjectId)) {
        return { success: false, errorCode: 'PROJECT_NOT_LINKED_TO_VIDEO_CONTENT', message: '연결된 활성 프로젝트만 성과 집계 대상으로 지정할 수 있습니다.', errors: null };
    }

    const crossesGroupBoundary = oldPrimary.projectGroupId !== newPrimary.projectGroupId;
    if (crossesGroupBoundary && context.workspaceRole === 'MEMBER') {
        return { success: false, errorCode: 'PRIMARY_PROJECT_GROUP_PERMISSION_REQUIRED', message: '프로젝트 그룹 경계를 넘는 집계 프로젝트 변경은 제작팀 소유자 또는 관리자만 할 수 있습니다.', errors: null };
    }
    if (!crossesGroupBoundary && (!canManage(oldPrimary, context) || !canManage(newPrimary, context))) {
        return { success: false, errorCode: 'PRIMARY_PROJECT_EDIT_FORBIDDEN', message: '현재와 새 성과 집계 프로젝트를 모두 관리할 수 있어야 합니다.', errors: null };
    }
    if (
        crossesGroupBoundary
        && target.content.cumulativePerformance.includedPublicationCount > 0
        && !request.confirmContentPerformanceMove
    ) {
        return {
            success: false,
            errorCode: 'CONTENT_PERFORMANCE_MOVE_CONFIRMATION_REQUIRED',
            message: '성과 집계 프로젝트를 바꾸면 콘텐츠 성과가 새 프로젝트 그룹으로 이동합니다. 실제 비용·수익은 이동하지 않습니다.',
            errors: null
        };
    }

    // API 검증을 통과한 변경만 반영하고 이전·새 그룹 스냅샷을 이력으로 보존합니다.
    const now = new Date().toISOString();
    replaceVideoContent(videoContentId, {
        ...target.content,
        primaryProjectId: request.newPrimaryProjectId,
        primaryProjectHistory: [...target.content.primaryProjectHistory, {
            fromProjectId: oldPrimary.projectId,
            toProjectId: request.newPrimaryProjectId,
            fromProjectGroupId: oldPrimary.projectGroupId,
            toProjectGroupId: newPrimary.projectGroupId,
            changedByName: context.userName,
            changedAt: now,
            reason: '사용자 지정 성과 집계 프로젝트 변경'
        }]
    });
    return { success: true, message: '성과 집계 프로젝트를 변경했습니다.', data: toProjectDetailResponse(readProject(workspaceId, projectId) as ProjectDetail, context.workspaceRole) };
}

/** 선택한 게시물만 Mock 동기화하고 다른 게시물과 생명주기는 변경하지 않습니다. */
export async function syncYouTubePublication(
    workspaceId: number,
    projectId: number,
    videoContentId: number,
    publicationId: number,
    context: YouTubeContext
): Promise<ApiResponse<ProjectDetailResponse>> {
    await new Promise(resolve => setTimeout(resolve, 350));
    const target = findManageableContent(workspaceId, projectId, videoContentId, context);
    const publication = target?.content.publications.find(item => item.publicationId === publicationId);
    if (!target || !publication) return { success: false, errorCode: 'PUBLICATION_NOT_FOUND', message: '동기화할 게시물을 찾을 수 없습니다.', errors: null };
    if (publication.lifecycleStatus !== 'CURRENT') return { success: false, errorCode: 'PUBLICATION_NOT_CURRENT', message: '게시 중인 게시물만 성과를 동기화할 수 있습니다.', errors: null };

    const now = new Date().toISOString();
    const previous = publication.performance;
    const performance = {
        viewCount: (previous?.viewCount ?? 0) + 1379,
        likeCount: (previous?.likeCount ?? 0) + 83,
        commentCount: (previous?.commentCount ?? 0) + 7,
        syncStatus: 'SUCCESS' as const,
        lastAttemptedAt: now,
        lastSuccessAt: now,
        lastErrorMessage: null
    };
    const publications = target.content.publications.map(item => (
        item.publicationId === publicationId ? { ...item, performance } : item
    ));
    replaceVideoContent(videoContentId, recalculateContent({ ...target.content, publications }));
    return { success: true, message: '게시물 성과를 동기화했습니다.', data: toProjectDetailResponse(readProject(workspaceId, projectId) as ProjectDetail, context.workspaceRole) };
}

/** 사용자 확인에 따라 게시물을 종료하고 사유별 누적 집계 포함 여부를 즉시 반영합니다. */
export async function removeYouTubePublication(
    workspaceId: number,
    projectId: number,
    videoContentId: number,
    publicationId: number,
    removalReason: YouTubeRemovalReason,
    context: YouTubeContext
): Promise<ApiResponse<ProjectDetailResponse>> {
    await new Promise(resolve => setTimeout(resolve, 250));
    const target = findManageableContent(workspaceId, projectId, videoContentId, context);
    const publication = target?.content.publications.find(item => item.publicationId === publicationId);
    if (!target || !publication) return { success: false, errorCode: 'PUBLICATION_NOT_FOUND', message: '게시물을 찾을 수 없습니다.', errors: null };

    const now = new Date().toISOString();
    const publications = target.content.publications.map(item => item.publicationId !== publicationId ? item : ({
        ...item,
        lifecycleStatus: 'REMOVED' as const,
        removalReason,
        supersededByPublicationId: null,
        statusHistory: [...item.statusHistory, {
            fromStatus: item.lifecycleStatus,
            toStatus: 'REMOVED' as const,
            fromRemovalReason: item.removalReason,
            toRemovalReason: removalReason,
            relatedPublicationId: null,
            changedByName: context.userName,
            changedAt: now,
            reason: removalReason === 'INCORRECT' ? '잘못 연결한 게시물' : '게시 운영 종료'
        }]
    }));
    replaceVideoContent(videoContentId, recalculateContent({ ...target.content, publications }));
    return { success: true, message: '게시물을 게시 종료 상태로 변경했습니다.', data: toProjectDetailResponse(readProject(workspaceId, projectId) as ProjectDetail, context.workspaceRole) };
}

/** 종료·대체 게시물을 CURRENT로 복원하고 같은 Channel의 기존 CURRENT는 명시적으로 대체합니다. */
export async function restoreYouTubePublication(
    workspaceId: number,
    projectId: number,
    videoContentId: number,
    publicationId: number,
    replaceCurrentPublicationId: number | null,
    context: YouTubeContext
): Promise<ApiResponse<ProjectDetailResponse>> {
    await new Promise(resolve => setTimeout(resolve, 250));
    const target = findManageableContent(workspaceId, projectId, videoContentId, context);
    const publication = target?.content.publications.find(item => item.publicationId === publicationId);
    if (!target || !publication) return { success: false, errorCode: 'PUBLICATION_NOT_FOUND', message: '복원할 게시물을 찾을 수 없습니다.', errors: null };

    const current = target.content.publications.find(item => (
        item.channelId === publication.channelId
        && item.lifecycleStatus === 'CURRENT'
        && item.publicationId !== publicationId
    ));
    if (current && current.publicationId !== replaceCurrentPublicationId) {
        return { success: false, errorCode: 'CURRENT_PUBLICATION_EXISTS', message: '같은 채널의 게시 중 영상을 대체할지 확인해 주세요.', errors: null };
    }

    const now = new Date().toISOString();
    const publications = target.content.publications.map(item => {
        if (item.publicationId === current?.publicationId) return {
            ...item,
            lifecycleStatus: 'SUPERSEDED' as const,
            removalReason: null,
            supersededByPublicationId: publicationId,
            statusHistory: [...item.statusHistory, { fromStatus: 'CURRENT' as const, toStatus: 'SUPERSEDED' as const, fromRemovalReason: null, toRemovalReason: null, relatedPublicationId: publicationId, changedByName: context.userName, changedAt: now, reason: '과거 게시물 복원으로 대체' }]
        };
        if (item.publicationId === publicationId) return {
            ...item,
            lifecycleStatus: 'CURRENT' as const,
            removalReason: null,
            supersededByPublicationId: null,
            statusHistory: [...item.statusHistory, { fromStatus: item.lifecycleStatus, toStatus: 'CURRENT' as const, fromRemovalReason: item.removalReason, toRemovalReason: null, relatedPublicationId: current?.publicationId ?? null, changedByName: context.userName, changedAt: now, reason: '게시물 복원' }]
        };
        return item;
    });
    replaceVideoContent(videoContentId, recalculateContent({ ...target.content, publications }));
    return { success: true, message: '게시물을 다시 게시 중 상태로 복원했습니다.', data: toProjectDetailResponse(readProject(workspaceId, projectId) as ProjectDetail, context.workspaceRole) };
}
