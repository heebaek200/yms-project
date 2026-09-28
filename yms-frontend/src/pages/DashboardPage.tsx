import { useEffect, useState } from 'react';
import DashboardSummary from '../components/dashboard/Summary';
import DashboardSchedule from '../components/dashboard/Schedule';
import DashboardNotifications from '../components/dashboard/Notifications';
import type { ScheduleRoleFilter, ScheduleStatusFilter } from '../api/dashboard/schedule';
import SchedulerFilter from '../components/dashboard/SchedulerFilter';
import { getWorkspaceChannels } from '../api/workspaces/channels';
import { useWorkspace } from '../hooks/useWorkspace';
import type { ChannelSummary } from '../types/workspace';

import './DashboardPage.css';

function DashboardPage() {

    const {
        currentWorkspace,
        isLoading: isWorkspaceLoading,
        errorMessage: workspaceErrorMessage
    } = useWorkspace();

    const [status, setStatus] = useState<ScheduleStatusFilter>('ALL');

    const [role, setRole] = useState<ScheduleRoleFilter>('ALL');

    const [channelId, setChannelId] = useState<number | null>(null);

    const [channels, setChannels] = useState<ChannelSummary[]>([]);

    const [channelErrorMessage, setChannelErrorMessage] = useState<string | null>(null);

    const [keyword, setKeyword] = useState('');

    const [debouncedKeyword, setDebouncedKeyword] = useState('');

    /**
     * 프로젝트 검색어 입력이 멈춘 뒤 300ms가 지나면 실제 조회 검색어를 갱신합니다.
     * 사용자가 연속으로 입력하는 동안에는 이전 타이머를 취소하여
     * 문자 하나를 입력할 때마다 Schedule API가 호출되는 것을 방지합니다.
     */
    useEffect(() => {

        const timerId = window.setTimeout(() => {
            setDebouncedKeyword(keyword);
        }, 300);

        // 검색어가 300ms 안에 다시 변경되면 이전 예약을 취소합니다.
        return () => {
            window.clearTimeout(timerId);
        };

    }, [keyword]);

    /**
     * Workspace가 변경되면 해당 Workspace의 Channel 목록을 다시 조회합니다.
     * 이전 Workspace의 필터가 새 Workspace에 섞이지 않도록 모든 필터도 초기화합니다.
     */
    useEffect(() => {
        if (!currentWorkspace) {
            setChannelId(null);
            setChannels([]);
            return;
        }

        let isCurrentRequest = true;

        const loadChannels = async () => {
            try {
                setChannelErrorMessage(null);

                const response = await getWorkspaceChannels(
                    currentWorkspace.workspaceId
                );

                if (isCurrentRequest) {
                    setChannels(response.data);
                }
            } catch (error) {
                if (!isCurrentRequest) {
                    return;
                }

                console.error(error);
                setChannels([]);
                setChannelErrorMessage('채널 목록을 불러오지 못했습니다.');
            }
        };

        setStatus('ALL');
        setRole('ALL');
        setChannelId(null);
        setChannels([]);
        setKeyword('');
        setDebouncedKeyword('');
        loadChannels();

        return () => {
            isCurrentRequest = false;
        };
    }, [currentWorkspace]);

    /**
     * 스케줄러의 모든 조회 조건을 최초 상태로 되돌립니다.
     * 프로젝트 상태, 담당 역할과 Channel은 전체 조회로 변경하고
     * 프로젝트 검색어는 빈 문자열로 초기화합니다.
     */
    const handleFilterReset = () => {
        setStatus('ALL');
        setRole('ALL');
        setChannelId(null);
        setChannels([]);
        setKeyword('');
        setDebouncedKeyword('');
    };

    if (isWorkspaceLoading) {
        return (
            <p className="dashboard-loading">
                워크스페이스를 불러오는 중...
            </p>
        );
    }

    if (workspaceErrorMessage || !currentWorkspace) {
        return (
            <p className="dashboard-loading">
                {workspaceErrorMessage ?? '사용 가능한 워크스페이스가 없습니다.'}
            </p>
        );
    }

    return (
        <div className="dashboard-page">

            {/* 페이지 상단 */}
            <header className="dashboard-header">
                <div>
                    <h1 className="dashboard-title">
                        스케줄러
                    </h1>

                    <p className="dashboard-description">
                        프로젝트 일정과 작업 현황을 한눈에 확인합니다.
                    </p>
                </div>

                <button
                    type="button"
                    className="dashboard-create-button"
                >
                    새 프로젝트
                </button>
            </header>


            {/* 요약 정보 */}
            <section
                className="dashboard-summary"
                aria-labelledby="dashboard-summary-title"
            >
                <h2
                    id="dashboard-summary-title"
                    className="dashboard-section-title"
                >
                    작업 현황
                </h2>

                <div className="dashboard-summary__content">
                    {/* DashboardSummary 컴포넌트 */}
                    <DashboardSummary
                        workspaceId={currentWorkspace.workspaceId}
                    />
                </div>
            </section>


            {/* 필터 */}
            <section
                className="dashboard-filter"
                aria-labelledby="dashboard-filter-title"
            >
                <h2
                    id="dashboard-filter-title"
                    className="dashboard-section-title"
                >
                    일정 필터
                </h2>

                <div className="dashboard-filter__content">
                    <SchedulerFilter
                        status={status}
                        role={role}
                        channelId={channelId}
                        channels={channels}
                        keyword={keyword}
                        onStatusChange={setStatus}
                        onRoleChange={setRole}
                        onChannelChange={setChannelId}
                        onKeywordChange={setKeyword}
                        onReset={handleFilterReset}
                    />

                    {channelErrorMessage && (
                        <p className="dashboard-filter-error">
                            {channelErrorMessage}
                        </p>
                    )}
                </div>
            </section>


            {/* 스케줄러 */}
            <section
                className="dashboard-schedule"
                aria-labelledby="dashboard-schedule-title"
            >
                <div className="dashboard-section-header">
                    <h2
                        id="dashboard-schedule-title"
                        className="dashboard-section-title"
                    >
                        프로젝트 일정
                    </h2>
                </div>

                <div className="dashboard-schedule__content">
                    {/* DashboardSchedule 컴포넌트 */}
                    <DashboardSchedule
                        workspaceId={currentWorkspace.workspaceId}
                        status={status}
                        role={role}
                        channelId={channelId}
                        keyword={debouncedKeyword}
                    />
                </div>
            </section>


            {/* 새로운 알림 */}
            <section
                className="dashboard-notifications"
                aria-labelledby="dashboard-notifications-title"
            >
                <div className="dashboard-section-header">
                    <h2
                        id="dashboard-notifications-title"
                        className="dashboard-section-title"
                    >
                        새로운 알림
                    </h2>
                </div>

                <div className="dashboard-notifications__content">
                    {/* DashboardNotifications 컴포넌트 */}
                    <DashboardNotifications />
                </div>
            </section>

        </div>
    );
}

export default DashboardPage;
