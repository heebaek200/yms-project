import { useEffect, useRef, type ReactNode } from 'react';

import CloseIcon from '../common/CloseIcon';

type ProjectGroupModalProps = {
    titleId: string;
    title: string;
    description: string;
    children: ReactNode;
    onRequestClose: () => void;
};

/** ProjectGroup 폼을 접근 가능한 Dialog로 표시하고 Escape·배경 닫기를 한 경로로 모읍니다. */
function ProjectGroupModal({
    titleId,
    title,
    description,
    children,
    onRequestClose
}: ProjectGroupModalProps) {
    const dialogRef = useRef<HTMLDivElement>(null);
    const onRequestCloseRef = useRef(onRequestClose);
    const descriptionId = `${titleId}-description`;

    // 재렌더링마다 이벤트를 다시 등록하지 않고 최신 닫기 동작만 참조합니다.
    useEffect(() => {
        onRequestCloseRef.current = onRequestClose;
    }, [onRequestClose]);

    // 모달을 여는 동안 배경 스크롤과 포커스 이탈을 막고 닫힌 뒤 이전 위치로 복원합니다.
    useEffect(() => {
        const previouslyFocused = document.activeElement instanceof HTMLElement
            ? document.activeElement
            : null;
        const previousOverflow = document.body.style.overflow;
        const dialog = dialogRef.current;
        document.body.style.overflow = 'hidden';
        dialog?.querySelector<HTMLElement>('[data-autofocus]')?.focus();

        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                event.preventDefault();
                onRequestCloseRef.current();
                return;
            }

            if (event.key !== 'Tab' || !dialog) {
                return;
            }

            const focusableElements = Array.from(
                dialog.querySelectorAll<HTMLElement>([
                    'button:not([disabled])',
                    'input:not([disabled])',
                    'select:not([disabled])',
                    'textarea:not([disabled])',
                    'a[href]'
                ].join(','))
            ).filter(element => element.getClientRects().length > 0);

            // 상호작용 요소가 없으면 Dialog 자체에 포커스를 유지합니다.
            if (focusableElements.length === 0) {
                event.preventDefault();
                dialog.focus();
                return;
            }

            const firstElement = focusableElements[0];
            const lastElement = focusableElements[focusableElements.length - 1];
            if (event.shiftKey && document.activeElement === firstElement) {
                event.preventDefault();
                lastElement.focus();
            } else if (!event.shiftKey && document.activeElement === lastElement) {
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
            className="project-group-modal-backdrop"
            onPointerDown={event => {
                if (event.target === event.currentTarget) {
                    onRequestClose();
                }
            }}
        >
            <div
                ref={dialogRef}
                className="project-group-modal"
                role="dialog"
                aria-modal="true"
                aria-labelledby={titleId}
                aria-describedby={descriptionId}
                tabIndex={-1}
            >
                <header className="project-group-modal__header">
                    <div>
                        <h2 id={titleId}>{title}</h2>
                        <p id={descriptionId}>{description}</p>
                    </div>
                    <button
                        type="button"
                        className="project-group-modal__close"
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

export default ProjectGroupModal;
