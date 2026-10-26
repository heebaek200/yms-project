const workspaceMutationTails = new Map<number, Promise<void>>();

/**
 * 같은 Workspace의 Mock 변경을 도착 순서대로 실행해 멤버·프로젝트의 오래된 상태 덮어쓰기를 막습니다.
 * 실제 서버의 행 잠금 경계를 흉내 내며, 콜백은 큐 진입 후 최신 상태를 다시 읽어 동기적으로 변경해야 합니다.
 * 콜백 성공·실패와 관계없이 다음 요청을 해제하고 반환값 또는 오류를 호출자에게 전달합니다.
 */
export async function withWorkspaceMutation<T>(
    workspaceId: number,
    mutation: () => T | Promise<T>
): Promise<T> {
    const previousTail = workspaceMutationTails.get(workspaceId) ?? Promise.resolve();
    let releaseCurrent: () => void = () => undefined;
    const currentTail = new Promise<void>(resolve => {
        releaseCurrent = resolve;
    });

    // 후속 요청은 현재 요청이 명시적으로 해제될 때까지 같은 Workspace에서 대기합니다.
    const queuedTail = previousTail.then(() => currentTail);
    workspaceMutationTails.set(workspaceId, queuedTail);
    await previousTail;

    try {
        return await mutation();
    } finally {
        releaseCurrent();
        if (workspaceMutationTails.get(workspaceId) === queuedTail) {
            workspaceMutationTails.delete(workspaceId);
        }
    }
}
