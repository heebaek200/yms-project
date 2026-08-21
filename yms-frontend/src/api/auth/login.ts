import type { AuthSession } from '../../types/auth';
// 로그인 Mock API

export type LoginSuccessData = AuthSession;

export type LoginRequest = {
    email: string;
    password: string;
};

export type LoginSuccessResponse = {
    success: true;
    message: string;
    data: LoginSuccessData;
};

export type ApiFieldError = {
    field: string;
    value: string;
    reason: string;
};

export type LoginFailureResponse = {
    success: false;
    errorCode: string;
    message: string;
    errors: ApiFieldError[] | null;
};

export type LoginResponse =
    | LoginSuccessResponse
    | LoginFailureResponse;

export async function login(
    request: LoginRequest
): Promise<LoginResponse> {
    // TODO: 백엔드 완성 후 axios 호출로 교체

    await new Promise(resolve => setTimeout(resolve, 500));

    if (
        request.email === 'test@test.com' &&
        request.password === '123456'
    ) {
        return {
            success: true,
            message: '로그인에 성공했습니다.',
            data: {
                userId: 24601,
                email: request.email,
                name: '테스트 사용자',
                //roles: [],
                roles: ["CREATOR", "EDITOR"],
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