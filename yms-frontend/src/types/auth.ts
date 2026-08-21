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