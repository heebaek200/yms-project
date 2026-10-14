import { useEffect, useRef, type ReactNode } from 'react';

type SettingsModalProps = {
    titleId: string;
    title: string;
    description: string;
    children: ReactNode;
    onRequestClose: () => void;
};

/**
 * 제작팀 관리 폼을 공통 Dialog로 표시합니다.
 * Escape·배경·닫기 버튼을 같은 닫기 경로로 모아 미저장 확인이 빠지지 않게 합니다.
 */
function SettingsModal({
    titleId,
    title,
    description,
    children,
    onRequestClose
}: SettingsModalProps) {
    const dialogRef = useRef<HTMLDivElement>(null);

    // 모달을 연 뒤 첫 입력으로 포커스를 옮기고 배경 스크롤을 잠급니다.
    useEffect(() => {
        const previousOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        dialogRef.current
            ?.querySelector<HTMLElement>('[data-autofocus]')
            ?.focus();

        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                event.preventDefault();
                onRequestClose();
            }
        };

        document.addEventListener('keydown', handleKeyDown);

        return () => {
            document.body.style.overflow = previousOverflow;
            document.removeEventListener('keydown', handleKeyDown);
        };
    }, [onRequestClose]);

    return (
        <div
            className="settings-modal-backdrop"
            onPointerDown={event => {
                // Dialog 내부 클릭은 닫기 동작으로 해석하지 않습니다.
                if (event.target === event.currentTarget) {
                    onRequestClose();
                }
            }}
        >
            <div
                ref={dialogRef}
                className="settings-modal"
                role="dialog"
                aria-modal="true"
                aria-labelledby={titleId}
            >
                <header className="settings-modal__header">
                    <div>
                        <h2 id={titleId}>{title}</h2>
                        <p>{description}</p>
                    </div>

                    <button
                        type="button"
                        className="settings-modal__close"
                        aria-label={`${title} 닫기`}
                        onClick={onRequestClose}
                    >
                        ×
                    </button>
                </header>

                {children}
            </div>
        </div>
    );
}

export default SettingsModal;
