import { useNavigate } from 'react-router';
import './NotFoundPage.css';

function NotFoundPage() {
    const navigate = useNavigate();

    return (
        <main className="not-found-page">
            <section className="not-found-panel">

                <div
                    className="not-found-player"
                    aria-hidden="true"
                >
                    <div className="not-found-player__screen">
                        <div className="not-found-glitch">
                            <span className="not-found-play">
                                ▶
                            </span>

                            <span className="not-found-slash">
                                /
                            </span>
                        </div>
                    </div>

                    <div className="not-found-player__bar">
                        <span />
                        <span />
                        <span />
                    </div>
                </div>

                <div className="not-found-code">
                    <span>4</span>
                    <span className="not-found-code__glitch">
                        0
                    </span>
                    <span>4</span>
                </div>

                <h1>
                    이 장면은 찾을 수 없습니다.
                </h1>

                <p>
                    주소가 잘못되었거나
                    페이지가 이동했을 수 있습니다.
                </p>

                <button
                    type="button"
                    className="not-found-button"
                    onClick={() => navigate('/')}
                >
                    YMS로 돌아가기
                </button>

            </section>
        </main>
    );
}

export default NotFoundPage;