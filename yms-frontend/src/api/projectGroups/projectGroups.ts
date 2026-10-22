import type { ApiResponse } from '../types';
import type {
    ProjectGroupDetail,
    ProjectGroupProject,
    ProjectGroupStatus,
    ProjectGroupSummary
} from '../../types/projectGroup';
import {
    attachProjects,
    detachProject,
    insertProjectGroup,
    readProjectGroup,
    readProjectGroups,
    readProjectsByGroup,
    readUngroupedProjects,
    removeProjectGroup,
    replaceProjectGroup,
    type StoredProjectGroup
} from './projectGroupStore';
import {
    calculateRoi,
    subtractMoney,
    sumMoney
} from '../../utils/decimal';
import { readDeletedProjectFinanceByGroup, readProjects } from '../projects/projectStore';

export type ProjectGroupListRequest = {
    status?: ProjectGroupStatus | 'ALL';
    startDate?: string;
    endDate?: string;
    keyword?: string;
};

export type SaveProjectGroupRequest = {
    name: string;
    description?: string | null;
    startDate?: string | null;
    endDate?: string | null;
    projectIds?: number[];
};

export type UpdateProjectGroupRequest = SaveProjectGroupRequest & {
    status: ProjectGroupStatus;
};

type ProjectGroupListResponse = ApiResponse<ProjectGroupSummary[]>;
type ProjectGroupDetailResponse = ApiResponse<ProjectGroupDetail>;
type ProjectGroupMutationResponse = ApiResponse<ProjectGroupDetail>;
type ProjectGroupDeleteResponse = ApiResponse<{ projectGroupId: number }>;
type ProjectListResponse = ApiResponse<ProjectGroupProject[]>;

type ProjectGroupMockScenario = 'SUCCESS' | 'EMPTY' | 'SERVER_ERROR';

const STATUS_ORDER: Record<ProjectGroupStatus, number> = {
    ACTIVE: 0,
    PLANNING: 1,
    COMPLETED: 2,
    CANCELLED: 3
};

let mockScenario: ProjectGroupMockScenario = 'SUCCESS';

/** 수동 테스트에서 정상·빈 목록·서버 오류 상태를 전환합니다. */
export function setProjectGroupsMockScenario(
    scenario: ProjectGroupMockScenario
) {
    mockScenario = scenario;
}

/** 실제 통신과 유사한 로딩 상태를 확인할 수 있도록 Mock 응답을 잠시 지연합니다. */
async function waitForMockResponse() {
    await new Promise(resolve => setTimeout(resolve, 300));
}

/** 선택 문자열을 trim하고 비어 있으면 API null 값으로 정규화합니다. */
function normalizeOptionalValue(value?: string | null): string | null {
    const normalized = value?.trim() ?? '';
    return normalized || null;
}

/** ProjectGroup 이름의 앞뒤 공백과 영문 대소문자를 무시한 중복 비교 키를 만듭니다. */
function normalizeName(value: string): string {
    return value.trim().toLocaleLowerCase();
}

/** 대표 결과물만 사용해 ProjectGroup의 현재·누적 콘텐츠 성과를 계산합니다. */
function aggregateGroupPerformance(projectGroupId: number, mode: 'current' | 'cumulative') {
    const aggregates = readProjects()
        .filter(project => project.projectGroupId === projectGroupId)
        .flatMap(project => project.videoContents
            .filter(content => content.primaryProjectId === project.projectId)
            .map(content => mode === 'current' ? content.currentPerformance : content.cumulativePerformance));
    const includedPublicationCount = aggregates.reduce((sum, item) => sum + item.includedPublicationCount, 0);
    const missingPublicationCount = aggregates.reduce((sum, item) => sum + item.missingPublicationCount, 0);

    return {
        viewCount: aggregates.reduce((sum, item) => sum + item.viewCount, 0),
        likeCount: aggregates.reduce((sum, item) => sum + item.likeCount, 0),
        commentCount: aggregates.reduce((sum, item) => sum + item.commentCount, 0),
        estimatedRevenue: aggregates.reduce((sum, item) => sum + Number(item.estimatedRevenue), 0).toFixed(2),
        completeness: includedPublicationCount === 0 ? 'UNAVAILABLE' as const : missingPublicationCount > 0 ? 'PARTIAL' as const : 'COMPLETE' as const,
        includedPublicationCount,
        missingPublicationCount
    };
}

/** 직접 항목과 연결 Project의 금액을 합산해 목록·상세에서 같은 재무 결과를 사용합니다. */
function toProjectGroupDetail(group: StoredProjectGroup): ProjectGroupDetail {
    const projects = readProjectsByGroup(group.projectGroupId);
    const deletedProjectFinance = readDeletedProjectFinanceByGroup(
        group.projectGroupId
    );
    const directExpenses = group.directExpenses.filter(entry => entry.status === 'ACTIVE');
    const directRevenues = group.directRevenues.filter(entry => entry.status === 'ACTIVE');

    // 무효 항목은 이력 목록에는 남기되 실제 재무 합계에서는 제외합니다.
    const actualCost = sumMoney([
        ...directExpenses.map(entry => entry.amount),
        ...projects.flatMap(project => [
            project.workerAmount,
            project.directExpenseAmount
        ]),
        ...deletedProjectFinance.flatMap(project => [
            project.workerAmount,
            project.directExpenseAmount
        ])
    ]);
    const actualRevenue = sumMoney([
        ...directRevenues.map(entry => entry.amount),
        ...projects.map(project => project.directRevenueAmount),
        ...deletedProjectFinance.map(project => project.directRevenueAmount)
    ]);
    const profit = subtractMoney(actualRevenue, actualCost);

    return {
        ...group,
        projects,
        directExpenses: group.directExpenses.map(entry => ({ ...entry })),
        directRevenues: group.directRevenues.map(entry => ({ ...entry })),
        projectCount: projects.length,
        actualCost,
        actualRevenue,
        profit,
        currentContentPerformance: aggregateGroupPerformance(group.projectGroupId, 'current'),
        cumulativeContentPerformance: aggregateGroupPerformance(group.projectGroupId, 'cumulative'),
        roi: calculateRoi(profit, actualCost)
    };
}

/** 상세 응답에서 목록에 필요한 필드만 복사해 가벼운 요약 항목을 만듭니다. */
function toProjectGroupSummary(group: StoredProjectGroup): ProjectGroupSummary {
    const detail = toProjectGroupDetail(group);
    const {
        projects: _projects,
        directExpenses: _directExpenses,
        directRevenues: _directRevenues,
        roi: _roi,
        ...summary
    } = detail;

    return summary;
}

/** 생성·수정 입력의 필드 규칙과 Workspace 내 이름 중복을 함께 검증합니다. */
function validateProjectGroupRequest(
    workspaceId: number,
    request: SaveProjectGroupRequest,
    currentProjectGroupId?: number
) {
    const errors = [];
    const name = request.name.trim();
    const description = normalizeOptionalValue(request.description);
    const startDate = normalizeOptionalValue(request.startDate);
    const endDate = normalizeOptionalValue(request.endDate);

    if (!name || name.length > 150) {
        errors.push({
            field: 'name',
            value: request.name,
            reason: '프로젝트 그룹 이름은 1자 이상 150자 이하로 입력해 주세요.'
        });
    }

    // 날짜 문자열은 date input이 보장하며 업무상 앞뒤 관계만 서버 Mock에서 재검증합니다.
    if (startDate && endDate && endDate < startDate) {
        errors.push({
            field: 'endDate',
            value: request.endDate ?? null,
            reason: '종료일은 시작일보다 빠를 수 없습니다.'
        });
    }

    const duplicate = readProjectGroups().some(group => (
        group.workspaceId === workspaceId
        && group.projectGroupId !== currentProjectGroupId
        && normalizeName(group.name) === normalizeName(name)
    ));

    return {
        errors,
        duplicate,
        normalized: { name, description, startDate, endDate }
    };
}

/** 현재 Workspace의 ProjectGroup을 필터링하고 확정된 상태·날짜 순서로 반환합니다. */
export async function getWorkspaceProjectGroups(
    workspaceId: number,
    request: ProjectGroupListRequest = {}
): Promise<ProjectGroupListResponse> {
    await waitForMockResponse();

    if (mockScenario === 'SERVER_ERROR') {
        return {
            success: false,
            errorCode: 'INTERNAL_SERVER_ERROR',
            message: '프로젝트 그룹 목록을 불러오지 못했습니다.',
            errors: null
        };
    }

    if (mockScenario === 'EMPTY') {
        return { success: true, data: [] };
    }

    const keyword = request.keyword?.trim().toLocaleLowerCase() ?? '';
    const groups = readProjectGroups()
        .filter(group => group.workspaceId === workspaceId)
        .filter(group => request.status === undefined
            || request.status === 'ALL'
            || group.status === request.status
        )
        .filter(group => !keyword
            || group.name.toLocaleLowerCase().includes(keyword)
            || group.description?.toLocaleLowerCase().includes(keyword)
        )
        .filter(group => !request.startDate
            || group.endDate === null
            || group.endDate >= request.startDate
        )
        .filter(group => !request.endDate
            || group.startDate === null
            || group.startDate <= request.endDate
        )
        .sort((left, right) => {
            const statusDifference = STATUS_ORDER[left.status] - STATUS_ORDER[right.status];
            if (statusDifference !== 0) {
                return statusDifference;
            }

            const leftDate = left.startDate ?? left.createdAt;
            const rightDate = right.startDate ?? right.createdAt;
            return rightDate.localeCompare(leftDate);
        })
        .map(toProjectGroupSummary);

    return { success: true, data: groups };
}

/** Workspace 경계를 확인한 뒤 ProjectGroup 상세와 계산된 재무 요약을 반환합니다. */
export async function getWorkspaceProjectGroup(
    workspaceId: number,
    projectGroupId: number
): Promise<ProjectGroupDetailResponse> {
    await waitForMockResponse();
    const group = readProjectGroup(workspaceId, projectGroupId);

    if (!group) {
        return {
            success: false,
            errorCode: 'PROJECT_GROUP_NOT_FOUND',
            message: '현재 제작팀에서 프로젝트 그룹을 찾을 수 없습니다.',
            errors: null
        };
    }

    return { success: true, data: toProjectGroupDetail(group) };
}

/** 새 ProjectGroup을 PLANNING 상태로 저장하고 선택한 미연결 Project를 함께 연결합니다. */
export async function createWorkspaceProjectGroup(
    workspaceId: number,
    request: SaveProjectGroupRequest
): Promise<ProjectGroupMutationResponse> {
    await waitForMockResponse();
    const validation = validateProjectGroupRequest(workspaceId, request);

    if (validation.errors.length > 0) {
        return {
            success: false,
            errorCode: 'INVALID_INPUT_VALUE',
            message: '입력값을 다시 확인해 주세요.',
            errors: validation.errors
        };
    }

    if (validation.duplicate) {
        return {
            success: false,
            errorCode: 'DUPLICATE_PROJECT_GROUP_NAME',
            message: '같은 이름의 프로젝트 그룹이 이미 있습니다.',
            errors: [{
                field: 'name',
                value: request.name,
                reason: '앞뒤 공백과 영문 대소문자를 무시한 이름이 중복됩니다.'
            }]
        };
    }

    const availableIds = new Set(
        readUngroupedProjects(workspaceId).map(project => project.projectId)
    );
    const requestedProjectIds = request.projectIds ?? [];
    if (requestedProjectIds.some(projectId => !availableIds.has(projectId))) {
        return {
            success: false,
            errorCode: 'PROJECT_ALREADY_GROUPED',
            message: '선택한 프로젝트 중 다른 그룹에 연결된 항목이 있습니다.',
            errors: null
        };
    }

    const group = insertProjectGroup({
        workspaceId,
        ...validation.normalized,
        status: 'PLANNING',
        createdAt: new Date().toISOString(),
        directExpenses: [],
        directRevenues: []
    });
    attachProjects(group.projectGroupId, requestedProjectIds);

    return {
        success: true,
        message: '프로젝트 그룹을 만들었습니다.',
        data: toProjectGroupDetail(group)
    };
}

/** ProjectGroup 기본 정보와 상태를 변경하되 연결·재무 이력은 그대로 보존합니다. */
export async function updateWorkspaceProjectGroup(
    workspaceId: number,
    projectGroupId: number,
    request: UpdateProjectGroupRequest
): Promise<ProjectGroupMutationResponse> {
    await waitForMockResponse();
    const currentGroup = readProjectGroup(workspaceId, projectGroupId);

    if (!currentGroup) {
        return {
            success: false,
            errorCode: 'PROJECT_GROUP_NOT_FOUND',
            message: '현재 제작팀에서 프로젝트 그룹을 찾을 수 없습니다.',
            errors: null
        };
    }

    const validation = validateProjectGroupRequest(
        workspaceId,
        request,
        projectGroupId
    );
    if (validation.errors.length > 0 || validation.duplicate) {
        return {
            success: false,
            errorCode: validation.duplicate
                ? 'DUPLICATE_PROJECT_GROUP_NAME'
                : 'INVALID_INPUT_VALUE',
            message: validation.duplicate
                ? '같은 이름의 프로젝트 그룹이 이미 있습니다.'
                : '입력값을 다시 확인해 주세요.',
            errors: validation.duplicate
                ? [{
                    field: 'name',
                    value: request.name,
                    reason: '앞뒤 공백과 영문 대소문자를 무시한 이름이 중복됩니다.'
                }]
                : validation.errors
        };
    }

    const updatedGroup: StoredProjectGroup = {
        ...currentGroup,
        ...validation.normalized,
        status: request.status
    };
    replaceProjectGroup(updatedGroup);

    return {
        success: true,
        message: '프로젝트 그룹 정보를 저장했습니다.',
        data: toProjectGroupDetail(updatedGroup)
    };
}

/** 활성·삭제 Project 이력과 직접 재무 항목이 모두 없는 빈 ProjectGroup만 삭제합니다. */
export async function deleteWorkspaceProjectGroup(
    workspaceId: number,
    projectGroupId: number
): Promise<ProjectGroupDeleteResponse> {
    await waitForMockResponse();
    const group = readProjectGroup(workspaceId, projectGroupId);

    if (!group) {
        return {
            success: false,
            errorCode: 'PROJECT_GROUP_NOT_FOUND',
            message: '현재 제작팀에서 프로젝트 그룹을 찾을 수 없습니다.',
            errors: null
        };
    }

    const hasProjects = readProjectsByGroup(projectGroupId).length > 0;
    const hasFinancialEntries = group.directExpenses.length > 0
        || group.directRevenues.length > 0;
    const hasDeletedProjectFinance = readDeletedProjectFinanceByGroup(projectGroupId).length > 0;
    if (hasProjects || hasFinancialEntries || hasDeletedProjectFinance) {
        return {
            success: false,
            errorCode: 'PROJECT_GROUP_IN_USE',
            message: '연결된 프로젝트 또는 비용·수익 이력이 있어 삭제할 수 없습니다. 완료나 취소 상태로 변경해 주세요.',
            errors: null
        };
    }

    removeProjectGroup(projectGroupId);
    return {
        success: true,
        message: '프로젝트 그룹을 삭제했습니다.',
        data: { projectGroupId }
    };
}

/** ProjectGroup 생성·연결 모달에서 사용할 미연결 Project 목록을 반환합니다. */
export async function getUngroupedProjects(
    workspaceId: number
): Promise<ProjectListResponse> {
    await waitForMockResponse();
    return { success: true, data: readUngroupedProjects(workspaceId) };
}

/** 진행 가능한 ProjectGroup에 아직 그룹이 없는 Project들을 일괄 연결합니다. */
export async function addProjectsToProjectGroup(
    workspaceId: number,
    projectGroupId: number,
    projectIds: number[]
): Promise<ProjectGroupMutationResponse> {
    await waitForMockResponse();
    const group = readProjectGroup(workspaceId, projectGroupId);

    if (!group) {
        return {
            success: false,
            errorCode: 'PROJECT_GROUP_NOT_FOUND',
            message: '현재 제작팀에서 프로젝트 그룹을 찾을 수 없습니다.',
            errors: null
        };
    }

    if (group.status === 'COMPLETED' || group.status === 'CANCELLED') {
        return {
            success: false,
            errorCode: 'PROJECT_GROUP_CLOSED',
            message: '완료 또는 취소된 그룹에는 프로젝트를 연결할 수 없습니다. 먼저 진행 중으로 변경해 주세요.',
            errors: null
        };
    }

    const availableIds = new Set(
        readUngroupedProjects(workspaceId).map(project => project.projectId)
    );
    if (projectIds.some(projectId => !availableIds.has(projectId))) {
        return {
            success: false,
            errorCode: 'PROJECT_ALREADY_GROUPED',
            message: '선택한 프로젝트 중 다른 그룹에 연결된 항목이 있습니다.',
            errors: null
        };
    }

    attachProjects(projectGroupId, projectIds);
    const updatedGroup = readProjectGroup(workspaceId, projectGroupId);
    return {
        success: true,
        message: '프로젝트를 그룹에 연결했습니다.',
        data: toProjectGroupDetail(updatedGroup ?? group)
    };
}

/** Project 데이터는 유지하면서 현재 ProjectGroup과의 연결만 해제합니다. */
export async function removeProjectFromProjectGroup(
    workspaceId: number,
    projectGroupId: number,
    projectId: number
): Promise<ProjectGroupMutationResponse> {
    await waitForMockResponse();
    const group = readProjectGroup(workspaceId, projectGroupId);
    const project = readProjectsByGroup(projectGroupId).find(
        item => item.projectId === projectId
    );

    if (!group || !project) {
        return {
            success: false,
            errorCode: 'PROJECT_NOT_FOUND',
            message: '현재 프로젝트 그룹에서 프로젝트를 찾을 수 없습니다.',
            errors: null
        };
    }

    detachProject(projectGroupId, projectId);
    return {
        success: true,
        message: '프로젝트 그룹 연결을 해제했습니다.',
        data: toProjectGroupDetail(group)
    };
}
