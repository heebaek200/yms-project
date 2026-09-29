import FeedbackMessage from '../common/FeedbackMessage';
import {
    type TaskStatus,
    type TodayDeadline
} from '../../api/dashboard/schedule';

import './DeadlineFeed.css';

type DeadlineFeedProps = {
    deadlines: TodayDeadline[];
    isLoading: boolean;
    errorMessage: string | null;
    onDeadlineClick: (deadline: TodayDeadline) => void;
};

// Task 상태 문구와 CSS modifier를 함께 관리해 표시 규칙이 분산되지 않도록 합니다.
const TASK_STATUS: Record<
    TaskStatus,
    {
        label: string;
        className: string;
    }
> = {
    WAITING: {
        label: '대기',
        className: 'waiting'
    },
    PROGRESS: {
        label: '진행 중',
        className: 'progress'
    },
    REVIEW: {
        label: '검수 중',
        className: 'review'
    },
    COMPLETED: {
        label: '완료',
        className: 'completed'
    }
};

/**
 * API의 YYYY-MM-DD 날짜를 시간대 변환 없이 한국어 화면용 문자열로 변환합니다.
 * 유효한 세 부분으로 나뉘지 않는 값은 원문을 반환하여 잘못된 날짜를 숨기지 않으며,
 * 반환값은 마감 피드의 time 요소에 표시됩니다.
 */
function formatDeadlineDate(value: string) {
    const [year, month, day] = value.split('-');

    // 예상 형식이 아니면 임의로 보정하지 않고 서버에서 받은 값을 그대로 보여줍니다.
    if (!year || !month || !day) {
        return value;
    }

    return `${year}. ${month}. ${day}.`;
}

/**
 * Schedule API의 오늘 마감 항목을 표시합니다.
 * 로딩·오류·빈 결과를 각각 구분하며 정상 데이터는 상태 배지가 포함된 목록으로 구성합니다.
 * 항목 클릭 시 원본 식별자를 포함한 TodayDeadline을 전달하여 SCR-08 라우팅을 연결할 수 있습니다.
 */
function DeadlineFeed({
    deadlines,
    isLoading,
    errorMessage,
    onDeadlineClick
}: DeadlineFeedProps) {
    return (
        <section
            className="deadline-feed"
            aria-labelledby="deadline-feed-title"
            aria-busy={isLoading}
        >
            {/* 제목과 정상 조회된 마감 건수를 피드 상단에 함께 제공합니다. */}
            <div className="deadline-feed__header">
                <h3
                    id="deadline-feed-title"
                    className="deadline-feed__title"
                >
                    오늘 마감
                </h3>

                {!isLoading && !errorMessage && (
                    <span
                        className="deadline-feed__count"
                        aria-label={`${deadlines.length}건`}
                    >
                        {deadlines.length}
                    </span>
                )}
            </div>

            {/* API 실패 메시지는 공통 FeedbackMessage의 alert 규칙을 재사용합니다. */}
            {errorMessage && (
                <FeedbackMessage
                    type="error"
                    message={errorMessage}
                />
            )}

            {/* 실제 항목과 비슷한 높이의 자리 표시자로 로딩 중 레이아웃 이동을 줄입니다. */}
            {isLoading && (
                <div
                    className="deadline-feed__skeleton-list"
                    role="status"
                    aria-live="polite"
                >
                    <span className="deadline-feed__loading-text">
                        마감 업무를 불러오는 중...
                    </span>

                    {[0, 1, 2].map(item => (
                        <div
                            key={item}
                            className="deadline-feed__skeleton"
                            aria-hidden="true"
                        >
                            <span className="deadline-feed__skeleton-line deadline-feed__skeleton-line--title" />
                            <span className="deadline-feed__skeleton-line deadline-feed__skeleton-line--detail" />
                            <span className="deadline-feed__skeleton-line deadline-feed__skeleton-line--detail" />
                        </div>
                    ))}
                </div>
            )}

            {/* 조회는 성공했지만 마감 업무가 없는 상태를 오류와 구분해 안내합니다. */}
            {!isLoading && !errorMessage && deadlines.length === 0 && (
                <p
                    className="deadline-feed__empty"
                    role="status"
                >
                    오늘 마감 예정인 작업이 없습니다.
                </p>
            )}

            {/* 각 행 전체를 버튼으로 만들어 키보드로도 상세 연결 지점을 사용할 수 있습니다. */}
            {!isLoading && !errorMessage && deadlines.length > 0 && (
                <ul className="deadline-feed__list">
                    {deadlines.map(deadline => {
                        // API 상태를 사용자 문구와 상태별 스타일로 변환합니다.
                        const status = TASK_STATUS[deadline.taskStatus];

                        return (
                            <li
                                key={deadline.taskId}
                                className="deadline-feed__item"
                            >
                                <button
                                    type="button"
                                    className="deadline-feed__button"
                                    onClick={() => onDeadlineClick(deadline)}
                                    aria-label={`${deadline.projectTitle} ${deadline.taskTypeName} 상세 보기`}
                                >
                                    {/* 프로젝트 제목과 작업 상태를 첫 줄의 핵심 정보로 배치합니다. */}
                                    <span className="deadline-feed__item-header">
                                        <strong className="deadline-feed__project-title">
                                            {deadline.projectTitle}
                                        </strong>

                                        <span
                                            className={`deadline-feed__status deadline-feed__status--${status.className}`}
                                        >
                                            {status.label}
                                        </span>
                                    </span>

                                    <span className="deadline-feed__task-type">
                                        {deadline.taskTypeName}
                                    </span>

                                    {/* 담당자와 마감일은 보조 정보로 묶어 작은 화면에서 줄바꿈합니다. */}
                                    <span className="deadline-feed__meta">
                                        <span>{deadline.workerName}</span>
                                        <span aria-hidden="true">·</span>
                                        <time dateTime={deadline.endDate}>
                                            {formatDeadlineDate(deadline.endDate)}
                                        </time>
                                    </span>
                                </button>
                            </li>
                        );
                    })}
                </ul>
            )}
        </section>
    );
}

export default DeadlineFeed;
