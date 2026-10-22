import { Link, type LinkProps } from 'react-router';

import './ResourceNavigationLink.css';

type ResourceNavigationLinkProps = Pick<LinkProps, 'to' | 'state'> & {
    label: string;
    variant: 'back' | 'detail';
};

/** 목록 복귀와 상세 진입 링크를 프로젝트 계열 화면에서 동일한 조작감으로 표시합니다. */
function ResourceNavigationLink({
    label,
    variant,
    to,
    state
}: ResourceNavigationLinkProps) {
    return (
        <Link
            className={`resource-navigation-link resource-navigation-link--${variant}`}
            to={to}
            state={state}
        >
            {variant === 'back' && <span aria-hidden="true">←</span>}
            <span>{label}</span>
            {variant === 'detail' && <span aria-hidden="true">→</span>}
        </Link>
    );
}

export default ResourceNavigationLink;
