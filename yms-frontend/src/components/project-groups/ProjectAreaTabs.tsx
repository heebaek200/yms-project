import { NavLink } from 'react-router';

import { useWorkspace } from '../../hooks/useWorkspace';

import './ProjectAreaControls.css';

/** 프로젝트와 ProjectGroup을 같은 상위 메뉴 안의 독립 Route 탭으로 연결합니다. */
function ProjectAreaTabs() {
    const { currentWorkspace } = useWorkspace();
    const canManageProjectGroups = currentWorkspace?.myRole === 'OWNER'
        || currentWorkspace?.myRole === 'ADMIN';

    // 이동 가능한 상위 메뉴가 프로젝트 하나뿐이면 전환 기능이 없는 탭 장식을 표시하지 않습니다.
    if (!canManageProjectGroups) {
        return null;
    }

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
        </nav>
    );
}

export default ProjectAreaTabs;
