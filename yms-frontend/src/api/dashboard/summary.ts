// Dashboard Summary Mock API

import type {
    ApiFailureResponse,
    ApiResponse,
    ApiSuccessResponse
} from '../types';
import type { DashboardRequestContext } from './types';
import { readProjects } from '../projects/projectStore';
import { readStoredProjectTasks } from '../projects/projectTaskStore';
import { readWorkspaceMembers } from '../workspaces/members';

// Mock 시나리오 설정
type MockScenario =
    | 'SUCCESS'
    | 'EMPTY'
    | 'UNAUTHORIZED'
    | 'SERVER_ERROR';

let mockScenario: MockScenario = 'SUCCESS';
//let mockScenario: MockScenario = 'SERVER_ERROR';

// 테스트용 Mock 시나리오 변경
export function setDashboardSummaryMockScenario(
    scenario: MockScenario
) {
    mockScenario = scenario;
}



// 대시보드 요약 정보
export type DashboardSummaryData = {
    progressProjectCount: number;
    myDueTaskCount: number;
    reviewTaskCount: number;
    dueSoonTaskCount: number;
};

// 성공 응답
export type DashboardSummarySuccessResponse =
    ApiSuccessResponse<DashboardSummaryData>;

// 실패 응답
export type DashboardSummaryFailureResponse = ApiFailureResponse;

// 최종 응답 타입
export type DashboardSummaryResponse = ApiResponse<DashboardSummaryData>;

/**
 * 최신 Project·Task 저장소에 조회 범위를 적용해 Dashboard 요약을 계산합니다.
 * 삭제 작업과 보관 Project는 모든 카드에서 제외해 목록·일정 집계와 일치시킵니다.
 */
function createDashboardSummary(
    workspaceId: number,
    context: DashboardRequestContext
): DashboardSummaryData {
    const visibleProjects = readProjects().filter(project => project.workspaceId === workspaceId
        && !project.archivedAt
        && (context.workspaceRole !== 'MEMBER' || project.members.some(member => member.userId === context.userId && member.active))
    );
    const visibleProjectIds = new Set(visibleProjects.map(project => project.projectId));
    const activeTasks = readStoredProjectTasks(workspaceId).filter(task => task.deletedAt === null && visibleProjectIds.has(task.projectId));
    const userWorkspaceMemberId = readWorkspaceMembers(workspaceId).find(member => member.userId === context.userId && member.status === 'ACTIVE')?.workspaceMemberId;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const dueSoonLimit = new Date(today);
    dueSoonLimit.setDate(dueSoonLimit.getDate() + 3);

    // 마감 임박은 완료되지 않았고 오늘부터 사흘 안에 종료되는 작업만 포함합니다.
    return {
        progressProjectCount: visibleProjects.filter(project => ['PLANNING', 'EDITING', 'REVIEW'].includes(project.status)).length,
        myDueTaskCount: activeTasks.filter(task => task.assigneeWorkspaceMemberId === userWorkspaceMemberId && task.status !== 'COMPLETED').length,
        reviewTaskCount: activeTasks.filter(task => task.status === 'REVIEW').length,
        dueSoonTaskCount: activeTasks.filter(task => {
            if (!task.endDate || task.status === 'COMPLETED') return false;
            const dueDate = new Date(`${task.endDate}T00:00:00`);
            return dueDate >= today && dueDate <= dueSoonLimit;
        }).length
    };
}


// GET /api/workspaces/{workspaceId}/dashboard/summary
export async function getDashboardSummary(
    workspaceId: number,
    context: DashboardRequestContext
):
    Promise<DashboardSummaryResponse> {

    // TODO:
    // 백엔드 완성 후
    // GET /api/workspaces/{workspaceId}/dashboard/summary
    // axios 호출로 교체

    await new Promise(resolve =>
        setTimeout(resolve, 500)
    );


    // Workspace 전환 시 서로 다른 요약이 표시되는지 확인하기 위한 정상 데이터
    if (mockScenario === 'SUCCESS') {
        return {
            success: true,
            data: createDashboardSummary(workspaceId, context)
        };
    }


    // 데이터가 하나도 없는 신규 사용자
    if (mockScenario === 'EMPTY') {
        return {
            success: true,
            data: {
                progressProjectCount: 0,
                myDueTaskCount: 0,
                reviewTaskCount: 0,
                dueSoonTaskCount: 0
            }
        };
    }


    // 인증 만료
    if (mockScenario === 'UNAUTHORIZED') {
        return {
            success: false,
            errorCode: 'UNAUTHORIZED_SESSION',
            message:
                '로그인 정보가 만료되었습니다. 다시 로그인해 주세요.',
            errors: null
        };
    }


    // 서버 오류
    return {
        success: false,
        errorCode: 'INTERNAL_SERVER_ERROR',
        message:
            '대시보드 정보를 불러오는 중 오류가 발생했습니다.',
        errors: null
    };
}
