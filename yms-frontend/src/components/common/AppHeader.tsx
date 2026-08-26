import { NavLink, useNavigate } from "react-router";
import { useAuth } from '../../contexts/AuthContext';

function AppHeader() {
    const { user } = useAuth();
    const navigate = useNavigate();

    return (
        <header className="app-header">
            <div className="app-header__inner">

                <NavLink
                    to="/dashboard"
                    className={({ isActive }) =>
                        isActive
                            ? 'app-nav__link app-nav__link--active'
                            : 'app-nav__link'
                    }
                >
                    YMS
                </NavLink>

                <NavLink 
                    to="/scheduler"
                    className="app-nav__link">
                    <span className="app-nav__icon">🗓</span>
                    <span className="app-nav__label">
                        스케줄러
                    </span>
                </NavLink>

                <div className="app-header__user">
                    <button
                        type="button"
                        className="app-header__user"
                    >
                        <span>👤</span>
                        <span className="app-header__user-name" onClick={() => navigate('/profile-setup')}>
                            {user?.name} 님
                        </span>
                    </button>
                </div>

            </div>
        </header>
    );
};

export default AppHeader;