import { useCallback, useEffect, useRef, useState } from 'react';

import {
    createWorkspaceTaskType,
    deleteWorkspaceTaskType,
    getWorkspaceTaskTypes,
    updateWorkspaceTaskType
} from '../../api/workspaces/taskTypes';
import type { WorkspaceTaskType } from '../../types/workspaceSettings';
import FeedbackMessage, { type FeedbackMessageType } from '../common/FeedbackMessage';
import SettingsModal from './SettingsModal';

type TaskTypeManagementProps = {
    workspaceId: number;
    onDirtyChange: (isDirty: boolean) => void;
};

type FeedbackState = {
    type: FeedbackMessageType;
    message: string;
};

/**
 * 현재 제작팀의 확장 가능한 Task Type을 관리합니다.
 * 기본 제공 항목과 사용자 추가 항목에 동일한 수정·비활성화 규칙을 적용합니다.
 */
function TaskTypeManagement({
    workspaceId,
    onDirtyChange
}: TaskTypeManagementProps) {
    const [taskTypes, setTaskTypes] = useState<WorkspaceTaskType[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [loadError, setLoadError] = useState<string | null>(null);
    const [feedback, setFeedback] = useState<FeedbackState | null>(null);
    const [modalError, setModalError] = useState<string | null>(null);
    const [editingTaskType, setEditingTaskType] =
        useState<WorkspaceTaskType | null>(null);
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [name, setName] = useState('');
    const [nameError, setNameError] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [updatingTaskTypeIds, setUpdatingTaskTypeIds] =
        useState<Set<number>>(() => new Set());
    const [deletingTaskTypeIds, setDeletingTaskTypeIds] =
        useState<Set<number>>(() => new Set());
    const [taskTypeErrors, setTaskTypeErrors] =
        useState<Record<number, string>>({});
    const nameInputRef = useRef<HTMLInputElement>(null);

    const isModalOpen = isCreateModalOpen || editingTaskType !== null;
    const initialName = editingTaskType?.name ?? '';
    const isDirty = isModalOpen && name !== initialName;

    // 공통 Header와 탭이 같은 Dirty 상태를 사용하도록 입력 변화 여부를 전달합니다.
    useEffect(() => {
        onDirtyChange(isDirty);
    }, [isDirty, onDirtyChange]);

    useEffect(() => () => onDirtyChange(false), [onDirtyChange]);

    /** 관리 화면에 활성·비활성 Task Type을 모두 조회합니다. */
    const loadTaskTypes = useCallback(async () => {
        try {
            setIsLoading(true);
            setLoadError(null);

            const response = await getWorkspaceTaskTypes(
                workspaceId,
                { activeOnly: false }
            );

            if (!response.success) {
                setTaskTypes([]);
                setLoadError(response.message);
                return;
            }

            setTaskTypes(response.data);
        } catch (error) {
            console.error(error);
            setTaskTypes([]);
            setLoadError('작업 종류 목록을 불러오지 못했습니다.');
        } finally {
            setIsLoading(false);
        }
    }, [workspaceId]);

    useEffect(() => {
        void loadTaskTypes();
    }, [loadTaskTypes]);

    /** 새 Task Type 모달을 빈 이름으로 엽니다. */
    const openCreateModal = () => {
        setEditingTaskType(null);
        setName('');
        setNameError('');
        setModalError(null);
        setFeedback(null);
        setIsCreateModalOpen(true);
    };

    /** 선택한 Task Type 이름을 수정 모달에 복사합니다. */
    const openEditModal = (taskType: WorkspaceTaskType) => {
        setIsCreateModalOpen(false);
        setEditingTaskType(taskType);
        setName(taskType.name);
        setNameError('');
        setModalError(null);
        setFeedback(null);
    };

    /** 승인되지 않은 미저장 값이 있으면 모달 닫기를 중단합니다. */
    const closeModal = useCallback(() => {
        if (isDirty && !window.confirm(
            '저장하지 않은 변경사항이 있습니다. 변경사항을 버리고 닫을까요?'
        )) {
            return;
        }

        setIsCreateModalOpen(false);
        setEditingTaskType(null);
        setName('');
        setNameError('');
        setModalError(null);
        onDirtyChange(false);
    }, [isDirty, onDirtyChange]);

    /** Task Type 생성 또는 이름 수정을 처리하고 성공 결과를 목록에 반영합니다. */
    const handleSubmit = async (event: React.SubmitEvent<HTMLFormElement>) => {
        event.preventDefault();

        try {
            setIsSubmitting(true);
            setNameError('');
            setModalError(null);

            const response = editingTaskType
                ? await updateWorkspaceTaskType(
                    workspaceId,
                    editingTaskType.taskTypeId,
                    { name, active: editingTaskType.active }
                )
                : await createWorkspaceTaskType(workspaceId, { name });

            if (!response.success) {
                const fieldError = response.errors?.find(error => error.field === 'name');
                if (fieldError) {
                    setNameError(fieldError.reason);
                    window.requestAnimationFrame(() => nameInputRef.current?.focus());
                } else {
                    setModalError(response.message);
                }
                return;
            }

            setTaskTypes(current => editingTaskType
                ? current.map(taskType =>
                    taskType.taskTypeId === response.data.taskTypeId
                        ? response.data
                        : taskType
                )
                : [...current, response.data]
            );
            setFeedback({
                type: 'success',
                message: response.message ?? '작업 종류를 저장했습니다.'
            });
            setIsCreateModalOpen(false);
            setEditingTaskType(null);
            setName('');
            setModalError(null);
            onDirtyChange(false);
        } catch (error) {
            console.error(error);
            setModalError('작업 종류를 저장하지 못했습니다. 잠시 후 다시 시도해 주세요.');
        } finally {
            setIsSubmitting(false);
        }
    };

    /** Task Type을 삭제하지 않고 신규 Task 선택 가능 여부만 전환합니다. */
    const handleActiveChange = async (taskType: WorkspaceTaskType) => {
        const nextActive = !taskType.active;
        const actionLabel = nextActive ? '다시 활성화' : '비활성화';

        if (!window.confirm(`${taskType.name} 작업 종류를 ${actionLabel}할까요?`)) {
            return;
        }

        try {
            setUpdatingTaskTypeIds(current => new Set(current).add(taskType.taskTypeId));
            setTaskTypeErrors(current => {
                const nextErrors = { ...current };
                delete nextErrors[taskType.taskTypeId];
                return nextErrors;
            });
            setFeedback(null);

            const response = await updateWorkspaceTaskType(
                workspaceId,
                taskType.taskTypeId,
                { name: taskType.name, active: nextActive }
            );

            if (!response.success) {
                setFeedback({ type: 'error', message: response.message });
                return;
            }

            setTaskTypes(current => current.map(item =>
                item.taskTypeId === taskType.taskTypeId ? response.data : item
            ));
            setFeedback({
                type: 'success',
                message: nextActive
                    ? '작업 종류를 다시 활성화했습니다.'
                    : '작업 종류를 비활성화했습니다.'
            });
        } catch (error) {
            console.error(error);
            setFeedback({ type: 'error', message: '작업 종류 상태를 변경하지 못했습니다.' });
        } finally {
            setUpdatingTaskTypeIds(current => {
                const nextIds = new Set(current);
                nextIds.delete(taskType.taskTypeId);
                return nextIds;
            });
        }
    };

    /** 사용 이력이 없는 Task Type을 확인 후 물리 삭제하고 카드 목록에서 제거합니다. */
    const handleDelete = async (taskType: WorkspaceTaskType) => {
        if (!window.confirm(
            `${taskType.name} 작업 종류를 삭제할까요? 삭제하면 되돌릴 수 없습니다.`
        )) {
            return;
        }

        try {
            setDeletingTaskTypeIds(current => new Set(current).add(taskType.taskTypeId));
            setTaskTypeErrors(current => {
                const nextErrors = { ...current };
                delete nextErrors[taskType.taskTypeId];
                return nextErrors;
            });
            setFeedback(null);

            const response = await deleteWorkspaceTaskType(
                workspaceId,
                taskType.taskTypeId
            );

            if (!response.success) {
                setTaskTypeErrors(current => ({
                    ...current,
                    [taskType.taskTypeId]: response.message
                }));
                return;
            }

            setTaskTypes(current => current.filter(
                item => item.taskTypeId !== response.data.taskTypeId
            ));
            setFeedback({
                type: 'success',
                message: response.message ?? '작업 종류를 삭제했습니다.'
            });
        } catch (error) {
            console.error(error);
            setTaskTypeErrors(current => ({
                ...current,
                [taskType.taskTypeId]: '작업 종류를 삭제하지 못했습니다. 잠시 후 다시 시도해 주세요.'
            }));
        } finally {
            setDeletingTaskTypeIds(current => {
                const nextIds = new Set(current);
                nextIds.delete(taskType.taskTypeId);
                return nextIds;
            });
        }
    };

    return (
        <section className="settings-resource" aria-labelledby="task-type-management-title">
            <div className="settings-resource__header">
                <div>
                    <h2 id="task-type-management-title">작업 종류 관리</h2>
                    <p>제작 흐름에 맞는 작업 종류를 자유롭게 추가하고 관리합니다.</p>
                </div>

                <button type="button" className="settings-button settings-button--primary" onClick={openCreateModal}>
                    작업 종류 추가
                </button>
            </div>

            {feedback && <FeedbackMessage type={feedback.type} message={feedback.message} />}

            {isLoading ? (
                <p className="settings-state" role="status">작업 종류를 불러오는 중...</p>
            ) : loadError ? (
                <div className="settings-state settings-state--error">
                    <FeedbackMessage type="error" message={loadError} />
                    <button type="button" className="settings-button" onClick={() => void loadTaskTypes()}>
                        다시 시도
                    </button>
                </div>
            ) : taskTypes.length === 0 ? (
                <div className="settings-state">
                    <strong>등록된 작업 종류가 없습니다.</strong>
                    <p>가편집, 자막, 촬영처럼 제작팀의 작업 방식을 추가해 보세요.</p>
                </div>
            ) : (
                <ul className="settings-card-list settings-card-list--compact">
                    {taskTypes.map(taskType => {
                        const isUpdating = updatingTaskTypeIds.has(taskType.taskTypeId);
                        const isDeleting = deletingTaskTypeIds.has(taskType.taskTypeId);
                        const isPending = isUpdating || isDeleting;
                        const taskTypeError = taskTypeErrors[taskType.taskTypeId];

                        return (
                            <li key={taskType.taskTypeId} className={`settings-card settings-card--compact ${taskType.active ? '' : 'settings-card--inactive'}`}>
                                <div className="settings-card__heading">
                                    <div>
                                        <h3>{taskType.name}</h3>
                                        <div className="settings-card__badges">
                                            <span className={`settings-badge settings-badge--${taskType.active ? 'active' : 'inactive'}`}>
                                                {taskType.active ? '사용 중' : '비활성'}
                                            </span>
                                        </div>
                                    </div>
                                </div>

                                {!taskType.active && (
                                    <p className="settings-card__hint">
                                        새 작업 선택에서는 제외되며 기존 작업 이력은 유지됩니다.
                                    </p>
                                )}

                                <div className="settings-card__actions">
                                    <button type="button" className="settings-button" disabled={isPending} onClick={() => openEditModal(taskType)}>
                                        수정
                                    </button>
                                    <button type="button" className="settings-button" disabled={isPending} onClick={() => void handleActiveChange(taskType)}>
                                        {isUpdating ? '처리 중...' : taskType.active ? '비활성화' : '재활성화'}
                                    </button>
                                    <button type="button" className="settings-button settings-button--danger" disabled={isPending} onClick={() => void handleDelete(taskType)}>
                                        {isDeleting ? '삭제 중...' : '삭제'}
                                    </button>
                                </div>

                                {taskTypeError && (
                                    <p className="settings-card__error" role="alert">
                                        {taskTypeError}
                                    </p>
                                )}
                            </li>
                        );
                    })}
                </ul>
            )}

            {isModalOpen && (
                <SettingsModal
                    titleId="task-type-form-title"
                    title={editingTaskType ? '작업 종류 이름 수정' : '작업 종류 추가'}
                    description="기본 작업 종류와 새 작업 종류에 같은 관리 규칙을 적용합니다."
                    onRequestClose={closeModal}
                >
                    <form className="settings-form" onSubmit={handleSubmit} noValidate>
                        {modalError && (
                            <FeedbackMessage type="error" message={modalError} />
                        )}

                        <div className="settings-field">
                            <label htmlFor="task-type-name">작업 종류 이름</label>
                            <input
                                ref={nameInputRef}
                                data-autofocus
                                id="task-type-name"
                                value={name}
                                maxLength={100}
                                disabled={isSubmitting}
                                aria-invalid={Boolean(nameError)}
                                aria-describedby={nameError ? 'task-type-name-error' : undefined}
                                onChange={event => {
                                    setName(event.target.value);
                                    setNameError('');
                                }}
                            />
                            {nameError && <p id="task-type-name-error" className="settings-field__error">{nameError}</p>}
                        </div>

                        <p className="settings-form__notice">
                            앞뒤 공백과 영문 대소문자를 무시해 같은 이름을 확인합니다.
                        </p>

                        <div className="settings-form__actions">
                            <button type="button" className="settings-button" disabled={isSubmitting} onClick={closeModal}>취소</button>
                            <button type="submit" className="settings-button settings-button--primary" disabled={isSubmitting}>
                                {isSubmitting ? '저장 중...' : '저장'}
                            </button>
                        </div>
                    </form>
                </SettingsModal>
            )}
        </section>
    );
}

export default TaskTypeManagement;
