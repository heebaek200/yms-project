type WorkspaceCreateFormProps = {
    name: string;
    description: string;
    nameError: string;
    descriptionError: string;
    isSubmitting: boolean;
    onNameChange: (value: string) => void;
    onDescriptionChange: (value: string) => void;
    onCancel: () => void;
    onSubmit: (event: React.SubmitEvent<HTMLFormElement>) => void;
};

/**
 * 새 Workspace의 이름과 선택 설명을 입력받는 온보딩 전용 폼입니다.
 * 서버 필드 오류를 각 입력에 연결하고 생성 중 취소와 중복 제출을 막습니다.
 * 실제 생성과 Context 갱신 책임은 상위 Workspace 온보딩 페이지에 위임합니다.
 */
function WorkspaceCreateForm({
    name,
    description,
    nameError,
    descriptionError,
    isSubmitting,
    onNameChange,
    onDescriptionChange,
    onCancel,
    onSubmit
}: WorkspaceCreateFormProps) {
    return (
        <form
            className="workspace-create-form"
            onSubmit={onSubmit}
            noValidate
        >
            <div className="workspace-create-form__header">
                <div>
                    <h3>새 제작팀 만들기</h3>
                    <p>생성한 사용자는 제작팀 소유자가 됩니다.</p>
                </div>
            </div>

            <div className={`workspace-form-field ${nameError
                ? 'workspace-form-field--error'
                : ''
            }`}>
                <label htmlFor="workspace-name">제작팀 이름</label>
                <input
                    id="workspace-name"
                    type="text"
                    value={name}
                    maxLength={100}
                    disabled={isSubmitting}
                    aria-invalid={Boolean(nameError)}
                    aria-describedby={nameError ? 'workspace-name-error' : undefined}
                    onChange={event => onNameChange(event.target.value)}
                />
                {nameError && (
                    <p id="workspace-name-error" className="workspace-form-error">
                        {nameError}
                    </p>
                )}
            </div>

            <div className={`workspace-form-field ${descriptionError
                ? 'workspace-form-field--error'
                : ''
            }`}>
                <label htmlFor="workspace-description">
                    설명 <span>선택</span>
                </label>
                <textarea
                    id="workspace-description"
                    value={description}
                    maxLength={500}
                    rows={4}
                    disabled={isSubmitting}
                    aria-invalid={Boolean(descriptionError)}
                    aria-describedby={descriptionError
                        ? 'workspace-description-error'
                        : 'workspace-description-count'
                    }
                    onChange={event => onDescriptionChange(event.target.value)}
                />
                <div className="workspace-create-form__description-meta">
                    {descriptionError ? (
                        <p
                            id="workspace-description-error"
                            className="workspace-form-error"
                        >
                            {descriptionError}
                        </p>
                    ) : <span />}
                    <span id="workspace-description-count">
                        {description.length}/500
                    </span>
                </div>
            </div>

            <div className="workspace-create-form__actions">
                <button
                    type="button"
                    className="workspace-secondary-button"
                    disabled={isSubmitting}
                    onClick={onCancel}
                >
                    취소
                </button>
                <button
                    type="submit"
                    className="workspace-primary-button"
                    disabled={isSubmitting}
                >
                    {isSubmitting ? '생성 중...' : '제작팀 생성'}
                </button>
            </div>
        </form>
    );
}

export default WorkspaceCreateForm;
