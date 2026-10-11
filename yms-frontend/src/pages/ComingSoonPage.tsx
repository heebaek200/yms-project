import { useNavigate } from 'react-router';

import './FeatureStatePage.css';

type ComingSoonPageProps = {
    featureName: string;
};

/**
 * 업무 Route와 Header 동작을 실제 화면보다 먼저 검증할 수 있는 준비 중 화면입니다.
 * 영상 제작 서비스의 분위기를 살린 안내와 Dashboard 복귀 동작을 제공합니다.
 * 공통 AppLayout 안에서 렌더링되어 다른 메뉴로도 즉시 이동할 수 있습니다.
 */
function ComingSoonPage({ featureName }: ComingSoonPageProps) {
    const navigate = useNavigate();

    return (
        <section
            className="feature-state"
            aria-labelledby="coming-soon-title"
        >
            <div
                className="feature-state__art"
                aria-hidden="true"
            >
                🎬
            </div>

            <p className="feature-state__eyebrow">
                COMING SOON
            </p>

            <h1 id="coming-soon-title">
                {featureName}, 지금 열심히 편집 중이에요
            </h1>

            <p className="feature-state__description">
                메뉴와 가는 길은 먼저 열어 두었어요.<br />
                완성되는 대로 멋지게 선보일게요.
            </p>

            <button
                type="button"
                className="feature-state__button feature-state__button--primary"
                onClick={() => navigate('/dashboard')}
            >
                대시보드로 이동
            </button>
        </section>
    );
}

export default ComingSoonPage;
