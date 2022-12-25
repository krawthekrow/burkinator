import React, { useRef, useState, useEffect } from 'react';
import { useImmer } from 'use-immer';
import { Wrapper, Status } from "@googlemaps/react-wrapper";
import './App.css'
import { assertUnhandledType } from './Misc';
import { GeomObjSpec } from './GeomObj';
import { AlterPtRefUpd, AlterUpd, StateUpd } from './StateUpd';
import MapView, { MapObjSpec } from './MapView';
import ObjsEditorView from './ObjsEditorView';

import LatLngLiteral = google.maps.LatLngLiteral;

const Toolbar = (
	{onUpdate}: {
		onUpdate: (upd: StateUpd) => void,
	}
): JSX.Element => {
	const handleClickNewGeodesic = (
		e: React.MouseEvent<HTMLButtonElement>
	) => {
		onUpdate({
			t: 'newGeodesic',
		});
	};

	return <div>
		<button onClick={handleClickNewGeodesic}>Geodesic</button>
	</div>
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
					uniqName: geomObj.uniqName,
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
					uniqName: geomObj.uniqName,
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

type AppState = {
	geomObjs: GeomObjSpec[];
	mapObjs: MapObjSpec[];
	lastUsedId: number;
	mapCenter: LatLngLiteral;
	mapZoom: number;
};

const App = (): JSX.Element => {
	const initObjs: GeomObjSpec[] = [
		{
			t: 'point',
			uniqName: 'm1',
			pos: {lat: -25.344, lng: 131.031},
			mapLabel: 'M',
		},
		{
			t: 'point',
			uniqName: 'm2',
			pos: {lat: -35.344, lng: 140.031},
			mapLabel: 'M2',
		},
		{
			t: 'geodesic',
			uniqName: 'g1',
			ptFrom: 'm1',
			ptTo: 'm2',
		},
	];
	const [appState, setAppState] = useImmer<AppState>({
		geomObjs: initObjs,
		mapObjs: geomObjsToMapObjs(initObjs),
		// last used id to assign each object a unique default name
		lastUsedId: 0,
		mapCenter: {lat: -25.344, lng: 131.031},
		mapZoom: 4,
	});

	const syncObjs = (draftAppState: AppState): void => {
		draftAppState.mapObjs = geomObjsToMapObjs(draftAppState.geomObjs);
	};

	const applyAlterPtRefUpd = (
		objIndex: number,
		obj: GeomObjSpec,
		upd: AlterPtRefUpd,
		draftAppState: AppState
	): void => {
		// validate that the ptRef indeed refers to a point before
		// this object
		const targetPtIndex = draftAppState.geomObjs.findIndex((geomObj) => {
			return geomObj.uniqName == upd.newPtRef;
		});
		if (targetPtIndex == -1 || targetPtIndex >= objIndex) {
			return;
		}

		const targetPt = draftAppState.geomObjs[targetPtIndex];
		if (targetPt.t != 'point') {
			return;
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
	};

	const applyAlterUpd = (
		upd: AlterUpd,
		draftAppState: AppState
	): void => {
		const objIndex = draftAppState.geomObjs.findIndex((geomObj) => {
			return geomObj.uniqName == upd.uniqName;
		});
		if (objIndex == -1) {
			throw new Error(
				`could not find geom obj with name ${upd.uniqName}`
			);
		}
		const obj = draftAppState.geomObjs[objIndex];

		switch (upd.t) {
			case 'name': {
				// don't handle a conflict if the name is unchanged
				if (upd.newName == upd.uniqName) {
					break;
				}

				let newName = upd.newName;
				const conflictObj = draftAppState.geomObjs.find((geomObj) => {
					return geomObj.uniqName == upd.newName;
				});
				if (conflictObj) {
					newName += '_1';
				}

				// if the user has not changed the map label, then assume
				// we still want to display the uniq name as the marker label
				if (
					obj.t == 'point' &&
					obj.uniqName == obj.mapLabel
				) {
					obj.mapLabel = newName;
				}

				obj.uniqName = newName;
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
				applyAlterPtRefUpd(objIndex, obj, upd, draftAppState);
				break;
			}
			default: {
				assertUnhandledType(upd);
			}
		}
	};

	const applyUpd = (
		draftAppState: AppState,
		upd: StateUpd,
		doSync: boolean = true
	): void => {
		switch (upd.t)  {
			case 'newPoint': {
				const uniqName = `obj${draftAppState.lastUsedId}`;
				draftAppState.lastUsedId++;
				draftAppState.geomObjs.push({
					t: 'point',
					uniqName: uniqName,
					pos: {lat: upd.pos.lat, lng: upd.pos.lng},
					mapLabel: uniqName,
				});
				break;
			}
			case 'newGeodesic': {
				const uniqName = `obj${draftAppState.lastUsedId}`;
				draftAppState.lastUsedId++;
				draftAppState.geomObjs.push({
					t: 'geodesic',
					uniqName: uniqName,
					ptFrom: null,
					ptTo: null,
				});
				break;
			}
			case 'delete': {
				draftAppState.geomObjs = draftAppState.geomObjs.filter(
					(geomObj) => {
						return geomObj.uniqName != upd.uniqName;
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
				applyAlterUpd(upd, draftAppState);
				break;
			}
			default: {
				assertUnhandledType(upd);
			}
		}
		if (doSync) {
			syncObjs(draftAppState);
		}
	};

	const renderErr = (status: Status) => {
		return <h2>{status}</h2>;
	};

	const handleMapClick = (pos: LatLngLiteral) => {
		setAppState((draftAppState) => {
			applyUpd(draftAppState, {
				t: 'newPoint',
				pos: pos,
			});
		});
	};

	const updateMarkerPos = (
		draftAppState: AppState,
		markerName: string,
		geomObjName: string,
		pos: LatLngLiteral,
		doSync: boolean = true
	) => {
		applyUpd(draftAppState, {
			t: 'pos',
			uniqName: geomObjName,
			newPos: pos,
		}, doSync);

		if (!doSync) {
			// if we don't update the rest of the mapObjs, at least update
			// the marker being dragged
			const marker = draftAppState.mapObjs.find((mapObj) => {
				return mapObj.uniqName == markerName;
			});
			if (!marker) {
				throw new Error(`could not find marker with name ${markerName}`);
			}
			if (marker.t != 'dragMarker') {
				throw new Error(`expected dragMarker, got ${marker.t}`);
			}
			marker.pos = pos;
		}
	};

	const handleMarkerDrag = (
		markerName: string,
		geomObjName: string,
		pos: LatLngLiteral
	) => {
		setAppState((draftAppState) => {
			updateMarkerPos(draftAppState, markerName, geomObjName, pos);
		});
	};

	const handleMarkerDragEnd = (
		markerName: string,
		geomObjName: string,
		pos: LatLngLiteral
	) => {
		setAppState((draftAppState) => {
			updateMarkerPos(draftAppState, markerName, geomObjName, pos);
		});
	};

	const handleUpdate = (
		upd: StateUpd
	) => {
		setAppState((draftAppState) => {
			applyUpd(draftAppState, upd);
		});
	};

	return <Wrapper
		apiKey={import.meta.env.VITE_GOOGLE_MAPS_API_KEY}
		render={renderErr}
	>
		<div className="toolbar-pane">
			<Toolbar
				onUpdate={handleUpdate}
			/>
		</div>
		<div className="main-pane">
			<div className="map-pane">
				<MapView
					objs={appState.mapObjs}
					center={appState.mapCenter}
					zoom={appState.mapZoom}
					onClick={handleMapClick}
					onMarkerDrag={handleMarkerDrag}
					onMarkerDragEnd={handleMarkerDragEnd}
				/>
			</div>
			<div className="objs-editor-pane">
				<ObjsEditorView
					objs={appState.geomObjs}
					onUpdate={handleUpdate}
				/>
			</div>
		</div>
	</Wrapper>;
};

export default App;
