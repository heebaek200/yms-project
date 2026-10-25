import { NavLink } from 'react-router';

import './ProjectDetailTabs.css';

type ProjectDetailTabsProps = {
    projectId: number;
};

/** 프로젝트의 정보·영상 결과물·참여자 기능을 화면 크기와 무관하게 같은 순서로 제공합니다. */
function ProjectDetailTabs({ projectId }: ProjectDetailTabsProps) {
    const tabs = [
        { to: `/projects/${projectId}`, label: '📋 상세 정보', end: true },
        { to: `/projects/${projectId}/videos`, label: '🎬 영상 결과물', end: false },
        { to: `/projects/${projectId}/members`, label: '👥 참여자 관리', end: false }
    ];

    return (
        <nav className="project-detail-tabs" aria-label="프로젝트 상세 메뉴">
            {tabs.map(tab => (
                <NavLink
                    key={tab.to}
                    to={tab.to}
                    end={tab.end}
                    className={({ isActive }) => isActive ? 'project-detail-tabs__link project-detail-tabs__link--active' : 'project-detail-tabs__link'}
                >
                    {tab.label}
                </NavLink>
            ))}
        </nav>
    );
}

export default ProjectDetailTabs;
