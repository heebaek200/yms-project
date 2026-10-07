import type { AuthUser } from '../types/auth';

export type StoredAuth = {
    user: AuthUser;
    accessToken: string;
    tokenType: string;
};

export const AUTH_EXPIRED_EVENT = 'yms:auth-expired';

export const AUTH_STORAGE_KEY = 'yms-auth';

/**
 * 저장된 값이 Axios Authorization에 사용할 수 있는 인증 세션인지 확인합니다.
 * 최소 필수 값만 검증하여 손상되거나 이전 형식인 sessionStorage 값을 차단합니다.
 * 유효하지 않은 값은 호출부에서 제거한 뒤 비로그인 상태로 처리합니다.
 */
function isStoredAuth(value: unknown): value is StoredAuth {
    if (!value || typeof value !== 'object') {
        return false;
    }

    const candidate = value as Partial<StoredAuth>;

    return typeof candidate.accessToken === 'string'
        && candidate.accessToken.length > 0
        && typeof candidate.tokenType === 'string'
        && candidate.tokenType.length > 0
        && !!candidate.user
        && typeof candidate.user.userId === 'number'
        && typeof candidate.user.email === 'string'
        && typeof candidate.user.name === 'string'
        && Array.isArray(candidate.user.roles)
        && typeof candidate.user.profileSetupRequired === 'boolean';
}

/**
 * 브라우저 공용 저장소에서 현재 로그인 세션을 조회합니다.
 * 필수 판정값이 없는 이전 형식이나 손상된 값은 제거하여 재로그인을 요구합니다.
 * 기존 탭 전용 저장값도 함께 정리하여 인증 저장소가 중복되지 않게 합니다.
 */
export function loadStoredAuth(): StoredAuth | null {
    sessionStorage.removeItem(AUTH_STORAGE_KEY);
    const storedValue = localStorage.getItem(AUTH_STORAGE_KEY);

    if (!storedValue) {
        return null;
    }

    try {
        const parsedValue: unknown = JSON.parse(storedValue);

        if (isStoredAuth(parsedValue)) {
            return parsedValue;
        }
    } catch {
        // 파싱 실패도 아래 공통 정리 경로에서 제거합니다.
    }

    clearStoredAuth();
    return null;
}

/**
 * 로그인 또는 프로필 변경 후 최신 인증 세션을 브라우저 공용으로 저장합니다.
 * localStorage 변경 이벤트를 통해 다른 탭의 AuthContext도 같은 계정을 사용합니다.
 * 실제 API의 토큰 만료 또는 명시적 로그아웃 전까지 브라우저 재시작 후에도 복원합니다.
 */
export function saveStoredAuth(storedAuth: StoredAuth) {
    localStorage.setItem(
        AUTH_STORAGE_KEY,
        JSON.stringify(storedAuth)
    );
}

/**
 * 로그아웃 또는 인증 만료 시 브라우저 공용 인증 세션을 제거합니다.
 * localStorage 변경은 다른 탭에도 전달되며 이전 sessionStorage 값도 함께 정리합니다.
 * 값이 이미 없더라도 동일하게 완료되는 멱등 동작입니다.
 */
export function clearStoredAuth() {
    localStorage.removeItem(AUTH_STORAGE_KEY);
    sessionStorage.removeItem(AUTH_STORAGE_KEY);
}

/**
 * API 인터셉터가 React Context에 의존하지 않고 인증 헤더 값을 조회합니다.
 * 유효한 세션이면 tokenType과 accessToken을 결합할 수 있는 최소 정보만 반환합니다.
 * 저장 정보가 없거나 손상됐으면 null을 반환합니다.
 */
export function getStoredAuthorization() {
    const storedAuth = loadStoredAuth();

    return storedAuth
        ? {
            accessToken: storedAuth.accessToken,
            tokenType: storedAuth.tokenType
        }
        : null;
}

/**
 * Axios에서 감지한 인증 만료를 React 인증 상태에 전달합니다.
 * 저장소를 먼저 비운 뒤 전역 이벤트를 발생시켜 보호 라우트가 로그인 화면으로 전환됩니다.
 * 로그인 자격 증명 실패처럼 세션 만료가 아닌 401에는 호출하지 않습니다.
 */
export function notifyAuthExpired() {
    clearStoredAuth();
    window.dispatchEvent(new Event(AUTH_EXPIRED_EVENT));
}
