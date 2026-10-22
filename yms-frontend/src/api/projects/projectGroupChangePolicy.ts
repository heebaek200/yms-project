import type { ProjectDetail } from '../../types/project';

/** 대표 영상 결과물에 동기화되어 집계 가능한 콘텐츠 성과가 있는지 확인합니다. */
function hasPrimaryContentPerformance(project: ProjectDetail): boolean {
    return project.videoContents.some(videoContent => (
        videoContent.primaryProjectId === project.projectId
        && videoContent.cumulativePerformance.includedPublicationCount > 0
    ));
}

/** ProjectGroup 경계를 바꾸는 대상 중 콘텐츠 성과 이동 확인이 필요한 Project가 있는지 판정합니다. */
export function requiresContentPerformanceMoveConfirmation(
    projects: readonly ProjectDetail[],
    nextProjectGroupId: number | null | 'NEW'
): boolean {
    return projects.some(project => (
        (nextProjectGroupId === 'NEW' || project.projectGroupId !== nextProjectGroupId)
        && hasPrimaryContentPerformance(project)
    ));
}
