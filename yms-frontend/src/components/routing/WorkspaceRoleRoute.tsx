import type { ReactNode } from 'react';

import { useWorkspace } from '../../hooks/useWorkspace';
import type { WorkspaceRole } from '../../types/workspace';
import WorkspaceAccessState from './WorkspaceAccessState';

type WorkspaceRoleRouteProps = {
    allowedRoles: readonly WorkspaceRole[];
    children: ReactNode;
};

/**
 * 현재 제작팀 역할이 화면의 허용 범위에 포함되는지 Route 수준에서 확인합니다.
 * 권한이 없을 때 자동 이동하지 않고 현재 제작팀을 확인할 수 있는 상태를 제공합니다.
 * 서버의 권한 검증을 대체하지 않으며 불필요한 화면과 API 진입을 먼저 차단합니다.
 */
function WorkspaceRoleRoute({
    allowedRoles,
    children
}: WorkspaceRoleRouteProps) {
    const { currentWorkspace } = useWorkspace();

    if (
        !currentWorkspace
        || !allowedRoles.includes(currentWorkspace.myRole)
    ) {
        return <WorkspaceAccessState />;
    }

    return children;
}

export default WorkspaceRoleRoute;
