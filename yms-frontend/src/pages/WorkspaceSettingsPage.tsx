import { useEffect, useLayoutEffect, useState } from 'react';
import { Link, useBlocker, useSearchParams } from 'react-router';

import ChannelManagement from '../components/workspace-settings/ChannelManagement';
import MemberManagement from '../components/workspace-settings/MemberManagement';
import TaskTypeManagement from '../components/workspace-settings/TaskTypeManagement';
import { useWorkspace } from '../hooks/useWorkspace';
import {
    registerUnsavedChangesGuard
} from '../navigation/unsavedChangesGuard';

import './WorkspaceSettingsPage.css';

type SettingsTab = 'members' | 'channels' | 'task-types';

const SETTINGS_TABS: ReadonlyArray<{
    key: SettingsTab;
    label: string;
    icon: string;
}> = [
    { key: 'members', label: '멤버', icon: '👥' },
    { key: 'channels', label: '채널', icon: '📺' },
    { key: 'task-types', label: '작업 종류', icon: '🧩' }
];

/** URL의 tab 값을 지원하는 제작팀 관리 탭으로 제한합니다. */
function parseSettingsTab(value: string | null): SettingsTab {
    return SETTINGS_TABS.some(tab => tab.key === value)
        ? value as SettingsTab
        : 'channels';
}

/**
 * SCR-04 제작팀 관리의 공통 Header와 URL 기반 탭을 제공합니다.
 * Channel·작업 종류·멤버 관리 기능을 URL 기반 탭에서 같은 조작 순서로 제공합니다.
 */
function WorkspaceSettingsPage() {
    const { currentWorkspace } = useWorkspace();
    const [searchParams, setSearchParams] = useSearchParams();
    const [isFormDirty, setIsFormDirty] = useState(false);
    const rawTab = searchParams.get('tab');
    const activeTab = parseSettingsTab(rawTab);
    const blocker = useBlocker(({ currentLocation, nextLocation }) => (
        isFormDirty
        && (
            currentLocation.pathname !== nextLocation.pathname
            || currentLocation.search !== nextLocation.search
        )
    ));

    // Query가 없거나 알 수 없는 경우 canonical Channel 탭 URL로 교체합니다.
    useEffect(() => {
        if (rawTab !== activeTab) {
            setSearchParams({ tab: activeTab }, { replace: true });
        }
    }, [activeTab, rawTab, setSearchParams]);

    // 미저장 폼이 있으면 Header 이동과 제작팀 전환이 같은 확인 문구를 사용합니다.
    useLayoutEffect(() => {
        if (!isFormDirty) {
            return;
        }

        return registerUnsavedChangesGuard(() => {
            const shouldDiscard = window.confirm(
                '저장하지 않은 변경사항이 있습니다. 변경사항을 버리고 이동할까요?'
            );

            // 제작팀 전환·로그아웃처럼 Route 밖의 상태 변경도 승인 뒤 중복 경고 없이 진행합니다.
            if (shouldDiscard) {
                setIsFormDirty(false);
            }

            return shouldDiscard;
        });
    }, [isFormDirty]);

    // Link와 브라우저 뒤로·앞으로 이동을 동일하게 차단하고 사용자 선택대로 재개합니다.
    useEffect(() => {
        if (blocker.state !== 'blocked') {
            return;
        }

        if (window.confirm(
            '저장하지 않은 변경사항이 있습니다. 변경사항을 버리고 이동할까요?'
        )) {
            setIsFormDirty(false);
            window.setTimeout(blocker.proceed, 0);
            return;
        }

        blocker.reset();
    }, [blocker]);

    // 브라우저 새로고침이나 탭 닫기도 미저장 입력이 있을 때 기본 경고를 표시합니다.
    useEffect(() => {
        if (!isFormDirty) {
            return;
        }

        const handleBeforeUnload = (event: BeforeUnloadEvent) => {
            event.preventDefault();
        };

        window.addEventListener('beforeunload', handleBeforeUnload);
        return () => window.removeEventListener('beforeunload', handleBeforeUnload);
    }, [isFormDirty]);

    // 승인된 제작팀 전환 뒤에는 이전 제작팀 모달 상태와 Dirty 표시를 남기지 않습니다.
    useEffect(() => {
        setIsFormDirty(false);
    }, [currentWorkspace?.workspaceId]);

    if (!currentWorkspace) {
        return null;
    }

    return (
        <section className="workspace-settings-page">
            <header className="workspace-settings-header">
                <p className="workspace-settings-header__eyebrow">WORKSPACE SETTINGS</p>
                <h1>제작팀 관리</h1>
                <p>
                    <strong>{currentWorkspace.name}</strong>의 기준 정보를 관리합니다.
                </p>
            </header>

            <nav className="workspace-settings-tabs" aria-label="제작팀 관리 메뉴">
                {SETTINGS_TABS.map(tab => (
                    <Link
                        key={tab.key}
                        to={`/workspace/settings?tab=${tab.key}`}
                        aria-current={activeTab === tab.key ? 'page' : undefined}
                        className={activeTab === tab.key
                            ? 'workspace-settings-tab workspace-settings-tab--active'
                            : 'workspace-settings-tab'
                        }
                    >
                        <span aria-hidden="true">{tab.icon}</span>
                        {tab.label}
                    </Link>
                ))}
            </nav>

            <div className="workspace-settings-content">
                {activeTab === 'channels' && (
                    <ChannelManagement
                        key={`channels-${currentWorkspace.workspaceId}`}
                        workspaceId={currentWorkspace.workspaceId}
                        workspaceRole={currentWorkspace.myRole}
                        onDirtyChange={setIsFormDirty}
                    />
                )}

                {activeTab === 'task-types' && (
                    <TaskTypeManagement
                        key={`task-types-${currentWorkspace.workspaceId}`}
                        workspaceId={currentWorkspace.workspaceId}
                        onDirtyChange={setIsFormDirty}
                    />
                )}

                {activeTab === 'members' && (
                    <MemberManagement
                        key={`members-${currentWorkspace.workspaceId}`}
                        workspaceId={currentWorkspace.workspaceId}
                        onDirtyChange={setIsFormDirty}
                    />
                )}
            </div>
        </section>
    );
}

export default WorkspaceSettingsPage;
