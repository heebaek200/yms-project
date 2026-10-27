import type {
    WorkspaceDepartureImpact,
    WorkspaceOwnedProjectImpact
} from '../../types/workspaceSettings';
import WorkspaceDepartureModal from './WorkspaceDepartureModal';

type ProjectDestination = 'DETAIL' | 'MEMBERS';

type WorkspaceDepartureBlockerProps = {
    workspaceName: string;
    targetName: string;
    impact: WorkspaceDepartureImpact;
    switchesWorkspace: boolean;
    onOpenProject: (
        project: WorkspaceOwnedProjectImpact,
        destination: ProjectDestination
    ) => void;
    onClose: () => void;
};

const STATUS_LABELS = {
    PLANNING: '준비 중',
    EDITING: '편집 중',
    REVIEW: '검토 중',
    UPLOADED: '업로드 완료',
    CANCELLED: '취소'
} as const;

/** 마지막 OWNER 또는 Project 소유권 때문에 이탈할 수 없는 이유와 해결 경로를 표시합니다. */
function WorkspaceDepartureBlocker({
    workspaceName,
    targetName,
    impact,
    switchesWorkspace,
    onOpenProject,
    onClose
}: WorkspaceDepartureBlockerProps) {
    return (
        <WorkspaceDepartureModal
            titleId="workspace-departure-blocker-title"
            title="먼저 정리할 항목이 있습니다"
            description={`${targetName} 님은 현재 ${workspaceName} 제작팀을 나갈 수 없습니다.`}
            onRequestClose={onClose}
        >
            <div className="workspace-departure-modal__body">
                {impact.isLastActiveOwner && (
                    <div className="workspace-departure-modal__notice">
                        <strong>마지막 소유자입니다.</strong>
                        <p>다른 활동 멤버에게 소유자 권한을 부여한 뒤 다시 시도해 주세요.</p>
                    </div>
                )}

                {impact.ownedProjects.length > 0 && (
                    <>
                        <div>
                            <strong>소유 중인 프로젝트 {impact.ownedProjects.length}개</strong>
                            <p>각 프로젝트의 소유권을 다른 편집 참여자에게 이전해 주세요.</p>
                        </div>
                        <ul className="workspace-departure-modal__projects">
                            {impact.ownedProjects.map(project => {
                                const destination: ProjectDestination = project.archived
                                    && project.transferableMemberCount === 0
                                    ? 'DETAIL'
                                    : 'MEMBERS';
                                const actionLabel = destination === 'DETAIL'
                                    ? '프로젝트 상세'
                                    : '참여자 관리';

                                return (
                                    <li
                                        key={project.projectId}
                                        className="workspace-departure-modal__project"
                                    >
                                        <div>
                                            <strong>{project.title}</strong>
                                            <p>
                                                {project.archived ? '보관됨 · ' : ''}
                                                {STATUS_LABELS[project.status]}
                                                {' · 이전 후보 '}{project.transferableMemberCount}명
                                            </p>
                                        </div>
                                        <button
                                            type="button"
                                            className="workspace-departure-modal__button"
                                            onClick={() => onOpenProject(project, destination)}
                                        >
                                            {switchesWorkspace
                                                ? `${workspaceName}으로 전환하고 ${actionLabel}`
                                                : actionLabel
                                            }
                                        </button>
                                    </li>
                                );
                            })}
                        </ul>
                    </>
                )}

                <div className="workspace-departure-modal__actions">
                    <button
                        type="button"
                        className="workspace-departure-modal__button"
                        onClick={onClose}
                    >
                        닫기
                    </button>
                </div>
            </div>
        </WorkspaceDepartureModal>
    );
}

export type { ProjectDestination };
export default WorkspaceDepartureBlocker;
