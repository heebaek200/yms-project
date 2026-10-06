import type { WorkspaceInvitation } from '../../types/workspace';

type WorkspaceInvitationListProps = {
    invitations: WorkspaceInvitation[];
    processingInvitationIds: ReadonlySet<number>;
    onAccept: (invitationId: number) => void;
    onReject: (invitationId: number) => void;
};

const invitationDateFormatter = new Intl.DateTimeFormat('ko-KR', {
    dateStyle: 'medium',
    timeStyle: 'short'
});

/**
 * 서버의 ISO 초대 발송 시각을 현재 브라우저 지역 시간에 맞춰 표시합니다.
 * 파싱할 수 없는 값은 화면 전체 오류를 만들지 않고 원본 문자열을 반환합니다.
 * 반환값은 초대 카드의 보조 정보로만 사용합니다.
 */
function formatInvitationDate(value: string) {
    const date = new Date(value);

    return Number.isNaN(date.getTime())
        ? value
        : invitationDateFormatter.format(date);
}

/**
 * 현재 사용자에게 도착한 PENDING Workspace 초대를 목록으로 표시합니다.
 * 각 초대는 독립적인 처리 상태를 사용해 다른 항목의 수락·거절을 방해하지 않습니다.
 * 실제 상태 변경과 목록 갱신은 상위 온보딩 페이지에 위임합니다.
 */
function WorkspaceInvitationList({
    invitations,
    processingInvitationIds,
    onAccept,
    onReject
}: WorkspaceInvitationListProps) {
    if (invitations.length === 0) {
        return (
            <div className="workspace-empty-state workspace-empty-state--compact">
                <strong>대기 중인 초대가 없습니다.</strong>
                <p>새 초대가 도착하면 이곳에서 확인할 수 있습니다.</p>
            </div>
        );
    }

    return (
        <ul className="workspace-invitation-list">
            {invitations.map(invitation => {
                const isProcessing = processingInvitationIds.has(
                    invitation.invitationId
                );

                return (
                    <li
                        key={invitation.invitationId}
                        className="workspace-invitation-card"
                    >
                        <div className="workspace-invitation-card__content">
                            <h3>{invitation.workspaceName}</h3>
                            <p>{invitation.inviterName}님이 초대했습니다.</p>
                            <time dateTime={invitation.sentAt}>
                                {formatInvitationDate(invitation.sentAt)}
                            </time>
                        </div>

                        <div className="workspace-invitation-card__actions">
                            <button
                                type="button"
                                className="workspace-secondary-button"
                                disabled={isProcessing}
                                onClick={() => onReject(invitation.invitationId)}
                            >
                                거절
                            </button>
                            <button
                                type="button"
                                className="workspace-primary-button"
                                disabled={isProcessing}
                                onClick={() => onAccept(invitation.invitationId)}
                            >
                                {isProcessing ? '처리 중...' : '수락'}
                            </button>
                        </div>
                    </li>
                );
            })}
        </ul>
    );
}

export default WorkspaceInvitationList;
