import { useState } from 'react';
import './LoginPage.css';

type AuthTab = 'login' | 'signup';

function LoginPage() {
    const [activeTab, setActiveTab] = useState<AuthTab>('login');

    const [loginEmail, setLoginEmail] = useState("");
    const [loginPassword, setLoginPassword] = useState("");

    const [loginEmailError, setLoginEmailError] = useState("");
    const [loginPasswordError, setLoginPasswordError] = useState("");

    const [loginEmailFlash, setLoginEmailFlash] = useState(0);
    const [loginPasswordFlash, setLoginPasswordFlash] = useState(0);

    const handleLoginSubmit = (e: React.SubmitEvent<HTMLFormElement>) => {
        e.preventDefault();

        let hasError = false;

        setLoginEmailError("");
        setLoginPasswordError("");

        if (!loginEmail.trim()) {
            setLoginEmailError("이메일을 입력해 주세요.");
            setLoginEmailFlash((prev) => prev + 1);
            hasError = true;
        } else if (!isValidEmail(loginEmail)) {
            setLoginEmailError("올바른 이메일 형식으로 입력해 주세요.");
            setLoginEmailFlash((prev) => prev + 1);
            hasError = true;
        }

        if (!loginPassword.trim()) {
            setLoginPasswordError("비밀번호를 입력해 주세요.");
            setLoginPasswordFlash((prev) => prev + 1);
            hasError = true;
        } else if (!isValidPassword(loginPassword)) {
            setLoginPasswordError("비밀번호는 6자 이상 입력해 주세요.");
            setLoginPasswordFlash((prev) => prev + 1);
            hasError = true;
        }

        if (hasError) {
            return;
        }

        alert(`이메일: ${loginEmail}\n비밀번호: ${loginPassword}`);

        // TODO: 로그인 API 호출
    };


    const [signupEmail, setSignupEmail] = useState("");
    const [signupPassword, setSignupPassword] = useState("");
    const [signupPasswordConfirm, setSignupPasswordConfirm] = useState("");
    const [signupNickname, setSignupNickname] = useState("");

    const [signupEmailError, setSignupEmailError] = useState("");
    const [signupPasswordError, setSignupPasswordError] = useState("");
    const [signupPasswordConfirmError, setSignupPasswordConfirmError] = useState("");
    const [signupNicknameError, setSignupNicknameError] = useState("");

    const [signupEmailFlash, setSignupEmailFlash] = useState(0);
    const [signupPasswordFlash, setSignupPasswordFlash] = useState(0);
    const [signupPasswordConfirmFlash, setSignupPasswordConfirmFlash] = useState(0);
    const [signupNicknameFlash, setSignupNicknameFlash] = useState(0);

    const handleSignupSubmit = (e: React.SubmitEvent<HTMLFormElement>) => {
        e.preventDefault();

        let hasError = false;

        setSignupEmailError("");
        setSignupPasswordError("");
        setSignupPasswordConfirmError("");
        setSignupNicknameError("");

        if (!signupEmail.trim()) {
            setSignupEmailError("이메일을 입력해 주세요.");
            setSignupEmailFlash((prev) => prev + 1);
            hasError = true;
        } else if (!isValidEmail(signupEmail)) {
            setSignupEmailError("올바른 이메일 형식으로 입력해 주세요.");
            setSignupEmailFlash((prev) => prev + 1);
            hasError = true;
        }

        if (!signupPassword.trim()) {
            setSignupPasswordError("비밀번호를 입력해 주세요.");
            setSignupPasswordFlash((prev) => prev + 1);
            hasError = true;
        } else if (!isValidPassword(signupPassword)) {
            setSignupPasswordError("비밀번호는 6자 이상 입력해 주세요.");
            setSignupPasswordFlash((prev) => prev + 1);
            hasError = true;
        }

        if (signupPassword !== signupPasswordConfirm) {
            setSignupPasswordConfirmError("비밀번호가 일치하지 않습니다.");
            setSignupPasswordConfirmFlash((prev) => prev + 1);
            hasError = true;
        }

        if (!signupNickname.trim()) {
            setSignupNicknameError("이름 / 닉네임을 입력해 주세요.");
            setSignupNicknameFlash((prev) => prev + 1);
            hasError = true;
        }

        if (hasError) {
            return;
        }

        alert(`이메일: ${signupEmail}\n비밀번호: ${signupPassword}\n닉네임: ${signupNickname}`);

        // TODO: 회원가입 API 호출
    };

    const isValidEmail = (email: string) => {
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    };

    const isValidPassword = (password: string) => {
        return password.length >= 6;
    };

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
                    <form className="login-form" onSubmit={handleLoginSubmit}>
                        <div className={`form-field ${loginEmailError
                            ? `form-field--error ${loginEmailFlash % 2 === 0
                                ? "form-field--flash-a"
                                : "form-field--flash-b"
                            }`
                            : ""
                            }`}>
                            <label htmlFor="login-email">
                                이메일
                            </label>

                            <input
                                id="login-email"
                                type="email"
                                autoComplete="email"
                                placeholder="user@example.com"
                                value={loginEmail}
                                required
                                pattern="^[^\s@]+@[^\s@]+\.[^\s@]+$"
                                onChange={(e) => setLoginEmail(e.target.value)}
                            />

                            {loginEmailError && (
                                <p className="form-error">{loginEmailError}</p>
                            )}
                        </div>


                        <div className={`form-field ${loginPasswordError
                            ? `form-field--error ${loginPasswordFlash % 2 === 0
                                ? "form-field--flash-a"
                                : "form-field--flash-b"
                            }`
                            : ""
                            }`}>
                            <label htmlFor="login-password">
                                비밀번호
                            </label>

                            <input
                                id="login-password"
                                type="password"
                                autoComplete="current-password"
                                value={loginPassword}
                                required
                                minLength={6}
                                onChange={(e) => setLoginPassword(e.target.value)}
                            />

                            {loginPasswordError && (
                                <p className="form-error">{loginPasswordError}</p>
                            )}
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
                    <form className="login-form" onSubmit={handleSignupSubmit}>
                        <div className={`form-field ${signupEmailError
                            ? `form-field--error ${signupEmailFlash % 2 === 0
                                ? "form-field--flash-a"
                                : "form-field--flash-b"
                            }`
                            : ""
                            }`}>
                            <label htmlFor="signup-email">
                                이메일
                            </label>

                            <input
                                id="signup-email"
                                type="email"
                                autoComplete="email"
                                placeholder="user@example.com"
                                value={signupEmail}
                                required
                                pattern="^[^\s@]+@[^\s@]+\.[^\s@]+$"
                                onChange={(e) => setSignupEmail(e.target.value)}
                            />

                            {signupEmailError && (
                                <p className="form-error">{signupEmailError}</p>
                            )}
                        </div>

                        <div className={`form-field ${signupPasswordError
                            ? `form-field--error ${signupPasswordFlash % 2 === 0
                                ? "form-field--flash-a"
                                : "form-field--flash-b"
                            }`
                            : ""
                            }`}>
                            <label htmlFor="signup-password">
                                비밀번호
                            </label>

                            <input
                                id="signup-password"
                                type="password"
                                autoComplete="new-password"
                                value={signupPassword}
                                required
                                minLength={6}
                                onChange={(e) => setSignupPassword(e.target.value)}
                            />

                            {signupPasswordError && (
                                <p className="form-error">{signupPasswordError}</p>
                            )}
                        </div>

                        <div className={`form-field ${signupPasswordConfirmError
                            ? `form-field--error ${signupPasswordConfirmFlash % 2 === 0
                                ? "form-field--flash-a"
                                : "form-field--flash-b"
                            }`
                            : ""
                            }`}>
                            <label htmlFor="signup-password-confirm">
                                비밀번호 재입력
                            </label>

                            <input
                                id="signup-password-confirm"
                                type="password"
                                autoComplete="new-password"
                                value={signupPasswordConfirm}
                                required
                                minLength={6}
                                onChange={(e) => setSignupPasswordConfirm(e.target.value)}
                            />
                            {signupPasswordConfirmError && (
                                <p className="form-error">{signupPasswordConfirmError}</p>
                            )}
                        </div>

                        <div className={`form-field ${signupNicknameError
                            ? `form-field--error ${signupNicknameFlash % 2 === 0
                                ? "form-field--flash-a"
                                : "form-field--flash-b"
                            }`
                            : ""
                            }`}>
                            <label htmlFor="signup-nickname">
                                이름 / 닉네임
                            </label>

                            <input
                                id="signup-nickname"
                                type="text"
                                value={signupNickname}
                                required
                                onChange={(e) => setSignupNickname(e.target.value)}
                            />

                            {signupNicknameError && (
                                <p className="form-error">{signupNicknameError}</p>
                            )}
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