import { useState } from 'react';
import './LoginPage.css';

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

                {activeTab === 'login' && (
                    <form className="login-form">
                        <div className="form-field">
                            <label htmlFor="email">
                                이메일
                            </label>

                            <input
                                id="email"
                                type="email"
                                autoComplete="email"
                                placeholder="user@example.com"
                            />

                            {/* 검증 구현 후 출력 */}
                            <p className="field-error">
                                {/* 올바른 이메일 형식이 아닙니다. */}
                            </p>
                        </div>

                        <div className="form-field">
                            <label htmlFor="password">
                                비밀번호
                            </label>

                            <input
                                id="password"
                                type="password"
                                autoComplete="current-password"
                            />

                            <p className="field-error">
                                {/* 비밀번호는 8자 이상이어야 합니다. */}
                            </p>
                        </div>

                        <button
                            type="submit"
                            className="login-button"
                        >
                            로그인
                        </button>
                    </form>
                )}

                {activeTab === 'signup' && (
                    <form className="login-form">
                        <div className="form-field">
                            <label htmlFor="signup-email">
                                이메일
                            </label>

                            <input
                                id="signup-email"
                                type="email"
                                autoComplete="email"
                                placeholder="user@example.com"
                            />

                            <p className="field-error">
                                {/* 올바른 이메일 형식이 아닙니다. */}
                            </p>
                        </div>

                        <div className="form-field">
                            <label htmlFor="signup-password">
                                비밀번호
                            </label>

                            <input
                                id="signup-password"
                                type="password"
                                autoComplete="new-password"
                            />
                        </div>

                        <div className="form-field">
                            <label htmlFor="password-confirm">
                                비밀번호 재입력
                            </label>

                            <input
                                id="password-confirm"
                                type="password"
                                autoComplete="new-password"
                            />
                        </div>

                        <div className="form-field">
                            <label htmlFor="nickname">
                                이름 / 닉네임
                            </label>

                            <input
                                id="nickname"
                                type="text"
                            />
                        </div>

                        <button
                            type="submit"
                            className="login-button"
                        >
                            회원가입
                        </button>
                    </form>
                )}

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