import { GeomObjName } from './GeomObj';

type UserStateFree = {
	t: 'free';
};

type UserStateSelectGeodesicFrom = {
	t: 'geodesicFrom';
	uniqName: GeomObjName;
	doPtToNext: boolean;
};

type UserStateSelectGeodesicTo = {
	t: 'geodesicTo';
	uniqName: GeomObjName;
};

type UserStateSelectPt =
	UserStateSelectGeodesicFrom |
	UserStateSelectGeodesicTo
;

type UserState =
	UserStateFree |
	UserStateSelectPt
;

export type {
	UserStateFree,
	UserStateSelectGeodesicFrom,
	UserStateSelectGeodesicTo,
	UserStateSelectPt,
	UserState,
};
