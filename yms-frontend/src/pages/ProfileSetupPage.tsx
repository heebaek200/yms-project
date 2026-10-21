import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import type { UserRole } from '../types/auth';
import { PROFESSIONAL_ROLE_OPTIONS } from '../professionalRoles';
import { isValidName } from '../utils/validation';
import './ProfileSetupPage.css';
import { getProfile, updateProfile } from '../api/users/profile';
import { useNavigate } from 'react-router';

/**
 * 현재 사용자의 기본 정보와 검색·소개에 사용할 전문 역할을 조회하고 수정합니다.
 * 저장 후 인증 사용자 정보를 갱신하고 SCR-03 Workspace 온보딩 진입점으로 이동합니다.
 */
function ProfileSetupPage() {
    const { user, updateUser } = useAuth();
    const navigate = useNavigate();

    const [isSettingUp, setIsSettingUp] = useState(false);  // submit 동작 중 액션 방지 처리
    const [setupError, setSetupError] = useState("");       // submit 동작 중 발생한 에러 메시지 처리


    // 필드
    const [name, setName] = useState(user?.name ?? '');
    const [selectedRoles, setSelectedRoles] = useState<UserRole[]>(
        user?.roles ?? []
    );
    const [nameError, setNameError] = useState('');

    const [nameFlash, setNameFlash] = useState(0);

    const [isLoading, setIsLoading] = useState(true);       // 초기 호출 동작 중 로딩

    useEffect(() => {
        /**
         * Profile API에서 기존 설정을 조회해 각 입력 상태의 초기값으로 반영합니다.
         * 조회 실패 시 편집 화면을 유지하면서 공통 오류 메시지를 표시합니다.
         */
        const loadProfile = async () => {
            try {
                const response = await getProfile();
                const data = response.data;

                setName(data.name);
                setSelectedRoles(data.roles);

            } catch (error) {
                console.error(error);

                setSetupError(
                    '프로필 정보를 불러올 수 없습니다.'
                );
            } finally {
                setIsLoading(false);
            }
        };

        loadProfile();
    }, []);
    if (isLoading) {
        return (
            <main className="setup-page">
                <p>설정 정보를 불러오는 중...</p>
            </main>
        );
    }

    // 역할이 하나라도 부여되어 있는지 체크
    const hasRole = selectedRoles.length > 0;
    /**
     * 선택한 전문 역할을 현재 역할 목록에서 추가하거나 제거합니다.
     * 복수 역할을 허용하되 동일한 역할은 한 번만 포함되도록 토글합니다.
     */
    const handleRoleChange = (role: UserRole) => {
        setSelectedRoles(prev =>
            prev.includes(role)
                ? prev.filter(item => item !== role)
                : [...prev, role]
        );
    };

    /**
     * 프로필 입력값을 검증하고 최신 Profile API 계약에 맞춘 요청을 전송합니다.
     * 성공 시 AuthContext를 갱신한 뒤 Workspace 선택·생성 온보딩으로 이동합니다.
     */
    const handleSetupSubmit = async (e: React.SubmitEvent<HTMLFormElement>) => {
        e.preventDefault();

        if (!hasRole || isSettingUp) {
            return;
        }

        let hasError = false;

        setNameError("");
        setSetupError("");

        if (!name.trim()) {
            setNameError("이름을 입력해 주세요.");
            setNameFlash((prev) => prev + 1);
            hasError = true;
        } else if (!isValidName(name)) {
            setNameError('이름은 2자 이상 50자 이하로 입력해 주세요.');
            setNameFlash(prev => prev + 1);
            hasError = true;
        }

        if (hasError) {
            return;
        }

        // 설정 저장 API 호출
        try {
            setIsSettingUp(true);

            const requestField = {
                name: name.trim(),
                roles: selectedRoles
            };

            const response = await updateProfile(requestField);

            if (!response.success) {
                if (
                    (response.errorCode === 'INVALID_INPUT_VALUE')
                    && response.errors
                ) {
                    let handled = false;

                    response.errors.forEach(error => {
                        if (error.field === 'name') {
                            setNameError(error.reason);
                            setNameFlash(prev => prev + 1);
                            handled = true;
                        }
                    });

                    if (!handled) {
                        setSetupError(response.message);
                    }

                    return;
                }

                setSetupError(response.message);
                return;
            }


            // 설정 저장 성공 시 계정 관련 정보 갱신
            updateUser({
                name: response.data.name,
                roles: response.data.roles,
                profileSetupRequired: false
            });

            // SCR-03 구현 전에도 저장 이후 목적지가 명확하도록 온보딩 경로 계약을 사용합니다.
            navigate('/workspaces');
        } catch (error) {
            console.error(error);

            setSetupError(
                '서버와 통신할 수 없습니다. 잠시 후 다시 시도해 주세요.'
            );
        } finally {
            setIsSettingUp(false);
        }
    };


    return (
        <main className="setup-page">
            <section className="setup-panel">
                <header className="setup-header">
                    <img
                        src="/icons/yms-icon-128x128.png"
                        alt="YMS"
                    />

                    <h1>프로필 설정</h1>
                </header>

                <form className="setup-form" onSubmit={handleSetupSubmit}>

                    <section className="setup-section">
                        <h2>기본 프로필 정보</h2>

                        <div className="form-field">
                            <label htmlFor="setup-email">
                                이메일
                            </label>

                            <input
                                id="setup-email"
                                type="email"
                                value={user?.email ?? ''}
                                readOnly
                            />
                        </div>

                        <div className={`form-field ${nameError
                            ? `form-field--error ${nameFlash % 2 === 0
                                ? "form-field--flash-a"
                                : "form-field--flash-b"
                            }`
                            : ""
                            }`}>
                            <label htmlFor="setup-name">
                                이름 / 닉네임
                            </label>

                            <input
                                id="setup-name"
                                type="text"
                                value={name}
                                required
                                minLength={2}
                                maxLength={50}
                                onChange={(e) => setName(e.target.value)}
                            />

                            {nameError && (
                                <p className="form-error">{nameError}</p>
                            )}
                        </div>
                    </section>

                    <section className="setup-section">
                        <h2>전문 역할 설정</h2>

                        <div className="role-options">
                            {PROFESSIONAL_ROLE_OPTIONS.map(role => (
                                <label key={role.value} className="role-option">
                                    <input
                                        type="checkbox"
                                        checked={selectedRoles.includes(role.value)}
                                        onChange={() => handleRoleChange(role.value)}
                                    />
                                    <span>{role.label}</span>
                                </label>
                            ))}
                        </div>

                        <p className="setup-role-guide">전문 역할은 멤버 검색과 소개에 사용되며 기능 권한을 바꾸지 않습니다.</p>
                    </section>

                    {!hasRole && (
                        <p className="form-hint">
                            하나 이상의 전문 역할을 선택해 주세요.
                        </p>
                    )}

                    {setupError && (
                        <p className="form-error">
                            {setupError}
                        </p>
                    )}

                    <button
                        type="submit"
                        className="setup-button"
                        disabled={isSettingUp || !hasRole}
                    >
                        {isSettingUp ? '저장 중...' : '설정 저장'}
                    </button>

                </form>

            </section>
        </main>
    );
}

export default ProfileSetupPage;
