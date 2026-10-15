import type { UserRole } from './types/auth';

// 프로필, 멤버 관리와 일정 필터에서 같은 전문 역할 표시명을 공유합니다.
export const PROFESSIONAL_ROLE_OPTIONS: ReadonlyArray<{
    value: UserRole;
    label: string;
}> = [
    { value: 'CREATOR', label: '크리에이터' },
    { value: 'PLANNER', label: '콘텐츠 기획자' },
    { value: 'WRITER', label: '작가' },
    { value: 'VIDEOGRAPHER', label: '촬영 담당' },
    { value: 'EDITOR', label: '영상 편집자' },
    { value: 'THUMBNAILER', label: '썸네일 디자이너' }
];

export const PROFESSIONAL_ROLE_LABELS = Object.fromEntries(
    PROFESSIONAL_ROLE_OPTIONS.map(role => [role.value, role.label])
) as Record<UserRole, string>;
