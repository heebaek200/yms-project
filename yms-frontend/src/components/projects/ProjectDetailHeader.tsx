import type { ProjectStatus } from '../../types/projectGroup';
import { PROJECT_STATUS_LABELS } from '../../projectStatuses';
import ProjectAreaTabs from '../project-groups/ProjectAreaTabs';
import ResourceNavigationLink from '../common/ResourceNavigationLink';
import ProjectDetailTabs from './ProjectDetailTabs';
import './ProjectDetailHeader.css';

type ProjectDetailHeaderProps = {
    projectId: number;
    title: string;
    channelName: string;
    ownerName: string;
    status: ProjectStatus;
    listSearch?: string;
};

/** 모든 Project 하위 탭에서 목록 복귀·기본 정보·상태·탭을 같은 위치에 표시합니다. */
function ProjectDetailHeader({ projectId, title, channelName, ownerName, status, listSearch }: ProjectDetailHeaderProps) {
    return <>
        <ProjectAreaTabs />
        <div className="project-detail-shell__back">
            <ResourceNavigationLink to={`/projects${listSearch ? `?${listSearch}` : ''}`} label="프로젝트 목록" variant="back" />
        </div>
        <header className="project-detail-shell__header">
            <div>
                <p className="project-detail-shell__eyebrow">PROJECT</p>
                <h1>{title}</h1>
                <p>{channelName} · 소유자 {ownerName}</p>
            </div>
            <span className={`project-status project-status--${status.toLowerCase()}`}>{PROJECT_STATUS_LABELS[status]}</span>
        </header>
        <ProjectDetailTabs projectId={projectId} />
    </>;
}

export default ProjectDetailHeader;
