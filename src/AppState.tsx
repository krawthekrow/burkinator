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
	UndoableAlterGeodesicUpd, UndoableAlterUpd, UndoableUpd,
} from './StateUpd';

import LatLngLiteral = google.maps.LatLngLiteral;

type AppState = {
	apiKey: string;
	earth: EarthModel;
	userState: UserState;
	updHistory: UndoableUpd[];
	updHistoryIndex: number;
	updHistoryAcceptMerge: boolean;
	updHistoryNextAcceptMerge: boolean;
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
					mapLabel: (geomObj.mapLabel.trim() == '') ?
						geomObj.uniqName : geomObj.mapLabel,
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

				if (
					posStart != null && posEnd != null &&
					!(posStart.lat == posEnd.lat && posStart.lng == posEnd.lng)
				) {
					// cannot draw geodesic between unknown points
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
				}
				break;
			}
			default: {
				assertUnhandledType(geomObj);
			}
		}
	}
	return mapObjs;
};

const startNewAction = (
	appState: AppState
) => {
	appState.errMsg = null;
	appState.updHistoryAcceptMerge = appState.updHistoryNextAcceptMerge;
	appState.updHistoryNextAcceptMerge = false;
};

const resetUpdHistory = (
	appState: AppState
) => {
	appState.updHistory = [];
	appState.updHistoryIndex = 0;
	appState.updHistoryNextAcceptMerge = false;
};

const mergeUndoableUpd = (
	upd1: UndoableUpd,
	upd2: UndoableUpd
): UndoableUpd => {
	switch (upd1.t) {
		case 'pos': {
			if (upd2.t != 'pos') {
				throw new Error('upd2 must be of type pos');
			}
			return {
				...upd2,
				oldPos: upd1.oldPos,
			};
		}
		case 'geodesicDestPt': {
			if (upd2.t != 'geodesicDestPt') {
				throw new Error('upd2 must be of type geodesicDestPt');
			}
			return {
				...upd2,
				oldTurnAngle: upd1.oldTurnAngle,
				oldDist: upd1.oldDist,
			};
		}
		default: {
			throw new Error(`cannot merge into update of type ${upd1.t}`);
		}
	}
};

const addToHistory = (
	appState: AppState,
	upd: UndoableUpd
): void => {
	if (appState.updHistoryIndex < appState.updHistory.length) {
		appState.updHistory.splice(appState.updHistoryIndex);
	}
	if (
		appState.updHistoryAcceptMerge &&
		appState.updHistory.length > 0
	) {
		const prevUpd = appState.updHistory[appState.updHistoryIndex - 1];
		if (prevUpd == undefined) {
			throw new Error('updHistoryIndex out of bounds');
		}
		if (prevUpd.t == upd.t) {
			appState.updHistory[appState.updHistoryIndex - 1] =
				mergeUndoableUpd(prevUpd, upd);
			return;
		}
	}
	appState.updHistory.push(upd);
	appState.updHistoryIndex++;
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
	appState: AppState,
	obj: GeomObjSpec,
	upd: AlterGeodesicUpd,
	registerUndoableUpd: (undoableUpd: UndoableUpd) => void,
	doUpdateUserState: boolean
): boolean => {
	if (obj.t != 'geodesic') {
		throw new Error('geom obj is not a geodesic obj');
	}
	switch (upd.t) {
		case 'geodesicStart': {
			if (!validatePtRefUpd(upd, appState)) {
				return false;
			}
			registerUndoableUpd({
				...upd,
				oldPtRef: obj.ptStart,
			});
			obj.ptStart = upd.newPtRef;
			if (doUpdateUserState && appState.userState.t == 'geodesicStart') {
				appState.userState = appState.userState.doPtEndNext ? {
					t: 'geodesicEnd',
					uniqName: appState.userState.uniqName,
				} : {
					t: 'free',
				};
			}
			return true;
		}
		case 'geodesicEnd': {
			if (!validatePtRefUpd(upd, appState)) {
				return false;
			}
			registerUndoableUpd({
				...upd,
				oldPtRef: obj.ptEnd,
			});
			obj.ptEnd = upd.newPtRef;
			if (doUpdateUserState && appState.userState.t == 'geodesicEnd') {
				appState.userState = {
					t: 'free',
				};
			}
			return true;
		}
		case 'geodesicUseFarArc': {
			registerUndoableUpd({
				...upd,
				oldVal: obj.useFarArc,
			});
			obj.useFarArc = upd.newVal;
			return true;
		}
		case 'geodesicDestPtEnabled': {
			registerUndoableUpd({
				...upd,
				oldVal: obj.destPtEnabled,
			});
			obj.destPtEnabled = upd.newVal;
			return true;
		}
		case 'geodesicDestPtTurnAngle': {
			registerUndoableUpd({
				...upd,
				oldVal: obj.destPtTurnAngle,
			});
			obj.destPtTurnAngle = upd.newVal;
			return true;
		}
		case 'geodesicDestPtDist': {
			registerUndoableUpd({
				...upd,
				oldVal: obj.destPtDist,
			});
			obj.destPtDist = upd.newVal;
			return true;
		}
		case 'geodesicDestPt': {
			registerUndoableUpd({
				...upd,
				oldTurnAngle: obj.destPtTurnAngle,
				oldDist: obj.destPtDist,
			});
			obj.destPtTurnAngle = upd.newTurnAngle;
			obj.destPtDist = upd.newDist;
			return true;
		}
		case 'geodesicDestPtMapLabel': {
			registerUndoableUpd({
				...upd,
				oldVal: obj.destPtMapLabel,
			});
			obj.destPtMapLabel = upd.newVal;
			return true;
		}
	}
	assertUnhandledType(upd);
};

const applyAlterUpd = (
	appState: AppState,
	upd: AlterUpd,
	registerUndoableUpd: (undoableUpd: UndoableUpd) => void,
	doUpdateUserState: boolean
): boolean => {
	const [objIndex, obj] = findGeomObjWithIndex(appState, upd.uniqName);
	if (!obj) {
		throw new Error(
			`could not find geom obj with name ${upd.uniqName}`
		);
	}

	switch (upd.t) {
		case 'name': {
			if (upd.newName.trim() == '' || upd.newName == upd.uniqName) {
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

			registerUndoableUpd(upd);

			renameRefs(appState.geomObjs, obj.uniqName, upd.newName);
			obj.uniqName = upd.newName;

			break;
		}
		case 'pos': {
			if (obj.t != 'point') {
				throw new Error('cannot update pos of non-point geom obj');
			}
			registerUndoableUpd({
				...upd,
				oldPos: obj.pos,
			});
			obj.pos = upd.newPos;
			break;
		}
		case 'mapLabel': {
			if (obj.t != 'point') {
				throw new Error('cannot update map label of non-point geom obj');
			}
			registerUndoableUpd({
				...upd,
				oldMapLabel: obj.mapLabel,
			});
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
			applyAlterGeodesicUpd(
				appState, obj, upd, registerUndoableUpd, doUpdateUserState
			);
			break;
		}
		default: {
			assertUnhandledType(upd);
		}
	}

	return true;
};

const renameRefs = (
	geomObjs: GeomObjSpec[],
	oldName: GeomObjName,
	newName: GeomObjName,
): void => {
	for (const geomObj of geomObjs) {
		switch (geomObj.t) {
			case 'geodesic': {
				if (geomObj.ptStart == oldName) {
					geomObj.ptStart = newName;
				}
				if (geomObj.ptEnd == oldName) {
					geomObj.ptEnd = newName;
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
};

const genUniqName = (appState: AppState): GeomObjName => {
	let uniqName = newGeomObjName(`obj${appState.lastUsedId}`);
	appState.lastUsedId++;
	const conflictIndex = appState.geomObjs.findIndex((geomObj) => {
		return geomObj.uniqName == uniqName;
	});
	if (conflictIndex != -1) {
		const geomObjsMap: { [uniqName: string]: GeomObjSpec } = {};
		for (const geomObj of appState.geomObjs) {
			geomObjsMap[geomObj.uniqName] = geomObj;
		}
		while (geomObjsMap[uniqName]) {
			uniqName = newGeomObjName(`obj${appState.lastUsedId}`);
			appState.lastUsedId++;
		}
	}
	return uniqName;
};

const applyUpd = (
	appState: AppState,
	upd: StateUpd,
	doSync: boolean = true,
	doAddToHistory: boolean = true,
	doUpdateUserState: boolean = true
): boolean => {
	const registerUndoableUpd = (undoableUpd: UndoableUpd) => {
		if (doAddToHistory) {
			addToHistory(appState, undoableUpd);
		}
	};
	const doInsert = (
		obj: GeomObjSpec,
		insertBeforeUniqName: GeomObjName | undefined
	) => {
		if (insertBeforeUniqName == undefined) {
			appState.geomObjs.push(obj);
		}
		else {
			const insertIndex = appState.geomObjs.findIndex((oObj) => {
				return oObj.uniqName == insertBeforeUniqName;
			});
			if (insertIndex == -1) {
				throw new Error(`name ${insertBeforeUniqName} not found`);
			}
			appState.geomObjs.splice(insertIndex, 0, obj);
		}
	};
	switch (upd.t)  {
		case 'newPoint': {
			const uniqName: GeomObjName = (upd.uniqName != undefined) ?
				upd.uniqName : genUniqName(appState);
			registerUndoableUpd({
				...upd,
				uniqName: uniqName,
			});
			doInsert({
				t: 'point',
				uniqName: uniqName,
				pos: {lat: upd.pos.lat, lng: upd.pos.lng},
				mapLabel: '',
			}, upd.insertBeforeUniqName);
			break;
		}
		case 'newGeodesic': {
			const uniqName = (upd.uniqName != undefined) ?
				upd.uniqName : genUniqName(appState);
			registerUndoableUpd({
				...upd,
				uniqName: uniqName,
			});
			doInsert({
				t: 'geodesic',
				uniqName: uniqName,
				ptStart: newGeomObjName(''),
				ptEnd: newGeomObjName(''),
				useFarArc: false,
				destPtEnabled: false,
				destPtTurnAngle: 0,
				destPtDist: 0,
				destPtMapLabel: geomObjNameToString(uniqName),
			}, upd.insertBeforeUniqName);
			if (doUpdateUserState) {
				appState.userState = {
					t: 'geodesicStart',
					uniqName: uniqName,
					doPtEndNext: true,
				};
			}
			break;
		}
		case 'delete': {
			const [objIndex, obj] = findGeomObjWithIndex(appState, upd.uniqName);
			if (!obj) {
				throw new Error('cannot find object to delete');
			}
			registerUndoableUpd({
				...upd,
				deletedObjIndex: objIndex,
				deletedObj: obj,
			});
			appState.geomObjs.splice(objIndex, 1);
			break;
		}
		case 'replace': {
			registerUndoableUpd({
				...upd,
				oldObjs: appState.geomObjs,
			});
			appState.geomObjs = upd.newObjs;
			break;
		}
		default: {
			if (!applyAlterUpd(
				appState, upd, registerUndoableUpd, doUpdateUserState
			)) {
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
	doSync: boolean = true,
	doAddToHistory: boolean = true
) => {
	switch (geomObj.t) {
		case 'point': {
			applyUpd(appState, {
				t: 'pos',
				uniqName: geomObj.uniqName,
				newPos: pos,
			}, doSync, doAddToHistory);
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
			}, doSync, doAddToHistory);
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

const applyUndoAlterGeodesicUpd = (
	appState: AppState,
	obj: GeomObjSpec,
	upd: UndoableAlterGeodesicUpd
): void => {
	if (obj.t != 'geodesic') {
		throw new Error('geom obj is not a geodesic obj');
	}
	switch (upd.t) {
		case 'geodesicStart': {
			obj.ptStart = upd.oldPtRef;
			break;
		}
		case 'geodesicEnd': {
			obj.ptEnd = upd.oldPtRef;
			break;
		}
		case 'geodesicUseFarArc': {
			obj.useFarArc = upd.oldVal;
			break;
		}
		case 'geodesicDestPtEnabled': {
			obj.destPtEnabled = upd.oldVal;
			break;
		}
		case 'geodesicDestPtTurnAngle': {
			obj.destPtTurnAngle = upd.oldVal;
			break;
		}
		case 'geodesicDestPtDist': {
			obj.destPtDist = upd.oldVal;
			break;
		}
		case 'geodesicDestPt': {
			obj.destPtTurnAngle = upd.oldTurnAngle;
			obj.destPtDist = upd.oldDist;
			break;
		}
		case 'geodesicDestPtMapLabel': {
			obj.destPtMapLabel = upd.oldVal;
			break;
		}
		default: {
			assertUnhandledType(upd);
		}
	}
};

const applyUndoAlterUpd = (
	appState: AppState,
	upd: UndoableAlterUpd
): void => {
	const [objIndex, obj] = findGeomObjWithIndex(
		appState, (upd.t == 'name') ? upd.newName : upd.uniqName
	);
	if (!obj) {
		throw new Error(
			`could not find geom obj with name ${upd.uniqName}`
		);
	}
	switch (upd.t) {
		case 'name': {
			renameRefs(appState.geomObjs, upd.newName, upd.uniqName);
			obj.uniqName = upd.uniqName;
			break;
		}
		case 'pos': {
			if (obj.t != 'point') {
				throw new Error('cannot update pos of non-point geom obj');
			}
			obj.pos = upd.oldPos;
			break;
		}
		case 'mapLabel': {
			if (obj.t != 'point') {
				throw new Error('cannot update map label of non-point geom obj');
			}
			obj.mapLabel = upd.oldMapLabel;
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
			applyUndoAlterGeodesicUpd(
				appState, obj, upd
			);
			break;
		}
		default: {
			assertUnhandledType(upd);
		}
	}
};

const applyUndoNoSync = (
	appState: AppState
): void => {
	if (appState.updHistory.length == 0) {
		throw new Error('nothing to undo');
	}

	appState.updHistoryIndex--;
	const upd = appState.updHistory[appState.updHistoryIndex];
	if (upd == undefined) {
		throw new Error('updHistoryIndex out of bounds');
	}

	switch (upd.t) {
		case 'newPoint':
		case 'newGeodesic': {
			appState.geomObjs = appState.geomObjs.filter((geomObj) => {
				return geomObj.uniqName != upd.uniqName;
			});
			break;
		}
		case 'delete': {
			appState.geomObjs.splice(upd.deletedObjIndex, 0, upd.deletedObj);
			break;
		}
		case 'replace': {
			appState.geomObjs = upd.oldObjs;
			break;
		}
		default: {
			applyUndoAlterUpd(appState, upd);
		}
	}
};

const applyUndo = (
	appState: AppState
): void => {
	applyUndoNoSync(appState);
	syncObjs(appState);
};

const applyRedo = (
	appState: AppState
): void => {
	const upd = appState.updHistory[appState.updHistoryIndex];
	appState.updHistoryIndex++;
	if (upd == undefined) {
		throw new Error('updHistoryIndex out of bounds');
	}
	applyUpd(appState, upd, true, false, false);
};

const mergeObjs = (
	appState: AppState,
	newObjs: GeomObjSpec[]
): void => {
	const mergedObjs: GeomObjSpec[] = [];

	const newObjsMap: { [uniqName: string]: GeomObjSpec } = {};
	for (const newObj of newObjs) {
		newObjsMap[newObj.uniqName] = newObj;
	}

	const mergedObjsMap: { [uniqName: string]: GeomObjSpec } = {};
	for (const geomObj of appState.geomObjs) {
		const newObj = newObjsMap[geomObj.uniqName];
		const mergedObj = (newObj != undefined) ? newObj : geomObj;
		if (mergedObjsMap.hasOwnProperty(mergedObj.uniqName)) {
			continue;
		}
		mergedObjsMap[mergedObj.uniqName] = mergedObj;
		mergedObjs.push(mergedObj);
	}

	for (const newObj of newObjs) {
		if (mergedObjsMap.hasOwnProperty(newObj.uniqName)) {
			continue;
		}
		mergedObjsMap[newObj.uniqName] = newObj;
		mergedObjs.push(newObj);
	}

	appState.geomObjs = mergedObjs;
};

const AppStateReducer = {
	startNewAction: startNewAction,
	resetUpdHistory: resetUpdHistory,
	applyUpd: applyUpd,
	updateMarkerPos: updateMarkerPos,
	applyUndo: applyUndo,
	applyRedo: applyRedo,
	mergeObjs: mergeObjs,
};

export type { AppState };
export {
	AppStateReducer,
	findGeomObjWithIndex,
	findGeomObj,
	geomObjsToMapObjs,
	genUniqName,
};
