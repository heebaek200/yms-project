import './AppHeader.css';
import { Link, NavLink, useLocation, useNavigate } from 'react-router';
import { useAuth } from '../../contexts/AuthContext'
import { useCallback, useEffect, useRef, useState } from 'react';
import WorkspaceSwitcher from './WorkspaceSwitcher';
import NotificationDrawer from './NotificationDrawer';
import { useNotifications } from '../../hooks/useNotifications';
import { useWorkspace } from '../../hooks/useWorkspace';
import { getNavigationItems } from '../../routes/navigation';
import { confirmUnsavedChanges } from '../../navigation/unsavedChangesGuard';

/**
 * 인증 화면의 Workspace 전환, 주요 메뉴와 사용자 동작을 제공하는 공통 Header입니다.
 * 공통 알림 상태의 미확인 개수를 배지로 표시하고 Drawer 열림 상태를 관리합니다.
 * 사용자 메뉴와 알림 Drawer는 동시에 열리지 않도록 전환 시 반대쪽을 닫습니다.
 */
function AppHeader() {
    const { user, signOut } = useAuth();
    const { unreadCount } = useNotifications();
    const { currentWorkspace } = useWorkspace();
    const navigate = useNavigate();
    const location = useLocation();

    const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
    const [isNotificationDrawerOpen, setIsNotificationDrawerOpen] = useState(false);
    const notificationButtonRef = useRef<HTMLButtonElement>(null);
    const navigationRef = useRef<HTMLElement>(null);
    const navigationItems = currentWorkspace
        ? getNavigationItems(currentWorkspace.myRole)
        : [];
    const workNavigationItems = navigationItems.filter(
        item => item.section === 'work'
    );
    const managementNavigationItems = navigationItems.filter(
        item => item.section === 'management'
    );
    const navigationGroups = [
        {
            key: 'work',
            label: '업무 메뉴',
            items: workNavigationItems
        },
        {
            key: 'management',
            label: '관리 메뉴',
            items: managementNavigationItems
        }
    ].filter(group => group.items.length > 0);

    /**
     * Route가 바뀌면 현재 활성 메뉴를 가로 내비게이션의 보이는 영역에 배치합니다.
     * 모바일에서 메뉴 순서와 직접 선택 방식을 유지하면서도 현재 위치를 놓치지 않게 합니다.
     * 이미 보이는 항목은 nearest 옵션으로 불필요한 스크롤 이동을 만들지 않습니다.
     */
    useEffect(() => {
        const activeLink = navigationRef.current?.querySelector<HTMLElement>(
            '[aria-current="page"]'
        );
        const prefersReducedMotion = window.matchMedia(
            '(prefers-reduced-motion: reduce)'
        ).matches;

        // 동작 감소 환경에서는 메뉴 위치만 즉시 보정하고 스크롤 애니메이션은 생략합니다.
        activeLink?.scrollIntoView({
            behavior: prefersReducedMotion ? 'auto' : 'smooth',
            block: 'nearest',
            inline: 'nearest'
        });
    }, [location.pathname]);

    /**
     * Drawer의 닫기 버튼, 배경 또는 Escape 입력으로 알림 창을 닫습니다.
     * Drawer가 DOM에서 제거된 다음 Header 알림 버튼으로 포커스를 복원합니다.
     * 사용자가 알림 버튼이나 사용자 메뉴를 직접 누른 경우에는 기존 포커스를 유지합니다.
     */
    const handleNotificationDrawerClose = useCallback(() => {
        setIsNotificationDrawerOpen(false);

        window.requestAnimationFrame(() => {
            notificationButtonRef.current?.focus();
        });
    }, []);

    return (
        <>
            <header className="app-header">
                <div className="app-header__inner">

                <NavLink
                    to="/dashboard"
                    className="app-header__brand"
                >
                    YMS
                </NavLink>

                {/* 모든 Workspace 하위 화면에서 사용할 현재 업무 범위를 선택합니다. */}
                <WorkspaceSwitcher />

                <nav
                    ref={navigationRef}
                    className="app-nav"
                    aria-label="주요 메뉴"
                >
                    {navigationGroups.map(group => (
                        <div
                            key={group.key}
                            className={
                                `app-nav__group app-nav__group--${group.key}`
                            }
                            role="group"
                            aria-label={group.label}
                        >
                            {group.items.map(item => {
                                const isActive = (item.activePaths ?? [item.path]).some(path => (
                                    location.pathname === path
                                    || location.pathname.startsWith(`${path}/`)
                                ));

                                return (
                                <Link
                                    key={item.key}
                                    to={item.path}
                                    aria-current={isActive ? 'page' : undefined}
                                    className={[
                                        'app-nav__link',
                                        isActive ? 'app-nav__link--active' : ''
                                    ].filter(Boolean).join(' ')}
                                >
                                    <span
                                        className="app-nav__icon"
                                        aria-hidden="true"
                                    >
                                        {item.icon}
                                    </span>
                                    <span className="app-nav__label">
                                        {item.label}
                                    </span>
                                </Link>
                                );
                            })}
                        </div>
                    ))}
                </nav>

                <div className="app-header__actions">
                    <button
                        ref={notificationButtonRef}
                        type="button"
                        className="app-header__notification"
                        onClick={() => {
                            setIsUserMenuOpen(false);
                            setIsNotificationDrawerOpen(prev => !prev);
                        }}
                        aria-label={`알림 ${unreadCount}개`}
                        aria-expanded={isNotificationDrawerOpen}
                        aria-haspopup="dialog"
                    >
                        <span aria-hidden="true">🔔</span>

                        {unreadCount > 0 && (
                            <span className="app-header__notification-badge">
                                {unreadCount > 99 ? '99+' : unreadCount}
                            </span>
                        )}
                    </button>

                    <button
                        type="button"
                        className="app-header__user"
                        onClick={() => {
                            setIsNotificationDrawerOpen(false);
                            setIsUserMenuOpen(prev => !prev);
                        }}
                        aria-expanded={isUserMenuOpen}
                        aria-haspopup="menu"
                    >
                        <span>👤</span>

                        <span className="app-header__user-name">
                            {user?.name} 님
                        </span>
                    </button>

                    {isUserMenuOpen && (
                        <div
                            className="app-user-menu"
                            role="menu"
                        >
                            <div className="app-user-menu__identity">
                                <strong>{user?.name}</strong>
                                <span>{user?.email}</span>
                            </div>

                            <div className="app-user-menu__divider" />

                            <button
                                type="button"
                                className="app-user-menu__item"
                                onClick={() => {
                                    navigate('/profile-setup');
                                }}
                            >
                                프로필 설정
                            </button>

                            <div className="app-user-menu__divider" />

                            <button
                                type="button"
                                className="app-user-menu__item app-user-menu__item--danger"
                                onClick={() => {
                                    if (confirmUnsavedChanges()) {
                                        signOut();
                                    }
                                }}
                            >
                                로그아웃
                            </button>
                        </div>
                    )}

                </div>

                </div>
            </header>

            {/* Header의 backdrop-filter가 fixed Drawer의 기준 영역을 제한하지 않도록 형제로 렌더링합니다. */}
            {isNotificationDrawerOpen && (
                <NotificationDrawer
                    onClose={handleNotificationDrawerClose}
                />
            )}
        </>
    );
}

export default AppHeader;
