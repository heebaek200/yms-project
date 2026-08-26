import type { AuthSession } from '../../types/auth';
// 회원가입 Mock API

export type SignupSuccessData = AuthSession;

export type SignupRequest = {
    email: string;
    password: string;
    name: string;
};

export type SignupSuccessResponse = {
    success: true;
    message: string;
    data: SignupSuccessData;
};

export type ApiFieldError = {
    field: string;
    value: string;
    reason: string;
};

export type SignupFailureResponse = {
    success: false;
    errorCode: string;
    message: string;
    errors: ApiFieldError[] | null;
};

export type SignupResponse =
    | SignupSuccessResponse
    | SignupFailureResponse;

export async function signup(
    request: SignupRequest
): Promise<SignupResponse> {
    // TODO: 백엔드 완성 후 axios 호출로 교체

    await new Promise(resolve => setTimeout(resolve, 500));

    if (
        request.email === 'test@test.com'
    ) {
        return {
            success: false,
            errorCode: 'DUPLICATE_EMAIL',
            message: '이미 가입된 이메일 주소입니다.',
            errors: [
                {
                    field: 'email',
                    value: request.email,
                    reason: '이미 가입된 이메일 주소입니다.'
                }
            ]
        };
    }

    if (
        request.password.length < 6
    ) {
        return {
            success: false,
            errorCode: 'INVALID_INPUT_VALUE',
            message: '입력값 검증에 실패했습니다.',
            errors: [
                {
                    field: 'password',
                    value: request.password,
                    reason: '비밀번호는 6자 이상 입력해 주세요.'
                }
            ]
        };
    }

    return {
        success: true,
        message: '회원가입이 완료되었습니다.',
        data: {
            userId: 1,
            email: request.email,
            name: request.name,
            roles: [],
            //roles: ["CREATOR", "EDITOR"],
            accessToken: 'mock-access-token',
            tokenType: 'Bearer'
        }
    };
}