import type { ButtonHTMLAttributes } from 'react';

import './FilterResetButton.css';

type FilterResetButtonProps = Omit<
    ButtonHTMLAttributes<HTMLButtonElement>,
    'children' | 'type'
>;

/** 목록 종류와 관계없이 같은 문구와 디자인으로 전체 필터 초기화를 제공합니다. */
function FilterResetButton({ className, ...buttonProps }: FilterResetButtonProps) {
    const classes = ['filter-reset-button', className]
        .filter(Boolean)
        .join(' ');

    return (
        <button {...buttonProps} type="button" className={classes}>
            초기화
        </button>
    );
}

export default FilterResetButton;
