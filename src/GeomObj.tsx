import LatLngLiteral = google.maps.LatLngLiteral;

enum GeomObjNameBrand { _ = '' };
type GeomObjName = GeomObjNameBrand & string;

const newGeomObjName = (uniqName: string): GeomObjName => {
	return uniqName as GeomObjName;
};

// Types used to describe geometric objects on the Earth's surface.

type GeomObjSpecBase = {
	uniqName: GeomObjName;
};

type GeomPointSpec = GeomObjSpecBase & {
	t: 'point';
	mapLabel: string; // label to show on the map
	pos: LatLngLiteral;
};

type GeomGeodesicSpec = GeomObjSpecBase & {
	t: 'geodesic';
	ptFrom: string | null;
	ptTo: string | null;
};

type GeomObjSpec =
	GeomPointSpec |
	GeomGeodesicSpec
;


export type {
	GeomObjName,
	GeomGeodesicSpec,
	GeomPointSpec,
	GeomObjSpec,
};
export { newGeomObjName };
