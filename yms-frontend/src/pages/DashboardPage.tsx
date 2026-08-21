// 이 페이지는 목업을 위한 임시 페이지임.

import { useAuth } from '../contexts/AuthContext';

function DashboardPage() {
    const { user, isAuthenticated, signOut } = useAuth();

    return (
        <main>
            <h1>Dashboard</h1>

            <p>
                로그인 상태:
                {isAuthenticated ? ' 로그인됨' : ' 로그아웃됨'}
            </p>

            <p>사용자: {user?.name}</p>
            <p>이메일: {user?.email}</p>
            <p>역할: {user?.roles.join(', ')}</p>

            <button onClick={signOut}>로그아웃</button>
        </main>
    );
}

export default DashboardPage;