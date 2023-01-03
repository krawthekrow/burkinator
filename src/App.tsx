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
const GEOCODING_THROTTLE = 1000; // milliseconds
const GEOCODING_MAX_NUM_TRIES = 3;

const geocoderCache: { [ address: string ]: LatLngLiteral } = {};

const doGeocode = (
	geocoder: google.maps.Geocoder,
	address: string,
	onPos: (pos: LatLngLiteral) => void,
	onErr: (errMsg: string) => void
): void => {
	const cachedPos = geocoderCache[address];
	if (cachedPos != undefined) {
		onPos(cachedPos);
		return;
	}
	const registerPos = (pos: LatLngLiteral) => {
		geocoderCache[address] = pos;
		onPos(pos);
	};
	let numTries = 0;
	const tryGeocode = () => {
		if (numTries >= GEOCODING_MAX_NUM_TRIES) {
			onErr('The google maps geocoder api traffic is too high. Please get your own API key.');
			return;
		}
		geocoder.geocode({ 'address': address }, (results, gStatus) => {
			switch (gStatus) {
				case 'OK': {
					const result = results[0];
					if (result == undefined) {
						throw new Error('status ok should have at least one result');
					}
					registerPos(result.geometry.location.toJSON());
					break;
				}
				case 'ZERO_RESULTS': {
					onErr('google maps geocoder: no results');
					break;
				}
				case 'OVER_QUERY_LIMIT': {
					numTries++;
					setTimeout(
						tryGeocode,
						GEOCODING_THROTTLE * Math.pow(2, numTries)
					);
					tryGeocode();
					break;
				}
				case 'REQUEST_DENIED': {
					if (import.meta.env.MODE == 'development') {
						registerPos({ lat: 0, lng: 0 });
					}
					else {
						onErr('google maps geocoder: request denied');
					}
					break;
				}
				default: {
					onErr('google maps geocoder: unknown error');
				}
			}
		});
	};
	tryGeocode();
};

const LocateTool = (
	{ geocoder, onUpdate, onErr }: {
		geocoder: google.maps.Geocoder,
		onUpdate: (upd: StateUpd) => void,
		onErr: (errMsg: string) => void,
	}
): JSX.Element => {
	const [query, setQuery] = useState('');

	const handleQueryChange = (
		e: React.ChangeEvent<HTMLInputElement>
	): void => {
		setQuery(e.target.value);
	};

	const doLocate = (
	): void => {
		doGeocode(geocoder, query.trim(), (pos: LatLngLiteral) => {
			onUpdate({
				t: 'newPoint',
				pos: pos,
			});
		}, onErr);
		setQuery('');
	};

	const handleLocateClick = (): void => {
		doLocate();
	};

	const handleKeyDown = (
		e: React.KeyboardEvent<HTMLInputElement>
	) => {
		if (e.key == 'Enter') {
			doLocate();
		}
	};

	return <span className="locate-tool">
		<input
			type="text"
			className="locate-tool-input"
			value={query}
			onChange={handleQueryChange}
			onKeyDown={handleKeyDown}
		/>
		<button
			disabled={query.trim() == ''}
			onClick={handleLocateClick}
		>
			Add Point
		</button>
	</span>;
};

const Toolbar = (
	{
		appState, onUpdate, onErr,
		onUndo, onRedo, onMore, onCancel,
		onChangeAutoscroll,
	}: {
		appState: AppState,
		onUpdate: (upd: StateUpd) => void,
		onErr: (errMsg: string) => void,
		onUndo: () => void,
		onRedo: () => void,
		onMore: () => void,
		onCancel: () => void,
		onChangeAutoscroll: (newVal: boolean) => void,
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
		{ (appState.geocoder == null) ? null :
			<LocateTool
				geocoder={appState.geocoder}
				onUpdate={onUpdate}
				onErr={onErr}
			/>
		}
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
		<ReactiveCheckbox
			val={appState.settings.autoscroll}
			disabled={false}
			className={'autoscroll-checkbox'}
			onChange={onChangeAutoscroll}
		/> Autoscroll
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

type ImportState = {
	linesRemaining: string[];
	lineNum: number;
	importedObjs: GeomObjSpec[];
	pendingGeocoderJobs: string[];
	errMsg: string;
}

// performs one step of parsing and returns whether it's done
const parseGeomObjStep = (
	appState: AppState,
	importState: ImportState,
	// only non-null during geocode dry run
	onGeocodeDone: ((importState: ImportState) => void) | null,
	onGeocodeStatusChange: ((msg: string) => void) | null
): boolean => {
	const isGeocodingRun = onGeocodeDone != null;
	const line = importState.linesRemaining.shift();
	importState.lineNum++;

	const genUniqNameIfNotGeocoding = (genPrefix: string): GeomObjName => {
		if (isGeocodingRun) {
			return newGeomObjName(genPrefix);
		}
		return genUniqName(appState, genPrefix);
	}

	if (line == undefined) {
		return true;
	}

	const setLineErr = (
		errMsg: string, nextAppState: AppState = appState
	): void => {
		importState.errMsg = `line ${importState.lineNum}: ${errMsg}`;
	};

	const params = line.trim().split('\t');

	const kindEncoded = params.shift();
	if (kindEncoded == undefined || kindEncoded == '') {
		return false;
	}

	let uniqName = '';
	// return true if it encounters a parse error
	const parseUniqName = (genPrefix: string): boolean =>  {
		const uniqNameVal = params.shift();
		if (uniqNameVal == undefined) {
			setLineErr('name missing');
			return true;
		}
		uniqName = uniqNameVal;
		const uniqNameErr = validateUniqName(uniqName);
		if (uniqNameErr) {
			setLineErr(uniqNameErr);
			return true;
		}

		if (uniqName == '$') {
			uniqName = genUniqNameIfNotGeocoding(genPrefix);
		}
		return false;
	};

	let pos = { lat: 0, lng: 0 };
	// return true if it encounters a parse error
	const parseLocation = (): boolean => {
		const param1 = params.shift();
		if (param1 == undefined) {
			setLineErr(`no location provided`);
			return true;
		}

		const param1Num = Number(param1);
		if (!isNaN(param1Num)) {
			pos.lat = param1Num;

			const lngVal = params.shift();
			if (lngVal == undefined) {
				setLineErr(`no lng provided`);
				return true;
			}
			pos.lng = Number(lngVal);
			if (isNaN(pos.lng)) {
				setLineErr(`unable to parse lng "${lngVal}"`);
				return true;
			}
			
			return false;
		}

		// if first param is not a number, then geocode it
		const query = param1.trim();
		if (query == '') {
			throw new Error('empty strings should be treated as a lat');
		}
		const cachedPos = geocoderCache[query];
		if (isGeocodingRun) {
			if (cachedPos == undefined) {
				const geocoder = appState.geocoder;
				if (geocoder == null) {
					setLineErr('google maps geocoder not loaded');
					return true;
				}
				const isFirstQuery = importState.pendingGeocoderJobs.length == 0;
				importState.pendingGeocoderJobs.push(query);
				if (isFirstQuery) {
					const doOneGeocode = () => {
						const nextQuery = importState.pendingGeocoderJobs.shift();
						if (nextQuery == undefined) {
							onGeocodeDone(importState);
							return;
						}
						if (geocoderCache[nextQuery]) {
							// fast path in case we already did it along the way
							doOneGeocode();
							return;
						}
						if (onGeocodeStatusChange == null) {
							throw new Error('onGeocodeStatusChange should be set during the geocoding run');
						}
						onGeocodeStatusChange(`geocoding "${nextQuery.trim()}"...`);
						doGeocode(
							geocoder,
							nextQuery.trim(),
							(pos) => {
								setTimeout(doOneGeocode, GEOCODING_THROTTLE);
							},
							(errMsg) => {
								setLineErr(errMsg);
								onGeocodeDone(importState);
							}
						);
					};
					setTimeout(doOneGeocode, 0);
				}
			}
			return false;
		}

		if (cachedPos == undefined) {
			throw new Error('should not try to parse if not fully geocoded');
		}
		pos = cachedPos;
		return false;
	};

	// return true if it encounters a parse error
	const parsePoint = (): boolean => {
		const param1 = params[0];
		if (param1 == undefined) {
			setLineErr(`missing point params`);
			return true;
		}
		if (isNaN(Number(param1))) {
			if (parseUniqName('p')) {
				return true;
			}
		}
		else {
			uniqName = genUniqNameIfNotGeocoding('p');
		}

		if (parseLocation()) {
			return true;
		}

		let mapLabel = params.shift();
		if (mapLabel == undefined) {
			mapLabel = '';
		}

		if (params.length > 0) {
			setLineErr(`too many params`);
			return true;
		}

		importState.importedObjs.push({
			t: 'point',
			uniqName: newGeomObjName(uniqName),
			pos: pos,
			mapLabel: mapLabel,
		});
		return false;
	};

	switch (kindEncoded) {
		case 'P': {
			return parsePoint();
		}
		case 'G': {
			if (parseUniqName('g')) {
				return true;
			}

			let ptStart = params.shift();
			if (ptStart == undefined) {
				setLineErr('start point missing');
				return true;
			}
			if (ptStart == '$') {
				ptStart = '';
			}

			let ptEnd = params.shift();
			if (ptEnd == undefined) {
				setLineErr('end point missing');
				return true;
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
						setLineErr(
							`invalid bool (useFarArc) "${useFarArcVal}"`
						);
						return true;
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
					setLineErr(
						`unable to parse dest pt turn angle "${destPtTurnAngle}"`
					);
					return true;
				}

				const destPtDistVal = params.shift();
				if (destPtDistVal == undefined) {
					setLineErr(`no dest pt distance provided`);
					return true;
				}
				destPtDist = Number(destPtDistVal);
				if (isNaN(destPtDist)) {
					setLineErr(
						`unable to parse dest pt distance "${destPtDistVal}"`
					);
					return true;
				}

				destPtMapLabel = params.shift();
				if (destPtMapLabel == undefined) {
					destPtMapLabel = '';
				}
			}

			if (params.length > 0) {
				setLineErr(`too many params`);
				return true;
			}

			importState.importedObjs.push({
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
			return false;
		}
		default: {
			// put the first param back
			params.splice(0, 0, kindEncoded);
			return parsePoint();
		}
	}
};

const parseGeomObjs = (
	appState: AppState,
	spec: string,
	// only non-null during geocode dry run
	onGeocodeDone: ((importState: ImportState) => void) | null,
	onGeocodeStatusChange: ((msg: string) => void) | null
): ImportState => {
	const importState = {
		linesRemaining: spec.split('\n'),
		lineNum: 0,
		importedObjs: [],
		pendingGeocoderJobs: [],
		errMsg: '',
	};

	let versionLine = undefined;
	while (versionLine == undefined || versionLine.trim() == '') {
		versionLine = importState.linesRemaining.shift();
		importState.lineNum++;
	}
	if (versionLine == undefined) {
		importState.errMsg = 'version line missing';
		return importState;
	}
	if (versionLine[0] == 'v') {
		if (versionLine != `v${APP_VERSION}`) {
			importState.errMsg =
				`wrong version; current version is ${APP_VERSION}`;
			return importState;
		}
	}
	else {
		// put the line back; assume version line was omitted
		importState.linesRemaining.splice(0, 0, versionLine);
		importState.lineNum--;
	}

	while (!parseGeomObjStep(
		appState, importState, onGeocodeDone, onGeocodeStatusChange
	)) {
	}
	if (onGeocodeDone && importState.pendingGeocoderJobs.length == 0) {
		onGeocodeDone(importState);
	}
	return importState;
};

const saveState = (geomObjs: GeomObjSpec[]): void => {
	const exportStr = stringifyGeomObjs(geomObjs);
	try {
		localStorage.setItem('__burkinator_state', JSON.stringify(exportStr));
	}
	catch { }
};

const getLoadStr = (): string => {
	let loadStrRaw: string | null = null;

	try {
		loadStrRaw = localStorage.getItem('__burkinator_state');
	} catch { }
	if (loadStrRaw == null) {
		// no saved state; use initial sample data
		return 'v0.1\nP\tobj5\t11.725384459061823\t-2.0012229261396275\tH\nP\tobj6\t-32.916978560354714\t-55.937791024638614\tI\nG\tobj4\tobj5\tobj6\tnear\nP\tobj8\t45.75979893594823\t25.04040783555398\tP\nG\tobj7\tobj6\tobj8\tnear\nP\tobj10\t1.8429791650053304\t-157.3915042181933\tU\nG\tobj9\tobj8\tobj10\tnear\nP\tobj12\t32.93790942634668\t42.66835104582444\tZ\nG\tobj11\tobj10\tobj12\tnear\nP\tobj14\t17.584579687927402\t10.060929170824439\tZ\nG\tobj13\tobj12\tobj14\tnear\nP\tobj16\t-12.186232267617358\t17.97108542082444\tL\nG\tobj15\tobj14\tobj16\tnear\nP\tobj18\t-7.07556349812708\t35.10975729582444\tE\nG\tobj17\tobj16\tobj18\tnear\nP\tobj20\t19.702166441496587\t55.91172922600376\tR\nG\tobj19\tobj18\tobj20\tnear\nP\tobj22\t-1.8841461608329453\t29.84568563177587\tS\nG\tobj21\tobj20\tobj22\tnear';
	}
	return JSON.parse(loadStrRaw);
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
	const isInterfaceDisabled =
		appState.userState.t == 'more' &&
		appState.userState.isImporting;

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
	const importInfo = appState.userState.importInfo;
	const importInfoDom = (importInfo == '') ? null : <div
		className="import-info"
	>
		{ importInfo }
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
						disabled={isInterfaceDisabled}
						ref={apiKeyRef}
					/>
				</div>
				<div className="api-key-cell-label">
					<button
						onClick={handleCommitApiKey}
						disabled={isInterfaceDisabled}
					>
						Set API key
					</button>
				</div>
			</div>
			<div className="import-instructions">
				<div className="import-instructions-left">
					<h3>Import/Export</h3>
					<p>Fields must be tab-separated. For points, you may import the first and second parameters (kind and object name). The last parameter (map label) is also optional.</p>
					<p>Instead of lat/lng, you can also specify a place name to be geocoded. If you do so, you <i>must</i> specify an object name. If you envision yourself geocoding &gt;20 or so locations, I would appreciate if you'd <a href="https://developers.google.com/maps/documentation/javascript/get-api-key">get your own API key</a>.</p>
				</div>
				<div className="import-instructions-right">
					<h3>Point examples</h3>
					<pre className="import-examples">
						{ (
							'12.24\t-1.56\tP0\n' +
							'p1\t12.24\t-1.56\tP1\n' +
							'p2\tBurkina Faso\n' +
							'p3\tBurkina Faso\tP3\n'
						).trim() }
					</pre>
				</div>
			</div>
			<div>
				<textarea
					className="export-textarea"
					value={exportText}
					disabled={isInterfaceDisabled}
					onChange={handleChangeExportText}
				/>
			</div>
			{ importInfoDom }
			{ importErrDom }
			<div className="modal-buttons-pane">
				<button
					className="export-button"
					disabled={isInterfaceDisabled}
					onClick={handleImport}
				>Import</button>
				<button
					className="export-button"
					disabled={isInterfaceDisabled}
					onClick={handleExport}
				>Export</button>
				<div className="modal-done-button-cell">
					<button
						className="export-button modal-done-button"
						disabled={isInterfaceDisabled}
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
			geocoder: null,
			userState: { t: 'loading' },
			updHistory: [],
			updHistoryIndex: 0,
			updHistoryAcceptMerge: false,
			updHistoryNextAcceptMerge: false,
			geomObjs: [],
			mapObjs: [],
			focusedObj: newGeomObjName(''),
			// last used id to assign each object a unique default name
			lastUsedId: 0,
			mapCenter: {lat: 0, lng: 0},
			mapZoom: 1,
			settings: {
				autoscroll: true,
			},
			errMsg: null,
		};
		return initAppState;
	});

	useEffect(() => {
		if (appState.userState.t != 'loading') {
			return;
		}

		const loadStr = getLoadStr();
		const handleError = (errMsg: string) => {
			console.error(errMsg);
			console.error(loadStr);
			try {
				localStorage.setItem(
					'__burkinator_err_state',
					JSON.stringify(loadStr)
				);
			}
			catch { }
		};

		parseGeomObjs(appState, loadStr, (dryRunImportState) => {
			let errMsg = dryRunImportState.errMsg;
			setAppState((draftAppState) => {
				if (errMsg == '') {
					const importState = parseGeomObjs(
						draftAppState, loadStr, null, null
					);
					errMsg = importState.errMsg;
					if (errMsg == '') {
						if (importState.importedObjs.length > 0) {
							draftAppState.geomObjs = importState.importedObjs;
							AppStateReducer.syncObjs(draftAppState);
						}
					}
				}

				if (errMsg != '') {
					handleErr(errMsg);
				}

				draftAppState.userState = {
					t: 'free',
				};
			});
		}, (msg) => {
			handleErr('saved state should not require geocoding');
			setAppState((draftAppState) => {
				draftAppState.userState = {
					t: 'free',
				};
			});
		});
	}, [appState.userState.t]);

	const renderErr = (status: Status) => {
		return <h2>{status}</h2>;
	};

	const handleMapLoad = () => {
		setAppState((draftAppState) => {
			draftAppState.geocoder = new google.maps.Geocoder();
		});
	};

	const handleMapParamsChange = (center: LatLngLiteral, zoom: number) => {
		setAppState((draftAppState) => {
			draftAppState.mapCenter = center;
			draftAppState.mapZoom = zoom;
		});
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
					const newPtName = genUniqName(draftAppState, 'p');
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
					const newPtName = genUniqName(draftAppState, 'p');
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
				case 'loading':
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
			draftAppState.focusedObj = geomObj.uniqName;
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

	const handleErr = (
		errMsg: string
	) => {
		setAppState((draftAppState) => {
			AppStateReducer.startNewAction(draftAppState);
			draftAppState.errMsg = errMsg;
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
				importInfo: '',
				isImporting: false,
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
				case 'loading':
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

	const handleChangeAutoscroll = (newVal: boolean) => {
		setAppState((draftAppState) => {
			draftAppState.settings.autoscroll = newVal;
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
			draftAppState.userState.importInfo = 'Importing...';
			draftAppState.userState.isImporting = true;
		});
		parseGeomObjs(appState, importStr, (dryRunImportState) => {
			let errMsg = dryRunImportState.errMsg;
			setAppState((draftAppState) => {
				if (draftAppState.userState.t != 'more') {
					throw new Error('user should have more modal open');
				}
				if (errMsg == '') {
					const importState = parseGeomObjs(
						draftAppState, importStr, null, null
					);
					errMsg = importState.errMsg;
					if (errMsg == '') {
						AppStateReducer.applyMerge(
							draftAppState, importState.importedObjs
						);
						draftAppState.userState.importErr = '';
						draftAppState.userState.importInfo = 'Import success!';
						draftAppState.userState.isImporting = false;
						saveState(draftAppState.geomObjs);
					}
				}

				if (errMsg != '') {
					if (draftAppState.userState.t != 'more') {
						throw new Error('user should have more modal open');
					}
					draftAppState.userState.importErr = errMsg;
					draftAppState.userState.importInfo = '';
					draftAppState.userState.isImporting = false;
				}
			});
		}, (msg) => {
			setAppState((draftAppState) => {
				if (draftAppState.userState.t != 'more') {
					throw new Error('user should have more modal open');
				}
				draftAppState.userState.importInfo = msg;
			});
		});
	};

	const handleFocusObj = (uniqName: GeomObjName) => {
		setAppState((draftAppState) => {
			draftAppState.focusedObj = uniqName;
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
		case 'loading':
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
					onErr={handleErr}
					onUndo={handleUndo}
					onRedo={handleRedo}
					onMore={handleMore}
					onCancel={handleCancel}
					onChangeAutoscroll={handleChangeAutoscroll}
				/>
			</div>
			<div className="main-pane">
				<div className="map-pane">
					<MapView
						objs={appState.mapObjs}
						center={appState.mapCenter}
						zoom={appState.mapZoom}
						markersDraggable={appState.userState.t == 'free'}
						onMapLoad={handleMapLoad}
						onMapParamsChange={handleMapParamsChange}
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
						appState={appState}
						objs={appState.geomObjs}
						onFocus={handleFocusObj}
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
