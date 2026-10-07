export const WORKSPACE_INVALIDATION_EVENT_KEY =
    'yms-workspace-invalidation';

export type WorkspaceInvalidationEvent = {
    userId: number;
    workspaceId: number;
    eventId: string;
};

/**
 * 사용자별 현재 탭 Workspace를 저장할 sessionStorage 키를 만듭니다.
 * 사용자 ID를 포함하여 같은 탭에서 계정 데이터가 서로 섞이지 않게 합니다.
 * 반환 키는 현재 탭 선택을 읽고 쓰고 제거할 때 공통으로 사용합니다.
 */
function getCurrentWorkspaceKey(userId: number) {
    return `yms-current-workspace:${userId}`;
}

/**
 * 브라우저 전체에서 공유할 사용자별 마지막 Workspace 저장 키를 만듭니다.
 * 사용자 ID별로 분리하여 계정이 바뀌어도 다른 사용자의 선택을 복원하지 않습니다.
 * 반환 키는 다음 탭과 다음 방문의 복원 후보를 관리하는 데 사용합니다.
 */
function getLastWorkspaceKey(userId: number) {
    return `yms-last-workspace:${userId}`;
}

/**
 * Storage에 저장된 Workspace ID를 양의 정수로 검증해 반환합니다.
 * 손상되거나 이전 형식인 값은 즉시 제거하여 잘못된 복원 후보로 사용하지 않습니다.
 * 값이 없거나 유효하지 않으면 null을 반환합니다.
 */
function readWorkspaceId(storage: Storage, key: string) {
    const value = storage.getItem(key);

    if (value === null) {
        return null;
    }

    const workspaceId = Number(value);

    if (Number.isInteger(workspaceId) && workspaceId > 0) {
        return workspaceId;
    }

    storage.removeItem(key);
    return null;
}

/**
 * 현재 탭의 선택값을 우선하고 없으면 사용자별 마지막 선택값을 복원 후보로 조회합니다.
 * 탭별 값은 sessionStorage, 다음 방문용 값은 localStorage에서 읽습니다.
 * 반환한 ID의 실제 접근 권한은 반드시 Workspace 목록 조회 결과로 다시 검증해야 합니다.
 */
export function loadWorkspaceSelectionCandidate(userId: number) {
    return readWorkspaceId(sessionStorage, getCurrentWorkspaceKey(userId))
        ?? readWorkspaceId(localStorage, getLastWorkspaceKey(userId));
}

/**
 * 사용자가 명시적으로 선택한 Workspace를 현재 탭과 다음 방문용 저장소에 기록합니다.
 * sessionStorage 값은 탭별로 독립되고 localStorage 값은 브라우저 전체의 최근 선택입니다.
 * 일반적인 선택 변경은 다른 탭의 현재 Workspace를 직접 변경하지 않습니다.
 */
export function saveWorkspaceSelection(userId: number, workspaceId: number) {
    sessionStorage.setItem(
        getCurrentWorkspaceKey(userId),
        String(workspaceId)
    );
    localStorage.setItem(
        getLastWorkspaceKey(userId),
        String(workspaceId)
    );
}

/**
 * 로그아웃하거나 계정이 변경될 때 현재 탭의 Workspace 선택만 제거합니다.
 * 사용자별 마지막 선택값은 다음 로그인 경험을 위해 localStorage에 유지합니다.
 * 다른 탭은 각자의 인증 상태 변경을 받아 해당 탭 값을 별도로 정리합니다.
 */
export function clearCurrentWorkspaceSelection(userId: number) {
    sessionStorage.removeItem(getCurrentWorkspaceKey(userId));
}

/**
 * 접근 권한을 잃은 Workspace가 저장된 위치에서 해당 ID만 제거합니다.
 * 다른 탭이나 다음 방문에 같은 무효 ID가 복원되지 않도록 두 저장소를 모두 검사합니다.
 * 사용자의 다른 유효한 Workspace 선택값은 변경하지 않습니다.
 */
export function removeInvalidWorkspaceSelection(
    userId: number,
    workspaceId: number
) {
    const currentKey = getCurrentWorkspaceKey(userId);
    const lastKey = getLastWorkspaceKey(userId);

    if (readWorkspaceId(sessionStorage, currentKey) === workspaceId) {
        sessionStorage.removeItem(currentKey);
    }

    if (readWorkspaceId(localStorage, lastKey) === workspaceId) {
        localStorage.removeItem(lastKey);
    }
}

/**
 * 현재 탭에서 확인한 Workspace 권한 상실을 브라우저의 다른 탭에 알립니다.
 * 같은 탭의 저장값을 먼저 제거하고 일회성 localStorage 이벤트를 발생시킵니다.
 * 이벤트 수신 탭은 같은 Workspace를 사용할 때만 선택을 해제합니다.
 */
export function broadcastWorkspaceInvalidation(
    userId: number,
    workspaceId: number
) {
    removeInvalidWorkspaceSelection(userId, workspaceId);

    const event: WorkspaceInvalidationEvent = {
        userId,
        workspaceId,
        eventId: `${Date.now()}-${Math.random()}`
    };

    localStorage.setItem(
        WORKSPACE_INVALIDATION_EVENT_KEY,
        JSON.stringify(event)
    );
    localStorage.removeItem(WORKSPACE_INVALIDATION_EVENT_KEY);
}

/**
 * 다른 탭에서 전달된 Workspace 무효화 이벤트의 구조와 ID를 검증합니다.
 * localStorage 삭제 이벤트나 손상된 JSON은 null로 처리해 상태 변경을 막습니다.
 * 유효한 경우에만 사용자 ID와 Workspace ID를 포함한 이벤트를 반환합니다.
 */
export function parseWorkspaceInvalidationEvent(value: string | null) {
    if (!value) {
        return null;
    }

    try {
        const candidate = JSON.parse(value) as Partial<WorkspaceInvalidationEvent>;

        if (
            Number.isInteger(candidate.userId)
            && Number.isInteger(candidate.workspaceId)
            && typeof candidate.eventId === 'string'
        ) {
            return candidate as WorkspaceInvalidationEvent;
        }
    } catch {
        // 손상된 탭 간 이벤트는 현재 화면 상태에 영향을 주지 않고 무시합니다.
    }

    return null;
}
