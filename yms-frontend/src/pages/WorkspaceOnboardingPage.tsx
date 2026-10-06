import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router';

import {
    createWorkspace,
    type CreateWorkspaceRequest
} from '../api/workspaces/workspaces';
import {
    acceptWorkspaceInvitation,
    getPendingWorkspaceInvitations,
    rejectWorkspaceInvitation
} from '../api/workspaces/invitations';
import FeedbackMessage, {
    type FeedbackMessageType
} from '../components/common/FeedbackMessage';
import WorkspaceCard from '../components/workspace/WorkspaceCard';
import WorkspaceCreateForm from '../components/workspace/WorkspaceCreateForm';
import WorkspaceInvitationList from '../components/workspace/WorkspaceInvitationList';
import { useWorkspace } from '../hooks/useWorkspace';
import type { WorkspaceInvitation } from '../types/workspace';

import './WorkspaceOnboardingPage.css';

type PageFeedback = {
    type: FeedbackMessageType;
    message: string;
};

type CreateFieldErrors = {
    name: string;
    description: string;
};

const EMPTY_CREATE_FIELD_ERRORS: CreateFieldErrors = {
    name: '',
    description: ''
};

/**
 * SCR-03에서 참여 Workspace 선택, 새 Workspace 생성과 수신 초대 처리를 제공합니다.
 * WorkspaceContext 목록과 선택 상태를 갱신하고 명시적 입장 또는 생성 후 Dashboard로 이동합니다.
 * 전역 인증·프로필·Workspace Route Guard는 후속 #30의 책임으로 남겨 둡니다.
 */
function WorkspaceOnboardingPage() {
    const navigate = useNavigate();
    const {
        workspaces,
        currentWorkspace,
        isLoading: isWorkspaceLoading,
        errorMessage: workspaceErrorMessage,
        selectWorkspace,
        refreshWorkspaces
    } = useWorkspace();

    const [invitations, setInvitations] = useState<WorkspaceInvitation[]>([]);
    const [isInvitationLoading, setIsInvitationLoading] = useState(true);
    const [invitationLoadError, setInvitationLoadError] = useState('');
    const [processingInvitationIds, setProcessingInvitationIds] =
        useState<Set<number>>(() => new Set());
    const [enteringWorkspaceId, setEnteringWorkspaceId] =
        useState<number | null>(null);
    const [isCreateFormOpen, setIsCreateFormOpen] = useState(false);
    const [workspaceName, setWorkspaceName] = useState('');
    const [workspaceDescription, setWorkspaceDescription] = useState('');
    const [createFieldErrors, setCreateFieldErrors] =
        useState<CreateFieldErrors>(EMPTY_CREATE_FIELD_ERRORS);
    const [isCreating, setIsCreating] = useState(false);
    const [feedback, setFeedback] = useState<PageFeedback | null>(null);

    /**
     * 현재 사용자에게 도착한 유효한 PENDING 초대를 다시 조회합니다.
     * Workspace 목록 오류와 독립적으로 처리해 한 영역의 실패가 다른 영역을 가리지 않게 합니다.
     * 조회 실패 시 기존 목록을 비우고 해당 영역에 재시도 가능한 오류를 표시합니다.
     */
    const loadInvitations = useCallback(async () => {
        try {
            setIsInvitationLoading(true);
            setInvitationLoadError('');

            const response = await getPendingWorkspaceInvitations();
            setInvitations(response.data);
        } catch (error) {
            console.error(error);
            setInvitations([]);
            setInvitationLoadError('대기 중인 초대를 불러오지 못했습니다.');
        } finally {
            setIsInvitationLoading(false);
        }
    }, []);

    useEffect(() => {
        void loadInvitations();
    }, [loadInvitations]);

    /**
     * 선택한 Workspace를 전역 현재 Workspace로 저장하고 Dashboard로 이동합니다.
     * 카드별 진행 상태를 표시해 빠른 중복 클릭으로 다른 Workspace가 선택되지 않게 합니다.
     * 실제 접근 차단과 직접 URL 검증은 후속 #30 Route Guard에서 수행합니다.
     */
    const handleWorkspaceEnter = (workspaceId: number) => {
        if (enteringWorkspaceId !== null) {
            return;
        }

        setEnteringWorkspaceId(workspaceId);
        selectWorkspace(workspaceId);
        navigate('/dashboard');
    };

    /**
     * 새 Workspace 생성 요청을 검증하고 성공 결과를 Context 목록과 현재 선택값에 반영합니다.
     * 서버 필드 오류는 이름과 설명 입력에 각각 연결하고 일반 오류는 상단 피드백으로 표시합니다.
     * 생성된 사용자는 OWNER이며 생성 직후 해당 Workspace의 Dashboard로 이동합니다.
     */
    const handleWorkspaceCreate = async (
        event: React.SubmitEvent<HTMLFormElement>
    ) => {
        event.preventDefault();

        if (isCreating) {
            return;
        }

        const request: CreateWorkspaceRequest = {
            name: workspaceName,
            description: workspaceDescription
        };

        try {
            setIsCreating(true);
            setFeedback(null);
            setCreateFieldErrors(EMPTY_CREATE_FIELD_ERRORS);

            const response = await createWorkspace(request);

            if (!response.success) {
                const nextErrors = { ...EMPTY_CREATE_FIELD_ERRORS };

                response.errors?.forEach(error => {
                    if (error.field === 'name') {
                        nextErrors.name = error.reason;
                    }
                    if (error.field === 'description') {
                        nextErrors.description = error.reason;
                    }
                });

                setCreateFieldErrors(nextErrors);
                if (!nextErrors.name && !nextErrors.description) {
                    setFeedback({ type: 'error', message: response.message });
                }
                return;
            }

            await refreshWorkspaces();
            selectWorkspace(response.data.workspaceId);
            navigate('/dashboard');
        } catch (error) {
            console.error(error);
            setFeedback({
                type: 'error',
                message: '제작팀을 만들지 못했습니다. 잠시 후 다시 시도해 주세요.'
            });
        } finally {
            setIsCreating(false);
        }
    };

    /**
     * 초대 처리 중인 ID를 Set에 추가하거나 제거해 해당 행의 버튼만 비활성화합니다.
     * 함수형 상태 갱신을 사용하여 동시에 처리되는 다른 초대 ID를 잃지 않습니다.
     * 수락과 거절 동작이 동일한 중복 제출 방지 정책을 공유합니다.
     */
    const setInvitationProcessing = (
        invitationId: number,
        isProcessing: boolean
    ) => {
        setProcessingInvitationIds(currentIds => {
            const nextIds = new Set(currentIds);

            if (isProcessing) {
                nextIds.add(invitationId);
            } else {
                nextIds.delete(invitationId);
            }

            return nextIds;
        });
    };

    /**
     * PENDING 초대를 수락하고 새 Workspace 멤버십을 Context 목록에 즉시 반영합니다.
     * 만료·취소 등 상태 경합 오류는 사용자에게 알린 뒤 서버 기준 목록을 다시 조회합니다.
     * 수락만으로 자동 입장하지 않고 사용자가 새 카드에서 명시적으로 선택하도록 유지합니다.
     */
    const handleInvitationAccept = async (invitationId: number) => {
        if (processingInvitationIds.has(invitationId)) {
            return;
        }

        try {
            setInvitationProcessing(invitationId, true);
            setFeedback(null);

            const response = await acceptWorkspaceInvitation(invitationId);

            if (!response.success) {
                setFeedback({ type: 'error', message: response.message });
                await loadInvitations();
                return;
            }

            setInvitations(currentInvitations => currentInvitations.filter(
                invitation => invitation.invitationId !== invitationId
            ));
            await refreshWorkspaces();
            setFeedback({ type: 'success', message: response.message ?? '초대를 수락했습니다.' });
        } catch (error) {
            console.error(error);
            setFeedback({
                type: 'error',
                message: '초대를 수락하지 못했습니다. 잠시 후 다시 시도해 주세요.'
            });
        } finally {
            setInvitationProcessing(invitationId, false);
        }
    };

    /**
     * PENDING 초대를 거절하고 성공한 항목을 대기 목록에서 제거합니다.
     * 만료·취소 등 상태 경합 오류는 사용자에게 알린 뒤 최신 초대 목록을 다시 조회합니다.
     * 처리 중에는 해당 초대의 수락과 거절 버튼만 비활성화합니다.
     */
    const handleInvitationReject = async (invitationId: number) => {
        if (processingInvitationIds.has(invitationId)) {
            return;
        }

        try {
            setInvitationProcessing(invitationId, true);
            setFeedback(null);

            const response = await rejectWorkspaceInvitation(invitationId);

            if (!response.success) {
                setFeedback({ type: 'error', message: response.message });
                await loadInvitations();
                return;
            }

            setInvitations(currentInvitations => currentInvitations.filter(
                invitation => invitation.invitationId !== invitationId
            ));
            setFeedback({ type: 'success', message: response.message ?? '초대를 거절했습니다.' });
        } catch (error) {
            console.error(error);
            setFeedback({
                type: 'error',
                message: '초대를 거절하지 못했습니다. 잠시 후 다시 시도해 주세요.'
            });
        } finally {
            setInvitationProcessing(invitationId, false);
        }
    };

    return (
        <main className="workspace-onboarding-page">
            <section className="workspace-onboarding-panel">
                <header className="workspace-onboarding-header">
                    <img src="/icons/yms-icon-128x128.png" alt="YMS" />
                    <div>
                        <p className="workspace-onboarding-header__eyebrow">
                            Workspace 온보딩
                        </p>
                        <h1>함께 작업할 제작팀을 선택하세요</h1>
                        <p>
                            참여 중인 제작팀에 입장하거나 새 제작팀을 만들 수 있습니다.
                        </p>
                    </div>
                </header>

                {feedback && (
                    <FeedbackMessage
                        type={feedback.type}
                        message={feedback.message}
                    />
                )}

                <section
                    className="workspace-onboarding-section"
                    aria-labelledby="workspace-list-title"
                >
                    <div className="workspace-onboarding-section__header">
                        <div>
                            <h2 id="workspace-list-title">내 제작팀</h2>
                            <p>현재 참여 중인 제작팀 목록입니다.</p>
                        </div>
                        <button
                            type="button"
                            className="workspace-primary-button"
                            aria-expanded={isCreateFormOpen}
                            onClick={() => {
                                setIsCreateFormOpen(current => !current);
                                setCreateFieldErrors(EMPTY_CREATE_FIELD_ERRORS);
                                setFeedback(null);
                            }}
                        >
                            {isCreateFormOpen ? '생성 닫기' : '+ 새 제작팀'}
                        </button>
                    </div>

                    {isCreateFormOpen && (
                        <WorkspaceCreateForm
                            name={workspaceName}
                            description={workspaceDescription}
                            nameError={createFieldErrors.name}
                            descriptionError={createFieldErrors.description}
                            isSubmitting={isCreating}
                            onNameChange={setWorkspaceName}
                            onDescriptionChange={setWorkspaceDescription}
                            onCancel={() => {
                                setIsCreateFormOpen(false);
                                setCreateFieldErrors(EMPTY_CREATE_FIELD_ERRORS);
                            }}
                            onSubmit={handleWorkspaceCreate}
                        />
                    )}

                    {isWorkspaceLoading ? (
                        <p className="workspace-state-message">
                            제작팀 목록을 불러오는 중...
                        </p>
                    ) : workspaceErrorMessage ? (
                        <div className="workspace-retry-state">
                            <FeedbackMessage
                                type="error"
                                message={workspaceErrorMessage}
                            />
                            <button
                                type="button"
                                className="workspace-secondary-button"
                                onClick={() => void refreshWorkspaces()}
                            >
                                다시 시도
                            </button>
                        </div>
                    ) : workspaces.length === 0 ? (
                        <div className="workspace-empty-state">
                            <strong>아직 참여 중인 제작팀이 없습니다.</strong>
                            <p>새 제작팀을 만들거나 도착한 초대를 확인해 주세요.</p>
                        </div>
                    ) : (
                        <div className="workspace-card-grid">
                            {workspaces.map(workspace => (
                                <WorkspaceCard
                                    key={workspace.workspaceId}
                                    workspace={workspace}
                                    isCurrent={
                                        currentWorkspace?.workspaceId
                                        === workspace.workspaceId
                                    }
                                    isEntering={
                                        enteringWorkspaceId === workspace.workspaceId
                                    }
                                    onEnter={handleWorkspaceEnter}
                                />
                            ))}
                        </div>
                    )}
                </section>

                <section
                    className="workspace-onboarding-section"
                    aria-labelledby="workspace-invitation-title"
                >
                    <div className="workspace-onboarding-section__header">
                        <div>
                            <h2 id="workspace-invitation-title">대기 중 초대</h2>
                            <p>내 이메일로 도착한 제작팀 초대입니다.</p>
                        </div>
                    </div>

                    {isInvitationLoading ? (
                        <p className="workspace-state-message">
                            초대 목록을 불러오는 중...
                        </p>
                    ) : invitationLoadError ? (
                        <div className="workspace-retry-state">
                            <FeedbackMessage
                                type="error"
                                message={invitationLoadError}
                            />
                            <button
                                type="button"
                                className="workspace-secondary-button"
                                onClick={() => void loadInvitations()}
                            >
                                다시 시도
                            </button>
                        </div>
                    ) : (
                        <WorkspaceInvitationList
                            invitations={invitations}
                            processingInvitationIds={processingInvitationIds}
                            onAccept={invitationId => {
                                void handleInvitationAccept(invitationId);
                            }}
                            onReject={invitationId => {
                                void handleInvitationReject(invitationId);
                            }}
                        />
                    )}
                </section>
            </section>
        </main>
    );
}

export default WorkspaceOnboardingPage;
