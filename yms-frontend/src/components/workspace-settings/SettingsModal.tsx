import { useEffect, useRef, type ReactNode } from 'react';

import CloseIcon from '../common/CloseIcon';

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
    const onRequestCloseRef = useRef(onRequestClose);
    const descriptionId = `${titleId}-description`;

    // 닫기 함수가 바뀌어도 모달의 최초 포커스와 복원 대상을 다시 잡지 않도록 최신 함수만 보관합니다.
    useEffect(() => {
        onRequestCloseRef.current = onRequestClose;
    }, [onRequestClose]);

    // 모달 안에 포커스를 가두고 닫힐 때 모달을 열었던 요소로 복원합니다.
    useEffect(() => {
        const previouslyFocused = document.activeElement instanceof HTMLElement
            ? document.activeElement
            : null;
        const previousOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';

        const dialog = dialogRef.current;
        const autofocusTarget = dialog
            ?.querySelector<HTMLElement>('[data-autofocus]');
        (autofocusTarget ?? dialog)?.focus();

        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                event.preventDefault();
                onRequestCloseRef.current();
                return;
            }

            if (event.key !== 'Tab' || !dialog) {
                return;
            }

            // 현재 보이는 상호작용 요소만 순회해 배경 화면으로 포커스가 빠지지 않게 합니다.
            const focusableElements = Array.from(
                dialog.querySelectorAll<HTMLElement>([
                    'a[href]',
                    'button:not([disabled])',
                    'input:not([disabled])',
                    'select:not([disabled])',
                    'textarea:not([disabled])',
                    '[tabindex]:not([tabindex="-1"])'
                ].join(','))
            ).filter(element => element.getClientRects().length > 0);

            if (focusableElements.length === 0) {
                event.preventDefault();
                dialog.focus();
                return;
            }

            const firstElement = focusableElements[0];
            const lastElement = focusableElements[focusableElements.length - 1];
            const activeElement = document.activeElement;

            if (activeElement === dialog || !dialog.contains(activeElement)) {
                event.preventDefault();
                (event.shiftKey ? lastElement : firstElement).focus();
            } else if (event.shiftKey && activeElement === firstElement) {
                event.preventDefault();
                lastElement.focus();
            } else if (!event.shiftKey && activeElement === lastElement) {
                event.preventDefault();
                firstElement.focus();
            }
        };

        document.addEventListener('keydown', handleKeyDown);

        return () => {
            document.body.style.overflow = previousOverflow;
            document.removeEventListener('keydown', handleKeyDown);
            if (previouslyFocused?.isConnected) {
                previouslyFocused.focus();
            }
        };
    }, []);

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
                aria-describedby={descriptionId}
                tabIndex={-1}
            >
                <header className="settings-modal__header">
                    <div>
                        <h2 id={titleId}>{title}</h2>
                        <p id={descriptionId}>{description}</p>
                    </div>

                    <button
                        type="button"
                        className="settings-modal__close"
                        aria-label={`${title} 닫기`}
                        onClick={onRequestClose}
                    >
                        <CloseIcon />
                    </button>
                </header>

                {children}
            </div>
        </div>
    );
}

export default SettingsModal;
