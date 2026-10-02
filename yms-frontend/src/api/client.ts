import axios, {
    type AxiosRequestConfig
} from 'axios';

import {
    getStoredAuthorization,
    notifyAuthExpired
} from '../auth/authStorage';
import {
    normalizeApiError
} from './errors';
import type { ApiSuccessResponse } from './types';

const DEFAULT_API_BASE_URL = '/api';
const API_REQUEST_TIMEOUT_MS = 10_000;

/**
 * 모든 실제 REST 요청에서 공유할 Axios 인스턴스입니다.
 * Vite 환경별 base URL과 공통 timeout을 한곳에서 적용합니다.
 * 개별 API 모듈은 이 인스턴스 또는 requestApi만 사용합니다.
 */
export const apiClient = axios.create({
    baseURL: import.meta.env.VITE_API_BASE_URL || DEFAULT_API_BASE_URL,
    timeout: API_REQUEST_TIMEOUT_MS,
    headers: {
        Accept: 'application/json'
    }
});

/**
 * 요청 직전 공통 인증 저장소에서 최신 Access Token을 조회합니다.
 * 로그인·로그아웃 직후에도 인스턴스를 다시 만들지 않고 올바른 토큰을 사용합니다.
 * 비로그인 요청에는 Authorization 헤더를 추가하지 않습니다.
 */
apiClient.interceptors.request.use(config => {
    const authorization = getStoredAuthorization();

    if (authorization) {
        config.headers.Authorization =
            `${authorization.tokenType} ${authorization.accessToken}`;
    }

    return config;
});

/**
 * 서버 Envelope와 통신 오류를 ApiClientError로 통일합니다.
 * 세션 만료 401은 저장소와 React 인증 상태에 전파하되 로그인 실패는 제외합니다.
 * 정규화된 오류는 Promise reject로 유지하여 개별 API가 화면 응답으로 변환할 수 있습니다.
 */
apiClient.interceptors.response.use(
    response => response,
    error => {
        const apiError = normalizeApiError(error);

        if (
            apiError.status === 401
            && apiError.errorCode !== 'INVALID_CREDENTIALS'
        ) {
            notifyAuthExpired();
        }

        return Promise.reject(apiError);
    }
);

/**
 * AxiosResponse의 HTTP 메타데이터를 제거하고 성공 Envelope만 반환합니다.
 * 실패 응답은 인터셉터가 ApiClientError로 변환하므로 호출부에서 명확히 catch할 수 있습니다.
 * 기존 Mock API는 toApiFailureResponse와 조합해 현재 응답 분기 구조를 유지할 수 있습니다.
 */
export async function requestApi<TData>(
    config: AxiosRequestConfig
): Promise<ApiSuccessResponse<TData>> {
    const response = await apiClient.request<ApiSuccessResponse<TData>>(config);
    return response.data;
}

/**
 * 204 No Content처럼 성공 body가 없는 API를 공통 인스턴스로 호출합니다.
 * 인증·timeout·오류 정규화는 일반 요청과 동일하게 인터셉터에서 처리합니다.
 * 삭제나 상태 해제 API가 불필요한 가짜 data Envelope를 만들지 않도록 분리합니다.
 */
export async function requestApiWithoutData(
    config: AxiosRequestConfig
): Promise<void> {
    await apiClient.request(config);
}
