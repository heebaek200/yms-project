import { useEffect, useRef, useState } from 'react';

import { useWorkspace } from '../../hooks/useWorkspace';
import type { WorkspaceRole } from '../../types/workspace';

import './WorkspaceSwitcher.css';

const WORKSPACE_ROLE_LABELS: Record<WorkspaceRole, string> = {
    OWNER: '소유자',
    ADMIN: '관리자',
    MEMBER: '멤버'
};

/**
 * 현재 업무 범위를 명확하게 표시하고 다른 Workspace로 전환합니다.
 * 일반 Select보다 전환 대상과 사용자 권한을 분명히 보여 주어
 * 의도하지 않은 Workspace 변경 가능성을 줄입니다.
 */
function WorkspaceSwitcher() {
    const {
        workspaces,
        currentWorkspace,
        isLoading,
        selectWorkspace
    } = useWorkspace();

    const containerRef = useRef<HTMLDivElement>(null);
    const announcementTimerRef = useRef<number | null>(null);
    const [isOpen, setIsOpen] = useState(false);
    const [announcement, setAnnouncement] = useState<string | null>(null);

    // Popover 바깥을 클릭하거나 Escape를 누르면 전환 목록을 닫습니다.
    useEffect(() => {
        if (!isOpen) {
            return;
        }

        const handlePointerDown = (event: PointerEvent) => {
            if (
                event.target instanceof Node
                && !containerRef.current?.contains(event.target)
            ) {
                setIsOpen(false);
            }
        };

        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                setIsOpen(false);
            }
        };

        document.addEventListener('pointerdown', handlePointerDown);
        document.addEventListener('keydown', handleKeyDown);

        return () => {
            document.removeEventListener('pointerdown', handlePointerDown);
            document.removeEventListener('keydown', handleKeyDown);
        };
    }, [isOpen]);

    // 화면을 떠날 때 전환 완료 안내 타이머를 정리합니다.
    useEffect(() => {
        return () => {
            if (announcementTimerRef.current !== null) {
                window.clearTimeout(announcementTimerRef.current);
            }
        };
    }, []);

    const handleWorkspaceSelect = (workspaceId: number) => {
        const nextWorkspace = workspaces.find(
            workspace => workspace.workspaceId === workspaceId
        );

        if (!nextWorkspace || nextWorkspace.workspaceId === currentWorkspace?.workspaceId) {
            setIsOpen(false);
            return;
        }

        selectWorkspace(workspaceId);
        setIsOpen(false);
        setAnnouncement(`${nextWorkspace.name}으로 전환했습니다.`);

        if (announcementTimerRef.current !== null) {
            window.clearTimeout(announcementTimerRef.current);
        }

        announcementTimerRef.current = window.setTimeout(() => {
            setAnnouncement(null);
        }, 2500);
    };

    return (
        <div
            ref={containerRef}
            className="workspace-switcher"
        >
            <button
                type="button"
                className="workspace-switcher__trigger"
                disabled={isLoading || !currentWorkspace}
                aria-label="현재 워크스페이스 전환"
                aria-haspopup="menu"
                aria-expanded={isOpen}
                onClick={() => setIsOpen(prev => !prev)}
            >
                <span
                    className="workspace-switcher__icon"
                    aria-hidden="true"
                >
                    🏢
                </span>

                <span className="workspace-switcher__name">
                    {isLoading
                        ? '불러오는 중...'
                        : currentWorkspace?.name ?? 'Workspace 없음'}
                </span>

                <span
                    className="workspace-switcher__chevron"
                    aria-hidden="true"
                >
                    ▾
                </span>
            </button>

            {isOpen && (
                <div
                    className="workspace-switcher__popover"
                    role="menu"
                    aria-label="워크스페이스 목록"
                >
                    <strong className="workspace-switcher__title">
                        워크스페이스 전환
                    </strong>

                    <div className="workspace-switcher__list">
                        {workspaces.map(workspace => {
                            const isCurrent =
                                workspace.workspaceId === currentWorkspace?.workspaceId;

                            return (
                                <button
                                    key={workspace.workspaceId}
                                    type="button"
                                    className={
                                        isCurrent
                                            ? 'workspace-switcher__item workspace-switcher__item--current'
                                            : 'workspace-switcher__item'
                                    }
                                    role="menuitemradio"
                                    aria-checked={isCurrent}
                                    onClick={() => {
                                        handleWorkspaceSelect(workspace.workspaceId);
                                    }}
                                >
                                    <span
                                        className="workspace-switcher__check"
                                        aria-hidden="true"
                                    >
                                        {isCurrent ? '✓' : ''}
                                    </span>

                                    <span className="workspace-switcher__item-name">
                                        {workspace.name}
                                    </span>

                                    <span className="workspace-switcher__role">
                                        {WORKSPACE_ROLE_LABELS[workspace.myRole]}
                                    </span>
                                </button>
                            );
                        })}
                    </div>
                </div>
            )}

            {announcement && (
                <div
                    className="workspace-switcher__toast"
                    role="status"
                    aria-live="polite"
                >
                    {announcement}
                </div>
            )}
        </div>
    );
}

export default WorkspaceSwitcher;
