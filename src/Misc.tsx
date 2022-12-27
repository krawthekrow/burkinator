// common functions that don't have a canonical home yet

const assertUnhandledType = (t: never): never => {
	throw new Error(`unrecognized type ${t}`);
}

export {
	assertUnhandledType,
};
