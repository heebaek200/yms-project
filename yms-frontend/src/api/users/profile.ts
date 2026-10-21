import type { UserRole } from '../../types/auth';
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
};

export type ProfileResponse = ApiSuccessResponse<ProfileData>;

export type UpdateProfileRequest = {
    name: string;
    roles: UserRole[];
};

export type UpdateProfileSuccessData = {
    userId: number;
    name: string;
    roles: UserRole[];
};

export type UpdateProfileSuccessResponse =
    ApiSuccessResponse<UpdateProfileSuccessData>;
export type UpdateProfileFailureResponse = ApiFailureResponse;
export type UpdateProfileResponse = ApiResponse<UpdateProfileSuccessData>;

// 실제 백엔드 연동 전까지 GET과 PATCH가 동일한 프로필 상태를 공유합니다.
let mockProfile: ProfileData = {
    userId: 24601,
    email: 'test@test.com',
    name: '테스트 사용자',
    roles: []
};

/**
 * 현재 사용자의 프로필과 검색 필터에 사용할 전문 역할을 조회합니다.
 * 실제 연동 시 GET /api/users/me/profile 요청으로 교체할 Mock 함수입니다.
 */
export async function getProfile(): Promise<ProfileResponse> {
    await new Promise(resolve => setTimeout(resolve, 500));

    return {
        success: true,
        data: { ...mockProfile }
    };
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

    // 전문 역할은 기능 권한이 아닌 검색·소개용 전역 분류로만 저장합니다.
    mockProfile = {
        ...mockProfile,
        name: trimmedName,
        roles: request.roles
    };

    return {
        success: true,
        message: '프로필 정보가 수정되었습니다.',
        data: {
            userId: mockProfile.userId,
            name: mockProfile.name,
            roles: mockProfile.roles
        }
    };
}
