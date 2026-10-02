import { normalizeRateInput } from './format';

const isValidEmail = (email: string) => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
};

const isValidPassword = (password: string) => {
    return password.length >= 6;
};

const isValidName = (name: string) => {
    const trimmed = name.trim();

    return trimmed.length >= 2
        && trimmed.length <= 50;
};

/**
 * 조회수 1회당 수익 단가가 REST API의 문자열 제약을 충족하는지 확인합니다.
 * 미입력 값은 저장 시 문자열 "0"으로 정규화하므로 유효한 입력으로 취급합니다.
 * 입력된 값은 0 이상의 정수 또는 소수점 이하 최대 6자리 숫자여야 합니다.
 */
const validateRate = (value: string) => {
    const result = normalizeRateInput(value);

    return result.success ? '' : result.message;
};

export { isValidEmail, isValidPassword, isValidName, validateRate };
