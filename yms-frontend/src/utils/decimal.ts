import { normalizeUnsignedNumericInput } from './currencyInput';

export type MoneyNormalizationResult =
    | { success: true; value: string }
    | { success: false; message: string };

const MONEY_SCALE = 2;
const ROI_SCALE = 6;
const MAX_MONEY_INTEGER_DIGITS = 13;
const DECIMAL_PATTERN = /^(-?)(\d+)(?:\.(\d+))?$/;

/** 10의 양의 정수 거듭제곱을 bigint로 만들어 고정 소수점 자릿수를 맞춥니다. */
function powerOfTen(scale: number): bigint {
    return 10n ** BigInt(scale);
}

/** 검증된 소수 문자열을 지정 자릿수의 정수로 변환해 부동소수점 오차를 피합니다. */
function toScaledInteger(value: string, scale: number): bigint {
    const match = DECIMAL_PATTERN.exec(value);
    if (!match) {
        throw new Error(`올바르지 않은 소수 문자열입니다: ${value}`);
    }

    const [, sign, integerPart, fractionPart = ''] = match;
    if (fractionPart.length > scale) {
        throw new Error(`허용 소수 자릿수를 초과했습니다: ${value}`);
    }

    const scaled = BigInt(integerPart) * powerOfTen(scale)
        + BigInt(fractionPart.padEnd(scale, '0') || '0');
    return sign === '-' ? -scaled : scaled;
}

/** 고정 소수점 정수를 JSON 응답에 사용할 소수 문자열로 되돌립니다. */
function fromScaledInteger(value: bigint, scale: number): string {
    const isNegative = value < 0n;
    const absoluteValue = isNegative ? -value : value;
    const divisor = powerOfTen(scale);
    const integerPart = absoluteValue / divisor;
    const fractionPart = (absoluteValue % divisor).toString().padStart(scale, '0');
    const sign = isNegative ? '-' : '';

    return scale === 0
        ? `${sign}${integerPart}`
        : `${sign}${integerPart}.${fractionPart}`;
}

/** 정수 나눗셈의 나머지를 절댓값 기준으로 반올림합니다. */
function divideRounded(dividend: bigint, divisor: bigint): bigint {
    const quotient = dividend / divisor;
    const remainder = dividend % divisor;
    const absoluteRemainder = remainder < 0n ? -remainder : remainder;
    const absoluteDivisor = divisor < 0n ? -divisor : divisor;

    if (absoluteRemainder * 2n < absoluteDivisor) {
        return quotient;
    }

    return quotient + (dividend < 0n === divisor < 0n ? 1n : -1n);
}

/** 사용자 금액 입력을 DECIMAL(15,2)에 맞는 부호 없는 문자열로 정규화합니다. */
export function normalizeMoneyInput(value: string): MoneyNormalizationResult {
    return normalizeMoney(value, true);
}

/** 금액 입력을 저장 자릿수를 덧붙이지 않고 사용자가 입력한 정밀도로 정규화합니다. */
export function normalizeEditableMoneyInput(value: string): MoneyNormalizationResult {
    return normalizeMoney(value, false);
}

/** 저장된 금액을 입력 필드에 표시할 때 의미 없는 소수부 0을 제거합니다. */
export function toEditableMoneyValue(value: string): string {
    const [integerPart, fractionPart = ''] = value.split('.');
    const visibleFraction = fractionPart.replace(/0+$/, '');
    return visibleFraction ? `${integerPart}.${visibleFraction}` : integerPart;
}

/** 금액 공통 규칙을 적용하고 저장 경계 여부에 따라 고정 소수점 변환을 선택합니다. */
function normalizeMoney(value: string, forStorage: boolean): MoneyNormalizationResult {
    const result = normalizeUnsignedNumericInput(value, {
        maxFractionDigits: MONEY_SCALE,
        ...(forStorage ? { fixedScale: MONEY_SCALE } : {}),
        maxIntegerDigits: MAX_MONEY_INTEGER_DIGITS
    });
    if (!result.success && result.reason === 'INVALID_FORMAT') {
        return {
            success: false,
            message: '금액은 0 이상의 숫자로 입력해 주세요. 소수점 둘째 자리까지 허용됩니다.'
        };
    }

    if (!result.success) {
        return {
            success: false,
            message: '금액은 9,999,999,999,999.99 이하로 입력해 주세요.'
        };
    }

    return result;
}

/** DECIMAL(15,2) 금액 문자열들을 정수 센트로 합산한 뒤 문자열로 반환합니다. */
export function sumMoney(values: readonly string[]): string {
    const total = values.reduce(
        (sum, value) => sum + toScaledInteger(value, MONEY_SCALE),
        0n
    );
    return fromScaledInteger(total, MONEY_SCALE);
}

/** 두 DECIMAL(15,2) 금액을 정수 센트로 차감한 뒤 문자열로 반환합니다. */
export function subtractMoney(left: string, right: string): string {
    return fromScaledInteger(
        toScaledInteger(left, MONEY_SCALE)
            - toScaledInteger(right, MONEY_SCALE),
        MONEY_SCALE
    );
}

/** 손익과 비용 금액으로 ROI를 소수 6자리 문자열로 계산하며 비용 0원은 null로 반환합니다. */
export function calculateRoi(
    profit: string,
    actualCost: string
): string | null {
    const profitInMinorUnits = toScaledInteger(profit, MONEY_SCALE);
    const costInMinorUnits = toScaledInteger(actualCost, MONEY_SCALE);
    if (costInMinorUnits === 0n) {
        return null;
    }

    const scaledPercentage = divideRounded(
        profitInMinorUnits * 100n * powerOfTen(ROI_SCALE),
        costInMinorUnits
    );
    return fromScaledInteger(scaledPercentage, ROI_SCALE);
}

/** 소수 문자열의 값을 숫자 변환 없이 음수, 0, 양수로 구분합니다. */
export function getDecimalSign(value: string): -1 | 0 | 1 {
    const match = DECIMAL_PATTERN.exec(value);
    if (!match) {
        throw new Error(`올바르지 않은 소수 문자열입니다: ${value}`);
    }

    const [, sign, integerPart, fractionPart = ''] = match;
    if (/^0+$/.test(`${integerPart}${fractionPart}`)) {
        return 0;
    }

    return sign === '-' ? -1 : 1;
}

/** 소수 문자열을 지정 자릿수로 반올림하되 Number 변환 없이 문자열 정밀도를 유지합니다. */
export function roundDecimal(value: string, scale: number): string {
    const match = DECIMAL_PATTERN.exec(value);
    if (!match) {
        throw new Error(`올바르지 않은 소수 문자열입니다: ${value}`);
    }

    const sourceScale = match[3]?.length ?? 0;
    if (sourceScale <= scale) {
        return fromScaledInteger(toScaledInteger(value, scale), scale);
    }

    const sourceValue = toScaledInteger(value, sourceScale);
    const scaleDivisor = powerOfTen(sourceScale - scale);
    return fromScaledInteger(
        divideRounded(sourceValue, scaleDivisor),
        scale
    );
}

/** 금액 문자열의 정수부에 천 단위 쉼표를 넣고 의미 있는 소수부만 표시합니다. */
export function formatMoney(value: string): string {
    const match = DECIMAL_PATTERN.exec(value);
    if (!match) {
        throw new Error(`올바르지 않은 금액 문자열입니다: ${value}`);
    }

    const [, sign, integerPart, fractionPart = ''] = match;
    const groupedInteger = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    const visibleFraction = fractionPart.replace(/0+$/, '');

    return `${sign}${groupedInteger}${visibleFraction ? `.${visibleFraction}` : ''}`;
}
