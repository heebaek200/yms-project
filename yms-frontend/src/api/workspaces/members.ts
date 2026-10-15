import type { UserRole } from '../../types/auth';
import type { WorkspaceRole } from '../../types/workspace';
import type {
    WorkspaceMember,
    WorkspaceMemberStatus
} from '../../types/workspaceSettings';
import type { ApiResponse, ApiSuccessResponse } from '../types';
import { updateMockWorkspaceRole } from './workspaces';

export type WorkspaceMemberListRequest = {
    keyword?: string;
    status?: WorkspaceMemberStatus | 'ALL';
    professionalRole?: UserRole | 'ALL';
    workspaceRole?: WorkspaceRole | 'ALL';
};

export type WorkspaceMemberListResponse =
    ApiSuccessResponse<WorkspaceMember[]>;
export type WorkspaceMemberResponse = ApiResponse<WorkspaceMember>;

// 권한 경계와 모든 필터를 한 화면에서 검증할 수 있는 제작팀별 Mock 멤버 저장소입니다.
let mockMembers: Record<number, WorkspaceMember[]> = {
    1: [
        {
            workspaceMemberId: 101,
            userId: 24601,
            name: '테스트 사용자',
            email: 'test@test.com',
            professionalRoles: ['CREATOR', 'EDITOR'],
            workspaceRole: 'OWNER',
            status: 'ACTIVE',
            joinedAt: '2026-01-08T10:00:00+09:00',
            leftAt: null
        },
        {
            workspaceMemberId: 102,
            userId: 24602,
            name: '윤공동',
            email: 'co-owner@yms.test',
            professionalRoles: ['PLANNER', 'WRITER'],
            workspaceRole: 'OWNER',
            status: 'ACTIVE',
            joinedAt: '2026-02-12T14:30:00+09:00',
            leftAt: null
        },
        {
            workspaceMemberId: 103,
            userId: 24603,
            name: '김관리',
            email: 'admin@yms.test',
            professionalRoles: ['VIDEOGRAPHER'],
            workspaceRole: 'ADMIN',
            status: 'ACTIVE',
            joinedAt: '2026-03-03T09:20:00+09:00',
            leftAt: null
        },
        {
            workspaceMemberId: 104,
            userId: 24604,
            name: '이편집',
            email: 'editor@yms.test',
            professionalRoles: ['EDITOR', 'THUMBNAILER'],
            workspaceRole: 'MEMBER',
            status: 'ACTIVE',
            joinedAt: '2026-04-18T17:10:00+09:00',
            leftAt: null
        },
        {
            workspaceMemberId: 105,
            userId: 24605,
            name: '박휴식',
            email: 'left@yms.test',
            professionalRoles: ['WRITER'],
            workspaceRole: 'MEMBER',
            status: 'LEFT',
            joinedAt: '2026-02-01T11:00:00+09:00',
            leftAt: '2026-09-01T11:00:00+09:00'
        },
        {
            workspaceMemberId: 106,
            userId: 24606,
            name: '최제외',
            email: 'removed@yms.test',
            professionalRoles: ['VIDEOGRAPHER'],
            workspaceRole: 'MEMBER',
            status: 'REMOVED',
            joinedAt: '2026-05-01T11:00:00+09:00',
            leftAt: '2026-09-15T11:00:00+09:00'
        }
    ]
};

/** 전달받은 제작팀의 Mock 멤버 배열을 초기화 없이 안전하게 반환합니다. */
function getMemberStore(workspaceId: number) {
    if (!mockMembers[workspaceId]) {
        mockMembers[workspaceId] = [];
    }

    return mockMembers[workspaceId];
}

/**
 * 이름·이메일과 상태, 전문 역할, 제작팀 권한 조건을 AND로 적용해 멤버를 조회합니다.
 * 기본 상태는 ACTIVE이며 다중 전문 역할은 선택 역할을 하나라도 포함하면 일치합니다.
 */
export async function getWorkspaceMembers(
    workspaceId: number,
    request: WorkspaceMemberListRequest = {}
): Promise<WorkspaceMemberListResponse> {
    await new Promise(resolve => setTimeout(resolve, 220));

    const keyword = request.keyword?.trim().toLocaleLowerCase() ?? '';
    const status = request.status ?? 'ACTIVE';
    const professionalRole = request.professionalRole ?? 'ALL';
    const workspaceRole = request.workspaceRole ?? 'ALL';

    const members = getMemberStore(workspaceId).filter(member => {
        const matchesKeyword = !keyword
            || member.name.toLocaleLowerCase().includes(keyword)
            || member.email.toLocaleLowerCase().includes(keyword);
        const matchesStatus = status === 'ALL' || member.status === status;
        const matchesProfessionalRole = professionalRole === 'ALL'
            || member.professionalRoles.includes(professionalRole);
        const matchesWorkspaceRole = workspaceRole === 'ALL'
            || member.workspaceRole === workspaceRole;

        return matchesKeyword
            && matchesStatus
            && matchesProfessionalRole
            && matchesWorkspaceRole;
    });

    return { success: true, data: members.map(member => ({ ...member })) };
}

/** 이메일 기준으로 재초대 가능 여부를 판단할 때 사용할 기존 멤버를 조회합니다. */
export function findMockWorkspaceMemberByEmail(
    workspaceId: number,
    email: string
) {
    const normalizedEmail = email.trim().toLocaleLowerCase();
    return getMemberStore(workspaceId).find(
        member => member.email.toLocaleLowerCase() === normalizedEmail
    );
}

/**
 * OWNER만 멤버 권한을 바꾸며 마지막 ACTIVE OWNER의 강등을 차단합니다.
 * 현재 사용자의 권한 변경은 제작팀 목록 Mock에도 반영해 Route Guard가 재검증합니다.
 */
export async function updateWorkspaceMemberRole(
    workspaceId: number,
    workspaceMemberId: number,
    workspaceRole: WorkspaceRole,
    actorUserId: number
): Promise<WorkspaceMemberResponse> {
    await new Promise(resolve => setTimeout(resolve, 300));

    const members = getMemberStore(workspaceId);
    const actor = members.find(member => member.userId === actorUserId);
    const target = members.find(
        member => member.workspaceMemberId === workspaceMemberId
    );

    if (!actor || actor.status !== 'ACTIVE' || actor.workspaceRole !== 'OWNER') {
        return {
            success: false,
            errorCode: 'WORKSPACE_ROLE_CHANGE_FORBIDDEN',
            message: '소유자만 제작팀 권한을 변경할 수 있습니다.',
            errors: null
        };
    }

    if (!target || target.status !== 'ACTIVE') {
        return {
            success: false,
            errorCode: 'WORKSPACE_MEMBER_NOT_ACTIVE',
            message: '활동 중인 멤버를 찾을 수 없습니다.',
            errors: null
        };
    }

    const activeOwnerCount = members.filter(member => (
        member.status === 'ACTIVE' && member.workspaceRole === 'OWNER'
    )).length;

    if (
        target.workspaceRole === 'OWNER'
        && workspaceRole !== 'OWNER'
        && activeOwnerCount <= 1
    ) {
        return {
            success: false,
            errorCode: 'LAST_WORKSPACE_OWNER',
            message: '제작팀에는 활동 중인 소유자가 한 명 이상 필요합니다.',
            errors: null
        };
    }

    target.workspaceRole = workspaceRole;

    if (target.userId === actorUserId) {
        updateMockWorkspaceRole(workspaceId, workspaceRole);
    }

    return {
        success: true,
        message: `${target.name} 님의 권한을 변경했습니다.`,
        data: { ...target }
    };
}

/**
 * OWNER는 자신을 제외한 멤버를, ADMIN은 일반 MEMBER만 제작팀에서 제외합니다.
 * 제외는 이력을 보존하도록 REMOVED 상태와 처리 시각만 갱신합니다.
 */
export async function removeWorkspaceMember(
    workspaceId: number,
    workspaceMemberId: number,
    actorUserId: number
): Promise<WorkspaceMemberResponse> {
    await new Promise(resolve => setTimeout(resolve, 300));

    const members = getMemberStore(workspaceId);
    const actor = members.find(member => member.userId === actorUserId);
    const target = members.find(
        member => member.workspaceMemberId === workspaceMemberId
    );

    if (!actor || actor.status !== 'ACTIVE' || actor.workspaceRole === 'MEMBER') {
        return {
            success: false,
            errorCode: 'WORKSPACE_MEMBER_REMOVE_FORBIDDEN',
            message: '멤버를 제외할 권한이 없습니다.',
            errors: null
        };
    }

    if (!target || target.status !== 'ACTIVE') {
        return {
            success: false,
            errorCode: 'WORKSPACE_MEMBER_NOT_ACTIVE',
            message: '활동 중인 멤버를 찾을 수 없습니다.',
            errors: null
        };
    }

    if (target.userId === actorUserId) {
        return {
            success: false,
            errorCode: 'SELF_REMOVE_NOT_ALLOWED',
            message: '자기 자신은 제작팀에서 제외할 수 없습니다.',
            errors: null
        };
    }

    if (actor.workspaceRole === 'ADMIN' && target.workspaceRole !== 'MEMBER') {
        return {
            success: false,
            errorCode: 'ADMIN_TARGET_FORBIDDEN',
            message: '관리자는 일반 멤버만 제외할 수 있습니다.',
            errors: null
        };
    }

    target.status = 'REMOVED';
    target.leftAt = new Date().toISOString();

    return {
        success: true,
        message: `${target.name} 님을 제작팀에서 제외했습니다.`,
        data: { ...target }
    };
}
