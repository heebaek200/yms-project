import type { RateScope, UserRole } from '../../types/auth';
import type {
    ApiFailureResponse,
    ApiResponse,
    ApiSuccessResponse
} from '../types';

export type { ApiFieldError } from '../types';

export type ProfileData = {
    userId: number;
    email: string;
    name: string;
    roles: UserRole[];
    longFormRate: string | null;
    shortFormRate: string | null;
};

export type ProfileResponse = ApiSuccessResponse<ProfileData>;

export type UpdateProfileRequest = {
    name: string;
    roles: UserRole[];
    longFormRate?: string;
    shortFormRate?: string;
    rateScope?: RateScope;
};

export type UpdateProfileSuccessData = {
    userId: number;
    name: string;
    roles: UserRole[];
    longFormRate: string | null;
    shortFormRate: string | null;
    processedUnfinalizedProjectCount: number;
};

export type UpdateProfileSuccessResponse =
    ApiSuccessResponse<UpdateProfileSuccessData>;
export type UpdateProfileFailureResponse = ApiFailureResponse;
export type UpdateProfileResponse = ApiResponse<UpdateProfileSuccessData>;

const RATE_PATTERN = /^\d+(\.\d{1,6})?$/;

// 실제 백엔드 연동 전까지 GET과 PATCH가 동일한 프로필 상태를 공유합니다.
let mockProfile: ProfileData = {
    userId: 24601,
    email: 'test@test.com',
    name: '테스트 사용자',
    roles: [],
    longFormRate: null,
    shortFormRate: null
};

/**
 * 현재 사용자의 프로필, 전문 역할과 CREATOR 기본 단가를 조회합니다.
 * 실제 연동 시 GET /api/users/me/profile 요청으로 교체할 Mock 함수입니다.
 * 단가를 아직 저장하지 않은 프로필은 null 값을 반환할 수 있습니다.
 */
export async function getProfile(): Promise<ProfileResponse> {
    await new Promise(resolve => setTimeout(resolve, 500));

    return {
        success: true,
        data: { ...mockProfile }
    };
}

/**
 * CREATOR 단가를 API 제약에 맞는 문자열로 정규화합니다.
 * 누락되거나 빈 단가는 확정된 업무 규칙에 따라 문자열 "0"으로 처리합니다.
 * 화면 검증을 우회한 호출도 안전하게 처리할 수 있도록 공백을 제거합니다.
 */
function normalizeCreatorRate(rate: string | undefined) {
    const trimmedRate = rate?.trim() ?? '';

    return trimmedRate || '0';
}

/**
 * 현재 사용자의 프로필을 수정하고 변경된 Mock 상태를 반환합니다.
 * 실제 연동 시 PATCH /api/users/me/profile 요청으로 교체할 함수입니다.
 * 완료 Project는 변경하지 않고 선택 시 기존 미확정 Project만 처리합니다.
 */
export async function updateProfile(
    request: UpdateProfileRequest
): Promise<UpdateProfileResponse> {
    await new Promise(resolve => setTimeout(resolve, 500));

    const trimmedName = request.name.trim();

    // 이름과 역할은 최신 Profile REST API의 필수 업무 제약을 적용합니다.
    if (trimmedName.length < 2 || trimmedName.length > 50) {
        return {
            success: false,
            errorCode: 'INVALID_INPUT_VALUE',
            message: '입력값 검증에 실패했습니다.',
            errors: [
                {
                    field: 'name',
                    value: request.name,
                    reason: '이름은 2자 이상 50자 이하로 입력해 주세요.'
                }
            ]
        };
    }

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

    const isCreator = request.roles.includes('CREATOR');
    const longFormRate = normalizeCreatorRate(request.longFormRate);
    const shortFormRate = normalizeCreatorRate(request.shortFormRate);

    // CREATOR 요청은 0 이상의 정수 또는 소수점 이하 최대 6자리만 허용합니다.
    if (isCreator && (!RATE_PATTERN.test(longFormRate) || !RATE_PATTERN.test(shortFormRate))) {
        return {
            success: false,
            errorCode: 'INVALID_INPUT_VALUE',
            message: '입력값 검증에 실패했습니다.',
            errors: [
                ...(!RATE_PATTERN.test(longFormRate) ? [{
                    field: 'longFormRate',
                    value: request.longFormRate ?? null,
                    reason: '단가는 0 이상의 숫자로 소수점 여섯째 자리까지 입력해 주세요.'
                }] : []),
                ...(!RATE_PATTERN.test(shortFormRate) ? [{
                    field: 'shortFormRate',
                    value: request.shortFormRate ?? null,
                    reason: '단가는 0 이상의 숫자로 소수점 여섯째 자리까지 입력해 주세요.'
                }] : [])
            ]
        };
    }

    if (
        isCreator
        && request.rateScope !== undefined
        && request.rateScope !== 'FUTURE_ONLY'
        && request.rateScope !== 'INCLUDE_UNFINALIZED'
    ) {
        return {
            success: false,
            errorCode: 'INVALID_INPUT_VALUE',
            message: '입력값 검증에 실패했습니다.',
            errors: [{
                field: 'rateScope',
                value: request.rateScope,
                reason: '올바른 단가 변경 적용 범위를 선택해 주세요.'
            }]
        };
    }

    // CREATOR가 아닌 프로필에는 개인 기본 단가를 남기지 않습니다.
    mockProfile = {
        ...mockProfile,
        name: trimmedName,
        roles: request.roles,
        longFormRate: isCreator ? longFormRate : null,
        shortFormRate: isCreator ? shortFormRate : null
    };

    const processedUnfinalizedProjectCount =
        isCreator && request.rateScope === 'INCLUDE_UNFINALIZED'
            ? 3
            : 0;

    return {
        success: true,
        message: processedUnfinalizedProjectCount > 0
            ? `프로필 정보가 수정되었습니다. 미확정 프로젝트 ${processedUnfinalizedProjectCount}건에 새 단가를 적용했습니다.`
            : '프로필 정보가 수정되었습니다.',
        data: {
            userId: mockProfile.userId,
            name: mockProfile.name,
            roles: mockProfile.roles,
            longFormRate: mockProfile.longFormRate,
            shortFormRate: mockProfile.shortFormRate,
            processedUnfinalizedProjectCount
        }
    };
}
