import React, { useRef, useState, useEffect } from 'react';
import { useImmer } from 'use-immer';
import { Wrapper, Status } from "@googlemaps/react-wrapper";
import './App.css'
import { GeomObjUpd } from './GeomObj';
import MapView, { MapObjSpec } from './MapView';
import ObjsEditorView, { GeomObjSpec } from './ObjsEditorView';

import LatLngLiteral = google.maps.LatLngLiteral;

const geomObjsToMapObjs = (
	geomObjs: GeomObjSpec[]
): MapObjSpec[] => {
	const mapObjs: MapObjSpec[] = [];
	for (const geomObj of geomObjs) {
		switch(geomObj.t) {
			case 'point': {
				mapObjs.push({
					t: 'dragMarker',
					uniqName: geomObj.uniqName,
					geomObjName: geomObj.uniqName,
					pos: geomObj.pos,
				});
				break;
			}
			case 'geodesic': {
				break;
			}
			default: {
				throw new Error('unrecognized geom object type');
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
};

const App = () => {
	const initObjs: GeomObjSpec[] = [
		{
			t: 'point',
			uniqName: 'm1',
			pos: {lat: -25.344, lng: 131.031},
		},
	];
	const [appState, setAppState] = useImmer<AppState>({
		geomObjs: initObjs,
		mapObjs: geomObjsToMapObjs(initObjs),
		// last used id to assign each object a unique default name
		lastUsedId: 0,
		mapCenter: {lat: -25.344, lng: 131.031},
	});

	const syncObjs = (draftAppState: AppState): void => {
		draftAppState.mapObjs = geomObjsToMapObjs(draftAppState.geomObjs);
	};

	const updateGeomObj = (
		draftAppState: AppState,
		upd: GeomObjUpd
	): void => {
		if (upd.t == 'delete') {
			draftAppState.geomObjs = draftAppState.geomObjs.filter((geomObj) => {
				return geomObj.uniqName != upd.uniqName;
			});
			return;
		}

		const targetObj = draftAppState.geomObjs.find((geomObj) => {
			return geomObj.uniqName == upd.uniqName;
		});

		if (!targetObj) {
			throw new Error(`could not find geom obj with name ${upd.uniqName}`);
		}

		switch (upd.t) {
			case 'point': {
				if (targetObj.t != 'point') {
					throw new Error('cannot apply point transform to non-point geom obj');
				}
				targetObj.pos = upd.pos;
				break;
			}
			default: {
				throw new Error('unrecognized geom obj upd type');
			}
		}
	};

	const renderErr = (status: Status) => {
		return <h2>{status}</h2>;
	};

	const handleMapClick = (pos: LatLngLiteral) => {
		setAppState((draftAppState) => {
			const geomObjs = draftAppState.geomObjs;
			geomObjs.push({
				t: 'point',
				uniqName: `obj${draftAppState.lastUsedId}`,
				pos: {lat: pos.lat, lng: pos.lng},
			});
			draftAppState.lastUsedId++;
			syncObjs(draftAppState);
		});
	};

	const updateMarkerPos = (
		draftAppState: AppState,
		markerName: string,
		geomObjName: string,
		pos: LatLngLiteral
	) => {
		updateGeomObj(draftAppState, {
			t: 'point',
			uniqName: geomObjName,
			pos: pos,
		});

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
			syncObjs(draftAppState);
		});
	};

	const handleEditorUpdate = (
		upd: GeomObjUpd
	) => {
		setAppState((draftAppState) => {
			updateGeomObj(draftAppState, upd);
			syncObjs(draftAppState);
		});
	};

	return <Wrapper
		apiKey={import.meta.env.VITE_GOOGLE_MAPS_API_KEY}
		render={renderErr}
	>
		<div className="main-pane">
			<div className="map-pane">
				<MapView
					objs={appState.mapObjs}
					center={appState.mapCenter}
					onClick={handleMapClick}
					onMarkerDrag={handleMarkerDrag}
					onMarkerDragEnd={handleMarkerDragEnd}
				/>
			</div>
			<div className="objs-editor-pane">
				<ObjsEditorView
					objs={appState.geomObjs}
					onUpdate={handleEditorUpdate}
				/>
			</div>
		</div>
	</Wrapper>;
};

export default App;
