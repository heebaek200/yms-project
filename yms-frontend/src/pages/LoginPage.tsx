import { useState } from 'react';
import './LoginPage.css';
import { login } from '../api/auth/login';
import { signup } from '../api/auth/signup';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router';

type AuthTab = 'login' | 'signup';

function LoginPage() {
    const { signIn } = useAuth();
    const navigate = useNavigate();
    
    const [activeTab, setActiveTab] = useState<AuthTab>('login');

    const [isLoggingIn, setIsLoggingIn] = useState(false);
    const [loginError, setLoginError] = useState("");

    const [loginEmail, setLoginEmail] = useState("");
    const [loginPassword, setLoginPassword] = useState("");

    const [loginEmailError, setLoginEmailError] = useState("");
    const [loginPasswordError, setLoginPasswordError] = useState("");

    const [loginEmailFlash, setLoginEmailFlash] = useState(0);
    const [loginPasswordFlash, setLoginPasswordFlash] = useState(0);

    const handleLoginSubmit = async (e: React.SubmitEvent<HTMLFormElement>) => {
        e.preventDefault();

        // 이미 로그인 요청 중이면 추가 요청 차단
        if (isLoggingIn) {
            return;
        }

        let hasError = false;

        setLoginEmailError("");
        setLoginPasswordError("");
        setLoginError("");

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

        // 로그인 API 호출
        try {
            setIsLoggingIn(true);

            const response = await login({
                email: loginEmail,
                password: loginPassword
            });

            if (!response.success) {
                if (
                    response.errorCode === 'INVALID_INPUT_VALUE' &&
                    response.errors
                ) {
                    let handled = false;

                    response.errors.forEach(error => {
                        if (error.field === 'email') {
                            setLoginEmailError(error.reason);
                            setLoginEmailFlash(prev => prev + 1);
                            handled = true;
                        }

                        if (error.field === 'password') {
                            setLoginPasswordError(error.reason);
                            setLoginPasswordFlash(prev => prev + 1);
                            handled = true;
                        }
                    });

                    if (!handled) {
                        setLoginError(response.message);
                    }

                    return;
                }

                setLoginError(response.message);
                return;
            }

            // 로그인 성공 시 인증 정보 저장
            signIn(response.data);

            // 로그인 후 메인 페이지 재이동
            navigate('/');

        } catch (error) {
            console.error(error);

            setLoginError(
                '서버와 통신할 수 없습니다. 잠시 후 다시 시도해 주세요.'
            );
        } finally {
            setIsLoggingIn(false);
        }
    };

    const [isSigningUp, setIsSigningUp] = useState(false);
    const [signupError, setSignupError] = useState("");

    const [signupEmail, setSignupEmail] = useState("");
    const [signupPassword, setSignupPassword] = useState("");
    const [signupPasswordConfirm, setSignupPasswordConfirm] = useState("");
    const [signupName, setSignupName] = useState("");

    const [signupEmailError, setSignupEmailError] = useState("");
    const [signupPasswordError, setSignupPasswordError] = useState("");
    const [signupPasswordConfirmError, setSignupPasswordConfirmError] = useState("");
    const [signupNameError, setSignupNameError] = useState("");

    const [signupEmailFlash, setSignupEmailFlash] = useState(0);
    const [signupPasswordFlash, setSignupPasswordFlash] = useState(0);
    const [signupPasswordConfirmFlash, setSignupPasswordConfirmFlash] = useState(0);
    const [signupNameFlash, setSignupNameFlash] = useState(0);

    const handleSignupSubmit = async (e: React.SubmitEvent<HTMLFormElement>) => {
        e.preventDefault();

        if (isSigningUp) {
            return;
        }

        let hasError = false;

        setSignupEmailError("");
        setSignupPasswordError("");
        setSignupPasswordConfirmError("");
        setSignupNameError("");
        setSignupError("");

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

        if (!signupName.trim()) {
            setSignupNameError("이름을 입력해 주세요.");
            setSignupNameFlash((prev) => prev + 1);
            hasError = true;
        }

        if (hasError) {
            return;
        }

        // 회원가입 API 호출
        try {
            setIsSigningUp(true);

            const response = await signup({
                email: signupEmail,
                password: signupPassword,
                name: signupName
            });

            if (!response.success) {
                if (
                    (response.errorCode === 'INVALID_INPUT_VALUE' || response.errorCode === 'DUPLICATE_EMAIL')
                    && response.errors
                ) {
                    let handled = false;

                    response.errors.forEach(error => {
                        if (error.field === 'email') {
                            setSignupEmailError(error.reason);
                            setSignupEmailFlash(prev => prev + 1);
                            handled = true;
                        }

                        if (error.field === 'password') {
                            setSignupPasswordError(error.reason);
                            setSignupPasswordFlash(prev => prev + 1);
                            handled = true;
                        }

                        if (error.field === 'name') {
                            setSignupNameError(error.reason);
                            setSignupNameFlash(prev => prev + 1);
                            handled = true;
                        }
                    });

                    if (!handled) {
                        setSignupError(response.message);
                    }

                    return;
                }

                setSignupError(response.message);
                return;
            }

            // 로그인 성공 시 인증 정보 저장
            signIn(response.data);

            // 로그인 후 메인 페이지 재이동
            navigate('/');
        } catch (error) {
            console.error(error);

            setSignupError(
                '서버와 통신할 수 없습니다. 잠시 후 다시 시도해 주세요.'
            );
        } finally {
            setIsSigningUp(false);
        }
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

                        {loginError && (
                            <p className="form-error">
                                {loginError}
                            </p>
                        )}

                        <button
                            type="submit"
                            className="login-button"
                            disabled={isLoggingIn}
                        >
                            {isLoggingIn ? '로그인 중...' : '로그인'}
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

                        <div className={`form-field ${signupNameError
                            ? `form-field--error ${signupNameFlash % 2 === 0
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
                                value={signupName}
                                required
                                onChange={(e) => setSignupName(e.target.value)}
                            />

                            {signupNameError && (
                                <p className="form-error">{signupNameError}</p>
                            )}
                        </div>

                        {signupError && (
                            <p className="form-error">
                                {signupError}
                            </p>
                        )}

                        <button
                            type="submit"
                            className="login-button"
                            disabled={isSigningUp}
                        >
                            {isSigningUp ? '가입 중...' : '회원가입'}
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