export const WORKSPACE_SWITCHER_OPEN_EVENT =
    'yms:workspace-switcher-open';

/**
 * Header 밖의 접근 상태 화면에서 제작팀 전환 메뉴 열기를 요청합니다.
 * 전역 상태에 일시적인 Popover 열림 여부를 저장하지 않고 UI 이벤트만 전달합니다.
 * WorkspaceSwitcher가 없는 화면에서는 부작용 없이 요청이 종료됩니다.
 */
export function requestWorkspaceSwitcherOpen() {
    window.dispatchEvent(new Event(WORKSPACE_SWITCHER_OPEN_EVENT));
}
