import {
    useEffect,
    useRef,
    useState,
    type InputHTMLAttributes
} from 'react';

type CompositionSafeSearchInputProps = Omit<
    InputHTMLAttributes<HTMLInputElement>,
    'onChange' | 'onCompositionEnd' | 'onCompositionStart' | 'value'
> & {
    value: string;
    onValueChange: (value: string) => void;
};

/**
 * 한글 등 IME 조합 중에는 외부 필터 갱신을 미루고 입력창의 조합 문자열을 로컬에서 보존합니다.
 * 조합이 끝나거나 일반 문자가 입력되면 완성된 값만 상위 검색 상태에 전달합니다.
 */
function CompositionSafeSearchInput({
    value,
    onValueChange,
    type = 'search',
    ...inputProps
}: CompositionSafeSearchInputProps) {
    const [draft, setDraft] = useState(value);
    const isComposing = useRef(false);
    const lastEmittedValue = useRef(value);

    useEffect(() => {
        if (isComposing.current) return;

        // 뒤로 가기나 필터 초기화처럼 외부에서 바뀐 검색어를 입력창에 동기화합니다.
        setDraft(value);
        lastEmittedValue.current = value;
    }, [value]);

    /** 같은 완성 문자열을 compositionend와 change에서 중복 전달하지 않습니다. */
    const emitValue = (nextValue: string) => {
        if (lastEmittedValue.current === nextValue) return;
        lastEmittedValue.current = nextValue;
        onValueChange(nextValue);
    };

    return (
        <input
            {...inputProps}
            type={type}
            value={draft}
            onCompositionStart={() => {
                isComposing.current = true;
            }}
            onCompositionEnd={event => {
                isComposing.current = false;
                setDraft(event.currentTarget.value);
                emitValue(event.currentTarget.value);
            }}
            onChange={event => {
                const nextValue = event.target.value;
                const nativeEvent = event.nativeEvent as InputEvent;

                // 조합 중에는 URL·API 상태를 건드리지 않아 브라우저의 IME 버퍼를 보존합니다.
                setDraft(nextValue);
                if (!isComposing.current && !nativeEvent.isComposing) emitValue(nextValue);
            }}
        />
    );
}

export default CompositionSafeSearchInput;
