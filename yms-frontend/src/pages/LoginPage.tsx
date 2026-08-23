import { useState } from 'react';
import './LoginPage.css';
import LoginForm from '../components/auth/LoginForm';
import SignupForm from '../components/auth/SignupForm';

type AuthTab = 'login' | 'signup';

function LoginPage() {    
    const [activeTab, setActiveTab] = useState<AuthTab>('login');

    return (
        <main className="login-page">
            <section className="login-panel">
                <header className="login-header">
                    <img
                        src="/icons/yms-icon-128x128.png"
                        alt="YMS"
                    />

                    <h1>YMS</h1>
                    <p>영상 제작 프로젝트를 한곳에서 관리하세요.</p>
                </header>

                <nav
                    className="auth-tabs"
                    aria-label="인증 메뉴"
                >
                    <button
                        type="button"
                        className={
                            activeTab === 'login'
                                ? 'auth-tab active'
                                : 'auth-tab'
                        }
                        onClick={() => setActiveTab('login')}
                    >
                        로그인
                    </button>

                    <button
                        type="button"
                        className={
                            activeTab === 'signup'
                                ? 'auth-tab active'
                                : 'auth-tab'
                        }
                        onClick={() => setActiveTab('signup')}
                    >
                        회원가입
                    </button>
                </nav>

                {activeTab === 'login'
                    ? <LoginForm />
                    : <SignupForm />
                }

                <div className="auth-divider">
                    <span>또는</span>
                </div>

                <div className="social-login">
                    <button
                        type="button"
                        className="social-button google"
                        disabled
                    >
                        <span className="social-icon">G</span>
                        Google 계정으로 계속하기
                        <span className="coming-soon">
                            준비 중
                        </span>
                    </button>

                    <button
                        type="button"
                        className="social-button kakao"
                        disabled
                    >
                        <span className="social-icon">K</span>
                        Kakao 계정으로 계속하기
                        <span className="coming-soon">
                            준비 중
                        </span>
                    </button>
                </div>
            </section>
        </main>
    );
}

export default LoginPage;