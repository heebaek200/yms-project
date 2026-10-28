import type { AuthSession } from '../../types/auth';
import type {
    ApiFailureResponse,
    ApiResponse,
    ApiSuccessResponse
} from '../types';
export type { ApiFieldError } from '../types';
// 로그인 Mock API

export type LoginSuccessData = AuthSession;

export type LoginRequest = {
    email: string;
    password: string;
};

export type LoginSuccessResponse = ApiSuccessResponse<LoginSuccessData>;
export type LoginFailureResponse = ApiFailureResponse;
export type LoginResponse = ApiResponse<LoginSuccessData>;

// 수동 테스트에서 제작팀별 권한 경계를 확인할 수 있도록 로그인 가능한 Mock 계정을 구분합니다.
const MOCK_LOGIN_USERS: Record<string, Omit<AuthSession, 'email' | 'accessToken' | 'tokenType'>> = {
    'test@test.com': {
        userId: 24601,
        name: '테스트 사용자',
        roles: ['CREATOR', 'EDITOR'],
        profileSetupRequired: false
    },
    'creator@sample.test': {
        userId: 24621,
        name: '샘플 크리에이터',
        roles: ['CREATOR'],
        profileSetupRequired: false
    }
};

/** 이메일에 대응하는 Mock 사용자 세션을 발급하며 모든 테스트 계정은 공통 비밀번호를 사용합니다. */
export async function login(
    request: LoginRequest
): Promise<LoginResponse> {
    // TODO: 백엔드 완성 후 axios 호출로 교체

    await new Promise(resolve => setTimeout(resolve, 500));

    const email = request.email.trim().toLocaleLowerCase();
    const mockUser = MOCK_LOGIN_USERS[email];

    if (mockUser && request.password === '123456') {
        return {
            success: true,
            message: '로그인에 성공했습니다.',
            data: {
                ...mockUser,
                email,
                accessToken: 'mock-access-token',
                tokenType: 'Bearer'
            }
        };
    }
    return {
        success: false,
        errorCode: 'INVALID_CREDENTIALS',
        message: '이메일 또는 비밀번호가 올바르지 않습니다.',
        errors: null
    };
}
