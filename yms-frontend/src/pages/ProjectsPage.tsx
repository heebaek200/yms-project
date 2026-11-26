import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Link, useBlocker, useLocation, useNavigate, useParams, useSearchParams } from 'react-router';
import { getWorkspaceChannels } from '../api/workspaces/channels';
import { createWorkspaceProject, deleteWorkspaceProject, getProjectGroupOptions, getWorkspaceProject, getWorkspaceProjects, setWorkspaceProjectArchived, updateWorkspaceProject, updateWorkspaceProjectStatus, type SaveProjectRequest } from '../api/projects/projects';
import {
    changeVideoContentPrimaryProject,
    connectVideoContentProject,
    createProjectVideoContent,
    createYouTubePublication,
    deleteProjectVideoContent,
    disconnectVideoContentProject,
    getVideoContentProjectCandidates,
    removeYouTubePublication,
    restoreYouTubePublication,
    syncYouTubePublication,
    updateVideoContent,
    updateYouTubePublication,
    updateYouTubePublicationRevenue
} from '../api/projects/youtube';
import CompositionSafeSearchInput from '../components/common/CompositionSafeSearchInput';
import FeedbackMessage, { type FeedbackMessageType } from '../components/common/FeedbackMessage';
import FilterResetButton from '../components/common/FilterResetButton';
import ResourceNavigationLink from '../components/common/ResourceNavigationLink';
import ProjectAreaTabs from '../components/project-groups/ProjectAreaTabs';
import ProjectGroupModal from '../components/project-groups/ProjectGroupModal';
import ProjectDetailHeader from '../components/projects/ProjectDetailHeader';
import { useAuth } from '../contexts/AuthContext';
import { useWorkspace } from '../hooks/useWorkspace';
import { registerUnsavedChangesGuard } from '../navigation/unsavedChangesGuard';
import type { DefaultRateChangeConfirmation, DuplicateYouTubeVideoLocation, PrimaryProjectChangeReasonType, ProjectAccessRole, ProjectDetailResponse, ProjectListItemResponse, ProjectRevenueOption, ProjectVideoType, VideoContentProjectCandidate, VideoContentResponse, YouTubePublicationResponse, YouTubeRemovalReason } from '../types/project';
import type { ProjectStatus } from '../types/projectGroup';
import type { WorkspaceChannelListItem } from '../types/workspaceSettings';
import { PROJECT_STATUS_LABELS } from '../projectStatuses';
import { formatMoney } from '../utils/decimal';
import { normalizeRateInput } from '../utils/format';
import './ProjectGroupPage.css';
import './ProjectsPage.css';
import '../components/common/ResourceNavigationLink.css';

type FormValues = { title: string; content: string; channelId: string; projectGroupId: string; videoType: '' | ProjectVideoType; status: ProjectStatus; dueDate: string; plannedUploadDate: string };
type Feedback = { type: FeedbackMessageType; message: string };
type Errors = Partial<Record<keyof FormValues, string>>;
type ContentFormField = 'title' | 'youtubeVideo' | 'channelId' | 'publishedAt' | 'customRevenuePerView';
type YouTubeModalState =
    | { kind: 'CONTENT_FORM'; content: VideoContentResponse | null; title: string; videoType: ProjectVideoType; youtubeVideo: string; channelId: string; publishedAt: string; revenueOption: ProjectRevenueOption; customRate: string; confirmation: DefaultRateChangeConfirmation | null; duplicateLocation: DuplicateYouTubeVideoLocation | null; fieldErrors: Partial<Record<ContentFormField, string>>; error: string | null }
    | { kind: 'PUBLICATION_FORM'; content: VideoContentResponse; publication: YouTubePublicationResponse | null; youtubeVideo: string; channelId: string; publishedAt: string; revenueOption: ProjectRevenueOption; customRate: string; confirmation: DefaultRateChangeConfirmation | null; duplicateLocation: DuplicateYouTubeVideoLocation | null; fieldError: string | null }
    | { kind: 'REVENUE_FORM'; content: VideoContentResponse; publication: YouTubePublicationResponse; revenueOption: ProjectRevenueOption; customRate: string; fieldError: string | null }
    | { kind: 'CONNECTIONS'; content: VideoContentResponse; connectedProjects: VideoContentProjectCandidate[]; candidates: VideoContentProjectCandidate[]; keyword: string; appliedKeyword: string; page: number; totalPages: number; requestId: number; readOnly: boolean; loading: boolean; error: string | null }
    | { kind: 'PRIMARY_FORM'; content: VideoContentResponse; candidates: VideoContentProjectCandidate[]; projectId: string; reasonType: PrimaryProjectChangeReasonType; reason: string; needsPerformanceConfirmation: boolean; error: string | null }
    | { kind: 'CONTENT_DELETE'; content: VideoContentResponse; error: string | null }
    | { kind: 'CONTENT_HISTORY'; content: VideoContentResponse }
    | { kind: 'PUBLICATION_HISTORY'; publication: YouTubePublicationResponse };
const STATUS_LABEL = PROJECT_STATUS_LABELS;
const EMPTY_FORM: FormValues = { title: '', content: '', channelId: '', projectGroupId: '', videoType: '', status: 'PLANNING', dueDate: '', plannedUploadDate: '' };

/** 현재 현지 시각을 datetime-local 입력값의 분 정밀도로 변환합니다. */
function currentLocalDateTimeValue(): string {
    const now = new Date();
    return new Date(now.getTime() - now.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
}

/** 저장된 ISO 시각을 datetime-local 입력값으로 변환합니다. */
function toLocalDateTimeValue(value: string | null): string {
    if (!value) return '';
    const date = new Date(value);
    return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
}

/** 오류 응답의 data가 DEFAULT 단가 영향 확인 계약인지 판별합니다. */
function isDefaultRateChangeConfirmation(value: unknown): value is DefaultRateChangeConfirmation {
    return typeof value === 'object' && value !== null
        && 'confirmationToken' in value
        && 'impacts' in value;
}

/** 오류 응답의 data가 중복 YouTube 동영상 위치 계약인지 판별합니다. */
function isDuplicateYouTubeVideoLocation(value: unknown): value is DuplicateYouTubeVideoLocation {
    return typeof value === 'object' && value !== null && 'canAccess' in value;
}

/** 새 프로젝트에서 선택 가능한 채널이 하나뿐이면 해당 채널을 초기값으로 사용합니다. */
function createProjectForm(channels: WorkspaceChannelListItem[]): FormValues {
    return {
        ...EMPTY_FORM,
        channelId: channels.length === 1 ? String(channels[0].channelId) : ''
    };
}

/** API 상세를 모달 입력 상태로 변환합니다. */
function toForm(project: ProjectDetailResponse): FormValues {
    return { title: project.title, content: project.content ?? '', channelId: String(project.channelId), projectGroupId: project.projectGroupId ? String(project.projectGroupId) : '', videoType: project.videoType, status: project.status, dueDate: project.dueDate ?? '', plannedUploadDate: project.plannedUploadDate ?? '' };
}

/** 보관 해제는 항상 허용하고 새 보관은 완료·취소 상태로 제한합니다. */
function isArchiveActionAvailable(project: ProjectDetailResponse): boolean {
    return project.archivedAt !== null
        || project.status === 'UPLOADED'
        || project.status === 'CANCELLED';
}

/** URL 필터 목록과 권한별 프로젝트 상세·수정 기능을 제공합니다. */
function ProjectsPage() {
    const { projectId: rawId } = useParams();
    const projectId = rawId ? Number(rawId) : null;
    const [params, setParams] = useSearchParams();
    const location = useLocation();
    const navigate = useNavigate();
    const { user } = useAuth();
    const { currentWorkspace } = useWorkspace();
    const [projects, setProjects] = useState<ProjectListItemResponse[]>([]);
    const [totalPages, setTotalPages] = useState(1);
    const [detail, setDetail] = useState<ProjectDetailResponse | null>(null);
    const [channels, setChannels] = useState<WorkspaceChannelListItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [feedback, setFeedback] = useState<Feedback | null>(null);
    const [modalOpen, setModalOpen] = useState(false);
    const [editingProject, setEditingProject] = useState<ProjectDetailResponse | null>(null);
    const [form, setForm] = useState<FormValues>(EMPTY_FORM);
    const [initialForm, setInitialForm] = useState<FormValues>(EMPTY_FORM);
    const [errors, setErrors] = useState<Errors>({});
    const [submitting, setSubmitting] = useState(false);
    const [youtubeModal, setYoutubeModal] = useState<YouTubeModalState | null>(null);
    const [youtubeSubmitting, setYoutubeSubmitting] = useState(false);
    const allowNavigation = useRef(false);
    const formRef = useRef<HTMLFormElement>(null);
    const latestReadRequestIdRef = useRef(0);
    const latestChannelRequestIdRef = useRef(0);
    const latestConnectionRequestIdRef = useRef(0);
    const activeViewContextRef = useRef('');
    const activeWorkspaceIdRef = useRef<number | null>(null);
    const isAdmin = currentWorkspace?.myRole !== 'MEMBER';
    const context = useMemo(() => ({ userId: user?.userId ?? 0, userName: user?.name ?? '', workspaceRole: currentWorkspace?.myRole ?? 'MEMBER' as const }), [currentWorkspace?.myRole, user]);
    const groups = currentWorkspace ? getProjectGroupOptions(currentWorkspace.workspaceId, context) : [];
    const viewContextKey = `${currentWorkspace?.workspaceId ?? 'none'}:${projectId ?? 'list'}:${params.toString()}`;
    const dirty = modalOpen && JSON.stringify(form) !== JSON.stringify(initialForm);
    const blocker = useBlocker(({ currentLocation, nextLocation }) => !allowNavigation.current && dirty && (currentLocation.pathname !== nextLocation.pathname || currentLocation.search !== nextLocation.search));

    // 응답 적용 기준을 Paint 전에 갱신해 이전 제작팀·Route 요청이 새 화면을 덮어쓰지 못하게 합니다.
    useLayoutEffect(() => {
        activeViewContextRef.current = viewContextKey;
        activeWorkspaceIdRef.current = currentWorkspace?.workspaceId ?? null;
    }, [currentWorkspace?.workspaceId, viewContextKey]);

    /** 현재 제작팀의 활성 채널을 필터와 폼에 공급합니다. */
    const loadChannels = useCallback(async () => {
        if (!currentWorkspace) return;
        const workspaceId = currentWorkspace.workspaceId;
        const requestId = ++latestChannelRequestIdRef.current;
        const response = await getWorkspaceChannels(workspaceId, { workspaceRole: currentWorkspace.myRole }, { activeOnly: true });
        if (requestId !== latestChannelRequestIdRef.current || activeWorkspaceIdRef.current !== workspaceId) return;
        setChannels(response.success ? response.data : []);
    }, [currentWorkspace]);

    /** query string을 AND 조건으로 전달해 프로젝트 목록을 조회합니다. */
    const loadList = useCallback(async () => {
        if (!currentWorkspace || projectId !== null) return;
        const requestId = ++latestReadRequestIdRef.current;
        const requestContextKey = activeViewContextRef.current;
        setDetail(null);
        setLoading(true); setError(null);
        const response = await getWorkspaceProjects(currentWorkspace.workspaceId, { view: params.get('view') === 'archived' ? 'archived' : 'active', status: (params.get('status') as ProjectStatus | 'ALL') ?? 'ALL', channelId: Number(params.get('channelId')) || null, projectGroupId: Number(params.get('projectGroupId')) || null, participation: params.get('participation') === 'MINE' ? 'MINE' : 'ALL', keyword: params.get('keyword') ?? '', page: Number(params.get('page')) || 1 }, context);
        if (requestId !== latestReadRequestIdRef.current || activeViewContextRef.current !== requestContextKey) return;
        if (response.success) {
            setProjects(response.data.items);
            setTotalPages(response.data.totalPages);
        } else setError(response.message);
        setLoading(false);
    }, [context, currentWorkspace, params, projectId]);

    /** Route ID와 사용자 권한을 적용해 프로젝트 상세를 조회합니다. */
    const loadDetail = useCallback(async () => {
        if (!currentWorkspace || projectId === null) return;
        const requestId = ++latestReadRequestIdRef.current;
        const requestContextKey = activeViewContextRef.current;
        setLoading(true); setError(null);
        const response = await getWorkspaceProject(currentWorkspace.workspaceId, projectId, context);
        if (requestId !== latestReadRequestIdRef.current || activeViewContextRef.current !== requestContextKey) return;
        if (response.success) setDetail(response.data); else { setDetail(null); setError(response.message); }
        setLoading(false);
    }, [context, currentWorkspace, projectId]);

    useEffect(() => { void loadChannels(); }, [loadChannels]);
    useEffect(() => { if (projectId === null) void loadList(); else if (Number.isInteger(projectId)) void loadDetail(); else { latestReadRequestIdRef.current += 1; setLoading(false); setError('올바르지 않은 프로젝트 주소입니다.'); } }, [loadDetail, loadList, projectId]);
    useEffect(() => { setDetail(null); setProjects([]); setFeedback(null); setModalOpen(false); setEditingProject(null); }, [currentWorkspace?.workspaceId]);
    useEffect(() => { setYoutubeModal(null); }, [currentWorkspace?.workspaceId, projectId]);
    useEffect(() => {
        if (!modalOpen || editingProject || channels.length !== 1) return;
        const channelId = String(channels[0].channelId);

        // 모달을 먼저 연 뒤 채널 조회가 끝난 경우에도 초기값과 변경 기준을 함께 맞춥니다.
        setForm(current => current.channelId ? current : { ...current, channelId });
        setInitialForm(current => current.channelId ? current : { ...current, channelId });
    }, [channels, editingProject, modalOpen]);
    useEffect(() => { allowNavigation.current = false; }, [location.pathname]);
    useLayoutEffect(() => dirty ? registerUnsavedChangesGuard(() => window.confirm('저장하지 않은 변경사항이 있습니다. 변경사항을 버리고 이동할까요?')) : undefined, [dirty]);
    useEffect(() => {
        if (blocker.state !== 'blocked') return;
        if (window.confirm('저장하지 않은 변경사항이 있습니다. 변경사항을 버리고 이동할까요?')) { setModalOpen(false); setEditingProject(null); window.setTimeout(blocker.proceed, 0); } else blocker.reset();
    }, [blocker]);
    useEffect(() => {
        if (!dirty) return;
        const handler = (event: BeforeUnloadEvent) => event.preventDefault();
        window.addEventListener('beforeunload', handler);
        return () => window.removeEventListener('beforeunload', handler);
    }, [dirty]);

    /** 단일 필터를 URL에 반영하고 페이지를 초기화합니다. */
    const setFilter = (key: string, value: string) => {
        const next = new URLSearchParams(params);
        if (value) next.set(key, value); else next.delete(key);
        if (key !== 'page') next.delete('page');
        // 검색어 입력은 현재 이력을 교체해 글자마다 브라우저 뒤로 가기 항목이 쌓이지 않게 합니다.
        setParams(next, { replace: key === 'keyword' });
    };

    /** 생성 또는 수정 모달을 확정된 초기 상태로 엽니다. */
    const openForm = useCallback((project?: ProjectDetailResponse) => {
        const values = project ? toForm(project) : createProjectForm(channels);
        setEditingProject(project ?? null); setForm(values); setInitialForm(values); setErrors({}); setFeedback(null); setModalOpen(true);
    }, [channels]);

    /** 새 프로젝트 Query를 제거해 닫기 또는 저장 이후 모달이 다시 열리지 않게 합니다. */
    const clearCreateQuery = () => {
        if (params.get('create') !== 'true') return;

        const next = new URLSearchParams(params);
        next.delete('create');

        // 미저장 확인을 이미 마친 내부 상태 정리이므로 같은 탐색을 다시 차단하지 않습니다.
        allowNavigation.current = true;
        setParams(next, { replace: true });
        window.setTimeout(() => {
            allowNavigation.current = false;
        }, 0);
    };

    /** 목록의 생성 동작도 직접 링크·새로고침이 가능한 URL 상태로 전환합니다. */
    const requestCreateForm = () => {
        const next = new URLSearchParams(params);
        next.set('create', 'true');
        setParams(next);
    };

    /**
     * `/projects?create=true` 직접 접근·새로고침에서는 생성 모달을 복원합니다.
     * 뒤로 가기 등으로 Query가 사라지면 변경 없는 생성 모달도 함께 닫아 URL과 화면을 맞춥니다.
     */
    useEffect(() => {
        // 저장 성공 직후에는 이전 create Query가 남은 중간 Render에서 모달을 다시 열지 않습니다.
        if (projectId !== null || allowNavigation.current) {
            return;
        }

        const createRequested = params.get('create') === 'true';

        if (createRequested && !modalOpen) {
            openForm();
            return;
        }

        if (!createRequested && modalOpen && editingProject === null) {
            setModalOpen(false);
            setForm(EMPTY_FORM);
            setInitialForm(EMPTY_FORM);
            setErrors({});
        }
    }, [currentWorkspace?.workspaceId, editingProject, modalOpen, openForm, params, projectId]);

    /** 변경된 필드 값을 저장하고 해당 서버 오류를 지웁니다. */
    const change = (field: keyof FormValues, value: string) => {
        setForm(current => ({ ...current, [field]: value }));
        setErrors(current => ({ ...current, [field]: undefined }));
    };

    /** 미저장 확인을 통과할 때만 모달을 닫습니다. */
    const closeForm = () => {
        if (dirty && !window.confirm('저장하지 않은 변경사항이 있습니다. 변경사항을 버리고 닫을까요?')) return;
        setModalOpen(false); setEditingProject(null); setForm(EMPTY_FORM);
        clearCreateQuery();
    };

    /** 입력값을 API 요청으로 변환해 생성 또는 수정을 수행합니다. */
    const submit = async (event: React.SubmitEvent<HTMLFormElement>) => {
        event.preventDefault();
        if (!currentWorkspace || !form.videoType) { setErrors(current => ({ ...current, videoType: '기본 콘텐츠 유형을 선택해 주세요.' })); return; }
        let confirmContentPerformanceMove = false;
        if (editingProject && isAdmin && Number(form.projectGroupId || 0) !== (editingProject.projectGroupId ?? 0)) {
            const hasFinance = [editingProject.workerAmount, editingProject.directExpenseAmount, editingProject.directRevenueAmount]
                .some(value => value !== undefined && value !== '0.00');
            const hasContentPerformance = editingProject.videoContents.some(content => (
                content.primaryProjectId === editingProject.projectId
                && content.cumulativePerformance.includedPublicationCount > 0
            ));
            if ((hasFinance || hasContentPerformance) && !window.confirm(`프로젝트 그룹을 변경할까요?\n\n${hasFinance ? '• 작업자 금액과 직접 비용·수익의 그룹 집계가 이동합니다.\n' : ''}${hasContentPerformance ? '• 이 프로젝트가 성과 집계 대상인 콘텐츠의 성과가 이동합니다.\n' : ''}그룹에 직접 등록한 비용·수익은 이동하지 않습니다.`)) return;
            confirmContentPerformanceMove = hasContentPerformance;
        }
        setSubmitting(true); setErrors({});
        const base: SaveProjectRequest = { title: form.title, content: form.content, channelId: Number(form.channelId), projectGroupId: form.projectGroupId ? Number(form.projectGroupId) : null, videoType: form.videoType, status: form.status, dueDate: form.dueDate, plannedUploadDate: form.plannedUploadDate };
        const response = editingProject ? await updateWorkspaceProject(currentWorkspace.workspaceId, editingProject.projectId, { ...base, confirmContentPerformanceMove }, context) : await createWorkspaceProject(currentWorkspace.workspaceId, base, context);
        setSubmitting(false);
        if (!response.success) {
            const next: Errors = {}; response.errors?.forEach(item => { if (item.field in EMPTY_FORM) next[item.field as keyof FormValues] = item.reason; }); setErrors(next);
            if (Object.keys(next).length === 0) setFeedback({ type: 'error', message: response.message });
            window.requestAnimationFrame(() => formRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus()); return;
        }
        setModalOpen(false); setEditingProject(null); setFeedback({ type: 'success', message: response.message ?? '프로젝트를 저장했습니다.' });
        if (editingProject) setDetail(response.data); else { allowNavigation.current = true; navigate(`/projects/${response.data.projectId}`); }
    };

    /** 보관 또는 복원 결과를 상세에 반영합니다. */
    const archive = async () => {
        if (!currentWorkspace || !detail) return;
        if (!isArchiveActionAvailable(detail)) return;
        const next = detail.archivedAt === null;
        if (!window.confirm(next ? '이 프로젝트를 보관할까요?' : '이 프로젝트를 활성 목록으로 복원할까요?')) return;
        const response = await setWorkspaceProjectArchived(currentWorkspace.workspaceId, detail.projectId, next, context);
        if (response.success) { setDetail(response.data); setFeedback({ type: 'success', message: response.message ?? '' }); } else setFeedback({ type: 'error', message: response.message });
    };

    /** 논리 삭제 안내를 확인한 뒤 목록으로 돌아갑니다. */
    const remove = async () => {
        if (!currentWorkspace || !detail) return;
        const primaryProjectReassignments: Array<{ videoContentId: number; newPrimaryProjectId: number }> = [];
        for (const content of detail.videoContents.filter(item => item.primaryProjectId === detail.projectId)) {
            const candidates = content.connectedProjectIds.filter(candidateId => candidateId !== detail.projectId);
            if (candidates.length === 1) {
                if (!window.confirm(`${content.title} 콘텐츠의 성과 집계 프로젝트를 #${candidates[0]}로 이전하고 삭제할까요?`)) return;
                primaryProjectReassignments.push({ videoContentId: content.videoContentId, newPrimaryProjectId: candidates[0] });
            } else if (candidates.length > 1) {
                const selected = Number(window.prompt(`${content.title} 콘텐츠의 새 성과 집계 프로젝트 ID를 입력해 주세요.\n선택 가능: ${candidates.join(', ')}`, String(candidates[0])));
                if (!candidates.includes(selected)) {
                    setFeedback({ type: 'error', message: '연결된 프로젝트 중에서 새 성과 집계 프로젝트를 선택해 주세요.' });
                    return;
                }
                primaryProjectReassignments.push({ videoContentId: content.videoContentId, newPrimaryProjectId: selected });
            }
        }
        if (!window.confirm('프로젝트를 삭제할까요? 비용·수익·정산과 콘텐츠·YouTube 동영상 이력은 유지됩니다.')) return;
        let response = await deleteWorkspaceProject(currentWorkspace.workspaceId, detail.projectId, context, { primaryProjectReassignments });
        if (!response.success && response.errorCode === 'CONTENT_PERFORMANCE_MOVE_CONFIRMATION_REQUIRED') {
            if (!window.confirm(`${response.message}\n\n계속 삭제할까요?`)) return;
            response = await deleteWorkspaceProject(currentWorkspace.workspaceId, detail.projectId, context, {
                primaryProjectReassignments,
                confirmContentPerformanceMove: true
            });
        }
        if (response.success) navigate('/projects', { replace: true }); else setFeedback({ type: 'error', message: response.message });
    };

    /** 상세 정보의 인라인 선택값만 PATCH해 다른 프로젝트 기본 정보를 덮어쓰지 않습니다. */
    const changeProjectStatus = async (status: ProjectStatus) => {
        if (!currentWorkspace || !detail || status === detail.status) return false;
        setSubmitting(true);
        setFeedback(null);
        const response = await updateWorkspaceProjectStatus(
            currentWorkspace.workspaceId,
            detail.projectId,
            status,
            context
        );
        setSubmitting(false);
        if (response.success) setDetail(response.data);
        setFeedback({ type: response.success ? 'success' : 'error', message: response.message ?? '' });
        return response.success;
    };

    /** 낙관적 잠금 충돌은 기존 입력을 자동 재시도하지 않고 최신 상세로 복구합니다. */
    const handleYouTubeConflict = async (message: string) => {
        setYoutubeModal(null);
        setFeedback({ type: 'error', message });
        await loadDetail();
    };

    /** 결과물 생성·수정 모달을 Project 제안값 또는 현재 값으로 엽니다. */
    const openContentForm = (content: VideoContentResponse | null = null) => {
        if (!detail) return;
        setYoutubeModal({ kind: 'CONTENT_FORM', content, title: content?.title ?? detail.title, videoType: content?.videoType ?? detail.videoType, youtubeVideo: '', channelId: String(detail.channelId), publishedAt: currentLocalDateTimeValue(), revenueOption: 'DEFAULT', customRate: '', confirmation: null, duplicateLocation: null, fieldErrors: {}, error: null });
    };

    /** 확인 토큰 재시도를 포함해 결과물 제목·유형을 저장합니다. */
    const submitContentForm = async () => {
        if (!currentWorkspace || !detail || youtubeModal?.kind !== 'CONTENT_FORM') return;
        setYoutubeSubmitting(true);
        const response = youtubeModal.content
            ? await updateVideoContent(currentWorkspace.workspaceId, detail.projectId, youtubeModal.content.videoContentId, { title: youtubeModal.title, videoType: youtubeModal.videoType, expectedVersion: youtubeModal.content.version, defaultRateChangeConfirmationToken: youtubeModal.confirmation?.confirmationToken }, context)
            : await createProjectVideoContent(currentWorkspace.workspaceId, detail.projectId, {
                title: youtubeModal.title,
                videoType: youtubeModal.videoType,
                initialPublication: youtubeModal.youtubeVideo.trim() ? {
                    youtubeVideo: youtubeModal.youtubeVideo,
                    channelId: Number(youtubeModal.channelId),
                    publishedAt: youtubeModal.publishedAt ? new Date(youtubeModal.publishedAt).toISOString() : null,
                    revenueOption: youtubeModal.revenueOption,
                    customRevenuePerView: youtubeModal.customRate || null
                } : null
            }, context);
        setYoutubeSubmitting(false);
        if (response.success) {
            setDetail(response.data); setYoutubeModal(null); setFeedback({ type: 'success', message: response.message ?? '' });
        } else if (response.errorCode === 'DEFAULT_REVENUE_RATE_CHANGE_CONFIRMATION_REQUIRED' && isDefaultRateChangeConfirmation(response.data)) {
            const confirmation = response.data;
            setYoutubeModal(current => current?.kind === 'CONTENT_FORM' ? { ...current, confirmation, duplicateLocation: null, error: null } : current);
        } else if (response.errorCode === 'VIDEO_CONTENT_VERSION_CONFLICT' || response.errorCode === 'YOUTUBE_PUBLICATION_VERSION_CONFLICT') {
            await handleYouTubeConflict(response.message);
        } else {
            const fieldErrors = Object.fromEntries(
                (response.errors ?? [])
                    .filter(error => ['title', 'youtubeVideo', 'channelId', 'publishedAt', 'customRevenuePerView'].includes(error.field))
                    .map(error => [error.field, error.reason])
            ) as Partial<Record<ContentFormField, string>>;
            const duplicateLocation = response.errorCode === 'DUPLICATE_YOUTUBE_VIDEO' && isDuplicateYouTubeVideoLocation(response.data) ? response.data : null;
            setYoutubeModal(current => current?.kind === 'CONTENT_FORM'
                ? { ...current, duplicateLocation, fieldErrors, error: Object.keys(fieldErrors).length > 0 ? null : response.message }
                : current);
            if (Object.keys(fieldErrors).length > 0) {
                window.requestAnimationFrame(() => document.querySelector<HTMLElement>('#youtube-management-modal-title')?.closest('[role="dialog"]')?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus());
            }
        }
    };

    /** 게시물 등록 또는 일반 정보 수정 모달을 엽니다. */
    const openPublicationForm = (content: VideoContentResponse, publication: YouTubePublicationResponse | null = null) => {
        if (!detail) return;
        setYoutubeModal({ kind: 'PUBLICATION_FORM', content, publication, youtubeVideo: '', channelId: String(publication?.channelId ?? detail.channelId), publishedAt: publication ? toLocalDateTimeValue(publication.publishedAt) : currentLocalDateTimeValue(), revenueOption: publication?.revenueOption ?? 'DEFAULT', customRate: publication?.revenueOption === 'CUSTOM' ? publication.appliedRate ?? '' : '', confirmation: null, duplicateLocation: null, fieldError: null });
    };

    /** 게시물 등록·수정을 처리하고 DEFAULT 단가 영향은 같은 모달에서 재확인합니다. */
    const submitPublicationForm = async () => {
        if (!currentWorkspace || !detail || youtubeModal?.kind !== 'PUBLICATION_FORM') return;
        const channelId = Number(youtubeModal.channelId);
        const current = youtubeModal.content.publications.find(item => item.publicationId !== youtubeModal.publication?.publicationId && item.channelId === channelId && item.lifecycleStatus === 'CURRENT');
        const publishedAt = youtubeModal.publishedAt ? new Date(youtubeModal.publishedAt).toISOString() : null;
        setYoutubeSubmitting(true);
        const response = youtubeModal.publication
            ? await updateYouTubePublication(currentWorkspace.workspaceId, detail.projectId, youtubeModal.content.videoContentId, youtubeModal.publication.publicationId, { channelId, publishedAt, expectedVersion: youtubeModal.publication.version, replaceCurrentPublicationId: current?.publicationId ?? null, replaceCurrentPublicationVersion: current?.version ?? null, defaultRateChangeConfirmationToken: youtubeModal.confirmation?.confirmationToken }, context)
            : await createYouTubePublication(currentWorkspace.workspaceId, detail.projectId, youtubeModal.content.videoContentId, { channelId, youtubeVideo: youtubeModal.youtubeVideo, publishedAt, revenueOption: youtubeModal.revenueOption, customRevenuePerView: youtubeModal.customRate || null, supersedesPublicationId: current?.publicationId ?? null, supersedesPublicationVersion: current?.version ?? null }, context);
        setYoutubeSubmitting(false);
        if (response.success) {
            setDetail(response.data); setYoutubeModal(null); setFeedback({ type: 'success', message: response.message ?? '' });
        } else if (response.errorCode === 'DEFAULT_REVENUE_RATE_CHANGE_CONFIRMATION_REQUIRED' && isDefaultRateChangeConfirmation(response.data)) {
            const confirmation = response.data;
            setYoutubeModal(value => value?.kind === 'PUBLICATION_FORM' ? { ...value, confirmation, duplicateLocation: null, fieldError: null } : value);
        } else if (response.errorCode.includes('VERSION_CONFLICT')) await handleYouTubeConflict(response.message);
        else {
            const duplicateLocation = response.errorCode === 'DUPLICATE_YOUTUBE_VIDEO' && isDuplicateYouTubeVideoLocation(response.data) ? response.data : null;
            setYoutubeModal(value => value?.kind === 'PUBLICATION_FORM' ? { ...value, duplicateLocation, fieldError: response.message } : value);
        }
    };

    /** 게시물 수익 설정 모달을 엽니다. */
    const openRevenueForm = (content: VideoContentResponse, publication: YouTubePublicationResponse) => {
        setYoutubeModal({ kind: 'REVENUE_FORM', content, publication, revenueOption: publication.revenueOption ?? 'DEFAULT', customRate: publication.revenueOption === 'CUSTOM' ? publication.appliedRate ?? '' : '', fieldError: null });
    };

    /** 관리자 전용 게시물 예상 수익 방식을 저장합니다. */
    const submitRevenueForm = async () => {
        if (!currentWorkspace || !detail || youtubeModal?.kind !== 'REVENUE_FORM') return;
        setYoutubeSubmitting(true);
        const response = await updateYouTubePublicationRevenue(currentWorkspace.workspaceId, detail.projectId, youtubeModal.content.videoContentId, youtubeModal.publication.publicationId, { revenueOption: youtubeModal.revenueOption, customRevenuePerView: youtubeModal.customRate || null, expectedVersion: youtubeModal.publication.version }, context);
        setYoutubeSubmitting(false);
        if (response.success) { setDetail(response.data); setYoutubeModal(null); setFeedback({ type: 'success', message: response.message ?? '' }); }
        else if (response.errorCode.includes('VERSION_CONFLICT')) await handleYouTubeConflict(response.message);
        else setYoutubeModal(value => value?.kind === 'REVENUE_FORM' ? { ...value, fieldError: response.message } : value);
    };

    /** 연결 관리 모달의 현재 연결과 검색 후보를 다시 조회합니다. */
    const loadConnectionCandidates = async (content: VideoContentResponse, keyword = '', page = 1) => {
        if (!currentWorkspace || !detail) return;
        const requestId = ++latestConnectionRequestIdRef.current;
        setYoutubeModal(previous => {
            const current = previous?.kind === 'CONNECTIONS' && previous.content.videoContentId === content.videoContentId ? previous : null;
            return {
                kind: 'CONNECTIONS', content, connectedProjects: current?.connectedProjects ?? [],
                candidates: [], keyword: current?.keyword ?? keyword, appliedKeyword: keyword,
                page, totalPages: 1, requestId, readOnly: detail.archivedAt !== null, loading: true, error: null
            };
        });
        const response = await getVideoContentProjectCandidates(currentWorkspace.workspaceId, detail.projectId, content.videoContentId, { keyword, page }, context);
        if (activeViewContextRef.current !== viewContextKey) return;
        setYoutubeModal(current => {
            if (current?.kind !== 'CONNECTIONS' || current.requestId !== requestId) return current;
            if (!response.success) return { ...current, loading: false, error: response.message };
            const { connectedProjects, items, page: resolvedPage, totalPages } = response.data;
            return { ...current, connectedProjects, candidates: items, page: resolvedPage, totalPages, loading: false };
        });
    };

    /** 한 건씩 Project 연결을 추가하거나 해제하고 최신 version으로 모달을 갱신합니다. */
    const mutateConnection = async (candidate: VideoContentProjectCandidate) => {
        if (!currentWorkspace || !detail || youtubeModal?.kind !== 'CONNECTIONS') return;
        setYoutubeSubmitting(true);
        const response = candidate.connected
            ? await disconnectVideoContentProject(currentWorkspace.workspaceId, detail.projectId, youtubeModal.content.videoContentId, candidate.projectId, youtubeModal.content.version, context)
            : await connectVideoContentProject(currentWorkspace.workspaceId, detail.projectId, youtubeModal.content.videoContentId, candidate.projectId, youtubeModal.content.version, context);
        setYoutubeSubmitting(false);
        if (response.success) {
            setDetail(response.data);
            const content = response.data.videoContents.find(item => item.videoContentId === youtubeModal.content.videoContentId);
            if (content) await loadConnectionCandidates(content, youtubeModal.appliedKeyword, youtubeModal.page);
            else setYoutubeModal(null);
            setFeedback({ type: 'success', message: response.message ?? '' });
        } else if (response.errorCode.includes('VERSION_CONFLICT')) await handleYouTubeConflict(response.message);
        else setFeedback({ type: 'error', message: response.message });
    };

    /** 대표 Project 변경 모달에 연결 Project 이름과 그룹을 준비합니다. */
    const openPrimaryForm = async (content: VideoContentResponse) => {
        if (!currentWorkspace || !detail) return;
        const response = await getVideoContentProjectCandidates(currentWorkspace.workspaceId, detail.projectId, content.videoContentId, { size: 1 }, context);
        if (!response.success) { setFeedback({ type: 'error', message: response.message }); return; }
        const candidates = response.data.connectedProjects.filter(item => !item.primary && item.canManage);
        setYoutubeModal({ kind: 'PRIMARY_FORM', content, candidates, projectId: String(candidates[0]?.projectId ?? ''), reasonType: 'MERGED', reason: '', needsPerformanceConfirmation: false, error: null });
    };

    /** 사유와 성과 이동 확인을 포함해 대표 Project를 변경합니다. */
    const submitPrimaryForm = async () => {
        if (!currentWorkspace || !detail || youtubeModal?.kind !== 'PRIMARY_FORM') return;
        setYoutubeSubmitting(true);
        const response = await changeVideoContentPrimaryProject(currentWorkspace.workspaceId, detail.projectId, youtubeModal.content.videoContentId, { newPrimaryProjectId: Number(youtubeModal.projectId), changeReasonType: youtubeModal.reasonType, changeReason: youtubeModal.reason || null, expectedVersion: youtubeModal.content.version, confirmContentPerformanceMove: youtubeModal.needsPerformanceConfirmation }, context);
        setYoutubeSubmitting(false);
        if (response.success) { setDetail(response.data); setYoutubeModal(null); setFeedback({ type: 'success', message: response.message ?? '' }); }
        else if (response.errorCode === 'CONTENT_PERFORMANCE_MOVE_CONFIRMATION_REQUIRED') setYoutubeModal({ ...youtubeModal, needsPerformanceConfirmation: true, error: response.message });
        else if (response.errorCode.includes('VERSION_CONFLICT')) await handleYouTubeConflict(response.message);
        else setYoutubeModal({ ...youtubeModal, error: response.message });
    };

    /** 확인 모달에서 게시·공유 이력이 없는 영상의 물리 삭제를 요청합니다. */
    const submitContentDeletion = async () => {
        if (!currentWorkspace || !detail || youtubeModal?.kind !== 'CONTENT_DELETE') return;
        setYoutubeSubmitting(true);
        const response = await deleteProjectVideoContent(currentWorkspace.workspaceId, detail.projectId, youtubeModal.content.videoContentId, youtubeModal.content.version, context);
        setYoutubeSubmitting(false);
        if (response.success) {
            setDetail(response.data);
            setYoutubeModal(null);
            setFeedback({ type: 'success', message: response.message ?? '영상을 삭제했습니다.' });
        } else if (response.errorCode === 'VIDEO_CONTENT_VERSION_CONFLICT') {
            await handleYouTubeConflict(response.message);
        } else {
            setYoutubeModal(current => current?.kind === 'CONTENT_DELETE' ? { ...current, error: response.message } : current);
        }
    };

    /** 게시물별 동기화·종료·복원을 수행하고 전체 결과물 집계를 새 응답으로 교체합니다. */
    const mutatePublication = async (content: VideoContentResponse, publication: YouTubePublicationResponse, action: 'sync' | 'unavailable' | 'incorrect' | 'restore') => {
        if (!currentWorkspace || !detail) return;
        const base = [currentWorkspace.workspaceId, detail.projectId, content.videoContentId, publication.publicationId] as const;
        let response;
        if (action === 'sync') response = await syncYouTubePublication(...base, context);
        else if (action === 'restore') {
            const current = content.publications.find(item => item.channelId === publication.channelId && item.lifecycleStatus === 'CURRENT');
            if (current && !window.confirm(`${current.channelName}의 현재 YouTube 동영상을 대체하고 이 동영상을 복원할까요?`)) return;
            response = await restoreYouTubePublication(...base, publication.version, current?.publicationId ?? null, current?.version ?? null, context);
        } else {
            const reason: YouTubeRemovalReason = action === 'incorrect' ? 'INCORRECT' : 'UNAVAILABLE';
            const message = reason === 'INCORRECT' ? '잘못 연결한 YouTube 동영상으로 처리할까요? 현재·누적 성과에서 모두 제외됩니다.' : '동영상 연결을 종료할까요? 마지막 성과는 누적 성과에 남습니다.';
            if (!window.confirm(message)) return;
            response = await removeYouTubePublication(...base, reason, publication.version, context);
        }
        if (response.success) setDetail(response.data);
        else if (response.errorCode.includes('VERSION_CONFLICT')) { await handleYouTubeConflict(response.message); return; }
        setFeedback({ type: response.success ? 'success' : 'error', message: response.message ?? '' });
    };

    /** 중복 동영상 오류에서 조회 가능한 기존 콘텐츠로 이동합니다. */
    const openDuplicateLocation = (duplicate: DuplicateYouTubeVideoLocation) => {
        if (!duplicate.canAccess) return;
        const listSearch = (location.state as { listSearch?: string } | null)?.listSearch;
        setYoutubeModal(null);
        navigate(`/projects/${duplicate.projectId}/videos?videoContentId=${duplicate.videoContentId}`, {
            state: listSearch ? { listSearch } : undefined
        });
    };

    const activeMember = detail?.members.find(member => member.userId === user?.userId && member.active);
    const canEdit = isAdmin || activeMember?.permission === 'EDIT';
    const canManage = isAdmin || activeMember?.isOwner === true;
    return <section className="project-area-page">
        {projectId === null
            ? <><ProjectAreaTabs /><ProjectList projects={projects} channels={channels} groups={groups} loading={loading} error={error} params={params} totalPages={totalPages} onFilter={setFilter} onResetFilters={() => setParams(new URLSearchParams(), { replace: true })} onCreate={requestCreateForm} /></>
            : <ProjectDetailView detail={detail} loading={loading} error={error} feedback={feedback} canSeeRevenue={isAdmin} canEdit={canEdit} canManage={canManage} statusSubmitting={submitting} onStatusChange={changeProjectStatus} onEdit={() => detail && openForm(detail)} onArchive={() => void archive()} onDelete={() => void remove()} onAddVideoContent={() => openContentForm()} onEditVideoContent={openContentForm} onDeleteVideoContent={content => setYoutubeModal({ kind: 'CONTENT_DELETE', content, error: null })} onManageConnections={content => void loadConnectionCandidates(content)} onChangePrimaryProject={content => void openPrimaryForm(content)} onShowContentHistory={content => setYoutubeModal({ kind: 'CONTENT_HISTORY', content })} onAddPublication={content => openPublicationForm(content)} onEditPublication={openPublicationForm} onEditRevenue={openRevenueForm} onShowPublicationHistory={publication => setYoutubeModal({ kind: 'PUBLICATION_HISTORY', publication })} onPublicationAction={(content, publication, action) => void mutatePublication(content, publication, action)} />}
        {modalOpen && <ProjectGroupModal titleId="project-form-title" title={editingProject ? '프로젝트 수정' : '새 프로젝트'} description={editingProject ? '프로젝트 기본 정보와 일정을 수정합니다.' : '영상 제작 과정의 기본 정보와 시작 상태를 설정합니다.'} onRequestClose={closeForm}><ProjectForm formRef={formRef} values={form} errors={errors} channels={channels} groups={groups} edit={editingProject !== null} admin={isAdmin} submitting={submitting} onChange={change} onSubmit={submit} onCancel={closeForm} /></ProjectGroupModal>}
        {youtubeModal && <YouTubeManagementModal state={youtubeModal} channels={channels} canSeeRevenue={isAdmin} submitting={youtubeSubmitting} onChange={setYoutubeModal} onClose={() => setYoutubeModal(null)} onOpenDuplicateLocation={openDuplicateLocation} onSubmitContent={() => void submitContentForm()} onSubmitContentDeletion={() => void submitContentDeletion()} onSubmitPublication={() => void submitPublicationForm()} onSubmitRevenue={() => void submitRevenueForm()} onSearchConnections={(keyword, page) => youtubeModal.kind === 'CONNECTIONS' && void loadConnectionCandidates(youtubeModal.content, keyword, page)} onMutateConnection={candidate => void mutateConnection(candidate)} onSubmitPrimary={() => void submitPrimaryForm()} />}
    </section>;
}

type ProjectAccessGuide = {
    label: string;
    reason: string;
    allowed: string[];
    restricted: string[];
};

type OpenProjectAccess = {
    projectId: number;
    pinned: boolean;
};

const PROJECT_ACCESS_LABEL: Record<ProjectAccessRole, string> = {
    PROJECT_OWNER: '프로젝트 소유자',
    PROJECT_EDITOR: '편집 참여',
    PROJECT_VIEWER: '보기 참여',
    WORKSPACE_ADMIN: '제작팀 관리자',
    WORKSPACE_OWNER: '제작팀 소유자'
};

/** 접근 역할과 현재 상태를 조합해 실제 화면에서 가능한 기능 안내를 만듭니다. */
function getProjectAccessGuide(project: ProjectListItemResponse): ProjectAccessGuide {
    const role = project.myAccessRole;
    const label = PROJECT_ACCESS_LABEL[role];
    const canEdit = role !== 'PROJECT_VIEWER';
    const canManage = role === 'PROJECT_OWNER' || role === 'WORKSPACE_ADMIN' || role === 'WORKSPACE_OWNER';
    const canManageFinance = role === 'WORKSPACE_ADMIN' || role === 'WORKSPACE_OWNER';
    const canArchiveNow = project.archivedAt !== null || project.status === 'UPLOADED' || project.status === 'CANCELLED';
    const allowed = ['프로젝트 상세와 작업·참여 현황 조회'];
    const restricted: string[] = [];

    if (canEdit) allowed.push('기본 정보·상태·일정 수정', 'YouTube 영상 연결과 성과 동기화');
    else restricted.push('프로젝트 내용 수정과 YouTube 관리');

    if (canManageFinance) allowed.push('프로젝트 그룹과 YouTube 동영상 예상 수익 확인');
    else restricted.push('프로젝트 그룹과 YouTube 동영상 예상 수익 확인');

    if (canManage) {
        allowed.push('프로젝트 삭제');
        if (canArchiveNow) allowed.push(project.archivedAt ? '활성 목록으로 복원' : '프로젝트 보관');
        else restricted.push('보관은 업로드 완료 또는 제작 취소 상태에서 가능');
    } else restricted.push('프로젝트 보관과 삭제');

    const reason = role === 'PROJECT_OWNER'
        ? '당신은 이 프로젝트의 소유자입니다.'
        : role === 'PROJECT_EDITOR'
            ? '당신은 이 프로젝트의 편집 참여자로 등록되어 있습니다.'
            : role === 'PROJECT_VIEWER'
                ? '당신은 이 프로젝트의 보기 참여자로 등록되어 있습니다.'
                : role === 'WORKSPACE_ADMIN'
                    ? '당신은 제작팀 관리자 권한으로 모든 프로젝트를 볼 수 있습니다.'
                    : '당신은 제작팀 소유자 권한으로 모든 프로젝트를 볼 수 있습니다.';

    return { label, reason, allowed, restricted };
}

/** 역할 배지의 hover·focus 미리보기와 click·touch 고정 팝오버를 제공합니다. */
function ProjectAccessBadge({ project, open, pinned, onPreview, onPreviewEnd, onToggle, onClose }: { project: ProjectListItemResponse; open: boolean; pinned: boolean; onPreview: () => void; onPreviewEnd: () => void; onToggle: () => void; onClose: () => void }) {
    const wrapperRef = useRef<HTMLDivElement>(null);
    const guide = getProjectAccessGuide(project);
    const popoverId = `project-access-guide-${project.projectId}`;
    const titleId = `${popoverId}-title`;
    const roleClass = project.myAccessRole.toLocaleLowerCase().replaceAll('_', '-');

    useEffect(() => {
        if (!open) return;

        /** 고정 여부와 관계없이 바깥 클릭과 Escape로 팝오버를 닫습니다. */
        const handlePointerDown = (event: PointerEvent) => {
            if (!wrapperRef.current?.contains(event.target as Node)) onClose();
        };
        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') onClose();
        };

        document.addEventListener('pointerdown', handlePointerDown);
        document.addEventListener('keydown', handleKeyDown);
        return () => {
            document.removeEventListener('pointerdown', handlePointerDown);
            document.removeEventListener('keydown', handleKeyDown);
        };
    }, [onClose, open]);

    return (
        <div
            ref={wrapperRef}
            className={`project-access project-access--${roleClass}`}
            onMouseEnter={onPreview}
            onMouseLeave={onPreviewEnd}
            onFocus={onPreview}
            onBlur={event => {
                if (!pinned && !event.currentTarget.contains(event.relatedTarget)) onPreviewEnd();
            }}
        >
            <button
                type="button"
                className="project-access__trigger"
                aria-expanded={open}
                aria-haspopup="dialog"
                aria-controls={popoverId}
                onClick={event => {
                    event.stopPropagation();
                    onToggle();
                }}
            >
                <span>내 역할</span>
                <strong>{guide.label}</strong>
            </button>
            {open && (
                <section id={popoverId} className="project-access__popover" role="dialog" aria-labelledby={titleId}>
                    <p className="project-access__eyebrow">이 프로젝트에서의 내 역할</p>
                    <h3 id={titleId}>{guide.label}</h3>
                    <p>{guide.reason}</p>
                    <strong>할 수 있는 일</strong>
                    <ul>{guide.allowed.map(item => <li key={item}>{item}</li>)}</ul>
                    <strong>제한되는 일</strong>
                    <ul>{guide.restricted.map(item => <li key={item}>{item}</li>)}</ul>
                </section>
            )}
        </div>
    );
}

/** 프로젝트 URL 필터와 카드 목록을 표시합니다. */
function ProjectList({ projects, channels, groups, loading, error, params, totalPages, onFilter, onResetFilters, onCreate }: { projects: ProjectListItemResponse[]; channels: WorkspaceChannelListItem[]; groups: ReturnType<typeof getProjectGroupOptions>; loading: boolean; error: string | null; params: URLSearchParams; totalPages: number; onFilter: (key: string, value: string) => void; onResetFilters: () => void; onCreate: () => void }) {
    const [openAccess, setOpenAccess] = useState<OpenProjectAccess | null>(null);
    const archived = params.get('view') === 'archived';
    const page = Number(params.get('page')) || 1;

    /** 고정된 팝오버가 없을 때만 hover·focus 대상을 미리 표시합니다. */
    const previewAccess = (projectId: number) => {
        setOpenAccess(current => current?.pinned ? current : { projectId, pinned: false });
    };

    /** 현재 항목이 hover·focus로 열린 경우에만 미리보기를 닫습니다. */
    const endAccessPreview = (projectId: number) => {
        setOpenAccess(current => current?.projectId === projectId && !current.pinned ? null : current);
    };

    /** click·touch는 해당 역할 안내를 고정하고 같은 배지를 다시 누르면 닫습니다. */
    const toggleAccess = (projectId: number) => {
        setOpenAccess(current => current?.projectId === projectId && current.pinned ? null : { projectId, pinned: true });
    };

    return (
        <>
            <header className="project-header">
                <div><p className="project-group-eyebrow">VIDEO PROJECTS</p><h1>프로젝트</h1><p>영상 한 편의 기획부터 업로드와 성과까지 관리합니다.</p></div>
                <button className="project-button project-button--primary" onClick={onCreate}>새 프로젝트</button>
            </header>
            <nav className="project-view-tabs"><button className={!archived ? 'is-active' : ''} onClick={() => onFilter('view', 'active')}>활성 프로젝트</button><button className={archived ? 'is-active' : ''} onClick={() => onFilter('view', 'archived')}>보관함</button></nav>
            <div className="project-filters"><label><span>검색</span><CompositionSafeSearchInput value={params.get('keyword') ?? ''} placeholder="제목 또는 내용" onValueChange={value => onFilter('keyword', value)} /></label><label><span>상태</span><select value={params.get('status') ?? 'ALL'} onChange={event => onFilter('status', event.target.value)}><option value="ALL">전체</option>{Object.entries(STATUS_LABEL).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label><label><span>채널</span><select value={params.get('channelId') ?? ''} onChange={event => onFilter('channelId', event.target.value)}><option value="">전체</option>{channels.map(item => <option key={item.channelId} value={item.channelId}>{item.name}</option>)}</select></label><label><span>그룹</span><select value={params.get('projectGroupId') ?? ''} onChange={event => onFilter('projectGroupId', event.target.value)}><option value="">전체</option>{groups.map(item => <option key={item.projectGroupId} value={item.projectGroupId}>{item.name}</option>)}</select></label><label><span>참여</span><select value={params.get('participation') ?? 'ALL'} onChange={event => onFilter('participation', event.target.value)}><option value="ALL">전체</option><option value="MINE">내가 참여한 프로젝트</option></select></label><div className="project-filter-actions"><FilterResetButton disabled={params.size === 0} onClick={onResetFilters} /></div></div>
            {loading ? <p className="project-state">프로젝트를 불러오는 중...</p> : error ? <FeedbackMessage type="error" message={error} /> : projects.length === 0 ? <div className="project-state"><strong>조건에 맞는 프로젝트가 없습니다.</strong></div> : (
                <>
                    <ul className="project-list">
                        {projects.map(project => {
                            const accessOpen = openAccess?.projectId === project.projectId;
                            return (
                                <li key={project.projectId} className={accessOpen ? 'project-card--popover-open' : undefined}>
                                    <div>
                                        <div className="project-card__badges">
                                            <span className={`project-status project-status--${project.status.toLowerCase()}`}>{STATUS_LABEL[project.status]}</span>
                                            <ProjectAccessBadge
                                                project={project}
                                                open={accessOpen}
                                                pinned={accessOpen && openAccess.pinned}
                                                onPreview={() => previewAccess(project.projectId)}
                                                onPreviewEnd={() => endAccessPreview(project.projectId)}
                                                onToggle={() => toggleAccess(project.projectId)}
                                                onClose={() => setOpenAccess(null)}
                                            />
                                        </div>
                                        <h2><Link to={`/projects/${project.projectId}`} state={{ listSearch: params.toString() }}>{project.title}</Link></h2>
                                        <p>{project.channelName} · {project.videoType === 'LONG' ? '롱폼' : '쇼츠'} · 현재 조회수 {project.currentPerformance.completeness === 'UNAVAILABLE' ? '미집계' : project.currentPerformance.viewCount.toLocaleString()}</p>
                                    </div>
                                    <dl><div><dt>소유자</dt><dd>{project.ownerName}</dd></div><div><dt>작업</dt><dd>{project.completedTaskCount}/{project.taskCount}</dd></div><div><dt>마감일</dt><dd>{project.dueDate ?? '미정'}</dd></div><div><dt>그룹</dt><dd>{project.projectGroupName ?? '없음'}</dd></div></dl>
                                    <Link className="project-card__link" to={`/projects/${project.projectId}`} state={{ listSearch: params.toString() }}>상세 보기 →</Link>
                                </li>
                            );
                        })}
                    </ul>
                    <nav className="project-pagination" aria-label="프로젝트 페이지"><button disabled={page <= 1} onClick={() => onFilter('page', String(page - 1))}>이전</button><span>{page} / {totalPages}</span><button disabled={page >= totalPages} onClick={() => onFilter('page', String(page + 1))}>다음</button></nav>
                </>
            )}
        </>
    );
}

const PUBLICATION_STATUS_LABEL = { CURRENT: '게시 중', SUPERSEDED: '대체됨', REMOVED: '게시 종료' } as const;
const COMPLETENESS_LABEL = { COMPLETE: '집계 완료', PARTIAL: '일부 미집계', UNAVAILABLE: '미집계' } as const;

type ProjectDetailViewProps = {
    detail: ProjectDetailResponse | null;
    loading: boolean;
    error: string | null;
    feedback: Feedback | null;
    canSeeRevenue: boolean;
    canEdit: boolean;
    canManage: boolean;
    statusSubmitting: boolean;
    onStatusChange: (status: ProjectStatus) => Promise<boolean>;
    onEdit: () => void;
    onArchive: () => void;
    onDelete: () => void;
    onAddVideoContent: () => void;
    onEditVideoContent: (content: VideoContentResponse) => void;
    onDeleteVideoContent: (content: VideoContentResponse) => void;
    onManageConnections: (content: VideoContentResponse) => void;
    onChangePrimaryProject: (content: VideoContentResponse) => void;
    onShowContentHistory: (content: VideoContentResponse) => void;
    onAddPublication: (content: VideoContentResponse) => void;
    onEditPublication: (content: VideoContentResponse, publication: YouTubePublicationResponse) => void;
    onEditRevenue: (content: VideoContentResponse, publication: YouTubePublicationResponse) => void;
    onShowPublicationHistory: (publication: YouTubePublicationResponse) => void;
    onPublicationAction: (content: VideoContentResponse, publication: YouTubePublicationResponse, action: 'sync' | 'unavailable' | 'incorrect' | 'restore') => void;
};

/** 선택한 Project 상태에 따라 실제 동작에서 주의할 점을 짧게 안내합니다. */
function getProjectStatusGuidance(status: ProjectStatus, archived: boolean): string {
    if (archived && (status === 'PLANNING' || status === 'EDITING' || status === 'REVIEW')) {
        return '이 상태로 변경하면 프로젝트 보관이 자동으로 해제됩니다.';
    }
    if (status === 'UPLOADED') return '콘텐츠나 YouTube 동영상을 자동으로 만들지는 않습니다.';
    if (status === 'CANCELLED') return '제작 취소로 표시되며 나중에 다른 상태로 변경해 다시 진행할 수 있습니다.';
    return '프로젝트의 현재 제작 진행 단계를 표시합니다.';
}

/** 현재·누적 집계값과 데이터 완전성을 한 카드에서 구분해 표시합니다. */
function PerformanceSummary({ title, aggregate, canSeeRevenue }: { title: string; aggregate: VideoContentResponse['currentPerformance']; canSeeRevenue: boolean }) {
    return (
        <article className="project-performance-summary">
            <header><h4>{title}</h4><span className={`project-completeness project-completeness--${aggregate.completeness.toLowerCase()}`}>{COMPLETENESS_LABEL[aggregate.completeness]}</span></header>
            <dl>
                <div><dt>조회수</dt><dd>{aggregate.completeness === 'UNAVAILABLE' ? '미집계' : aggregate.viewCount.toLocaleString()}</dd></div>
                <div><dt>좋아요</dt><dd>{aggregate.completeness === 'UNAVAILABLE' ? '—' : aggregate.likeCount.toLocaleString()}</dd></div>
                <div><dt>댓글</dt><dd>{aggregate.completeness === 'UNAVAILABLE' ? '—' : aggregate.commentCount.toLocaleString()}</dd></div>
                {canSeeRevenue && <div><dt>예상 수익</dt><dd>{aggregate.completeness === 'UNAVAILABLE' ? '—' : `${formatMoney(aggregate.estimatedRevenue ?? '0.00')}원`}</dd></div>}
            </dl>
            <p>{aggregate.includedPublicationCount}개 포함 · {aggregate.missingPublicationCount}개 미집계</p>
        </article>
    );
}

/** 한 Channel의 게시물을 최신순 타임라인으로 표시하고 게시물별 동작을 제공합니다. */
function PublicationTimeline({ content, publications, canEdit, canSeeRevenue, onAction, onEdit, onEditRevenue, onShowHistory }: { content: VideoContentResponse; publications: YouTubePublicationResponse[]; canEdit: boolean; canSeeRevenue: boolean; onAction: ProjectDetailViewProps['onPublicationAction']; onEdit: ProjectDetailViewProps['onEditPublication']; onEditRevenue: ProjectDetailViewProps['onEditRevenue']; onShowHistory: ProjectDetailViewProps['onShowPublicationHistory'] }) {
    return (
        <section className="project-publication-channel">
            <h4>📺 {publications[0].channelName}</h4>
            <ol>
                {[...publications].sort((left, right) => right.createdAt.localeCompare(left.createdAt)).map(publication => {
                    const performance = publication.performance;
                    const needsAttention = performance?.syncStatus === 'ERROR';
                    return (
                        <li key={publication.publicationId} className={`project-publication project-publication--${publication.lifecycleStatus.toLowerCase()}`}>
                            <div className="project-publication__header">
                                <div><span className="project-publication__status">{PUBLICATION_STATUS_LABEL[publication.lifecycleStatus]}</span>{publication.removalReason && <small>{publication.removalReason === 'INCORRECT' ? '잘못 연결됨' : '운영 종료'}</small>}</div>
                                <a href={publication.youtubeVideoUrl} target="_blank" rel="noreferrer">{publication.youtubeVideoId} ↗</a>
                            </div>
                            <p>실제 게시 일시 · {publication.publishedAt ? new Date(publication.publishedAt).toLocaleString('ko-KR') : '게시 일시 미상'}</p>
                            <div className="project-publication__metrics">
                                <span>조회수 <strong>{performance ? performance.viewCount.toLocaleString() : '미집계'}</strong></span>
                                <span>좋아요 <strong>{performance ? performance.likeCount.toLocaleString() : '—'}</strong></span>
                                <span>댓글 <strong>{performance ? performance.commentCount.toLocaleString() : '—'}</strong></span>
                                {canSeeRevenue && <span>예상 수익 <strong>{performance ? `${formatMoney((performance.viewCount * Number(publication.appliedRate ?? 0)).toFixed(2))}원` : '—'}</strong></span>}
                            </div>
                            <p>{needsAttention ? `확인 필요 · ${performance?.lastErrorMessage ?? '동기화 실패'}` : performance?.lastSuccessAt ? `마지막 성공 ${new Date(performance.lastSuccessAt).toLocaleString('ko-KR')}` : '아직 동기화하지 않았습니다.'}</p>
                            {canSeeRevenue && <p>{publication.revenueOption === 'DEFAULT' ? '채널 기본 단가' : publication.revenueOption === 'CUSTOM' ? '개별 단가' : '수익 계산 안 함'} · 조회당 {publication.appliedRate}원</p>}
                            <div className="project-publication__actions">
                                {canEdit && <button className="project-button" onClick={() => onEdit(content, publication)}>동영상 정보 수정</button>}
                                {canEdit && canSeeRevenue && !(publication.lifecycleStatus === 'REMOVED' && publication.removalReason === 'INCORRECT') && <button className="project-button" onClick={() => onEditRevenue(content, publication)}>수익 설정</button>}
                                <button className="project-button" onClick={() => onShowHistory(publication)}>상태 이력</button>
                                {canEdit && (publication.lifecycleStatus === 'CURRENT' ? <><button className="project-button" onClick={() => onAction(content, publication, 'sync')}>성과 동기화</button><button className="project-button" onClick={() => onAction(content, publication, 'unavailable')}>게시 종료</button><button className="project-button project-button--danger" onClick={() => onAction(content, publication, 'incorrect')}>잘못 연결</button></> : <button className="project-button" onClick={() => onAction(content, publication, 'restore')}>게시 중으로 복원</button>)}
                            </div>
                        </li>
                    );
                })}
            </ol>
        </section>
    );
}

/** URL 탭에 따라 프로젝트 기본 정보와 영상 결과물을 분리해 표시합니다. */
function ProjectDetailView({ detail, loading, error, feedback, canSeeRevenue, canEdit, canManage, statusSubmitting, onStatusChange, onEdit, onArchive, onDelete, onAddVideoContent, onEditVideoContent, onDeleteVideoContent, onManageConnections, onChangePrimaryProject, onShowContentHistory, onAddPublication, onEditPublication, onEditRevenue, onShowPublicationHistory, onPublicationAction }: ProjectDetailViewProps) {
    const location = useLocation();
    const [searchParams] = useSearchParams();
    const [selectedStatus, setSelectedStatus] = useState<ProjectStatus>(detail?.status ?? 'PLANNING');
    const [highlightedContentId, setHighlightedContentId] = useState<number | null>(null);
    const videoView = location.pathname.endsWith('/videos');
    const targetContentId = Number(searchParams.get('videoContentId')) || null;

    /** 저장 응답이나 다른 Project 조회로 상세가 바뀌면 인라인 선택값도 서버 상태에 맞춥니다. */
    useEffect(() => {
        if (detail) setSelectedStatus(detail.status);
    }, [detail]);

    /** 직접 이동한 콘텐츠 카드를 화면에 맞추고 잠시 강조합니다. */
    useEffect(() => {
        if (!videoView || !detail || targetContentId === null || !detail.videoContents.some(content => content.videoContentId === targetContentId)) {
            setHighlightedContentId(null);
            return;
        }
        setHighlightedContentId(targetContentId);
        const frame = window.requestAnimationFrame(() => {
            document.getElementById(`video-content-${targetContentId}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        });
        const timeout = window.setTimeout(() => setHighlightedContentId(null), 3000);
        return () => {
            window.cancelAnimationFrame(frame);
            window.clearTimeout(timeout);
        };
    }, [detail, targetContentId, videoView]);

    if (loading) return <p className="project-state">프로젝트를 불러오는 중...</p>;
    if (!detail || error) return <FeedbackMessage type="error" message={error ?? '프로젝트를 찾을 수 없습니다.'} />;

    const back = (location.state as { listSearch?: string } | null)?.listSearch;
    const archiveActionAvailable = isArchiveActionAvailable(detail);
    const canEditContent = canEdit && detail.archivedAt === null;
    const archiveUnavailableMessage = '업로드 완료 또는 제작 취소 상태에서 보관할 수 있습니다.';
    const submitStatusChange = async () => {
        const changed = await onStatusChange(selectedStatus);
        if (!changed) setSelectedStatus(detail.status);
    };
    return (
        <>
            <ProjectDetailHeader projectId={detail.projectId} title={detail.title} channelName={detail.channelName} ownerName={detail.ownerName} status={detail.status} listSearch={back} />
            {feedback && <FeedbackMessage type={feedback.type} message={feedback.message} />}
            {!videoView && (canEdit || canManage) && <div className="project-detail-management-actions">{canEdit && <button className="project-button" onClick={onEdit}>기본 정보 수정</button>}{canManage && <span className="project-action-tooltip" title={archiveActionAvailable ? undefined : archiveUnavailableMessage}><button className="project-button" disabled={!archiveActionAvailable} aria-label={archiveActionAvailable ? undefined : `보관: ${archiveUnavailableMessage}`} onClick={onArchive}>{detail.archivedAt ? '복원' : '보관'}</button></span>}{canManage && <button className="project-button project-button--danger" onClick={onDelete}>삭제</button>}</div>}
            {!videoView && canEdit && <section className="project-status-editor" aria-labelledby="project-status-editor-title">
                <div>
                    <h2 id="project-status-editor-title">프로젝트 상태</h2>
                    <p>{getProjectStatusGuidance(selectedStatus, detail.archivedAt !== null)}</p>
                </div>
                <fieldset disabled={statusSubmitting}>
                    <legend className="sr-only">변경할 프로젝트 상태</legend>
                    {Object.entries(STATUS_LABEL).map(([status, label]) => <label key={status} className={status === 'CANCELLED' ? 'project-status-editor__option project-status-editor__option--danger' : 'project-status-editor__option'}>
                        <input type="radio" name="project-detail-status" value={status} checked={selectedStatus === status} onChange={() => setSelectedStatus(status as ProjectStatus)} />
                        <span>{status === 'CANCELLED' ? '제작 취소' : label}</span>
                    </label>)}
                </fieldset>
                <button type="button" className="project-button project-button--primary" disabled={statusSubmitting || selectedStatus === detail.status} onClick={() => void submitStatusChange()}>{statusSubmitting ? '변경 중…' : '상태 변경'}</button>
            </section>}
            {!videoView && <div className="project-detail-grid">
                <article><h2>기본 정보</h2><p>{detail.content ?? '등록된 내용이 없습니다.'}</p><dl><div><dt>마감일</dt><dd>{detail.dueDate ?? '미정'}</dd></div><div><dt>업로드 예정일</dt><dd>{detail.plannedUploadDate ?? '미정'}</dd></div><div><dt>프로젝트 그룹</dt><dd>{detail.projectGroupName ?? '없음'}</dd></div></dl></article>
                <article><h2>작업 요약</h2><strong className="project-big-number">{detail.completedTaskCount}/{detail.taskCount}</strong><p>완료 / 전체 작업</p><ResourceNavigationLink to={`/projects/${detail.projectId}/tasks`} state={back ? { listSearch: back } : undefined} label="작업 관리로 이동" variant="detail" /></article>
                <article><h2>참여자</h2><ul>{detail.members.filter(item => item.active).map(item => <li key={item.workspaceMemberId}>{item.name}{item.isOwner ? ' 👑' : ''} <small>{item.permission === 'EDIT' ? '편집' : '보기'}</small></li>)}</ul></article>
            </div>}
            {videoView && <section className="project-video-contents">
                <header className="project-section__header"><div><h2>콘텐츠와 YouTube 동영상</h2><p>게시 전 콘텐츠와 실제 YouTube 동영상을 한곳에서 관리합니다.</p></div>{canEditContent && <button className="project-button project-button--primary" onClick={onAddVideoContent}>콘텐츠 추가</button>}</header>
                {detail.archivedAt && <p className="project-content-readonly">보관된 프로젝트에서는 콘텐츠와 동영상을 조회할 수 있습니다. 변경하려면 프로젝트를 복원해 주세요.</p>}
                {detail.videoContents.length === 0 ? <div className="project-state"><strong>아직 등록된 콘텐츠가 없습니다.</strong><p>{canEditContent ? '콘텐츠를 추가하면서 YouTube 동영상도 함께 연결할 수 있습니다.' : '콘텐츠가 등록되면 이곳에서 확인할 수 있습니다.'}</p></div> : detail.videoContents.map(content => {
                    const byChannel = [...content.publications.reduce((map, publication) => map.set(publication.channelId, [...(map.get(publication.channelId) ?? []), publication]), new Map<number, YouTubePublicationResponse[]>()).values()];
                    return (
                        <article id={`video-content-${content.videoContentId}`} className={`project-video-content${highlightedContentId === content.videoContentId ? ' project-video-content--highlighted' : ''}`} key={content.videoContentId}>
                            <header><div><span>{content.videoType === 'LONG' ? '롱폼' : '쇼츠'}</span><h3>{content.title}</h3><p>성과 집계 프로젝트 #{content.primaryProjectId} · 연결 프로젝트 {content.connectedProjectIds.length}개</p></div><div className="project-video-content__actions">{content.primaryProjectId === detail.projectId && <strong className="project-primary-badge" title="이 콘텐츠의 성과가 현재 프로젝트와 프로젝트 그룹에 집계됩니다.">성과 집계 대상</strong>}{(detail.archivedAt || canEditContent) && <button className="project-button" onClick={() => onManageConnections(content)}>{detail.archivedAt ? '연결 보기' : '연결 관리'}</button>}{canEditContent && <><button className="project-button project-button--primary" onClick={() => onAddPublication(content)}>YouTube 동영상 추가</button><button className="project-button" onClick={() => onEditVideoContent(content)}>수정</button>{content.connectedProjectIds.length > 1 && <button className="project-button" onClick={() => onChangePrimaryProject(content)}>집계 프로젝트 변경</button>}{content.publications.length === 0 && <span className="project-action-tooltip" title={content.connectedProjectIds.length > 1 ? '다른 프로젝트 연결을 먼저 해제해 주세요.' : undefined}><button className="project-button project-button--danger" disabled={content.connectedProjectIds.length > 1} aria-label={content.connectedProjectIds.length > 1 ? '콘텐츠 삭제: 다른 프로젝트 연결을 먼저 해제해 주세요.' : undefined} onClick={() => onDeleteVideoContent(content)}>콘텐츠 삭제</button></span>}</>}<button className="project-button" onClick={() => onShowContentHistory(content)}>집계 변경 이력</button></div></header>
                            <div className="project-performance-grid"><PerformanceSummary title="현재 성과" aggregate={content.currentPerformance} canSeeRevenue={canSeeRevenue} /><PerformanceSummary title="누적 게시 성과" aggregate={content.cumulativePerformance} canSeeRevenue={canSeeRevenue} /></div>
                            {byChannel.length > 0 ? <div className="project-publication-timelines">{byChannel.map(publications => <PublicationTimeline key={publications[0].channelId} content={content} publications={publications} canEdit={canEditContent} canSeeRevenue={canSeeRevenue} onAction={onPublicationAction} onEdit={onEditPublication} onEditRevenue={onEditRevenue} onShowHistory={onShowPublicationHistory} />)}</div> : <p className="project-empty-publication">연결된 YouTube 동영상이 없습니다.</p>}
                        </article>
                    );
                })}
            </section>}
            {!videoView && <section className="project-section"><h2>프로젝트 상태 변경 이력</h2><ol className="project-history">{[...detail.statusHistory].reverse().map((item, index) => <li key={`${item.changedAt}-${index}`}><strong>{STATUS_LABEL[item.status]}</strong><span>{new Date(item.changedAt).toLocaleString('ko-KR')} · {item.changedByName}</span></li>)}</ol></section>}
        </>
    );
}

const PRIMARY_REASON_LABEL: Record<PrimaryProjectChangeReasonType, string> = {
    MERGED: '합본 제작',
    CONNECTION_CORRECTION: '연결 정정',
    PERFORMANCE_ATTRIBUTION: '성과 귀속 변경',
    OTHER: '기타'
};

/** DEFAULT 단가 변경 확인에서 역할별로 허용된 영향 정보만 표시합니다. */
function DefaultRateImpactNotice({ confirmation, canSeeRevenue }: { confirmation: DefaultRateChangeConfirmation; canSeeRevenue: boolean }) {
    return <section className="youtube-impact-notice" aria-live="polite">
        <strong>저장하면 채널 기본 단가 적용값이 함께 변경됩니다.</strong>
        <ul>{confirmation.impacts.map(impact => <li key={impact.publicationId}>
            <span>{impact.channelName} · YouTube 동영상 #{impact.publicationId}</span>
            {canSeeRevenue && impact.currentRate !== undefined && impact.nextRate !== undefined && <small>{impact.currentRate}원 → {impact.nextRate}원{impact.estimatedRevenueDelta ? ` · 예상 수익 변화 ${formatMoney(impact.estimatedRevenueDelta)}원` : ''}</small>}
        </li>)}</ul>
        <p>표시된 영향을 확인한 뒤 다시 저장해 주세요.</p>
    </section>;
}

/** 중복 YouTube 동영상의 기존 등록 위치와 권한별 다음 행동을 안내합니다. */
function DuplicateYouTubeVideoNotice({ duplicate, onOpen }: { duplicate: DuplicateYouTubeVideoLocation; onOpen: (duplicate: DuplicateYouTubeVideoLocation) => void }) {
    return <aside className="youtube-duplicate-notice" role="status">
        <strong>이미 등록된 YouTube 동영상입니다.</strong>
        {duplicate.canAccess ? <>
            <dl>
                <div><dt>콘텐츠</dt><dd>{duplicate.contentTitle}</dd></div>
                <div><dt>프로젝트</dt><dd>{duplicate.projectTitle}</dd></div>
                <div><dt>채널</dt><dd>{duplicate.channelName}</dd></div>
            </dl>
            <button type="button" className="project-button project-button--primary" onClick={() => onOpen(duplicate)}>기존 콘텐츠 보기</button>
        </> : <p>제작팀의 다른 콘텐츠에 등록되어 있습니다. 확인하려면 프로젝트 관리자에게 문의해 주세요.</p>}
    </aside>;
}

/** 연결 프로젝트와 신규 후보에 같은 행 표시를 사용합니다. */
function ConnectionProjectList({ items, disabled, readOnly = false, onMutate }: { items: VideoContentProjectCandidate[]; disabled: boolean; readOnly?: boolean; onMutate: (item: VideoContentProjectCandidate) => void }) {
    return <ul>{items.map(item => {
        const reason = item.primary ? '성과 집계 프로젝트를 먼저 변경해 주세요.'
            : item.archived ? '프로젝트를 복원한 뒤 연결을 변경할 수 있습니다.'
                : !item.canManage ? '이 프로젝트를 관리할 권한이 없습니다.' : undefined;
        return <li key={item.projectId}>
            <div><strong>{item.title}</strong><small>{item.projectGroupName ?? '프로젝트 그룹 없음'}{item.archived ? ' · 보관됨' : ''}</small></div>
            <div>
                {item.primary && <span className="project-primary-badge">성과 집계 대상</span>}
                {!readOnly && <button type="button" className={item.connected ? 'project-button project-button--danger' : 'project-button project-button--primary'} disabled={disabled || Boolean(reason)} title={reason} onClick={() => onMutate(item)}>{item.connected ? '연결 해제' : '연결'}</button>}
            </div>
        </li>;
    })}</ul>;
}

type YouTubeManagementModalProps = {
    state: YouTubeModalState;
    channels: WorkspaceChannelListItem[];
    canSeeRevenue: boolean;
    submitting: boolean;
    onChange: React.Dispatch<React.SetStateAction<YouTubeModalState | null>>;
    onClose: () => void;
    onOpenDuplicateLocation: (duplicate: DuplicateYouTubeVideoLocation) => void;
    onSubmitContent: () => void;
    onSubmitContentDeletion: () => void;
    onSubmitPublication: () => void;
    onSubmitRevenue: () => void;
    onSearchConnections: (keyword: string, page?: number) => void;
    onMutateConnection: (candidate: VideoContentProjectCandidate) => void;
    onSubmitPrimary: () => void;
};

/** 영상 결과물·게시물의 입력, 연결과 이력을 목적별 전용 모달로 표시합니다. */
function YouTubeManagementModal({ state, channels, canSeeRevenue, submitting, onChange, onClose, onOpenDuplicateLocation, onSubmitContent, onSubmitContentDeletion, onSubmitPublication, onSubmitRevenue, onSearchConnections, onMutateConnection, onSubmitPrimary }: YouTubeManagementModalProps) {
    const title = state.kind === 'CONTENT_FORM' ? state.content ? '콘텐츠 수정' : '콘텐츠 추가'
        : state.kind === 'PUBLICATION_FORM' ? state.publication ? '동영상 정보 수정' : 'YouTube 동영상 추가'
            : state.kind === 'REVENUE_FORM' ? '예상 수익 설정'
                : state.kind === 'CONNECTIONS' ? '프로젝트 연결 관리'
                    : state.kind === 'PRIMARY_FORM' ? '성과 집계 프로젝트 변경'
                        : state.kind === 'CONTENT_DELETE' ? '콘텐츠 삭제'
                        : state.kind === 'CONTENT_HISTORY' ? '집계 프로젝트 변경 이력'
                            : '동영상 상태 이력';
    const description = state.kind === 'CONTENT_FORM' ? state.content ? '콘텐츠의 제목과 유형을 설정합니다.' : '콘텐츠와 YouTube 동영상을 한 번에 추가할 수 있습니다.'
        : state.kind === 'PUBLICATION_FORM' ? state.publication ? 'YouTube 동영상의 Channel과 게시 시점을 관리합니다.' : '기존 콘텐츠에 추가 업로드·재업로드 동영상을 연결합니다.'
            : state.kind === 'REVENUE_FORM' ? '조회수 기반 예상 플랫폼 수익 계산 방식을 설정합니다.'
                : state.kind === 'CONNECTIONS' ? '같은 제작팀의 관리 가능한 프로젝트를 연결하거나 해제합니다.'
                    : state.kind === 'PRIMARY_FORM' ? '이 영상의 콘텐츠 성과가 집계될 프로젝트를 선택합니다.'
                        : state.kind === 'CONTENT_DELETE' ? 'YouTube 동영상이 연결되지 않은 콘텐츠를 완전히 삭제합니다.'
                        : '저장된 변경 기록을 최신순으로 확인합니다.';

    return <ProjectGroupModal titleId="youtube-management-modal-title" title={title} description={description} onRequestClose={onClose}>
        {state.kind === 'CONTENT_FORM' && <form className="project-form youtube-management-form" onSubmit={event => { event.preventDefault(); onSubmitContent(); }} noValidate>
            <label>
                <span>콘텐츠 제목</span>
                <input
                    id="video-content-title"
                    data-autofocus
                    value={state.title}
                    maxLength={150}
                    aria-invalid={Boolean(state.fieldErrors.title)}
                    aria-describedby={state.fieldErrors.title ? 'video-content-title-error' : undefined}
                    onChange={event => onChange({ ...state, title: event.target.value, confirmation: null, fieldErrors: { ...state.fieldErrors, title: undefined }, error: null })}
                />
                {state.fieldErrors.title && <small id="video-content-title-error" role="alert">{state.fieldErrors.title}</small>}
            </label>
            <ProjectChoiceField name="video-content-type" legend="콘텐츠 유형" value={state.videoType} options={[{ value: 'LONG', label: '롱폼' }, { value: 'SHORTS', label: '쇼츠' }]} onChange={value => onChange({ ...state, videoType: value as ProjectVideoType, confirmation: null, error: null })} />
            {!state.content && <section className="youtube-initial-publication" aria-labelledby="initial-publication-title">
                <div>
                    <h3 id="initial-publication-title">YouTube 동영상 연결 <em>선택</em></h3>
                    <p>이미 YouTube에 올린 동영상이 있다면 URL 또는 영상 ID를 입력하세요. 비워 두면 콘텐츠만 저장됩니다.</p>
                </div>
                <label>
                    <span>YouTube URL 또는 영상 ID</span>
                    <input value={state.youtubeVideo} placeholder="YouTube URL 또는 11자리 영상 ID" aria-invalid={Boolean(state.fieldErrors.youtubeVideo)} aria-describedby={state.fieldErrors.youtubeVideo ? 'initial-youtube-video-error' : undefined} onChange={event => onChange({ ...state, youtubeVideo: event.target.value, duplicateLocation: null, fieldErrors: { ...state.fieldErrors, youtubeVideo: undefined }, error: null })} />
                    {state.fieldErrors.youtubeVideo && <small id="initial-youtube-video-error" role="alert">{state.fieldErrors.youtubeVideo}</small>}
                </label>
                {state.youtubeVideo.trim() && <div className="youtube-initial-publication__details">
                    <label>
                        <span>게시 채널</span>
                        <select value={state.channelId} aria-invalid={Boolean(state.fieldErrors.channelId)} aria-describedby={state.fieldErrors.channelId ? 'initial-channel-error' : undefined} onChange={event => onChange({ ...state, channelId: event.target.value, fieldErrors: { ...state.fieldErrors, channelId: undefined }, error: null })}>{channels.map(channel => <option key={channel.channelId} value={channel.channelId}>{channel.name}</option>)}</select>
                        {state.fieldErrors.channelId && <small id="initial-channel-error" role="alert">{state.fieldErrors.channelId}</small>}
                    </label>
                    <label>
                        <span>실제 게시 일시 <em>선택</em></span>
                        <input type="datetime-local" value={state.publishedAt} aria-invalid={Boolean(state.fieldErrors.publishedAt)} aria-describedby={state.fieldErrors.publishedAt ? 'initial-published-at-error' : undefined} onChange={event => onChange({ ...state, publishedAt: event.target.value, fieldErrors: { ...state.fieldErrors, publishedAt: undefined }, error: null })} />
                        {state.fieldErrors.publishedAt && <small id="initial-published-at-error" role="alert">{state.fieldErrors.publishedAt}</small>}
                    </label>
                    {canSeeRevenue ? <>
                        <ProjectChoiceField name="initial-publication-revenue-option" legend="예상 수익 방식" value={state.revenueOption} options={[{ value: 'DEFAULT', label: '채널 기본 단가' }, { value: 'CUSTOM', label: '동영상 개별 단가' }, { value: 'DISABLED', label: '수익 계산 안 함' }]} onChange={value => onChange({ ...state, revenueOption: value as ProjectRevenueOption, fieldErrors: { ...state.fieldErrors, customRevenuePerView: undefined }, error: null })} />
                        {state.revenueOption === 'CUSTOM' && <label>
                            <span>조회당 개별 단가</span>
                            <input inputMode="decimal" value={state.customRate} placeholder="0" aria-invalid={Boolean(state.fieldErrors.customRevenuePerView)} aria-describedby={state.fieldErrors.customRevenuePerView ? 'initial-custom-rate-error' : undefined} onChange={event => onChange({ ...state, customRate: event.target.value, fieldErrors: { ...state.fieldErrors, customRevenuePerView: undefined }, error: null })} onBlur={() => { const result = normalizeRateInput(state.customRate); onChange(result.success ? { ...state, customRate: result.value, fieldErrors: { ...state.fieldErrors, customRevenuePerView: undefined } } : { ...state, fieldErrors: { ...state.fieldErrors, customRevenuePerView: result.message } }); }} />
                            {state.fieldErrors.customRevenuePerView && <small id="initial-custom-rate-error" role="alert">{state.fieldErrors.customRevenuePerView}</small>}
                        </label>}
                    </> : <p className="youtube-helper-text">채널 기본 단가 방식이 적용되며 금액 정보는 제작팀 소유자와 관리자만 확인할 수 있습니다.</p>}
                </div>}
            </section>}
            {state.duplicateLocation && <DuplicateYouTubeVideoNotice duplicate={state.duplicateLocation} onOpen={onOpenDuplicateLocation} />}
            {state.confirmation && <DefaultRateImpactNotice confirmation={state.confirmation} canSeeRevenue={canSeeRevenue} />}
            {state.error && <FeedbackMessage type="error" message={state.error} />}
            <ProjectModalActions onCancel={onClose} submitLabel={state.confirmation ? '영향 확인 후 저장' : state.content ? '저장' : state.youtubeVideo.trim() ? '콘텐츠와 동영상 추가' : '콘텐츠 추가'} submitting={submitting} />
        </form>}

        {state.kind === 'PUBLICATION_FORM' && (() => {
            const selectedChannelId = Number(state.channelId);
            const current = state.content.publications.find(item => item.publicationId !== state.publication?.publicationId && item.channelId === selectedChannelId && item.lifecycleStatus === 'CURRENT');
            return <form className="project-form youtube-management-form" onSubmit={event => { event.preventDefault(); onSubmitPublication(); }} noValidate>
                {!state.publication && <label><span>YouTube URL 또는 영상 ID</span><input data-autofocus value={state.youtubeVideo} placeholder="YouTube URL 또는 11자리 영상 ID" onChange={event => onChange({ ...state, youtubeVideo: event.target.value, duplicateLocation: null, fieldError: null })} /></label>}
                <label><span>게시 채널</span><select value={state.channelId} disabled={Boolean(state.publication && state.publication.lifecycleStatus !== 'CURRENT')} onChange={event => onChange({ ...state, channelId: event.target.value, confirmation: null, fieldError: null })}>{channels.map(channel => <option key={channel.channelId} value={channel.channelId}>{channel.name}</option>)}</select></label>
                <label><span>실제 게시 일시 <em>선택</em></span><input type="datetime-local" value={state.publishedAt} onChange={event => onChange({ ...state, publishedAt: event.target.value, confirmation: null, fieldError: null })} /></label>
                {!state.publication && canSeeRevenue && <>
                    <ProjectChoiceField name="publication-revenue-option" legend="예상 수익 방식" value={state.revenueOption} options={[{ value: 'DEFAULT', label: '채널 기본 단가' }, { value: 'CUSTOM', label: '동영상 개별 단가' }, { value: 'DISABLED', label: '수익 계산 안 함' }]} onChange={value => onChange({ ...state, revenueOption: value as ProjectRevenueOption, fieldError: null })} />
                    {state.revenueOption === 'CUSTOM' && <label><span>조회당 개별 단가</span><input inputMode="decimal" value={state.customRate} placeholder="0" onChange={event => onChange({ ...state, customRate: event.target.value, fieldError: null })} onBlur={() => { const result = normalizeRateInput(state.customRate); onChange(result.success ? { ...state, customRate: result.value, fieldError: null } : { ...state, fieldError: result.message }); }} /></label>}
                </>}
                {!state.publication && !canSeeRevenue && <p className="youtube-helper-text">채널 기본 단가 방식이 적용되며 금액 정보는 제작팀 소유자와 관리자만 확인할 수 있습니다.</p>}
                {current && <p className="youtube-replacement-notice"><strong>{current.channelName}</strong>의 게시 중 동영상 #{current.publicationId}을 대체합니다. 기존 성과와 상태 이력은 보존됩니다.</p>}
                {state.duplicateLocation && <DuplicateYouTubeVideoNotice duplicate={state.duplicateLocation} onOpen={onOpenDuplicateLocation} />}
                {state.confirmation && <DefaultRateImpactNotice confirmation={state.confirmation} canSeeRevenue={canSeeRevenue} />}
                {state.fieldError && <FeedbackMessage type="error" message={state.fieldError} />}
                <ProjectModalActions onCancel={onClose} submitLabel={state.confirmation ? '영향 확인 후 저장' : state.publication ? '저장' : '등록'} submitting={submitting} />
            </form>;
        })()}

        {state.kind === 'REVENUE_FORM' && <form className="project-form youtube-management-form" onSubmit={event => { event.preventDefault(); onSubmitRevenue(); }} noValidate>
            <ProjectChoiceField name="revenue-setting-option" legend="예상 수익 방식" value={state.revenueOption} options={[{ value: 'DEFAULT', label: '채널 기본 단가' }, { value: 'CUSTOM', label: '동영상 개별 단가' }, { value: 'DISABLED', label: '수익 계산 안 함' }]} onChange={value => onChange({ ...state, revenueOption: value as ProjectRevenueOption, fieldError: null })} />
            {state.revenueOption === 'CUSTOM' && <label><span>조회당 개별 단가</span><input data-autofocus inputMode="decimal" value={state.customRate} placeholder="0" onChange={event => onChange({ ...state, customRate: event.target.value, fieldError: null })} onBlur={() => { const result = normalizeRateInput(state.customRate); onChange(result.success ? { ...state, customRate: result.value, fieldError: null } : { ...state, fieldError: result.message }); }} /></label>}
            <p className="youtube-helper-text">이 설정은 예상 플랫폼 수익에만 사용되며 실제 수익·손익·ROI에는 포함되지 않습니다.</p>
            {state.fieldError && <FeedbackMessage type="error" message={state.fieldError} />}
            <ProjectModalActions onCancel={onClose} submitLabel="저장" submitting={submitting} />
        </form>}

        {state.kind === 'CONNECTIONS' && <div className="youtube-connection-manager" aria-busy={state.loading}>
            <h3>현재 연결된 프로젝트</h3>
            {state.connectedProjects.length > 0
                ? <ConnectionProjectList items={state.connectedProjects} disabled={submitting || state.loading} readOnly={state.readOnly} onMutate={onMutateConnection} />
                : !state.loading && !state.error && <p className="youtube-connection-empty">조회할 수 있는 연결 프로젝트가 없습니다.</p>}
            {!state.readOnly && <>
                <h3>연결할 프로젝트</h3>
                <form className="youtube-connection-search" onSubmit={event => { event.preventDefault(); if (!submitting) onSearchConnections(state.keyword); }}>
                    <input data-autofocus aria-label="연결할 프로젝트 이름 검색" value={state.keyword} placeholder="프로젝트 이름 검색" onChange={event => {
                        const keyword = event.target.value;
                        onChange(current => current?.kind === 'CONNECTIONS' ? { ...current, keyword } : current);
                    }} />
                    <button className="project-button" type="submit" disabled={submitting}>검색</button>
                </form>
                {!state.loading && !state.error && (state.candidates.length > 0
                    ? <ConnectionProjectList items={state.candidates} disabled={submitting} onMutate={onMutateConnection} />
                    : <p className="youtube-connection-empty">{state.appliedKeyword.trim() ? '검색 결과가 없습니다.' : '추가로 연결할 수 있는 프로젝트가 없습니다.'}</p>)}
                {!state.loading && state.totalPages > 1 && <nav className="project-pagination" aria-label="연결 후보 페이지">
                    <button className="project-button" type="button" disabled={submitting || state.page <= 1} onClick={() => onSearchConnections(state.appliedKeyword, state.page - 1)}>이전</button>
                    <span>{state.page} / {state.totalPages}</span>
                    <button className="project-button" type="button" disabled={submitting || state.page >= state.totalPages} onClick={() => onSearchConnections(state.appliedKeyword, state.page + 1)}>다음</button>
                </nav>}
            </>}
            {state.loading && <p role="status">프로젝트를 불러오는 중...</p>}
            {state.error && <FeedbackMessage type="error" message={state.error} />}
            <ProjectModalActions onCancel={onClose} cancelLabel="닫기" />
        </div>}

        {state.kind === 'PRIMARY_FORM' && <form className="project-form youtube-management-form" onSubmit={event => { event.preventDefault(); onSubmitPrimary(); }} noValidate>
            <label><span>새 성과 집계 프로젝트</span><select data-autofocus value={state.projectId} onChange={event => onChange({ ...state, projectId: event.target.value, error: null, needsPerformanceConfirmation: false })}><option value="">선택</option>{state.candidates.map(candidate => <option key={candidate.projectId} value={candidate.projectId}>{candidate.title} · {candidate.projectGroupName ?? '그룹 없음'}</option>)}</select></label>
            {state.candidates.length === 0 && <p className="youtube-helper-text">변경할 수 있는 활성 연결 프로젝트가 없습니다. 먼저 `연결 관리`에서 프로젝트를 연결해 주세요.</p>}
            <ProjectChoiceField name="primary-change-reason" legend="변경 사유" value={state.reasonType} options={Object.entries(PRIMARY_REASON_LABEL).map(([value, label]) => ({ value, label }))} onChange={value => onChange({ ...state, reasonType: value as PrimaryProjectChangeReasonType, error: null })} />
            <label><span>사유 메모 <em>선택</em></span><textarea value={state.reason} maxLength={255} rows={3} onChange={event => onChange({ ...state, reason: event.target.value, error: null })} /></label>
            {state.needsPerformanceConfirmation && <label className="youtube-replacement-confirm"><input type="checkbox" required /><span>콘텐츠 성과가 새 프로젝트 그룹으로 이동하고 실제 비용·수익은 이동하지 않음을 확인했습니다.</span></label>}
            {state.error && <FeedbackMessage type={state.needsPerformanceConfirmation ? 'info' : 'error'} message={state.error} />}
            <ProjectModalActions onCancel={onClose} submitLabel={state.needsPerformanceConfirmation ? '영향 확인 후 변경' : '변경'} submitting={submitting} submittingLabel="변경 중…" submitDisabled={!state.projectId} />
        </form>}

        {state.kind === 'CONTENT_DELETE' && <div className="youtube-content-deletion">
            <strong>{state.content.title}</strong>
            <p>연결된 YouTube 동영상이 없어 완전히 삭제할 수 있습니다. 삭제한 콘텐츠와 대표 프로젝트 변경 이력은 복구할 수 없습니다.</p>
            {state.error && <FeedbackMessage type="error" message={state.error} />}
            <ProjectModalActions onCancel={onClose} submitLabel="콘텐츠 삭제" submitting={submitting} submittingLabel="삭제 중…" submitVariant="danger" onSubmit={onSubmitContentDeletion} />
        </div>}

        {state.kind === 'CONTENT_HISTORY' && <div className="youtube-history-list">{state.content.primaryProjectHistory.length === 0 ? <p>변경 이력이 없습니다.</p> : <ol>{[...state.content.primaryProjectHistory].reverse().map((history, index) => <li key={`${history.changedAt}-${index}`}><strong>{PRIMARY_REASON_LABEL[history.reasonType]}</strong><span>{history.fromProjectName ?? '없음'} → {history.toProjectName}</span><small>{history.fromProjectGroupName ?? '그룹 없음'} → {history.toProjectGroupName ?? '그룹 없음'} · {history.reason ?? '메모 없음'} · {history.changedByName} · {new Date(history.changedAt).toLocaleString('ko-KR')}</small></li>)}</ol>}<ProjectModalActions onCancel={onClose} cancelLabel="닫기" /></div>}

        {state.kind === 'PUBLICATION_HISTORY' && <div className="youtube-history-list">{state.publication.statusHistory.length === 0 ? <p>변경 이력이 없습니다.</p> : <ol>{[...state.publication.statusHistory].reverse().map((history, index) => <li key={`${history.changedAt}-${index}`}><strong>{history.fromStatus ? PUBLICATION_STATUS_LABEL[history.fromStatus] : '등록'} → {PUBLICATION_STATUS_LABEL[history.toStatus]}</strong><span>{history.reason ?? '사유 없음'}</span><small>{history.changedByName} · {new Date(history.changedAt).toLocaleString('ko-KR')}{history.relatedPublicationId ? ` · 관련 동영상 #${history.relatedPublicationId}` : ''}</small></li>)}</ol>}<ProjectModalActions onCancel={onClose} cancelLabel="닫기" /></div>}
    </ProjectGroupModal>;
}

type ProjectModalActionsProps = {
    onCancel: () => void;
    onSubmit?: () => void;
    cancelLabel?: string;
    submitLabel?: string;
    submitting?: boolean;
    submittingLabel?: string;
    submitDisabled?: boolean;
    submitVariant?: 'primary' | 'danger';
};

/** 프로젝트 영역 모달의 취소·확정 버튼 순서와 공통 디자인을 한 곳에서 유지합니다. */
function ProjectModalActions({ onCancel, onSubmit, cancelLabel = '취소', submitLabel, submitting = false, submittingLabel = '저장 중…', submitDisabled = false, submitVariant = 'primary' }: ProjectModalActionsProps) {
    return (
        <div className="project-form__actions">
            <button type="button" className="project-button" disabled={submitting} onClick={onCancel}>{cancelLabel}</button>
            {submitLabel && <button type={onSubmit ? 'button' : 'submit'} className={`project-button project-button--${submitVariant}`} disabled={submitting || submitDisabled} onClick={onSubmit}>{submitting ? submittingLabel : submitLabel}</button>}
        </div>
    );
}

type ProjectChoice = {
    value: string;
    label: string;
    danger?: boolean;
};

/** 고정된 소수 선택지를 한눈에 비교할 수 있는 라디오 카드 그룹으로 표시합니다. */
function ProjectChoiceField({ name, legend, value, options, error, onChange }: { name: string; legend: string; value: string; options: ProjectChoice[]; error?: string; onChange: (value: string) => void }) {
    const errorId = `${name}-error`;

    return (
        <fieldset
            className="project-choice-group"
            aria-invalid={Boolean(error)}
            aria-describedby={error ? errorId : undefined}
        >
            <legend>{legend}</legend>
            <div className="project-choice-options">
                {options.map(option => (
                    <label
                        key={option.value}
                        className={[
                            'project-choice-option',
                            option.danger ? 'project-choice-option--danger' : ''
                        ].filter(Boolean).join(' ')}
                    >
                        <input
                            type="radio"
                            name={name}
                            value={option.value}
                            checked={value === option.value}
                            onChange={event => onChange(event.target.value)}
                        />
                        <span>{option.label}</span>
                    </label>
                ))}
            </div>
            {error && <small id={errorId} role="alert">{error}</small>}
        </fieldset>
    );
}

/** 생성과 수정에서 동일한 순서와 모바일 조작감을 공유하는 폼입니다. */
function ProjectForm({ formRef, values, errors, channels, groups, edit, admin, submitting, onChange, onSubmit, onCancel }: { formRef: React.RefObject<HTMLFormElement | null>; values: FormValues; errors: Errors; channels: WorkspaceChannelListItem[]; groups: ReturnType<typeof getProjectGroupOptions>; edit: boolean; admin: boolean; submitting: boolean; onChange: (field: keyof FormValues, value: string) => void; onSubmit: (event: React.SubmitEvent<HTMLFormElement>) => void; onCancel: () => void }) {
    const statusOptions = Object.entries(STATUS_LABEL)
        .filter(([status]) => status === 'PLANNING' || status === 'EDITING')
        .map(([status, label]) => ({
            value: status,
            label: status === 'CANCELLED' ? '제작 취소' : label,
            danger: status === 'CANCELLED'
        }));

    return (
        <form ref={formRef} className="project-form" onSubmit={onSubmit} noValidate>
            {/* 제목과 내용은 자유 입력값이므로 기존 텍스트 필드를 유지합니다. */}
            <label>
                <span>프로젝트 제목</span>
                <input data-autofocus value={values.title} maxLength={150} aria-invalid={Boolean(errors.title)} onChange={event => onChange('title', event.target.value)} />
                {errors.title && <small>{errors.title}</small>}
            </label>
            <label>
                <span>내용 <em>선택</em></span>
                <textarea value={values.content} maxLength={2000} rows={4} onChange={event => onChange('content', event.target.value)} />
            </label>

            {/* 채널은 증가 가능한 자원이고 영상 유형은 고정 선택지이므로 조작 방식을 구분합니다. */}
            <label>
                <span>채널</span>
                <select value={values.channelId} aria-invalid={Boolean(errors.channelId)} onChange={event => onChange('channelId', event.target.value)}>
                    <option value="">선택</option>
                    {channels.map(item => <option key={item.channelId} value={item.channelId}>{item.name}</option>)}
                </select>
                {errors.channelId && <small>{errors.channelId}</small>}
            </label>
            <ProjectChoiceField
                name="project-video-type"
                legend="기본 콘텐츠 유형"
                value={values.videoType}
                options={[
                    { value: 'LONG', label: '롱폼' },
                    { value: 'SHORTS', label: '쇼츠' }
                ]}
                error={errors.videoType}
                onChange={value => onChange('videoType', value)}
            />

            {/* 상태 변경은 상세 정보 탭에서 처리하고 생성 시에만 초기 상태 두 개를 제공합니다. */}
            {!edit && <ProjectChoiceField
                name="project-status"
                legend="프로젝트 상태"
                value={values.status}
                options={statusOptions}
                onChange={value => onChange('status', value)}
            />}
            {admin && (
                <label>
                    <span>프로젝트 그룹 <em>선택</em></span>
                    <select value={values.projectGroupId} onChange={event => onChange('projectGroupId', event.target.value)}>
                        <option value="">그룹 없음</option>
                        {groups.map(item => <option key={item.projectGroupId} value={item.projectGroupId}>{item.name}</option>)}
                    </select>
                </label>
            )}

            {/* 일정 입력은 관련성이 높은 두 날짜를 같은 행에 유지합니다. */}
            <div className="project-form__columns">
                <label>
                    <span>마감일 <em>선택</em></span>
                    <input type="date" value={values.dueDate} onChange={event => onChange('dueDate', event.target.value)} />
                </label>
                <label>
                    <span>업로드 예정일 <em>선택</em></span>
                    <input type="date" value={values.plannedUploadDate} aria-invalid={Boolean(errors.plannedUploadDate)} onChange={event => onChange('plannedUploadDate', event.target.value)} />
                    {errors.plannedUploadDate && <small>{errors.plannedUploadDate}</small>}
                </label>
            </div>
            <div className="project-form__actions">
                <button type="button" className="project-button" disabled={submitting} onClick={onCancel}>취소</button>
                <button className="project-button project-button--primary" disabled={submitting}>{submitting ? '저장 중...' : '저장'}</button>
            </div>
        </form>
    );
}

export default ProjectsPage;
