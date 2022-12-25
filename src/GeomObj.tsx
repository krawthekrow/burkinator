import LatLngLiteral = google.maps.LatLngLiteral;

// Types used to describe geometric objects on the Earth's surface.

type GeomObjSpecBase = {
	uniqName: string;
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
	GeomGeodesicSpec,
	GeomPointSpec,
	GeomObjSpec,
};
