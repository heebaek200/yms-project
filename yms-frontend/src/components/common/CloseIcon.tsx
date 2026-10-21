import './CloseIcon.css';

/** 폰트와 무관한 두 선으로 닫기 아이콘을 그려 버튼의 시각적 중심을 유지합니다. */
function CloseIcon() {
    return (
        <svg
            className="close-icon"
            viewBox="0 0 16 16"
            aria-hidden="true"
            focusable="false"
        >
            <path
                d="M3.5 3.5 12.5 12.5M12.5 3.5 3.5 12.5"
                fill="none"
                stroke="currentColor"
                strokeLinecap="round"
                strokeWidth="1.5"
            />
        </svg>
    );
}

export default CloseIcon;
