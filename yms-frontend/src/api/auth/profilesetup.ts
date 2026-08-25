import type { UserRole, RateScope } from '../../types/auth';

// 프로필 및 채널 설정 Mock API

// 설정 저장 요청 필드
export type ProfileSetupRequest = {
    name: string;
    roles: UserRole[];
    longFormRate?: string;
    shortFormRate?: string;
    rateScope?: RateScope;
};

// 설정 저장 응답 필드.data
export type ProfileSetupSuccessData = {
    userId: number;
    name: string;
    roles: UserRole[];
    longFormRate: string | null;
    shortFormRate: string | null;
    processedPastProjectCount: number;
};

// 설정 저장 응답 필드
export type ProfileSetupSuccessResponse = {
    success: true;
    message: string;
    data: ProfileSetupSuccessData;
};

// 실패 응답 필드.error
export type ApiFieldError = {
    field: string;
    value: string;
    reason: string;
};

// 실패 응답 필드
export type ProfileSetupFailureResponse = {
    success: false;
    errorCode: string;
    message: string;
    errors: ApiFieldError[] | null;
};

// 응답 필드
export type ProfileSetupResponse =
    | ProfileSetupSuccessResponse
    | ProfileSetupFailureResponse;


export async function setupProfile(
    request: ProfileSetupRequest
): Promise<ProfileSetupResponse> {

    // TODO: 백엔드 완성 후 axios PATCH 호출로 교체

    await new Promise(resolve => setTimeout(resolve, 500));


    // 이름 검증
    const trimmedName = request.name.trim();

    if (
        trimmedName.length < 2 ||
        trimmedName.length > 100
    ) {
        return {
            success: false,
            errorCode: 'INVALID_INPUT_VALUE',
            message: '입력값 검증에 실패했습니다.',
            errors: [
                {
                    field: 'name',
                    value: request.name,
                    reason: '이름은 2자 이상 100자 이하로 입력해 주세요.'
                }
            ]
        };
    }


    // 역할 검증
    if (request.roles.length === 0) {
        return {
            success: false,
            errorCode: 'INVALID_INPUT_VALUE',
            message: '입력값 검증에 실패했습니다.',
            errors: [
                {
                    field: 'roles',
                    value: '',
                    reason: '하나 이상의 전문 역할을 선택해 주세요.'
                }
            ]
        };
    }


    const isCreator =
        request.roles.includes('CREATOR');


    // CREATOR 역할이 있으면 단가 필수
    if (isCreator) {

        if (
            request.longFormRate === undefined ||
            request.shortFormRate === undefined
        ) {
            return {
                success: false,
                errorCode: 'INVALID_INPUT_VALUE',
                message: '입력값 검증에 실패했습니다.',
                errors: [
                    {
                        field: 'rate',
                        value: '',
                        reason: '크리에이터는 기본 수익 단가를 입력해 주세요.'
                    }
                ]
            };
        }
    }


    // Mock 성공 응답
    const processedPastProjectCount =
        isCreator && request.rateScope === 'all'
            ? 7
            : 0;

    return {
        success: true,
        message:
            processedPastProjectCount > 0
                ? `프로필 정보가 수정되었습니다. 과거 프로젝트 ${processedPastProjectCount}건의 단가를 재계산했습니다.`
                : '프로필 정보가 수정되었습니다.',
        data: {
            userId: 24601,
            name: trimmedName,
            roles: request.roles,

            longFormRate:
                isCreator
                    ? request.longFormRate ?? null
                    : null,

            shortFormRate:
                isCreator
                    ? request.shortFormRate ?? null
                    : null,

            processedPastProjectCount
        }
    };
}