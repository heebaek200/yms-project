import {
    useCallback,
    useEffect,
    useLayoutEffect,
    useMemo,
    useRef,
    useState
} from 'react';
import {
    Link,
    useBlocker,
    useNavigate,
    useParams
} from 'react-router';

import {
    createFinancialEntry,
    updateFinancialEntry,
    voidFinancialEntry,
    type FinancialEntryKind
} from '../api/finance/financialEntries';
import {
    addProjectsToProjectGroup,
    createWorkspaceProjectGroup,
    deleteWorkspaceProjectGroup,
    getUngroupedProjects,
    getWorkspaceProjectGroup,
    getWorkspaceProjectGroups,
    removeProjectFromProjectGroup,
    updateWorkspaceProjectGroup
} from '../api/projectGroups/projectGroups';
import FeedbackMessage, {
    type FeedbackMessageType
} from '../components/common/FeedbackMessage';
import ProjectAreaTabs from '../components/project-groups/ProjectAreaTabs';
import ProjectGroupModal from '../components/project-groups/ProjectGroupModal';
import { useWorkspace } from '../hooks/useWorkspace';
import { registerUnsavedChangesGuard } from '../navigation/unsavedChangesGuard';
import type {
    ProjectGroupDetail,
    ProjectGroupFinancialEntry,
    ProjectGroupProject,
    ProjectGroupStatus,
    ProjectGroupSummary
} from '../types/projectGroup';
import {
    formatMoney,
    getDecimalSign,
    roundDecimal
} from '../utils/decimal';

import './ProjectGroupPage.css';

type GroupFormValues = {
    name: string;
    description: string;
    startDate: string;
    endDate: string;
    status: ProjectGroupStatus;
    projectIds: number[];
};

type FinancialFormValues = {
    entryType: string;
    amount: string;
    occurredOn: string;
    memo: string;
};

type FeedbackState = {
    type: FeedbackMessageType;
    message: string;
    projectGroupId: number | null;
};

type FieldErrors<TValues> = Partial<Record<keyof TValues, string>>;

const EMPTY_GROUP_FORM: GroupFormValues = {
    name: '',
    description: '',
    startDate: '',
    endDate: '',
    status: 'PLANNING',
    projectIds: []
};

const EMPTY_FINANCIAL_FORM: FinancialFormValues = {
    entryType: '',
    amount: '',
    occurredOn: '',
    memo: ''
};

const STATUS_META: Record<ProjectGroupStatus, {
    label: string;
    className: string;
}> = {
    PLANNING: { label: '준비 중', className: 'planning' },
    ACTIVE: { label: '진행 중', className: 'active' },
    COMPLETED: { label: '완료', className: 'completed' },
    CANCELLED: { label: '취소', className: 'cancelled' }
};

const PROJECT_STATUS_LABEL: Record<ProjectGroupProject['status'], string> = {
    PLANNING: '준비 중',
    EDITING: '편집 중',
    REVIEW: '검수 중',
    UPLOADED: '업로드 완료',
    CANCELLED: '취소'
};

const FINANCIAL_ENTRY_TYPES: Record<FinancialEntryKind, ReadonlyArray<{
    value: string;
    label: string;
}>> = {
    REVENUE: [
        { value: 'SPONSORSHIP', label: '브랜드 광고·협찬' },
        { value: 'AFFILIATE', label: '제휴 수익' },
        { value: 'MERCHANDISE', label: '상품·굿즈 판매' },
        { value: 'MEMBERSHIP', label: '멤버십·후원' },
        { value: 'OTHER', label: '기타 수익' }
    ],
    EXPENSE: [
        { value: 'STUDIO', label: '장소·대관' },
        { value: 'EQUIPMENT', label: '장비 구매·렌탈' },
        { value: 'OUTSOURCING', label: '외주 제작' },
        { value: 'LICENSE', label: '음원·라이선스' },
        { value: 'ADVERTISING', label: '광고 집행' },
        { value: 'OTHER', label: '기타 비용' }
    ]
};

/** BigDecimal 호환 금액 문자열을 정밀도 손실 없이 원화 표시로 변환합니다. */
function formatWon(value: string): string {
    return `${formatMoney(value)}원`;
}

/** 저장 날짜 문자열을 한국어 화면용 짧은 형식으로 표시합니다. */
function formatDate(value: string | null): string {
    if (!value) {
        return '미정';
    }

    return new Intl.DateTimeFormat('ko-KR', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
    }).format(new Date(`${value}T00:00:00`));
}

/** 수익·비용 코드가 선택 목록에 있으면 사용자 표시명을, 없으면 원본 값을 반환합니다. */
function getFinancialEntryLabel(
    kind: FinancialEntryKind,
    entryType: string
): string {
    return FINANCIAL_ENTRY_TYPES[kind].find(
        option => option.value === entryType
    )?.label ?? entryType;
}

/** ProjectGroup API 상세 값을 수정 폼에서 사용하는 문자열 상태로 변환합니다. */
function toGroupFormValues(group: ProjectGroupDetail): GroupFormValues {
    return {
        name: group.name,
        description: group.description ?? '',
        startDate: group.startDate ?? '',
        endDate: group.endDate ?? '',
        status: group.status,
        projectIds: []
    };
}

/** 기존 재무 항목을 직접 Expense·Revenue 공통 입력 폼 값으로 변환합니다. */
function toFinancialFormValues(
    entry: ProjectGroupFinancialEntry
): FinancialFormValues {
    return {
        entryType: entry.entryType,
        amount: entry.amount,
        occurredOn: entry.occurredOn,
        memo: entry.memo ?? ''
    };
}

/** 목록·상세·폼 상태를 결합해 ProjectGroup CRUD와 직접 재무 입력 화면을 제공합니다. */
function ProjectGroupPage() {
    const { currentWorkspace } = useWorkspace();
    const { projectGroupId: rawProjectGroupId } = useParams();
    const navigate = useNavigate();
    const projectGroupId = rawProjectGroupId
        ? Number(rawProjectGroupId)
        : null;

    const [groups, setGroups] = useState<ProjectGroupSummary[]>([]);
    const [detail, setDetail] = useState<ProjectGroupDetail | null>(null);
    const [availableProjects, setAvailableProjects] = useState<ProjectGroupProject[]>([]);
    const [isProjectsLoading, setIsProjectsLoading] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [loadError, setLoadError] = useState<string | null>(null);
    const [feedback, setFeedback] = useState<FeedbackState | null>(null);
    const [keyword, setKeyword] = useState('');
    const [statusFilter, setStatusFilter] = useState<ProjectGroupStatus | 'ALL'>('ALL');
    const [startDateFilter, setStartDateFilter] = useState('');
    const [endDateFilter, setEndDateFilter] = useState('');

    const [isGroupModalOpen, setIsGroupModalOpen] = useState(false);
    const [isConnectModalOpen, setIsConnectModalOpen] = useState(false);
    const [financialModalKind, setFinancialModalKind] = useState<FinancialEntryKind | null>(null);
    const [editingEntry, setEditingEntry] = useState<ProjectGroupFinancialEntry | null>(null);
    const [groupForm, setGroupForm] = useState<GroupFormValues>(EMPTY_GROUP_FORM);
    const [financialForm, setFinancialForm] = useState<FinancialFormValues>(EMPTY_FINANCIAL_FORM);
    const [groupErrors, setGroupErrors] = useState<FieldErrors<GroupFormValues>>({});
    const [financialErrors, setFinancialErrors] = useState<FieldErrors<FinancialFormValues>>({});
    const [modalError, setModalError] = useState<string | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const groupFormRef = useRef<HTMLFormElement>(null);
    const financialFormRef = useRef<HTMLFormElement>(null);
    const allowSavedNavigationRef = useRef(false);

    const initialGroupForm = useMemo(
        () => detail ? toGroupFormValues(detail) : EMPTY_GROUP_FORM,
        [detail]
    );
    const initialFinancialForm = useMemo(
        () => editingEntry
            ? toFinancialFormValues(editingEntry)
            : EMPTY_FINANCIAL_FORM,
        [editingEntry]
    );
    const isGroupFormDirty = isGroupModalOpen
        && JSON.stringify(groupForm) !== JSON.stringify(initialGroupForm);
    const isFinancialFormDirty = financialModalKind !== null
        && JSON.stringify(financialForm) !== JSON.stringify(initialFinancialForm);
    const isConnectFormDirty = isConnectModalOpen && groupForm.projectIds.length > 0;
    const isFormDirty = isGroupFormDirty
        || isFinancialFormDirty
        || isConnectFormDirty;
    const blocker = useBlocker(({ currentLocation, nextLocation }) => (
        !allowSavedNavigationRef.current
        && isFormDirty
        && (
            currentLocation.pathname !== nextLocation.pathname
            || currentLocation.search !== nextLocation.search
        )
    ));

    /** 현재 필터와 Workspace를 기준으로 ProjectGroup 목록을 다시 조회합니다. */
    const loadGroups = useCallback(async () => {
        if (!currentWorkspace) {
            return;
        }

        try {
            setIsLoading(true);
            setLoadError(null);
            const response = await getWorkspaceProjectGroups(
                currentWorkspace.workspaceId,
                {
                    keyword,
                    status: statusFilter,
                    startDate: startDateFilter || undefined,
                    endDate: endDateFilter || undefined
                }
            );

            if (!response.success) {
                setGroups([]);
                setLoadError(response.message);
                return;
            }

            setGroups(response.data);
        } catch (error) {
            console.error(error);
            setGroups([]);
            setLoadError('프로젝트 그룹 목록을 불러오지 못했습니다.');
        } finally {
            setIsLoading(false);
        }
    }, [
        currentWorkspace,
        endDateFilter,
        keyword,
        startDateFilter,
        statusFilter
    ]);

    /** Route ID와 Workspace 경계를 사용해 ProjectGroup 상세를 다시 조회합니다. */
    const loadDetail = useCallback(async () => {
        if (!currentWorkspace || projectGroupId === null) {
            return;
        }

        try {
            setIsLoading(true);
            setLoadError(null);
            const response = await getWorkspaceProjectGroup(
                currentWorkspace.workspaceId,
                projectGroupId
            );

            if (!response.success) {
                setDetail(null);
                setLoadError(response.message);
                return;
            }

            setDetail(response.data);
        } catch (error) {
            console.error(error);
            setDetail(null);
            setLoadError('프로젝트 그룹 정보를 불러오지 못했습니다.');
        } finally {
            setIsLoading(false);
        }
    }, [currentWorkspace, projectGroupId]);

    // 목록과 상세 Route가 같은 페이지 컴포넌트를 사용하되 필요한 데이터만 조회합니다.
    useEffect(() => {
        if (projectGroupId === null) {
            void loadGroups();
        } else if (Number.isInteger(projectGroupId)) {
            void loadDetail();
        } else {
            setIsLoading(false);
            setLoadError('올바르지 않은 프로젝트 그룹 주소입니다.');
        }
    }, [loadDetail, loadGroups, projectGroupId]);

    // 저장 성공 이동에 사용한 일회성 예외는 목적 Route가 반영되는 즉시 해제합니다.
    useEffect(() => {
        allowSavedNavigationRef.current = false;
    }, [projectGroupId]);

    // 다른 목록·상세 Route로 이동하면 이전 그룹에서 발생한 안내를 다시 표시하지 않습니다.
    useEffect(() => {
        setFeedback(current => (
            current?.projectGroupId === projectGroupId ? current : null
        ));
    }, [projectGroupId]);

    // 제작팀 전환 시 이전 제작팀의 상세와 모달 입력을 화면에 남기지 않습니다.
    useEffect(() => {
        setDetail(null);
        setFeedback(null);
        setIsGroupModalOpen(false);
        setIsConnectModalOpen(false);
        setFinancialModalKind(null);
        setEditingEntry(null);
        setGroupForm(EMPTY_GROUP_FORM);
        setFinancialForm(EMPTY_FINANCIAL_FORM);
    }, [currentWorkspace?.workspaceId]);

    // Header 이동과 제작팀 전환도 열린 모달의 미저장 확인을 거치게 합니다.
    useLayoutEffect(() => {
        if (!isFormDirty) {
            return;
        }

        return registerUnsavedChangesGuard(() => window.confirm(
            '저장하지 않은 변경사항이 있습니다. 변경사항을 버리고 이동할까요?'
        ));
    }, [isFormDirty]);

    // 탭 Link와 브라우저 뒤로·앞으로 이동을 같은 확인 흐름으로 처리합니다.
    useEffect(() => {
        if (blocker.state !== 'blocked') {
            return;
        }

        if (window.confirm(
            '저장하지 않은 변경사항이 있습니다. 변경사항을 버리고 이동할까요?'
        )) {
            setIsGroupModalOpen(false);
            setIsConnectModalOpen(false);
            setFinancialModalKind(null);
            setEditingEntry(null);
            setGroupForm(EMPTY_GROUP_FORM);
            setFinancialForm(EMPTY_FINANCIAL_FORM);
            window.setTimeout(blocker.proceed, 0);
            return;
        }

        blocker.reset();
    }, [blocker]);

    // 브라우저 새로고침과 탭 닫기에서도 미저장 입력의 기본 경고를 표시합니다.
    useEffect(() => {
        if (!isFormDirty) {
            return;
        }

        const handleBeforeUnload = (event: BeforeUnloadEvent) => {
            event.preventDefault();
        };
        window.addEventListener('beforeunload', handleBeforeUnload);
        return () => window.removeEventListener('beforeunload', handleBeforeUnload);
    }, [isFormDirty]);

    /** 모달에서 선택 가능한 미연결 Project를 불러오고 이전 선택값을 비웁니다. */
    const loadAvailableProjects = async () => {
        if (!currentWorkspace) {
            return;
        }

        try {
            setIsProjectsLoading(true);
            const response = await getUngroupedProjects(
                currentWorkspace.workspaceId
            );
            setAvailableProjects(response.success ? response.data : []);
            if (!response.success) {
                setModalError(response.message);
            }
        } finally {
            setIsProjectsLoading(false);
        }
    };

    /** 빈 생성 폼과 선택 가능한 Project를 준비해 ProjectGroup 생성 모달을 엽니다. */
    const openCreateModal = () => {
        setDetail(null);
        setGroupForm(EMPTY_GROUP_FORM);
        setGroupErrors({});
        setModalError(null);
        setFeedback(null);
        setIsGroupModalOpen(true);
        void loadAvailableProjects();
    };

    /** 현재 상세 기본 정보를 복사해 ProjectGroup 수정 모달을 엽니다. */
    const openEditModal = () => {
        if (!detail) {
            return;
        }

        setGroupForm(toGroupFormValues(detail));
        setGroupErrors({});
        setModalError(null);
        setFeedback(null);
        setIsGroupModalOpen(true);
    };

    /** 현재 상세에 추가할 미연결 Project 선택 모달을 엽니다. */
    const openConnectModal = () => {
        setGroupForm(current => ({ ...current, projectIds: [] }));
        setModalError(null);
        setIsConnectModalOpen(true);
        void loadAvailableProjects();
    };

    /** 직접 비용·수익 입력을 새 값 또는 선택 항목 수정 상태로 엽니다. */
    const openFinancialModal = (
        kind: FinancialEntryKind,
        entry: ProjectGroupFinancialEntry | null = null
    ) => {
        setEditingEntry(entry);
        setFinancialForm(entry
            ? toFinancialFormValues(entry)
            : EMPTY_FINANCIAL_FORM
        );
        setFinancialErrors({});
        setModalError(null);
        setFeedback(null);
        setFinancialModalKind(kind);
    };

    /** 미저장 확인을 통과하면 열린 ProjectGroup 관련 모달 상태를 모두 초기화합니다. */
    const closeModal = useCallback(() => {
        if (isFormDirty && !window.confirm(
            '저장하지 않은 변경사항이 있습니다. 변경사항을 버리고 닫을까요?'
        )) {
            return;
        }

        setIsGroupModalOpen(false);
        setIsConnectModalOpen(false);
        setFinancialModalKind(null);
        setEditingEntry(null);
        setGroupForm(EMPTY_GROUP_FORM);
        setFinancialForm(EMPTY_FINANCIAL_FORM);
        setGroupErrors({});
        setFinancialErrors({});
        setModalError(null);
    }, [isFormDirty]);

    /** ProjectGroup 생성·수정 결과를 저장하고 성공 시 상세 Route 또는 화면을 갱신합니다. */
    const handleGroupSubmit = async (event: React.SubmitEvent<HTMLFormElement>) => {
        event.preventDefault();
        if (!currentWorkspace) {
            return;
        }

        try {
            setIsSubmitting(true);
            setGroupErrors({});
            setModalError(null);
            const response = detail
                ? await updateWorkspaceProjectGroup(
                    currentWorkspace.workspaceId,
                    detail.projectGroupId,
                    groupForm
                )
                : await createWorkspaceProjectGroup(
                    currentWorkspace.workspaceId,
                    groupForm
                );

            if (!response.success) {
                const nextErrors: FieldErrors<GroupFormValues> = {};
                response.errors?.forEach(error => {
                    if (error.field in EMPTY_GROUP_FORM) {
                        nextErrors[error.field as keyof GroupFormValues] = error.reason;
                    }
                });
                setGroupErrors(nextErrors);
                setModalError(Object.keys(nextErrors).length === 0
                    ? response.message
                    : null
                );
                window.requestAnimationFrame(() => {
                    groupFormRef.current
                        ?.querySelector<HTMLElement>('[aria-invalid="true"]')
                        ?.focus();
                });
                return;
            }

            setFeedback({
                type: 'success',
                message: response.message ?? '저장했습니다.',
                projectGroupId: response.data.projectGroupId
            });
            setIsGroupModalOpen(false);
            setGroupForm(EMPTY_GROUP_FORM);
            if (detail) {
                setDetail(response.data);
            } else {
                // 정상 저장으로 발생한 상세 이동만 미저장 Guard를 한 번 통과시킵니다.
                allowSavedNavigationRef.current = true;
                navigate(`/project-groups/${response.data.projectGroupId}`);
            }
        } catch (error) {
            console.error(error);
            setModalError('프로젝트 그룹을 저장하지 못했습니다. 잠시 후 다시 시도해 주세요.');
        } finally {
            setIsSubmitting(false);
        }
    };

    /** 선택 Project를 현재 그룹에 연결하고 상세 재무 집계를 함께 갱신합니다. */
    const handleConnectProjects = async (event: React.SubmitEvent<HTMLFormElement>) => {
        event.preventDefault();
        if (!currentWorkspace || !detail) {
            return;
        }

        if (groupForm.projectIds.length === 0) {
            setModalError('연결할 프로젝트를 하나 이상 선택해 주세요.');
            return;
        }

        try {
            setIsSubmitting(true);
            setModalError(null);
            const response = await addProjectsToProjectGroup(
                currentWorkspace.workspaceId,
                detail.projectGroupId,
                groupForm.projectIds
            );

            if (!response.success) {
                setModalError(response.message);
                return;
            }

            setDetail(response.data);
            setFeedback({
                type: 'success',
                message: response.message ?? '프로젝트를 연결했습니다.',
                projectGroupId: response.data.projectGroupId
            });
            setIsConnectModalOpen(false);
            setGroupForm(current => ({ ...current, projectIds: [] }));
        } catch (error) {
            console.error(error);
            setModalError('프로젝트를 연결하지 못했습니다. 잠시 후 다시 시도해 주세요.');
        } finally {
            setIsSubmitting(false);
        }
    };

    /** Project 자체는 유지하면서 현재 그룹 연결을 확인 후 해제합니다. */
    const handleDisconnectProject = async (project: ProjectGroupProject) => {
        if (!currentWorkspace || !detail || !window.confirm(
            `${project.title} 프로젝트를 이 그룹에서 제외할까요? 프로젝트의 비용·수익도 이 그룹 집계에서 빠집니다.`
        )) {
            return;
        }

        const response = await removeProjectFromProjectGroup(
            currentWorkspace.workspaceId,
            detail.projectGroupId,
            project.projectId
        );
        if (!response.success) {
            setFeedback({
                type: 'error',
                message: response.message,
                projectGroupId: detail.projectGroupId
            });
            return;
        }

        setDetail(response.data);
        setFeedback({
            type: 'success',
            message: response.message ?? '연결을 해제했습니다.',
            projectGroupId: response.data.projectGroupId
        });
    };

    /** 현재 그룹에 직접 귀속되는 Expense 또는 Revenue를 생성하거나 수정합니다. */
    const handleFinancialSubmit = async (event: React.SubmitEvent<HTMLFormElement>) => {
        event.preventDefault();
        if (!currentWorkspace || !detail || !financialModalKind) {
            return;
        }

        try {
            setIsSubmitting(true);
            setFinancialErrors({});
            setModalError(null);
            const request = {
                scopeType: 'PROJECT_GROUP' as const,
                projectGroupId: detail.projectGroupId,
                ...financialForm
            };
            const response = editingEntry
                ? await updateFinancialEntry(
                    currentWorkspace.workspaceId,
                    financialModalKind,
                    editingEntry.entryId,
                    request
                )
                : await createFinancialEntry(
                    currentWorkspace.workspaceId,
                    financialModalKind,
                    request
                );

            if (!response.success) {
                const nextErrors: FieldErrors<FinancialFormValues> = {};
                response.errors?.forEach(error => {
                    if (error.field in EMPTY_FINANCIAL_FORM) {
                        nextErrors[error.field as keyof FinancialFormValues] = error.reason;
                    }
                });
                setFinancialErrors(nextErrors);
                setModalError(Object.keys(nextErrors).length === 0
                    ? response.message
                    : null
                );
                window.requestAnimationFrame(() => {
                    financialFormRef.current
                        ?.querySelector<HTMLElement>('[aria-invalid="true"]')
                        ?.focus();
                });
                return;
            }

            setFeedback({
                type: 'success',
                message: response.message ?? '저장했습니다.',
                projectGroupId: detail.projectGroupId
            });
            setFinancialModalKind(null);
            setEditingEntry(null);
            setFinancialForm(EMPTY_FINANCIAL_FORM);
            await loadDetail();
        } catch (error) {
            console.error(error);
            setModalError('비용·수익 항목을 저장하지 못했습니다. 잠시 후 다시 시도해 주세요.');
        } finally {
            setIsSubmitting(false);
        }
    };

    /** 선택한 직접 비용·수익을 확인 후 VOIDED로 변경하고 집계를 다시 불러옵니다. */
    const handleVoidEntry = async (
        kind: FinancialEntryKind,
        entry: ProjectGroupFinancialEntry
    ) => {
        if (!currentWorkspace || !detail || !window.confirm(
            `${kind === 'REVENUE' ? '수익' : '비용'} 항목을 무효 처리할까요? 이력은 남고 재무 합계에서 제외됩니다.`
        )) {
            return;
        }

        const response = await voidFinancialEntry(
            currentWorkspace.workspaceId,
            detail.projectGroupId,
            kind,
            entry.entryId
        );
        if (!response.success) {
            setFeedback({
                type: 'error',
                message: response.message,
                projectGroupId: detail.projectGroupId
            });
            return;
        }

        setFeedback({
            type: 'success',
            message: response.message ?? '무효 처리했습니다.',
            projectGroupId: detail.projectGroupId
        });
        await loadDetail();
    };

    /** 빈 ProjectGroup만 삭제하고 성공하면 목록 Route로 돌아갑니다. */
    const handleDeleteGroup = async () => {
        if (!currentWorkspace || !detail || !window.confirm(
            `${detail.name} 프로젝트 그룹을 삭제할까요? 삭제하면 되돌릴 수 없습니다.`
        )) {
            return;
        }

        const response = await deleteWorkspaceProjectGroup(
            currentWorkspace.workspaceId,
            detail.projectGroupId
        );
        if (!response.success) {
            setFeedback({
                type: 'error',
                message: response.message,
                projectGroupId: detail.projectGroupId
            });
            return;
        }

        setFeedback({
            type: 'success',
            message: response.message ?? '삭제했습니다.',
            projectGroupId: null
        });
        navigate('/project-groups');
    };

    /** 그룹 폼의 단일 필드를 갱신하면서 해당 필드의 이전 오류를 제거합니다. */
    const updateGroupForm = <TField extends keyof GroupFormValues>(
        field: TField,
        value: GroupFormValues[TField]
    ) => {
        setGroupForm(current => ({ ...current, [field]: value }));
        setGroupErrors(current => ({ ...current, [field]: undefined }));
    };

    /** 재무 폼의 단일 문자열 필드를 갱신하면서 해당 필드 오류를 제거합니다. */
    const updateFinancialForm = (
        field: keyof FinancialFormValues,
        value: string
    ) => {
        setFinancialForm(current => ({ ...current, [field]: value }));
        setFinancialErrors(current => ({ ...current, [field]: undefined }));
    };

    if (!currentWorkspace) {
        return null;
    }

    const isDetailRoute = projectGroupId !== null;
    const visibleFeedback = feedback?.projectGroupId === projectGroupId
        ? feedback
        : null;
    const canConnectProjects = detail?.status === 'PLANNING'
        || detail?.status === 'ACTIVE';

    return (
        <section className="project-area-page">
            <ProjectAreaTabs />

            {isDetailRoute ? (
                <ProjectGroupDetailView
                    detail={detail}
                    isLoading={isLoading}
                    loadError={loadError}
                    feedback={visibleFeedback}
                    canConnectProjects={canConnectProjects}
                    onRetry={() => void loadDetail()}
                    onEdit={openEditModal}
                    onDelete={() => void handleDeleteGroup()}
                    onConnect={openConnectModal}
                    onDisconnect={project => void handleDisconnectProject(project)}
                    onFinancialCreate={kind => openFinancialModal(kind)}
                    onFinancialEdit={(kind, entry) => openFinancialModal(kind, entry)}
                    onFinancialVoid={(kind, entry) => void handleVoidEntry(kind, entry)}
                />
            ) : (
                <ProjectGroupListView
                    groups={groups}
                    isLoading={isLoading}
                    loadError={loadError}
                    feedback={visibleFeedback}
                    keyword={keyword}
                    statusFilter={statusFilter}
                    startDateFilter={startDateFilter}
                    endDateFilter={endDateFilter}
                    onKeywordChange={setKeyword}
                    onStatusChange={setStatusFilter}
                    onStartDateChange={setStartDateFilter}
                    onEndDateChange={setEndDateFilter}
                    onCreate={openCreateModal}
                    onRetry={() => void loadGroups()}
                />
            )}

            {isGroupModalOpen && (
                <ProjectGroupModal
                    titleId="project-group-form-title"
                    title={detail ? '프로젝트 그룹 수정' : '새 프로젝트 그룹'}
                    description="관련 프로젝트의 실제 비용과 외부 수익을 함께 분석할 수 있습니다."
                    onRequestClose={closeModal}
                >
                    <GroupForm
                        formRef={groupFormRef}
                        values={groupForm}
                        errors={groupErrors}
                        availableProjects={detail ? [] : availableProjects}
                        isProjectsLoading={isProjectsLoading}
                        isEditing={Boolean(detail)}
                        isSubmitting={isSubmitting}
                        modalError={modalError}
                        onChange={updateGroupForm}
                        onCancel={closeModal}
                        onSubmit={handleGroupSubmit}
                    />
                </ProjectGroupModal>
            )}

            {isConnectModalOpen && detail && (
                <ProjectGroupModal
                    titleId="project-group-connect-title"
                    title="프로젝트 연결"
                    description={`${detail.name} 그룹에 아직 그룹이 없는 프로젝트를 연결합니다.`}
                    onRequestClose={closeModal}
                >
                    <ProjectConnectForm
                        projects={availableProjects}
                        isProjectsLoading={isProjectsLoading}
                        selectedIds={groupForm.projectIds}
                        isSubmitting={isSubmitting}
                        modalError={modalError}
                        onSelectedIdsChange={projectIds => updateGroupForm('projectIds', projectIds)}
                        onCancel={closeModal}
                        onSubmit={handleConnectProjects}
                    />
                </ProjectGroupModal>
            )}

            {financialModalKind && detail && (
                <ProjectGroupModal
                    titleId="project-group-financial-title"
                    title={`${financialModalKind === 'REVENUE' ? '수익' : '비용'} ${editingEntry ? '수정' : '등록'}`}
                    description={`${detail.name} 프로젝트 그룹에 직접 귀속됩니다.`}
                    onRequestClose={closeModal}
                >
                    <FinancialForm
                        formRef={financialFormRef}
                        kind={financialModalKind}
                        values={financialForm}
                        errors={financialErrors}
                        isSubmitting={isSubmitting}
                        modalError={modalError}
                        onChange={updateFinancialForm}
                        onCancel={closeModal}
                        onSubmit={handleFinancialSubmit}
                    />
                </ProjectGroupModal>
            )}
        </section>
    );
}

type ProjectGroupListViewProps = {
    groups: ProjectGroupSummary[];
    isLoading: boolean;
    loadError: string | null;
    feedback: FeedbackState | null;
    keyword: string;
    statusFilter: ProjectGroupStatus | 'ALL';
    startDateFilter: string;
    endDateFilter: string;
    onKeywordChange: (value: string) => void;
    onStatusChange: (value: ProjectGroupStatus | 'ALL') => void;
    onStartDateChange: (value: string) => void;
    onEndDateChange: (value: string) => void;
    onCreate: () => void;
    onRetry: () => void;
};

/** ProjectGroup 검색·필터와 재무 요약 목록을 같은 열 순서의 반응형 카드로 표시합니다. */
function ProjectGroupListView({
    groups,
    isLoading,
    loadError,
    feedback,
    keyword,
    statusFilter,
    startDateFilter,
    endDateFilter,
    onKeywordChange,
    onStatusChange,
    onStartDateChange,
    onEndDateChange,
    onCreate,
    onRetry
}: ProjectGroupListViewProps) {
    return (
        <>
            <header className="project-group-header">
                <div>
                    <p className="project-group-eyebrow">PROJECT GROUPS</p>
                    <h1>프로젝트 그룹</h1>
                    <p>여러 프로젝트의 실제 비용과 외부 수익을 함께 분석합니다.</p>
                </div>
                <button type="button" className="project-group-button project-group-button--primary" onClick={onCreate}>
                    프로젝트 그룹 만들기
                </button>
            </header>

            {feedback && <FeedbackMessage type={feedback.type} message={feedback.message} />}

            <div className="project-group-filters" aria-label="프로젝트 그룹 필터">
                <label>
                    <span>이름 또는 설명</span>
                    <input
                        type="search"
                        value={keyword}
                        placeholder="프로젝트 그룹 검색"
                        onChange={event => onKeywordChange(event.target.value)}
                    />
                </label>
                <label>
                    <span>상태</span>
                    <select
                        value={statusFilter}
                        onChange={event => onStatusChange(
                            event.target.value as ProjectGroupStatus | 'ALL'
                        )}
                    >
                        <option value="ALL">전체</option>
                        {Object.entries(STATUS_META).map(([value, meta]) => (
                            <option key={value} value={value}>{meta.label}</option>
                        ))}
                    </select>
                </label>
                <label>
                    <span>검색 시작일</span>
                    <input type="date" value={startDateFilter} onChange={event => onStartDateChange(event.target.value)} />
                </label>
                <label>
                    <span>검색 종료일</span>
                    <input type="date" value={endDateFilter} onChange={event => onEndDateChange(event.target.value)} />
                </label>
            </div>

            {isLoading ? (
                <p className="project-group-state" role="status">프로젝트 그룹을 불러오는 중...</p>
            ) : loadError ? (
                <div className="project-group-state">
                    <FeedbackMessage type="error" message={loadError} />
                    <button type="button" className="project-group-button" onClick={onRetry}>다시 시도</button>
                </div>
            ) : groups.length === 0 ? (
                <div className="project-group-state project-group-state--empty">
                    <span aria-hidden="true">🗂️</span>
                    <strong>아직 표시할 프로젝트 그룹이 없습니다.</strong>
                    <p>여러 프로젝트의 비용과 외부 수익을 함께 분석하고 싶을 때 만들어 보세요. 프로젝트는 그룹 없이도 관리할 수 있습니다.</p>
                    <button type="button" className="project-group-button project-group-button--primary" onClick={onCreate}>첫 프로젝트 그룹 만들기</button>
                </div>
            ) : (
                <ul className="project-group-list">
                    {groups.map(group => {
                        const status = STATUS_META[group.status];
                        const profitSign = getDecimalSign(group.profit);
                        return (
                            <li key={group.projectGroupId} className="project-group-card">
                                <div className="project-group-card__identity">
                                    <div>
                                        <span className={`project-group-status project-group-status--${status.className}`}>{status.label}</span>
                                        <h2><Link to={`/project-groups/${group.projectGroupId}`}>{group.name}</Link></h2>
                                    </div>
                                    <p>{group.description ?? '설명이 없습니다.'}</p>
                                </div>
                                <dl className="project-group-card__facts">
                                    <div><dt>기간</dt><dd>{formatDate(group.startDate)} ~ {formatDate(group.endDate)}</dd></div>
                                    <div><dt>프로젝트</dt><dd>{group.projectCount}개</dd></div>
                                    <div><dt>실제 비용</dt><dd>{formatWon(group.actualCost)}</dd></div>
                                    <div><dt>실제 수익</dt><dd>{formatWon(group.actualRevenue)}</dd></div>
                                    <div><dt>손익</dt><dd className={profitSign < 0 ? 'is-negative' : 'is-positive'}>{profitSign > 0 ? '+' : ''}{formatWon(group.profit)}</dd></div>
                                </dl>
                                <Link className="project-group-card__link" to={`/project-groups/${group.projectGroupId}`}>상세 보기</Link>
                            </li>
                        );
                    })}
                </ul>
            )}
        </>
    );
}

type ProjectGroupDetailViewProps = {
    detail: ProjectGroupDetail | null;
    isLoading: boolean;
    loadError: string | null;
    feedback: FeedbackState | null;
    canConnectProjects: boolean;
    onRetry: () => void;
    onEdit: () => void;
    onDelete: () => void;
    onConnect: () => void;
    onDisconnect: (project: ProjectGroupProject) => void;
    onFinancialCreate: (kind: FinancialEntryKind) => void;
    onFinancialEdit: (kind: FinancialEntryKind, entry: ProjectGroupFinancialEntry) => void;
    onFinancialVoid: (kind: FinancialEntryKind, entry: ProjectGroupFinancialEntry) => void;
};

/** ProjectGroup 기본 정보, 재무 요약, 연결 Project와 직접 비용·수익을 한 화면에 표시합니다. */
function ProjectGroupDetailView({
    detail,
    isLoading,
    loadError,
    feedback,
    canConnectProjects,
    onRetry,
    onEdit,
    onDelete,
    onConnect,
    onDisconnect,
    onFinancialCreate,
    onFinancialEdit,
    onFinancialVoid
}: ProjectGroupDetailViewProps) {
    if (isLoading) {
        return <p className="project-group-state" role="status">프로젝트 그룹 정보를 불러오는 중...</p>;
    }

    if (loadError || !detail) {
        return (
            <div className="project-group-state">
                <FeedbackMessage type="error" message={loadError ?? '프로젝트 그룹을 찾을 수 없습니다.'} />
                <div className="project-group-state__actions">
                    <button type="button" className="project-group-button" onClick={onRetry}>다시 시도</button>
                    <Link className="project-group-button" to="/project-groups">목록으로</Link>
                </div>
            </div>
        );
    }

    const status = STATUS_META[detail.status];
    const profitSign = getDecimalSign(detail.profit);

    return (
        <>
            <div className="project-group-detail-nav">
                <Link to="/project-groups">← 프로젝트 그룹 목록</Link>
            </div>

            {feedback && <FeedbackMessage type={feedback.type} message={feedback.message} />}

            <header className="project-group-detail-header">
                <div>
                    <div className="project-group-detail-header__status">
                        <span className={`project-group-status project-group-status--${status.className}`}>{status.label}</span>
                        <span>{formatDate(detail.startDate)} ~ {formatDate(detail.endDate)}</span>
                    </div>
                    <h1>{detail.name}</h1>
                    <p>{detail.description ?? '설명이 없습니다.'}</p>
                </div>
                <div className="project-group-detail-header__actions">
                    <button type="button" className="project-group-button" onClick={onEdit}>수정</button>
                    <button type="button" className="project-group-button project-group-button--danger" onClick={onDelete}>삭제</button>
                </div>
            </header>

            <section className="project-group-metrics" aria-label="프로젝트 그룹 재무 요약">
                <article><span>실제 비용</span><strong>{formatWon(detail.actualCost)}</strong></article>
                <article><span>실제 수익</span><strong>{formatWon(detail.actualRevenue)}</strong></article>
                <article><span>손익</span><strong className={profitSign < 0 ? 'is-negative' : 'is-positive'}>{profitSign > 0 ? '+' : ''}{formatWon(detail.profit)}</strong></article>
                <article><span>ROI</span><strong>{detail.roi === null ? '-' : `${roundDecimal(detail.roi, 1)}%`}</strong></article>
            </section>

            <section className="project-group-section">
                <div className="project-group-section__header">
                    <div><h2>연결 프로젝트</h2><p>프로젝트의 직접 비용·수익은 연결된 그룹의 분석에 반영됩니다.</p></div>
                    <button type="button" className="project-group-button" disabled={!canConnectProjects} onClick={onConnect}>프로젝트 연결</button>
                </div>
                {!canConnectProjects && <p className="project-group-notice">완료 또는 취소된 그룹은 진행 중으로 변경한 뒤 새 프로젝트를 연결할 수 있습니다.</p>}
                {detail.projects.length === 0 ? (
                    <p className="project-group-section__empty">연결된 프로젝트가 없습니다.</p>
                ) : (
                    <ul className="project-group-project-list">
                        {detail.projects.map(project => (
                            <li key={project.projectId}>
                                <div><strong><Link to={`/projects/${project.projectId}`}>{project.title}</Link></strong><span>{project.channelName} · {PROJECT_STATUS_LABEL[project.status]}</span></div>
                                <button type="button" className="project-group-button project-group-button--small" onClick={() => onDisconnect(project)}>연결 해제</button>
                            </li>
                        ))}
                    </ul>
                )}
            </section>

            <div className="project-group-finance-grid">
                <FinancialSection
                    title="그룹 직접 수익"
                    description="협찬·제휴·상품 판매 등 확정된 외부 수익을 기록합니다."
                    kind="REVENUE"
                    entries={detail.directRevenues}
                    onCreate={() => onFinancialCreate('REVENUE')}
                    onEdit={entry => onFinancialEdit('REVENUE', entry)}
                    onVoid={entry => onFinancialVoid('REVENUE', entry)}
                />
                <FinancialSection
                    title="그룹 직접 비용"
                    description="여러 프로젝트에 공통으로 발생한 제작 비용을 기록합니다."
                    kind="EXPENSE"
                    entries={detail.directExpenses}
                    onCreate={() => onFinancialCreate('EXPENSE')}
                    onEdit={entry => onFinancialEdit('EXPENSE', entry)}
                    onVoid={entry => onFinancialVoid('EXPENSE', entry)}
                />
            </div>

            <div className="project-group-detail-footer">
                <Link to={`/finance?scopeType=PROJECT_GROUP&projectGroupId=${detail.projectGroupId}`}>전체 비용·수익에서 보기 →</Link>
                <Link to={`/analytics?scopeType=PROJECT_GROUP&projectGroupId=${detail.projectGroupId}`}>성과 분석에서 보기 →</Link>
            </div>
        </>
    );
}

type FinancialSectionProps = {
    title: string;
    description: string;
    kind: FinancialEntryKind;
    entries: ProjectGroupFinancialEntry[];
    onCreate: () => void;
    onEdit: (entry: ProjectGroupFinancialEntry) => void;
    onVoid: (entry: ProjectGroupFinancialEntry) => void;
};

/** 직접 Expense·Revenue 이력과 수정·무효화 액션을 같은 카드 구조로 제공합니다. */
function FinancialSection({
    title,
    description,
    kind,
    entries,
    onCreate,
    onEdit,
    onVoid
}: FinancialSectionProps) {
    return (
        <section className="project-group-section project-group-financial-section">
            <div className="project-group-section__header">
                <div><h2>{title}</h2><p>{description}</p></div>
                <button type="button" className="project-group-button" onClick={onCreate}>{kind === 'REVENUE' ? '수익 등록' : '비용 등록'}</button>
            </div>
            {kind === 'REVENUE' && <p className="project-group-notice">다른 프로젝트나 그룹에 이미 등록한 수익을 중복 입력하지 않도록 확인해 주세요.</p>}
            {entries.length === 0 ? (
                <p className="project-group-section__empty">등록된 항목이 없습니다.</p>
            ) : (
                <ul className="project-group-financial-list">
                    {entries.map(entry => (
                        <li key={entry.entryId} className={entry.status === 'VOIDED' ? 'is-voided' : ''}>
                            <div>
                                <strong>{getFinancialEntryLabel(kind, entry.entryType)}</strong>
                                <span>{formatDate(entry.occurredOn)}{entry.memo ? ` · ${entry.memo}` : ''}</span>
                            </div>
                            <strong>{formatWon(entry.amount)}</strong>
                            {entry.status === 'ACTIVE' ? (
                                <div className="project-group-financial-list__actions">
                                    <button type="button" onClick={() => onEdit(entry)}>수정</button>
                                    <button type="button" onClick={() => onVoid(entry)}>무효 처리</button>
                                </div>
                            ) : <span className="project-group-voided-label">무효</span>}
                        </li>
                    ))}
                </ul>
            )}
        </section>
    );
}

type GroupFormProps = {
    formRef: React.RefObject<HTMLFormElement | null>;
    values: GroupFormValues;
    errors: FieldErrors<GroupFormValues>;
    availableProjects: ProjectGroupProject[];
    isProjectsLoading: boolean;
    isEditing: boolean;
    isSubmitting: boolean;
    modalError: string | null;
    onChange: <TField extends keyof GroupFormValues>(field: TField, value: GroupFormValues[TField]) => void;
    onCancel: () => void;
    onSubmit: (event: React.SubmitEvent<HTMLFormElement>) => void;
};

/** ProjectGroup 기본 정보와 생성 시 선택 Project를 입력받는 공통 생성·수정 폼입니다. */
function GroupForm({
    formRef,
    values,
    errors,
    availableProjects,
    isProjectsLoading,
    isEditing,
    isSubmitting,
    modalError,
    onChange,
    onCancel,
    onSubmit
}: GroupFormProps) {
    return (
        <form ref={formRef} className="project-group-form" onSubmit={onSubmit} noValidate>
            {modalError && <FeedbackMessage type="error" message={modalError} />}
            <label className="project-group-field">
                <span>프로젝트 그룹 이름</span>
                <input data-autofocus value={values.name} maxLength={150} disabled={isSubmitting} aria-invalid={Boolean(errors.name)} onChange={event => onChange('name', event.target.value)} />
                {errors.name && <small role="alert">{errors.name}</small>}
            </label>
            <label className="project-group-field">
                <span>설명 <em>선택</em></span>
                <textarea value={values.description} rows={3} maxLength={1000} disabled={isSubmitting} onChange={event => onChange('description', event.target.value)} />
            </label>
            <div className="project-group-form__dates">
                <label className="project-group-field"><span>시작일 <em>선택</em></span><input type="date" value={values.startDate} disabled={isSubmitting} onChange={event => onChange('startDate', event.target.value)} /></label>
                <label className="project-group-field"><span>종료일 <em>선택</em></span><input type="date" value={values.endDate} disabled={isSubmitting} aria-invalid={Boolean(errors.endDate)} onChange={event => onChange('endDate', event.target.value)} />{errors.endDate && <small role="alert">{errors.endDate}</small>}</label>
            </div>
            {isEditing ? (
                <label className="project-group-field">
                    <span>상태</span>
                    <select value={values.status} disabled={isSubmitting} onChange={event => onChange('status', event.target.value as ProjectGroupStatus)}>
                        {Object.entries(STATUS_META).map(([value, meta]) => <option key={value} value={value}>{meta.label}</option>)}
                    </select>
                    {(values.status === 'COMPLETED' || values.status === 'CANCELLED') && <small className="project-group-field__hint">새 프로젝트 연결은 제한되지만 비용·수익 기록은 계속할 수 있습니다.</small>}
                </label>
            ) : (
                <fieldset className="project-group-project-picker">
                    <legend>프로젝트 연결 <span>선택</span></legend>
                    {isProjectsLoading ? <p role="status">연결 가능한 프로젝트를 불러오는 중...</p> : availableProjects.length === 0 ? <p>현재 연결할 수 있는 프로젝트가 없습니다.</p> : availableProjects.map(project => (
                        <label key={project.projectId}>
                            <input type="checkbox" checked={values.projectIds.includes(project.projectId)} disabled={isSubmitting} onChange={event => onChange('projectIds', event.target.checked ? [...values.projectIds, project.projectId] : values.projectIds.filter(id => id !== project.projectId))} />
                            <span><strong>{project.title}</strong><small>{project.channelName}</small></span>
                        </label>
                    ))}
                </fieldset>
            )}
            <p className="project-group-form__notice">프로젝트는 그룹 없이도 관리할 수 있으며, 생성 상태는 준비 중입니다.</p>
            <div className="project-group-form__actions">
                <button type="button" className="project-group-button" disabled={isSubmitting} onClick={onCancel}>취소</button>
                <button type="submit" className="project-group-button project-group-button--primary" disabled={isSubmitting}>{isSubmitting ? '저장 중...' : '저장'}</button>
            </div>
        </form>
    );
}

type ProjectConnectFormProps = {
    projects: ProjectGroupProject[];
    isProjectsLoading: boolean;
    selectedIds: number[];
    isSubmitting: boolean;
    modalError: string | null;
    onSelectedIdsChange: (ids: number[]) => void;
    onCancel: () => void;
    onSubmit: (event: React.SubmitEvent<HTMLFormElement>) => void;
};

/** 아직 그룹이 없는 Project를 여러 개 선택해 현재 ProjectGroup에 연결합니다. */
function ProjectConnectForm({
    projects,
    isProjectsLoading,
    selectedIds,
    isSubmitting,
    modalError,
    onSelectedIdsChange,
    onCancel,
    onSubmit
}: ProjectConnectFormProps) {
    return (
        <form className="project-group-form" onSubmit={onSubmit}>
            {modalError && <FeedbackMessage type="error" message={modalError} />}
            <fieldset className="project-group-project-picker">
                <legend>연결할 프로젝트</legend>
                {isProjectsLoading ? <p role="status">연결 가능한 프로젝트를 불러오는 중...</p> : projects.length === 0 ? <p>현재 연결할 수 있는 프로젝트가 없습니다.</p> : projects.map((project, index) => (
                    <label key={project.projectId}>
                        <input data-autofocus={index === 0 || undefined} type="checkbox" checked={selectedIds.includes(project.projectId)} disabled={isSubmitting} onChange={event => onSelectedIdsChange(event.target.checked ? [...selectedIds, project.projectId] : selectedIds.filter(id => id !== project.projectId))} />
                        <span><strong>{project.title}</strong><small>{project.channelName}</small></span>
                    </label>
                ))}
            </fieldset>
            <p className="project-group-form__notice">다른 그룹에 연결된 프로젝트는 목록에 표시하지 않습니다.</p>
            <div className="project-group-form__actions">
                <button type="button" className="project-group-button" disabled={isSubmitting} onClick={onCancel}>취소</button>
                <button type="submit" className="project-group-button project-group-button--primary" disabled={isSubmitting || isProjectsLoading || projects.length === 0}>{isSubmitting ? '연결 중...' : '연결'}</button>
            </div>
        </form>
    );
}

type FinancialFormProps = {
    formRef: React.RefObject<HTMLFormElement | null>;
    kind: FinancialEntryKind;
    values: FinancialFormValues;
    errors: FieldErrors<FinancialFormValues>;
    isSubmitting: boolean;
    modalError: string | null;
    onChange: (field: keyof FinancialFormValues, value: string) => void;
    onCancel: () => void;
    onSubmit: (event: React.SubmitEvent<HTMLFormElement>) => void;
};

/** 현재 ProjectGroup 귀속이 고정된 직접 Expense·Revenue 공통 입력 폼입니다. */
function FinancialForm({
    formRef,
    kind,
    values,
    errors,
    isSubmitting,
    modalError,
    onChange,
    onCancel,
    onSubmit
}: FinancialFormProps) {
    return (
        <form ref={formRef} className="project-group-form" onSubmit={onSubmit} noValidate>
            {modalError && <FeedbackMessage type="error" message={modalError} />}
            <label className="project-group-field">
                <span>{kind === 'REVENUE' ? '수익 유형' : '비용 유형'}</span>
                <select data-autofocus value={values.entryType} disabled={isSubmitting} aria-invalid={Boolean(errors.entryType)} onChange={event => onChange('entryType', event.target.value)}>
                    <option value="">선택</option>
                    {FINANCIAL_ENTRY_TYPES[kind].map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
                </select>
                {errors.entryType && <small role="alert">{errors.entryType}</small>}
            </label>
            <div className="project-group-form__dates">
                <label className="project-group-field"><span>금액</span><div className="project-group-amount-input"><input inputMode="decimal" value={values.amount} disabled={isSubmitting} aria-invalid={Boolean(errors.amount)} onChange={event => onChange('amount', event.target.value)} /><span>원</span></div>{errors.amount && <small role="alert">{errors.amount}</small>}</label>
                <label className="project-group-field"><span>발생일 또는 정산 기준일</span><input type="date" value={values.occurredOn} disabled={isSubmitting} aria-invalid={Boolean(errors.occurredOn)} onChange={event => onChange('occurredOn', event.target.value)} />{errors.occurredOn && <small role="alert">{errors.occurredOn}</small>}</label>
            </div>
            <label className="project-group-field"><span>메모 <em>선택</em></span><textarea value={values.memo} maxLength={500} rows={3} disabled={isSubmitting} onChange={event => onChange('memo', event.target.value)} /></label>
            <p className="project-group-form__notice">귀속 대상은 현재 프로젝트 그룹으로 고정됩니다.{kind === 'REVENUE' ? ' 실제로 발생했거나 금액이 확정된 수익만 등록해 주세요.' : ''}</p>
            <div className="project-group-form__actions">
                <button type="button" className="project-group-button" disabled={isSubmitting} onClick={onCancel}>취소</button>
                <button type="submit" className="project-group-button project-group-button--primary" disabled={isSubmitting}>{isSubmitting ? '저장 중...' : '저장'}</button>
            </div>
        </form>
    );
}

export default ProjectGroupPage;
