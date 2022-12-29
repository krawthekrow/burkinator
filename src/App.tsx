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
	{appState, onUpdate, onUndo, onRedo, onCancel}: {
		appState: AppState,
		onUpdate: (upd: StateUpd) => void,
		onUndo: () => void,
		onRedo: () => void,
		onCancel: () => void,
	}
): JSX.Element => {
	const userState = appState.userState;
	const undoEnabled = appState.updHistoryIndex > 0;
	const redoEnabled =
		appState.updHistoryIndex < appState.updHistory.length;

	const handleClickNewGeodesic = (
		e: React.MouseEvent<HTMLButtonElement>
	) => {
		onUpdate({
			t: 'newGeodesic',
		});
	};

	const handleClickUndo = (
		e: React.MouseEvent<HTMLButtonElement>
	) => {
		onUndo();
	};

	const handleClickRedo = (
		e: React.MouseEvent<HTMLButtonElement>
	) => {
		onRedo();
	};

	const handleClickCancel = (
		e: React.MouseEvent<HTMLButtonElement>
	) => {
		onCancel();
	};

	const cancelButtonDom = [
		'geodesicStart', 'geodesicEnd',
	].includes(userState.t) ? <button
		className="toolbar-button"
		disabled={false}
		onClick={handleClickCancel}
	>
		Cancel
	</button> : null;

	return <>
		<button
			className="toolbar-button"
			disabled={userState.t != 'free'}
			onClick={handleClickNewGeodesic}
		>Add Line</button>
		<button
			className="toolbar-button"
			disabled={userState.t != 'free' || !undoEnabled}
			onClick={handleClickUndo}
		>Undo</button>
		<button
			className="toolbar-button"
			disabled={userState.t != 'free' || !redoEnabled}
			onClick={handleClickRedo}
		>Redo</button>
		{ cancelButtonDom }
	</>;
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
		updHistory: [],
		updHistoryIndex: 0,
		updHistoryAcceptMerge: false,
		updHistoryNextAcceptMerge: false,
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
			AppStateReducer.startNewAction(draftAppState);
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
			AppStateReducer.startNewAction(draftAppState);
			draftAppState.updHistoryNextAcceptMerge = true;
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
			AppStateReducer.startNewAction(draftAppState);
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
			AppStateReducer.startNewAction(draftAppState);
			const userState = draftAppState.userState;
			switch (userState.t) {
				case 'geodesicStart': {
					const updSuccess = AppStateReducer.applyUpd(draftAppState, {
						t: 'geodesicStart',
						uniqName: userState.uniqName,
						newPtRef: geomObj.uniqName,
					});
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
			AppStateReducer.startNewAction(draftAppState);
			// TODO: remove marker
		});
	};

	const handleUpdate = (
		upd: StateUpd
	) => {
		setAppState((draftAppState) => {
			AppStateReducer.startNewAction(draftAppState);
			AppStateReducer.applyUpd(draftAppState, upd);
		});
	};

	const handleUserStateUpdate = (
		newState: UserState
	) => {
		setAppState((draftAppState) => {
			AppStateReducer.startNewAction(draftAppState);
			draftAppState.userState = newState;
		});
	};

	const handleUndo = () => {
		setAppState((draftAppState) => {
			AppStateReducer.startNewAction(draftAppState);
			AppStateReducer.applyUndo(draftAppState);
		});
	};

	const handleRedo = () => {
		setAppState((draftAppState) => {
			AppStateReducer.startNewAction(draftAppState);
			AppStateReducer.applyRedo(draftAppState);
		});
	};

	const handleCancel = () => {
		setAppState((draftAppState) => {
			AppStateReducer.startNewAction(draftAppState);
			switch (draftAppState.userState.t) {
				case 'geodesicStart':
				case 'geodesicEnd': {
					draftAppState.userState = {
						t: 'free'
					};
					break;
				}
				case 'free': {
					throw new Error('nothing to cancel');
				}
				default: {
					assertUnhandledType(draftAppState.userState);
				}
			}
		});
	};

	let instructionMsg: string | null = null;
	switch (appState.userState.t) {
		case 'geodesicStart': {
			instructionMsg = 'select starting point';
			break;
		}
		case 'geodesicEnd': {
			instructionMsg = 'select ending point';
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
				appState={appState}
				onUpdate={handleUpdate}
				onUndo={handleUndo}
				onRedo={handleRedo}
				onCancel={handleCancel}
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
