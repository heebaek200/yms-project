import { useCallback, useEffect, useLayoutEffect, useState } from 'react';
import { useSearchParams } from 'react-router';

import ChannelManagement from '../components/workspace-settings/ChannelManagement';
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
 * Channel·Task Type 기능은 현재 이슈에서, 멤버 기능은 #35의 연결 위치로 분리합니다.
 */
function WorkspaceSettingsPage() {
    const { currentWorkspace } = useWorkspace();
    const [searchParams, setSearchParams] = useSearchParams();
    const [isFormDirty, setIsFormDirty] = useState(false);
    const rawTab = searchParams.get('tab');
    const activeTab = parseSettingsTab(rawTab);

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

        return registerUnsavedChangesGuard(() => window.confirm(
            '저장하지 않은 변경사항이 있습니다. 변경사항을 버리고 이동할까요?'
        ));
    }, [isFormDirty]);

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

    /** 미저장 확인을 통과한 경우에만 URL의 활성 관리 탭을 변경합니다. */
    const handleTabChange = useCallback((tab: SettingsTab) => {
        if (tab === activeTab) {
            return;
        }

        // 입력 직후의 빠른 클릭도 Effect 등록 시점과 무관하게 현재 Dirty 상태로 차단합니다.
        if (isFormDirty && !window.confirm(
            '저장하지 않은 변경사항이 있습니다. 변경사항을 버리고 이동할까요?'
        )) {
            return;
        }

        setIsFormDirty(false);
        setSearchParams({ tab });
    }, [activeTab, isFormDirty, setSearchParams]);

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

            <nav className="workspace-settings-tabs" role="tablist" aria-label="제작팀 관리 메뉴">
                {SETTINGS_TABS.map(tab => (
                    <button
                        key={tab.key}
                        type="button"
                        role="tab"
                        aria-selected={activeTab === tab.key}
                        className={activeTab === tab.key
                            ? 'workspace-settings-tab workspace-settings-tab--active'
                            : 'workspace-settings-tab'
                        }
                        onClick={() => handleTabChange(tab.key)}
                    >
                        <span aria-hidden="true">{tab.icon}</span>
                        {tab.label}
                    </button>
                ))}
            </nav>

            <div className="workspace-settings-content" role="tabpanel">
                {activeTab === 'channels' && (
                    <ChannelManagement
                        key={`channels-${currentWorkspace.workspaceId}`}
                        workspaceId={currentWorkspace.workspaceId}
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
                    <section className="settings-members-preview" aria-labelledby="members-preview-title">
                        <span aria-hidden="true">🪄</span>
                        <h2 id="members-preview-title">멤버 관리도 곧 합류해요</h2>
                        <p>#35에서 멤버와 초대 관리 기능을 이 자리에 이어 붙일 예정입니다.</p>
                    </section>
                )}
            </div>
        </section>
    );
}

export default WorkspaceSettingsPage;
