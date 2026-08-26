import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import type { UserRole, RateScope } from '../types/auth';
import { isValidName, validateRate } from '../utils/validation';
import { formatRate } from '../utils/format';
import './ProfileSetupPage.css';
import { getProfileSetup, setupProfile } from '../api/auth/profilesetup';
import { useNavigate } from 'react-router';

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
    const isCreator = selectedRoles.includes('CREATOR');

    const [longFormRate, setLongFormRate] = useState('');
    const [shortFormRate, setShortFormRate] = useState('');
    const [rateScope, setRateScope] = useState<RateScope>('future');

    const [nameError, setNameError] = useState('');
    const [longFormRateError, setLongFormRateError] = useState('');
    const [shortFormRateError, setShortFormRateError] = useState('');

    const [nameFlash, setNameFlash] = useState(0);
    const [longFormRateFlash, setLongFormRateFlash] = useState(0);
    const [shortFormRateFlash, setShortFormRateFlash] = useState(0);

    const [isLoading, setIsLoading] = useState(true);       // 초기 호출 동작 중 로딩

    useEffect(() => {
        const loadProfileSetup = async () => {
            try {
                const data = await getProfileSetup();

                setName(data.name);
                setSelectedRoles(data.roles);

                setLongFormRate(
                    data.longFormRate ?? ''
                );

                setShortFormRate(
                    data.shortFormRate ?? ''
                );

            } catch (error) {
                console.error(error);

                setSetupError(
                    '프로필 정보를 불러올 수 없습니다.'
                );
            } finally {
                setIsLoading(false);
            }
        };

        loadProfileSetup();
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
    const handleRoleChange = (role: UserRole) => {
        setSelectedRoles(prev =>
            prev.includes(role)
                ? prev.filter(item => item !== role)
                : [...prev, role]
        );
    };

    const handleSetupSubmit = async (e: React.SubmitEvent<HTMLFormElement>) => {
        e.preventDefault();

        if (!hasRole || isSettingUp) {
            return;
        }

        let hasError = false;

        setNameError("");
        setLongFormRateError("");
        setShortFormRateError("");
        setSetupError("");

        if (!name.trim()) {
            setNameError("이름을 입력해 주세요.");
            setNameFlash((prev) => prev + 1);
            hasError = true;
        } else if (!isValidName(name)) {
            setNameError('이름은 2자 이상 100자 이하로 입력해 주세요.');
            setNameFlash(prev => prev + 1);
            hasError = true;
        }

        // 크리에이터 역할일 경우 단가 처리
        if (isCreator) {
            const longRateError = validateRate(longFormRate);
            const shortRateError = validateRate(shortFormRate);

            if (longRateError) {
                setLongFormRateError(longRateError);
                setLongFormRateFlash(prev => prev + 1);
                hasError = true;
            }

            if (shortRateError) {
                setShortFormRateError(shortRateError);
                setShortFormRateFlash(prev => prev + 1);
                hasError = true;
            }
        }

        if (hasError) {
            return;
        }

        // 단가 포맷 처리
        let normalizedLongFormRate: string | undefined;
        let normalizedShortFormRate: string | undefined;

        if (isCreator) {
            // 단가 정규화
            normalizedLongFormRate = formatRate(longFormRate);
            normalizedShortFormRate = formatRate(shortFormRate);
            setLongFormRate(normalizedLongFormRate);
            setShortFormRate(normalizedShortFormRate);
        }

        // 설정 저장 API 호출
        try {
            setIsSettingUp(true);

            const requestField = isCreator ? {
                name: name.trim(),
                roles: selectedRoles,
                longFormRate: normalizedLongFormRate!,
                shortFormRate: normalizedShortFormRate!,
                rateScope: rateScope
            } : {
                name: name.trim(),
                roles: selectedRoles
            };

            const response = await setupProfile(requestField);

            if (!response.success) {
                if (
                    (response.errorCode === 'INVALID_INPUT_VALUE')
                    && response.errors
                ) {
                    let handled = false;

                    response.errors.forEach(error => {
                        if (error.field === 'longFormRate') {
                            setLongFormRateError(error.reason);
                            setLongFormRateFlash(prev => prev + 1);
                            handled = true;
                        }

                        if (error.field === 'shortFormRate') {
                            setShortFormRateError(error.reason);
                            setShortFormRateFlash(prev => prev + 1);
                            handled = true;
                        }

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
                roles: response.data.roles
            });

            // 설정 저장 후 메인 페이지 재이동
            navigate('/');
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

                    <h1>프로필 및 채널 설정</h1>
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
                                maxLength={100}
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

                            <label className="role-option">
                                <input
                                    type="checkbox"
                                    checked={selectedRoles.includes('CREATOR')}
                                    onChange={() => handleRoleChange('CREATOR')}
                                />
                                <span>크리에이터</span>
                            </label>

                            <label className="role-option">
                                <input
                                    type="checkbox"
                                    checked={selectedRoles.includes('EDITOR')}
                                    onChange={() => handleRoleChange('EDITOR')}
                                />
                                <span>영상 편집자</span>
                            </label>

                            <label className="role-option">
                                <input
                                    type="checkbox"
                                    checked={selectedRoles.includes('THUMBNAILER')}
                                    onChange={() => handleRoleChange('THUMBNAILER')}
                                />
                                <span>섬네일 디자이너</span>
                            </label>

                        </div>
                    </section>

                    <section
                        className={`setup-section creator-rate-section ${selectedRoles.includes('CREATOR')
                                ? 'creator-rate-section--open'
                                : ''
                            }`}
                    >
                        <h2>크리에이터 기본 단가 설정</h2>

                        <div className={`form-field ${longFormRateError
                            ? `form-field--error ${longFormRateFlash % 2 === 0
                                ? "form-field--flash-a"
                                : "form-field--flash-b"
                            }`
                            : ""
                            }`}>
                            <label htmlFor="long-form-rate">
                                롱폼 기본 단가
                            </label>

                            <div className="rate-input">
                                <input
                                    id="long-form-rate"
                                    type="text"
                                    inputMode="decimal"
                                    value={longFormRate}
                                    onChange={(e) => setLongFormRate(e.target.value)}
                                    onBlur={() => {
                                        if (!validateRate(longFormRate)) {
                                            setLongFormRate(formatRate(longFormRate));
                                        }
                                    }}
                                    placeholder="3.00"
                                    disabled={!isCreator}
                                />

                                <span>원</span>
                            </div>

                            {longFormRateError && (
                                <p className="form-error">{longFormRateError}</p>
                            )}
                        </div>

                        <div className={`form-field ${shortFormRateError
                            ? `form-field--error ${shortFormRateFlash % 2 === 0
                                ? "form-field--flash-a"
                                : "form-field--flash-b"
                            }`
                            : ""
                            }`}>
                            <label htmlFor="short-form-rate">
                                숏폼 기본 단가
                            </label>

                            <div className="rate-input">
                                <input
                                    id="short-form-rate"
                                    type="text"
                                    inputMode="decimal"
                                    value={shortFormRate}
                                    onChange={(e) => setShortFormRate(e.target.value)}
                                    onBlur={() => {
                                        if (!validateRate(shortFormRate)) {
                                            setShortFormRate(formatRate(shortFormRate));
                                        }
                                    }}
                                    placeholder="0.20"
                                    disabled={!isCreator}
                                />

                                <span>원</span>
                            </div>

                            {shortFormRateError && (
                                <p className="form-error">{shortFormRateError}</p>
                            )}
                        </div>

                        <div className="form-field">
                            <span className="form-label">
                                단가 변경 적용 범위
                            </span>

                            <label className="scope-option">
                                <input
                                    type="radio"
                                    name="rate-scope"
                                    value="future"
                                    checked={rateScope === 'future'}
                                    onChange={() => setRateScope('future')}
                                    disabled={!isCreator}
                                />
                                앞으로 새롭게 마감/동기화할 프로젝트부터 적용
                            </label>

                            <label className="scope-option">
                                <input
                                    type="radio"
                                    name="rate-scope"
                                    value="all"
                                    checked={rateScope === 'all'}
                                    onChange={() => setRateScope('all')}
                                    disabled={!isCreator}
                                />
                                기존 완료 프로젝트까지 새 단가를 소급 적용
                            </label>
                        </div>
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