import type { WorkspaceRole } from '../../types/workspace';
import type {
    PerformanceAggregate,
    PerformanceAggregateResponse,
    ProjectAccessRole,
    ProjectDetail,
    ProjectDetailResponse,
    ProjectListItemResponse,
    YouTubePublication,
    YouTubePublicationResponse
} from '../../types/project';

/** Workspace 역할에 따라 예상 수익을 제외한 성과 응답 복사본을 만듭니다. */
export function toPerformanceAggregateResponse(
    aggregate: PerformanceAggregate,
    workspaceRole: WorkspaceRole
): PerformanceAggregateResponse {
    const { estimatedRevenue, ...publicAggregate } = aggregate;
    return workspaceRole === 'MEMBER'
        ? publicAggregate
        : { ...publicAggregate, estimatedRevenue };
}

/** 일반 MEMBER 응답에서 게시물 적용 단가와 수익 계산 방식을 제거합니다. */
function toPublicationResponse(
    publication: YouTubePublication,
    workspaceRole: WorkspaceRole
): YouTubePublicationResponse {
    const { revenueOption, appliedRate, ...publicPublication } = publication;
    return workspaceRole === 'MEMBER'
        ? publicPublication
        : { ...publicPublication, revenueOption, appliedRate };
}

/** 내부 Project 저장 객체를 변경하지 않고 역할별 상세 응답으로 깊은 복사합니다. */
export function toProjectDetailResponse(
    project: ProjectDetail,
    workspaceRole: WorkspaceRole
): ProjectDetailResponse {
    const {
        workerAmount,
        directExpenseAmount,
        directRevenueAmount,
        videoContents,
        ...publicProject
    } = project;
    const responseVideoContents = videoContents.map(content => ({
        ...content,
        publications: content.publications.map(publication => (
            toPublicationResponse(publication, workspaceRole)
        )),
        currentPerformance: toPerformanceAggregateResponse(
            content.currentPerformance,
            workspaceRole
        ),
        cumulativePerformance: toPerformanceAggregateResponse(
            content.cumulativePerformance,
            workspaceRole
        )
    }));

    // 실제 재무 합계도 YouTube 예상 수익과 같은 OWNER·ADMIN 전용 정보로 취급합니다.
    if (workspaceRole === 'MEMBER') {
        return { ...publicProject, videoContents: responseVideoContents };
    }
    return {
        ...publicProject,
        workerAmount,
        directExpenseAmount,
        directRevenueAmount,
        videoContents: responseVideoContents
    };
}

/** 내부 상세 객체를 펼치지 않고 프로젝트 목록에 허용된 필드만 명시적으로 선택합니다. */
export function toProjectListItemResponse(
    project: ProjectDetail,
    access: { isParticipant: boolean; myAccessRole: ProjectAccessRole },
    currentPerformance: PerformanceAggregate,
    workspaceRole: WorkspaceRole
): ProjectListItemResponse {
    return {
        projectId: project.projectId,
        title: project.title,
        content: project.content,
        channelId: project.channelId,
        channelName: project.channelName,
        projectGroupId: project.projectGroupId,
        projectGroupName: project.projectGroupName,
        videoType: project.videoType,
        status: project.status,
        ownerName: project.ownerName,
        dueDate: project.dueDate,
        plannedUploadDate: project.plannedUploadDate,
        archivedAt: project.archivedAt,
        updatedAt: project.updatedAt,
        taskCount: project.taskCount,
        completedTaskCount: project.completedTaskCount,
        isParticipant: access.isParticipant,
        myAccessRole: access.myAccessRole,
        currentPerformance: toPerformanceAggregateResponse(
            currentPerformance,
            workspaceRole
        )
    };
}
