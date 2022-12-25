import LatLngLiteral = google.maps.LatLngLiteral;

// Types used to describe geometric objects on the Earth's surface.

type GeomObjSpecBase = {
	uniqName: string;
};

type GeomPointSpec = GeomObjSpecBase & {
	t: 'point';
	pos: LatLngLiteral;
};

type GeomGeodesicSpec = GeomObjSpecBase & {
	t: 'geodesic';
};

type GeomObjSpec =
	GeomPointSpec |
	GeomGeodesicSpec
;


// Types used to describe an update to a geometric object.

type GeomObjUpdBase = {
	uniqName: string;
};

type GeomObjUpdPoint = GeomObjUpdBase & {
	t: 'point';
	pos: LatLngLiteral;
};

type GeomObjUpdDelete = GeomObjUpdBase & {
	t: 'delete';
};

type GeomObjUpd =
	GeomObjUpdPoint |
	GeomObjUpdDelete
;


export type {
	GeomGeodesicSpec,
	GeomPointSpec,
	GeomObjSpec,
	GeomObjUpdPoint,
	GeomObjUpdDelete,
	GeomObjUpd,
};
