import React, { useRef, useState, useEffect } from 'react';
import { useImmer } from 'use-immer';
import { Wrapper, Status } from "@googlemaps/react-wrapper";
import './App.css'
import { assertUnhandledType } from './Misc';
import { DEFAULT_EARTH_MODEL } from './EarthModel';
import {
	GeomObjName, GeomObjSpec, ResolvedGeomObjSpec,
	newGeomObjName,
} from './GeomObj';
import { MapObjName, newMapObjName } from './MapObj';
import { StateUpd } from './StateUpd';
import { UserState } from './UserState';
import {
	AppState, AppStateReducer,
	geomObjsToMapObjs,
} from './AppState';
import MapView, { MapObjSpec } from './MapView';
import ObjsEditorView from './ObjsEditorView';

import LatLngLiteral = google.maps.LatLngLiteral;

const Toolbar = (
	{userState, onUpdate}: {
		userState: UserState,
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

	return <>
		<button
			className="toolbar-button"
			disabled={userState.t != 'free'}
			onClick={handleClickNewGeodesic}
		>Add Geodesic</button>
	</>
};

const App = (): JSX.Element => {
	const initObjs: GeomObjSpec[] = [
		{
			t: 'point',
			uniqName: newGeomObjName('m1'),
			pos: {lat: -25.344, lng: 131.031},
			mapLabel: 'M1',
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
			ptStart: newGeomObjName('m1'),
			ptEnd: newGeomObjName('m2'),
			useFarArc: false,
			destPtEnabled: true,
			destPtTurnAngle: 0.1,
			destPtDist: 1000,
			destPtMapLabel: 'G1',
		},
	];
	const initEarth = DEFAULT_EARTH_MODEL;
	const [appState, setAppState] = useImmer<AppState>({
		earth: initEarth,
		userState: { t: 'free' },
		geomObjs: initObjs,
		mapObjs: geomObjsToMapObjs(initEarth, initObjs),
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
		geomObj: ResolvedGeomObjSpec,
		pos: LatLngLiteral
	) => {
		setAppState((draftAppState) => {
			draftAppState.errMsg = null;
			AppStateReducer.updateMarkerPos(
				draftAppState, markerName, geomObj, pos
			);
		});
	};

	const handleMarkerDragEnd = (
		markerName: MapObjName,
		geomObj: ResolvedGeomObjSpec,
		pos: LatLngLiteral
	) => {
		setAppState((draftAppState) => {
			draftAppState.errMsg = null;
			AppStateReducer.updateMarkerPos(
				draftAppState, markerName, geomObj, pos
			);
		});
	};

	const handleMarkerClick = (
		markerName: MapObjName,
		geomObj: ResolvedGeomObjSpec,
	) => {
		setAppState((draftAppState) => {
			draftAppState.errMsg = null;
			const userState = draftAppState.userState;
			switch (userState.t) {
				case 'geodesicStart': {
					const updSuccess = AppStateReducer.applyUpd(draftAppState, {
						t: 'geodesicStart',
						uniqName: userState.uniqName,
						newPtRef: geomObj.uniqName,
					});
					if (updSuccess) {
						draftAppState.userState = userState.doPtEndNext ? {
							t: 'geodesicEnd',
							uniqName: userState.uniqName,
						} : {
							t: 'free',
						};
					}
					break;
				}
				case 'geodesicEnd': {
					const updSuccess = AppStateReducer.applyUpd(draftAppState, {
						t: 'geodesicEnd',
						uniqName: userState.uniqName,
						newPtRef: geomObj.uniqName,
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
		geomObj: ResolvedGeomObjSpec,
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

	let instructionMsg = null;
	switch (appState.userState.t) {
		case 'geodesicStart': {
			instructionMsg = 'select geodesic starting point';
			break;
		}
		case 'geodesicEnd': {
			instructionMsg = 'select geodesic ending point';
			break;
		}
		case 'free': {
			break;
		}
		default: {
			assertUnhandledType(appState.userState);
		}
	}

	const instructionMsgDom = (instructionMsg == null) ? null : (
		<div
			className="notif-pane instruction-pane"
		>
			{ instructionMsg }
		</div>
	);

	const errMsgDom = (appState.errMsg == null) ? null : (
		<div
			className="notif-pane error-pane"
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
				userState={appState.userState}
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
				<div
					className="notifs-pane"
				>
					{ instructionMsgDom }
					{ errMsgDom }
				</div>
			</div>
			<div className="objs-editor-pane">
				<ObjsEditorView
					earth={appState.earth}
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
