const isValidEmail = (email: string) => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
};

const isValidPassword = (password: string) => {
    return password.length >= 6;
};

export { isValidEmail, isValidPassword };