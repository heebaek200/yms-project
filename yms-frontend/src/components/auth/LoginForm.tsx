import { useState } from 'react';
import '../../pages/LoginPage.css';
import { useNavigate } from 'react-router';
import { isValidEmail, isValidPassword } from '../../utils/validation';
import { login } from '../../api/auth/login';
import { useAuth } from '../../contexts/AuthContext';

function LoginForm() {
    const { signIn } = useAuth();
    const navigate = useNavigate();

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

    return (
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
    );
}

export default LoginForm;