import { GeomObjName } from './GeomObj';

import LatLngLiteral = google.maps.LatLngLiteral;

enum MapObjNameBrand { _ = '' };
type MapObjName = MapObjNameBrand & string;

const newMapObjName = (uniqName: string): MapObjName => {
	return uniqName as MapObjName;
};

type MapObjSpecBase = {
	uniqName: MapObjName;
	geomObjName: GeomObjName;
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
