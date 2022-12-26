import React, { useRef, useState, useEffect } from 'react';
import { useImmer } from 'use-immer';
import { Wrapper, Status } from "@googlemaps/react-wrapper";
import './App.css'
import { assertUnhandledType } from './Misc';
import { GeomObjName, GeomObjSpec, newGeomObjName } from './GeomObj';
import { MapObjName, newMapObjName } from './MapObj';
import { StateUpd } from './StateUpd';
import { UserState } from './UserState';
import {
	AppState, AppStateReducer,
	findGeomObjIndex,
	geomObjsToMapObjs,
} from './AppState';
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
		<button
			className="toolbar-button"
			onClick={handleClickNewGeodesic}
		>Geodesic</button>
	</div>
};

const App = (): JSX.Element => {
	const initObjs: GeomObjSpec[] = [
		{
			t: 'point',
			uniqName: newGeomObjName('m1'),
			pos: {lat: -25.344, lng: 131.031},
			mapLabel: 'M',
		},
		{
			t: 'point',
			uniqName: newGeomObjName('m2'),
			pos: {lat: -35.344, lng: 140.031},
			mapLabel: 'M2',
		},
		{
			t: 'geodesic',
			uniqName: newGeomObjName('g1'),
			ptFrom: 'm1',
			ptTo: 'm2',
		},
	];
	const [appState, setAppState] = useImmer<AppState>({
		userState: { t: 'free' },
		geomObjs: initObjs,
		mapObjs: geomObjsToMapObjs(initObjs),
		// last used id to assign each object a unique default name
		lastUsedId: 0,
		mapCenter: {lat: -25.344, lng: 131.031},
		mapZoom: 4,
		errMsg: null,
	});

	const renderErr = (status: Status) => {
		return <h2>{status}</h2>;
	};

	const handleMapClick = (pos: LatLngLiteral) => {
		setAppState((draftAppState) => {
			draftAppState.errMsg = null;
			if (draftAppState.userState.t != 'free') {
				return;
			}
			AppStateReducer.applyUpd(draftAppState, {
				t: 'newPoint',
				pos: pos,
			});
		});
	};

	const handleMarkerDrag = (
		markerName: MapObjName,
		geomObjName: GeomObjName,
		pos: LatLngLiteral
	) => {
		setAppState((draftAppState) => {
			draftAppState.errMsg = null;
			AppStateReducer.updateMarkerPos(
				draftAppState, markerName, geomObjName, pos
			);
		});
	};

	const handleMarkerDragEnd = (
		markerName: MapObjName,
		geomObjName: GeomObjName,
		pos: LatLngLiteral
	) => {
		setAppState((draftAppState) => {
			draftAppState.errMsg = null;
			AppStateReducer.updateMarkerPos(
				draftAppState, markerName, geomObjName, pos
			);
		});
	};

	const handleMarkerClick = (
		markerName: MapObjName,
		geomObjName: GeomObjName,
	) => {
		setAppState((draftAppState) => {
			draftAppState.errMsg = null;
			const userState = draftAppState.userState;
			switch (userState.t) {
				case 'geodesicFrom': {
					const updSuccess = AppStateReducer.applyUpd(draftAppState, {
						t: 'geodesicFrom',
						uniqName: userState.uniqName,
						newPtRef: geomObjName,
					});
					if (updSuccess) {
						draftAppState.userState = userState.doPtToNext ? {
							t: 'geodesicTo',
							uniqName: userState.uniqName,
						} : {
							t: 'free',
						};
					}
					break;
				}
				case 'geodesicTo': {
					const updSuccess = AppStateReducer.applyUpd(draftAppState, {
						t: 'geodesicTo',
						uniqName: userState.uniqName,
						newPtRef: geomObjName,
					});
					if (updSuccess) {
						draftAppState.userState = {
							t: 'free',
						};
					}
					break;
				}
			}
		});
	};

	const handleMarkerRightClick = (
		markerName: MapObjName,
		geomObjName: GeomObjName,
	) => {
		setAppState((draftAppState) => {
			draftAppState.errMsg = null;
			// TODO: remove marker
		});
	};

	const handleUpdate = (
		upd: StateUpd
	) => {
		setAppState((draftAppState) => {
			draftAppState.errMsg = null;
			AppStateReducer.applyUpd(draftAppState, upd);
		});
	};

	const handleUserStateUpdate = (
		newState: UserState
	) => {
		setAppState((draftAppState) => {
			draftAppState.errMsg = null;
			draftAppState.userState = newState;
		});
	};

	const errMsgDom = (appState.errMsg == null) ? null : (
		<div
			className="error-pane"
		>
			{ appState.errMsg }
		</div>
	);

	return <Wrapper
		// don't enable production api access for now
		apiKey={'' /* import.meta.env.VITE_GOOGLE_MAPS_API_KEY */}
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
					markersDraggable={appState.userState.t == 'free'}
					onMapClick={handleMapClick}
					onMarkerDrag={handleMarkerDrag}
					onMarkerDragEnd={handleMarkerDragEnd}
					onMarkerClick={handleMarkerClick}
					onMarkerRightClick={handleMarkerRightClick}
				/>
				{ errMsgDom }
			</div>
			<div className="objs-editor-pane">
				<ObjsEditorView
					userState={appState.userState}
					objs={appState.geomObjs}
					onUpdate={handleUpdate}
					onUserStateUpdate={handleUserStateUpdate}
				/>
			</div>
		</div>
	</Wrapper>;
};

export default App;
