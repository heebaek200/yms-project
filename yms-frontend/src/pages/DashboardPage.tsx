import './DashboardPage.css';
import DashboardSummary from '../components/dashboard/Summary';
import DashboardSchedule from '../components/dashboard/Schedule';
import DashboardNotifications from '../components/dashboard/Notifications';

function DashboardPage() {

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
                    <DashboardSummary />
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
                    {/* DashboardFilter 컴포넌트 예정 */}
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
                    <DashboardSchedule />
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