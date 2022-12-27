import { GeomObjName } from './GeomObj';

type UserStateFree = {
	t: 'free';
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
	UserStateSelectPt
;

export type {
	UserStateFree,
	UserStateSelectGeodesicStart,
	UserStateSelectGeodesicTo,
	UserStateSelectPt,
	UserState,
};
