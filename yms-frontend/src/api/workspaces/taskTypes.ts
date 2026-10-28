import type { WorkspaceTaskType } from '../../types/workspaceSettings';
import type { ApiResponse } from '../types';
import { isTaskTypeReferenced } from '../projects/projectTaskStore';

export type TaskTypeListRequest = {
    activeOnly?: boolean;
};

export type SaveTaskTypeRequest = {
    name: string;
};

export type UpdateTaskTypeRequest = SaveTaskTypeRequest & {
    active: boolean;
};

export type TaskTypeListResponse = ApiResponse<WorkspaceTaskType[]>;
export type TaskTypeMutationResponse = ApiResponse<WorkspaceTaskType>;
export type TaskTypeDeleteResponse = ApiResponse<{ taskTypeId: number }>;

type TaskTypeMockScenario = 'SUCCESS' | 'EMPTY' | 'SERVER_ERROR';

let mockScenario: TaskTypeMockScenario = 'SUCCESS';
let nextTaskTypeId = 31;

// 기본 예시도 사용자 정의 항목과 같은 구조와 수정 규칙을 사용합니다.
let mockTaskTypesByWorkspace: Record<number, WorkspaceTaskType[]> = {
    1: [
        { taskTypeId: 1, name: '가편집', active: true },
        { taskTypeId: 2, name: '종합 편집', active: true },
        { taskTypeId: 3, name: '자막', active: true },
        { taskTypeId: 4, name: '썸네일', active: true },
        { taskTypeId: 5, name: '지난 시즌 더빙', active: false }
    ],
    2: [
        { taskTypeId: 21, name: '편집', active: true },
        { taskTypeId: 22, name: '모션그래픽', active: true }
    ]
};

/** 작업 화면과 관리 화면이 같은 원본을 보도록 현재 제작팀의 작업 종류 복사본을 동기 조회합니다. */
export function readWorkspaceTaskTypes(workspaceId: number): WorkspaceTaskType[] {
    return (mockTaskTypesByWorkspace[workspaceId] ?? []).map(taskType => ({ ...taskType }));
}

/**
 * Task Type Mock의 정상·빈 목록·서버 오류 시나리오를 변경합니다.
 * 수동 화면 검증에 사용하며 기존 생성·수정 결과는 유지합니다.
 */
export function setTaskTypesMockScenario(scenario: TaskTypeMockScenario) {
    mockScenario = scenario;
}

/** 실제 API 호출과 비슷한 로딩 상태를 제공하는 공통 Mock 지연입니다. */
async function waitForMockResponse() {
    await new Promise(resolve => setTimeout(resolve, 300));
}

/**
 * Task Type 이름의 업무상 동일성을 비교할 정규값을 만듭니다.
 * 앞뒤 공백과 영문 대소문자를 무시하되 화면에는 원래 입력의 trim 결과를 저장합니다.
 */
function normalizeTaskTypeName(name: string) {
    return name.trim().toLocaleLowerCase();
}

/**
 * 현재 제작팀에 같은 이름의 Task Type이 있는지 확인합니다.
 * 수정 중인 자기 자신은 제외하고 비활성 항목도 중복 대상으로 포함합니다.
 */
function findDuplicateTaskType(
    workspaceId: number,
    name: string,
    excludedTaskTypeId?: number
) {
    const normalizedName = normalizeTaskTypeName(name);

    return (mockTaskTypesByWorkspace[workspaceId] ?? []).find(taskType =>
        taskType.taskTypeId !== excludedTaskTypeId
        && normalizeTaskTypeName(taskType.name) === normalizedName
    );
}

/** 현재 제작팀의 Task Type을 활성 상태 기준으로 조회합니다. */
export async function getWorkspaceTaskTypes(
    workspaceId: number,
    request: TaskTypeListRequest = {}
): Promise<TaskTypeListResponse> {
    // TODO: GET /api/workspaces/{workspaceId}/task-types 호출로 교체합니다.
    await waitForMockResponse();

    if (mockScenario === 'SERVER_ERROR') {
        return {
            success: false,
            errorCode: 'INTERNAL_SERVER_ERROR',
            message: '작업 종류 목록을 불러오지 못했습니다.',
            errors: null
        };
    }

    if (mockScenario === 'EMPTY') {
        return { success: true, data: [] };
    }

    const activeOnly = request.activeOnly ?? true;
    const taskTypes = (mockTaskTypesByWorkspace[workspaceId] ?? [])
        .filter(taskType => !activeOnly || taskType.active)
        .map(taskType => ({ ...taskType }));

    return { success: true, data: taskTypes };
}

/**
 * 새 Task Type을 생성하고 제작팀 안의 정규화된 이름 중복을 차단합니다.
 * 비활성 동명 항목은 새 행 대신 재활성화할 수 있도록 별도 오류 코드로 안내합니다.
 */
export async function createWorkspaceTaskType(
    workspaceId: number,
    request: SaveTaskTypeRequest
): Promise<TaskTypeMutationResponse> {
    // TODO: POST /api/workspaces/{workspaceId}/task-types 호출로 교체합니다.
    await waitForMockResponse();

    if (mockScenario === 'SERVER_ERROR') {
        return {
            success: false,
            errorCode: 'INTERNAL_SERVER_ERROR',
            message: '작업 종류를 추가하지 못했습니다.',
            errors: null
        };
    }

    const name = request.name.trim();

    if (!name) {
        return {
            success: false,
            errorCode: 'INVALID_INPUT_VALUE',
            message: '입력값을 다시 확인해 주세요.',
            errors: [{
                field: 'name',
                value: request.name,
                reason: '작업 종류 이름을 입력해 주세요.'
            }]
        };
    }

    if (name.length > 100) {
        return {
            success: false,
            errorCode: 'INVALID_INPUT_VALUE',
            message: '입력값을 다시 확인해 주세요.',
            errors: [{
                field: 'name',
                value: request.name,
                reason: '작업 종류 이름은 100자 이하로 입력해 주세요.'
            }]
        };
    }

    const duplicate = findDuplicateTaskType(workspaceId, name);

    if (duplicate) {
        const reason = duplicate.active
            ? '같은 이름의 작업 종류가 이미 있습니다.'
            : '같은 이름의 비활성 작업 종류가 있습니다. 기존 항목을 재활성화해 주세요.';

        return {
            success: false,
            errorCode: duplicate.active
                ? 'TASK_TYPE_NAME_DUPLICATED'
                : 'INACTIVE_TASK_TYPE_NAME_DUPLICATED',
            message: reason,
            errors: [{ field: 'name', value: request.name, reason }]
        };
    }

    const taskType: WorkspaceTaskType = {
        taskTypeId: nextTaskTypeId,
        name,
        active: true
    };

    nextTaskTypeId += 1;
    mockTaskTypesByWorkspace = {
        ...mockTaskTypesByWorkspace,
        [workspaceId]: [
            ...(mockTaskTypesByWorkspace[workspaceId] ?? []),
            taskType
        ]
    };

    return {
        success: true,
        message: '작업 종류를 추가했습니다.',
        data: { ...taskType }
    };
}

/**
 * Task Type 이름 또는 활성 상태를 변경합니다.
 * 기본 제공 항목도 같은 규칙을 적용하고 기존 Task 이력은 ID로 계속 참조합니다.
 */
export async function updateWorkspaceTaskType(
    workspaceId: number,
    taskTypeId: number,
    request: UpdateTaskTypeRequest
): Promise<TaskTypeMutationResponse> {
    // TODO: PATCH /api/workspaces/{workspaceId}/task-types/{taskTypeId} 호출로 교체합니다.
    await waitForMockResponse();

    if (mockScenario === 'SERVER_ERROR') {
        return {
            success: false,
            errorCode: 'INTERNAL_SERVER_ERROR',
            message: '작업 종류를 변경하지 못했습니다.',
            errors: null
        };
    }

    const workspaceTaskTypes = mockTaskTypesByWorkspace[workspaceId] ?? [];
    const currentTaskType = workspaceTaskTypes.find(
        taskType => taskType.taskTypeId === taskTypeId
    );

    if (!currentTaskType) {
        return {
            success: false,
            errorCode: 'TASK_TYPE_NOT_FOUND',
            message: '현재 제작팀에서 작업 종류를 찾을 수 없습니다.',
            errors: null
        };
    }

    const name = request.name.trim();

    if (!name) {
        return {
            success: false,
            errorCode: 'INVALID_INPUT_VALUE',
            message: '입력값을 다시 확인해 주세요.',
            errors: [{
                field: 'name',
                value: request.name,
                reason: '작업 종류 이름을 입력해 주세요.'
            }]
        };
    }

    if (name.length > 100) {
        return {
            success: false,
            errorCode: 'INVALID_INPUT_VALUE',
            message: '입력값을 다시 확인해 주세요.',
            errors: [{
                field: 'name',
                value: request.name,
                reason: '작업 종류 이름은 100자 이하로 입력해 주세요.'
            }]
        };
    }

    const duplicate = findDuplicateTaskType(workspaceId, name, taskTypeId);

    if (duplicate) {
        const reason = duplicate.active
            ? '같은 이름의 작업 종류가 이미 있습니다.'
            : '같은 이름의 비활성 작업 종류가 있습니다. 기존 항목을 재활성화해 주세요.';

        return {
            success: false,
            errorCode: 'TASK_TYPE_NAME_DUPLICATED',
            message: reason,
            errors: [{ field: 'name', value: request.name, reason }]
        };
    }

    const updatedTaskType: WorkspaceTaskType = {
        ...currentTaskType,
        name,
        active: request.active
    };

    mockTaskTypesByWorkspace = {
        ...mockTaskTypesByWorkspace,
        [workspaceId]: workspaceTaskTypes.map(taskType =>
            taskType.taskTypeId === taskTypeId ? updatedTaskType : taskType
        )
    };

    return {
        success: true,
        message: updatedTaskType.active
            ? '작업 종류를 저장했습니다.'
            : '작업 종류를 비활성화했습니다.',
        data: { ...updatedTaskType }
    };
}

/**
 * 기존 작업에서 참조하지 않는 Task Type만 물리 삭제합니다.
 * 화면의 사전 판단에 의존하지 않고 삭제 요청 시점의 사용 여부를 최종 확인합니다.
 */
export async function deleteWorkspaceTaskType(
    workspaceId: number,
    taskTypeId: number
): Promise<TaskTypeDeleteResponse> {
    // TODO: DELETE /api/workspaces/{workspaceId}/task-types/{taskTypeId} 호출로 교체합니다.
    await waitForMockResponse();

    if (mockScenario === 'SERVER_ERROR') {
        return {
            success: false,
            errorCode: 'INTERNAL_SERVER_ERROR',
            message: '작업 종류를 삭제하지 못했습니다.',
            errors: null
        };
    }

    const workspaceTaskTypes = mockTaskTypesByWorkspace[workspaceId] ?? [];
    const targetTaskType = workspaceTaskTypes.find(
        taskType => taskType.taskTypeId === taskTypeId
    );

    if (!targetTaskType) {
        return {
            success: false,
            errorCode: 'TASK_TYPE_NOT_FOUND',
            message: '현재 제작팀에서 작업 종류를 찾을 수 없습니다.',
            errors: null
        };
    }

    if (isTaskTypeReferenced(workspaceId, taskTypeId)) {
        return {
            success: false,
            errorCode: 'TASK_TYPE_IN_USE',
            message: '기존 작업에서 사용 중인 작업 종류라 삭제할 수 없습니다. 더 이상 새 작업에서 사용하지 않으려면 비활성화해 주세요.',
            errors: null
        };
    }

    mockTaskTypesByWorkspace = {
        ...mockTaskTypesByWorkspace,
        [workspaceId]: workspaceTaskTypes.filter(
            taskType => taskType.taskTypeId !== taskTypeId
        )
    };

    return {
        success: true,
        message: '작업 종류를 삭제했습니다.',
        data: { taskTypeId }
    };
}
