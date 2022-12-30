import { GeomObjName } from './GeomObj';

type UserStateFree = {
	t: 'free';
};

type UserStateMoreFeatures = {
	t: 'more';
	importErr: string;
};

type UserStateSelectGeodesicStart = {
	t: 'geodesicStart';
	uniqName: GeomObjName;
	doPtEndNext: boolean;
};

type UserStateSelectGeodesicTo = {
	t: 'geodesicEnd';
	uniqName: GeomObjName;
};

type UserStateSelectPt =
	UserStateSelectGeodesicStart |
	UserStateSelectGeodesicTo
;

type UserState =
	UserStateFree |
	UserStateSelectPt |
	UserStateMoreFeatures
;

export type {
	UserStateFree,
	UserStateSelectGeodesicStart,
	UserStateSelectGeodesicTo,
	UserStateSelectPt,
	UserState,
};
