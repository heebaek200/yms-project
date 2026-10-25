import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useParams } from 'react-router';

import {
    addProjectMembers,
    getProjectMemberCandidates,
    getProjectMemberHistories,
    getProjectMembers,
    removeProjectMember,
    transferProjectOwnership,
    updateProjectMemberPermission,
    type ProjectMemberRequestContext
} from '../api/projects/projectMembers';
import FeedbackMessage, { type FeedbackMessageType } from '../components/common/FeedbackMessage';
import ProjectAreaTabs from '../components/project-groups/ProjectAreaTabs';
import ProjectGroupModal from '../components/project-groups/ProjectGroupModal';
import ProjectDetailTabs from '../components/projects/ProjectDetailTabs';
import { useAuth } from '../contexts/AuthContext';
import { useWorkspace } from '../hooks/useWorkspace';
import { PROFESSIONAL_ROLE_LABELS } from '../professionalRoles';
import type {
    ProjectMemberCandidate,
    ProjectMemberHistoryItem,
    ProjectMemberItem,
    ProjectMemberListData,
    ProjectMemberPermission
} from '../types/project';
import './ProjectGroupPage.css';
import './ProjectsPage.css';
import './ProjectMembersPage.css';
import '../components/common/ResourceNavigationLink.css';

type Feedback = { type: FeedbackMessageType; message: string };
type ConfirmAction = { kind: 'DOWNGRADE' | 'REMOVE'; member: ProjectMemberItem };
type TransferState = { member: ProjectMemberItem; step: 1 | 2; email: string };

/** 사용자 세션과 현재 제작팀 권한을 Project Member API 문맥으로 변환합니다. */
function createRequestContext(userId: number, userName: string, workspaceRole: ProjectMemberRequestContext['workspaceRole']): ProjectMemberRequestContext {
    return { userId, userName, workspaceRole };
}

/** ISO 시각을 참여자 카드와 이력에서 읽기 쉬운 한국어 날짜로 표시합니다. */
function formatDate(value: string | null): string {
    return value ? new Date(value).toLocaleString('ko-KR') : '—';
}

/** 프로젝트 참여자 추가·권한·참여 종료·소유권 이력을 전용 화면에서 관리합니다. */
function ProjectMembersPage() {
    const { projectId: rawProjectId } = useParams();
    const projectId = Number(rawProjectId);
    const location = useLocation();
    const { user } = useAuth();
    const { currentWorkspace } = useWorkspace();
    const [data, setData] = useState<ProjectMemberListData | null>(null);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [feedback, setFeedback] = useState<Feedback | null>(null);
    const [addOpen, setAddOpen] = useState(false);
    const [candidates, setCandidates] = useState<ProjectMemberCandidate[]>([]);
    const [selectedIds, setSelectedIds] = useState<number[]>([]);
    const [permission, setPermission] = useState<ProjectMemberPermission>('EDIT');
    const [confirmAction, setConfirmAction] = useState<ConfirmAction | null>(null);
    const [transfer, setTransfer] = useState<TransferState | null>(null);
    const [historyMember, setHistoryMember] = useState<ProjectMemberItem | null>(null);
    const [histories, setHistories] = useState<ProjectMemberHistoryItem[]>([]);
    const [inactiveOpen, setInactiveOpen] = useState(false);

    const context = useMemo(() => user && currentWorkspace
        ? createRequestContext(user.userId, user.name, currentWorkspace.myRole)
        : null, [currentWorkspace, user]);

    /** 최신 참여자 상태를 다시 조회해 화면과 Mock API의 경쟁 조건 판정을 일치시킵니다. */
    const refresh = useCallback(async () => {
        if (!currentWorkspace || !context || !Number.isInteger(projectId)) return;
        setLoading(true);
        const response = await getProjectMembers(currentWorkspace.workspaceId, projectId, context);
        if (response.success) {
            setData(response.data);
        } else {
            setData(null);
            setFeedback({ type: 'error', message: response.message });
        }
        setLoading(false);
    }, [currentWorkspace, context, projectId]);

    useEffect(() => {
        void refresh();
    }, [refresh]);

    /** 참여 후보를 최신 상태로 불러오고 선택값을 초기화한 뒤 추가 모달을 엽니다. */
    async function openAdd(candidateId?: number) {
        if (!currentWorkspace || !context) return;
        setFeedback(null);
        const response = await getProjectMemberCandidates(currentWorkspace.workspaceId, projectId, context);
        if (!response.success) {
            setFeedback({ type: 'error', message: response.message });
            return;
        }
        setCandidates(response.data);
        setSelectedIds(candidateId && response.data.some(item => item.workspaceMemberId === candidateId) ? [candidateId] : []);
        setPermission('EDIT');
        setAddOpen(true);
    }

    /** 선택한 후보를 한 권한으로 일괄 추가하며 실패 시 어떤 멤버도 변경하지 않습니다. */
    async function submitAdd() {
        if (!currentWorkspace || !context || selectedIds.length === 0) return;
        setSubmitting(true);
        const response = await addProjectMembers(currentWorkspace.workspaceId, projectId, { workspaceMemberIds: selectedIds, permissionLevel: permission }, context);
        setSubmitting(false);
        if (!response.success) {
            setFeedback({ type: 'error', message: response.message });
            return;
        }

        setData(response.data);
        setAddOpen(false);
        const restored = response.data.restoredIncompleteTaskCount;
        setFeedback({ type: 'success', message: restored > 0 ? `${response.message} 미완료 작업 ${restored}건의 담당 자격이 다시 활성화되었습니다.` : response.message ?? '참여자를 추가했습니다.' });
    }

    /** 즉시 허용되는 승격 또는 확인이 끝난 강등을 최신 상태 검증과 함께 반영합니다. */
    async function changePermission(member: ProjectMemberItem, next: ProjectMemberPermission) {
        if (!currentWorkspace || !context) return;
        setSubmitting(true);
        const response = await updateProjectMemberPermission(currentWorkspace.workspaceId, projectId, member.projectMemberId, next, context);
        setSubmitting(false);
        if (!response.success) {
            setFeedback({ type: 'error', message: response.message });
            return;
        }
        setData(response.data);
        setConfirmAction(null);
        setFeedback({ type: 'success', message: response.message ?? '참여 권한을 변경했습니다.' });
    }

    /** 참여 종료 전 영향 확인 모달을 거친 대상을 비활성 상태로 전환합니다. */
    async function remove(member: ProjectMemberItem) {
        if (!currentWorkspace || !context) return;
        setSubmitting(true);
        const response = await removeProjectMember(currentWorkspace.workspaceId, projectId, member.projectMemberId, context);
        setSubmitting(false);
        if (!response.success) {
            setFeedback({ type: 'error', message: response.message });
            return;
        }
        setData(response.data);
        setConfirmAction(null);
        setFeedback({ type: 'success', message: response.message ?? '프로젝트 참여를 종료했습니다.' });
    }

    /** 대상 이메일을 다시 입력한 2단계 확인 후에만 Project 소유권을 이전합니다. */
    async function transferOwnership() {
        if (!currentWorkspace || !context || !transfer || transfer.email !== transfer.member.email) return;
        setSubmitting(true);
        const response = await transferProjectOwnership(currentWorkspace.workspaceId, projectId, transfer.member.projectMemberId, context);
        setSubmitting(false);
        if (!response.success) {
            setFeedback({ type: 'error', message: response.message });
            return;
        }
        setData(response.data);
        setTransfer(null);
        setFeedback({ type: 'success', message: response.message ?? '프로젝트 소유권을 이전했습니다.' });
    }

    /** 관리 권한 사용자에게 선택한 참여자의 기준선 이후 변경 이력을 표시합니다. */
    async function openHistory(member: ProjectMemberItem) {
        if (!currentWorkspace || !context) return;
        setHistoryMember(member);
        setHistories([]);
        const response = await getProjectMemberHistories(currentWorkspace.workspaceId, projectId, member.projectMemberId, context);
        if (response.success) setHistories(response.data);
        else setFeedback({ type: 'error', message: response.message });
    }

    if (loading) return <section className="project-area-page"><ProjectAreaTabs /><p className="project-state">참여자 정보를 불러오는 중...</p></section>;
    if (!data) return <section className="project-area-page"><ProjectAreaTabs />{feedback && <FeedbackMessage type={feedback.type} message={feedback.message} />}</section>;

    const back = (location.state as { listSearch?: string } | null)?.listSearch;
    const eligibleOwnerCount = data.activeMembers.filter(member => !member.isOwner && member.permission === 'EDIT').length;
    return (
        <section className="project-area-page project-members-page">
            <ProjectAreaTabs />
            <div className="project-detail-nav"><Link to={`/projects${back ? `?${back}` : ''}`}>← 프로젝트 목록</Link></div>
            <header className="project-members-header">
                <div><p className="project-group-eyebrow">PROJECT MEMBERS</p><h1>{data.projectTitle}</h1><p>참여 권한과 소유권, 참여 이력을 관리합니다.</p></div>
                {data.canManage && <button className="project-button project-button--primary" disabled={data.archived} title={data.archived ? '보관을 해제한 뒤 참여자를 추가할 수 있습니다.' : undefined} onClick={() => void openAdd()}>참여자 추가</button>}
            </header>
            <ProjectDetailTabs projectId={projectId} />
            {feedback && <FeedbackMessage type={feedback.type} message={feedback.message} />}
            {data.archived && <FeedbackMessage type="info" message="보관된 프로젝트입니다. 소유권 이전을 제외한 참여자 변경은 보관 해제 후 가능합니다." />}
            {data.canManage && eligibleOwnerCount === 0 && <p className="project-members-guide">소유권을 이전하려면 먼저 편집 권한 참여자를 추가하거나 기존 참여자를 편집 권한으로 변경해 주세요.</p>}

            <div className="project-member-list">
                {data.activeMembers.map(member => (
                    <MemberCard
                        key={member.projectMemberId}
                        member={member}
                        canManage={data.canManage}
                        archived={data.archived}
                        submitting={submitting}
                        onPromote={() => void changePermission(member, 'EDIT')}
                        onDowngrade={() => setConfirmAction({ kind: 'DOWNGRADE', member })}
                        onRemove={() => setConfirmAction({ kind: 'REMOVE', member })}
                        onTransfer={() => setTransfer({ member, step: 1, email: '' })}
                        onHistory={() => void openHistory(member)}
                    />
                ))}
            </div>

            {data.inactiveMembers.length > 0 && (
                <section className="project-inactive-members">
                    <button type="button" className="project-inactive-members__toggle" aria-expanded={inactiveOpen} onClick={() => setInactiveOpen(current => !current)}>
                        참여 종료 {data.inactiveMembers.length}명 <span>{inactiveOpen ? '▲' : '▼'}</span>
                    </button>
                    {inactiveOpen && <div className="project-member-list project-member-list--inactive">{data.inactiveMembers.map(member => (
                        <MemberCard key={member.projectMemberId} member={member} canManage={data.canManage} archived={data.archived} submitting={submitting} inactive onRejoin={() => void openAdd(member.workspaceMemberId)} onHistory={() => void openHistory(member)} />
                    ))}</div>}
                </section>
            )}

            {addOpen && <ProjectGroupModal titleId="project-member-add-title" title="프로젝트 참여자 추가" description="제작팀 멤버를 선택하고 모두에게 적용할 프로젝트 권한을 정합니다." onRequestClose={() => !submitting && setAddOpen(false)}>
                <div className="project-member-modal">
                    <fieldset className="project-member-permission"><legend>공통 권한</legend><label><input type="radio" name="new-member-permission" checked={permission === 'EDIT'} onChange={() => setPermission('EDIT')} /> 편집</label><label><input type="radio" name="new-member-permission" checked={permission === 'VIEW'} onChange={() => setPermission('VIEW')} /> 보기</label></fieldset>
                    <div className="project-member-candidates">{candidates.length === 0 ? <p>추가할 수 있는 제작팀 멤버가 없습니다.</p> : candidates.map(candidate => <label key={candidate.workspaceMemberId}><input type="checkbox" checked={selectedIds.includes(candidate.workspaceMemberId)} onChange={() => setSelectedIds(current => current.includes(candidate.workspaceMemberId) ? current.filter(id => id !== candidate.workspaceMemberId) : [...current, candidate.workspaceMemberId])} /><span><strong>{candidate.name}</strong><small>{candidate.email} · {candidate.professionalRoles.map(role => PROFESSIONAL_ROLE_LABELS[role]).join(', ')}</small>{candidate.rejoining && <em>기존 참여 기록 재사용{permission === 'EDIT' && candidate.incompleteTaskCount > 0 ? ` · 미완료 작업 ${candidate.incompleteTaskCount}건 자격 회복` : ''}</em>}</span></label>)}</div>
                    <div className="project-member-modal__actions"><button className="project-button" disabled={submitting} onClick={() => setAddOpen(false)}>취소</button><button className="project-button project-button--primary" disabled={submitting || selectedIds.length === 0} onClick={() => void submitAdd()}>{submitting ? '추가 중...' : `${selectedIds.length}명 추가`}</button></div>
                </div>
            </ProjectGroupModal>}

            {confirmAction && <ProjectGroupModal titleId="project-member-confirm-title" title={confirmAction.kind === 'DOWNGRADE' ? '보기 권한으로 변경' : '프로젝트 참여 종료'} description="담당 작업과 프로젝트 접근에 미치는 영향을 확인해 주세요." onRequestClose={() => !submitting && setConfirmAction(null)}>
                <div className="project-member-modal"><div className="project-member-impact"><strong>{confirmAction.member.name}</strong><p>{confirmAction.kind === 'DOWNGRADE' ? '프로젝트 내용을 더 이상 수정할 수 없습니다.' : '프로젝트 접근이 종료되지만 과거 작업과 참여 이력은 보존됩니다.'}</p>{confirmAction.kind === 'REMOVE' && confirmAction.member.userId === user?.userId && <p className="project-member-impact__warning">본인의 프로젝트 참여만 종료됩니다. 제작팀 관리 권한은 유지됩니다.</p>}{confirmAction.member.incompleteTaskCount > 0 && <p className="project-member-impact__warning">미완료 작업 {confirmAction.member.incompleteTaskCount}건에 담당자 재지정 필요 표시가 생깁니다.</p>}</div><div className="project-member-modal__actions"><button className="project-button" disabled={submitting} onClick={() => setConfirmAction(null)}>취소</button><button className="project-button project-button--danger" disabled={submitting} onClick={() => void (confirmAction.kind === 'DOWNGRADE' ? changePermission(confirmAction.member, 'VIEW') : remove(confirmAction.member))}>확인하고 변경</button></div></div>
            </ProjectGroupModal>}

            {transfer && <ProjectGroupModal titleId="project-owner-transfer-title" title="프로젝트 소유권 이전" description={currentWorkspace?.myRole === 'MEMBER' ? '이전 후 다시 변경하려면 새 소유자 또는 제작팀 관리자의 협조가 필요합니다.' : '이전 후에도 제작팀 관리 권한으로 소유권을 다시 변경할 수 있습니다.'} onRequestClose={() => !submitting && setTransfer(null)}>
                <div className="project-member-modal project-owner-transfer"><strong>{transfer.member.name} 님에게 소유권을 이전합니다.</strong>{transfer.step === 1 ? <><ul><li>새 소유자는 참여자와 프로젝트 설정을 관리할 수 있습니다.</li><li>현재 소유자는 편집 참여자로 남습니다.</li><li>보관된 프로젝트라면 보관 상태가 그대로 유지됩니다.</li></ul><div className="project-member-modal__actions"><button className="project-button" onClick={() => setTransfer(null)}>취소</button><button className="project-button project-button--danger" onClick={() => setTransfer(current => current ? { ...current, step: 2 } : null)}>계속</button></div></> : <><label><span>확인을 위해 아래 대상 이메일을 입력해 주세요.</span><strong className="project-owner-transfer__email">{transfer.member.email}</strong><input data-autofocus aria-label="대상 이메일 확인" value={transfer.email} onChange={event => setTransfer(current => current ? { ...current, email: event.target.value } : null)} /></label><div className="project-member-modal__actions"><button className="project-button" disabled={submitting} onClick={() => setTransfer(current => current ? { ...current, step: 1, email: '' } : null)}>이전</button><button className="project-button project-button--danger" disabled={submitting || transfer.email !== transfer.member.email} onClick={() => void transferOwnership()}>{submitting ? '이전 중...' : '소유권 이전'}</button></div></>}</div>
            </ProjectGroupModal>}

            {historyMember && <ProjectGroupModal titleId="project-member-history-title" title={`${historyMember.name} 님의 참여 이력`} description="최초 기준선 이후의 권한, 참여 상태와 소유권 변경 기록입니다." onRequestClose={() => setHistoryMember(null)}>
                <ol className="project-member-history">{histories.length === 0 ? <li>표시할 변경 이력이 없습니다.</li> : histories.map(history => <li key={history.historyId}><strong>{history.label}</strong><span>{history.fromPermission && history.toPermission && history.fromPermission !== history.toPermission ? `${history.fromPermission} → ${history.toPermission} · ` : ''}{history.changeSource === 'WORKSPACE_MEMBERSHIP' ? '제작팀 멤버십 · ' : ''}{formatDate(history.changedAt)} · {history.changedByName}</span></li>)}</ol>
            </ProjectGroupModal>}
        </section>
    );
}

type MemberCardProps = {
    member: ProjectMemberItem;
    canManage: boolean;
    archived: boolean;
    submitting: boolean;
    inactive?: boolean;
    onPromote?: () => void;
    onDowngrade?: () => void;
    onRemove?: () => void;
    onTransfer?: () => void;
    onRejoin?: () => void;
    onHistory: () => void;
};

/** 참여자 필드를 고정 Grid 열에 배치해 버튼 수와 무관하게 카드 간 정렬을 유지합니다. */
function MemberCard({ member, canManage, archived, submitting, inactive = false, onPromote, onDowngrade, onRemove, onTransfer, onRejoin, onHistory }: MemberCardProps) {
    const canRejoin = inactive && member.workspaceMemberStatus === 'ACTIVE';
    const workspaceInactiveMessage = member.workspaceMemberStatus === 'REMOVED'
        ? '제작팀에서 제외됨 · 다시 초대한 후 참여시킬 수 있습니다.'
        : member.workspaceMemberStatus === 'LEFT'
            ? '제작팀에서 탈퇴함 · 다시 초대한 후 참여시킬 수 있습니다.'
            : null;

    return (
        <article className={`project-member-card${inactive ? ' project-member-card--inactive' : ''}`}>
            <div className="project-member-card__identity"><strong>{member.name}</strong><span>{member.email}</span></div>
            <div className="project-member-card__roles">{member.professionalRoles.map(role => <span key={role}>{PROFESSIONAL_ROLE_LABELS[role]}</span>)}</div>
            <div className="project-member-card__access"><span className={member.isOwner ? 'project-member-badge project-member-badge--owner' : member.permission === 'EDIT' ? 'project-member-badge project-member-badge--edit' : 'project-member-badge project-member-badge--view'}>{member.isOwner ? '프로젝트 소유자' : member.permission === 'EDIT' ? '편집' : '보기'}</span>{workspaceInactiveMessage && <small className="project-member-card__workspace-state">{workspaceInactiveMessage}</small>}{member.incompleteTaskCount > 0 && <small>{inactive || member.permission === 'VIEW' ? `담당자 재지정 필요 · ${member.incompleteTaskCount}건` : `미완료 작업 ${member.incompleteTaskCount}건`}</small>}</div>
            <div className="project-member-card__date"><small>{inactive ? '참여 종료' : '최근 참여'}</small><span>{formatDate(inactive ? member.leftAt : member.joinedAt)}</span></div>
            <div className="project-member-card__actions">
                {canManage && !inactive && !member.isOwner && member.permission === 'VIEW' && <button className="project-button" disabled={archived || submitting} onClick={onPromote}>편집으로 변경</button>}
                {canManage && !inactive && !member.isOwner && member.permission === 'EDIT' && <button className="project-button" disabled={archived || submitting} onClick={onDowngrade}>보기로 변경</button>}
                {canManage && !inactive && !member.isOwner && member.permission === 'EDIT' && <button className="project-button" disabled={submitting} onClick={onTransfer}>소유권 이전</button>}
                {canManage && !inactive && <button className="project-button project-button--danger" disabled={archived || submitting || member.isOwner} title={member.isOwner ? '소유권을 먼저 이전해 주세요.' : undefined} onClick={onRemove}>{member.isOwner ? '소유자는 제외 불가' : '참여 종료'}</button>}
                {canManage && canRejoin && <button className="project-button" disabled={archived || submitting} onClick={onRejoin}>다시 참여</button>}
                {canManage && <button className="project-button" onClick={onHistory}>이력</button>}
            </div>
        </article>
    );
}

export default ProjectMembersPage;
