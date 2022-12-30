import { GeomObjName, GeomObjSpec } from './GeomObj';

import LatLngLiteral = google.maps.LatLngLiteral;

type NewObjUpdBase = {
	uniqName?: GeomObjName;
	insertBeforeUniqName?: GeomObjName;
};

type NewPointUpd = NewObjUpdBase & {
	t: 'newPoint';
	pos: LatLngLiteral;
};

type UndoableNewPointUpd = NewPointUpd & {
	uniqName: GeomObjName;
};

type NewGeodesicUpd = NewObjUpdBase & {
	t: 'newGeodesic';
};

type UndoableNewGeodesicUpd = NewGeodesicUpd & {
	uniqName: GeomObjName;
};

type DeleteObjUpd = {
	t: 'delete';
	uniqName: GeomObjName;
};

type UndoableDeleteObjUpd = DeleteObjUpd & {
	deletedObjIndex: number;
	deletedObj: GeomObjSpec;
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

type UndoableAlterPosUpd = AlterPosUpd & {
	oldPos: LatLngLiteral
};

type AlterMapLabelUpd = AlterUpdBase & {
	t: 'mapLabel';
	newMapLabel: string;
};

type UndoableAlterMapLabelUpd = AlterMapLabelUpd & {
	oldMapLabel: string;
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

type UndoableAlterGeodesicPtRefUpd = AlterGeodesicPtRefUpd & {
	oldPtRef: GeomObjName;
};

type AlterGeodesicBoolUpd = AlterBoolUpdBase & {
	t: 'geodesicUseFarArc' | 'geodesicDestPtEnabled';
};

type UndoableAlterGeodesicBoolUpd = AlterGeodesicBoolUpd & {
	oldVal: boolean;
};

type AlterGeodesicNumberUpd = AlterNumberUpdBase & {
	t: 'geodesicDestPtTurnAngle' | 'geodesicDestPtDist';
};

type UndoableAlterGeodesicNumberUpd = AlterGeodesicNumberUpd & {
	oldVal: number;
};

type AlterGeodesicDestPtUpd = AlterUpdBase & {
	t: 'geodesicDestPt';
	newTurnAngle: number;
	newDist: number;
};

type UndoableAlterGeodesicDestPtUpd = AlterGeodesicDestPtUpd & {
	oldTurnAngle: number;
	oldDist: number;
};

type AlterGeodesicDestPtMapLabelUpd = AlterUpdBase & {
	t: 'geodesicDestPtMapLabel';
	newVal: string;
};

type UndoableAlterGeodesicDestPtMapLabelUpd =
	AlterGeodesicDestPtMapLabelUpd & {
		oldVal: string;
	};

type AlterGeodesicUpd =
	AlterGeodesicPtRefUpd | AlterGeodesicBoolUpd | AlterGeodesicNumberUpd |
	AlterGeodesicDestPtUpd | AlterGeodesicDestPtMapLabelUpd
;

type AlterPtRefUpd = AlterGeodesicPtRefUpd;

type AlterUpd =
	AlterNameUpd |
	AlterPosUpd |
	AlterMapLabelUpd |
	AlterGeodesicUpd
;

type UndoableAlterGeodesicUpd =
	UndoableAlterGeodesicPtRefUpd | UndoableAlterGeodesicBoolUpd |
	UndoableAlterGeodesicNumberUpd | UndoableAlterGeodesicDestPtUpd |
	UndoableAlterGeodesicDestPtMapLabelUpd
;

type UndoableAlterUpd =
	AlterNameUpd | UndoableAlterPosUpd | UndoableAlterMapLabelUpd |
	UndoableAlterGeodesicUpd
;

type UndoableUpd =
	UndoableNewPointUpd | UndoableNewGeodesicUpd |
	UndoableDeleteObjUpd | UndoableAlterUpd
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
	AlterGeodesicUpd,
	AlterUpd,
	NewPointUpd,
	NewGeodesicUpd,
	DeleteObjUpd,
	StateUpd,
	UndoableAlterGeodesicUpd,
	UndoableAlterUpd,
	UndoableUpd,
};
