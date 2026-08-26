// 이 페이지는 목업을 위한 임시 페이지임.

import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router';

function DashboardPage() {
    const { user, isAuthenticated, signOut } = useAuth();
    const navigate = useNavigate();

    const handleProfileSettingClick = () => {
        navigate('/profile-setup');
    };

    return (
        <div className="dashboard-page">
            <h1>Dashboard</h1>

            <p>
                로그인 상태:
                {isAuthenticated ? ' 로그인됨' : ' 로그아웃됨'}
            </p>

            <p>사용자: {user?.name}</p>
            <p>이메일: {user?.email}</p>
            <p>역할: {user?.roles.join(', ')}</p>

            <button onClick={signOut}>로그아웃</button>
            <button onClick={handleProfileSettingClick}>설정</button>
        </div>
    );
}

export default DashboardPage;