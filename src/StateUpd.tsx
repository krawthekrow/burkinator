import { GeomObjName } from './GeomObj';

import LatLngLiteral = google.maps.LatLngLiteral;

type NewPointUpd = {
	t: 'newPoint';
	pos: LatLngLiteral;
};

type NewGeodesicUpd = {
	t: 'newGeodesic';
};

type DeleteObjUpd = {
	t: 'delete';
	uniqName: GeomObjName;
};

// Types used to describe an update to a geometric object.

type AlterUpdBase = {
	uniqName: GeomObjName;
};

type AlterNameUpd = AlterUpdBase & {
	t: 'name';
	newName: GeomObjName;
};

type AlterPosUpd = AlterUpdBase & {
	t: 'pos';
	newPos: LatLngLiteral;
};

type AlterMapLabelUpd = AlterUpdBase & {
	t: 'mapLabel';
	newMapLabel: string;
};

type AlterPtRefUpdBase = AlterUpdBase & {
	newPtRef: GeomObjName;
};

type AlterBoolUpdBase = AlterUpdBase & {
	newVal: boolean;
};

type AlterNumberUpdBase = AlterUpdBase & {
	newVal: number;
};

type AlterGeodesicPtRefUpd = AlterPtRefUpdBase & {
	t: 'geodesicStart' | 'geodesicEnd';
};

type AlterGeodesicBoolUpd = AlterBoolUpdBase & {
	t: 'geodesicUseFarArc' | 'geodesicDestPtEnabled';
};

type AlterGeodesicNumberUpd = AlterNumberUpdBase & {
	t: 'geodesicDestPtTurnAngle' | 'geodesicDestPtDist';
};

type AlterGeodesicDestPtUpd = AlterUpdBase & {
	t: 'geodesicDestPt';
	newTurnAngle: number;
	newDist: number;
};

type AlterGeodesicDestPtMapLabelUpd = AlterUpdBase & {
	t: 'geodesicDestPtMapLabel';
	newVal: string;
};

type AlterGeodesicUpd =
	AlterGeodesicPtRefUpd | AlterGeodesicBoolUpd | AlterGeodesicNumberUpd |
	AlterGeodesicDestPtUpd | AlterGeodesicDestPtMapLabelUpd
;

type AlterPtRefUpd =
	AlterGeodesicPtRefUpd
;

type AlterBoolUpd =
	AlterGeodesicBoolUpd
;

type AlterNumberUpd =
	AlterGeodesicNumberUpd
;

type AlterUpd =
	AlterNameUpd |
	AlterPosUpd |
	AlterMapLabelUpd |
	AlterGeodesicUpd
;

type StateUpd =
	AlterUpd |
	NewPointUpd |
	NewGeodesicUpd |
	DeleteObjUpd
;

export type {
	AlterNameUpd,
	AlterPosUpd,
	AlterMapLabelUpd,
	AlterPtRefUpd,
	AlterBoolUpd,
	AlterGeodesicUpd,
	AlterUpd,
	NewPointUpd,
	NewGeodesicUpd,
	DeleteObjUpd,
	StateUpd,
};
