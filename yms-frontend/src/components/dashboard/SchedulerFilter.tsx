import type { ScheduleRoleFilter, ScheduleStatusFilter } from '../../api/dashboard/schedule';
import type { ChannelSummary } from '../../types/workspace';

import './SchedulerFilter.css';


type SchedulerFilterProps = {
    status: ScheduleStatusFilter;
    role: ScheduleRoleFilter;
    channelId: number | null;
    channels: ChannelSummary[];
    keyword: string;

    onStatusChange: (
        status: ScheduleStatusFilter
    ) => void;

    onRoleChange: (
        role: ScheduleRoleFilter
    ) => void;

    onChannelChange: (
        channelId: number | null
    ) => void;

    onKeywordChange: (
        keyword: string
    ) => void;

    onReset: () => void;
};


/**
 * 대시보드 스케줄러에서 사용할 조회 조건 UI를 제공합니다.
 * 프로젝트 상태, 담당 역할, Channel, 프로젝트 제목 검색어를 입력받고
 * 변경된 값은 상위 컴포넌트로 전달하여 실제 조회 상태에 반영합니다.
 */
function SchedulerFilter({
    status,
    role,
    channelId,
    channels,
    keyword,
    onStatusChange,
    onRoleChange,
    onChannelChange,
    onKeywordChange,
    onReset
}: SchedulerFilterProps) {

    return (
        <div className="scheduler-filter">

            {/* Project 상태 */}
            <div className="scheduler-filter__group">
                <label
                    className="scheduler-filter__label"
                    htmlFor="scheduler-status"
                >
                    프로젝트 상태
                </label>

                <select
                    id="scheduler-status"
                    className="scheduler-filter__select"
                    value={status}
                    onChange={(event) => {
                        onStatusChange(
                            event.target.value as ScheduleStatusFilter
                        );
                    }}
                >
                    <option value="ALL">
                        전체
                    </option>

                    <option value="PLANNING">
                        기획
                    </option>

                    <option value="EDITING">
                        편집
                    </option>

                    <option value="REVIEW">
                        검토
                    </option>

                    <option value="UPLOADED">
                        업로드 완료
                    </option>

                    <option value="CANCELLED">
                        취소
                    </option>
                </select>
            </div>


            {/* 담당 전문 역할 또는 현재 사용자의 작업 */}
            <div className="scheduler-filter__group">
                <label
                    className="scheduler-filter__label"
                    htmlFor="scheduler-role"
                >
                    담당 역할
                </label>

                <select
                    id="scheduler-role"
                    className="scheduler-filter__select"
                    value={role}
                    onChange={(event) => {
                        onRoleChange(
                            event.target.value as ScheduleRoleFilter
                        );
                    }}
                >
                    <option value="ALL">
                        전체
                    </option>

                    <option value="MY_TASK">
                        내 작업
                    </option>

                    <option value="CREATOR">
                        크리에이터
                    </option>

                    <option value="EDITOR">
                        편집자
                    </option>

                    <option value="THUMBNAILER">
                        썸네일러
                    </option>
                </select>
            </div>


            {/* 현재 Workspace에 등록된 Channel */}
            <div className="scheduler-filter__group">
                <label
                    className="scheduler-filter__label"
                    htmlFor="scheduler-channel"
                >
                    채널
                </label>

                <select
                    id="scheduler-channel"
                    className="scheduler-filter__select"
                    value={channelId ?? 'ALL'}
                    onChange={(event) => {
                        onChannelChange(
                            event.target.value === 'ALL'
                                ? null
                                : Number(event.target.value)
                        );
                    }}
                >
                    <option value="ALL">
                        전체
                    </option>

                    {channels.map(channel => (
                        <option
                            key={channel.channelId}
                            value={channel.channelId}
                        >
                            {channel.name}
                        </option>
                    ))}
                </select>
            </div>


            {/* debounce 전의 사용자 입력값 */}
            <div className="scheduler-filter__group scheduler-filter__group--keyword">
                <label
                    className="scheduler-filter__label"
                    htmlFor="scheduler-keyword"
                >
                    프로젝트 검색
                </label>

                <input
                    id="scheduler-keyword"
                    className="scheduler-filter__input"
                    type="search"
                    value={keyword}
                    placeholder="프로젝트 제목 검색"
                    onChange={(event) => {
                        onKeywordChange(
                            event.target.value
                        );
                    }}
                />
            </div>


            {/* 모든 조건을 최초의 전체 조회 상태로 되돌립니다. */}
            <button
                className="scheduler-filter__reset"
                type="button"
                onClick={onReset}
            >
                초기화
            </button>
        </div>
    );
}

export default SchedulerFilter;
