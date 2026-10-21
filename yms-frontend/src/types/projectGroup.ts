import type { PerformanceAggregate } from './project';

export type ProjectGroupStatus =
    | 'PLANNING'
    | 'ACTIVE'
    | 'COMPLETED'
    | 'CANCELLED';

export type ProjectStatus =
    | 'PLANNING'
    | 'EDITING'
    | 'REVIEW'
    | 'UPLOADED'
    | 'CANCELLED';

export type FinancialEntryStatus = 'ACTIVE' | 'VOIDED';

export type ProjectGroupProject = {
    projectId: number;
    title: string;
    channelName: string;
    status: ProjectStatus;
    projectGroupId: number | null;
    workerAmount: string;
    directExpenseAmount: string;
    directRevenueAmount: string;
};

export type ProjectGroupFinancialEntry = {
    entryId: number;
    entryType: string;
    amount: string;
    occurredOn: string;
    memo: string | null;
    status: FinancialEntryStatus;
};

export type ProjectGroupSummary = {
    projectGroupId: number;
    name: string;
    description: string | null;
    startDate: string | null;
    endDate: string | null;
    status: ProjectGroupStatus;
    createdAt: string;
    projectCount: number;
    actualCost: string;
    actualRevenue: string;
    profit: string;
    currentContentPerformance: PerformanceAggregate;
    cumulativeContentPerformance: PerformanceAggregate;
};

export type ProjectGroupDetail = ProjectGroupSummary & {
    projects: ProjectGroupProject[];
    directExpenses: ProjectGroupFinancialEntry[];
    directRevenues: ProjectGroupFinancialEntry[];
    roi: string | null;
};
