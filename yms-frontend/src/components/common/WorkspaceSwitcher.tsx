import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router';

import { useWorkspace } from '../../hooks/useWorkspace';
import { getWorkspaceSwitchDestination } from '../../routes/navigation';
import type { WorkspaceRole } from '../../types/workspace';
import {
    WORKSPACE_SWITCHER_OPEN_EVENT
} from '../../workspace/workspaceSwitcherEvents';
import { confirmUnsavedChanges } from '../../navigation/unsavedChangesGuard';

import './WorkspaceSwitcher.css';

const WORKSPACE_ROLE_LABELS: Record<WorkspaceRole, string> = {
    OWNER: '소유자',
    ADMIN: '관리자',
    MEMBER: '멤버'
};

const WORKSPACE_SWITCHER_POPOVER_ID = 'workspace-switcher-popover';

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
    const location = useLocation();
    const navigate = useNavigate();

    const containerRef = useRef<HTMLDivElement>(null);
    const triggerRef = useRef<HTMLButtonElement>(null);
    const announcementTimerRef = useRef<number | null>(null);
    const [isOpen, setIsOpen] = useState(false);
    const [announcement, setAnnouncement] = useState<string | null>(null);

    /**
     * Popover를 닫은 다음 제작팀 전환 Trigger로 키보드 포커스를 복귀시킵니다.
     * 내부 버튼이 DOM에서 제거된 뒤 포커스가 문서 본문으로 유실되지 않게 합니다.
     */
    const closeAndFocusTrigger = useCallback(() => {
        setIsOpen(false);

        window.requestAnimationFrame(() => {
            triggerRef.current?.focus();
        });
    }, []);

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
                event.preventDefault();
                closeAndFocusTrigger();
            }
        };

        document.addEventListener('pointerdown', handlePointerDown);
        document.addEventListener('keydown', handleKeyDown);

        return () => {
            document.removeEventListener('pointerdown', handlePointerDown);
            document.removeEventListener('keydown', handleKeyDown);
        };
    }, [closeAndFocusTrigger, isOpen]);

    // 화면을 떠날 때 전환 완료 안내 타이머를 정리합니다.
    useEffect(() => {
        return () => {
            if (announcementTimerRef.current !== null) {
                window.clearTimeout(announcementTimerRef.current);
            }
        };
    }, []);

    // 공통 접근 상태의 제작팀 전환 버튼이 Header Popover를 열 수 있게 연결합니다.
    useEffect(() => {
        const handleOpenRequest = () => {
            setIsOpen(true);
            window.requestAnimationFrame(() => {
                triggerRef.current?.focus();
            });
        };

        window.addEventListener(
            WORKSPACE_SWITCHER_OPEN_EVENT,
            handleOpenRequest
        );

        return () => {
            window.removeEventListener(
                WORKSPACE_SWITCHER_OPEN_EVENT,
                handleOpenRequest
            );
        };
    }, []);

    /**
     * 선택한 Workspace를 현재 탭에 저장하고 같은 업무 흐름의 안전한 Route를 유지합니다.
     * 상세 Route는 새 Workspace의 목록으로 정규화하고 역할별 다른 기능은 자동 전환하지 않습니다.
     * 완료 안내에는 전환 사실만 표시하여 권한 또는 리소스 상태를 추측하지 않습니다.
     */
    const handleWorkspaceSelect = (workspaceId: number) => {
        const nextWorkspace = workspaces.find(
            workspace => workspace.workspaceId === workspaceId
        );

        if (!nextWorkspace || nextWorkspace.workspaceId === currentWorkspace?.workspaceId) {
            closeAndFocusTrigger();
            return;
        }

        // 열린 관리 폼의 미저장 값이 있으면 사용자가 폐기를 승인한 뒤에만 전환합니다.
        if (!confirmUnsavedChanges()) {
            return;
        }

        const destination = getWorkspaceSwitchDestination(location.pathname);

        selectWorkspace(workspaceId);
        closeAndFocusTrigger();
        setAnnouncement(`${nextWorkspace.name} 제작팀으로 전환했습니다.`);

        if (destination !== location.pathname) {
            navigate(destination, { replace: true });
        }

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
                ref={triggerRef}
                type="button"
                className="workspace-switcher__trigger"
                disabled={isLoading || !currentWorkspace}
                aria-label="현재 제작팀 전환"
                aria-controls={WORKSPACE_SWITCHER_POPOVER_ID}
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
                        : currentWorkspace?.name ?? '제작팀 없음'}
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
                    id={WORKSPACE_SWITCHER_POPOVER_ID}
                    className="workspace-switcher__popover"
                    role="group"
                    aria-label="제작팀 전환"
                >
                    <strong className="workspace-switcher__title">
                        제작팀 전환
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
                                    aria-current={isCurrent ? 'true' : undefined}
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

                    <div className="workspace-switcher__footer">
                        <button
                            type="button"
                            className="workspace-switcher__all"
                            onClick={() => {
                                if (!confirmUnsavedChanges()) {
                                    return;
                                }

                                setIsOpen(false);
                                navigate('/workspaces');
                            }}
                        >
                            <span aria-hidden="true">▦</span>
                            전체 제작팀 보기
                        </button>
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
