import { isAxiosError } from 'axios';

import type {
    ApiFailureResponse,
    ApiFieldError
} from './types';

export type ApiErrorKind =
    | 'SERVER'
    | 'NETWORK'
    | 'TIMEOUT'
    | 'UNKNOWN';

/**
 * 화면과 API 모듈이 동일한 방식으로 처리할 수 있는 통신 오류입니다.
 * 서버 오류라면 HTTP 상태·업무 오류 코드·필드 오류를 함께 보존합니다.
 * 네트워크와 timeout 오류는 kind로 구분하여 서버 응답 오류와 혼동하지 않습니다.
 */
export class ApiClientError extends Error {
    readonly kind: ApiErrorKind;
    readonly status: number | null;
    readonly errorCode: string;
    readonly fieldErrors: ApiFieldError[] | null;

    /**
     * 정규화된 오류 분류와 서버 응답 정보를 Error 객체에 저장합니다.
     * status가 없는 네트워크 오류는 null을 사용하고 원본 예외는 cause로 보존합니다.
     * 호출부는 instanceof와 kind를 함께 사용해 안전하게 오류 화면을 선택할 수 있습니다.
     */
    constructor({
        kind,
        status = null,
        errorCode,
        message,
        fieldErrors = null,
        cause
    }: {
        kind: ApiErrorKind;
        status?: number | null;
        errorCode: string;
        message: string;
        fieldErrors?: ApiFieldError[] | null;
        cause?: unknown;
    }) {
        super(message, { cause });
        this.name = 'ApiClientError';
        this.kind = kind;
        this.status = status;
        this.errorCode = errorCode;
        this.fieldErrors = fieldErrors;
    }
}

/**
 * 실패 Envelope의 개별 필드 오류가 설계된 구조와 일치하는지 확인합니다.
 * field와 reason은 문자열, value는 문자열 또는 null인 경우만 허용합니다.
 * 서버의 예상하지 못한 중첩 값을 화면 입력 오류로 전달하지 않도록 차단합니다.
 */
function isApiFieldError(value: unknown): value is ApiFieldError {
    if (!value || typeof value !== 'object') {
        return false;
    }

    const candidate = value as Partial<ApiFieldError>;

    return typeof candidate.field === 'string'
        && (candidate.value === null || typeof candidate.value === 'string')
        && typeof candidate.reason === 'string';
}

/**
 * 알 수 없는 Axios 응답 body가 공통 실패 Envelope인지 확인합니다.
 * 최상위 필드와 errors 배열의 개별 필드 오류 구조까지 모두 검증합니다.
 * 일치하지 않는 body는 HTTP 상태 기반의 일반 서버 오류로 처리합니다.
 */
function isApiFailureResponse(value: unknown): value is ApiFailureResponse {
    if (!value || typeof value !== 'object') {
        return false;
    }

    const candidate = value as Partial<ApiFailureResponse>;

    const hasValidErrors = candidate.errors === null
        || (
            Array.isArray(candidate.errors)
            && candidate.errors.every(isApiFieldError)
        );

    return candidate.success === false
        && typeof candidate.errorCode === 'string'
        && typeof candidate.message === 'string'
        && hasValidErrors;
}

/**
 * Axios 또는 일반 예외를 화면에서 처리 가능한 ApiClientError로 변환합니다.
 * 응답이 있으면 서버 오류, 응답 없이 timeout이면 TIMEOUT으로 분류합니다.
 * 그 밖의 통신 실패와 예상하지 못한 예외도 서로 다른 kind로 보존합니다.
 */
export function normalizeApiError(error: unknown): ApiClientError {
    if (error instanceof ApiClientError) {
        return error;
    }

    if (isAxiosError(error)) {
        if (error.response) {
            const responseBody = error.response.data;

            if (isApiFailureResponse(responseBody)) {
                return new ApiClientError({
                    kind: 'SERVER',
                    status: error.response.status,
                    errorCode: responseBody.errorCode,
                    message: responseBody.message,
                    fieldErrors: responseBody.errors ?? null,
                    cause: error
                });
            }

            return new ApiClientError({
                kind: 'SERVER',
                status: error.response.status,
                errorCode: `HTTP_${error.response.status}`,
                message: '서버 요청을 처리하지 못했습니다.',
                cause: error
            });
        }

        // Axios는 timeout과 일반 네트워크 오류를 code로 구분하여 전달합니다.
        if (error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT') {
            return new ApiClientError({
                kind: 'TIMEOUT',
                errorCode: 'REQUEST_TIMEOUT',
                message: '서버 응답 시간이 초과되었습니다.',
                cause: error
            });
        }

        return new ApiClientError({
            kind: 'NETWORK',
            errorCode: 'NETWORK_ERROR',
            message: '서버에 연결할 수 없습니다. 네트워크 상태를 확인해 주세요.',
            cause: error
        });
    }

    return new ApiClientError({
        kind: 'UNKNOWN',
        errorCode: 'UNKNOWN_ERROR',
        message: error instanceof Error
            ? error.message
            : '알 수 없는 오류가 발생했습니다.',
        cause: error
    });
}

/**
 * 예외 기반 실제 API 오류를 기존 화면의 응답 판별 구조로 변환합니다.
 * Mock API와 Axios API를 점진적으로 교체하는 동안 같은 UI 코드를 유지합니다.
 * HTTP 상태와 오류 kind는 원본 ApiClientError에서 추가 판단할 수 있습니다.
 */
export function toApiFailureResponse(error: unknown): ApiFailureResponse {
    const apiError = normalizeApiError(error);

    return {
        success: false,
        errorCode: apiError.errorCode,
        message: apiError.message,
        errors: apiError.fieldErrors
    };
}
