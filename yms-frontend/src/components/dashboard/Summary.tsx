
import { useEffect, useState } from 'react';
import {
    getDashboardSummary,
    type DashboardSummaryData
} from '../../api/dashboard/summary';
import FeedbackMessage from '../common/FeedbackMessage';

import './Summary.css';

type SummaryItem = {
    key: keyof DashboardSummaryData;
    label: string;
};

// API 필드와 카드 문구를 한곳에서 관리하여 카드 순서와 렌더링을 일관되게 유지합니다.
const SUMMARY_ITEMS: SummaryItem[] = [
    {
        key: 'progressProjectCount',
        label: '진행 중 프로젝트'
    },
    {
        key: 'myDueTaskCount',
        label: '내 마감 예정 작업'
    },
    {
        key: 'reviewTaskCount',
        label: '검수 요청'
    },
    {
        key: 'dueSoonTaskCount',
        label: '마감 임박'
    }
];

type DashboardSummaryProps = {
    workspaceId: number;
};

function DashboardSummary({ workspaceId }: DashboardSummaryProps) {

    const [isLoading, setIsLoading] = useState(true);
    const [summaryData, setSummaryData] = useState<DashboardSummaryData | null>(null);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);

    // Header에서 Workspace를 전환하면 요약 카드도 같은 업무 범위로 다시 조회합니다.
    useEffect(() => {
        let isCurrentRequest = true;

        const loadDashboardSummary = async () => {
            try {
                setIsLoading(true);

                // Workspace 전환 중 이전 Workspace의 수치나 오류가 남아 보이지 않도록 초기화합니다.
                setSummaryData(null);
                setErrorMessage(null);

                const response = await getDashboardSummary(workspaceId);

                // Workspace가 바뀐 뒤 도착한 이전 응답은 화면에 반영하지 않습니다.
                if (!isCurrentRequest) {
                    return;
                }

                if (response.success) {
                    setSummaryData(response.data);
                    return;
                }

                setErrorMessage(response.message);
            } catch (error) {
                if (!isCurrentRequest) {
                    return;
                }

                console.error(error);
                setErrorMessage('작업 현황을 불러오지 못했습니다.');
            } finally {
                if (isCurrentRequest) {
                    setIsLoading(false);
                }
            }
        };

        loadDashboardSummary();

        return () => {
            isCurrentRequest = false;
        };
    }, [workspaceId]);

    if (errorMessage) {
        return (
            <FeedbackMessage
                type="error"
                message={errorMessage}
            />
        );
    }

    if (isLoading) {
        return (
            <div
                className="dashboard-summary-state"
                aria-busy="true"
            >
                {/* 로딩 중에도 실제 카드와 같은 개수를 유지하여 화면 흔들림을 줄입니다. */}
                <div
                    className="dashboard-summary-cards"
                    aria-hidden="true"
                >
                    {SUMMARY_ITEMS.map(item => (
                        <article
                            key={item.key}
                            className="dashboard-summary-card dashboard-summary-card--loading"
                        >
                            <span className="dashboard-summary-skeleton dashboard-summary-skeleton--label" />
                            <span className="dashboard-summary-skeleton dashboard-summary-skeleton--value" />
                        </article>
                    ))}
                </div>

                <p
                    className="dashboard-summary-status"
                    role="status"
                    aria-live="polite"
                >
                    작업 현황을 불러오는 중...
                </p>
            </div>
        );
    }

    if (!summaryData) {
        return (
            <FeedbackMessage
                type="error"
                message="작업 현황을 표시할 수 없습니다."
            />
        );
    }

    const isEmpty = SUMMARY_ITEMS.every(
        item => summaryData[item.key] === 0
    );

    return (
        <div className="dashboard-summary-state">
            <div className="dashboard-summary-cards">
                {SUMMARY_ITEMS.map(item => (
                    <article
                        key={item.key}
                        className="dashboard-summary-card"
                    >
                        <span className="dashboard-summary-card__label">
                            {item.label}
                        </span>

                        <strong className="dashboard-summary-card__value">
                            {summaryData[item.key].toLocaleString('ko-KR')}
                        </strong>
                    </article>
                ))}
            </div>

            {/* 빈 상태에서도 네 개의 0 카드는 유지하고 안내 문구만 보충합니다. */}
            {isEmpty && (
                <p
                    className="dashboard-summary-status"
                    role="status"
                >
                    현재 표시할 작업 현황이 없습니다.
                </p>
            )}
        </div>
    );
}

export default DashboardSummary;
