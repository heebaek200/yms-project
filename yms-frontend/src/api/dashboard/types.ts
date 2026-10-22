import type { WorkspaceRole } from '../../types/workspace';

/**
 * 실제 서버가 인증 세션과 제작팀 멤버십에서 결정할 Dashboard 조회 권한입니다.
 * Mock API에서는 화면이 임의의 사용자 ID나 권한을 Query로 보내는 구조를 피하면서
 * 같은 응답 경계를 검증할 수 있도록 별도 호출 문맥으로 전달합니다.
 */
export type DashboardRequestContext = {
    userId: number;
    workspaceRole: WorkspaceRole;
};
