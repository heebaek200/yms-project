type UnsavedChangesGuard = () => boolean;

let activeGuard: UnsavedChangesGuard | null = null;

/**
 * 현재 화면의 미저장 변경 확인 함수를 공통 Header 동작에 등록합니다.
 * 한 번에 표시되는 업무 화면은 하나이므로 가장 최근 등록된 Guard만 활성화합니다.
 */
export function registerUnsavedChangesGuard(guard: UnsavedChangesGuard) {
    activeGuard = guard;

    return () => {
        if (activeGuard === guard) {
            activeGuard = null;
        }
    };
}

/**
 * 등록된 미저장 변경 확인을 실행하고 이동 가능 여부를 반환합니다.
 * Guard가 없는 화면은 별도 확인 없이 기존 내비게이션을 계속합니다.
 */
export function confirmUnsavedChanges() {
    return activeGuard?.() ?? true;
}
