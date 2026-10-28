import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { Link, useBlocker, useLocation, useParams, useSearchParams } from 'react-router';

import {
    changeProjectTaskStatus,
    createProjectTask,
    deleteProjectTask,
    getProjectTask,
    getProjectTaskHistories,
    getProjectTasks,
    restoreProjectTask,
    updateProjectTask,
    type ProjectTaskRequestContext
} from '../api/projects/projectTasks';
import { getWorkspaceProject, updateWorkspaceProjectStatus } from '../api/projects/projects';
import { getWorkspaceTaskTypes } from '../api/workspaces/taskTypes';
import CompositionSafeSearchInput from '../components/common/CompositionSafeSearchInput';
import FeedbackMessage, { type FeedbackMessageType } from '../components/common/FeedbackMessage';
import FilterResetButton from '../components/common/FilterResetButton';
import ProjectGroupModal from '../components/project-groups/ProjectGroupModal';
import ProjectDetailHeader from '../components/projects/ProjectDetailHeader';
import { useAuth } from '../contexts/AuthContext';
import { useWorkspace } from '../hooks/useWorkspace';
import { registerUnsavedChangesGuard } from '../navigation/unsavedChangesGuard';
import type { ProjectDetailResponse } from '../types/project';
import type { ProjectTask, ProjectTaskHistory, SaveProjectTaskRequest, TaskStatus } from '../types/projectTask';
import type { WorkspaceTaskType } from '../types/workspaceSettings';
import { formatMoney, normalizeEditableMoneyInput, toEditableMoneyValue } from '../utils/decimal';
import './ProjectGroupPage.css';
import './ProjectsPage.css';
import './ProjectTasksPage.css';

type Feedback = { type: FeedbackMessageType; message: string };
type TaskForm = SaveProjectTaskRequest & { taskId: number | null; expectedVersion: number | null };

const STATUS_LABELS: Record<TaskStatus, string> = {
    WAITING: '대기',
    PROGRESS: '진행 중',
    REVIEW: '검토 중',
    COMPLETED: '완료'
};
const TASK_STATUS_ORDER: readonly TaskStatus[] = ['WAITING', 'PROGRESS', 'REVIEW', 'COMPLETED'];
const HISTORY_LABELS: Record<ProjectTaskHistory['eventType'], string> = {
    CREATED: '생성',
    UPDATED: '정보 수정',
    STATUS_CHANGED: '상태 변경',
    REJECTED: '반려',
    DELETED: '삭제',
    RESTORED: '복원'
};

/** 빈 작업 폼을 현재 선택 가능한 종류와 담당자 기준으로 초기화합니다. */
function createEmptyForm(taskTypeId = 0, assigneeProjectMemberId = 0): TaskForm {
    return { taskId: null, expectedVersion: null, taskTypeId, assigneeProjectMemberId, content: '', startDate: '', endDate: '', workerAmount: '0' };
}

/** 날짜 한 개 또는 범위를 목록 카드에 같은 규칙으로 표시합니다. */
function formatSchedule(startDate: string | null, endDate: string | null): string {
    if (startDate && endDate) return startDate === endDate ? startDate : `${startDate} ~ ${endDate}`;
    return startDate ?? endDate ?? '일정 미정';
}

/** 작업 카드와 변경 이력에서 동일한 색상과 표시명으로 상태를 보여줍니다. */
function TaskStatusBadge({ status }: { status: TaskStatus }) {
    return <span className={`task-status task-status--${status.toLowerCase()}`}>{STATUS_LABELS[status]}</span>;
}

/** 네 단계 전체에서 실제 상태 이동 구간과 방향만 강조해 이력의 맥락을 보여줍니다. */
function TaskStatusHistoryFlow({ fromStatus, toStatus }: { fromStatus: TaskStatus | null; toStatus: TaskStatus }) {
    const fromIndex = fromStatus ? TASK_STATUS_ORDER.indexOf(fromStatus) : -1;
    const toIndex = TASK_STATUS_ORDER.indexOf(toStatus);
    const accessibleLabel = fromStatus
        ? `${STATUS_LABELS[fromStatus]}에서 ${STATUS_LABELS[toStatus]}로 이동`
        : `최초 상태 ${STATUS_LABELS[toStatus]}`;

    return <div className="project-task-history__transition">
        {!fromStatus && <small>최초 상태</small>}
        <div className="project-task-history__status-flow" role="img" aria-label={accessibleLabel}>
            {TASK_STATUS_ORDER.map((status, index) => {
                const relevant = index === fromIndex || index === toIndex;
                const connectorActive = fromStatus !== null
                    && index < TASK_STATUS_ORDER.length - 1
                    && index === Math.min(fromIndex, toIndex);
                const direction = connectorActive && fromIndex > toIndex ? 'backward' : 'forward';

                return <span className="project-task-history__status-step" key={status} aria-hidden="true">
                    <span className={`task-status${relevant ? ` task-status--${status.toLowerCase()}` : ' task-status--muted'}`}>{STATUS_LABELS[status]}</span>
                    {index < TASK_STATUS_ORDER.length - 1 && <span className={`project-task-history__connector${connectorActive ? ` project-task-history__connector--active project-task-history__connector--${direction}` : ''}`} />}
                </span>;
            })}
        </div>
    </div>;
}

/** 사용자·제작팀 상태를 작업 API의 명시적인 요청 문맥으로 변환합니다. */
function createContext(userId: number, userName: string, workspaceRole: ProjectTaskRequestContext['workspaceRole']): ProjectTaskRequestContext {
    return { userId, userName, workspaceRole };
}

/** 프로젝트 작업 목록·상태·삭제 이력을 별도 탭에서 관리합니다. */
function ProjectTasksPage() {
    const { projectId: rawProjectId } = useParams();
    const projectId = Number(rawProjectId);
    const location = useLocation();
    const { user } = useAuth();
    const { currentWorkspace } = useWorkspace();
    const [searchParams, setSearchParams] = useSearchParams();
    const [project, setProject] = useState<ProjectDetailResponse | null>(null);
    const [taskTypes, setTaskTypes] = useState<WorkspaceTaskType[]>([]);
    const [tasks, setTasks] = useState<ProjectTask[]>([]);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [feedback, setFeedback] = useState<Feedback | null>(null);
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [deletedOpen, setDeletedOpen] = useState(searchParams.get('deletedState') === 'DELETED');
    const [deletedCount, setDeletedCount] = useState(0);
    const [form, setForm] = useState<TaskForm | null>(null);
    const initialFormRef = useRef<TaskForm | null>(null);
    const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
    const [historyTask, setHistoryTask] = useState<ProjectTask | null>(null);
    const [histories, setHistories] = useState<ProjectTaskHistory[]>([]);
    const [rejectionTask, setRejectionTask] = useState<ProjectTask | null>(null);
    const [rejectionReason, setRejectionReason] = useState('');
    const [rejectionReasonError, setRejectionReasonError] = useState('');
    const [dueDateConfirmationOpen, setDueDateConfirmationOpen] = useState(false);
    const [deletionTask, setDeletionTask] = useState<ProjectTask | null>(null);
    const [uploadPromptOpen, setUploadPromptOpen] = useState(false);
    const latestTaskRequestIdRef = useRef(0);
    const allowSuccessfulSaveNavigationRef = useRef(false);

    const context = useMemo(() => user && currentWorkspace
        ? createContext(user.userId, user.name, currentWorkspace.myRole)
        : null, [currentWorkspace, user]);
    const activeMembers = useMemo(() => project?.members.filter(member => member.active && member.permission === 'EDIT') ?? [], [project]);
    /** 작업 추가 UI도 API와 같은 Workspace 역할·Project 참여 권한으로 노출 여부를 판정합니다. */
    const canManageTasks = useMemo(() => {
        if (!project || !user || !currentWorkspace || project.archivedAt) return false;
        if (currentWorkspace.myRole !== 'MEMBER') return true;
        return project.members.some(member => (
            member.userId === user.userId
            && member.active
            && member.permission === 'EDIT'
        ));
    }, [currentWorkspace, project, user]);
    const formDirty = form !== null && JSON.stringify(form) !== JSON.stringify(initialFormRef.current);
    const directTaskId = Number(searchParams.get('taskId')) || null;
    const requestedPage = Math.max(1, Number(searchParams.get('page')) || 1);
    const requestedDeletionState = searchParams.get('deletedState');
    const blocker = useBlocker(({ currentLocation, nextLocation }) => !allowSuccessfulSaveNavigationRef.current && formDirty
        && (currentLocation.pathname !== nextLocation.pathname || currentLocation.search !== nextLocation.search));

    /** 앱 내부 Route 이동이 막히면 변경 폐기 여부를 한 번 확인하고 선택에 따라 진행하거나 유지합니다. */
    useEffect(() => {
        if (blocker.state !== 'blocked') return;
        if (window.confirm('저장하지 않은 변경사항이 있습니다. 변경사항을 버리고 이동할까요?')) blocker.proceed();
        else blocker.reset();
    }, [blocker]);

    /** Header·제작팀 전환과 브라우저 새로고침에서도 같은 미저장 변경 보호 규칙을 적용합니다. */
    useEffect(() => {
        if (!formDirty) return;
        const unregister = registerUnsavedChangesGuard(() => window.confirm('저장하지 않은 변경사항이 있습니다. 변경사항을 버리고 이동할까요?'));
        const handleBeforeUnload = (event: BeforeUnloadEvent) => event.preventDefault();
        window.addEventListener('beforeunload', handleBeforeUnload);
        return () => {
            unregister();
            window.removeEventListener('beforeunload', handleBeforeUnload);
        };
    }, [formDirty]);

    /** 현재 URL 필터로 작업 목록을 다시 조회하고 anchor가 있으면 해당 페이지를 선택합니다. */
    const refreshTasks = useCallback(async (requestedPage: number) => {
        if (!currentWorkspace || !context || !Number.isInteger(projectId)) return;
        const requestId = ++latestTaskRequestIdRef.current;
        const response = await getProjectTasks(currentWorkspace.workspaceId, projectId, {
            keyword: searchParams.get('keyword') ?? '',
            taskTypeId: Number(searchParams.get('taskTypeId')) || null,
            assigneeProjectMemberId: Number(searchParams.get('assigneeProjectMemberId')) || null,
            status: (searchParams.get('status') as TaskStatus | 'ALL' | null) ?? 'ALL',
            mineOnly: searchParams.get('mineOnly') === 'true',
            deletedState: deletedOpen ? 'DELETED' : 'ACTIVE',
            anchorTaskId: Number(searchParams.get('taskId')) || null,
            page: requestedPage,
            size: 20
        }, context);
        if (requestId !== latestTaskRequestIdRef.current) return;
        if (!response.success) {
            setFeedback({ type: 'error', message: response.message });
            return;
        }
        setTasks(response.data.items);
        setPage(response.data.page);
        setTotalPages(response.data.totalPages);
        if (deletedOpen) setDeletedCount(response.data.totalCount);
        else {
            const deletedResponse = await getProjectTasks(currentWorkspace.workspaceId, projectId, { deletedState: 'DELETED', page: 1, size: 20 }, context);
            if (requestId !== latestTaskRequestIdRef.current) return;
            if (deletedResponse.success) setDeletedCount(deletedResponse.data.totalCount);
        }
        if (response.data.filtersOverridden) {
            const next = new URLSearchParams(searchParams);
            ['keyword', 'taskTypeId', 'assigneeProjectMemberId', 'status', 'mineOnly'].forEach(name => next.delete(name));
            setSearchParams(next, { replace: true });
            setFeedback({ type: 'info', message: '요청한 작업을 표시하기 위해 작업 필터를 초기화했습니다.' });
        }
    }, [context, currentWorkspace, deletedOpen, projectId, searchParams, setSearchParams]);

    /** Project 기본 정보와 작업 종류는 Workspace·Project가 바뀔 때만 다시 불러옵니다. */
    useEffect(() => {
        if (!currentWorkspace || !context || !Number.isInteger(projectId)) return;
        let cancelled = false;
        async function load() {
            setLoading(true);
            const [projectResponse, typeResponse] = await Promise.all([
                getWorkspaceProject(currentWorkspace!.workspaceId, projectId, context!),
                getWorkspaceTaskTypes(currentWorkspace!.workspaceId, { activeOnly: false })
            ]);
            if (cancelled) return;
            if (!projectResponse.success) {
                setProject(null);
                setFeedback({ type: 'error', message: projectResponse.message });
                setLoading(false);
                return;
            }
            setProject(projectResponse.data);
            if (typeResponse.success) setTaskTypes(typeResponse.data);
            if (!cancelled) setLoading(false);
        }
        void load();
        return () => { cancelled = true; };
    }, [context, currentWorkspace, projectId]);

    /** taskId 직접 진입만 별도로 조회해 일반 검색 Query 변경이 화면 전체 초기화를 일으키지 않게 합니다. */
    useEffect(() => {
        if (!currentWorkspace || !context || !directTaskId || !Number.isInteger(projectId)) return;
        let cancelled = false;
        void getProjectTask(currentWorkspace.workspaceId, projectId, directTaskId, context).then(response => {
            if (cancelled) return;
            if (!response.success) {
                setFeedback({ type: 'warning', message: '요청한 작업을 확인할 수 없습니다.' });
                return;
            }

            const deleted = Boolean(response.data.deletedAt);
            setDeletedOpen(deleted);
            if ((deleted && requestedDeletionState !== 'DELETED') || (!deleted && requestedDeletionState === 'DELETED')) {
                setSearchParams(current => {
                    const next = new URLSearchParams(current);
                    if (deleted) next.set('deletedState', 'DELETED');
                    else next.delete('deletedState');
                    return next;
                }, { replace: true });
            }
        });
        return () => { cancelled = true; };
    }, [context, currentWorkspace, directTaskId, projectId, requestedDeletionState, setSearchParams]);

    useEffect(() => {
        if (!loading) void refreshTasks(requestedPage);
    }, [deletedOpen, loading, refreshTasks, requestedPage]);

    /** 직접 링크로 조회된 작업 카드가 화면에 들어오도록 목록 갱신 뒤 부드럽게 이동합니다. */
    useEffect(() => {
        const taskId = Number(searchParams.get('taskId'));
        if (!taskId || !tasks.some(task => task.taskId === taskId)) return;
        document.getElementById(`task-${taskId}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, [searchParams, tasks]);

    /** 필터 하나를 URL에 저장하고 페이지·직접 진입 anchor를 초기화합니다. */
    function setFilter(name: string, value: string) {
        const next = new URLSearchParams(searchParams);
        if (value && value !== 'ALL') next.set(name, value);
        else next.delete(name);
        next.delete('taskId');
        next.delete('page');
        setSearchParams(next, { replace: true });
        setPage(1);
    }

    /** 사용자가 페이지를 이동하면 직접 진입 anchor를 해제하고 새 페이지를 URL의 단일 상태로 저장합니다. */
    function moveToPage(nextPage: number) {
        const next = new URLSearchParams(searchParams);
        next.delete('taskId');
        if (nextPage > 1) next.set('page', String(nextPage));
        else next.delete('page');
        setSearchParams(next);
    }

    /** 새 작업 또는 선택 작업의 값을 모달 폼으로 준비합니다. */
    function openForm(task?: ProjectTask) {
        setFieldErrors({});
        setFeedback(null);
        if (!task) {
            const type = taskTypes.find(item => item.active);
            const member = activeMembers[0];
            const nextForm = createEmptyForm(type?.taskTypeId, member ? projectId * 100_000 + member.workspaceMemberId : 0);
            initialFormRef.current = nextForm;
            setForm(nextForm);
            return;
        }
        const nextForm = { taskId: task.taskId, expectedVersion: task.version, taskTypeId: task.taskTypeId, assigneeProjectMemberId: task.assigneeProjectMemberId, content: task.content ?? '', startDate: task.startDate ?? '', endDate: task.endDate ?? '', workerAmount: task.workerAmount ? toEditableMoneyValue(task.workerAmount) : '0' };
        initialFormRef.current = nextForm;
        setForm(nextForm);
    }

    /** 변경된 폼을 닫을 때만 폐기 확인을 표시하고 취소하면 입력을 그대로 유지합니다. */
    function closeForm() {
        if (formDirty && !window.confirm('저장하지 않은 변경사항이 있습니다. 입력 내용을 버릴까요?')) return;
        setForm(null);
        initialFormRef.current = null;
    }

    /** 금액을 blur 시점에 입력용 문자열로 정규화하되 저장용 소수 자릿수는 노출하지 않습니다. */
    function normalizeAmount() {
        if (!form) return;
        const result = normalizeEditableMoneyInput(form.workerAmount);
        if (result.success) {
            setForm({ ...form, workerAmount: result.value });
            setFieldErrors(current => ({ ...current, workerAmount: '' }));
            return;
        }
        setFieldErrors(current => ({ ...current, workerAmount: result.message }));
    }

    /** 확인을 마친 생성·수정 요청을 실행하고 저장된 카드로 직접 이동합니다. */
    async function persistForm() {
        if (!form || !currentWorkspace || !context) return;
        setSubmitting(true);
        const response = form.taskId === null
            ? await createProjectTask(currentWorkspace.workspaceId, projectId, form, context)
            : await updateProjectTask(currentWorkspace.workspaceId, projectId, form.taskId, { ...form, expectedVersion: form.expectedVersion! }, context);
        setSubmitting(false);
        if (!response.success) {
            if (response.errorCode === 'TASK_VERSION_CONFLICT') {
                setForm(null);
                initialFormRef.current = null;
                setDueDateConfirmationOpen(false);
                setFeedback({ type: 'error', message: '다른 사용자가 먼저 변경했습니다. 최신 내용을 다시 불러왔습니다.' });
                await refreshTasks(page);
                return;
            }
            setFieldErrors(Object.fromEntries((response.errors ?? []).map(error => [error.field, error.reason])));
            // 확인 모달에서 서버 검증 오류가 발생하면 입력 화면으로 돌아가 해당 필드를 바로 수정하게 합니다.
            if (response.errors?.length) setDueDateConfirmationOpen(false);
            if (!response.errors?.length) setFeedback({ type: 'error', message: response.message });
            return;
        }
        setForm(null);
        initialFormRef.current = null;
        setDueDateConfirmationOpen(false);
        const next = new URLSearchParams(searchParams);
        next.set('taskId', String(response.data.task.taskId));
        // 저장 성공으로 발생한 Query 이동은 닫힘 상태가 렌더링되기 전이라도 미저장 이탈로 취급하지 않습니다.
        allowSuccessfulSaveNavigationRef.current = true;
        setSearchParams(next, { replace: true });
        window.setTimeout(() => {
            allowSuccessfulSaveNavigationRef.current = false;
        }, 0);
        setFeedback({ type: 'success', message: response.message ?? '작업을 저장했습니다.' });
        await refreshTasks(1);
    }

    /** 날짜 범위 자체를 먼저 검증한 뒤 Project 마감일 초과만 별도 확인 단계로 보냅니다. */
    function submitForm(event: FormEvent) {
        event.preventDefault();
        if (!form || !project) return;
        if (form.startDate && form.endDate && form.startDate > form.endDate) {
            setDueDateConfirmationOpen(false);
            setFieldErrors(current => ({
                ...current,
                endDate: '시작일은 종료일보다 늦을 수 없습니다.'
            }));
            return;
        }
        if (form.endDate && project.dueDate && form.endDate > project.dueDate) {
            setDueDateConfirmationOpen(true);
            return;
        }
        void persistForm();
    }

    /** 상태 전이 성공 후 마지막 활성 작업이면 Project 업로드 완료 전환을 선택적으로 제안합니다. */
    async function changeStatus(task: ProjectTask, status: TaskStatus, reason?: string) {
        if (!currentWorkspace || !context) return;
        setSubmitting(true);
        const response = await changeProjectTaskStatus(currentWorkspace.workspaceId, projectId, task.taskId, { status, rejectionReason: reason, expectedVersion: task.version }, context);
        setSubmitting(false);
        if (!response.success) {
            const rejectionError = response.errors?.find(error => error.field === 'rejectionReason');
            if (rejectionError) setRejectionReasonError(rejectionError.reason);
            setFeedback({ type: 'error', message: response.message });
            await refreshTasks(page);
            return;
        }
        setRejectionTask(null);
        setRejectionReason('');
        setRejectionReasonError('');
        setFeedback({ type: 'success', message: response.message ?? '상태를 변경했습니다.' });
        await refreshTasks(page);
        if (response.data.suggestProjectUpload && project) setUploadPromptOpen(true);
    }

    /** 반려 모달의 입력과 오류를 함께 초기화해 다음 작업에 이전 값이 남지 않게 합니다. */
    function closeRejectionModal() {
        setRejectionTask(null);
        setRejectionReason('');
        setRejectionReasonError('');
    }

    /** 공백을 제외한 반려 사유를 화면에서 먼저 검증한 뒤 상태 변경을 요청합니다. */
    function submitRejection() {
        if (!rejectionTask) return;
        const reason = rejectionReason.trim();
        if (!reason) {
            setRejectionReasonError('반려 사유를 입력해 주세요.');
            return;
        }
        setRejectionReasonError('');
        void changeStatus(rejectionTask, 'PROGRESS', reason);
    }

    /** 마지막 작업 완료 안내에서 사용자가 선택한 경우에만 Project를 업로드 완료로 전환합니다. */
    async function completeProjectUpload() {
        if (!currentWorkspace || !context || !project) return;
        setSubmitting(true);
        const updated = await updateWorkspaceProjectStatus(currentWorkspace.workspaceId, projectId, 'UPLOADED', context);
        setSubmitting(false);
        setUploadPromptOpen(false);
        if (updated.success) {
            setProject(updated.data);
            setFeedback({ type: 'success', message: '프로젝트를 업로드 완료 상태로 전환했습니다.' });
        } else setFeedback({ type: 'error', message: updated.message });
    }

    /** 삭제·복원 영향 모달에서 승인한 작업을 최신 version 검증과 함께 반영합니다. */
    async function confirmDeletion(task: ProjectTask) {
        if (!currentWorkspace || !context) return;
        const restoring = Boolean(task.deletedAt);
        const response = restoring
            ? await restoreProjectTask(currentWorkspace.workspaceId, projectId, task.taskId, { expectedVersion: task.version }, context)
            : await deleteProjectTask(currentWorkspace.workspaceId, projectId, task.taskId, { expectedVersion: task.version }, context);
        if (!response.success) setFeedback({ type: 'error', message: response.message });
        else setFeedback({ type: 'success', message: response.message ?? (restoring ? '복원했습니다.' : '삭제했습니다.') });
        setDeletionTask(null);
        await refreshTasks(page);
    }

    /** 선택 작업의 통합 이력을 불러와 읽기 전용 모달을 엽니다. */
    async function openHistory(task: ProjectTask) {
        if (!currentWorkspace || !context) return;
        const response = await getProjectTaskHistories(currentWorkspace.workspaceId, projectId, task.taskId, context);
        if (!response.success) {
            setFeedback({ type: 'error', message: response.message });
            return;
        }
        setHistories(response.data);
        setHistoryTask(task);
    }

    if (loading) return <section className="project-area-page"><p>작업을 불러오는 중입니다.</p></section>;
    if (!project) return <section className="project-area-page"><FeedbackMessage type="error" message={feedback?.message ?? '프로젝트를 확인할 수 없습니다.'} /><Link to="/projects">프로젝트 목록으로</Link></section>;

    const back = (location.state as { listSearch?: string } | null)?.listSearch;
    return (
        <section className="project-area-page project-tasks-page">
            <ProjectDetailHeader projectId={projectId} title={project.title} channelName={project.channelName} ownerName={project.ownerName} status={project.status} listSearch={back} />
            {project.archivedAt && <FeedbackMessage type="info" message="보관된 프로젝트의 작업은 조회만 할 수 있습니다." />}
            {feedback && <FeedbackMessage type={feedback.type} message={feedback.message} />}

            <details className="project-task-guide">
                <summary>작업 흐름 안내</summary>
                <div className="project-task-guide__body">
                    <ol className="project-task-guide__flow" aria-label="작업 상태 진행 순서">
                        <li><span className="task-status task-status--waiting">대기</span><small>작업 시작</small></li>
                        <li><span className="task-status task-status--progress">진행 중</span><small>검토 요청</small></li>
                        <li><span className="task-status task-status--review">검토 중</span><small>완료 승인</small></li>
                        <li><span className="task-status task-status--completed">완료</span></li>
                    </ol>
                    <ul>
                        <li>검토 중인 작업을 반려하면 사유를 기록하고 진행 중으로 돌아갑니다.</li>
                        <li>완료를 취소하면 검토 중으로 돌아갑니다.</li>
                        <li>작업 정보는 대기와 진행 중 상태에서만 수정할 수 있습니다.</li>
                        <li>표시되는 상태 변경 버튼은 사용자의 권한과 현재 상태에 따라 달라집니다.</li>
                    </ul>
                </div>
            </details>

            <div className="project-tasks-toolbar">
                <div className="project-tasks-filters">
                    <CompositionSafeSearchInput value={searchParams.get('keyword') ?? ''} onValueChange={value => setFilter('keyword', value)} placeholder="종류·내용·담당자 검색" />
                    <select aria-label="작업 종류 필터" value={searchParams.get('taskTypeId') ?? ''} onChange={event => setFilter('taskTypeId', event.target.value)}><option value="">전체 작업 종류</option>{taskTypes.map(type => <option key={type.taskTypeId} value={type.taskTypeId}>{type.name}{type.active ? '' : ' (비활성)'}</option>)}</select>
                    <select aria-label="담당자 필터" value={searchParams.get('assigneeProjectMemberId') ?? ''} onChange={event => setFilter('assigneeProjectMemberId', event.target.value)}><option value="">전체 담당자</option>{project.members.map(member => <option key={member.workspaceMemberId} value={projectId * 100_000 + member.workspaceMemberId}>{member.name}</option>)}</select>
                    <select aria-label="상태 필터" value={searchParams.get('status') ?? 'ALL'} onChange={event => setFilter('status', event.target.value)}><option value="ALL">전체 상태</option>{Object.entries(STATUS_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>
                    <label className="project-tasks-mine"><input type="checkbox" checked={searchParams.get('mineOnly') === 'true'} onChange={event => setFilter('mineOnly', event.target.checked ? 'true' : '')} /> 내 작업만</label>
                    <FilterResetButton onClick={() => setSearchParams({}, { replace: true })} />
                </div>
                {canManageTasks && activeMembers.length > 0 && <button type="button" className="primary-button" onClick={() => openForm()}>작업 추가</button>}
            </div>

            <div className="project-task-list">
                {tasks.length === 0 ? <div className="projects-empty"><strong>{deletedOpen ? '삭제된 작업이 없습니다.' : '조건에 맞는 작업이 없습니다.'}</strong></div> : tasks.map(task => (
                    <article key={task.taskId} id={`task-${task.taskId}`} className={`project-task-card${task.deletedAt ? ' project-task-card--deleted' : ''}${Number(searchParams.get('taskId')) === task.taskId ? ' project-task-card--anchored' : ''}`}>
                        <div className="project-task-card__main">
                            <div className="project-task-card__title"><TaskStatusBadge status={task.status} /><h2>{task.content || task.taskTypeName}</h2>{task.content && <span className="task-type-chip">{task.taskTypeName}</span>}{task.settled && <span className="task-settled">정산 확정</span>}</div>
                            {task.latestRejectionReason && <p className="project-task-card__rejection">최근 반려 사유: {task.latestRejectionReason}</p>}
                            {task.assigneeIssue !== 'NONE' && <span className="project-task-card__warning">참여 종료 또는 권한 변경으로 담당자 재지정이 필요합니다.</span>}
                            {task.deletedAt && <span className="project-task-card__warning">{task.deletedByName} 님이 {new Date(task.deletedAt).toLocaleString('ko-KR')} 삭제</span>}
                        </div>
                        <dl className="project-task-card__meta"><div><dt>담당자</dt><dd>{task.assigneeName}</dd></div><div><dt>일정</dt><dd>{formatSchedule(task.startDate, task.endDate)}</dd></div><div><dt>지급 예정 금액</dt><dd>{task.workerAmount === undefined ? '확인 권한 없음' : `${formatMoney(task.workerAmount)}원`}</dd></div></dl>
                        <div className="project-task-card__actions">
                            {!task.deletedAt && task.canChangeStatus && task.status === 'WAITING' && <button type="button" onClick={() => void changeStatus(task, 'PROGRESS')}>작업 시작</button>}
                            {!task.deletedAt && task.canChangeStatus && task.status === 'PROGRESS' && <button type="button" onClick={() => void changeStatus(task, 'REVIEW')}>검토 요청</button>}
                            {!task.deletedAt && task.canChangeStatus && task.status === 'REVIEW' && <><button type="button" onClick={() => void changeStatus(task, 'COMPLETED')}>완료 승인</button><button type="button" onClick={() => { setRejectionTask(task); setRejectionReason(''); setRejectionReasonError(''); }}>반려</button></>}
                            {!task.deletedAt && task.canChangeStatus && task.status === 'COMPLETED' && <button type="button" onClick={() => void changeStatus(task, 'REVIEW')}>완료 취소</button>}
                            {task.canEdit && <button type="button" onClick={() => openForm(task)}>수정</button>}
                            <button type="button" onClick={() => void openHistory(task)}>이력</button>
                            {(task.canDelete || task.canRestore) && <button type="button" className="danger-text-button" onClick={() => setDeletionTask(task)}>{task.deletedAt ? '복원' : '삭제'}</button>}
                        </div>
                    </article>
                ))}
            </div>
            {totalPages > 1 && <nav className="project-task-pagination" aria-label="작업 페이지"><button type="button" disabled={page <= 1} onClick={() => moveToPage(page - 1)}>이전</button><span>{page} / {totalPages}</span><button type="button" disabled={page >= totalPages} onClick={() => moveToPage(page + 1)}>다음</button></nav>}
            <button type="button" className="deleted-task-toggle" onClick={() => { const next = !deletedOpen; setDeletedOpen(next); const params = new URLSearchParams(searchParams); if (next) params.set('deletedState', 'DELETED'); else params.delete('deletedState'); params.delete('taskId'); params.delete('page'); setSearchParams(params, { replace: true }); }}>{deletedOpen ? '활성 작업 보기' : `삭제된 작업 ${deletedCount}개`}</button>

            {form && <ProjectGroupModal titleId="task-form-title" title={dueDateConfirmationOpen ? '프로젝트 마감일을 넘습니다' : form.taskId ? '작업 수정' : '작업 추가'} description={dueDateConfirmationOpen && project.dueDate ? `프로젝트 마감일은 ${project.dueDate}, 작업 종료일은 ${form.endDate}입니다.` : '작업 종류와 담당자, 일정과 금액을 입력합니다.'} onRequestClose={() => dueDateConfirmationOpen ? setDueDateConfirmationOpen(false) : closeForm()}>{dueDateConfirmationOpen ? <div className="project-task-dialog-body"><p>일정을 다시 확인해 주세요. 그대로 저장해도 프로젝트 마감일은 변경되지 않습니다.</p><div><button type="button" onClick={() => setDueDateConfirmationOpen(false)}>돌아가기</button><button type="button" className="primary-button" disabled={submitting} onClick={() => void persistForm()}>그래도 저장</button></div></div> : <form className="project-task-form" onSubmit={event => void submitForm(event)}>
                <label>작업 종류<select data-autofocus value={form.taskTypeId} onChange={event => setForm({ ...form, taskTypeId: Number(event.target.value) })}>{taskTypes.filter(type => type.active || type.taskTypeId === form.taskTypeId).map(type => <option key={type.taskTypeId} value={type.taskTypeId}>{type.name}</option>)}</select>{fieldErrors.taskTypeId && <span>{fieldErrors.taskTypeId}</span>}</label>
                <label>담당자<select value={form.assigneeProjectMemberId} onChange={event => setForm({ ...form, assigneeProjectMemberId: Number(event.target.value) })}>{activeMembers.map(member => <option key={member.workspaceMemberId} value={projectId * 100_000 + member.workspaceMemberId}>{member.name}</option>)}</select>{fieldErrors.assigneeProjectMemberId && <span>{fieldErrors.assigneeProjectMemberId}</span>}</label>
                <label className="project-task-form__wide">작업 내용<input value={form.content ?? ''} maxLength={150} onChange={event => setForm({ ...form, content: event.target.value })} placeholder="작업 범위나 전달사항을 입력하세요" />{fieldErrors.content && <span>{fieldErrors.content}</span>}</label>
                <label>시작일<input type="date" value={form.startDate ?? ''} onChange={event => { setForm({ ...form, startDate: event.target.value }); setFieldErrors(current => ({ ...current, endDate: '' })); }} /></label>
                <label>종료일<input type="date" value={form.endDate ?? ''} onChange={event => { setForm({ ...form, endDate: event.target.value }); setFieldErrors(current => ({ ...current, endDate: '' })); }} />{fieldErrors.endDate && <span>{fieldErrors.endDate}</span>}</label>
                <label className="project-task-form__wide">지급 예정 금액<input inputMode="decimal" value={form.workerAmount} onBlur={normalizeAmount} onChange={event => setForm({ ...form, workerAmount: event.target.value })} />{fieldErrors.workerAmount && <span>{fieldErrors.workerAmount}</span>}</label>
                <div className="project-task-form__actions"><button type="button" onClick={closeForm}>취소</button><button type="submit" className="primary-button" disabled={submitting}>{submitting ? '저장 중…' : '저장'}</button></div>
            </form>}</ProjectGroupModal>}

            {deletionTask && <ProjectGroupModal titleId="task-deletion-title" title={deletionTask.deletedAt ? '작업 복원' : '작업 삭제'} description={`${deletionTask.content || deletionTask.taskTypeName} · ${deletionTask.assigneeName} · ${STATUS_LABELS[deletionTask.status]}`} onRequestClose={() => setDeletionTask(null)}><div className="project-task-dialog-body"><p>지급 예정 금액 {deletionTask.workerAmount === undefined ? '확인 권한 없음' : `${formatMoney(deletionTask.workerAmount)}원`} · 일정 {formatSchedule(deletionTask.startDate, deletionTask.endDate)}</p><p>{deletionTask.deletedAt ? '복원하면 작업 수와 예정 비용, 담당자의 미완료 작업 집계에 다시 포함됩니다.' : '삭제하면 일반 목록과 작업 수, 예정 비용, 일정 및 담당자의 미완료 작업 집계에서 제외됩니다.'}</p><div><button type="button" onClick={() => setDeletionTask(null)}>취소</button><button type="button" className="primary-button" disabled={submitting} onClick={() => void confirmDeletion(deletionTask)}>{deletionTask.deletedAt ? '복원' : '삭제'}</button></div></div></ProjectGroupModal>}

            {uploadPromptOpen && <ProjectGroupModal titleId="task-upload-complete-title" title="모든 작업이 완료되었습니다" description="영상 업로드까지 마쳤다면 프로젝트 상태도 함께 정리할 수 있습니다." onRequestClose={() => setUploadPromptOpen(false)}><div className="project-task-dialog-body"><p>프로젝트를 업로드 완료 상태로 전환하시겠습니까?</p><div><button type="button" onClick={() => setUploadPromptOpen(false)}>나중에</button><button type="button" className="primary-button" disabled={submitting} onClick={() => void completeProjectUpload()}>업로드 완료로 전환</button></div></div></ProjectGroupModal>}

            {rejectionTask && <ProjectGroupModal titleId="task-rejection-title" title="작업 반려" description="담당자가 수정 방향을 이해할 수 있도록 반려 사유를 입력해 주세요." onRequestClose={closeRejectionModal}><div className="project-task-dialog-body"><label>반려 사유<textarea data-autofocus maxLength={500} value={rejectionReason} aria-invalid={Boolean(rejectionReasonError)} aria-describedby={rejectionReasonError ? 'task-rejection-reason-error' : undefined} onChange={event => { setRejectionReason(event.target.value); if (rejectionReasonError) setRejectionReasonError(''); }} />{rejectionReasonError && <span id="task-rejection-reason-error" className="project-task-dialog-body__error">{rejectionReasonError}</span>}</label><div><button type="button" onClick={closeRejectionModal}>취소</button><button type="button" className="primary-button" disabled={submitting} onClick={submitRejection}>반려</button></div></div></ProjectGroupModal>}

            {historyTask && <ProjectGroupModal titleId="task-history-title" title="작업 이력" description={`${historyTask.taskTypeName}의 변경 기록입니다.`} onRequestClose={() => setHistoryTask(null)}><div className="project-task-history">{histories.map(history => <article key={history.historyId}>
                <header><strong>{HISTORY_LABELS[history.eventType]}</strong><time>{new Date(history.processedAt).toLocaleString('ko-KR')}</time></header>
                <p className="project-task-history__actor">{history.processedByName} 님이 처리했습니다.</p>
                {history.toStatus && <TaskStatusHistoryFlow fromStatus={history.fromStatus} toStatus={history.toStatus} />}
                {history.rejectionReason && <p className="project-task-history__reason"><strong>반려 사유</strong>{history.rejectionReason}</p>}
                {history.changedFields.map(field => <p className="project-task-history__field" key={field.field}><strong>{field.label}</strong><span>{field.previousValue ?? '없음'}</span><span aria-hidden="true">→</span><span>{field.nextValue ?? '없음'}</span></p>)}
            </article>)}</div></ProjectGroupModal>}
        </section>
    );
}

export default ProjectTasksPage;
