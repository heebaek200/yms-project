import { useAuth } from '../contexts/AuthContext';

function ProfileSetupPage() {
    const { user, signOut } = useAuth();

    return (
        <main>
            <h1>프로필 및 채널 설정</h1>

            <p>사용자: {user?.name}</p>
            <p>초기 설정 등을 행하는 화면입니다.</p>

            <button onClick={signOut}>로그아웃</button>
        </main>
    );
}

export default ProfileSetupPage;