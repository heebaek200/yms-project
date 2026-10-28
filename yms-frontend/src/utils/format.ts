import { normalizeUnsignedNumericInput } from './currencyInput';

export type RateNormalizationResult =
    | { success: true; value: string }
    | { success: false; message: string };

/**
 * 사용자가 입력한 단가를 공통 숫자 입력 규칙에 따라 정규화합니다.
 * 빈 입력은 저장 전 상태를 유지하도록 빈 문자열로 반환하고 임의 문자는 제거하지 않습니다.
 * 유효한 값은 부동소수점 변환 없이 API에서 사용할 숫자 문자열로 정규화합니다.
 */
const normalizeRateInput = (value: string): RateNormalizationResult => {
    const result = normalizeUnsignedNumericInput(value, {
        maxFractionDigits: 6,
        allowEmpty: true,
        allowPerViewUnit: true
    });
    if (!result.success) {
        return {
            success: false,
            message: '단가는 0 이상의 숫자로 입력해 주세요. 소수점 여섯째 자리까지 허용됩니다.'
        };
    }

    return result;
};

/**
 * 사용자가 입력한 단가를 API 요청에 사용할 문자열로 정규화합니다.
 * 빈 문자열은 확정된 업무 규칙에 따라 "0"으로 변환하고 숫자 정밀도는 유지합니다.
 * 잘못된 값은 화면 검증에서 차단되므로 이 함수는 검증을 통과한 입력에 사용합니다.
 */
const formatRate = (value: string) => {
    const result = normalizeRateInput(value);

    if (!result.success || !result.value) {
        return '0';
    }

    return result.value;
};

export { formatRate, normalizeRateInput };
