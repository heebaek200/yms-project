// 유저 역할 범위
export type UserRole =
    | 'CREATOR'
    | 'EDITOR'
    | 'THUMBNAILER';

export type AuthUser = {
    userId: number;
    email: string;
    name: string;
    roles: UserRole[];
};
export type AuthSession = {
    userId: number;
    email: string;
    name: string;
    roles: UserRole[];
    accessToken: string;
    tokenType: string;
};

// 단가 변경 적용 범위
export type RateScope =
    | 'future'
    | 'all';