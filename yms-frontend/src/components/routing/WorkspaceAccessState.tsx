import { useNavigate } from 'react-router';

import { useWorkspace } from '../../hooks/useWorkspace';
import { requestWorkspaceSwitcherOpen } from '../../workspace/workspaceSwitcherEvents';

import '../../pages/FeatureStatePage.css';

type WorkspaceAccessStateProps = {
    variant?: 'forbidden' | 'resource-unavailable';
    featureName?: string;
    listPath?: string;
};

/**
 * 현재 제작팀의 권한 또는 리소스 범위가 맞지 않을 때 공통 안내를 제공합니다.
 * 제작팀 이름을 보여 사용자가 작업 컨텍스트를 자연스럽게 다시 확인하게 합니다.
 * 사유에 따라 Dashboard 또는 해당 기능 목록으로 빠져나갈 수 있게 합니다.
 */
function WorkspaceAccessState({
    variant = 'forbidden',
    featureName = '기능',
    listPath
}: WorkspaceAccessStateProps) {
    const { currentWorkspace } = useWorkspace();
    const navigate = useNavigate();
    const isResourceUnavailable = variant === 'resource-unavailable';
    const title = isResourceUnavailable
        ? '현재 제작팀에서는 이 항목을 찾을 수 없어요'
        : '이 기능을 이용할 수 없어요';

    return (
        <section
            className="feature-state"
            aria-labelledby="workspace-access-title"
        >
            <div
                className="feature-state__art"
                aria-hidden="true"
            >
                {isResourceUnavailable ? '🔎' : '🪪'}
            </div>

            <p className="feature-state__eyebrow">
                {isResourceUnavailable ? 'CHECK WORKSPACE' : 'ACCESS GUIDE'}
            </p>

            <h1 id="workspace-access-title">
                {title}
            </h1>

            <p className="feature-state__description">
                현재 선택된 제작팀은
                {' '}
                <strong>‘{currentWorkspace?.name ?? '선택된 제작팀'}’</strong>
                입니다.
                {!isResourceUnavailable && (
                    <>
                        <br />
                        다른 제작팀에서 이용하려던 기능이라면 제작팀을 전환해 주세요.
                    </>
                )}
            </p>

            <div className="feature-state__actions">
                <button
                    type="button"
                    className="feature-state__button feature-state__button--secondary"
                    onClick={requestWorkspaceSwitcherOpen}
                >
                    제작팀 전환
                </button>

                <button
                    type="button"
                    className="feature-state__button feature-state__button--primary"
                    onClick={() => navigate(
                        isResourceUnavailable && listPath
                            ? listPath
                            : '/dashboard'
                    )}
                >
                    {isResourceUnavailable
                        ? `${featureName} 목록으로 이동`
                        : '대시보드로 이동'}
                </button>
            </div>
        </section>
    );
}

export default WorkspaceAccessState;
