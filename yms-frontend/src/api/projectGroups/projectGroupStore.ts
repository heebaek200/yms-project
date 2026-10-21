import type {
    ProjectGroupFinancialEntry,
    ProjectGroupProject,
    ProjectGroupStatus
} from '../../types/projectGroup';
import { readProjects, setProjectGroup } from '../projects/projectStore';

export type StoredProjectGroup = {
    projectGroupId: number;
    workspaceId: number;
    name: string;
    description: string | null;
    startDate: string | null;
    endDate: string | null;
    status: ProjectGroupStatus;
    createdAt: string;
    directExpenses: ProjectGroupFinancialEntry[];
    directRevenues: ProjectGroupFinancialEntry[];
};

let nextProjectGroupId = 31;
let nextFinancialEntryId = 301;

// ProjectGroup CRUD와 공통 재무 Mock이 같은 데이터를 사용하도록 저장소를 한곳에서 관리합니다.
let projectGroups: StoredProjectGroup[] = [
    {
        projectGroupId: 1,
        workspaceId: 1,
        name: '신제품 카메라 협찬',
        description: '롱폼 리뷰와 쇼츠 후속 콘텐츠를 함께 분석합니다.',
        startDate: '2026-09-01',
        endDate: '2026-10-15',
        status: 'ACTIVE',
        createdAt: '2026-08-25T09:00:00+09:00',
        directExpenses: [{
            entryId: 101,
            entryType: '장비 렌탈',
            amount: '500000.00',
            occurredOn: '2026-09-02',
            memo: '공통 촬영 장비',
            status: 'ACTIVE'
        }],
        directRevenues: [{
            entryId: 201,
            entryType: 'SPONSORSHIP',
            amount: '10000000.00',
            occurredOn: '2026-09-01',
            memo: '브랜드 협찬 확정 금액',
            status: 'ACTIVE'
        }]
    },
    {
        projectGroupId: 2,
        workspaceId: 1,
        name: '가을 굿즈 소개',
        description: '굿즈 공개 전후 영상 제작 묶음입니다.',
        startDate: '2026-10-20',
        endDate: null,
        status: 'PLANNING',
        createdAt: '2026-10-02T11:30:00+09:00',
        directExpenses: [],
        directRevenues: []
    },
    {
        projectGroupId: 3,
        workspaceId: 1,
        name: '봄 라이브 하이라이트',
        description: '상반기 라이브 클립 제작 결과입니다.',
        startDate: '2026-03-01',
        endDate: '2026-04-30',
        status: 'COMPLETED',
        createdAt: '2026-02-10T14:00:00+09:00',
        directExpenses: [],
        directRevenues: [{
            entryId: 202,
            entryType: 'OTHER',
            amount: '2200000.00',
            occurredOn: '2026-05-10',
            memo: '라이브 행사 정산금',
            status: 'ACTIVE'
        }]
    }
];

/** Mock 호출부가 저장소 원본 배열을 직접 바꾸지 않도록 ProjectGroup을 깊게 복사합니다. */
function cloneProjectGroup(group: StoredProjectGroup): StoredProjectGroup {
    return {
        ...group,
        directExpenses: group.directExpenses.map(entry => ({ ...entry })),
        directRevenues: group.directRevenues.map(entry => ({ ...entry }))
    };
}

/** 현재 저장된 ProjectGroup 전체를 복사해 조회 API의 필터 입력으로 제공합니다. */
export function readProjectGroups(): StoredProjectGroup[] {
    return projectGroups.map(cloneProjectGroup);
}

/** ID와 Workspace가 모두 일치하는 ProjectGroup을 복사해 반환합니다. */
export function readProjectGroup(
    workspaceId: number,
    projectGroupId: number
): StoredProjectGroup | null {
    const group = projectGroups.find(item => (
        item.workspaceId === workspaceId
        && item.projectGroupId === projectGroupId
    ));

    return group ? cloneProjectGroup(group) : null;
}

/** 현재 ProjectGroup에 연결된 Project를 복사해 재무 집계와 상세 표시에 사용합니다. */
export function readProjectsByGroup(
    projectGroupId: number
): ProjectGroupProject[] {
    return readProjects()
        .filter(project => project.projectGroupId === projectGroupId)
        .map(project => ({
            projectId: project.projectId,
            title: project.title,
            channelName: project.channelName,
            status: project.status,
            projectGroupId: project.projectGroupId,
            workerAmount: project.workerAmount,
            directExpenseAmount: project.directExpenseAmount,
            directRevenueAmount: project.directRevenueAmount
        }));
}

/** 현재 Workspace에서 아직 ProjectGroup에 속하지 않은 Project만 연결 선택 목록으로 반환합니다. */
export function readUngroupedProjects(
    workspaceId: number
): ProjectGroupProject[] {
    return readProjects()
        .filter(project => (
            project.workspaceId === workspaceId
            && project.projectGroupId === null
        ))
        .map(project => ({
            projectId: project.projectId,
            title: project.title,
            channelName: project.channelName,
            status: project.status,
            projectGroupId: project.projectGroupId,
            workerAmount: project.workerAmount,
            directExpenseAmount: project.directExpenseAmount,
            directRevenueAmount: project.directRevenueAmount
        }));
}

/** 검증된 새 ProjectGroup을 저장하고 생성된 식별자를 포함한 복사본을 반환합니다. */
export function insertProjectGroup(
    group: Omit<StoredProjectGroup, 'projectGroupId'>
): StoredProjectGroup {
    const createdGroup: StoredProjectGroup = {
        ...group,
        projectGroupId: nextProjectGroupId,
        directExpenses: group.directExpenses.map(entry => ({ ...entry })),
        directRevenues: group.directRevenues.map(entry => ({ ...entry }))
    };

    nextProjectGroupId += 1;
    projectGroups = [...projectGroups, createdGroup];
    return cloneProjectGroup(createdGroup);
}

/** 기존 ProjectGroup의 기본 정보를 교체하고 연결·재무 이력은 그대로 유지합니다. */
export function replaceProjectGroup(group: StoredProjectGroup) {
    projectGroups = projectGroups.map(item => (
        item.projectGroupId === group.projectGroupId ? cloneProjectGroup(group) : item
    ));
}

/** 아무 업무 데이터에도 연결되지 않은 ProjectGroup을 저장소에서 제거합니다. */
export function removeProjectGroup(projectGroupId: number) {
    projectGroups = projectGroups.filter(
        group => group.projectGroupId !== projectGroupId
    );
}

/** 지정 Project들을 한 ProjectGroup에 연결하여 다음 조회와 집계에 반영합니다. */
export function attachProjects(
    projectGroupId: number,
    projectIds: readonly number[]
) {
    const group = projectGroups.find(item => item.projectGroupId === projectGroupId);
    setProjectGroup(projectIds, projectGroupId, group?.name ?? null);
}

/** Project 자체 데이터는 유지하고 ProjectGroup 연결만 제거합니다. */
export function detachProject(projectGroupId: number, projectId: number) {
    const project = readProjects().find(item => item.projectId === projectId);
    if (project?.projectGroupId === projectGroupId) {
        setProjectGroup([projectId], null);
    }
}

/** 공통 Expense·Revenue Mock에서 사용할 고유 항목 ID를 발급합니다. */
export function issueFinancialEntryId(): number {
    const entryId = nextFinancialEntryId;
    nextFinancialEntryId += 1;
    return entryId;
}
