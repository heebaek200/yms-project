import './AppHeader.css';
import { NavLink, useNavigate } from "react-router";
import { useAuth } from '../../contexts/AuthContext'
import { useState } from "react";

function AppHeader() {
    const { user, signOut } = useAuth();
    const navigate = useNavigate();

    const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);

    return (
        <header className="app-header">
            <div className="app-header__inner">

                <NavLink
                    to="/dashboard"
                    className="app-header__brand"
                >
                    YMS
                </NavLink>

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
                        className="app-header__user"
                        onClick={() => setIsUserMenuOpen(prev => !prev)}
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
    );
};

export default AppHeader;