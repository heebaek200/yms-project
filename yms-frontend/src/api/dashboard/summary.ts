// Dashboard Summary Mock API

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
export type DashboardSummarySuccessResponse = {
    success: true;
    data: DashboardSummaryData;
};

// 실패 응답
export type DashboardSummaryFailureResponse = {
    success: false;
    errorCode: string;
    message: string;
};

// 최종 응답 타입
export type DashboardSummaryResponse =
    | DashboardSummarySuccessResponse
    | DashboardSummaryFailureResponse;


// GET /api/dashboard/summary
export async function getDashboardSummary():
    Promise<DashboardSummaryResponse> {

    // TODO:
    // 백엔드 완성 후
    // GET /api/dashboard/summary
    // axios 호출로 교체

    await new Promise(resolve =>
        setTimeout(resolve, 500)
    );


    // 정상 데이터
    if (mockScenario === 'SUCCESS') {
        return {
            success: true,
            data: {
                progressProjectCount: 4,
                myDueTaskCount: 7,
                reviewTaskCount: 2,
                dueSoonTaskCount: 3
            }
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
            errorCode: 'UNAUTHORIZED',
            message:
                '로그인 정보가 만료되었습니다. 다시 로그인해 주세요.'
        };
    }


    // 서버 오류
    return {
        success: false,
        errorCode: 'INTERNAL_SERVER_ERROR',
        message:
            '대시보드 정보를 불러오는 중 오류가 발생했습니다.'
    };
}