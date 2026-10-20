import ComingSoonPage from './ComingSoonPage';
import ProjectAreaTabs from '../components/project-groups/ProjectAreaTabs';

import './ProjectGroupPage.css';

/** 아직 #17 구현 전인 프로젝트 화면에 확정된 프로젝트 영역 탭 구조를 먼저 제공합니다. */
function ProjectsPage() {
    return (
        <section className="project-area-page">
            <ProjectAreaTabs />
            <ComingSoonPage featureName="프로젝트" />
        </section>
    );
}

export default ProjectsPage;
