// Dashboard Summary Mock API

import type {
    ApiFailureResponse,
    ApiResponse,
    ApiSuccessResponse
} from '../types';
import type { DashboardRequestContext } from './types';

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

type MockSummaryItem = {
    workspaceId: number;
    participantUserIds: number[];
    progressProjectCount: number;
    myDueTaskCount: number;
    reviewTaskCount: number;
    dueSoonTaskCount: number;
};

// 프로젝트 참여 범위로 요약값이 달라지는지 검증할 수 있는 Mock 집계 원본입니다.
const MOCK_SUMMARY_ITEMS: MockSummaryItem[] = [
    { workspaceId: 1, participantUserIds: [24601, 24604], progressProjectCount: 1, myDueTaskCount: 3, reviewTaskCount: 2, dueSoonTaskCount: 1 },
    { workspaceId: 1, participantUserIds: [24602], progressProjectCount: 1, myDueTaskCount: 0, reviewTaskCount: 0, dueSoonTaskCount: 1 },
    { workspaceId: 1, participantUserIds: [24601, 24604], progressProjectCount: 1, myDueTaskCount: 2, reviewTaskCount: 0, dueSoonTaskCount: 1 },
    { workspaceId: 1, participantUserIds: [24601], progressProjectCount: 1, myDueTaskCount: 2, reviewTaskCount: 0, dueSoonTaskCount: 0 },
    { workspaceId: 2, participantUserIds: [24601, 24621], progressProjectCount: 1, myDueTaskCount: 1, reviewTaskCount: 0, dueSoonTaskCount: 0 }
];

/**
 * 제작팀과 인증 사용자의 조회 범위를 먼저 적용한 뒤 Dashboard 요약값을 합산합니다.
 * MEMBER는 참여 프로젝트만 포함하고 OWNER·ADMIN은 제작팀 전체 항목을 포함합니다.
 */
function createDashboardSummary(
    workspaceId: number,
    context: DashboardRequestContext
): DashboardSummaryData {
    const visibleItems = MOCK_SUMMARY_ITEMS.filter(item => (
        item.workspaceId === workspaceId
        && (
            context.workspaceRole !== 'MEMBER'
            || item.participantUserIds.includes(context.userId)
        )
    ));

    // 각 수치는 같은 권한 범위에서 합산하여 카드 사이에 조회 경계 차이가 생기지 않게 합니다.
    return visibleItems.reduce<DashboardSummaryData>((summary, item) => ({
        progressProjectCount: summary.progressProjectCount + item.progressProjectCount,
        myDueTaskCount: summary.myDueTaskCount + item.myDueTaskCount,
        reviewTaskCount: summary.reviewTaskCount + item.reviewTaskCount,
        dueSoonTaskCount: summary.dueSoonTaskCount + item.dueSoonTaskCount
    }), {
        progressProjectCount: 0,
        myDueTaskCount: 0,
        reviewTaskCount: 0,
        dueSoonTaskCount: 0
    });
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
