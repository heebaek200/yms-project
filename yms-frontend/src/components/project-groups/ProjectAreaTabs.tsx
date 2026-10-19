import { NavLink } from 'react-router';

import { useWorkspace } from '../../hooks/useWorkspace';

/** 프로젝트와 ProjectGroup을 같은 상위 메뉴 안의 독립 Route 탭으로 연결합니다. */
function ProjectAreaTabs() {
    const { currentWorkspace } = useWorkspace();
    const canManageProjectGroups = currentWorkspace?.myRole === 'OWNER'
        || currentWorkspace?.myRole === 'ADMIN';

    return (
        <nav className="project-area-tabs" aria-label="프로젝트 메뉴">
            <NavLink
                to="/projects"
                className={({ isActive }) => [
                    'project-area-tab',
                    isActive ? 'project-area-tab--active' : ''
                ].filter(Boolean).join(' ')}
            >
                <span aria-hidden="true">🎬</span>
                프로젝트
            </NavLink>

            {canManageProjectGroups && (
                <NavLink
                    to="/project-groups"
                    className={({ isActive }) => [
                        'project-area-tab',
                        isActive ? 'project-area-tab--active' : ''
                    ].filter(Boolean).join(' ')}
                >
                    <span aria-hidden="true">🗂️</span>
                    프로젝트 그룹
                </NavLink>
            )}
        </nav>
    );
}

export default ProjectAreaTabs;
