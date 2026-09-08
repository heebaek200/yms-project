import './FeedbackMessage.css';


export type FeedbackMessageType =
    | 'info'
    | 'success'
    | 'warning'
    | 'error';

type FeedbackMessageProps = {
    type?: FeedbackMessageType;
    message: string;
};

const FEEDBACK_ICON: Record<FeedbackMessageType, string> = {
    info: 'ℹ',
    success: '✓',
    warning: '!',
    error: '×'
};


/**
 * 화면 전반에서 공통으로 사용하는 상태 메시지를 표시합니다.
 * 오류, 경고, 성공, 일반 안내를 동일한 레이아웃으로 제공하며
 * 메시지 종류에 따라 아이콘과 강조 색상을 자동으로 변경합니다.
 */
function FeedbackMessage({
    type = 'info',
    message
}: FeedbackMessageProps) {

    return (
        <div
            className={`feedback-message feedback-message--${type}`}
            role={type === 'error' ? 'alert' : 'status'}
        >
            <span
                className="feedback-message__icon"
                aria-hidden="true"
            >
                {FEEDBACK_ICON[type]}
            </span>

            <span className="feedback-message__text">
                {message}
            </span>
        </div>
    );
}

export default FeedbackMessage;