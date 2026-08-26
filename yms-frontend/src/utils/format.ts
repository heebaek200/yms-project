// 단가 고정소수점 포맷
const formatRate = (value: string) => {
    const number = Number(value);

    if (Number.isNaN(number)) {
        return '';
    }

    return number.toFixed(2);
};

export { formatRate };