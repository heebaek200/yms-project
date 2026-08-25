const isValidEmail = (email: string) => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
};

const isValidPassword = (password: string) => {
    return password.length >= 6;
};

const isValidName = (name: string) => {
    const trimmed = name.trim();

    return trimmed.length >= 2
        && trimmed.length <= 100;
};

// 단가 validation
const validateRate = (value: string) => {
    const trimmed = value.trim();

    if (!trimmed) {
        return '단가를 입력해 주세요.';
    }

    if (!/^\d+(\.\d{1,2})?$/.test(trimmed)) {
        return '단가는 소수점 둘째 자리까지의 숫자로 입력해 주세요.';
    }

    const number = Number(trimmed);

    if (number < 0 || number > 999.99) {
        return '단가는 0.00 이상 999.99 이하로 입력해 주세요.';
    }

    return '';
};

export { isValidEmail, isValidPassword, isValidName, validateRate };