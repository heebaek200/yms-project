import type { ProjectStatus } from './types/projectGroup';

/** Project 상태 코드를 목록·상세·하위 탭에서 동일한 사용자 표시명으로 변환합니다. */
export const PROJECT_STATUS_LABELS: Record<ProjectStatus, string> = {
    PLANNING: '준비 중',
    EDITING: '편집 중',
    REVIEW: '검수 중',
    UPLOADED: '업로드 완료',
    CANCELLED: '취소'
};
