import {
    createContext,
    useContext,
    useState,
    type ReactNode
} from 'react';

import type { LoginSuccessData } from '../api/auth/login';
import type { AuthUser } from '../types/auth';

type AuthContextValue = {
    user: AuthUser | null;
    accessToken: string | null;
    tokenType: string | null;
    isAuthenticated: boolean;

    signIn: (data: LoginSuccessData) => void;
    signOut: () => void;
};

type StoredAuth = {
    user: AuthUser;
    accessToken: string;
    tokenType: string;
};

type AuthProviderProps = {
    children: ReactNode;
};

const AUTH_STORAGE_KEY = 'yms-auth';

const AuthContext = createContext<AuthContextValue | null>(null);

// sessionStorage로부터 로그인 정보 불러오기
function loadStoredAuth(): StoredAuth | null {
    const stored = sessionStorage.getItem(AUTH_STORAGE_KEY);

    if (!stored) {
        return null;
    }

    try {
        return JSON.parse(stored) as StoredAuth;
    } catch {
        sessionStorage.removeItem(AUTH_STORAGE_KEY);
        return null;
    }
}

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

    // 로그인 성공 시 인증 정보 저장
    function signIn(data: LoginSuccessData) {
        const authUser: AuthUser = {
            userId: data.userId,
            email: data.email,
            name: data.name,
            roles: data.roles
        };

        setUser(authUser);
        setAccessToken(data.accessToken);
        setTokenType(data.tokenType);

        // 세션 스토리지에 인증 정보 저장
        const storedAuth: StoredAuth = {
            user: authUser,
            accessToken: data.accessToken,
            tokenType: data.tokenType
        };

        sessionStorage.setItem(
            AUTH_STORAGE_KEY,
            JSON.stringify(storedAuth)
        );
    }


    // 로그아웃 시 인증 정보 제거
    function signOut() {
        setUser(null);
        setAccessToken(null);
        setTokenType(null);

        // sessionStorage에서 인증 정보 제거
        sessionStorage.removeItem(AUTH_STORAGE_KEY);
    }

    return (
        <AuthContext
            value={{
                user,
                accessToken,
                tokenType,
                isAuthenticated,
                signIn,
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