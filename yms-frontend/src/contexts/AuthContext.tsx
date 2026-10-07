import {
    createContext,
    useContext,
    useEffect,
    useState,
    type ReactNode
} from 'react';

import type {
    AuthSession,
    AuthUser
} from '../types/auth';
import {
    AUTH_STORAGE_KEY,
    AUTH_EXPIRED_EVENT,
    clearStoredAuth,
    loadStoredAuth,
    saveStoredAuth,
    type StoredAuth
} from '../auth/authStorage';

type AuthContextValue = {
    user: AuthUser | null;
    accessToken: string | null;
    tokenType: string | null;
    isAuthenticated: boolean;

    signIn: (data: AuthSession) => void;
    updateUser: (data: Partial<AuthUser>) => void;
    signOut: () => void;
};

type AuthProviderProps = {
    children: ReactNode;
};

const AuthContext = createContext<AuthContextValue | null>(null);

/**
 * 로그인 사용자와 Access Token을 인증 화면 전체에 제공합니다.
 * 인증 저장소와 React 상태를 함께 갱신하고 Axios의 만료 이벤트를 수신합니다.
 * Access Token 존재 여부를 기준으로 보호 라우트의 인증 상태를 결정합니다.
 */
function AuthProvider({
    children
}: AuthProviderProps) {

    const [storedAuth] = useState(loadStoredAuth);

    const [user, setUser] =
        useState<AuthUser | null>(
            storedAuth?.user ?? null
        );

    const [accessToken, setAccessToken] =
        useState<string | null>(
            storedAuth?.accessToken ?? null
        );

    const [tokenType, setTokenType] =
        useState<string | null>(
            storedAuth?.tokenType ?? null
        );    

    // accessToken이 존재하면 로그인 상태로 판단
    const isAuthenticated = accessToken !== null;

    /**
     * 로그인 성공 응답을 사용자 상태와 공통 인증 저장소에 반영합니다.
     * Axios 요청 인터셉터는 저장소에서 같은 Access Token을 조회합니다.
     * 입력값은 로그인·회원가입 API의 AuthSession 응답입니다.
     */
    function signIn(data: AuthSession) {
        const authUser: AuthUser = {
            userId: data.userId,
            email: data.email,
            name: data.name,
            roles: data.roles,
            profileSetupRequired: data.profileSetupRequired
        };

        setUser(authUser);
        setAccessToken(data.accessToken);
        setTokenType(data.tokenType);

        // Context 새로고침 이후에도 복원할 수 있도록 공통 저장소 형식으로 보관합니다.
        saveStoredAuth({
            user: authUser,
            accessToken: data.accessToken,
            tokenType: data.tokenType
        });
    }

    /**
     * 프로필 설정에서 변경된 사용자 필드를 현재 인증 사용자에 병합합니다.
     * 토큰이 없는 비인증 상태에서는 저장하지 않고 기존 상태를 유지합니다.
     * 변경된 사용자 정보는 공통 인증 저장소에도 동일하게 반영합니다.
     */
    function updateUser(data: Partial<AuthUser>) {
        if (!user || !accessToken || !tokenType) {
            return;
        }

        const updatedUser: AuthUser = {
            ...user,
            ...data
        };

        setUser(updatedUser);

        saveStoredAuth({
            user: updatedUser,
            accessToken,
            tokenType
        });
    }

    /**
     * 사용자 요청에 따른 로그아웃 시 인증 상태와 저장소를 함께 초기화합니다.
     * 이후 보호 라우트는 isAuthenticated 변경을 감지해 로그인 화면으로 이동합니다.
     * 이미 로그아웃된 상태에서도 안전하게 호출할 수 있습니다.
     */
    function signOut() {
        setUser(null);
        setAccessToken(null);
        setTokenType(null);

        clearStoredAuth();
    }

    /**
     * 브라우저 공용 저장소에서 전달된 인증 세션을 현재 탭의 React 상태에 반영합니다.
     * 다른 탭의 로그인과 프로필 변경은 새 세션으로 교체하고 로그아웃은 모두 비웁니다.
     * 저장값 검증은 loadStoredAuth에 위임하여 손상된 세션을 사용하지 않습니다.
     */
    function applyStoredAuth(storedSession: StoredAuth | null) {
        setUser(storedSession?.user ?? null);
        setAccessToken(storedSession?.accessToken ?? null);
        setTokenType(storedSession?.tokenType ?? null);
    }

    /**
     * Axios 인터셉터가 알린 인증 만료를 React 인증 상태에 반영합니다.
     * 저장소는 인터셉터에서 먼저 정리되므로 Context의 메모리 상태만 초기화합니다.
     * Provider가 사라질 때 이벤트 Listener를 제거해 중복 처리를 방지합니다.
     */
    useEffect(() => {
        const handleAuthExpired = () => {
            applyStoredAuth(null);
        };

        // localStorage의 인증 변경을 받아 모든 탭에서 하나의 로그인 계정을 유지합니다.
        const handleStoredAuthChange = (event: StorageEvent) => {
            if (event.key !== AUTH_STORAGE_KEY && event.key !== null) {
                return;
            }

            applyStoredAuth(loadStoredAuth());
        };

        window.addEventListener(AUTH_EXPIRED_EVENT, handleAuthExpired);
        window.addEventListener('storage', handleStoredAuthChange);

        return () => {
            window.removeEventListener(AUTH_EXPIRED_EVENT, handleAuthExpired);
            window.removeEventListener('storage', handleStoredAuthChange);
        };
    }, []);

    return (
        <AuthContext
            value={{
                user,
                accessToken,
                tokenType,
                isAuthenticated,
                signIn,
                updateUser,
                signOut
            }}
        >
            {children}
        </AuthContext>
    );
}


export function useAuth() {

    const context = useContext(AuthContext);

    if (!context) {
        throw new Error(
            'useAuth는 AuthProvider 내부에서 사용해야 합니다.'
        );
    }

    return context;
}


export default AuthProvider;
