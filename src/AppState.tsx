import { assertUnhandledType } from './Misc';
import { UserState } from './UserState';
import { GeomObjName, GeomObjSpec, newGeomObjName } from './GeomObj';
import {
	MapObjName, newMapObjName,
	MapObjSpec
} from './MapObj';
import { AlterPtRefUpd, AlterUpd, StateUpd } from './StateUpd';

import LatLngLiteral = google.maps.LatLngLiteral;

type AppState = {
	userState: UserState;
	geomObjs: GeomObjSpec[];
	mapObjs: MapObjSpec[];
	lastUsedId: number;
	mapCenter: LatLngLiteral;
	mapZoom: number;
	errMsg: string | null;
};

const findGeomObjIndex = (
	appState: AppState,
	uniqName: GeomObjName
): number => {
	return appState.geomObjs.findIndex((geomObj) => {
		return geomObj.uniqName == uniqName;
	});
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
	geomObjs: GeomObjSpec[]
): MapObjSpec[] => {
	const mapObjs: MapObjSpec[] = [];
	const objsDict: { [uniqName: string]: GeomObjSpec } = {};
	for (const geomObj of geomObjs) {
		objsDict[geomObj.uniqName] = geomObj;
		switch(geomObj.t) {
			case 'point': {
				mapObjs.push({
					t: 'dragMarker',
					uniqName: newMapObjName(geomObj.uniqName),
					geomObjName: geomObj.uniqName,
					pos: geomObj.pos,
					mapLabel: geomObj.mapLabel,
				});
				break;
			}
			case 'geodesic': {
				if (geomObj.ptFrom == null || geomObj.ptTo == null) {
					// cannot draw geodesic between unknown points
					break;
				}

				const ptFrom = objsDict[geomObj.ptFrom];
				const ptTo = objsDict[geomObj.ptTo];
				if (ptFrom.t != 'point' || ptTo.t != 'point') {
					throw new Error('geodesic endpoints need to be points');
				}
				mapObjs.push({
					t: 'polyline',
					uniqName: newMapObjName(geomObj.uniqName),
					geomObjName: geomObj.uniqName,
					path: [ptFrom.pos, ptTo.pos],
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
	appState.mapObjs = geomObjsToMapObjs(appState.geomObjs);
};

const applyAlterPtRefUpd = (
	objIndex: number,
	obj: GeomObjSpec,
	upd: AlterPtRefUpd,
	appState: AppState
): boolean => {
	const targetPtIndex = findGeomObjIndex(appState, upd.newPtRef);
	if (targetPtIndex == -1) {
		appState.errMsg = `could not find point with name ${upd.newPtRef}`;
		return false;
	}

	const targetPt = appState.geomObjs[targetPtIndex];
	if (targetPt.t != 'point') {
		appState.errMsg = `${upd.newPtRef} is not a point`;
		return false;
	}

	if (targetPtIndex >= objIndex) {
		appState.errMsg =
			`${upd.newPtRef} does not come before ${obj.uniqName} in the list`;
		return false;
	}

	switch (upd.t) {
		case 'geodesicFrom': {
			if (obj.t != 'geodesic') {
				throw new Error('geodesicFrom only applies to geodesics');
			}
			obj.ptFrom = upd.newPtRef;
			break;
		}
		case 'geodesicTo': {
			if (obj.t != 'geodesic') {
				throw new Error('geodesicTo only applies to geodesics');
			}
			obj.ptTo = upd.newPtRef;
			break;
		}
	}

	return true;
};

const applyAlterUpd = (
	upd: AlterUpd,
	appState: AppState
): boolean => {
	const objIndex = findGeomObjIndex(appState, upd.uniqName);
	if (objIndex == -1) {
		throw new Error(
			`could not find geom obj with name ${upd.uniqName}`
		);
	}
	const obj = appState.geomObjs[objIndex];

	switch (upd.t) {
		case 'name': {
			// don't handle a conflict if the name is unchanged
			if (upd.newName == upd.uniqName) {
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
		case 'geodesicFrom':
		case 'geodesicTo':
		{
			if (!applyAlterPtRefUpd(objIndex, obj, upd, appState)) {
				return false;
			}
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
					(geomObj.ptFrom != null && depSet.includes(geomObj.ptFrom)) ||
					(geomObj.ptTo != null && depSet.includes(geomObj.ptTo))
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
				ptFrom: null,
				ptTo: null,
			});
			appState.userState = {
				t: 'geodesicFrom',
				uniqName: uniqName,
				doPtToNext: true,
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
		case 'name':
		case 'pos':
		case 'mapLabel':
		case 'geodesicFrom':
		case 'geodesicTo':
		{
			if (!applyAlterUpd(upd, appState)) {
				return false;
			}
			break;
		}
		default: {
			assertUnhandledType(upd);
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
	geomObjName: GeomObjName,
	pos: LatLngLiteral,
	doSync: boolean = true
) => {
	applyUpd(appState, {
		t: 'pos',
		uniqName: geomObjName,
		newPos: pos,
	}, doSync);

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
	findGeomObjIndex,
	findGeomObj,
	geomObjsToMapObjs,
};
