import type { WorkspaceRole } from '../../types/workspace';
import type {
    DefaultRateChangeConfirmation,
    DefaultRateChangeImpactItem,
    DuplicateYouTubeVideoLocation,
    PerformanceAggregate,
    PrimaryProjectChangeReasonType,
    ProjectDetail,
    ProjectDetailResponse,
    ProjectRevenueOption,
    ProjectVideoType,
    VideoContent,
    VideoContentProjectCandidate,
    YouTubePublication,
    YouTubeRemovalReason
} from '../../types/project';
import type { ApiResponse } from '../types';
import { findWorkspaceChannel } from '../workspaces/channels';
import { findActiveWorkspaceMemberByUserId } from '../workspaces/members';
import {
    deleteVideoContent,
    linkVideoContentToProject,
    readProject,
    readProjects,
    readWorkspaceVideoContents,
    replaceProject,
    replaceVideoContent,
    unlinkVideoContentFromProject
} from './projectStore';
import { toProjectDetailResponse } from './projectResponses';
import { canViewProject } from './projects';

export type YouTubeContext = { userId: number; userName: string; workspaceRole: WorkspaceRole };
export type InitialPublicationRequest = {
    channelId?: number;
    youtubeVideo: string;
    publishedAt?: string | null;
    revenueOption?: ProjectRevenueOption;
    customRevenuePerView?: string | null;
};
export type CreateVideoContentRequest = {
    title: string;
    videoType: ProjectVideoType;
    initialPublication?: InitialPublicationRequest | null;
};
export type UpdateVideoContentRequest = CreateVideoContentRequest & {
    expectedVersion: number;
    defaultRateChangeConfirmationToken?: string;
};
export type CreatePublicationRequest = {
    channelId?: number;
    youtubeVideo: string;
    publishedAt?: string | null;
    revenueOption?: ProjectRevenueOption;
    customRevenuePerView?: string | null;
    supersedesPublicationId?: number | null;
    supersedesPublicationVersion?: number | null;
};
export type UpdatePublicationRequest = {
    channelId: number;
    publishedAt: string | null;
    expectedVersion: number;
    replaceCurrentPublicationId?: number | null;
    replaceCurrentPublicationVersion?: number | null;
    defaultRateChangeConfirmationToken?: string;
};
export type UpdatePublicationRevenueRequest = {
    revenueOption: ProjectRevenueOption;
    customRevenuePerView?: string | null;
    expectedVersion: number;
};
export type ChangePrimaryProjectRequest = {
    newPrimaryProjectId: number;
    changeReasonType: PrimaryProjectChangeReasonType;
    changeReason?: string | null;
    expectedVersion: number;
    confirmContentPerformanceMove?: boolean;
};

type MutationResponse = ApiResponse<ProjectDetailResponse, DefaultRateChangeConfirmation | DuplicateYouTubeVideoLocation>;
type ConfirmationKind = 'VIDEO_TYPE' | 'PUBLICATION_CHANNEL';
type ConfirmationRecord = {
    token: string;
    kind: ConfirmationKind;
    userId: number;
    workspaceId: number;
    videoContentId: number;
    publicationId: number | null;
    requestSignature: string;
    impactSignature: string;
    publicationVersions: Array<{ publicationId: number; version: number }>;
    expiresAt: number;
};

const VIDEO_ID_PATTERN = /^[A-Za-z0-9_-]{11}$/;
const YOUTUBE_HOSTS = new Set(['youtube.com', 'www.youtube.com', 'm.youtube.com', 'music.youtube.com']);
const RATE_PATTERN = /^\d+(?:\.\d{1,6})?$/;
const PRIMARY_REASON_TYPES = new Set<PrimaryProjectChangeReasonType>(['MERGED', 'CONNECTION_CORRECTION', 'PERFORMANCE_ATTRIBUTION', 'OTHER']);
const CONFIRMATION_TTL_MS = 5 * 60 * 1000;
const confirmationRecords = new Map<string, ConfirmationRecord>();
let nextVideoContentId = 102;
let nextPublicationId = 1003;

/** YouTube URL 또는 11자 ID에서 내부 게시 이력용 Video ID를 추출합니다. */
function normalizeVideoId(value: string): string | null {
    const trimmed = value.trim();
    if (VIDEO_ID_PATTERN.test(trimmed)) return trimmed;

    try {
        const url = new URL(trimmed);
        if (url.protocol !== 'https:' && url.protocol !== 'http:') return null;
        const pathParts = url.pathname.split('/').filter(Boolean);
        const id = url.hostname === 'youtu.be'
            ? pathParts.length === 1 ? pathParts[0] : null
            : YOUTUBE_HOSTS.has(url.hostname) && url.pathname === '/watch'
                ? url.searchParams.get('v')
                : YOUTUBE_HOSTS.has(url.hostname) && pathParts.length === 2 && pathParts[0] === 'shorts'
                    ? pathParts[1]
                    : null;
        return id && VIDEO_ID_PATTERN.test(id) ? id : null;
    } catch {
        return null;
    }
}

/** 소수 문자열을 금액 비교에 사용할 정규형으로 바꿉니다. */
function comparableRate(value: string): string {
    const [integerPart, fractionPart = ''] = value.split('.');
    const integer = integerPart.replace(/^0+(?=\d)/, '') || '0';
    const fraction = fractionPart.replace(/0+$/, '');
    return fraction ? `${integer}.${fraction}` : integer;
}

/** CUSTOM 단가를 문자열 정밀도를 유지한 채 검증합니다. */
function normalizeCustomRate(value?: string | null): string | null {
    const normalized = value?.trim() ?? '';
    return RATE_PATTERN.test(normalized) ? normalized : null;
}

/** Project의 결과물 관리 권한을 확인합니다. */
function canManageProject(project: ProjectDetail, context: YouTubeContext) {
    const member = findActiveWorkspaceMemberByUserId(project.workspaceId, context.userId);
    return context.workspaceRole !== 'MEMBER'
        || project.ownerWorkspaceMemberId === member?.workspaceMemberId
        || project.members.some(item => item.userId === context.userId && item.active && item.permission === 'EDIT');
}

/** 중복 동영상의 연결 Project 중 현재 사용자가 조회할 수 있는 대표 이동 위치만 반환합니다. */
function duplicateVideoLocation(workspaceId: number, content: VideoContent, publication: YouTubePublication, context: YouTubeContext): DuplicateYouTubeVideoLocation {
    const accessibleProjects = content.connectedProjectIds
        .map(projectId => readProject(workspaceId, projectId))
        .filter((project): project is ProjectDetail => Boolean(project))
        .filter(project => canViewProject(project, context));
    const project = accessibleProjects.find(item => item.projectId === content.primaryProjectId) ?? accessibleProjects[0];
    if (!project) return { canAccess: false };
    return {
        canAccess: true,
        videoContentId: content.videoContentId,
        contentTitle: content.title,
        projectId: project.projectId,
        projectTitle: project.title,
        channelName: publication.channelName
    };
}

/** 조회 권한이 있는 기준 프로젝트에 연결된 콘텐츠만 반환합니다. */
function findReadableContent(workspaceId: number, projectId: number, videoContentId: number, context: YouTubeContext) {
    const anchorProject = readProject(workspaceId, projectId);
    if (!anchorProject || !canViewProject(anchorProject, context)) return null;
    const content = anchorProject.videoContents.find(item => item.videoContentId === videoContentId);
    return content ? { project: anchorProject, content } : null;
}

/** 연결된 활성 Project 중 하나의 권한으로 공유 콘텐츠를 관리할 수 있는지 확인합니다. */
function findManageableContent(workspaceId: number, projectId: number, videoContentId: number, context: YouTubeContext) {
    const target = findReadableContent(workspaceId, projectId, videoContentId, context);
    if (!target) return null;
    const manageableProject = target.content.connectedProjectIds
        .map(connectedId => readProject(workspaceId, connectedId))
        .find(project => project && project.archivedAt === null && canManageProject(project, context));
    return manageableProject ? target : null;
}

/** 보관 프로젝트를 기준으로 공유 콘텐츠를 변경할 수 있는 경로를 차단합니다. */
function findWritableContent(workspaceId: number, projectId: number, videoContentId: number, context: YouTubeContext) {
    const target = findManageableContent(workspaceId, projectId, videoContentId, context);
    return target?.project.archivedAt === null ? target : null;
}

/** 현재 또는 누적 기준에 포함되는 게시물의 마지막 성공 성과를 합산합니다. */
function aggregatePublications(publications: YouTubePublication[], mode: 'current' | 'cumulative'): PerformanceAggregate {
    const targets = publications.filter(publication => {
        if (mode === 'current') return publication.lifecycleStatus === 'CURRENT';
        return publication.lifecycleStatus !== 'REMOVED' || publication.removalReason === 'UNAVAILABLE';
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
            estimatedRevenue: total.estimatedRevenue + performance.viewCount * Number(publication.appliedRate)
        };
    }, { viewCount: 0, likeCount: 0, commentCount: 0, estimatedRevenue: 0 });
    return { ...sums, estimatedRevenue: sums.estimatedRevenue.toFixed(2), completeness, includedPublicationCount: measured.length, missingPublicationCount };
}

/** 게시물 변경 뒤 현재·누적 파생 집계를 같은 규칙으로 다시 계산합니다. */
function recalculateContent(content: VideoContent): VideoContent {
    return { ...content, currentPerformance: aggregatePublications(content.publications, 'current'), cumulativePerformance: aggregatePublications(content.publications, 'cumulative') };
}

/** 결과물과 게시물 변경 성공 응답을 현재 Project 상세로 만듭니다. */
function successDetail(workspaceId: number, projectId: number, context: YouTubeContext, message: string): MutationResponse {
    const project = readProject(workspaceId, projectId);
    if (!project || !canViewProject(project, context)) return { success: false, errorCode: 'PROJECT_NOT_FOUND', message: '현재 제작팀에서 확인할 수 있는 프로젝트가 없습니다.', errors: null };
    return { success: true, message, data: toProjectDetailResponse(project, context.workspaceRole) };
}

/** 변경된 DEFAULT 단가의 권한별 확인 응답을 구성합니다. */
function visibleConfirmation(record: ConfirmationRecord, impacts: DefaultRateChangeImpactItem[], context: YouTubeContext): DefaultRateChangeConfirmation {
    return {
        confirmationToken: record.token,
        expiresAt: new Date(record.expiresAt).toISOString(),
        impacts: context.workspaceRole === 'MEMBER'
            ? impacts.map(({ currentRate: _currentRate, nextRate: _nextRate, estimatedRevenueDelta: _estimatedRevenueDelta, ...publicImpact }) => publicImpact)
            : impacts
    };
}

/** 최신 영향 범위에 결합된 단일 사용 확인 토큰을 발급합니다. */
function issueConfirmation(
    kind: ConfirmationKind,
    workspaceId: number,
    videoContentId: number,
    publicationId: number | null,
    requestSignature: string,
    impacts: DefaultRateChangeImpactItem[],
    content: VideoContent,
    context: YouTubeContext
): DefaultRateChangeConfirmation {
    for (const [storedToken, storedRecord] of confirmationRecords) {
        if (storedRecord.expiresAt <= Date.now()) confirmationRecords.delete(storedToken);
    }
    const token = crypto.randomUUID();
    const expiresAt = Date.now() + CONFIRMATION_TTL_MS;
    const affected = new Set(impacts.map(impact => impact.publicationId));
    const publicationVersions = content.publications
        .filter(publication => affected.has(publication.publicationId))
        .map(publication => ({ publicationId: publication.publicationId, version: publication.version }));
    const record: ConfirmationRecord = {
        token,
        kind,
        userId: context.userId,
        workspaceId,
        videoContentId,
        publicationId,
        requestSignature,
        impactSignature: JSON.stringify(impacts),
        publicationVersions,
        expiresAt
    };
    confirmationRecords.set(token, record);
    return visibleConfirmation(record, impacts, context);
}

/** 토큰에 결합된 Publication version 충돌을 확인 토큰 만료보다 먼저 판정합니다. */
function hasPublicationVersionConflict(record: ConfirmationRecord, content: VideoContent): boolean {
    return record.publicationVersions.some(expected => (
        content.publications.find(publication => publication.publicationId === expected.publicationId)?.version !== expected.version
    ));
}

/** 단가 영향 확인이 필요한 변경의 토큰을 검증하거나 최신 토큰을 발급합니다. */
function validateConfirmation(
    token: string | undefined,
    kind: ConfirmationKind,
    workspaceId: number,
    videoContentId: number,
    publicationId: number | null,
    requestSignature: string,
    impacts: DefaultRateChangeImpactItem[],
    content: VideoContent,
    context: YouTubeContext
): { valid: true } | { valid: false; response: MutationResponse } {
    const record = token ? confirmationRecords.get(token) : undefined;
    if (record && hasPublicationVersionConflict(record, content)) {
        confirmationRecords.delete(record.token);
        return { valid: false, response: { success: false, errorCode: 'YOUTUBE_PUBLICATION_VERSION_CONFLICT', message: '다른 사용자가 동영상을 먼저 변경했습니다. 최신 내용을 다시 불러와 주세요.', errors: null } };
    }
    const valid = record
        && record.kind === kind
        && record.userId === context.userId
        && record.workspaceId === workspaceId
        && record.videoContentId === videoContentId
        && record.publicationId === publicationId
        && record.requestSignature === requestSignature
        && record.impactSignature === JSON.stringify(impacts)
        && record.expiresAt > Date.now();
    if (valid) {
        confirmationRecords.delete(record.token);
        return { valid: true };
    }
    if (record) confirmationRecords.delete(record.token);
    const data = issueConfirmation(kind, workspaceId, videoContentId, publicationId, requestSignature, impacts, content, context);
    return {
        valid: false,
        response: {
            success: false,
            errorCode: 'DEFAULT_REVENUE_RATE_CHANGE_CONFIRMATION_REQUIRED',
            message: token ? '단가 영향이 달라졌습니다. 최신 내용을 다시 확인해 주세요.' : '채널 기본 단가 적용값이 함께 변경됩니다.',
            errors: null,
            data
        }
    };
}

/** 영상 유형과 Channel 조합에 맞는 최신 기본 단가를 반환합니다. */
function defaultRate(workspaceId: number, channelId: number, videoType: ProjectVideoType): string | null {
    const channel = findWorkspaceChannel(workspaceId, channelId);
    if (!channel) return null;
    return videoType === 'LONG' ? channel.longFormRate : channel.shortFormRate;
}

/** VideoContent 영상 유형 변경으로 실제 단가가 달라지는 게시물을 계산합니다. */
function videoTypeRateImpacts(workspaceId: number, content: VideoContent, videoType: ProjectVideoType): DefaultRateChangeImpactItem[] {
    return content.publications.flatMap(publication => {
        if (publication.revenueOption !== 'DEFAULT') return [];
        const nextRate = defaultRate(workspaceId, publication.channelId, videoType);
        if (nextRate === null || comparableRate(nextRate) === comparableRate(publication.appliedRate)) return [];
        const views = publication.performance?.viewCount ?? 0;
        return [{ publicationId: publication.publicationId, channelId: publication.channelId, channelName: publication.channelName, rateWillChange: true as const, currentRate: publication.appliedRate, nextRate, estimatedRevenueDelta: (views * (Number(nextRate) - Number(publication.appliedRate))).toFixed(2) }];
    });
}

/** 결과물과 선택한 최초 YouTube 게시물을 하나의 트랜잭션 경계로 생성합니다. */
export async function createProjectVideoContent(workspaceId: number, projectId: number, request: CreateVideoContentRequest, context: YouTubeContext): Promise<MutationResponse> {
    await new Promise(resolve => setTimeout(resolve, 200));
    const project = readProject(workspaceId, projectId);
    if (!project || project.archivedAt || !canViewProject(project, context) || !canManageProject(project, context)) return { success: false, errorCode: 'VIDEO_CONTENT_FORBIDDEN', message: '콘텐츠를 추가할 권한이 없습니다.', errors: null };
    const title = request.title.trim();
    if (!title || title.length > 150) return { success: false, errorCode: 'INVALID_INPUT_VALUE', message: '콘텐츠 제목은 1자 이상 150자 이하로 입력해 주세요.', errors: [{ field: 'title', value: request.title, reason: '콘텐츠 제목은 1자 이상 150자 이하로 입력해 주세요.' }] };
    if (request.videoType !== 'LONG' && request.videoType !== 'SHORTS') return { success: false, errorCode: 'INVALID_INPUT_VALUE', message: '콘텐츠 유형을 선택해 주세요.', errors: [{ field: 'videoType', value: request.videoType, reason: 'LONG 또는 SHORTS' }] };

    const initialRequest = request.initialPublication?.youtubeVideo.trim() ? request.initialPublication : null;
    const videoId = initialRequest ? normalizeVideoId(initialRequest.youtubeVideo) : null;
    const channelId = initialRequest?.channelId ?? project.channelId;
    const channel = initialRequest ? findWorkspaceChannel(workspaceId, channelId) : null;
    if (initialRequest && !videoId) return { success: false, errorCode: 'INVALID_YOUTUBE_VIDEO', message: '올바른 YouTube 영상 URL 또는 11자리 ID를 입력해 주세요.', errors: [{ field: 'youtubeVideo', value: initialRequest.youtubeVideo, reason: '올바른 YouTube 영상 URL 또는 11자리 ID를 입력해 주세요.' }] };
    if (initialRequest && !channel?.active) return { success: false, errorCode: 'CHANNEL_NOT_FOUND', message: '사용 중인 채널을 선택해 주세요.', errors: [{ field: 'channelId', value: String(channelId), reason: '사용 중인 채널을 선택해 주세요.' }] };
    if (initialRequest?.publishedAt && Number.isNaN(Date.parse(initialRequest.publishedAt))) return { success: false, errorCode: 'INVALID_INPUT_VALUE', message: '실제 게시 일시를 확인해 주세요.', errors: [{ field: 'publishedAt', value: initialRequest.publishedAt, reason: '실제 게시 일시를 확인해 주세요.' }] };
    const duplicate = videoId ? readWorkspaceVideoContents(workspaceId)
        .flatMap(content => content.publications.map(publication => ({ content, publication })))
        .find(item => item.publication.youtubeVideoId === videoId) : undefined;
    if (duplicate) return {
        success: false,
        errorCode: 'DUPLICATE_YOUTUBE_VIDEO',
        message: '이 YouTube 동영상은 이미 등록되어 있습니다.',
        errors: [{ field: 'youtubeVideo', value: initialRequest?.youtubeVideo ?? '', reason: '이 YouTube 동영상은 이미 등록되어 있습니다.' }],
        data: duplicateVideoLocation(workspaceId, duplicate.content, duplicate.publication, context)
    };

    const revenueOption: ProjectRevenueOption = context.workspaceRole === 'MEMBER' ? 'DEFAULT' : initialRequest?.revenueOption ?? 'DEFAULT';
    const customRate = initialRequest && revenueOption === 'CUSTOM' ? normalizeCustomRate(initialRequest.customRevenuePerView) : null;
    if (initialRequest && revenueOption === 'CUSTOM' && customRate === null) return { success: false, errorCode: 'CUSTOM_REVENUE_RATE_REQUIRED', message: '개별 단가는 0 이상의 숫자로 소수점 여섯째 자리까지 입력해 주세요.', errors: [{ field: 'customRevenuePerView', value: initialRequest.customRevenuePerView ?? null, reason: '개별 단가는 0 이상의 숫자로 소수점 여섯째 자리까지 입력해 주세요.' }] };

    const now = new Date().toISOString();
    const publication: YouTubePublication | null = initialRequest && videoId && channel ? {
        publicationId: nextPublicationId++,
        channelId,
        channelName: channel.name,
        youtubeVideoId: videoId,
        youtubeVideoUrl: `https://www.youtube.com/watch?v=${videoId}`,
        lifecycleStatus: 'CURRENT',
        removalReason: null,
        supersededByPublicationId: null,
        revenueOption,
        appliedRate: revenueOption === 'DISABLED' ? '0' : revenueOption === 'CUSTOM' ? customRate as string : defaultRate(workspaceId, channelId, request.videoType) ?? '0',
        publishedAt: initialRequest.publishedAt ?? null,
        createdAt: now,
        version: 0,
        performance: null,
        statusHistory: [{ fromStatus: null, toStatus: 'CURRENT', fromRemovalReason: null, toRemovalReason: null, relatedPublicationId: null, changedByName: context.userName, changedAt: now, reason: '최초 게시' }]
    } : null;
    const publications = publication ? [publication] : [];
    const content: VideoContent = {
        videoContentId: nextVideoContentId++, title, videoType: request.videoType, primaryProjectId: projectId, connectedProjectIds: [projectId], version: 0,
        primaryProjectHistory: [{ fromProjectId: null, toProjectId: projectId, fromProjectName: null, toProjectName: project.title, fromProjectGroupId: null, toProjectGroupId: project.projectGroupId, fromProjectGroupName: null, toProjectGroupName: project.projectGroupName, changedByName: context.userName, changedAt: now, reasonType: 'CONNECTION_CORRECTION', reason: '콘텐츠 생성' }],
        publications, currentPerformance: aggregatePublications(publications, 'current'), cumulativePerformance: aggregatePublications(publications, 'cumulative')
    };
    replaceProject({ ...project, videoContents: [...project.videoContents, content], updatedAt: now });
    return successDetail(workspaceId, projectId, context, publication ? '콘텐츠와 YouTube 동영상을 함께 추가했습니다.' : '콘텐츠를 추가했습니다.');
}

/** 제목·영상 유형과 DEFAULT 단가 스냅샷을 낙관적 잠금으로 함께 변경합니다. */
export async function updateVideoContent(workspaceId: number, projectId: number, videoContentId: number, request: UpdateVideoContentRequest, context: YouTubeContext): Promise<MutationResponse> {
    await new Promise(resolve => setTimeout(resolve, 200));
    const target = findWritableContent(workspaceId, projectId, videoContentId, context);
    if (!target) return { success: false, errorCode: 'VIDEO_CONTENT_FORBIDDEN', message: '콘텐츠를 수정할 권한이 없습니다.', errors: null };
    if (request.expectedVersion !== target.content.version) return { success: false, errorCode: 'VIDEO_CONTENT_VERSION_CONFLICT', message: '다른 사용자가 콘텐츠를 먼저 변경했습니다. 최신 내용을 다시 불러와 주세요.', errors: null };
    const title = request.title.trim();
    if (!title || title.length > 150) return { success: false, errorCode: 'INVALID_INPUT_VALUE', message: '콘텐츠 제목은 1자 이상 150자 이하로 입력해 주세요.', errors: [{ field: 'title', value: request.title, reason: '콘텐츠 제목은 1자 이상 150자 이하로 입력해 주세요.' }] };
    if (request.videoType !== 'LONG' && request.videoType !== 'SHORTS') return { success: false, errorCode: 'INVALID_INPUT_VALUE', message: '콘텐츠 유형을 선택해 주세요.', errors: null };
    const impacts = request.videoType === target.content.videoType
        ? []
        : videoTypeRateImpacts(workspaceId, target.content, request.videoType);
    if (impacts.length > 0) {
        const checked = validateConfirmation(request.defaultRateChangeConfirmationToken, 'VIDEO_TYPE', workspaceId, videoContentId, null, JSON.stringify({ title, videoType: request.videoType }), impacts, target.content, context);
        if (!checked.valid) return checked.response;
    }
    const impactMap = new Map(impacts.map(impact => [impact.publicationId, impact.nextRate as string]));
    const publications = target.content.publications.map(publication => {
        const nextRate = impactMap.get(publication.publicationId);
        return nextRate === undefined ? publication : { ...publication, appliedRate: nextRate, version: publication.version + 1 };
    });
    const changed = title !== target.content.title || request.videoType !== target.content.videoType || impacts.length > 0;
    if (!changed) return successDetail(workspaceId, projectId, context, '변경된 내용이 없습니다.');
    replaceVideoContent(videoContentId, recalculateContent({ ...target.content, title, videoType: request.videoType, publications, version: target.content.version + 1 }));
    return successDetail(workspaceId, projectId, context, '콘텐츠를 수정했습니다.');
}

/** 게시·공유 이력이 없는 결과물만 최신 version을 확인한 뒤 완전히 삭제합니다. */
export async function deleteProjectVideoContent(workspaceId: number, projectId: number, videoContentId: number, expectedVersion: number, context: YouTubeContext): Promise<MutationResponse> {
    await new Promise(resolve => setTimeout(resolve, 200));
    const target = findWritableContent(workspaceId, projectId, videoContentId, context);
    if (!target) return { success: false, errorCode: 'VIDEO_CONTENT_FORBIDDEN', message: '콘텐츠를 삭제할 권한이 없습니다.', errors: null };
    if (expectedVersion !== target.content.version) return { success: false, errorCode: 'VIDEO_CONTENT_VERSION_CONFLICT', message: '다른 사용자가 콘텐츠를 먼저 변경했습니다. 최신 내용을 다시 불러와 주세요.', errors: null };
    if (target.content.publications.length > 0) return { success: false, errorCode: 'VIDEO_CONTENT_HAS_PUBLICATIONS', message: 'YouTube 동영상이 연결된 콘텐츠는 삭제할 수 없습니다. 동영상 이력을 보존해 주세요.', errors: null };
    if (target.content.connectedProjectIds.length > 1) return { success: false, errorCode: 'VIDEO_CONTENT_MULTIPLE_PROJECTS', message: '여러 프로젝트에 연결된 콘텐츠입니다. 다른 프로젝트 연결을 먼저 해제해 주세요.', errors: null };
    deleteVideoContent(videoContentId);
    return successDetail(workspaceId, projectId, context, '콘텐츠를 삭제했습니다.');
}

/** 연결 현황과 현재 사용자가 연결할 수 있는 Project 후보를 반환합니다. */
export async function getVideoContentProjectCandidates(
    workspaceId: number,
    projectId: number,
    videoContentId: number,
    { keyword = '', page = 1, size = 20 }: { keyword?: string; page?: number; size?: number },
    context: YouTubeContext
): Promise<ApiResponse<{
    connectedProjects: VideoContentProjectCandidate[];
    items: VideoContentProjectCandidate[];
    page: number;
    pageSize: number;
    totalCount: number;
    totalPages: number;
}>> {
    await new Promise(resolve => setTimeout(resolve, 120));
    const readable = findReadableContent(workspaceId, projectId, videoContentId, context);
    const target = readable?.project.archivedAt ? readable : findManageableContent(workspaceId, projectId, videoContentId, context);
    if (!target) return { success: false, errorCode: 'VIDEO_CONTENT_FORBIDDEN', message: '연결을 관리할 권한이 없습니다.', errors: null };
    const normalizedKeyword = keyword.trim().toLowerCase();
    const connectedProjects: VideoContentProjectCandidate[] = [];
    const candidates: VideoContentProjectCandidate[] = [];
    for (const project of readProjects()) {
        if (project.workspaceId !== workspaceId || !canViewProject(project, context)) continue;
        const connected = target.content.connectedProjectIds.includes(project.projectId);
        const canManage = target.project.archivedAt === null && project.archivedAt === null && canManageProject(project, context);
        const item = {
            projectId: project.projectId, title: project.title, projectGroupId: project.projectGroupId,
            projectGroupName: project.projectGroupName, archived: project.archivedAt !== null, connected,
            primary: target.content.primaryProjectId === project.projectId, canManage
        };
        if (connected) connectedProjects.push(item);
        else if (canManage && project.title.toLowerCase().includes(normalizedKeyword)) candidates.push(item);
    }
    const pageSize = Number.isInteger(size) && size > 0 ? Math.min(size, 100) : 20;
    const totalCount = candidates.length;
    const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
    const currentPage = Number.isInteger(page) ? Math.min(Math.max(1, page), totalPages) : 1;
    const start = (currentPage - 1) * pageSize;
    return { success: true, data: { connectedProjects, items: candidates.slice(start, start + pageSize), page: currentPage, pageSize, totalCount, totalPages } };
}

/** 관리 가능한 활성 Project를 공유 VideoContent에 연결합니다. */
export async function connectVideoContentProject(workspaceId: number, anchorProjectId: number, videoContentId: number, targetProjectId: number, expectedVersion: number, context: YouTubeContext): Promise<MutationResponse> {
    const target = findWritableContent(workspaceId, anchorProjectId, videoContentId, context);
    const project = readProject(workspaceId, targetProjectId);
    if (!target || !project || project.archivedAt || !canManageProject(project, context)) return { success: false, errorCode: 'VIDEO_CONTENT_PROJECT_FORBIDDEN', message: '연결할 수 있는 활성 프로젝트를 선택해 주세요.', errors: null };
    if (expectedVersion !== target.content.version) return { success: false, errorCode: 'VIDEO_CONTENT_VERSION_CONFLICT', message: '다른 사용자가 콘텐츠를 먼저 변경했습니다. 최신 내용을 다시 불러와 주세요.', errors: null };
    if (target.content.connectedProjectIds.includes(targetProjectId)) return successDetail(workspaceId, anchorProjectId, context, '이미 연결된 프로젝트입니다.');
    const next = { ...target.content, connectedProjectIds: [...target.content.connectedProjectIds, targetProjectId], version: target.content.version + 1 };
    replaceVideoContent(videoContentId, next);
    linkVideoContentToProject(targetProjectId, next);
    return successDetail(workspaceId, anchorProjectId, context, '프로젝트를 연결했습니다.');
}

/** 대표·마지막 연결을 보호하면서 Project 연결을 해제합니다. */
export async function disconnectVideoContentProject(workspaceId: number, anchorProjectId: number, videoContentId: number, targetProjectId: number, expectedVersion: number, context: YouTubeContext): Promise<MutationResponse> {
    const target = findWritableContent(workspaceId, anchorProjectId, videoContentId, context);
    const project = readProject(workspaceId, targetProjectId);
    if (!target || !project || project.archivedAt || !canManageProject(project, context)) return { success: false, errorCode: 'ARCHIVED_PROJECT_VIDEO_CONTENT_CHANGE_FORBIDDEN', message: '보관 프로젝트는 복원한 뒤 연결을 해제할 수 있습니다.', errors: null };
    if (expectedVersion !== target.content.version) return { success: false, errorCode: 'VIDEO_CONTENT_VERSION_CONFLICT', message: '다른 사용자가 콘텐츠를 먼저 변경했습니다. 최신 내용을 다시 불러와 주세요.', errors: null };
    if (!target.content.connectedProjectIds.includes(targetProjectId)) return { success: false, errorCode: 'PROJECT_NOT_LINKED_TO_VIDEO_CONTENT', message: '연결된 프로젝트만 해제할 수 있습니다.', errors: null };
    if (target.content.primaryProjectId === targetProjectId) return { success: false, errorCode: 'PRIMARY_PROJECT_UNLINK_FORBIDDEN', message: '성과 집계 프로젝트는 다른 프로젝트로 변경한 뒤 연결을 해제할 수 있습니다.', errors: null };
    if (target.content.connectedProjectIds.length <= 1) return { success: false, errorCode: 'LAST_VIDEO_CONTENT_PROJECT', message: '마지막 프로젝트 연결은 해제할 수 없습니다.', errors: null };
    const next = { ...target.content, connectedProjectIds: target.content.connectedProjectIds.filter(id => id !== targetProjectId), version: target.content.version + 1 };
    replaceVideoContent(videoContentId, next);
    unlinkVideoContentFromProject(targetProjectId, videoContentId);
    return successDetail(workspaceId, anchorProjectId, context, '프로젝트 연결을 해제했습니다.');
}

/** 연결된 Project 사이에서 권한·그룹 경계·사유를 검증해 콘텐츠 성과 집계 대상을 변경합니다. */
export async function changeVideoContentPrimaryProject(workspaceId: number, projectId: number, videoContentId: number, request: ChangePrimaryProjectRequest, context: YouTubeContext): Promise<MutationResponse> {
    await new Promise(resolve => setTimeout(resolve, 180));
    const target = findWritableContent(workspaceId, projectId, videoContentId, context);
    const oldPrimary = target ? readProject(workspaceId, target.content.primaryProjectId) : null;
    const newPrimary = target ? readProject(workspaceId, request.newPrimaryProjectId) : null;
    if (!target || !oldPrimary || !newPrimary || newPrimary.archivedAt || !target.content.connectedProjectIds.includes(request.newPrimaryProjectId)) return { success: false, errorCode: 'PROJECT_NOT_LINKED_TO_VIDEO_CONTENT', message: '연결된 활성 프로젝트만 성과 집계 대상으로 지정할 수 있습니다.', errors: null };
    if (request.expectedVersion !== target.content.version) return { success: false, errorCode: 'VIDEO_CONTENT_VERSION_CONFLICT', message: '다른 사용자가 콘텐츠를 먼저 변경했습니다. 최신 내용을 다시 불러와 주세요.', errors: null };
    if (!PRIMARY_REASON_TYPES.has(request.changeReasonType)) return { success: false, errorCode: 'INVALID_INPUT_VALUE', message: '변경 사유를 선택해 주세요.', errors: [{ field: 'changeReasonType', value: request.changeReasonType, reason: '허용된 사유 필요' }] };
    const reason = request.changeReason?.trim() || null;
    if (reason && reason.length > 255) return { success: false, errorCode: 'INVALID_INPUT_VALUE', message: '사유 메모는 255자 이하로 입력해 주세요.', errors: [{ field: 'changeReason', value: reason, reason: '255자 이하' }] };
    const crossesGroupBoundary = oldPrimary.projectGroupId !== newPrimary.projectGroupId;
    if (crossesGroupBoundary && context.workspaceRole === 'MEMBER') return { success: false, errorCode: 'PRIMARY_PROJECT_GROUP_PERMISSION_REQUIRED', message: '프로젝트 그룹 경계를 넘는 변경은 제작팀 소유자 또는 관리자만 할 수 있습니다.', errors: null };
    if (!crossesGroupBoundary && (!canManageProject(oldPrimary, context) || !canManageProject(newPrimary, context))) return { success: false, errorCode: 'PRIMARY_PROJECT_EDIT_FORBIDDEN', message: '현재와 새 성과 집계 프로젝트를 모두 관리할 수 있어야 합니다.', errors: null };
    if (crossesGroupBoundary && target.content.cumulativePerformance.includedPublicationCount > 0 && !request.confirmContentPerformanceMove) return { success: false, errorCode: 'CONTENT_PERFORMANCE_MOVE_CONFIRMATION_REQUIRED', message: '성과 집계 프로젝트를 바꾸면 콘텐츠 성과가 새 프로젝트 그룹으로 이동합니다. 실제 비용·수익은 이동하지 않습니다.', errors: null };
    const now = new Date().toISOString();
    replaceVideoContent(videoContentId, { ...target.content, primaryProjectId: request.newPrimaryProjectId, version: target.content.version + 1, primaryProjectHistory: [...target.content.primaryProjectHistory, { fromProjectId: oldPrimary.projectId, toProjectId: newPrimary.projectId, fromProjectName: oldPrimary.title, toProjectName: newPrimary.title, fromProjectGroupId: oldPrimary.projectGroupId, toProjectGroupId: newPrimary.projectGroupId, fromProjectGroupName: oldPrimary.projectGroupName, toProjectGroupName: newPrimary.projectGroupName, changedByName: context.userName, changedAt: now, reasonType: request.changeReasonType, reason }] });
    return successDetail(workspaceId, projectId, context, '성과 집계 프로젝트를 변경했습니다.');
}

/** 동일 Workspace 중복과 Channel별 단일 CURRENT 규칙을 확인해 게시 이력을 추가합니다. */
export async function createYouTubePublication(workspaceId: number, projectId: number, videoContentId: number, request: CreatePublicationRequest, context: YouTubeContext): Promise<MutationResponse> {
    await new Promise(resolve => setTimeout(resolve, 200));
    const target = findWritableContent(workspaceId, projectId, videoContentId, context);
    const videoId = normalizeVideoId(request.youtubeVideo);
    const primaryProject = target ? readProject(workspaceId, target.content.primaryProjectId) : null;
    const channelId = request.channelId ?? primaryProject?.channelId ?? 0;
    const channel = findWorkspaceChannel(workspaceId, channelId);
    if (!target) return { success: false, errorCode: 'VIDEO_CONTENT_FORBIDDEN', message: 'YouTube 동영상을 추가할 권한이 없습니다.', errors: null };
    if (!videoId) return { success: false, errorCode: 'INVALID_YOUTUBE_VIDEO', message: '올바른 YouTube 영상 URL 또는 11자리 ID를 입력해 주세요.', errors: [{ field: 'youtubeVideo', value: request.youtubeVideo, reason: '허용된 YouTube URL 또는 11자리 ID' }] };
    if (!channel?.active) return { success: false, errorCode: 'CHANNEL_NOT_FOUND', message: '사용 중인 채널을 선택해 주세요.', errors: [{ field: 'channelId', value: String(channelId), reason: '활성 Channel 필요' }] };
    if (request.publishedAt && Number.isNaN(Date.parse(request.publishedAt))) return { success: false, errorCode: 'INVALID_INPUT_VALUE', message: '실제 게시 일시를 확인해 주세요.', errors: [{ field: 'publishedAt', value: request.publishedAt, reason: '올바른 날짜·시각' }] };
    const duplicate = readWorkspaceVideoContents(workspaceId)
        .flatMap(content => content.publications.map(publication => ({ content, publication })))
        .find(item => item.publication.youtubeVideoId === videoId);
    if (duplicate) return {
        success: false,
        errorCode: 'DUPLICATE_YOUTUBE_VIDEO',
        message: '이 YouTube 동영상은 이미 등록되어 있습니다.',
        errors: [{ field: 'youtubeVideo', value: request.youtubeVideo, reason: '이 YouTube 동영상은 이미 등록되어 있습니다.' }],
        data: duplicateVideoLocation(workspaceId, duplicate.content, duplicate.publication, context)
    };
    const current = target.content.publications.find(publication => publication.channelId === channelId && publication.lifecycleStatus === 'CURRENT');
    if (request.supersedesPublicationId != null && request.supersedesPublicationId !== current?.publicationId) return { success: false, errorCode: 'INVALID_PUBLICATION_REPLACEMENT', message: '대체할 게시 중 영상을 다시 확인해 주세요.', errors: null };
    if (current && request.supersedesPublicationId == null) return { success: false, errorCode: 'CURRENT_PUBLICATION_EXISTS', message: `${channel.name}에는 게시 중인 동영상이 있습니다. 기존 동영상을 대체할지 확인해 주세요.`, errors: null };
    if (current && request.supersedesPublicationVersion !== current.version) return { success: false, errorCode: 'YOUTUBE_PUBLICATION_VERSION_CONFLICT', message: '다른 사용자가 대체할 동영상을 먼저 변경했습니다. 최신 내용을 다시 불러와 주세요.', errors: null };
    const revenueOption: ProjectRevenueOption = context.workspaceRole === 'MEMBER' ? 'DEFAULT' : request.revenueOption ?? 'DEFAULT';
    const customRate = revenueOption === 'CUSTOM' ? normalizeCustomRate(request.customRevenuePerView) : null;
    if (revenueOption === 'CUSTOM' && customRate === null) return { success: false, errorCode: 'CUSTOM_REVENUE_RATE_REQUIRED', message: '개별 단가는 0 이상의 숫자로 소수점 여섯째 자리까지 입력해 주세요.', errors: [{ field: 'customRevenuePerView', value: request.customRevenuePerView ?? null, reason: '0 이상, 소수점 6자리 이하' }] };
    const appliedRate = revenueOption === 'DEFAULT' ? (defaultRate(workspaceId, channelId, target.content.videoType) ?? '0') : revenueOption === 'CUSTOM' ? customRate as string : '0';
    const now = new Date().toISOString();
    const publicationId = nextPublicationId++;
    const publication: YouTubePublication = { publicationId, channelId, channelName: channel.name, youtubeVideoId: videoId, youtubeVideoUrl: `https://www.youtube.com/watch?v=${videoId}`, lifecycleStatus: 'CURRENT', removalReason: null, supersededByPublicationId: null, revenueOption, appliedRate, publishedAt: request.publishedAt ?? null, createdAt: now, version: 0, performance: null, statusHistory: [{ fromStatus: null, toStatus: 'CURRENT', fromRemovalReason: null, toRemovalReason: null, relatedPublicationId: current?.publicationId ?? null, changedByName: context.userName, changedAt: now, reason: current ? '기존 동영상 대체' : '최초 게시' }] };
    const publications = target.content.publications.map(item => item.publicationId !== current?.publicationId ? item : ({ ...item, lifecycleStatus: 'SUPERSEDED' as const, removalReason: null, supersededByPublicationId: publicationId, version: item.version + 1, statusHistory: [...item.statusHistory, { fromStatus: 'CURRENT' as const, toStatus: 'SUPERSEDED' as const, fromRemovalReason: null, toRemovalReason: null, relatedPublicationId: publicationId, changedByName: context.userName, changedAt: now, reason: '새 동영상으로 대체' }] }));
    replaceVideoContent(videoContentId, recalculateContent({ ...target.content, publications: [...publications, publication] }));
    return successDetail(workspaceId, projectId, context, current ? '새 YouTube 동영상을 추가하고 기존 동영상을 대체했습니다.' : 'YouTube 동영상을 추가했습니다.');
}

/** 실제 게시 Channel·일시와 DEFAULT 단가 영향을 원자적으로 변경합니다. */
export async function updateYouTubePublication(workspaceId: number, projectId: number, videoContentId: number, publicationId: number, request: UpdatePublicationRequest, context: YouTubeContext): Promise<MutationResponse> {
    await new Promise(resolve => setTimeout(resolve, 180));
    const target = findWritableContent(workspaceId, projectId, videoContentId, context);
    const publication = target?.content.publications.find(item => item.publicationId === publicationId);
    const channel = findWorkspaceChannel(workspaceId, request.channelId);
    if (!target || !publication) return { success: false, errorCode: 'PUBLICATION_NOT_FOUND', message: 'YouTube 동영상을 찾을 수 없습니다.', errors: null };
    if (request.expectedVersion !== publication.version) return { success: false, errorCode: 'YOUTUBE_PUBLICATION_VERSION_CONFLICT', message: '다른 사용자가 동영상을 먼저 변경했습니다. 최신 내용을 다시 불러와 주세요.', errors: null };
    if (!channel?.active) return { success: false, errorCode: 'CHANNEL_NOT_FOUND', message: '사용 중인 채널을 선택해 주세요.', errors: null };
    if (request.publishedAt && Number.isNaN(Date.parse(request.publishedAt))) return { success: false, errorCode: 'INVALID_INPUT_VALUE', message: '실제 게시 일시를 확인해 주세요.', errors: [{ field: 'publishedAt', value: request.publishedAt, reason: '올바른 날짜·시각' }] };
    const channelChanged = publication.channelId !== request.channelId;
    if (channelChanged && publication.lifecycleStatus !== 'CURRENT') return { success: false, errorCode: 'PUBLICATION_NOT_CURRENT', message: '게시 중인 동영상만 Channel을 변경할 수 있습니다.', errors: null };
    const replaced = channelChanged ? target.content.publications.find(item => item.publicationId !== publicationId && item.channelId === request.channelId && item.lifecycleStatus === 'CURRENT') : undefined;
    if (request.replaceCurrentPublicationId != null && request.replaceCurrentPublicationId !== replaced?.publicationId) return { success: false, errorCode: 'YOUTUBE_PUBLICATION_VERSION_CONFLICT', message: '대체 대상 동영상이 변경되었습니다. 최신 내용을 다시 확인해 주세요.', errors: null };
    if (replaced && request.replaceCurrentPublicationId !== replaced.publicationId) return { success: false, errorCode: 'CURRENT_PUBLICATION_EXISTS', message: `${channel.name}의 게시 중 영상을 대체할지 확인해 주세요.`, errors: null };
    if (replaced && request.replaceCurrentPublicationVersion !== replaced.version) return { success: false, errorCode: 'YOUTUBE_PUBLICATION_VERSION_CONFLICT', message: '다른 사용자가 대체할 동영상을 먼저 변경했습니다. 최신 내용을 다시 불러와 주세요.', errors: null };
    const nextRate = publication.revenueOption === 'DEFAULT' && channelChanged ? defaultRate(workspaceId, request.channelId, target.content.videoType) ?? '0' : publication.appliedRate;
    const rateChanged = comparableRate(nextRate) !== comparableRate(publication.appliedRate);
    const impacts: DefaultRateChangeImpactItem[] = rateChanged ? [{ publicationId, channelId: channel.channelId, channelName: channel.name, rateWillChange: true, currentRate: publication.appliedRate, nextRate, estimatedRevenueDelta: ((publication.performance?.viewCount ?? 0) * (Number(nextRate) - Number(publication.appliedRate))).toFixed(2) }] : [];
    if (impacts.length > 0) {
        const checked = validateConfirmation(request.defaultRateChangeConfirmationToken, 'PUBLICATION_CHANNEL', workspaceId, videoContentId, publicationId, JSON.stringify({ channelId: request.channelId, publishedAt: request.publishedAt, replaceCurrentPublicationId: request.replaceCurrentPublicationId ?? null }), impacts, target.content, context);
        if (!checked.valid) return checked.response;
    }
    const now = new Date().toISOString();
    const publications = target.content.publications.map(item => {
        if (item.publicationId === replaced?.publicationId) return { ...item, lifecycleStatus: 'SUPERSEDED' as const, removalReason: null, supersededByPublicationId: publicationId, version: item.version + 1, statusHistory: [...item.statusHistory, { fromStatus: 'CURRENT' as const, toStatus: 'SUPERSEDED' as const, fromRemovalReason: null, toRemovalReason: null, relatedPublicationId: publicationId, changedByName: context.userName, changedAt: now, reason: '게시 Channel 이동으로 대체' }] };
        if (item.publicationId === publicationId) return { ...item, channelId: channel.channelId, channelName: channel.name, publishedAt: request.publishedAt, appliedRate: nextRate, version: item.version + 1 };
        return item;
    });
    replaceVideoContent(videoContentId, recalculateContent({ ...target.content, publications }));
    return successDetail(workspaceId, projectId, context, '동영상 정보를 수정했습니다.');
}

/** OWNER·ADMIN이 게시물의 예상 수익 방식을 명시적으로 변경합니다. */
export async function updateYouTubePublicationRevenue(workspaceId: number, projectId: number, videoContentId: number, publicationId: number, request: UpdatePublicationRevenueRequest, context: YouTubeContext): Promise<MutationResponse> {
    const target = findWritableContent(workspaceId, projectId, videoContentId, context);
    const publication = target?.content.publications.find(item => item.publicationId === publicationId);
    if (context.workspaceRole === 'MEMBER') return { success: false, errorCode: 'PUBLICATION_REVENUE_FORBIDDEN', message: '예상 수익 설정은 제작팀 소유자 또는 관리자만 변경할 수 있습니다.', errors: null };
    if (!target || !publication) return { success: false, errorCode: 'PUBLICATION_NOT_FOUND', message: 'YouTube 동영상을 찾을 수 없습니다.', errors: null };
    if (request.expectedVersion !== publication.version) return { success: false, errorCode: 'YOUTUBE_PUBLICATION_VERSION_CONFLICT', message: '다른 사용자가 동영상을 먼저 변경했습니다. 최신 내용을 다시 불러와 주세요.', errors: null };
    if (publication.lifecycleStatus === 'REMOVED' && publication.removalReason === 'INCORRECT') return { success: false, errorCode: 'PUBLICATION_REVENUE_FORBIDDEN', message: '잘못 연결한 동영상은 예상 수익을 설정할 수 없습니다.', errors: null };
    if (!['DEFAULT', 'CUSTOM', 'DISABLED'].includes(request.revenueOption)) return { success: false, errorCode: 'INVALID_INPUT_VALUE', message: '예상 수익 방식을 선택해 주세요.', errors: [{ field: 'revenueOption', value: request.revenueOption, reason: '허용된 방식 필요' }] };
    const customRate = request.revenueOption === 'CUSTOM' ? normalizeCustomRate(request.customRevenuePerView) : null;
    if (request.revenueOption === 'CUSTOM' && customRate === null) return { success: false, errorCode: 'CUSTOM_REVENUE_RATE_REQUIRED', message: '개별 단가는 0 이상의 숫자로 소수점 여섯째 자리까지 입력해 주세요.', errors: [{ field: 'customRevenuePerView', value: request.customRevenuePerView ?? null, reason: '0 이상, 소수점 6자리 이하' }] };
    const appliedRate = request.revenueOption === 'DEFAULT' ? defaultRate(workspaceId, publication.channelId, target.content.videoType) ?? '0' : request.revenueOption === 'CUSTOM' ? customRate as string : '0';
    const publications = target.content.publications.map(item => item.publicationId === publicationId ? { ...item, revenueOption: request.revenueOption, appliedRate, version: item.version + 1 } : item);
    replaceVideoContent(videoContentId, recalculateContent({ ...target.content, publications }));
    return successDetail(workspaceId, projectId, context, '예상 수익 설정을 변경했습니다.');
}

/** 선택한 게시물만 Mock 동기화하며 version과 생명주기는 변경하지 않습니다. */
export async function syncYouTubePublication(workspaceId: number, projectId: number, videoContentId: number, publicationId: number, context: YouTubeContext): Promise<MutationResponse> {
    await new Promise(resolve => setTimeout(resolve, 250));
    const target = findWritableContent(workspaceId, projectId, videoContentId, context);
    const publication = target?.content.publications.find(item => item.publicationId === publicationId);
    if (!target || !publication) return { success: false, errorCode: 'PUBLICATION_NOT_FOUND', message: '동기화할 YouTube 동영상을 찾을 수 없습니다.', errors: null };
    if (publication.lifecycleStatus !== 'CURRENT') return { success: false, errorCode: 'PUBLICATION_NOT_CURRENT', message: '게시 중인 동영상만 성과를 동기화할 수 있습니다.', errors: null };
    const now = new Date().toISOString();
    const previous = publication.performance;
    const performance = { viewCount: (previous?.viewCount ?? 0) + 1379, likeCount: (previous?.likeCount ?? 0) + 83, commentCount: (previous?.commentCount ?? 0) + 7, syncStatus: 'SUCCESS' as const, lastAttemptedAt: now, lastSuccessAt: now, lastErrorMessage: null };
    replaceVideoContent(videoContentId, recalculateContent({ ...target.content, publications: target.content.publications.map(item => item.publicationId === publicationId ? { ...item, performance } : item) }));
    return successDetail(workspaceId, projectId, context, '동영상 성과를 동기화했습니다.');
}

/** 사용자 확인에 따라 게시물을 종료하고 version과 생명주기 이력을 갱신합니다. */
export async function removeYouTubePublication(workspaceId: number, projectId: number, videoContentId: number, publicationId: number, removalReason: YouTubeRemovalReason, expectedVersion: number, context: YouTubeContext): Promise<MutationResponse> {
    const target = findWritableContent(workspaceId, projectId, videoContentId, context);
    const publication = target?.content.publications.find(item => item.publicationId === publicationId);
    if (!target || !publication) return { success: false, errorCode: 'PUBLICATION_NOT_FOUND', message: 'YouTube 동영상을 찾을 수 없습니다.', errors: null };
    if (expectedVersion !== publication.version) return { success: false, errorCode: 'YOUTUBE_PUBLICATION_VERSION_CONFLICT', message: '다른 사용자가 동영상을 먼저 변경했습니다. 최신 내용을 다시 불러와 주세요.', errors: null };
    if (removalReason !== 'UNAVAILABLE' && removalReason !== 'INCORRECT') return { success: false, errorCode: 'INVALID_REMOVAL_REASON', message: '올바른 게시 종료 사유를 선택해 주세요.', errors: null };
    if (publication.lifecycleStatus === 'REMOVED' && publication.removalReason === removalReason) return successDetail(workspaceId, projectId, context, '이미 같은 사유로 게시 종료되었습니다.');
    const now = new Date().toISOString();
    const publications = target.content.publications.map(item => item.publicationId !== publicationId ? item : ({ ...item, lifecycleStatus: 'REMOVED' as const, removalReason, supersededByPublicationId: null, version: item.version + 1, statusHistory: [...item.statusHistory, { fromStatus: item.lifecycleStatus, toStatus: 'REMOVED' as const, fromRemovalReason: item.removalReason, toRemovalReason: removalReason, relatedPublicationId: null, changedByName: context.userName, changedAt: now, reason: removalReason === 'INCORRECT' ? '잘못 연결한 동영상' : '게시 운영 종료' }] }));
    replaceVideoContent(videoContentId, recalculateContent({ ...target.content, publications }));
    return successDetail(workspaceId, projectId, context, '동영상을 게시 종료 상태로 변경했습니다.');
}

/** 종료·대체 게시물을 CURRENT로 복원하고 같은 Channel의 기존 CURRENT를 명시적으로 대체합니다. */
export async function restoreYouTubePublication(workspaceId: number, projectId: number, videoContentId: number, publicationId: number, expectedVersion: number, replaceCurrentPublicationId: number | null, replaceCurrentPublicationVersion: number | null, context: YouTubeContext): Promise<MutationResponse> {
    const target = findWritableContent(workspaceId, projectId, videoContentId, context);
    const publication = target?.content.publications.find(item => item.publicationId === publicationId);
    if (!target || !publication) return { success: false, errorCode: 'PUBLICATION_NOT_FOUND', message: '복원할 YouTube 동영상을 찾을 수 없습니다.', errors: null };
    if (expectedVersion !== publication.version) return { success: false, errorCode: 'YOUTUBE_PUBLICATION_VERSION_CONFLICT', message: '다른 사용자가 동영상을 먼저 변경했습니다. 최신 내용을 다시 불러와 주세요.', errors: null };
    if (publication.lifecycleStatus === 'CURRENT') return { success: false, errorCode: 'PUBLICATION_ALREADY_CURRENT', message: '이미 게시 중인 동영상입니다.', errors: null };
    const current = target.content.publications.find(item => item.channelId === publication.channelId && item.lifecycleStatus === 'CURRENT' && item.publicationId !== publicationId);
    if (replaceCurrentPublicationId !== null && replaceCurrentPublicationId !== current?.publicationId) return { success: false, errorCode: 'YOUTUBE_PUBLICATION_VERSION_CONFLICT', message: '대체 대상 동영상이 변경되었습니다. 최신 내용을 다시 확인해 주세요.', errors: null };
    if (current && current.publicationId !== replaceCurrentPublicationId) return { success: false, errorCode: 'CURRENT_PUBLICATION_EXISTS', message: '같은 채널의 게시 중 영상을 대체할지 확인해 주세요.', errors: null };
    if (current && current.version !== replaceCurrentPublicationVersion) return { success: false, errorCode: 'YOUTUBE_PUBLICATION_VERSION_CONFLICT', message: '다른 사용자가 대체할 동영상을 먼저 변경했습니다. 최신 내용을 다시 불러와 주세요.', errors: null };
    const now = new Date().toISOString();
    const publications = target.content.publications.map(item => {
        if (item.publicationId === current?.publicationId) return { ...item, lifecycleStatus: 'SUPERSEDED' as const, removalReason: null, supersededByPublicationId: publicationId, version: item.version + 1, statusHistory: [...item.statusHistory, { fromStatus: 'CURRENT' as const, toStatus: 'SUPERSEDED' as const, fromRemovalReason: null, toRemovalReason: null, relatedPublicationId: publicationId, changedByName: context.userName, changedAt: now, reason: '과거 동영상 복원으로 대체' }] };
        if (item.publicationId === publicationId) return { ...item, lifecycleStatus: 'CURRENT' as const, removalReason: null, supersededByPublicationId: null, version: item.version + 1, statusHistory: [...item.statusHistory, { fromStatus: item.lifecycleStatus, toStatus: 'CURRENT' as const, fromRemovalReason: item.removalReason, toRemovalReason: null, relatedPublicationId: current?.publicationId ?? null, changedByName: context.userName, changedAt: now, reason: '동영상 복원' }] };
        return item;
    });
    replaceVideoContent(videoContentId, recalculateContent({ ...target.content, publications }));
    return successDetail(workspaceId, projectId, context, '동영상을 다시 게시 중 상태로 복원했습니다.');
}
