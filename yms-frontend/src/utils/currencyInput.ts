const WON_UNIT_PATTERN = /\s*원\s*$/;
const WON_PER_VIEW_UNIT_PATTERN = /\s*원(?:\s*\/\s*조회)?\s*$/;

export type NumericNormalizationResult =
    | { success: true; value: string }
    | { success: false; reason: 'INVALID_FORMAT' | 'INTEGER_DIGITS_EXCEEDED' };

interface NumericNormalizationOptions {
    maxFractionDigits: number;
    fixedScale?: number;
    maxIntegerDigits?: number;
    allowEmpty?: boolean;
    allowPerViewUnit?: boolean;
}

/**
 * 금액·단가 입력 끝의 선택적 원 표기를 제거해 각 숫자 정규화 함수에 전달합니다.
 * 조회당 단가는 `원/조회`까지 허용하고 일반 금액은 `원`만 제거합니다.
 */
export function stripOptionalWonUnit(value: string, allowPerView = false): string {
    const pattern = allowPerView ? WON_PER_VIEW_UNIT_PATTERN : WON_UNIT_PATTERN;
    return value.trim().replace(pattern, '');
}

/**
 * 단가와 금액 입력에 공통으로 적용할 숫자 표기를 검증하고 숫자 문자열로 정규화합니다.
 * 선택적 원 단위, 올바른 천 단위 쉼표, 앞자리 0과 소수점 끝 입력을 한 규칙으로 처리하며
 * 각 도메인의 소수 자릿수와 정수부 한도만 옵션으로 구분합니다.
 */
export function normalizeUnsignedNumericInput(
    value: string,
    options: NumericNormalizationOptions
): NumericNormalizationResult {
    const amountWithoutUnit = stripOptionalWonUnit(
        value,
        options.allowPerViewUnit
    );

    if (!amountWithoutUnit && options.allowEmpty) {
        return { success: true, value: '' };
    }

    // 쉼표가 있다면 첫 묶음 이후 정확히 세 자리씩 입력된 경우만 허용합니다.
    const inputPattern = new RegExp(
        `^(?:\\d+|\\d{1,3}(?:,\\d{3})+)(?:\\.\\d{0,${options.maxFractionDigits}})?$`
    );
    if (!inputPattern.test(amountWithoutUnit)) {
        return { success: false, reason: 'INVALID_FORMAT' };
    }

    const [rawIntegerPart, rawFractionPart = ''] = amountWithoutUnit
        .replaceAll(',', '')
        .split('.');
    const integerPart = rawIntegerPart.replace(/^0+(?=\d)/, '');

    if (options.maxIntegerDigits && integerPart.length > options.maxIntegerDigits) {
        return { success: false, reason: 'INTEGER_DIGITS_EXCEEDED' };
    }

    // 고정 소수점 금액은 저장 규격까지 채우고 단가는 사용자가 입력한 정밀도를 보존합니다.
    if (options.fixedScale !== undefined) {
        return {
            success: true,
            value: `${integerPart}.${rawFractionPart.padEnd(options.fixedScale, '0')}`
        };
    }

    return {
        success: true,
        value: rawFractionPart ? `${integerPart}.${rawFractionPart}` : integerPart
    };
}
