import './AppHeader.css';
import { NavLink, useNavigate } from "react-router";
import { useAuth } from '../../contexts/AuthContext'
import { useState } from "react";
import WorkspaceSwitcher from './WorkspaceSwitcher';
import NotificationDrawer from './NotificationDrawer';
import { useNotifications } from '../../hooks/useNotifications';

/**
 * 인증 화면의 Workspace 전환, 주요 메뉴와 사용자 동작을 제공하는 공통 Header입니다.
 * 공통 알림 상태의 미확인 개수를 배지로 표시하고 Drawer 열림 상태를 관리합니다.
 * 사용자 메뉴와 알림 Drawer는 동시에 열리지 않도록 전환 시 반대쪽을 닫습니다.
 */
function AppHeader() {
    const { user, signOut } = useAuth();
    const { unreadCount } = useNotifications();
    const navigate = useNavigate();

    const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
    const [isNotificationDrawerOpen, setIsNotificationDrawerOpen] = useState(false);

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

                <nav className="app-nav">
                    <NavLink
                        to="/dashboard"
                        className={({ isActive }) =>
                            isActive
                                ? 'app-nav__link app-nav__link--active'
                                : 'app-nav__link'
                        }>
                        <span className="app-nav__icon">🗓️</span>
                        <span className="app-nav__label">
                            스케줄러
                        </span>
                    </NavLink>

                    <NavLink
                        to="/"
                        className={({ isActive }) =>
                            isActive
                                ? 'app-nav__link app-nav__link--active'
                                : 'app-nav__link'
                        }>
                        <span className="app-nav__icon">📊</span>
                        <span className="app-nav__label">
                            분석 리포트
                        </span>
                    </NavLink>

                    <NavLink
                        to="/"
                        className={({ isActive }) =>
                            isActive
                                ? 'app-nav__link app-nav__link--active'
                                : 'app-nav__link'
                        }>
                        <span className="app-nav__icon">💬</span>
                        <span className="app-nav__label">
                            메신저
                        </span>
                    </NavLink>
                </nav>

                <div className="app-header__actions">
                    <button
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
                            <button
                                type="button"
                                className="app-user-menu__item"
                                onClick={() => navigate('/profile-setup')}
                            >
                                프로필 설정
                            </button>

                            <div className="app-user-menu__divider" />

                            <button
                                type="button"
                                className="app-user-menu__item app-user-menu__item--danger"
                                onClick={signOut}
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
                    onClose={() => setIsNotificationDrawerOpen(false)}
                />
            )}
        </>
    );
};

export default AppHeader;
