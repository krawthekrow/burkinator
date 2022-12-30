import React, { useRef, useState, useEffect } from 'react';
import { useImmer } from 'use-immer';
import { Wrapper, Status } from "@googlemaps/react-wrapper";
import './App.css'
import { assertUnhandledType } from './Misc';
import { DEFAULT_EARTH_MODEL } from './EarthModel';
import {
	ReactiveTextInput, ReactiveCheckbox, ReactiveButtonGroup
} from './ReactiveFormComponents';
import {
	GeomObjName, GeomObjSpec, ResolvedGeomObjSpec,
	newGeomObjName,
} from './GeomObj';
import { MapObjName, newMapObjName } from './MapObj';
import { StateUpd } from './StateUpd';
import { UserState } from './UserState';
import {
	AppState, AppStateReducer,
	geomObjsToMapObjs, genUniqName, validateUniqName,
} from './AppState';
import MapView, { MapObjSpec } from './MapView';
import ObjsEditorView from './ObjsEditorView';

import LatLngLiteral = google.maps.LatLngLiteral;

const APP_VERSION = '0.1';

const Toolbar = (
	{appState, onUpdate, onUndo, onRedo, onMore, onCancel}: {
		appState: AppState,
		onUpdate: (upd: StateUpd) => void,
		onUndo: () => void,
		onRedo: () => void,
		onMore: () => void,
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

	const handleClear = (
		e: React.MouseEvent<HTMLButtonElement>
	) => {
		onUpdate({
			t: 'replace',
			newObjs: [],
		});
	};

	const cancelButtonDom = [
		'geodesicStart', 'geodesicEnd',
	].includes(userState.t) ? <button
		className="toolbar-button"
		disabled={false}
		onClick={onCancel}
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
			onClick={onUndo}
		>Undo</button>
		<button
			className="toolbar-button"
			disabled={userState.t != 'free' || !redoEnabled}
			onClick={onRedo}
		>Redo</button>
		<button
			className="toolbar-button"
			disabled={userState.t != 'free'}
			onClick={handleClear}
		>Clear</button>
		<button
			className="toolbar-button"
			disabled={userState.t != 'free'}
			onClick={onMore}
		>More...</button>
		{ cancelButtonDom }
	</>;
};

const stringifyGeomObjs = (geomObjs: GeomObjSpec[]): string => {
	return `v${APP_VERSION}\n` +
		geomObjs.map((geomObj) => {
			switch (geomObj.t) {
				case 'point': {
					return [
						'P',
						geomObj.uniqName,
						geomObj.pos.lat.toString(),
						geomObj.pos.lng.toString(),
						geomObj.mapLabel,
					].join('\t');
				}
				case 'geodesic': {
					const entries = [
						'G',
						geomObj.uniqName,
						(geomObj.ptStart == '') ? '$' : geomObj.ptStart,
						(geomObj.ptEnd == '') ? '$' : geomObj.ptEnd,
						geomObj.useFarArc ? 'far' : 'near',
					];
					if (geomObj.destPtEnabled) {
						entries.push(
							geomObj.destPtTurnAngle.toString(),
							geomObj.destPtDist.toString(),
							geomObj.destPtMapLabel,
						);
					}
					return entries.join('\t');
				}
				default: {
					assertUnhandledType(geomObj);
				}
			}
		}).join('\n');
};

const parseGeomObjs = (appState: AppState, spec: string): [
	string | null, GeomObjSpec[] | null
] => {
	const lines = spec.split('\n');
	let versionLine = undefined;
	let lineNum = 0;
	while (versionLine == undefined || versionLine.trim() == '') {
		versionLine = lines.shift();
		lineNum++;
	}
	if (versionLine == undefined) {
		return ['version line missing', null];
	}
	if (versionLine[0] == 'v') {
		if (versionLine != `v${APP_VERSION}`) {
			return [`wrong version; current version is ${APP_VERSION}`, null];
		}
	}
	else {
		// put the line back; assume version line was omitted
		lines.splice(0, 0, versionLine);
	}

	const makeErrRet = (errMsg: string): [
		string, null
	] => {
		return [`line ${lineNum}: ${errMsg}`, null];
	};

	const geomObjs: GeomObjSpec[] = [];
	while (true) {
		const line = lines.shift();
		lineNum++;

		if (line == undefined) {
			break;
		}

		const params = line.trim().split(/\s+/);

		const kindEncoded = params.shift();
		if (kindEncoded == undefined || kindEncoded == '') {
			continue;
		}

		let uniqName = params.shift();
		if (uniqName == undefined) {
			return makeErrRet('name missing');
		}
		if (uniqName == '$') {
			uniqName = genUniqName(appState);
		}
		const uniqNameErr = validateUniqName(uniqName);
		if (uniqNameErr) {
			return makeErrRet(uniqNameErr);
		}

		switch (kindEncoded) {
			case 'P': {
				const latVal = params.shift();
				if (latVal == undefined) {
					return makeErrRet(`no lat provided`);
				}
				const lat = Number(latVal);
				if (isNaN(lat)) {
					return makeErrRet(`unable to parse lat "${latVal}"`);
				}

				const lngVal = params.shift();
				if (lngVal == undefined) {
					return makeErrRet(`no lng provided`);
				}
				const lng = Number(lngVal);
				if (isNaN(lng)) {
					return makeErrRet(`unable to parse lng "${lngVal}"`);
				}

				let mapLabel = params.shift();
				if (mapLabel == undefined) {
					mapLabel = '';
				}

				if (params.length > 0) {
					return makeErrRet(`too many params`);
				}

				geomObjs.push({
					t: 'point',
					uniqName: newGeomObjName(uniqName),
					pos: { lat: lat, lng: lng },
					mapLabel: mapLabel,
				});
				break;
			}
			case 'G': {
				let ptStart = params.shift();
				if (ptStart == undefined) {
					return makeErrRet('start point missing');
				}
				if (ptStart == '$') {
					ptStart = '';
				}

				let ptEnd = params.shift();
				if (ptEnd == undefined) {
					return makeErrRet('end point missing');
				}
				if (ptEnd == '$') {
					ptStart = '';
				}

				const useFarArcVal = params.shift();
				let useFarArc = false;
				if (useFarArcVal != undefined) {
					switch (useFarArcVal) {
						case 'near': {
							useFarArc = false;
							break;
						}
						case 'far': {
							useFarArc = true;
							break;
						}
						default: {
							return makeErrRet(
								`invalid bool (useFarArc) "${useFarArcVal}"`
							);
						}
					}
				}

				let destPtTurnAngle: number | undefined = 0;
				let destPtDist: number | undefined = 0;
				let destPtMapLabel: string | undefined = '';
				let destPtEnabled = false;

				const destPtTurnAngleVal = params.shift();
				if (destPtTurnAngleVal != undefined) {
					destPtEnabled = true;
					destPtTurnAngle = Number(destPtTurnAngleVal);
					if (isNaN(destPtTurnAngle)) {
						return makeErrRet(
							`unable to parse dest pt turn angle "${destPtTurnAngle}"`
						);
					}

					const destPtDistVal = params.shift();
					if (destPtDistVal == undefined) {
						return makeErrRet(`no dest pt distance provided`);
					}
					destPtDist = Number(destPtDistVal);
					if (isNaN(destPtDist)) {
						return makeErrRet(
							`unable to parse dest pt distance "${destPtDistVal}"`
						);
					}

					destPtMapLabel = params.shift();
					if (destPtMapLabel == undefined) {
						destPtMapLabel = '';
					}
				}

				if (params.length > 0) {
					return makeErrRet(`too many params`);
				}

				geomObjs.push({
					t: 'geodesic',
					uniqName: newGeomObjName(uniqName),
					ptStart: newGeomObjName(ptStart),
					ptEnd: newGeomObjName(ptEnd),
					useFarArc: useFarArc,
					destPtEnabled: destPtEnabled,
					destPtTurnAngle: destPtTurnAngle,
					destPtDist: destPtDist,
					destPtMapLabel: destPtMapLabel,
				});
				break;
			}
			default: {
				// assume it's a point
				const param1 = kindEncoded;
				const param2 = uniqName;
				const param3 = params.shift();
				const param4 = params.shift();
				let lat: number;
				let lng: number;
				let latVal: string;
				let lngVal: string;
				let mapLabel: string;

				if (params.length > 0) {
					return makeErrRet(`too many params (raw point)`);
				}

				if (
					param3 == undefined || (
						!isNaN(Number(param1)) &&
						isNaN(Number(param3))
					)
				) {
					// assume no uniqName provided
					uniqName = genUniqName(appState);
					latVal = param1;
					lngVal = param2;
					mapLabel = (param3 == undefined) ? '' : param3;
				}
				else {
					if (param3 == undefined) {
						return makeErrRet(`no lng provided`);
					}

					uniqName = param1;
					latVal = param2;
					lngVal = param3;
					mapLabel = (param4 == undefined) ? '' : param4;

					if (uniqName == '$') {
						uniqName = genUniqName(appState);
					}
				}

				lat = Number(latVal);
				lng = Number(lngVal);
				if (isNaN(lat)) {
					return makeErrRet(`unable to parse lat "${latVal}"`);
				}
				if (isNaN(lng)) {
					return makeErrRet(`unable to parse lng "${lngVal}"`);
				}

				const newUniqNameErr = validateUniqName(uniqName);
				if (newUniqNameErr) {
					return makeErrRet(newUniqNameErr);
				}

				geomObjs.push({
					t: 'point',
					uniqName: newGeomObjName(uniqName),
					pos: { lat: lat, lng: lng },
					mapLabel: mapLabel,
				});
			}
		}
	}
	return [null, geomObjs];
};

const saveState = (geomObjs: GeomObjSpec[]): void => {
	const exportStr = stringifyGeomObjs(geomObjs);
	try {
		localStorage.setItem('__burkinator_state', JSON.stringify(exportStr));
	}
	catch { }
};

const loadState = (appState: AppState): GeomObjSpec[] => {
	let importStrRaw: string | null = null;
	let importStr: string = '';

	try {
		importStrRaw = localStorage.getItem('__burkinator_state');
	} catch { }
	if (importStrRaw == null) {
		// no saved state; use initial sample data
		importStr = 'v0.1\nP\tobj5\t11.725384459061823\t-2.0012229261396275\tH\nP\tobj6\t-32.916978560354714\t-55.937791024638614\tI\nG\tobj4\tobj5\tobj6\tnear\nP\tobj8\t45.75979893594823\t25.04040783555398\tP\nG\tobj7\tobj6\tobj8\tnear\nP\tobj10\t1.8429791650053304\t-157.3915042181933\tU\nG\tobj9\tobj8\tobj10\tnear\nP\tobj12\t32.93790942634668\t42.66835104582444\tZ\nG\tobj11\tobj10\tobj12\tnear\nP\tobj14\t17.584579687927402\t10.060929170824439\tZ\nG\tobj13\tobj12\tobj14\tnear\nP\tobj16\t-12.186232267617358\t17.97108542082444\tL\nG\tobj15\tobj14\tobj16\tnear\nP\tobj18\t-7.07556349812708\t35.10975729582444\tE\nG\tobj17\tobj16\tobj18\tnear\nP\tobj20\t19.702166441496587\t55.91172922600376\tR\nG\tobj19\tobj18\tobj20\tnear\nP\tobj22\t-1.8841461608329453\t29.84568563177587\tS\nG\tobj21\tobj20\tobj22\tnear';
	}
	else {
		importStr = JSON.parse(importStrRaw);
	}

	const [importErr, geomObjs] = parseGeomObjs(appState, importStr);
	if (importErr) {
		console.error(importErr);
		console.error(importStr);
		try {
			localStorage.setItem(
				'__burkinator_err_state',
				JSON.stringify(importStr)
			);
		}
		catch { }
		return [];
	}
	if (geomObjs == null) {
		throw new Error('geomObjs should exist if no error');
	}
	return geomObjs;
};

const MoreFeaturesModal = (
	{appState, onImport, onDone}: {
		appState: AppState,
		onImport: (importStr: string) => void,
		onDone: () => void,
	}
): JSX.Element | null => {
	const apiKeyRef = useRef<HTMLInputElement>(null);
	const [exportText, setExportText] = useState('');

	useEffect(() => {
		if (appState.userState.t == 'more') {
			setExportText(stringifyGeomObjs(appState.geomObjs));
		}
	}, [appState.userState.t]);

	const handleCommitApiKey = (): void => {
		if (apiKeyRef.current != null) {
			const newApiKey = apiKeyRef.current.value.trim();
			if (appState.apiKey != newApiKey) {
				localStorage.setItem('__burkinator_apiKey', newApiKey);
				location.reload();
			}
		}
	};

	if (appState.userState.t != 'more') {
		return null;
	}

	const handleChangeExportText = (
		e: React.ChangeEvent<HTMLTextAreaElement>
	): void => {
		setExportText(e.target.value);
	};

	const handleImport = (): void => {
		onImport(exportText);
	};

	const handleExport = (): void => {
		setExportText(stringifyGeomObjs(appState.geomObjs));
	};

	const importErr = appState.userState.importErr;
	const importErrDom = (importErr == '') ? null : <div
		className="import-err"
	>
		Error: { importErr }
	</div>;

	return <div className="modal">
		<div className="modal-pane">
			<div>
				<h3>Google Maps API key</h3>
			</div>
			<div className="api-key-row">
				<div className="api-key-cell-input">
					<input
						type="text"
						className="api-key-input"
						defaultValue={appState.apiKey}
						ref={apiKeyRef}
					/>
				</div>
				<div className="api-key-cell-label">
					<button
						onClick={handleCommitApiKey}
					>
						Set API key
					</button>
				</div>
			</div>
			<div>
				<h3>Import/Export</h3>
				<p>Note: You can also import points just by specifying, for each point, a latitude, longitude, and optionally a label.</p>
			</div>
			<div>
				<textarea
					className="export-textarea"
					value={exportText}
					onChange={handleChangeExportText}
				/>
			</div>
			{ importErrDom }
			<div className="modal-buttons-pane">
				<button
					className="export-button"
					onClick={handleImport}
				>Import</button>
				<button
					className="export-button"
					onClick={handleExport}
				>Export</button>
				<div className="modal-done-button-cell">
					<button
						className="export-button modal-done-button"
						onClick={onDone}
					>Done</button>
				</div>
			</div>
		</div>
	</div>;
};

const App = (): JSX.Element => {
	const initEarth = DEFAULT_EARTH_MODEL;
	const [appState, setAppState] = useImmer<AppState>(() => {
		let apiKey: string | null = null;
		try {
			apiKey = localStorage.getItem('__burkinator_apiKey');
		}
		catch { }
		if (apiKey == null) {
			apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
		}
		if (apiKey == null) {
			apiKey = '';
		}
		const initAppState: AppState = {
			apiKey: apiKey,
			earth: initEarth,
			userState: { t: 'free' },
			updHistory: [],
			updHistoryIndex: 0,
			updHistoryAcceptMerge: false,
			updHistoryNextAcceptMerge: false,
			geomObjs: [],
			mapObjs: [],
			// last used id to assign each object a unique default name
			lastUsedId: 0,
			mapCenter: {lat: 0, lng: 0},
			mapZoom: 1,
			errMsg: null,
		};
		const loadedObjs = loadState(initAppState);
		if (loadedObjs.length > 0) {
			initAppState.geomObjs = loadedObjs;
			initAppState.mapObjs = geomObjsToMapObjs(initEarth, loadedObjs);
		}
		return initAppState;
	});

	const renderErr = (status: Status) => {
		return <h2>{status}</h2>;
	};

	const handleMapClick = (pos: LatLngLiteral) => {
		setAppState((draftAppState) => {
			const userState = draftAppState.userState;
			AppStateReducer.startNewAction(draftAppState);
			switch (userState.t) {
				case 'free': {
					AppStateReducer.applyUpd(draftAppState, {
						t: 'newPoint',
						pos: pos,
					});
					break;
				}
				case 'geodesicStart': {
					const newPtName = genUniqName(draftAppState);
					AppStateReducer.applyUpd(draftAppState, {
						t: 'newPoint',
						uniqName: newPtName,
						pos: pos,
						insertBeforeUniqName: userState.uniqName,
					});
					AppStateReducer.applyUpd(draftAppState, {
						t: 'geodesicStart',
						uniqName: userState.uniqName,
						newPtRef: newPtName,
					});
					break;
				}
				case 'geodesicEnd': {
					const newPtName = genUniqName(draftAppState);
					AppStateReducer.applyUpd(draftAppState, {
						t: 'newPoint',
						uniqName: newPtName,
						pos: pos,
						insertBeforeUniqName: userState.uniqName,
					});
					AppStateReducer.applyUpd(draftAppState, {
						t: 'geodesicEnd',
						uniqName: userState.uniqName,
						newPtRef: newPtName,
					});
					break;
				}
				case 'more': {
					break;
				}
				default: {
					assertUnhandledType(userState);
				}
			}
			saveState(draftAppState.geomObjs);
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
			saveState(draftAppState.geomObjs);
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
					AppStateReducer.applyUpd(draftAppState, {
						t: 'geodesicStart',
						uniqName: userState.uniqName,
						newPtRef: geomObj.uniqName,
					});
					break;
				}
				case 'geodesicEnd': {
					AppStateReducer.applyUpd(draftAppState, {
						t: 'geodesicEnd',
						uniqName: userState.uniqName,
						newPtRef: geomObj.uniqName,
					});
					break;
				}
			}
			saveState(draftAppState.geomObjs);
		});
	};

	const handleMarkerRightClick = (
		markerName: MapObjName,
		geomObj: ResolvedGeomObjSpec,
	) => {
		setAppState((draftAppState) => {
			AppStateReducer.startNewAction(draftAppState);
			AppStateReducer.applyUpd(draftAppState, {
				t: 'delete',
				uniqName: geomObj.uniqName,
			});
			saveState(draftAppState.geomObjs);
		});
	};

	const handleUpdate = (
		upd: StateUpd
	) => {
		setAppState((draftAppState) => {
			AppStateReducer.startNewAction(draftAppState);
			AppStateReducer.applyUpd(draftAppState, upd);
			saveState(draftAppState.geomObjs);
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
			saveState(draftAppState.geomObjs);
		});
	};

	const handleRedo = () => {
		setAppState((draftAppState) => {
			AppStateReducer.startNewAction(draftAppState);
			AppStateReducer.applyRedo(draftAppState);
			saveState(draftAppState.geomObjs);
		});
	};

	const handleMore = () => {
		setAppState((draftAppState) => {
			AppStateReducer.startNewAction(draftAppState);
			draftAppState.userState = {
				t: 'more',
				importErr: '',
			};
			saveState(draftAppState.geomObjs);
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
				case 'free':
				case 'more': {
					throw new Error('nothing to cancel');
				}
				default: {
					assertUnhandledType(draftAppState.userState);
				}
			}
		});
	};

	const handleModalDone = (): void => {
		setAppState((draftAppState) => {
			draftAppState.userState = {
				t: 'free',
			};
			saveState(draftAppState.geomObjs);
		});
	};

	const handleImport = (importStr: string): void => {
		setAppState((draftAppState) => {
			if (draftAppState.userState.t != 'more') {
				throw new Error('user should have more modal open');
			}
			const [importErr, newObjs] = parseGeomObjs(
				draftAppState, importStr
			);
			if (importErr == null) {
				if (newObjs == null) {
					throw new Error('newObjs should not be null if no error');
				}
				AppStateReducer.applyMerge(
					draftAppState, newObjs
				);
				draftAppState.userState.importErr = '';
			}
			else {
				draftAppState.userState.importErr = importErr;
			}
			saveState(draftAppState.geomObjs);
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
		case 'free':
		case 'more': {
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
		apiKey={appState.apiKey}
		render={renderErr}
	>
		<div className="app-pane">
			<div className="toolbar-pane">
				<Toolbar
					appState={appState}
					onUpdate={handleUpdate}
					onUndo={handleUndo}
					onRedo={handleRedo}
					onMore={handleMore}
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
		</div>
		<MoreFeaturesModal
			appState={appState}
			onImport={handleImport}
			onDone={handleModalDone}
		/>
	</Wrapper>;
};

export default App;
