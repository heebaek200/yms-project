import { useEffect, useRef, type ReactNode } from 'react';

import CloseIcon from '../common/CloseIcon';

import './WorkspaceDepartureModal.css';

type WorkspaceDepartureModalProps = {
    titleId: string;
    title: string;
    description: string;
    children: ReactNode;
    onRequestClose: () => void;
};

/** 제작팀 이탈 영향·확인 내용을 접근 가능한 공통 Dialog에 표시합니다. */
function WorkspaceDepartureModal({
    titleId,
    title,
    description,
    children,
    onRequestClose
}: WorkspaceDepartureModalProps) {
    const dialogRef = useRef<HTMLDivElement>(null);
    const onRequestCloseRef = useRef(onRequestClose);
    const descriptionId = `${titleId}-description`;

    // 모달 생명주기를 다시 시작하지 않고 최신 닫기 핸들러만 사용합니다.
    useEffect(() => {
        onRequestCloseRef.current = onRequestClose;
    }, [onRequestClose]);

    // 배경 스크롤을 잠그고 Escape·Tab 포커스를 Dialog 경계 안에서 처리합니다.
    useEffect(() => {
        const previousFocus = document.activeElement instanceof HTMLElement
            ? document.activeElement
            : null;
        const previousOverflow = document.body.style.overflow;
        const dialog = dialogRef.current;
        document.body.style.overflow = 'hidden';
        (dialog?.querySelector<HTMLElement>('[data-autofocus]') ?? dialog)?.focus();

        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                event.preventDefault();
                onRequestCloseRef.current();
                return;
            }
            if (event.key !== 'Tab' || !dialog) return;

            const focusable = Array.from(dialog.querySelectorAll<HTMLElement>([
                'a[href]',
                'button:not([disabled])',
                'input:not([disabled])',
                '[tabindex]:not([tabindex="-1"])'
            ].join(','))).filter(element => element.getClientRects().length > 0);
            if (focusable.length === 0) {
                event.preventDefault();
                dialog.focus();
                return;
            }

            const first = focusable[0];
            const last = focusable[focusable.length - 1];
            if (event.shiftKey && document.activeElement === first) {
                event.preventDefault();
                last.focus();
            } else if (!event.shiftKey && document.activeElement === last) {
                event.preventDefault();
                first.focus();
            }
        };

        document.addEventListener('keydown', handleKeyDown);
        return () => {
            document.body.style.overflow = previousOverflow;
            document.removeEventListener('keydown', handleKeyDown);
            if (previousFocus?.isConnected) previousFocus.focus();
        };
    }, []);

    return (
        <div
            className="workspace-departure-modal__backdrop"
            onPointerDown={event => {
                if (event.target === event.currentTarget) onRequestClose();
            }}
        >
            <div
                ref={dialogRef}
                className="workspace-departure-modal"
                role="dialog"
                aria-modal="true"
                aria-labelledby={titleId}
                aria-describedby={descriptionId}
                tabIndex={-1}
            >
                <header className="workspace-departure-modal__header">
                    <div>
                        <h2 id={titleId}>{title}</h2>
                        <p id={descriptionId}>{description}</p>
                    </div>
                    <button
                        type="button"
                        className="workspace-departure-modal__close"
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

export default WorkspaceDepartureModal;
