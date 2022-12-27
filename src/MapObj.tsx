import { GeomObjName, ResolvedGeomObjSpec } from './GeomObj';

import LatLngLiteral = google.maps.LatLngLiteral;

// Nominal typing hack to ensure that geomObj and mapObj names
// don't get mixed up. They compile to just strings.
enum MapObjNameBrand { _ = '' };
type MapObjName = MapObjNameBrand & string;

const newMapObjName = (uniqName: string): MapObjName => {
	return uniqName as MapObjName;
};

type MapObjSpecBase = {
	uniqName: MapObjName;
	geomObj: ResolvedGeomObjSpec;
};

type MapDragMarkerSpec = MapObjSpecBase & {
	t: 'dragMarker';
	pos: LatLngLiteral;
	mapLabel: string;
};

type MapPolylineSpec = MapObjSpecBase & {
	t: 'polyline';
	path: LatLngLiteral[];
};

type MapObjSpec =
	MapDragMarkerSpec |
	MapPolylineSpec
;

export type {
	MapObjName,
	MapDragMarkerSpec,
	MapPolylineSpec,
	MapObjSpec,
};
export { newMapObjName };
