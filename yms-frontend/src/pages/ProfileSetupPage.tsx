import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import type { UserRole, RateScope } from '../types/auth';
import { isValidName, validateRate } from '../utils/validation';
import { formatRate, normalizeRateInput } from '../utils/format';
import './ProfileSetupPage.css';
import { getProfile, updateProfile } from '../api/users/profile';
import { useNavigate } from 'react-router';

/**
 * 현재 사용자의 기본 정보, 전문 역할과 CREATOR 기본 수익 단가를 조회하고 수정합니다.
 * CREATOR 단가 미입력은 문자열 "0"으로 정규화하며 변경 적용 범위를 함께 전달합니다.
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
    const isCreator = selectedRoles.includes('CREATOR');

    const [longFormRate, setLongFormRate] = useState('');
    const [shortFormRate, setShortFormRate] = useState('');
    const [rateScope, setRateScope] = useState<RateScope>('FUTURE_ONLY');

    const [nameError, setNameError] = useState('');
    const [longFormRateError, setLongFormRateError] = useState('');
    const [shortFormRateError, setShortFormRateError] = useState('');

    const [nameFlash, setNameFlash] = useState(0);
    const [longFormRateFlash, setLongFormRateFlash] = useState(0);
    const [shortFormRateFlash, setShortFormRateFlash] = useState(0);

    const [isLoading, setIsLoading] = useState(true);       // 초기 호출 동작 중 로딩

    useEffect(() => {
        /**
         * Profile API에서 기존 설정을 조회해 각 입력 상태의 초기값으로 반영합니다.
         * 아직 단가를 설정하지 않은 사용자의 null 값은 빈 입력으로 보여 줍니다.
         * 조회 실패 시 편집 화면을 유지하면서 공통 오류 메시지를 표시합니다.
         */
        const loadProfile = async () => {
            try {
                const response = await getProfile();
                const data = response.data;

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
     * CREATOR 포함 여부는 단가 입력 영역의 표시와 저장 요청 구성에 사용됩니다.
     */
    const handleRoleChange = (role: UserRole) => {
        setSelectedRoles(prev =>
            prev.includes(role)
                ? prev.filter(item => item !== role)
                : [...prev, role]
        );
    };

    /**
     * 단가 입력란이 포커스를 잃으면 사람이 입력한 원 단위를 API용 문자열로 정리합니다.
     * 유효한 입력은 콤마와 단위를 제거해 화면에 반영하고 기존 오류를 해제합니다.
     * 잘못된 입력은 원문을 유지하여 사용자가 직접 수정할 수 있도록 오류만 표시합니다.
     */
    const handleRateBlur = (
        value: string,
        setValue: (nextValue: string) => void,
        setError: (message: string) => void
    ) => {
        const result = normalizeRateInput(value);

        if (!result.success) {
            setError(result.message);
            return;
        }

        setValue(result.value);
        setError('');
    };

    /**
     * 프로필 입력값을 검증하고 최신 Profile API 계약에 맞춘 요청을 전송합니다.
     * CREATOR의 빈 단가는 문자열 "0"으로 바꾸고 선택한 적용 범위를 함께 전달합니다.
     * 성공 시 AuthContext를 갱신한 뒤 Workspace 선택·생성 온보딩으로 이동합니다.
     */
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
            setNameError('이름은 2자 이상 50자 이하로 입력해 주세요.');
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

            const response = await updateProfile(requestField);

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
                        className={`setup-section creator-rate-section ${isCreator
                                ? 'creator-rate-section--open'
                                : ''
                            }`}
                    >
                        <h2>크리에이터 기본 단가 설정</h2>

                        <aside
                            className="rate-guide"
                            aria-label="초보자 단가 참고 안내"
                        >
                            <p>처음 설정할 때 참고할 수 있는 예시입니다.</p>
                            <strong>
                                롱폼 약 3.00원/조회 · 쇼츠 약 0.20원/조회
                            </strong>
                            <p>채널과 콘텐츠에 따라 실제 수익은 달라질 수 있습니다.</p>
                        </aside>

                        <div className={`form-field ${longFormRateError
                            ? `form-field--error ${longFormRateFlash % 2 === 0
                                ? "form-field--flash-a"
                                : "form-field--flash-b"
                            }`
                            : ""
                            }`}>
                            <label htmlFor="long-form-rate">
                                롱폼 조회수 1회당 기본 수익 단가
                            </label>

                            <div className="rate-input">
                                <input
                                    id="long-form-rate"
                                    type="text"
                                    inputMode="decimal"
                                    value={longFormRate}
                                    onChange={(e) => setLongFormRate(e.target.value)}
                                    onBlur={() => handleRateBlur(
                                        longFormRate,
                                        setLongFormRate,
                                        setLongFormRateError
                                    )}
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
                                쇼츠 조회수 1회당 기본 수익 단가
                            </label>

                            <div className="rate-input">
                                <input
                                    id="short-form-rate"
                                    type="text"
                                    inputMode="decimal"
                                    value={shortFormRate}
                                    onChange={(e) => setShortFormRate(e.target.value)}
                                    onBlur={() => handleRateBlur(
                                        shortFormRate,
                                        setShortFormRate,
                                        setShortFormRateError
                                    )}
                                    disabled={!isCreator}
                                />

                                <span>원</span>
                            </div>

                            {shortFormRateError && (
                                <p className="form-error">{shortFormRateError}</p>
                            )}
                        </div>

                        <p className="form-hint">
                            단가를 입력하지 않으면 0원으로 저장됩니다.
                        </p>

                        <div className="form-field">
                            <span className="form-label">
                                단가 변경 적용 범위
                            </span>

                            <label className="scope-option">
                                <input
                                    type="radio"
                                    name="rate-scope"
                                    value="FUTURE_ONLY"
                                    checked={rateScope === 'FUTURE_ONLY'}
                                    onChange={() => setRateScope('FUTURE_ONLY')}
                                    disabled={!isCreator}
                                />
                                향후 생성되는 프로젝트에만 적용
                            </label>

                            <label className="scope-option">
                                <input
                                    type="radio"
                                    name="rate-scope"
                                    value="INCLUDE_UNFINALIZED"
                                    checked={rateScope === 'INCLUDE_UNFINALIZED'}
                                    onChange={() => setRateScope('INCLUDE_UNFINALIZED')}
                                    disabled={!isCreator}
                                />
                                기존 미확정 프로젝트에도 적용
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
