import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import {
    createWorkspaceChannel,
    deleteWorkspaceChannel,
    getWorkspaceChannels,
    updateWorkspaceChannel
} from '../../api/workspaces/channels';
import type {
    ChannelIntegrationStatus,
    WorkspaceChannel
} from '../../types/workspaceSettings';
import FeedbackMessage, { type FeedbackMessageType } from '../common/FeedbackMessage';
import SettingsModal from './SettingsModal';
import { normalizeRateInput } from '../../utils/format';

type ChannelManagementProps = {
    workspaceId: number;
    onDirtyChange: (isDirty: boolean) => void;
};

type ChannelFormValues = {
    name: string;
    youtubeChannelId: string;
    youtubeChannelUrl: string;
    description: string;
    longFormRate: string;
    shortFormRate: string;
};

type ChannelFieldErrors = Partial<Record<keyof ChannelFormValues, string>>;

type FeedbackState = {
    type: FeedbackMessageType;
    message: string;
};

const EMPTY_FORM: ChannelFormValues = {
    name: '',
    youtubeChannelId: '',
    youtubeChannelUrl: '',
    description: '',
    longFormRate: '',
    shortFormRate: ''
};

const INTEGRATION_STATUS: Record<
    ChannelIntegrationStatus,
    { label: string; className: string }
> = {
    MANUAL: { label: '수동 등록', className: 'manual' },
    CONNECTED: { label: '연동됨', className: 'connected' },
    DISCONNECTED: { label: '연동 해제', className: 'disconnected' },
    ERROR: { label: '연동 오류', className: 'error' }
};

/** Channel API 응답을 입력 폼에서 편집할 문자열 값으로 변환합니다. */
function toChannelFormValues(channel: WorkspaceChannel): ChannelFormValues {
    return {
        name: channel.name,
        youtubeChannelId: channel.youtubeChannelId ?? '',
        youtubeChannelUrl: channel.youtubeChannelUrl ?? '',
        description: channel.description ?? '',
        longFormRate: channel.longFormRate,
        shortFormRate: channel.shortFormRate
    };
}

/**
 * 현재 제작팀의 Channel 목록과 생성·수정·활성 상태 변경을 제공합니다.
 * 관리 목록은 비활성 항목까지 조회하고 연동 상태는 읽기 전용 정보로 표시합니다.
 */
function ChannelManagement({
    workspaceId,
    onDirtyChange
}: ChannelManagementProps) {
    const [channels, setChannels] = useState<WorkspaceChannel[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [loadError, setLoadError] = useState<string | null>(null);
    const [feedback, setFeedback] = useState<FeedbackState | null>(null);
    const [modalError, setModalError] = useState<string | null>(null);
    const [editingChannel, setEditingChannel] =
        useState<WorkspaceChannel | null>(null);
    const [removingChannel, setRemovingChannel] =
        useState<WorkspaceChannel | null>(null);
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [formValues, setFormValues] = useState<ChannelFormValues>(EMPTY_FORM);
    const [fieldErrors, setFieldErrors] = useState<ChannelFieldErrors>({});
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [updatingChannelIds, setUpdatingChannelIds] =
        useState<Set<number>>(() => new Set());
    const [deletingChannelIds, setDeletingChannelIds] =
        useState<Set<number>>(() => new Set());
    const [channelErrors, setChannelErrors] =
        useState<Record<number, string>>({});
    const formRef = useRef<HTMLFormElement>(null);

    const isModalOpen = isCreateModalOpen || editingChannel !== null;
    const initialFormValues = useMemo(
        () => editingChannel ? toChannelFormValues(editingChannel) : EMPTY_FORM,
        [editingChannel]
    );
    const isDirty = isModalOpen && (
        formValues.name !== initialFormValues.name
        || formValues.youtubeChannelId !== initialFormValues.youtubeChannelId
        || formValues.youtubeChannelUrl !== initialFormValues.youtubeChannelUrl
        || formValues.description !== initialFormValues.description
        || formValues.longFormRate !== initialFormValues.longFormRate
        || formValues.shortFormRate !== initialFormValues.shortFormRate
    );

    // 현재 모달의 변경 여부를 공통 Header와 탭 전환 Guard에 전달합니다.
    useEffect(() => {
        onDirtyChange(isDirty);
    }, [isDirty, onDirtyChange]);

    // 다른 탭 또는 제작팀으로 컴포넌트가 사라질 때 이전 Dirty 상태를 제거합니다.
    useEffect(() => () => onDirtyChange(false), [onDirtyChange]);

    /** 현재 제작팀의 활성·비활성 Channel을 모두 다시 조회합니다. */
    const loadChannels = useCallback(async () => {
        try {
            setIsLoading(true);
            setLoadError(null);

            const response = await getWorkspaceChannels(
                workspaceId,
                { activeOnly: false }
            );

            if (!response.success) {
                setChannels([]);
                setLoadError(response.message);
                return;
            }

            setChannels(response.data);
        } catch (error) {
            console.error(error);
            setChannels([]);
            setLoadError('채널 목록을 불러오지 못했습니다.');
        } finally {
            setIsLoading(false);
        }
    }, [workspaceId]);

    useEffect(() => {
        void loadChannels();
    }, [loadChannels]);

    /** 새 Channel 등록 모달을 비어 있는 수동 등록 상태로 엽니다. */
    const openCreateModal = () => {
        setEditingChannel(null);
        setFormValues(EMPTY_FORM);
        setFieldErrors({});
        setModalError(null);
        setFeedback(null);
        setIsCreateModalOpen(true);
    };

    /** 선택한 Channel의 현재 값을 수정 모달에 복사합니다. */
    const openEditModal = (channel: WorkspaceChannel) => {
        setIsCreateModalOpen(false);
        setEditingChannel(channel);
        setFormValues(toChannelFormValues(channel));
        setFieldErrors({});
        setModalError(null);
        setFeedback(null);
    };

    /**
     * 미저장 변경 확인을 통과한 경우에만 모달 상태를 초기화합니다.
     * 승인된 입력값은 별도 저장소에 남기지 않습니다.
     */
    const closeModal = useCallback(() => {
        if (isDirty && !window.confirm(
            '저장하지 않은 변경사항이 있습니다. 변경사항을 버리고 닫을까요?'
        )) {
            return;
        }

        setIsCreateModalOpen(false);
        setEditingChannel(null);
        setFormValues(EMPTY_FORM);
        setFieldErrors({});
        setModalError(null);
        onDirtyChange(false);
    }, [isDirty, onDirtyChange]);

    /** 입력값을 갱신하면서 사용자가 수정한 필드의 이전 오류를 제거합니다. */
    const updateFormValue = (field: keyof ChannelFormValues, value: string) => {
        setFormValues(current => ({ ...current, [field]: value }));
        setFieldErrors(current => ({ ...current, [field]: undefined }));
    };

    /** 원·쉼표를 포함한 편의 입력을 포커스 이탈 시 API 단가 문자열로 정규화합니다. */
    const normalizeRateField = (field: 'longFormRate' | 'shortFormRate') => {
        const result = normalizeRateInput(formValues[field]);
        if (result.success) {
            updateFormValue(field, result.value);
            return;
        }
        setFieldErrors(current => ({ ...current, [field]: result.message }));
    };

    /** Channel 생성 또는 수정 결과를 목록에 반영하고 성공한 모달을 닫습니다. */
    const handleSubmit = async (event: React.SubmitEvent<HTMLFormElement>) => {
        event.preventDefault();

        try {
            setIsSubmitting(true);
            setFieldErrors({});
            setModalError(null);

            const response = editingChannel
                ? await updateWorkspaceChannel(
                    workspaceId,
                    editingChannel.channelId,
                    { ...formValues, active: editingChannel.active }
                )
                : await createWorkspaceChannel(workspaceId, formValues);

            if (!response.success) {
                const nextErrors: ChannelFieldErrors = {};
                response.errors?.forEach(error => {
                    if (error.field in EMPTY_FORM) {
                        nextErrors[error.field as keyof ChannelFormValues] = error.reason;
                    }
                });
                setFieldErrors(nextErrors);

                // 필드와 연결할 수 없는 저장 오류만 모달 상단의 폼 오류로 안내합니다.
                if (Object.keys(nextErrors).length === 0) {
                    setModalError(response.message);
                } else {
                    window.requestAnimationFrame(() => {
                        formRef.current
                            ?.querySelector<HTMLElement>('[aria-invalid="true"]')
                            ?.focus();
                    });
                }
                return;
            }

            setChannels(current => editingChannel
                ? current.map(channel =>
                    channel.channelId === response.data.channelId
                        ? response.data
                        : channel
                )
                : [...current, response.data]
            );
            setFeedback({
                type: 'success',
                message: response.message ?? '채널 정보를 저장했습니다.'
            });
            setIsCreateModalOpen(false);
            setEditingChannel(null);
            setFormValues(EMPTY_FORM);
            setModalError(null);
            onDirtyChange(false);
        } catch (error) {
            console.error(error);
            setModalError('채널 정보를 저장하지 못했습니다. 잠시 후 다시 시도해 주세요.');
        } finally {
            setIsSubmitting(false);
        }
    };

    /** 삭제 대신 활성 상태만 전환하고 기존 프로젝트의 Channel 참조는 보존합니다. */
    const handleActiveChange = async (channel: WorkspaceChannel) => {
        const nextActive = !channel.active;
        const actionLabel = nextActive ? '다시 활성화' : '비활성화';

        if (!window.confirm(`${channel.name} 채널을 ${actionLabel}할까요?`)) {
            return;
        }

        try {
            setUpdatingChannelIds(current => new Set(current).add(channel.channelId));
            setChannelErrors(current => {
                const nextErrors = { ...current };
                delete nextErrors[channel.channelId];
                return nextErrors;
            });
            setFeedback(null);

            const response = await updateWorkspaceChannel(
                workspaceId,
                channel.channelId,
                {
                    ...toChannelFormValues(channel),
                    active: nextActive
                }
            );

            if (!response.success) {
                setFeedback({ type: 'error', message: response.message });
                return;
            }

            setChannels(current => current.map(item =>
                item.channelId === channel.channelId ? response.data : item
            ));
            setFeedback({
                type: 'success',
                message: nextActive
                    ? '채널을 다시 활성화했습니다.'
                    : '채널을 비활성화했습니다.'
            });
        } catch (error) {
            console.error(error);
            setFeedback({ type: 'error', message: '채널 상태를 변경하지 못했습니다.' });
        } finally {
            setUpdatingChannelIds(current => {
                const nextIds = new Set(current);
                nextIds.delete(channel.channelId);
                return nextIds;
            });
        }
    };

    /** Project 연결 이력이 없는 Channel을 YMS 관리 목록에서 제거합니다. */
    const handleDelete = async (channel: WorkspaceChannel) => {
        try {
            setDeletingChannelIds(current => new Set(current).add(channel.channelId));
            setChannelErrors(current => {
                const nextErrors = { ...current };
                delete nextErrors[channel.channelId];
                return nextErrors;
            });
            setFeedback(null);

            const response = await deleteWorkspaceChannel(
                workspaceId,
                channel.channelId
            );

            if (!response.success) {
                setRemovingChannel(null);
                setChannelErrors(current => ({
                    ...current,
                    [channel.channelId]: response.message
                }));
                return;
            }

            setChannels(current => current.filter(
                item => item.channelId !== response.data.channelId
            ));
            setFeedback({
                type: 'success',
                message: response.message ?? 'YMS 관리 목록에서 채널을 제거했습니다.'
            });
            setRemovingChannel(null);
        } catch (error) {
            console.error(error);
            setRemovingChannel(null);
            setChannelErrors(current => ({
                ...current,
                [channel.channelId]: '채널을 관리에서 제거하지 못했습니다. 잠시 후 다시 시도해 주세요.'
            }));
        } finally {
            setDeletingChannelIds(current => {
                const nextIds = new Set(current);
                nextIds.delete(channel.channelId);
                return nextIds;
            });
        }
    };

    return (
        <section className="settings-resource" aria-labelledby="channel-management-title">
            <div className="settings-resource__header">
                <div>
                    <h2 id="channel-management-title">채널 관리</h2>
                    <p>프로젝트에서 사용할 채널과 YouTube 연동 상태를 관리합니다.</p>
                </div>

                <button type="button" className="settings-button settings-button--primary" onClick={openCreateModal}>
                    채널 추가
                </button>
            </div>

            {feedback && <FeedbackMessage type={feedback.type} message={feedback.message} />}

            {isLoading ? (
                <p className="settings-state" role="status">채널 목록을 불러오는 중...</p>
            ) : loadError ? (
                <div className="settings-state settings-state--error">
                    <FeedbackMessage type="error" message={loadError} />
                    <button type="button" className="settings-button" onClick={() => void loadChannels()}>
                        다시 시도
                    </button>
                </div>
            ) : channels.length === 0 ? (
                <div className="settings-state">
                    <strong>아직 등록된 채널이 없습니다.</strong>
                    <p>첫 채널은 이름만으로도 가볍게 등록할 수 있어요.</p>
                </div>
            ) : (
                <ul className="settings-card-list">
                    {channels.map(channel => {
                        const status = INTEGRATION_STATUS[channel.integrationStatus];
                        const isUpdating = updatingChannelIds.has(channel.channelId);
                        const isDeleting = deletingChannelIds.has(channel.channelId);
                        const isPending = isUpdating || isDeleting;
                        const channelError = channelErrors[channel.channelId];

                        return (
                            <li key={channel.channelId} className={`settings-card ${channel.active ? '' : 'settings-card--inactive'}`}>
                                <div className="settings-card__heading">
                                    <div>
                                        <h3>{channel.name}</h3>
                                        <div className="settings-card__badges">
                                            <span className={`settings-badge settings-badge--${status.className}`}>{status.label}</span>
                                            <span className={`settings-badge settings-badge--${channel.active ? 'active' : 'inactive'}`}>
                                                {channel.active ? '사용 중' : '비활성'}
                                            </span>
                                        </div>
                                    </div>
                                </div>

                                <dl className="settings-card__details">
                                    <div><dt>Channel ID</dt><dd>{channel.youtubeChannelId ?? '입력 안 함'}</dd></div>
                                    <div><dt>URL</dt><dd>{channel.youtubeChannelUrl ?? '입력 안 함'}</dd></div>
                                    <div><dt>설명</dt><dd>{channel.description ?? '설명 없음'}</dd></div>
                                    <div><dt>기본 단가</dt><dd>롱폼 {channel.longFormRate}원 · 쇼츠 {channel.shortFormRate}원</dd></div>
                                </dl>

                                <div className="settings-card__actions">
                                    <button type="button" className="settings-button" disabled={isPending} onClick={() => openEditModal(channel)}>
                                        수정
                                    </button>
                                    <button type="button" className="settings-button" disabled={isPending} onClick={() => void handleActiveChange(channel)}>
                                        {isUpdating ? '처리 중...' : channel.active ? '비활성화' : '재활성화'}
                                    </button>
                                    <button type="button" className="settings-button settings-button--danger" disabled={isPending} onClick={() => setRemovingChannel(channel)}>
                                        {isDeleting ? '제거 중...' : '관리에서 제거'}
                                    </button>
                                </div>

                                {channelError && (
                                    <p className="settings-card__error" role="alert">
                                        {channelError}
                                    </p>
                                )}
                            </li>
                        );
                    })}
                </ul>
            )}

            {isModalOpen && (
                <SettingsModal
                    titleId="channel-form-title"
                    title={editingChannel ? '채널 수정' : '채널 추가'}
                    description="채널명만 필수이며 YouTube 정보는 나중에 입력해도 됩니다."
                    onRequestClose={closeModal}
                >
                    <form ref={formRef} className="settings-form" onSubmit={handleSubmit} noValidate>
                        {modalError && (
                            <FeedbackMessage type="error" message={modalError} />
                        )}

                        <div className="settings-field">
                            <label htmlFor="channel-name">채널명</label>
                            <input data-autofocus id="channel-name" value={formValues.name} maxLength={150} disabled={isSubmitting} aria-invalid={Boolean(fieldErrors.name)} aria-describedby={fieldErrors.name ? 'channel-name-error' : undefined} onChange={event => updateFormValue('name', event.target.value)} />
                            {fieldErrors.name && <p id="channel-name-error" className="settings-field__error">{fieldErrors.name}</p>}
                        </div>

                        <aside className="settings-rate-guide" aria-label="기본 단가 참고 안내">
                            <p>처음 설정할 때 참고할 수 있는 예시입니다.</p>
                            <strong>롱폼 약 3.00원/조회 · 쇼츠 약 0.20원/조회</strong>
                            <p>채널과 콘텐츠에 따라 실제 수익은 달라질 수 있습니다.</p>
                        </aside>

                        <div className="settings-form__columns">
                            <div className="settings-field">
                                <label htmlFor="channel-long-rate">롱폼 기본 단가 <span>선택</span></label>
                                <div className="settings-amount-input">
                                    <input id="channel-long-rate" inputMode="decimal" value={formValues.longFormRate} disabled={isSubmitting} aria-invalid={Boolean(fieldErrors.longFormRate)} onChange={event => updateFormValue('longFormRate', event.target.value)} onBlur={() => normalizeRateField('longFormRate')} />
                                    <span>원</span>
                                </div>
                                {fieldErrors.longFormRate && <p className="settings-field__error">{fieldErrors.longFormRate}</p>}
                            </div>
                            <div className="settings-field">
                                <label htmlFor="channel-short-rate">쇼츠 기본 단가 <span>선택</span></label>
                                <div className="settings-amount-input">
                                    <input id="channel-short-rate" inputMode="decimal" value={formValues.shortFormRate} disabled={isSubmitting} aria-invalid={Boolean(fieldErrors.shortFormRate)} onChange={event => updateFormValue('shortFormRate', event.target.value)} onBlur={() => normalizeRateField('shortFormRate')} />
                                    <span>원</span>
                                </div>
                                {fieldErrors.shortFormRate && <p className="settings-field__error">{fieldErrors.shortFormRate}</p>}
                            </div>
                        </div>

                        <p className="settings-form__notice">단가를 입력하지 않으면 0원으로 저장됩니다. 기존 프로젝트에 저장된 단가는 바뀌지 않습니다.</p>

                        <div className="settings-field">
                            <label htmlFor="channel-youtube-id">YouTube Channel ID <span>선택</span></label>
                            <input id="channel-youtube-id" value={formValues.youtubeChannelId} maxLength={64} disabled={isSubmitting} aria-invalid={Boolean(fieldErrors.youtubeChannelId)} onChange={event => updateFormValue('youtubeChannelId', event.target.value)} />
                            {fieldErrors.youtubeChannelId && <p className="settings-field__error">{fieldErrors.youtubeChannelId}</p>}
                        </div>

                        <div className="settings-field">
                            <label htmlFor="channel-youtube-url">YouTube Channel URL <span>선택</span></label>
                            <input id="channel-youtube-url" type="url" value={formValues.youtubeChannelUrl} maxLength={255} disabled={isSubmitting} aria-invalid={Boolean(fieldErrors.youtubeChannelUrl)} onChange={event => updateFormValue('youtubeChannelUrl', event.target.value)} />
                            {fieldErrors.youtubeChannelUrl && <p className="settings-field__error">{fieldErrors.youtubeChannelUrl}</p>}
                        </div>

                        <div className="settings-field">
                            <label htmlFor="channel-description">설명 <span>선택</span></label>
                            <textarea id="channel-description" value={formValues.description} maxLength={500} rows={4} disabled={isSubmitting} aria-invalid={Boolean(fieldErrors.description)} onChange={event => updateFormValue('description', event.target.value)} />
                            <div className="settings-field__meta">
                                {fieldErrors.description && <p className="settings-field__error">{fieldErrors.description}</p>}
                                <span>{formValues.description.length}/500</span>
                            </div>
                        </div>

                        <p className="settings-form__notice">
                            ID나 URL을 입력해도 실제 YouTube 연동 전에는 수동 등록 상태로 저장됩니다.
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

            {removingChannel && (
                <SettingsModal
                    titleId="channel-remove-title"
                    title="채널을 관리에서 제거"
                    description={`${removingChannel.name} 채널을 YMS 관리 목록에서 제거합니다.`}
                    onRequestClose={() => {
                        if (!deletingChannelIds.has(removingChannel.channelId)) {
                            setRemovingChannel(null);
                        }
                    }}
                >
                    <div className="settings-confirmation">
                        <p>
                            <strong>YouTube의 실제 채널은 삭제되지 않습니다.</strong>
                        </p>
                        <p>
                            YMS에 등록한 채널 정보만 제거되며 되돌릴 수 없습니다.
                        </p>

                        <div className="settings-form__actions">
                            <button
                                data-autofocus
                                type="button"
                                className="settings-button"
                                disabled={deletingChannelIds.has(removingChannel.channelId)}
                                onClick={() => setRemovingChannel(null)}
                            >
                                취소
                            </button>
                            <button
                                type="button"
                                className="settings-button settings-button--danger"
                                disabled={deletingChannelIds.has(removingChannel.channelId)}
                                onClick={() => void handleDelete(removingChannel)}
                            >
                                {deletingChannelIds.has(removingChannel.channelId)
                                    ? '제거 중...'
                                    : '관리에서 제거'}
                            </button>
                        </div>
                    </div>
                </SettingsModal>
            )}
        </section>
    );
}

export default ChannelManagement;
