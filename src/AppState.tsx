import { assertUnhandledType } from './Misc';
import { EarthModel, getAntipode } from './EarthModel';
import { UserState } from './UserState';
import {
	GeomObjName, GeomObjSpec, ResolvedGeomObjSpec,
	newGeomObjName, geomObjNameToString,
	resolveGeomObjs, getGeomObjPos, invertGeodesicDestPt,
} from './GeomObj';
import {
	MapObjName, newMapObjName,
	MapObjSpec,
} from './MapObj';
import {
	AlterGeodesicUpd, AlterPtRefUpd, AlterUpd, StateUpd,
} from './StateUpd';

import LatLngLiteral = google.maps.LatLngLiteral;

type AppState = {
	earth: EarthModel;
	userState: UserState;
	geomObjs: GeomObjSpec[];
	mapObjs: MapObjSpec[];
	lastUsedId: number;
	mapCenter: LatLngLiteral;
	mapZoom: number;
	errMsg: string | null;
};

const findGeomObjWithIndex = (
	appState: AppState,
	uniqName: GeomObjName
): [number, GeomObjSpec | null] => {
	for (const [i, geomObj] of appState.geomObjs.entries()) {
		if (geomObj.uniqName == uniqName) {
			return [i, geomObj];
		}
	}
	return [-1, null];
};

const findGeomObj = (
	appState: AppState,
	uniqName: GeomObjName
): GeomObjSpec | undefined => {
	return appState.geomObjs.find((geomObj) => {
		return geomObj.uniqName == uniqName;
	});
};

const findMapObj = (
	appState: AppState,
	uniqName: MapObjName
): MapObjSpec | undefined => {
	return appState.mapObjs.find((mapObj) => {
		return mapObj.uniqName == uniqName;
	});
};

const geomObjsToMapObjs = (
	earth: EarthModel,
	geomObjs: GeomObjSpec[]
): MapObjSpec[] => {
	const resolvedObjs = resolveGeomObjs(earth, geomObjs);
	const mapObjs: MapObjSpec[] = [];
	for (const geomObj of resolvedObjs) {
		switch(geomObj.t) {
			case 'point': {
				mapObjs.push({
					t: 'dragMarker',
					uniqName: newMapObjName(geomObj.uniqName),
					geomObj: geomObj,
					pos: geomObj.pos,
					mapLabel: geomObj.mapLabel,
				});
				break;
			}
			case 'geodesic': {
				const posStart = getGeomObjPos(geomObj.ptStart);
				const posEnd = getGeomObjPos(geomObj.ptEnd);
				const destPtStartPos = (posEnd != null) ? posEnd : posStart;
				if (geomObj.destPtPos != null) {
					mapObjs.push({
						t: 'dragMarker',
						uniqName: newMapObjName(`${geomObj.uniqName}$pt`),
						geomObj: geomObj,
						pos: geomObj.destPtPos,
						mapLabel: geomObj.destPtMapLabel,
					});
					if (destPtStartPos == null) {
						throw new Error('pos should only be defined if startPos is defined');
					}
					mapObjs.push({
						t: 'polyline',
						uniqName: newMapObjName(`${geomObj.uniqName}$ptpath`),
						geomObj: geomObj,
						path: [destPtStartPos, geomObj.destPtPos],
					});
				}

				if (posStart == null || posEnd == null) {
					// cannot draw geodesic between unknown points
					break;
				}

				if (
					posStart.lat == posEnd.lat &&
					posStart.lng == posEnd.lng
				) {
					// no geodesic between two of the same point
					break;
				}

				const posStartAntipode = getAntipode(earth, posStart);
				const posEndAntipode = getAntipode(earth, posEnd);

				const path = geomObj.useFarArc ? [
					posEnd,
					posStartAntipode,
					posEndAntipode,
					posStart,
				] : [
					posStart,
					posEnd,
				];

				mapObjs.push({
					t: 'polyline',
					uniqName: newMapObjName(geomObj.uniqName),
					geomObj: geomObj,
					path: path,
				});
				break;
			}
			default: {
				assertUnhandledType(geomObj);
			}
		}
	}
	return mapObjs;
};

const syncObjs = (appState: AppState): void => {
	appState.mapObjs = geomObjsToMapObjs(appState.earth, appState.geomObjs);
};

const validatePtRefUpd = (
	upd: AlterPtRefUpd,
	appState: AppState
): boolean => {
	if (upd.newPtRef == '') {
		return true;
	}

	for (const geomObj of appState.geomObjs) {
		if (geomObj.uniqName == upd.uniqName) {
			appState.errMsg =
				`${upd.newPtRef} does not come before ${geomObj.uniqName}`;
			return false;
		}
		else if (geomObj.uniqName == upd.newPtRef) {
			return true;
		}
	}

	appState.errMsg = `could not find object with name ${upd.newPtRef}`;
	return false;
};

const applyAlterGeodesicUpd = (
	objIndex: number,
	obj: GeomObjSpec,
	upd: AlterGeodesicUpd,
	appState: AppState
): boolean => {
	if (obj.t != 'geodesic') {
		throw new Error('geom obj is not a geodesic obj');
	}
	switch (upd.t) {
		case 'geodesicStart': {
			if (!validatePtRefUpd(upd, appState)) {
				return false;
			}
			obj.ptStart = upd.newPtRef;
			return true;
		}
		case 'geodesicEnd': {
			if (!validatePtRefUpd(upd, appState)) {
				return false;
			}
			obj.ptEnd = upd.newPtRef;
			return true;
		}
		case 'geodesicUseFarArc': {
			obj.useFarArc = upd.newVal;
			return true;
		}
		case 'geodesicDestPtEnabled': {
			obj.destPtEnabled = upd.newVal;
			return true;
		}
		case 'geodesicDestPtTurnAngle': {
			obj.destPtTurnAngle = upd.newVal;
			return true;
		}
		case 'geodesicDestPtDist': {
			obj.destPtDist = upd.newVal;
			return true;
		}
		case 'geodesicDestPt': {
			obj.destPtTurnAngle = upd.newTurnAngle;
			obj.destPtDist = upd.newDist;
			return true;
		}
		case 'geodesicDestPtMapLabel': {
			obj.destPtMapLabel = upd.newVal;
			return true;
		}
	}
	assertUnhandledType(upd);
};

const applyAlterUpd = (
	upd: AlterUpd,
	appState: AppState
): boolean => {
	const [objIndex, obj] = findGeomObjWithIndex(appState, upd.uniqName);
	if (!obj) {
		throw new Error(
			`could not find geom obj with name ${upd.uniqName}`
		);
	}

	switch (upd.t) {
		case 'name': {
			// don't handle a conflict if the name is unchanged
			if (upd.newName == upd.uniqName) {
				return false;
			}
			if (geomObjNameToString(upd.newName).includes('$')) {
				// "$" is used as a special character for mapObj names
				appState.errMsg = `name cannot contain "$"`;
				return false;
			}

			const conflictObj = findGeomObj(appState, upd.newName);
			if (conflictObj) {
				appState.errMsg = `${upd.newName} already exists`;
				return false;
			}

			// if the user has not changed the map label, then assume
			// we still want to display the uniq name as the marker label
			if (
				obj.t == 'point' &&
				obj.uniqName == obj.mapLabel
			) {
				obj.mapLabel = upd.newName;
			}

			obj.uniqName = upd.newName;
			break;
		}
		case 'pos': {
			if (obj.t != 'point') {
				throw new Error('cannot update pos of non-point geom obj');
			}
			obj.pos = upd.newPos;
			break;
		}
		case 'mapLabel': {
			if (obj.t != 'point') {
				throw new Error('cannot update map label of non-point geom obj');
			}
			obj.mapLabel = upd.newMapLabel;
			break;
		}
		case 'geodesicStart':
		case 'geodesicEnd':
		case 'geodesicUseFarArc':
		case 'geodesicDestPtEnabled':
		case 'geodesicDestPtTurnAngle':
		case 'geodesicDestPtDist':
		case 'geodesicDestPt':
		case 'geodesicDestPtMapLabel': {
			applyAlterGeodesicUpd(objIndex, obj, upd, appState);
			break;
		}
		default: {
			assertUnhandledType(upd);
		}
	}

	return true;
};

const getDependencySet = (
	geomObjs: GeomObjSpec[],
	uniqName: GeomObjName
): GeomObjName[] => {
	const depSet = [uniqName];
	for (const geomObj of geomObjs) {
		switch (geomObj.t) {
			case 'geodesic': {
				if (
					(geomObj.ptStart != null && depSet.includes(geomObj.ptStart)) ||
					(geomObj.ptEnd != null && depSet.includes(geomObj.ptEnd))
				) {
					depSet.push(geomObj.uniqName);
				}
				break;
			}
			case 'point': {
				break;
			}
			default: {
				assertUnhandledType(geomObj);
			}
		}
	}
	return depSet;
};

const applyUpd = (
	appState: AppState,
	upd: StateUpd,
	doSync: boolean = true
): boolean => {
	switch (upd.t)  {
		case 'newPoint': {
			const uniqName = newGeomObjName(`obj${appState.lastUsedId}`);
			appState.lastUsedId++;
			appState.geomObjs.push({
				t: 'point',
				uniqName: uniqName,
				pos: {lat: upd.pos.lat, lng: upd.pos.lng},
				mapLabel: uniqName,
			});
			break;
		}
		case 'newGeodesic': {
			const uniqName = newGeomObjName(`obj${appState.lastUsedId}`);
			appState.lastUsedId++;
			appState.geomObjs.push({
				t: 'geodesic',
				uniqName: uniqName,
				ptStart: newGeomObjName(''),
				ptEnd: newGeomObjName(''),
				useFarArc: false,
				destPtEnabled: false,
				destPtTurnAngle: 0,
				destPtDist: 0,
				destPtMapLabel: uniqName,
			});
			appState.userState = {
				t: 'geodesicStart',
				uniqName: uniqName,
				doPtEndNext: true,
			};
			break;
		}
		case 'delete': {
			const depSet = getDependencySet(appState.geomObjs, upd.uniqName);
			if (!confirm(
				`Delete ${depSet.join(', ')}?`
			)) {
				break;
			}
			appState.geomObjs = appState.geomObjs.filter(
				(geomObj) => {
					return !depSet.includes(geomObj.uniqName);
				}
			);
			break;
		}
		default: {
			if (!applyAlterUpd(upd, appState)) {
				return false;
			}
			break;
		}
	}
	if (doSync) {
		syncObjs(appState);
	}
	return true;
};

const updateMarkerPos = (
	appState: AppState,
	markerName: MapObjName,
	geomObj: ResolvedGeomObjSpec,
	pos: LatLngLiteral,
	doSync: boolean = true
) => {
	switch (geomObj.t) {
		case 'point': {
			applyUpd(appState, {
				t: 'pos',
				uniqName: geomObj.uniqName,
				newPos: pos,
			}, doSync);
			break;
		}
		case 'geodesic': {
			const destPtParams = invertGeodesicDestPt(
				appState.earth, geomObj, pos
			);
			if (destPtParams == null) {
				throw new Error('dest pt params should be computable');
			}
			applyUpd(appState, {
				t: 'geodesicDestPt',
				uniqName: geomObj.uniqName,
				newTurnAngle: destPtParams.turnAngle,
				newDist: destPtParams.dist,
			}, doSync);
			break;
		}
		default: {
			assertUnhandledType(geomObj);
		}
	}

	if (!doSync) {
		// if we don't update the rest of the mapObjs, at least update
		// the marker being dragged
		const marker = findMapObj(appState, markerName);
		if (!marker) {
			throw new Error(`could not find marker with name ${markerName}`);
		}
		if (marker.t != 'dragMarker') {
			throw new Error(`expected dragMarker, got ${marker.t}`);
		}
		marker.pos = pos;
	}
};

const AppStateReducer = {
	applyUpd: applyUpd,
	updateMarkerPos: updateMarkerPos,
};

export type { AppState };
export {
	AppStateReducer,
	findGeomObjWithIndex,
	findGeomObj,
	geomObjsToMapObjs,
};
