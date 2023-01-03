import { GeomObjName, GeomObjSpec } from './GeomObj';

type UserStateFree = {
	t: 'free';
};

type UserStateLoading = {
	t: 'loading';
};

type UserStateMoreFeatures = {
	t: 'more';
	importErr: string;
	importInfo: string;
	isImporting: boolean;
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
	UserStateLoading |
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
