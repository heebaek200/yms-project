import type { WorkspaceRole, WorkspaceSummary } from '../../types/workspace';

type WorkspaceCardProps = {
    workspace: WorkspaceSummary;
    isCurrent: boolean;
    isEntering: boolean;
    onEnter: (workspaceId: number) => void;
};

const WORKSPACE_ROLE_LABELS: Record<WorkspaceRole, string> = {
    OWNER: '소유자',
    ADMIN: '관리자',
    MEMBER: '멤버'
};

/**
 * 사용자가 참여 중인 Workspace의 이름, 권한과 진행 Project 수를 카드로 표시합니다.
 * 현재 선택된 Workspace에는 상태 배지를 제공하고 입장 중 중복 조작을 차단합니다.
 * 입장 요청은 Workspace ID만 상위 온보딩 페이지에 전달합니다.
 */
function WorkspaceCard({
    workspace,
    isCurrent,
    isEntering,
    onEnter
}: WorkspaceCardProps) {
    return (
        <article className={`workspace-card ${isCurrent
            ? 'workspace-card--current'
            : ''
        }`}>
            <div className="workspace-card__heading">
                <h3>{workspace.name}</h3>
                {isCurrent && (
                    <span className="workspace-card__current-badge">
                        현재 선택
                    </span>
                )}
            </div>

            <dl className="workspace-card__details">
                <div>
                    <dt>내 권한</dt>
                    <dd>{WORKSPACE_ROLE_LABELS[workspace.myRole]}</dd>
                </div>
                <div>
                    <dt>진행 중 프로젝트</dt>
                    <dd>{workspace.activeProjectCount}개</dd>
                </div>
            </dl>

            <button
                type="button"
                className="workspace-card__enter-button"
                disabled={isEntering}
                onClick={() => onEnter(workspace.workspaceId)}
            >
                {isEntering ? '입장 중...' : '제작팀 입장'}
            </button>
        </article>
    );
}

export default WorkspaceCard;
