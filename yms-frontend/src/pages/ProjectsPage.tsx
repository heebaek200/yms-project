import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Link, useBlocker, useLocation, useNavigate, useParams, useSearchParams } from 'react-router';
import { getWorkspaceChannels } from '../api/workspaces/channels';
import { createWorkspaceProject, deleteWorkspaceProject, getProjectGroupOptions, getWorkspaceProject, getWorkspaceProjects, setWorkspaceProjectArchived, updateWorkspaceProject, type SaveProjectRequest } from '../api/projects/projects';
import {
    changeVideoContentPrimaryProject,
    createProjectVideoContent,
    createYouTubePublication,
    removeYouTubePublication,
    restoreYouTubePublication,
    syncYouTubePublication
} from '../api/projects/youtube';
import CompositionSafeSearchInput from '../components/common/CompositionSafeSearchInput';
import FeedbackMessage, { type FeedbackMessageType } from '../components/common/FeedbackMessage';
import FilterResetButton from '../components/common/FilterResetButton';
import ProjectAreaTabs from '../components/project-groups/ProjectAreaTabs';
import ProjectGroupModal from '../components/project-groups/ProjectGroupModal';
import ProjectDetailTabs from '../components/projects/ProjectDetailTabs';
import { useAuth } from '../contexts/AuthContext';
import { useWorkspace } from '../hooks/useWorkspace';
import { registerUnsavedChangesGuard } from '../navigation/unsavedChangesGuard';
import type { ProjectAccessRole, ProjectDetailResponse, ProjectListItemResponse, ProjectVideoType, VideoContentResponse, YouTubePublicationResponse, YouTubeRemovalReason } from '../types/project';
import type { ProjectStatus } from '../types/projectGroup';
import type { WorkspaceChannelListItem } from '../types/workspaceSettings';
import { formatMoney } from '../utils/decimal';
import './ProjectGroupPage.css';
import './ProjectsPage.css';
import '../components/common/ResourceNavigationLink.css';

type FormValues = { title: string; content: string; channelId: string; projectGroupId: string; videoType: '' | ProjectVideoType; status: ProjectStatus; dueDate: string; plannedUploadDate: string };
type Feedback = { type: FeedbackMessageType; message: string };
type Errors = Partial<Record<keyof FormValues, string>>;
type PublicationDraft = { youtubeVideo: string; channelId: string };
const STATUS_LABEL: Record<ProjectStatus, string> = { PLANNING: '준비 중', EDITING: '편집 중', REVIEW: '검수 중', UPLOADED: '업로드 완료', CANCELLED: '취소' };
const EMPTY_FORM: FormValues = { title: '', content: '', channelId: '', projectGroupId: '', videoType: '', status: 'PLANNING', dueDate: '', plannedUploadDate: '' };

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
    const [publicationDrafts, setPublicationDrafts] = useState<Record<number, PublicationDraft>>({});
    const [publicationErrors, setPublicationErrors] = useState<Record<number, string>>({});
    const allowNavigation = useRef(false);
    const formRef = useRef<HTMLFormElement>(null);
    const latestReadRequestIdRef = useRef(0);
    const latestChannelRequestIdRef = useRef(0);
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
    useEffect(() => { setPublicationDrafts({}); setPublicationErrors({}); }, [currentWorkspace?.workspaceId, projectId]);
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
        if (!currentWorkspace || !form.videoType) { setErrors(current => ({ ...current, videoType: '영상 유형을 선택해 주세요.' })); return; }
        let confirmContentPerformanceMove = false;
        if (editingProject && isAdmin && Number(form.projectGroupId || 0) !== (editingProject.projectGroupId ?? 0)) {
            const hasFinance = [editingProject.workerAmount, editingProject.directExpenseAmount, editingProject.directRevenueAmount]
                .some(value => value !== undefined && value !== '0.00');
            const hasContentPerformance = editingProject.videoContents.some(content => (
                content.primaryProjectId === editingProject.projectId
                && content.cumulativePerformance.includedPublicationCount > 0
            ));
            if ((hasFinance || hasContentPerformance) && !window.confirm(`프로젝트 그룹을 변경할까요?\n\n${hasFinance ? '• 작업자 금액과 직접 비용·수익의 그룹 집계가 이동합니다.\n' : ''}${hasContentPerformance ? '• 이 프로젝트가 성과 집계 대상인 영상 결과물의 콘텐츠 성과가 이동합니다.\n' : ''}그룹에 직접 등록한 비용·수익은 이동하지 않습니다.`)) return;
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
                if (!window.confirm(`${content.title} 결과물의 성과 집계 프로젝트를 #${candidates[0]}로 이전하고 삭제할까요?`)) return;
                primaryProjectReassignments.push({ videoContentId: content.videoContentId, newPrimaryProjectId: candidates[0] });
            } else if (candidates.length > 1) {
                const selected = Number(window.prompt(`${content.title} 결과물의 새 성과 집계 프로젝트 ID를 입력해 주세요.\n선택 가능: ${candidates.join(', ')}`, String(candidates[0])));
                if (!candidates.includes(selected)) {
                    setFeedback({ type: 'error', message: '연결된 프로젝트 중에서 새 성과 집계 프로젝트를 선택해 주세요.' });
                    return;
                }
                primaryProjectReassignments.push({ videoContentId: content.videoContentId, newPrimaryProjectId: selected });
            }
        }
        if (!window.confirm('프로젝트를 삭제할까요? 비용·수익·정산과 영상 게시 이력은 유지됩니다.')) return;
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

    /** Project 기본값으로 결과물을 즉시 만들고 게시물 등록 단계로 이어갑니다. */
    const addVideoContent = async () => {
        if (!currentWorkspace || !detail) return;
        const response = await createProjectVideoContent(currentWorkspace.workspaceId, detail.projectId, {}, context);
        if (response.success) setDetail(response.data);
        setFeedback({ type: response.success ? 'success' : 'error', message: response.message ?? '' });
    };

    /** 결과물별 게시물 입력값을 서로 독립적으로 유지합니다. */
    const changePublicationDraft = (videoContentId: number, patch: Partial<PublicationDraft>) => {
        setPublicationDrafts(current => {
            const previous = current[videoContentId] ?? {
                youtubeVideo: '',
                channelId: String(detail?.channelId ?? '')
            };
            return { ...current, [videoContentId]: { ...previous, ...patch } };
        });
        if (patch.youtubeVideo !== undefined) {
            // 사용자가 값을 고치기 시작하면 이전 서버 검증 결과를 즉시 제거합니다.
            setPublicationErrors(current => {
                if (!(videoContentId in current)) return current;
                const next = { ...current };
                delete next[videoContentId];
                return next;
            });
        }
    };

    /** 긴 상세 화면에서도 오류가 난 게시물 입력란을 즉시 찾을 수 있게 포커스와 스크롤을 맞춥니다. */
    const focusPublicationInput = (videoContentId: number) => {
        window.requestAnimationFrame(() => {
            const input = document.getElementById(`project-youtube-video-${videoContentId}`);
            if (!(input instanceof HTMLInputElement)) return;
            input.focus({ preventScroll: true });

            // 이미 보이는 입력란은 화면을 움직이지 않고, 화면 밖에 있을 때만 가운데로 이동합니다.
            const bounds = input.getBoundingClientRect();
            if (bounds.top < 0 || bounds.bottom > window.innerHeight) {
                input.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
        });
    };

    /** 같은 Channel의 CURRENT가 있으면 명시적 대체 확인 후 새 게시물을 등록합니다. */
    const addPublication = async (content: VideoContentResponse) => {
        if (!currentWorkspace || !detail) return;
        const draft = publicationDrafts[content.videoContentId] ?? { youtubeVideo: '', channelId: String(detail.channelId) };
        const channelId = Number(draft.channelId);
        const current = content.publications.find(publication => publication.channelId === channelId && publication.lifecycleStatus === 'CURRENT');
        if (current && !window.confirm(`${current.channelName}의 현재 게시물을 새 게시물로 대체할까요? 기존 성과와 게시 이력은 보존됩니다.`)) return;

        setPublicationErrors(values => {
            const next = { ...values };
            delete next[content.videoContentId];
            return next;
        });
        setFeedback(null);
        const response = await createYouTubePublication(currentWorkspace.workspaceId, detail.projectId, content.videoContentId, { channelId, youtubeVideo: draft.youtubeVideo, supersedesPublicationId: current?.publicationId ?? null }, context);
        if (response.success) {
            setDetail(response.data);
            setPublicationDrafts(values => ({ ...values, [content.videoContentId]: { ...draft, youtubeVideo: '' } }));
            setFeedback({ type: 'success', message: response.message ?? '' });
            return;
        }
        if (response.errorCode === 'INVALID_YOUTUBE_VIDEO' || response.errorCode === 'DUPLICATE_YOUTUBE_VIDEO') {
            setPublicationErrors(values => ({ ...values, [content.videoContentId]: response.message }));
            focusPublicationInput(content.videoContentId);
            return;
        }
        setFeedback({ type: 'error', message: response.message });
    };

    /** 연결 Project 중 새 집계 대상을 선택하고 실제 그룹 간 성과 이동이 있을 때만 재확인합니다. */
    const changePrimaryProject = async (content: VideoContentResponse) => {
        if (!currentWorkspace || !detail) return;
        const candidates = content.connectedProjectIds.filter(candidateId => candidateId !== content.primaryProjectId);
        const selected = Number(window.prompt(`새 성과 집계 프로젝트 ID를 입력해 주세요.\n선택 가능: ${candidates.join(', ')}`, String(candidates[0] ?? '')));
        if (!candidates.includes(selected)) {
            setFeedback({ type: 'error', message: '연결된 다른 프로젝트 중에서 새 성과 집계 프로젝트를 선택해 주세요.' });
            return;
        }

        let response = await changeVideoContentPrimaryProject(
            currentWorkspace.workspaceId,
            detail.projectId,
            content.videoContentId,
            { newPrimaryProjectId: selected },
            context
        );
        // Mock API가 그룹 간 성과 이동을 감지한 경우에만 사용자 확인 후 같은 요청을 재시도합니다.
        if (!response.success && response.errorCode === 'CONTENT_PERFORMANCE_MOVE_CONFIRMATION_REQUIRED') {
            if (!window.confirm(`${response.message}\n\n계속 변경할까요?`)) return;
            response = await changeVideoContentPrimaryProject(
                currentWorkspace.workspaceId,
                detail.projectId,
                content.videoContentId,
                { newPrimaryProjectId: selected, confirmContentPerformanceMove: true },
                context
            );
        }
        if (response.success) setDetail(response.data);
        setFeedback({ type: response.success ? 'success' : 'error', message: response.message ?? '' });
    };

    /** 게시물별 동기화·종료·복원을 수행하고 전체 결과물 집계를 새 응답으로 교체합니다. */
    const mutatePublication = async (content: VideoContentResponse, publication: YouTubePublicationResponse, action: 'sync' | 'unavailable' | 'incorrect' | 'restore') => {
        if (!currentWorkspace || !detail) return;
        const base = [currentWorkspace.workspaceId, detail.projectId, content.videoContentId, publication.publicationId] as const;
        let response;
        if (action === 'sync') response = await syncYouTubePublication(...base, context);
        else if (action === 'restore') {
            const current = content.publications.find(item => item.channelId === publication.channelId && item.lifecycleStatus === 'CURRENT');
            if (current && !window.confirm(`${current.channelName}의 현재 게시물을 대체하고 이 게시물을 복원할까요?`)) return;
            response = await restoreYouTubePublication(...base, current?.publicationId ?? null, context);
        } else {
            const reason: YouTubeRemovalReason = action === 'incorrect' ? 'INCORRECT' : 'UNAVAILABLE';
            const message = reason === 'INCORRECT' ? '잘못 연결한 게시물로 처리할까요? 현재·누적 성과에서 모두 제외됩니다.' : '게시 종료 처리할까요? 마지막 성과는 누적 게시 성과에 남습니다.';
            if (!window.confirm(message)) return;
            response = await removeYouTubePublication(...base, reason, context);
        }
        if (response.success) setDetail(response.data);
        setFeedback({ type: response.success ? 'success' : 'error', message: response.message ?? '' });
    };

    const activeMember = detail?.members.find(member => member.userId === user?.userId && member.active);
    const canEdit = isAdmin || activeMember?.permission === 'EDIT';
    const canManage = isAdmin || activeMember?.isOwner === true;
    return <section className="project-area-page"><ProjectAreaTabs />{projectId === null ? <ProjectList projects={projects} channels={channels} groups={groups} loading={loading} error={error} params={params} totalPages={totalPages} onFilter={setFilter} onResetFilters={() => setParams(new URLSearchParams(), { replace: true })} onCreate={requestCreateForm} /> : <ProjectDetailView detail={detail} channels={channels} loading={loading} error={error} feedback={feedback} canSeeRevenue={isAdmin} canEdit={canEdit} canManage={canManage} publicationDrafts={publicationDrafts} publicationErrors={publicationErrors} onPublicationDraft={changePublicationDraft} onEdit={() => detail && openForm(detail)} onArchive={() => void archive()} onDelete={() => void remove()} onAddVideoContent={() => void addVideoContent()} onChangePrimaryProject={content => void changePrimaryProject(content)} onAddPublication={content => void addPublication(content)} onPublicationAction={(content, publication, action) => void mutatePublication(content, publication, action)} />}{modalOpen && <ProjectGroupModal titleId="project-form-title" title={editingProject ? '프로젝트 수정' : '새 프로젝트'} description="영상 제작 과정의 기본 정보와 시작 상태를 설정합니다." onRequestClose={closeForm}><ProjectForm formRef={formRef} values={form} errors={errors} channels={channels} groups={groups} edit={editingProject !== null} admin={isAdmin} submitting={submitting} onChange={change} onSubmit={submit} onCancel={closeForm} /></ProjectGroupModal>}</section>;
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

    if (canManageFinance) allowed.push('프로젝트 그룹과 게시물 예상 수익 확인');
    else restricted.push('프로젝트 그룹과 게시물 예상 수익 확인');

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
    channels: WorkspaceChannelListItem[];
    loading: boolean;
    error: string | null;
    feedback: Feedback | null;
    canSeeRevenue: boolean;
    canEdit: boolean;
    canManage: boolean;
    publicationDrafts: Record<number, PublicationDraft>;
    publicationErrors: Record<number, string>;
    onPublicationDraft: (videoContentId: number, patch: Partial<PublicationDraft>) => void;
    onEdit: () => void;
    onArchive: () => void;
    onDelete: () => void;
    onAddVideoContent: () => void;
    onChangePrimaryProject: (content: VideoContentResponse) => void;
    onAddPublication: (content: VideoContentResponse) => void;
    onPublicationAction: (content: VideoContentResponse, publication: YouTubePublicationResponse, action: 'sync' | 'unavailable' | 'incorrect' | 'restore') => void;
};

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
function PublicationTimeline({ content, publications, canEdit, canSeeRevenue, onAction }: { content: VideoContentResponse; publications: YouTubePublicationResponse[]; canEdit: boolean; canSeeRevenue: boolean; onAction: ProjectDetailViewProps['onPublicationAction'] }) {
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
                            <div className="project-publication__metrics">
                                <span>조회수 <strong>{performance ? performance.viewCount.toLocaleString() : '미집계'}</strong></span>
                                <span>좋아요 <strong>{performance ? performance.likeCount.toLocaleString() : '—'}</strong></span>
                                <span>댓글 <strong>{performance ? performance.commentCount.toLocaleString() : '—'}</strong></span>
                                {canSeeRevenue && <span>예상 수익 <strong>{performance ? `${formatMoney((performance.viewCount * Number(publication.appliedRate ?? 0)).toFixed(2))}원` : '—'}</strong></span>}
                            </div>
                            <p>{needsAttention ? `확인 필요 · ${performance?.lastErrorMessage ?? '동기화 실패'}` : performance?.lastSuccessAt ? `마지막 성공 ${new Date(performance.lastSuccessAt).toLocaleString('ko-KR')}` : '아직 동기화하지 않았습니다.'}</p>
                            {canSeeRevenue && <p>{publication.revenueOption === 'DEFAULT' ? '채널 기본 단가' : publication.revenueOption === 'CUSTOM' ? '개별 단가' : '수익 계산 안 함'} · 조회당 {publication.appliedRate}원</p>}
                            {canEdit && <div className="project-publication__actions">{publication.lifecycleStatus === 'CURRENT' ? <><button className="project-button" onClick={() => onAction(content, publication, 'sync')}>성과 동기화</button><button className="project-button" onClick={() => onAction(content, publication, 'unavailable')}>게시 종료</button><button className="project-button project-button--danger" onClick={() => onAction(content, publication, 'incorrect')}>잘못 연결</button></> : <button className="project-button" onClick={() => onAction(content, publication, 'restore')}>게시 중으로 복원</button>}</div>}
                        </li>
                    );
                })}
            </ol>
        </section>
    );
}

/** URL 탭에 따라 프로젝트 기본 정보와 영상 결과물을 분리해 표시합니다. */
function ProjectDetailView({ detail, channels, loading, error, feedback, canSeeRevenue, canEdit, canManage, publicationDrafts, publicationErrors, onPublicationDraft, onEdit, onArchive, onDelete, onAddVideoContent, onChangePrimaryProject, onAddPublication, onPublicationAction }: ProjectDetailViewProps) {
    const location = useLocation();
    if (loading) return <p className="project-state">프로젝트를 불러오는 중...</p>;
    if (!detail || error) return <FeedbackMessage type="error" message={error ?? '프로젝트를 찾을 수 없습니다.'} />;

    const back = (location.state as { listSearch?: string } | null)?.listSearch;
    const videoView = location.pathname.endsWith('/videos');
    const archiveActionAvailable = isArchiveActionAvailable(detail);
    const archiveUnavailableMessage = '업로드 완료 또는 제작 취소 상태에서 보관할 수 있습니다.';
    return (
        <>
            <div className="project-detail-nav"><Link to={`/projects${back ? `?${back}` : ''}`}>← 프로젝트 목록</Link></div>
            {feedback && <FeedbackMessage type={feedback.type} message={feedback.message} />}
            <header className="project-detail-header">
                <div><p className="project-group-eyebrow">{detail.videoType === 'LONG' ? 'LONG FORM DEFAULT' : 'SHORTS DEFAULT'}</p><h1>{detail.title}</h1><p>{detail.channelName} · 소유자 {detail.ownerName}</p></div>
                <div className="project-actions"><span className={`project-status project-status--${detail.status.toLowerCase()}`}>{STATUS_LABEL[detail.status]}</span>{canEdit && <button className="project-button" onClick={onEdit}>수정</button>}{canManage && <span className="project-action-tooltip" title={archiveActionAvailable ? undefined : archiveUnavailableMessage}><button className="project-button" disabled={!archiveActionAvailable} aria-label={archiveActionAvailable ? undefined : `보관: ${archiveUnavailableMessage}`} onClick={onArchive}>{detail.archivedAt ? '복원' : '보관'}</button></span>}{canManage && <button className="project-button project-button--danger" onClick={onDelete}>삭제</button>}</div>
            </header>
            <ProjectDetailTabs projectId={detail.projectId} />
            {!videoView && <div className="project-detail-grid">
                <article><h2>기본 정보</h2><p>{detail.content ?? '등록된 내용이 없습니다.'}</p><dl><div><dt>마감일</dt><dd>{detail.dueDate ?? '미정'}</dd></div><div><dt>업로드 예정일</dt><dd>{detail.plannedUploadDate ?? '미정'}</dd></div><div><dt>프로젝트 그룹</dt><dd>{detail.projectGroupName ?? '없음'}</dd></div></dl></article>
                <article><h2>작업 요약</h2><strong className="project-big-number">{detail.completedTaskCount}/{detail.taskCount}</strong><p>작업 상세 관리는 다음 이슈에서 연결됩니다.</p></article>
                <article><h2>참여자</h2><ul>{detail.members.filter(item => item.active).map(item => <li key={item.workspaceMemberId}>{item.name}{item.isOwner ? ' 👑' : ''} <small>{item.permission === 'EDIT' ? '편집' : '보기'}</small></li>)}</ul></article>
            </div>}
            {videoView && <section className="project-section project-video-contents">
                <header className="project-section__header"><div><h2>영상 결과물과 YouTube 게시 이력</h2><p>프로젝트는 제작 과정이며, 완성 결과물과 실제 게시물은 별도로 관리합니다.</p></div>{canEdit && <button className="project-button project-button--primary" onClick={onAddVideoContent}>결과물 추가</button>}</header>
                {detail.videoContents.length === 0 ? <div className="project-state"><strong>아직 영상 결과물이 없습니다.</strong><p>결과물을 추가해 게시 이력과 성과를 연결할 수 있습니다.</p></div> : detail.videoContents.map(content => {
                    const draft = publicationDrafts[content.videoContentId] ?? { youtubeVideo: '', channelId: String(detail.channelId) };
                    const publicationError = publicationErrors[content.videoContentId];
                    const publicationErrorId = `project-youtube-video-error-${content.videoContentId}`;
                    const byChannel = [...content.publications.reduce((map, publication) => map.set(publication.channelId, [...(map.get(publication.channelId) ?? []), publication]), new Map<number, YouTubePublicationResponse[]>()).values()];
                    return (
                        <article className="project-video-content" key={content.videoContentId}>
                            <header><div><span>{content.videoType === 'LONG' ? '롱폼' : '쇼츠'}</span><h3>{content.title}</h3><p>성과 집계 프로젝트 #{content.primaryProjectId} · 연결 프로젝트 {content.connectedProjectIds.length}개</p></div><div className="project-video-content__actions">{content.primaryProjectId === detail.projectId && <strong className="project-primary-badge" title="이 영상의 성과가 현재 프로젝트와 프로젝트 그룹에 집계됩니다.">성과 집계 대상</strong>}{canEdit && content.connectedProjectIds.length > 1 && <button className="project-button" onClick={() => onChangePrimaryProject(content)}>집계 프로젝트 변경</button>}</div></header>
                            {canEdit && <div className="project-publication-form"><select aria-label="게시 채널" value={draft.channelId} onChange={event => onPublicationDraft(content.videoContentId, { channelId: event.target.value })}>{channels.map(channel => <option key={channel.channelId} value={channel.channelId}>{channel.name}</option>)}</select><div className="project-publication-field"><input id={`project-youtube-video-${content.videoContentId}`} aria-label="YouTube URL 또는 영상 ID" aria-invalid={Boolean(publicationError)} aria-describedby={publicationError ? publicationErrorId : undefined} value={draft.youtubeVideo} placeholder="YouTube URL 또는 11자리 영상 ID" onChange={event => onPublicationDraft(content.videoContentId, { youtubeVideo: event.target.value })} />{publicationError && <small id={publicationErrorId} role="alert">{publicationError}</small>}</div><button className="project-button project-button--primary" onClick={() => onAddPublication(content)}>등록</button></div>}
                            <div className="project-performance-grid"><PerformanceSummary title="현재 성과" aggregate={content.currentPerformance} canSeeRevenue={canSeeRevenue} /><PerformanceSummary title="누적 게시 성과" aggregate={content.cumulativePerformance} canSeeRevenue={canSeeRevenue} /></div>
                            {byChannel.length > 0 ? <div className="project-publication-timelines">{byChannel.map(publications => <PublicationTimeline key={publications[0].channelId} content={content} publications={publications} canEdit={canEdit} canSeeRevenue={canSeeRevenue} onAction={onPublicationAction} />)}</div> : <p className="project-empty-publication">등록된 YouTube 게시물이 없습니다.</p>}
                        </article>
                    );
                })}
            </section>}
            {!videoView && <section className="project-section"><h2>프로젝트 상태 변경 이력</h2><ol className="project-history">{[...detail.statusHistory].reverse().map((item, index) => <li key={`${item.changedAt}-${index}`}><strong>{STATUS_LABEL[item.status]}</strong><span>{new Date(item.changedAt).toLocaleString('ko-KR')} · {item.changedByName}</span></li>)}</ol></section>}
        </>
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
        .filter(([status]) => edit || status === 'PLANNING' || status === 'EDITING')
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
                legend="영상 유형"
                value={values.videoType}
                options={[
                    { value: 'LONG', label: '롱폼' },
                    { value: 'SHORTS', label: '쇼츠' }
                ]}
                error={errors.videoType}
                onChange={value => onChange('videoType', value)}
            />

            {/* 생성 시에는 확정된 초기 상태 두 개만 노출하고 수정 시에 전체 상태를 제공합니다. */}
            <ProjectChoiceField
                name="project-status"
                legend="프로젝트 상태"
                value={values.status}
                options={statusOptions}
                onChange={value => onChange('status', value)}
            />
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
