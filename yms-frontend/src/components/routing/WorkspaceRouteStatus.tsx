import './WorkspaceRouteStatus.css';

type WorkspaceRouteStatusProps = {
    errorMessage?: string | null;
    isRetrying?: boolean;
    onRetry?: () => void;
};

/**
 * 보호 Route가 Workspace 접근 상태를 확인하는 동안 전체 화면 진행 상태를 제공합니다.
 * 조회 실패 시 같은 위치에서 오류와 재시도 동작을 제공하여 잘못된 이동을 방지합니다.
 * 재시도 중에는 버튼과 문구를 변경해 사용자가 진행 상황을 명확히 인지하게 합니다.
 */
function WorkspaceRouteStatus({
    errorMessage,
    isRetrying = false,
    onRetry
}: WorkspaceRouteStatusProps) {
    const isError = Boolean(errorMessage);

    return (
        <main className="workspace-route-status">
            <section
                className="workspace-route-status__panel"
                role={isError ? 'alert' : 'status'}
                aria-live="polite"
                aria-busy={!isError || isRetrying}
            >
                <img src="/icons/yms-icon-128x128.png" alt="YMS" />

                {!isError && (
                    <span
                        className="workspace-route-status__spinner"
                        aria-hidden="true"
                    />
                )}

                <h1>
                    {isError
                        ? '제작팀 정보를 확인하지 못했습니다'
                        : '제작팀 정보를 확인하고 있습니다.'}
                </h1>
                <p>
                    {isError
                        ? errorMessage
                        : '현재 사용할 수 있는 제작팀과 마지막 선택을 확인하는 중입니다.'}
                </p>

                {isError && onRetry && (
                    <button
                        type="button"
                        disabled={isRetrying}
                        onClick={onRetry}
                    >
                        {isRetrying ? '다시 확인하는 중...' : '다시 시도'}
                    </button>
                )}
            </section>
        </main>
    );
}

export default WorkspaceRouteStatus;
