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
	uniqName: string;
};

// Types used to describe an update to a geometric object.

type AlterUpdBase = {
	uniqName: string;
};

type AlterNameUpd = AlterUpdBase & {
	t: 'name';
	newName: string;
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
	newPtRef: string;
};

type AlterGeodesicFromUpd = AlterPtRefUpdBase & {
	t: 'geodesicFrom';
};

type AlterGeodesicToUpd = AlterPtRefUpdBase & {
	t: 'geodesicTo';
};

type AlterPtRefUpd =
	AlterGeodesicFromUpd |
	AlterGeodesicToUpd
;

type AlterUpd =
	AlterNameUpd |
	AlterPosUpd |
	AlterMapLabelUpd |
	AlterPtRefUpd
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
	AlterGeodesicFromUpd,
	AlterGeodesicToUpd,
	AlterPtRefUpd,
	AlterUpd,
	NewPointUpd,
	NewGeodesicUpd,
	DeleteObjUpd,
	StateUpd,
};
