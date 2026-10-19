import type { WorkspaceRole } from '../types/workspace';

export const WORKSPACE_ADMIN_ROLES: readonly WorkspaceRole[] = [
    'OWNER',
    'ADMIN'
];

type NavigationSection = 'work' | 'management';

export type AppNavigationItem = {
    key: string;
    label: string;
    icon: string;
    path: string;
    activePaths?: readonly string[];
    section: NavigationSection;
    allowedRoles?: readonly WorkspaceRole[];
};

const COMMON_NAVIGATION_ITEMS: readonly AppNavigationItem[] = [
    {
        key: 'dashboard',
        label: '대시보드',
        icon: '🗓️',
        path: '/dashboard',
        section: 'work'
    },
    {
        key: 'projects',
        label: '프로젝트',
        icon: '🎬',
        path: '/projects',
        activePaths: ['/projects', '/project-groups'],
        section: 'work'
    },
    {
        key: 'messenger',
        label: '메신저',
        icon: '💬',
        path: '/messenger',
        section: 'work'
    }
];

const ADMIN_NAVIGATION_ITEMS: readonly AppNavigationItem[] = [
    {
        key: 'workspace-settlements',
        label: '정산 관리',
        icon: '🧾',
        path: '/workspace/settlements',
        section: 'work',
        allowedRoles: WORKSPACE_ADMIN_ROLES
    },
    {
        key: 'analytics',
        label: '분석',
        icon: '📊',
        path: '/analytics',
        section: 'management',
        allowedRoles: WORKSPACE_ADMIN_ROLES
    },
    {
        key: 'finance',
        label: '비용·수익',
        icon: '💳',
        path: '/finance',
        section: 'management',
        allowedRoles: WORKSPACE_ADMIN_ROLES
    },
    {
        key: 'workspace-settings',
        label: '제작팀 관리',
        icon: '⚙️',
        path: '/workspace/settings',
        section: 'management',
        allowedRoles: WORKSPACE_ADMIN_ROLES
    }
];

const MEMBER_SETTLEMENT_ITEM: AppNavigationItem = {
    key: 'my-settlements',
    label: '내 정산',
    icon: '💰',
    path: '/my/settlements',
    section: 'work',
    allowedRoles: ['MEMBER']
};

const WORKSPACE_LIST_ROUTES = [
    '/workspace/settlements',
    '/workspace/settings',
    '/my/settlements',
    '/project-groups',
    '/projects',
    '/messenger',
    '/analytics',
    '/finance',
    '/dashboard'
] as const;

/**
 * 현재 Workspace 역할에 허용된 Header 메뉴를 확정된 업무 순서로 반환합니다.
 * 정산 슬롯은 관리자에게 정산 관리를, MEMBER에게 내 정산을 제공하여
 * 위치는 공유하되 서로 다른 기능과 Route가 섞이지 않게 합니다.
 */
export function getNavigationItems(
    role: WorkspaceRole
): AppNavigationItem[] {
    const settlementItem = role === 'MEMBER'
        ? MEMBER_SETTLEMENT_ITEM
        : ADMIN_NAVIGATION_ITEMS[0];
    const orderedItems = [
        ...COMMON_NAVIGATION_ITEMS,
        settlementItem,
        ...ADMIN_NAVIGATION_ITEMS.slice(1)
    ];

    // 역할 제한이 없는 메뉴와 현재 역할에 명시적으로 허용된 메뉴만 표시합니다.
    return orderedItems.filter(item => (
        !item.allowedRoles || item.allowedRoles.includes(role)
    ));
}

/**
 * Workspace 전환 전 상세 Route를 새 Workspace에서 사용할 목록 Route로 정규화합니다.
 * 이미 목록 Route에 있다면 같은 경로를 그대로 반환하여 검색 조건을 보존합니다.
 * 권한에 따른 다른 기능 전환은 수행하지 않고 각 Route Guard에 판정을 맡깁니다.
 */
export function getWorkspaceSwitchDestination(pathname: string): string {
    const listRoute = WORKSPACE_LIST_ROUTES.find(route => (
        pathname === route || pathname.startsWith(`${route}/`)
    ));

    if (!listRoute || pathname === listRoute) {
        return pathname;
    }

    return listRoute;
}
