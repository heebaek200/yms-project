import type { AxiosRequestConfig } from 'axios';

import { requestApi } from './client';
import type { ApiSuccessResponse } from './types';

/**
 * 제작팀 범위 API에서 사용할 상대 경로를 일관되게 생성합니다.
 * workspaceId는 양의 정수만 허용하고 resourcePath의 중복 슬래시를 제거합니다.
 * baseURL에 /api가 포함되므로 반환 경로에는 /api 접두사를 다시 붙이지 않습니다.
 */
export function buildWorkspaceApiPath(
    workspaceId: number,
    resourcePath = ''
) {
    if (!Number.isInteger(workspaceId) || workspaceId <= 0) {
        throw new RangeError('workspaceId는 1 이상의 정수여야 합니다.');
    }

    const normalizedResourcePath = resourcePath.replace(/^\/+|\/+$/g, '');
    const workspacePath = `/workspaces/${workspaceId}`;

    return normalizedResourcePath
        ? `${workspacePath}/${normalizedResourcePath}`
        : workspacePath;
}

/**
 * 제작팀 하위 API의 URL 생성과 공통 Axios 호출을 한 번에 수행합니다.
 * 호출부는 workspaceId와 하위 리소스만 전달하고 나머지 Axios 옵션을 선택적으로 지정합니다.
 * URL은 마지막에 덮어써서 호출부가 실수로 다른 제작팀 경계를 지정하지 못하게 합니다.
 */
export function requestWorkspaceApi<TData>(
    workspaceId: number,
    resourcePath: string,
    config: Omit<AxiosRequestConfig, 'url'> = {}
): Promise<ApiSuccessResponse<TData>> {
    return requestApi<TData>({
        ...config,
        url: buildWorkspaceApiPath(workspaceId, resourcePath)
    });
}
