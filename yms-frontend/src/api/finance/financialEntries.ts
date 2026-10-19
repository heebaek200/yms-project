import type { ApiResponse } from '../types';
import type { ProjectGroupFinancialEntry } from '../../types/projectGroup';
import {
    issueFinancialEntryId,
    readProjectGroup,
    replaceProjectGroup
} from '../projectGroups/projectGroupStore';
import { normalizeMoneyInput } from '../../utils/decimal';

export type FinancialEntryKind = 'EXPENSE' | 'REVENUE';

export type SaveFinancialEntryRequest = {
    scopeType: 'PROJECT_GROUP';
    projectGroupId: number;
    entryType: string;
    amount: string;
    occurredOn: string;
    memo?: string | null;
};

type FinancialEntryResponse = ApiResponse<ProjectGroupFinancialEntry>;
type FinancialEntryVoidResponse = ApiResponse<{
    projectGroupId: number;
    entryId: number;
}>;

/** 실제 API 요청과 같은 저장 진행 상태를 확인할 수 있도록 Mock 응답을 지연합니다. */
async function waitForMockResponse() {
    await new Promise(resolve => setTimeout(resolve, 300));
}

/** 공통 Expense·Revenue 입력을 검증하고 BigDecimal 호환 문자열과 정규화된 필드를 반환합니다. */
function validateFinancialEntry(request: SaveFinancialEntryRequest) {
    const errors = [];
    const amountResult = normalizeMoneyInput(request.amount);
    const entryType = request.entryType.trim();
    const memo = request.memo?.trim() || null;

    if (!entryType) {
        errors.push({
            field: 'entryType',
            value: request.entryType,
            reason: '항목 유형을 선택해 주세요.'
        });
    }

    if (!amountResult.success) {
        errors.push({
            field: 'amount',
            value: request.amount,
            reason: amountResult.message
        });
    }

    if (!request.occurredOn) {
        errors.push({
            field: 'occurredOn',
            value: request.occurredOn,
            reason: '발생일 또는 정산 기준일을 입력해 주세요.'
        });
    }

    if (memo && memo.length > 500) {
        errors.push({
            field: 'memo',
            value: request.memo ?? null,
            reason: '메모는 500자 이하로 입력해 주세요.'
        });
    }

    return {
        errors,
        normalized: {
            amount: amountResult.success ? amountResult.value : '0.00',
            entryType,
            memo
        }
    };
}

/** 현재 ProjectGroup과 항목 종류에 해당하는 저장 배열을 선택합니다. */
function getEntries(
    group: NonNullable<ReturnType<typeof readProjectGroup>>,
    kind: FinancialEntryKind
) {
    return kind === 'EXPENSE'
        ? group.directExpenses
        : group.directRevenues;
}

/** ProjectGroup에 직접 귀속되는 Expense 또는 실제 Revenue를 공통 구조로 저장합니다. */
export async function createFinancialEntry(
    workspaceId: number,
    kind: FinancialEntryKind,
    request: SaveFinancialEntryRequest
): Promise<FinancialEntryResponse> {
    await waitForMockResponse();
    const group = readProjectGroup(workspaceId, request.projectGroupId);

    if (!group || request.scopeType !== 'PROJECT_GROUP') {
        return {
            success: false,
            errorCode: 'PROJECT_GROUP_NOT_FOUND',
            message: '현재 제작팀에서 프로젝트 그룹을 찾을 수 없습니다.',
            errors: null
        };
    }

    const validation = validateFinancialEntry(request);
    if (validation.errors.length > 0) {
        return {
            success: false,
            errorCode: 'INVALID_INPUT_VALUE',
            message: '입력값을 다시 확인해 주세요.',
            errors: validation.errors
        };
    }

    const entry: ProjectGroupFinancialEntry = {
        entryId: issueFinancialEntryId(),
        ...validation.normalized,
        occurredOn: request.occurredOn,
        status: 'ACTIVE'
    };
    const entries = getEntries(group, kind);

    // 동일한 공통 저장 흐름에서 종류에 해당하는 배열만 교체해 다른 이력을 보존합니다.
    replaceProjectGroup({
        ...group,
        directExpenses: kind === 'EXPENSE'
            ? [...entries, entry]
            : group.directExpenses,
        directRevenues: kind === 'REVENUE'
            ? [...entries, entry]
            : group.directRevenues
    });

    return {
        success: true,
        message: kind === 'EXPENSE'
            ? '프로젝트 그룹 비용을 등록했습니다.'
            : '프로젝트 그룹 실제 수익을 등록했습니다.',
        data: { ...entry }
    };
}

/** ACTIVE 재무 항목의 입력값을 변경하고 VOIDED 항목의 일반 수정을 차단합니다. */
export async function updateFinancialEntry(
    workspaceId: number,
    kind: FinancialEntryKind,
    entryId: number,
    request: SaveFinancialEntryRequest
): Promise<FinancialEntryResponse> {
    await waitForMockResponse();
    const group = readProjectGroup(workspaceId, request.projectGroupId);

    if (!group) {
        return {
            success: false,
            errorCode: 'PROJECT_GROUP_NOT_FOUND',
            message: '현재 제작팀에서 프로젝트 그룹을 찾을 수 없습니다.',
            errors: null
        };
    }

    const entries = getEntries(group, kind);
    const currentEntry = entries.find(entry => entry.entryId === entryId);
    if (!currentEntry || currentEntry.status === 'VOIDED') {
        return {
            success: false,
            errorCode: 'INVALID_RESOURCE_STATE',
            message: '수정할 수 있는 비용·수익 항목을 찾지 못했습니다.',
            errors: null
        };
    }

    const validation = validateFinancialEntry(request);
    if (validation.errors.length > 0) {
        return {
            success: false,
            errorCode: 'INVALID_INPUT_VALUE',
            message: '입력값을 다시 확인해 주세요.',
            errors: validation.errors
        };
    }

    const updatedEntry: ProjectGroupFinancialEntry = {
        ...currentEntry,
        ...validation.normalized,
        occurredOn: request.occurredOn
    };
    const updatedEntries = entries.map(entry => (
        entry.entryId === entryId ? updatedEntry : entry
    ));

    replaceProjectGroup({
        ...group,
        directExpenses: kind === 'EXPENSE' ? updatedEntries : group.directExpenses,
        directRevenues: kind === 'REVENUE' ? updatedEntries : group.directRevenues
    });

    return {
        success: true,
        message: kind === 'EXPENSE'
            ? '프로젝트 그룹 비용을 수정했습니다.'
            : '프로젝트 그룹 실제 수익을 수정했습니다.',
        data: { ...updatedEntry }
    };
}

/** 잘못 등록된 항목을 삭제하지 않고 VOIDED로 변경해 재무 이력에서 보존합니다. */
export async function voidFinancialEntry(
    workspaceId: number,
    projectGroupId: number,
    kind: FinancialEntryKind,
    entryId: number
): Promise<FinancialEntryVoidResponse> {
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

    const entries = getEntries(group, kind);
    const targetEntry = entries.find(entry => entry.entryId === entryId);
    if (!targetEntry || targetEntry.status === 'VOIDED') {
        return {
            success: false,
            errorCode: 'INVALID_RESOURCE_STATE',
            message: '무효 처리할 수 있는 항목을 찾지 못했습니다.',
            errors: null
        };
    }

    const updatedEntries = entries.map(entry => (
        entry.entryId === entryId
            ? { ...entry, status: 'VOIDED' as const }
            : entry
    ));
    replaceProjectGroup({
        ...group,
        directExpenses: kind === 'EXPENSE' ? updatedEntries : group.directExpenses,
        directRevenues: kind === 'REVENUE' ? updatedEntries : group.directRevenues
    });

    return {
        success: true,
        message: kind === 'EXPENSE'
            ? '비용 항목을 무효 처리했습니다.'
            : '수익 항목을 무효 처리했습니다.',
        data: { projectGroupId, entryId }
    };
}

