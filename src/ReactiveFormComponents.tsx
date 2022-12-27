import React, { useRef, useState, useEffect } from 'react';

// Only send updates when the user "commits" by unfocusing
const ReactiveTextInput = (
	{val, disabled, className, onCommit}: {
		val: string,
		disabled: boolean,
		className?: string,
		onCommit: (newVal: string) => void,
	}
): JSX.Element => {
	const [dispVal, setDispVal] = useState<string | null>(null);

	useEffect(() => {
		setDispVal(val.toString());
	}, [val]);

	const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		setDispVal(e.target.value);
	};

	const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => {
		e.target.select();
	};

	const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
		onCommit(e.target.value);
		setDispVal(null);
	};

	const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
		if (e.key == 'Enter') {
			(e.target as HTMLInputElement).blur();
		}
	};

	return <input
		type="text"
		className={`${(className == undefined) ? '' : className}`}
		value={(dispVal != null) ? dispVal : val}
		disabled={disabled}
		onChange={handleChange}
		onFocus={handleFocus}
		onBlur={handleBlur}
		onKeyPress={handleKeyPress}
	/>;
};

const ReactiveCheckbox = (
	{val, disabled, className, onChange}: {
		val: boolean,
		disabled: boolean,
		className?: string,
		onChange: (newVal: boolean) => void,
	}
): JSX.Element => {
	const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		onChange(e.target.checked);
	};

	return <input
		type="checkbox"
		className={`${(className == undefined) ? '' : className}`}
		checked={val}
		disabled={disabled}
		onChange={handleChange}
	/>;
};

const ReactiveButtonGroup = (
	{buttonTexts, val, disabled, className, onChange}: {
		buttonTexts: string[],
		val: number,
		disabled: boolean,
		className?: string,
		onChange: (newVal: number) => void,
	}
): JSX.Element => {
	const makeHandleClick = (newVal: number) => {
		return (e: React.MouseEvent<HTMLButtonElement>) => {
			onChange(newVal);
		};
	};

	const buttonsDom = buttonTexts.map((buttonText: string, i: number) => {
		return <button
			key={i}
			className={
				`${(i == val) ? 'btn-active' : ''} ` +
				`${(className == undefined) ? '' : className}`
			}
			disabled={disabled}
			onClick={makeHandleClick(i)}
		>
			{ buttonText }
		</button>;
	});

	return <div
		className="editor-btn-group"
	>
		{ buttonsDom }
	</div>;
};

export {
	ReactiveTextInput,
	ReactiveCheckbox,
	ReactiveButtonGroup,
};
