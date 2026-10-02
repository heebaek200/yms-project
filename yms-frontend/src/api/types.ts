/**
 * 서버가 입력값 검증 실패 시 반환하는 개별 필드 오류입니다.
 * field는 화면 입력 이름과 연결하고 value와 reason은 오류 표시에 사용합니다.
 * 필드 오류가 없는 API 실패에서는 errors 자체를 null로 반환합니다.
 */
export type ApiFieldError = {
    field: string;
    value: string | null;
    reason: string;
};

/**
 * 데이터가 있는 API 성공 응답의 공통 Envelope입니다.
 * 조회 API처럼 별도 안내가 필요하지 않은 경우 message는 생략할 수 있습니다.
 * 제네릭 data에는 각 API가 정의한 실제 응답 타입을 전달합니다.
 */
export type ApiSuccessResponse<TData> = {
    success: true;
    message?: string;
    data: TData;
};

/**
 * 서버가 정상적으로 응답한 API 실패의 공통 Envelope입니다.
 * HTTP 상태는 Axios 오류에 별도로 보존하고 여기에는 업무 오류 코드를 유지합니다.
 * errors는 입력 필드에 연결할 상세 오류가 없을 때 null입니다.
 */
export type ApiFailureResponse = {
    success: false;
    errorCode: string;
    message: string;
    errors: ApiFieldError[] | null;
};

// 기존 Mock API와 실제 API가 같은 성공·실패 판별 방식을 사용하도록 구성합니다.
export type ApiResponse<TData> =
    | ApiSuccessResponse<TData>
    | ApiFailureResponse;
