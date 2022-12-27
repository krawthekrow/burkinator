import { assertUnhandledType } from './Misc';
import {
	EarthModel,
	getNearBearing, getFarBearing, getNearDist,
	getTurnAngleDistDest, getTurnAngle,
} from './EarthModel';

import LatLngLiteral = google.maps.LatLngLiteral;

// Nominal typing hack to ensure that geomObj and mapObj names
// don't get mixed up. They compile to just strings.
enum GeomObjNameBrand { _ = '' };
type GeomObjName = GeomObjNameBrand & string;

const newGeomObjName = (uniqName: string): GeomObjName => {
	return uniqName as GeomObjName;
};

const geomObjNameToString = (uniqName: GeomObjName): string => {
	return uniqName as string;
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

type GeomGeodesicSpecBase = GeomObjSpecBase & {
	t: 'geodesic';
	useFarArc: boolean;
	// destination point by going dist amount, turnAngle clockwise
	// from the geodesic line
	destPtEnabled: boolean;
	destPtTurnAngle: number;
	destPtDist: number;
	destPtMapLabel: string;
};

type GeomGeodesicSpec = GeomGeodesicSpecBase & {
	ptStart: GeomObjName;
	ptEnd: GeomObjName;
};

type GeomObjSpec =
	GeomPointSpec |
	GeomGeodesicSpec
;

// Resolved versions of the geomObj types, where all name references
// are dereferenced.

type ResolvedGeomPointSpec = GeomPointSpec;

type ResolvedGeomGeodesicSpec = GeomGeodesicSpecBase & {
	ptStart: ResolvedGeomObjSpec | null;
	ptEnd: ResolvedGeomObjSpec | null;
	bearingStart: number;
	bearingEnd: number;
	destPtPos: LatLngLiteral | null;
};

type ResolvedGeomObjSpec =
	ResolvedGeomPointSpec |
	ResolvedGeomGeodesicSpec
;

const getGeomObjPos = (
	obj: ResolvedGeomObjSpec | null
): LatLngLiteral | null => {
	if (obj == null) {
		return null;
	}
	switch (obj.t) {
		case 'point': {
			return obj.pos;
		}
		case 'geodesic': {
			return obj.destPtPos;
		}
	}
	assertUnhandledType(obj);
};

const resolveGeomObjs = (
	earth: EarthModel,
	geomObjs: GeomObjSpec[]
): ResolvedGeomObjSpec[] => {
	const resolvedObjs: ResolvedGeomObjSpec[] = [];
	const resolvedObjsMap: { [uniqName: string]: ResolvedGeomObjSpec } = {};
	const resolveName = (
		uniqName: GeomObjName
	): ResolvedGeomObjSpec | null => {
		if (uniqName == '') {
			return null;
		}
		const resolvedObj = resolvedObjsMap[uniqName];
		if (!resolvedObj) {
			throw new Error(`unable to resolve ${uniqName}`);
		}
		return resolvedObj;
	};
	const resolveObj = (geomObj: GeomObjSpec): ResolvedGeomObjSpec => {
		switch (geomObj.t) {
			case 'geodesic': {
				const ptStart = resolveName(geomObj.ptStart);
				const ptEnd = resolveName(geomObj.ptEnd);
				const posStart = getGeomObjPos(ptStart);
				const posEnd = getGeomObjPos(ptEnd);
				const bearingStart = (posStart == null || posEnd == null) ? 0 : (
					(geomObj.useFarArc ? getFarBearing : getNearBearing)(
						earth, posStart, posEnd
					)
				);
				const bearingEnd = (posStart == null || posEnd == null) ? 0 : (
					(geomObj.useFarArc ? getNearBearing : getFarBearing)(
						earth, posEnd, posStart
					)
				);
				const destPtStartPos = (posStart != null) ? posStart : posEnd;
				const destPtEndPos = (posEnd != null) ? posEnd : posStart;
				const pos = (
					geomObj.destPtEnabled &&
					destPtStartPos != null && destPtEndPos != null
				) ? getTurnAngleDistDest(
					earth, destPtStartPos, destPtEndPos, geomObj.useFarArc,
					geomObj.destPtTurnAngle, geomObj.destPtDist
				) : null;
				return {
					...geomObj,
					ptStart: ptStart,
					ptEnd: ptEnd,
					bearingStart: bearingStart,
					bearingEnd: bearingEnd,
					destPtPos: pos,
				};
			}
			case 'point': {
				return geomObj;
			}
		}
		assertUnhandledType(geomObj);
	};
	for (const geomObj of geomObjs) {
		let resolvedObj = resolveObj(geomObj);
		resolvedObjs.push(resolvedObj);
		resolvedObjsMap[resolvedObj.uniqName] = resolvedObj;
	}
	return resolvedObjs;
};

const invertGeodesicDestPt = (
	earth: EarthModel,
	obj: ResolvedGeomGeodesicSpec,
	destPt: LatLngLiteral
): {
	turnAngle: number,
	dist: number,
} | null => {
	const posStart = getGeomObjPos(obj.ptStart);
	const posEnd = getGeomObjPos(obj.ptEnd);
	const destPtStartPos = (posStart != null) ? posStart : posEnd;
	const destPtEndPos = (posEnd != null) ? posEnd : posStart;
	if (destPtStartPos == null || destPtEndPos == null) {
		return null;
	}
	return {
		turnAngle: getTurnAngle(
			earth, destPtStartPos, destPtEndPos, obj.useFarArc, destPt
		),
		dist: getNearDist(earth, destPtEndPos, destPt),
	};
};

export type {
	GeomObjName,
	GeomPointSpec,
	GeomGeodesicSpec,
	GeomObjSpec,
	ResolvedGeomPointSpec,
	ResolvedGeomGeodesicSpec,
	ResolvedGeomObjSpec,
};
export {
	newGeomObjName,
	geomObjNameToString,
	resolveGeomObjs,
	getGeomObjPos,
	invertGeodesicDestPt,
};
