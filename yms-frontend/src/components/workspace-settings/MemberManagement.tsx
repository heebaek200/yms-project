import { useCallback, useEffect, useRef, useState } from 'react';

import {
    cancelWorkspaceMemberInvitation,
    createWorkspaceMemberInvitation,
    getWorkspaceSentInvitations,
    isWorkspaceInvitationExpired
} from '../../api/workspaces/memberInvitations';
import {
    getWorkspaceMembers,
    removeWorkspaceMember,
    updateWorkspaceMemberRole
} from '../../api/workspaces/members';
import { useAuth } from '../../contexts/AuthContext';
import { useWorkspace } from '../../hooks/useWorkspace';
import {
    PROFESSIONAL_ROLE_LABELS,
    PROFESSIONAL_ROLE_OPTIONS
} from '../../professionalRoles';
import type { UserRole } from '../../types/auth';
import type { WorkspaceRole } from '../../types/workspace';
import type {
    WorkspaceInvitationStatusFilter,
    WorkspaceMember,
    WorkspaceMemberStatus,
    WorkspaceSentInvitation
} from '../../types/workspaceSettings';
import FeedbackMessage, {
    type FeedbackMessageType
} from '../common/FeedbackMessage';
import SettingsModal from './SettingsModal';

type MemberManagementProps = {
    workspaceId: number;
    onDirtyChange: (isDirty: boolean) => void;
};

type FeedbackState = {
    type: FeedbackMessageType;
    message: string;
};

const WORKSPACE_ROLE_LABELS: Record<WorkspaceRole, string> = {
    OWNER: '소유자',
    ADMIN: '관리자',
    MEMBER: '멤버'
};

const MEMBER_STATUS_LABELS: Record<WorkspaceMemberStatus, string> = {
    ACTIVE: '활동 중',
    LEFT: '탈퇴',
    REMOVED: '제외됨'
};

const INVITATION_STATUS_LABELS: Record<WorkspaceInvitationStatusFilter, string> = {
    ALL: '전체',
    PENDING: '대기 중',
    ACCEPTED: '수락',
    REJECTED: '거절',
    CANCELLED: '취소',
    EXPIRED: '만료'
};

/** ISO 날짜를 사용자의 브라우저 시간대 기준 간결한 날짜로 표시합니다. */
function formatDate(value: string | null) {
    if (!value) {
        return '-';
    }

    return new Intl.DateTimeFormat('ko-KR', {
        dateStyle: 'medium',
        timeStyle: 'short'
    }).format(new Date(value));
}

/** 저장 상태와 만료 시각을 조합해 화면에 표시할 초대 상태를 계산합니다. */
function getInvitationDisplayStatus(
    invitation: WorkspaceSentInvitation
): Exclude<WorkspaceInvitationStatusFilter, 'ALL'> {
    return isWorkspaceInvitationExpired(invitation)
        ? 'EXPIRED'
        : invitation.status;
}

/**
 * 제작팀 멤버와 발송 초대를 한 탭에서 독립된 목록으로 관리합니다.
 * 서버 Mock의 권한 검증을 최종 기준으로 두고 화면에서는 불가능한 액션을 미리 숨깁니다.
 */
function MemberManagement({
    workspaceId,
    onDirtyChange
}: MemberManagementProps) {
    const { user } = useAuth();
    const { currentWorkspace, refreshWorkspaces } = useWorkspace();
    const [members, setMembers] = useState<WorkspaceMember[]>([]);
    const [memberKeyword, setMemberKeyword] = useState('');
    const [memberStatus, setMemberStatus] =
        useState<WorkspaceMemberStatus | 'ALL'>('ACTIVE');
    const [professionalRole, setProfessionalRole] =
        useState<UserRole | 'ALL'>('ALL');
    const [workspaceRole, setWorkspaceRole] =
        useState<WorkspaceRole | 'ALL'>('ALL');
    const [membersLoading, setMembersLoading] = useState(true);
    const [membersError, setMembersError] = useState<string | null>(null);
    const [memberFeedback, setMemberFeedback] =
        useState<FeedbackState | null>(null);
    const [invitations, setInvitations] =
        useState<WorkspaceSentInvitation[]>([]);
    const [invitationKeyword, setInvitationKeyword] = useState('');
    const [invitationStatus, setInvitationStatus] =
        useState<WorkspaceInvitationStatusFilter>('PENDING');
    const [invitationsLoading, setInvitationsLoading] = useState(true);
    const [invitationsError, setInvitationsError] = useState<string | null>(null);
    const [invitationFeedback, setInvitationFeedback] =
        useState<FeedbackState | null>(null);
    const [editingMember, setEditingMember] =
        useState<WorkspaceMember | null>(null);
    const [selectedWorkspaceRole, setSelectedWorkspaceRole] =
        useState<WorkspaceRole>('MEMBER');
    const [activeOwnerCount, setActiveOwnerCount] = useState<number | null>(null);
    const [isCheckingOwnerConstraint, setIsCheckingOwnerConstraint] = useState(false);
    const [isOwnerConfirmationOpen, setIsOwnerConfirmationOpen] = useState(false);
    const [ownerConfirmationEmail, setOwnerConfirmationEmail] = useState('');
    const [removingMember, setRemovingMember] =
        useState<WorkspaceMember | null>(null);
    const [ownerRemovalEmail, setOwnerRemovalEmail] = useState('');
    const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
    const [inviteEmail, setInviteEmail] = useState('');
    const [inviteEmailError, setInviteEmailError] = useState('');
    const [modalError, setModalError] = useState<string | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [cancellingInvitationIds, setCancellingInvitationIds] =
        useState<Set<number>>(() => new Set());
    const inviteEmailRef = useRef<HTMLInputElement>(null);
    const ownerConfirmationRef = useRef<HTMLInputElement>(null);
    const ownerRemovalRef = useRef<HTMLInputElement>(null);

    const actorRole = currentWorkspace?.myRole ?? 'MEMBER';
    const roleFormDirty = editingMember !== null
        && selectedWorkspaceRole !== editingMember.workspaceRole;
    const inviteFormDirty = isInviteModalOpen && inviteEmail !== '';
    const isDirty = roleFormDirty || inviteFormDirty;
    const ownerConfirmationMatches = editingMember !== null
        && ownerConfirmationEmail.trim().toLocaleLowerCase()
            === editingMember.email.toLocaleLowerCase();
    const isOwnerPromotion = editingMember !== null
        && editingMember.workspaceRole !== 'OWNER'
        && selectedWorkspaceRole === 'OWNER';
    const isEditingLastOwner = editingMember?.workspaceRole === 'OWNER'
        && activeOwnerCount !== null
        && activeOwnerCount <= 1;
    const isRemovingOwner = removingMember?.workspaceRole === 'OWNER';
    const ownerRemovalMatches = removingMember !== null
        && ownerRemovalEmail.trim().toLocaleLowerCase()
            === removingMember.email.toLocaleLowerCase();

    // 탭 이동과 제작팀 전환이 새 모달의 미저장 입력도 기존 공통 경고로 처리하게 합니다.
    useEffect(() => {
        onDirtyChange(isDirty);
    }, [isDirty, onDirtyChange]);

    useEffect(() => () => onDirtyChange(false), [onDirtyChange]);

    /** 현재 멤버 필터를 서버 Mock에 전달하고 최신 목록으로 교체합니다. */
    const loadMembers = useCallback(async () => {
        try {
            setMembersLoading(true);
            setMembersError(null);
            const response = await getWorkspaceMembers(workspaceId, {
                keyword: memberKeyword,
                status: memberStatus,
                professionalRole,
                workspaceRole
            });

            setMembers(response.data);
        } catch (error) {
            console.error(error);
            setMembers([]);
            setMembersError('멤버 목록을 불러오지 못했습니다.');
        } finally {
            setMembersLoading(false);
        }
    }, [
        memberKeyword,
        memberStatus,
        professionalRole,
        workspaceId,
        workspaceRole
    ]);

    /**
     * 기존 멤버 목록 API에 ACTIVE·OWNER 조건을 적용해 강등 가능 여부를 조회합니다.
     * 화면에 적용된 검색 필터와 분리하여 숨겨진 OWNER도 권한 판단에 포함합니다.
     */
    const loadActiveOwnerCount = useCallback(async () => {
        const response = await getWorkspaceMembers(workspaceId, {
            status: 'ACTIVE',
            workspaceRole: 'OWNER'
        });

        setActiveOwnerCount(response.data.length);
        return response.data.length;
    }, [workspaceId]);

    /** 현재 초대 필터를 서버 Mock에 전달하고 발송 내역을 최신순으로 조회합니다. */
    const loadInvitations = useCallback(async () => {
        try {
            setInvitationsLoading(true);
            setInvitationsError(null);
            const response = await getWorkspaceSentInvitations(workspaceId, {
                keyword: invitationKeyword,
                status: invitationStatus
            });

            setInvitations(response.data);
        } catch (error) {
            console.error(error);
            setInvitations([]);
            setInvitationsError('초대 내역을 불러오지 못했습니다.');
        } finally {
            setInvitationsLoading(false);
        }
    }, [invitationKeyword, invitationStatus, workspaceId]);

    useEffect(() => {
        void loadMembers();
    }, [loadMembers]);

    useEffect(() => {
        void loadActiveOwnerCount().catch(error => {
            console.error(error);
            setActiveOwnerCount(null);
        });
    }, [loadActiveOwnerCount]);

    useEffect(() => {
        void loadInvitations();
    }, [loadInvitations]);

    /** 선택한 멤버의 현재 권한을 복사해 권한 변경 모달을 엽니다. */
    const openRoleModal = (member: WorkspaceMember) => {
        setEditingMember(member);
        setSelectedWorkspaceRole(member.workspaceRole);
        setIsOwnerConfirmationOpen(false);
        setOwnerConfirmationEmail('');
        setModalError(null);
        setMemberFeedback(null);

        // OWNER 편집을 시작할 때 기존 목록 API로 최신 강등 가능 여부를 다시 확인합니다.
        if (member.workspaceRole === 'OWNER') {
            setIsCheckingOwnerConstraint(true);
            void loadActiveOwnerCount()
                .then(ownerCount => {
                    if (ownerCount <= 1) {
                        setSelectedWorkspaceRole('OWNER');
                    }
                })
                .catch(error => {
                    console.error(error);
                    setActiveOwnerCount(null);
                    setModalError(
                        '소유자 권한 상태를 확인하지 못했습니다. 잠시 후 다시 시도해 주세요.'
                    );
                })
                .finally(() => setIsCheckingOwnerConstraint(false));
        }
    };

    /** 입력값이 바뀐 모달은 폐기 확인 뒤에만 닫습니다. */
    const closeEditableModal = useCallback(() => {
        if (isDirty && !window.confirm(
            '저장하지 않은 변경사항이 있습니다. 변경사항을 버리고 닫을까요?'
        )) {
            return;
        }

        setEditingMember(null);
        setIsOwnerConfirmationOpen(false);
        setOwnerConfirmationEmail('');
        setIsInviteModalOpen(false);
        setInviteEmail('');
        setInviteEmailError('');
        setModalError(null);
        onDirtyChange(false);
    }, [isDirty, onDirtyChange]);

    /** 확정된 멤버 권한 변경을 저장하고 자기 권한 변경 시 제작팀 Context도 갱신합니다. */
    const saveRoleChange = async () => {
        if (!editingMember || !user) {
            return;
        }

        try {
            setIsSubmitting(true);
            setModalError(null);
            const response = await updateWorkspaceMemberRole(
                workspaceId,
                editingMember.workspaceMemberId,
                selectedWorkspaceRole,
                user.userId
            );

            if (!response.success) {
                setModalError(response.message);
                return;
            }

            setEditingMember(null);
            setIsOwnerConfirmationOpen(false);
            setOwnerConfirmationEmail('');
            setMemberFeedback({
                type: 'success',
                message: response.message ?? '멤버 권한을 변경했습니다.'
            });
            onDirtyChange(false);
            await loadMembers();
            await loadActiveOwnerCount();

            // 자기 권한 변경은 Header와 Route Guard가 즉시 같은 권한을 보도록 재조회합니다.
            if (response.data.userId === user.userId) {
                await refreshWorkspaces();
            }
        } catch (error) {
            console.error(error);
            setModalError('멤버 권한을 변경하지 못했습니다.');
        } finally {
            setIsSubmitting(false);
        }
    };

    /**
     * 일반 권한 변경은 바로 저장하고 OWNER 경계를 넘는 변경은 전용 확인 단계로 보냅니다.
     * 승격과 강등 모두 대상 이메일을 다시 확인해야 서버 Mock 호출이 실행됩니다.
     */
    const handleRoleSubmit = async (
        event: React.SubmitEvent<HTMLFormElement>
    ) => {
        event.preventDefault();

        if (!editingMember || !roleFormDirty) {
            return;
        }

        const crossesOwnerBoundary = editingMember.workspaceRole === 'OWNER'
            || selectedWorkspaceRole === 'OWNER';

        if (crossesOwnerBoundary) {
            // OWNER 강등은 이메일 확인을 요구하기 전에 최신 전체 OWNER 수로 먼저 차단합니다.
            if (
                editingMember.workspaceRole === 'OWNER'
                && selectedWorkspaceRole !== 'OWNER'
            ) {
                try {
                    setIsCheckingOwnerConstraint(true);
                    setModalError(null);
                    const latestOwnerCount = await loadActiveOwnerCount();

                    if (latestOwnerCount <= 1) {
                        setModalError(
                            '제작팀에는 소유자가 한 명 이상 필요합니다. 다른 멤버를 소유자로 지정한 뒤 권한을 변경해 주세요.'
                        );
                        return;
                    }
                } catch (error) {
                    console.error(error);
                    setModalError(
                        '소유자 권한 상태를 확인하지 못했습니다. 잠시 후 다시 시도해 주세요.'
                    );
                    return;
                } finally {
                    setIsCheckingOwnerConstraint(false);
                }
            }

            setOwnerConfirmationEmail('');
            setModalError(null);
            setIsOwnerConfirmationOpen(true);
            return;
        }

        void saveRoleChange();
    };

    /** 이메일 확인값이 대상과 일치할 때만 고위험 OWNER 권한 변경을 최종 저장합니다. */
    const handleOwnerConfirmationSubmit = (
        event: React.SubmitEvent<HTMLFormElement>
    ) => {
        event.preventDefault();

        if (!ownerConfirmationMatches) {
            ownerConfirmationRef.current?.focus();
            return;
        }

        void saveRoleChange();
    };

    /** 소유 프로젝트가 있는 멤버는 고위험 제외 확인 모달을 열기 전에 차단합니다. */
    const openRemoveMemberModal = (member: WorkspaceMember) => {
        if (member.ownedProjectCount > 0) {
            setMemberFeedback({
                type: 'error',
                message: `소유 중인 프로젝트 ${member.ownedProjectCount}개의 소유자를 먼저 변경해 주세요.`
            });
            return;
        }

        setRemovingMember(member);
        setOwnerRemovalEmail('');
        setModalError(null);
    };

    /** 확인 모달에서 선택한 멤버를 제외하고 현재 필터 목록을 다시 조회합니다. */
    const handleRemoveMember = async () => {
        if (!removingMember || !user) {
            return;
        }

        if (isRemovingOwner && !ownerRemovalMatches) {
            ownerRemovalRef.current?.focus();
            return;
        }

        try {
            setIsSubmitting(true);
            setModalError(null);
            const response = await removeWorkspaceMember(
                workspaceId,
                removingMember.workspaceMemberId,
                user.userId
            );

            if (!response.success) {
                setModalError(response.message);
                return;
            }

            setRemovingMember(null);
            setOwnerRemovalEmail('');
            setMemberFeedback({
                type: 'success',
                message: response.message ?? '멤버를 제작팀에서 제외했습니다.'
            });
            await loadMembers();
        } catch (error) {
            console.error(error);
            setModalError('멤버를 제외하지 못했습니다.');
        } finally {
            setIsSubmitting(false);
        }
    };

    /** 이메일 초대를 생성하고 기본값인 유효 대기 목록으로 돌아갑니다. */
    const handleInviteSubmit = async (event: React.SubmitEvent<HTMLFormElement>) => {
        event.preventDefault();

        if (!user) {
            return;
        }

        try {
            setIsSubmitting(true);
            setInviteEmailError('');
            setModalError(null);
            const response = await createWorkspaceMemberInvitation(
                workspaceId,
                currentWorkspace?.name ?? '',
                currentWorkspace?.activeProjectCount ?? 0,
                inviteEmail,
                user.name,
                actorRole
            );

            if (!response.success) {
                const fieldError = response.errors?.find(error => error.field === 'email');
                if (fieldError) {
                    setInviteEmailError(fieldError.reason);
                    window.requestAnimationFrame(() => inviteEmailRef.current?.focus());
                } else {
                    setModalError(response.message);
                }
                return;
            }

            setIsInviteModalOpen(false);
            setInviteEmail('');
            setInvitationStatus('PENDING');
            setInvitationFeedback({
                type: 'success',
                message: response.message ?? '멤버 초대를 보냈습니다.'
            });
            onDirtyChange(false);
            await loadInvitations();
        } catch (error) {
            console.error(error);
            setModalError('멤버 초대를 보내지 못했습니다.');
        } finally {
            setIsSubmitting(false);
        }
    };

    /** 사용자가 확인한 유효 대기 초대를 취소하고 목록 상태를 갱신합니다. */
    const handleCancelInvitation = async (invitation: WorkspaceSentInvitation) => {
        if (!window.confirm(`${invitation.email} 주소의 초대를 취소할까요?`)) {
            return;
        }

        try {
            setCancellingInvitationIds(current => (
                new Set(current).add(invitation.invitationId)
            ));
            const response = await cancelWorkspaceMemberInvitation(
                workspaceId,
                invitation.invitationId,
                actorRole
            );

            if (!response.success) {
                setInvitationFeedback({ type: 'error', message: response.message });
                return;
            }

            setInvitationFeedback({
                type: 'success',
                message: response.message ?? '멤버 초대를 취소했습니다.'
            });
            await loadInvitations();
        } catch (error) {
            console.error(error);
            setInvitationFeedback({ type: 'error', message: '초대를 취소하지 못했습니다.' });
        } finally {
            setCancellingInvitationIds(current => {
                const next = new Set(current);
                next.delete(invitation.invitationId);
                return next;
            });
        }
    };

    /** 현재 관리자와 대상 권한을 기준으로 화면에 제외 액션을 노출할지 판단합니다. */
    const canRemoveMember = (member: WorkspaceMember) => {
        if (!user || member.status !== 'ACTIVE' || member.userId === user.userId) {
            return false;
        }

        return actorRole === 'OWNER'
            || (actorRole === 'ADMIN' && member.workspaceRole === 'MEMBER');
    };

    return (
        <div className="settings-member-management">
            <section className="settings-resource" aria-labelledby="member-management-title">
                <div className="settings-resource__header">
                    <div>
                        <h2 id="member-management-title">멤버 관리</h2>
                        <p>전문 역할과 제작팀 권한, 참여 상태를 확인하고 관리합니다.</p>
                    </div>

                    <button
                        type="button"
                        className="settings-button settings-button--primary"
                        onClick={() => {
                            setInviteEmail('');
                            setInviteEmailError('');
                            setModalError(null);
                            setInvitationFeedback(null);
                            setIsInviteModalOpen(true);
                        }}
                    >
                        멤버 초대
                    </button>
                </div>

                <div className="settings-filters" aria-label="멤버 검색 조건">
                    <label className="settings-filter settings-filter--keyword">
                        <span>이름 또는 이메일</span>
                        <input
                            type="search"
                            value={memberKeyword}
                            placeholder="멤버 검색"
                            onChange={event => setMemberKeyword(event.target.value)}
                        />
                    </label>
                    <label className="settings-filter">
                        <span>상태</span>
                        <select
                            value={memberStatus}
                            onChange={event => setMemberStatus(
                                event.target.value as WorkspaceMemberStatus | 'ALL'
                            )}
                        >
                            <option value="ALL">전체</option>
                            {Object.entries(MEMBER_STATUS_LABELS).map(([value, label]) => (
                                <option key={value} value={value}>{label}</option>
                            ))}
                        </select>
                    </label>
                    <label className="settings-filter">
                        <span>전문 역할</span>
                        <select
                            value={professionalRole}
                            onChange={event => setProfessionalRole(
                                event.target.value as UserRole | 'ALL'
                            )}
                        >
                            <option value="ALL">전체</option>
                            {PROFESSIONAL_ROLE_OPTIONS.map(role => (
                                <option key={role.value} value={role.value}>{role.label}</option>
                            ))}
                        </select>
                    </label>
                    <label className="settings-filter">
                        <span>제작팀 권한</span>
                        <select
                            value={workspaceRole}
                            onChange={event => setWorkspaceRole(
                                event.target.value as WorkspaceRole | 'ALL'
                            )}
                        >
                            <option value="ALL">전체</option>
                            {Object.entries(WORKSPACE_ROLE_LABELS).map(([value, label]) => (
                                <option key={value} value={value}>{label}</option>
                            ))}
                        </select>
                    </label>
                </div>

                {memberFeedback && (
                    <FeedbackMessage type={memberFeedback.type} message={memberFeedback.message} />
                )}

                {membersLoading ? (
                    <p className="settings-state" role="status">멤버를 불러오는 중...</p>
                ) : membersError ? (
                    <div className="settings-state settings-state--error">
                        <FeedbackMessage type="error" message={membersError} />
                        <button type="button" className="settings-button" onClick={() => void loadMembers()}>
                            다시 시도
                        </button>
                    </div>
                ) : members.length === 0 ? (
                    <div className="settings-state">
                        <strong>조건에 맞는 멤버가 없습니다.</strong>
                        <p>검색어나 필터를 바꿔 다시 확인해 주세요.</p>
                    </div>
                ) : (
                    <ul className="settings-member-list">
                        {members.map(member => (
                            <li
                                key={member.workspaceMemberId}
                                className={member.status === 'ACTIVE'
                                    ? 'settings-member-card'
                                    : 'settings-member-card settings-member-card--inactive'
                                }
                            >
                                <div className="settings-member-card__identity">
                                    <strong>{member.name}</strong>
                                    <span>{member.email}</span>
                                    <div className="settings-card__badges">
                                        <span className={`settings-badge settings-badge--${member.status === 'ACTIVE' ? 'active' : 'inactive'}`}>
                                            {MEMBER_STATUS_LABELS[member.status]}
                                        </span>
                                        <span className={`settings-badge settings-badge--workspace-role-${member.workspaceRole.toLocaleLowerCase()}`}>
                                            {WORKSPACE_ROLE_LABELS[member.workspaceRole]}
                                        </span>
                                    </div>
                                </div>
                                <div className="settings-member-card__roles">
                                    {member.professionalRoles.map(role => (
                                        <span key={role}>{PROFESSIONAL_ROLE_LABELS[role]}</span>
                                    ))}
                                </div>
                                <div className="settings-member-card__date">
                                    <span>참여일</span>
                                    <strong>{formatDate(member.joinedAt)}</strong>
                                </div>
                                <div className="settings-member-card__actions">
                                    {actorRole === 'OWNER' && member.status === 'ACTIVE' && (
                                        <button type="button" className="settings-button" onClick={() => openRoleModal(member)}>
                                            권한 변경
                                        </button>
                                    )}
                                    {canRemoveMember(member) && (
                                        <button
                                            type="button"
                                            className="settings-button settings-button--danger"
                                            onClick={() => openRemoveMemberModal(member)}
                                        >
                                            제작팀에서 제외
                                        </button>
                                    )}
                                </div>
                            </li>
                        ))}
                    </ul>
                )}
            </section>

            <section className="settings-resource" aria-labelledby="invitation-management-title">
                <div className="settings-resource__header">
                    <div>
                        <h2 id="invitation-management-title">보낸 초대</h2>
                        <p>멤버 초대의 진행 상태를 확인하고 유효한 대기 초대를 취소합니다.</p>
                    </div>
                </div>

                <div className="settings-filters settings-filters--invitation" aria-label="초대 검색 조건">
                    <label className="settings-filter settings-filter--keyword">
                        <span>이메일</span>
                        <input
                            type="search"
                            value={invitationKeyword}
                            placeholder="초대 이메일 검색"
                            onChange={event => setInvitationKeyword(event.target.value)}
                        />
                    </label>
                    <label className="settings-filter">
                        <span>상태</span>
                        <select
                            value={invitationStatus}
                            onChange={event => setInvitationStatus(
                                event.target.value as WorkspaceInvitationStatusFilter
                            )}
                        >
                            {Object.entries(INVITATION_STATUS_LABELS).map(([value, label]) => (
                                <option key={value} value={value}>{label}</option>
                            ))}
                        </select>
                    </label>
                </div>

                {invitationFeedback && (
                    <FeedbackMessage type={invitationFeedback.type} message={invitationFeedback.message} />
                )}

                {invitationsLoading ? (
                    <p className="settings-state" role="status">초대 내역을 불러오는 중...</p>
                ) : invitationsError ? (
                    <div className="settings-state settings-state--error">
                        <FeedbackMessage type="error" message={invitationsError} />
                        <button type="button" className="settings-button" onClick={() => void loadInvitations()}>
                            다시 시도
                        </button>
                    </div>
                ) : invitations.length === 0 ? (
                    <div className="settings-state">
                        <strong>조건에 맞는 초대가 없습니다.</strong>
                        <p>다른 상태 또는 이메일로 확인해 주세요.</p>
                    </div>
                ) : (
                    <ul className="settings-invitation-list">
                        {invitations.map(invitation => {
                            const displayStatus = getInvitationDisplayStatus(invitation);
                            const isCancelling = cancellingInvitationIds.has(invitation.invitationId);

                            return (
                                <li key={invitation.invitationId} className="settings-invitation-card">
                                    <div>
                                        <strong>{invitation.email}</strong>
                                        <span>초대 {formatDate(invitation.sentAt)}</span>
                                    </div>
                                    <span className={`settings-badge settings-badge--invitation-${displayStatus.toLocaleLowerCase()}`}>
                                        {INVITATION_STATUS_LABELS[displayStatus]}
                                    </span>
                                    <span className="settings-invitation-card__expires">
                                        만료 {formatDate(invitation.expiresAt)}
                                    </span>
                                    {displayStatus === 'PENDING' && (
                                        <button
                                            type="button"
                                            className="settings-button settings-button--danger"
                                            disabled={isCancelling}
                                            onClick={() => void handleCancelInvitation(invitation)}
                                        >
                                            {isCancelling ? '취소 중...' : '초대 취소'}
                                        </button>
                                    )}
                                </li>
                            );
                        })}
                    </ul>
                )}
            </section>

            {editingMember && !isOwnerConfirmationOpen && (
                <SettingsModal
                    titleId="member-role-form-title"
                    title="제작팀 권한 변경"
                    description="전문 역할은 유지하고 제작팀 안에서의 관리 권한만 변경합니다."
                    onRequestClose={closeEditableModal}
                >
                    <form className="settings-form" onSubmit={handleRoleSubmit}>
                        {modalError && <FeedbackMessage type="error" message={modalError} />}
                        <p className="settings-form__subject">
                            <strong>{editingMember.name}</strong>
                            <span>{editingMember.email}</span>
                        </p>
                        <div className="settings-field">
                            <label htmlFor="member-workspace-role">제작팀 권한</label>
                            <select
                                data-autofocus
                                id="member-workspace-role"
                                value={selectedWorkspaceRole}
                                disabled={isSubmitting}
                                onChange={event => setSelectedWorkspaceRole(
                                    event.target.value as WorkspaceRole
                                )}
                            >
                                {Object.entries(WORKSPACE_ROLE_LABELS).map(([value, label]) => (
                                    <option
                                        key={value}
                                        value={value}
                                        disabled={editingMember.workspaceRole === 'OWNER'
                                            && value !== 'OWNER'
                                            && (activeOwnerCount === null || activeOwnerCount <= 1)
                                        }
                                    >
                                        {label}
                                    </option>
                                ))}
                            </select>
                        </div>
                        {editingMember.workspaceRole === 'OWNER'
                            && isCheckingOwnerConstraint && (
                            <p className="settings-form__notice" role="status">
                                소유자 권한 상태를 확인하고 있습니다.
                            </p>
                        )}
                        {isEditingLastOwner && (
                            <FeedbackMessage
                                type="warning"
                                message="제작팀에는 소유자가 한 명 이상 필요합니다. 다른 멤버를 소유자로 지정한 뒤 권한을 변경해 주세요."
                            />
                        )}
                        <p className="settings-form__notice">
                            소유자 권한은 다른 소유자만 부여할 수 있으며 제작팀에는 활동 중인 소유자가 한 명 이상 필요합니다.
                        </p>
                        <div className="settings-form__actions">
                            <button type="button" className="settings-button" disabled={isSubmitting} onClick={closeEditableModal}>취소</button>
                            <button type="submit" className="settings-button settings-button--primary" disabled={isSubmitting || isCheckingOwnerConstraint || isEditingLastOwner || !roleFormDirty}>
                                {isCheckingOwnerConstraint
                                    ? '확인 중...'
                                    : isSubmitting ? '저장 중...' : '변경 저장'
                                }
                            </button>
                        </div>
                    </form>
                </SettingsModal>
            )}

            {editingMember && isOwnerConfirmationOpen && (
                <SettingsModal
                    titleId="owner-role-confirmation-title"
                    title={isOwnerPromotion
                        ? '소유자 권한을 부여할까요?'
                        : '소유자 권한을 해제할까요?'
                    }
                    description="제작팀의 핵심 관리 권한이 바뀌는 작업입니다. 대상을 다시 확인해 주세요."
                    onRequestClose={() => {
                        if (!isSubmitting) {
                            setIsOwnerConfirmationOpen(false);
                            setOwnerConfirmationEmail('');
                            setModalError(null);
                        }
                    }}
                >
                    <form
                        className={`settings-form settings-owner-confirmation settings-owner-confirmation--${isOwnerPromotion ? 'promotion' : 'demotion'}`}
                        onSubmit={handleOwnerConfirmationSubmit}
                        noValidate
                    >
                        <div className="settings-owner-confirmation__warning">
                            <span aria-hidden="true">{isOwnerPromotion ? '👑' : '⚠️'}</span>
                            <div>
                                <strong>
                                    {WORKSPACE_ROLE_LABELS[editingMember.workspaceRole]}
                                    {' → '}
                                    {WORKSPACE_ROLE_LABELS[selectedWorkspaceRole]}
                                </strong>
                                <p>
                                    {isOwnerPromotion
                                        ? `${editingMember.name} 님은 다른 멤버의 권한 변경과 소유자 지정 등 제작팀의 모든 관리 권한을 갖게 됩니다.`
                                        : `${editingMember.name} 님은 더 이상 다른 멤버의 권한과 소유자를 관리할 수 없습니다.`
                                    }
                                </p>
                            </div>
                        </div>

                        {!isOwnerPromotion && editingMember.userId === user?.userId && (
                            <FeedbackMessage
                                type="warning"
                                message="변경 후에는 다른 소유자만 소유자 권한을 다시 부여할 수 있습니다."
                            />
                        )}

                        {modalError && <FeedbackMessage type="error" message={modalError} />}

                        <div className="settings-field">
                            <label htmlFor="owner-confirmation-email">
                                확인을 위해 <strong>{editingMember.email}</strong>을 입력해 주세요.
                            </label>
                            <input
                                ref={ownerConfirmationRef}
                                data-autofocus
                                id="owner-confirmation-email"
                                type="email"
                                value={ownerConfirmationEmail}
                                autoComplete="off"
                                spellCheck={false}
                                disabled={isSubmitting}
                                onChange={event => {
                                    setOwnerConfirmationEmail(event.target.value);
                                    setModalError(null);
                                }}
                            />
                        </div>

                        <div className="settings-form__actions">
                            <button
                                type="button"
                                className="settings-button"
                                disabled={isSubmitting}
                                onClick={() => {
                                    setIsOwnerConfirmationOpen(false);
                                    setOwnerConfirmationEmail('');
                                    setModalError(null);
                                }}
                            >
                                돌아가기
                            </button>
                            <button
                                type="submit"
                                className={isOwnerPromotion
                                    ? 'settings-button settings-button--owner-promotion'
                                    : 'settings-button settings-button--danger'
                                }
                                disabled={isSubmitting || !ownerConfirmationMatches}
                            >
                                {isSubmitting
                                    ? '변경 중...'
                                    : isOwnerPromotion
                                        ? '소유자로 변경'
                                        : '소유자 권한 해제'
                                }
                            </button>
                        </div>
                    </form>
                </SettingsModal>
            )}

            {removingMember && (
                <SettingsModal
                    titleId="member-remove-title"
                    title={isRemovingOwner
                        ? '소유자를 제작팀에서 제외할까요?'
                        : '제작팀에서 멤버 제외'
                    }
                    description={isRemovingOwner
                        ? '제작팀의 핵심 관리 권한과 접근을 함께 중단하는 작업입니다.'
                        : '멤버의 과거 작업 이력은 유지되고 제작팀 접근만 중단됩니다.'
                    }
                    onRequestClose={() => {
                        if (!isSubmitting) {
                            setRemovingMember(null);
                            setOwnerRemovalEmail('');
                            setModalError(null);
                        }
                    }}
                >
                    <div className={isRemovingOwner
                        ? 'settings-confirmation settings-owner-confirmation settings-owner-confirmation--demotion'
                        : 'settings-confirmation'
                    }>
                        {modalError && <FeedbackMessage type="error" message={modalError} />}
                        {isRemovingOwner ? (
                            <>
                                <div className="settings-owner-confirmation__warning">
                                    <span aria-hidden="true">⚠️</span>
                                    <div>
                                        <strong>소유자 → 제외됨</strong>
                                        <p>
                                            {removingMember.name} 님은 즉시 제작팀 접근과 모든 관리 권한을 잃게 됩니다. 과거 작업 이력은 유지됩니다.
                                        </p>
                                    </div>
                                </div>
                                <div className="settings-field">
                                    <label htmlFor="owner-removal-email">
                                        확인을 위해 <strong>{removingMember.email}</strong>을 입력해 주세요.
                                    </label>
                                    <input
                                        ref={ownerRemovalRef}
                                        data-autofocus
                                        id="owner-removal-email"
                                        type="email"
                                        value={ownerRemovalEmail}
                                        autoComplete="off"
                                        spellCheck={false}
                                        disabled={isSubmitting}
                                        onChange={event => {
                                            setOwnerRemovalEmail(event.target.value);
                                            setModalError(null);
                                        }}
                                    />
                                </div>
                            </>
                        ) : (
                            <>
                                <p><strong>{removingMember.name}</strong> 님을 제작팀에서 제외할까요?</p>
                                <p>제외된 멤버는 새 초대를 수락하면 일반 멤버로 다시 참여할 수 있습니다.</p>
                            </>
                        )}
                        <div className="settings-form__actions">
                            <button
                                type="button"
                                className="settings-button"
                                disabled={isSubmitting}
                                onClick={() => {
                                    setRemovingMember(null);
                                    setOwnerRemovalEmail('');
                                }}
                            >
                                취소
                            </button>
                            <button
                                type="button"
                                className="settings-button settings-button--danger"
                                disabled={isSubmitting || (isRemovingOwner && !ownerRemovalMatches)}
                                onClick={() => void handleRemoveMember()}
                            >
                                {isSubmitting
                                    ? '제외 중...'
                                    : isRemovingOwner ? '소유자를 제작팀에서 제외' : '제작팀에서 제외'
                                }
                            </button>
                        </div>
                    </div>
                </SettingsModal>
            )}

            {isInviteModalOpen && (
                <SettingsModal
                    titleId="member-invite-title"
                    title="멤버 초대"
                    description="이메일로 초대하며 수락한 사용자는 일반 멤버로 참여합니다."
                    onRequestClose={closeEditableModal}
                >
                    <form className="settings-form" onSubmit={handleInviteSubmit} noValidate>
                        {modalError && <FeedbackMessage type="error" message={modalError} />}
                        <div className="settings-field">
                            <label htmlFor="member-invite-email">이메일</label>
                            <input
                                ref={inviteEmailRef}
                                data-autofocus
                                id="member-invite-email"
                                type="email"
                                value={inviteEmail}
                                maxLength={255}
                                disabled={isSubmitting}
                                aria-invalid={Boolean(inviteEmailError)}
                                aria-describedby={inviteEmailError ? 'member-invite-email-error' : undefined}
                                onChange={event => {
                                    setInviteEmail(event.target.value);
                                    setInviteEmailError('');
                                    setModalError(null);
                                }}
                            />
                            {inviteEmailError && (
                                <p id="member-invite-email-error" className="settings-field__error">{inviteEmailError}</p>
                            )}
                        </div>
                        <div className="settings-form__actions">
                            <button type="button" className="settings-button" disabled={isSubmitting} onClick={closeEditableModal}>취소</button>
                            <button type="submit" className="settings-button settings-button--primary" disabled={isSubmitting}>
                                {isSubmitting ? '초대 중...' : '초대 보내기'}
                            </button>
                        </div>
                    </form>
                </SettingsModal>
            )}
        </div>
    );
}

export default MemberManagement;
