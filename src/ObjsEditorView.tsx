import React, { useRef, useState, useEffect } from 'react';
import { assertUnhandledType } from './Misc';
import {
	ReactiveTextInput, ReactiveCheckbox, ReactiveButtonGroup
} from './ReactiveFormComponents';
import {
	EarthModel,
	getNearDist, getFarDist, getNearBearing, getFarBearing,
} from './EarthModel';
import { UserState } from './UserState';
import {
	newGeomObjName, GeomObjSpec,
	ResolvedGeomPointSpec, ResolvedGeomGeodesicSpec, ResolvedGeomObjSpec,
	resolveGeomObjs, getGeomObjPos, invertGeodesicDestPt,
} from './GeomObj';
import { StateUpd } from './StateUpd';

import LatLngLiteral = google.maps.LatLngLiteral;

const distToKmString = (x :number): string => {
	if (x >= 1e3) {
		// prevent exponential notation
		return `${x.toFixed()}`;
	}
	else {
		return `${x.toPrecision(4)}`;
	}
};

const distToString = (x :number): string => {
	if (x >= 1) {
		return `${distToKmString(x)} km`;
	}
	else {
		return `${(x * 1e3).toPrecision(4)} m`;
	}
};

const angleToString = (x :number): string => {
	// prevent exponential notation
	return `${(x / Math.PI * 180).toFixed(2)}`;
};

const coordToString = (x:number): string => {
	return parseFloat(x.toFixed(8)).toString();
};

const PointEditorView = (
	{userState, obj, onUpdate}: {
		userState: UserState,
		obj: ResolvedGeomPointSpec,
		onUpdate: (upd: StateUpd) => void,
	}
) => {
	const makeUpdatePos = (pos: LatLngLiteral): StateUpd => {
		return {
			t: 'pos',
			uniqName: obj.uniqName,
			newPos: pos,
		};
	};

	const handleCommitLat = (newVal: string) => {
		onUpdate(makeUpdatePos(
			{ lat: parseFloat(newVal), lng: obj.pos.lng }
		));
	};

	const handleCommitLng = (newVal: string) => {
		onUpdate(makeUpdatePos(
			{ lat: obj.pos.lat, lng: parseFloat(newVal) }
		));
	};

	const handleCommitMapLabel = (newVal: string) => {
		onUpdate({
			t: 'mapLabel',
			uniqName: obj.uniqName,
			newMapLabel: newVal,
		});
	};

	return <>
		<div>
			Lat: <ReactiveTextInput
				val={coordToString(obj.pos.lat)}
				disabled={userState.t != 'free'}
				className="coord-input"
				onCommit={handleCommitLat}
			/>, Lng: <ReactiveTextInput
				val={coordToString(obj.pos.lng)}
				disabled={userState.t != 'free'}
				className="coord-input"
				onCommit={handleCommitLng}
			/>, Label: <ReactiveTextInput
				val={obj.mapLabel}
				disabled={userState.t != 'free'}
				className="name-input"
				onCommit={handleCommitMapLabel}
			/>
		</div>
	</>;
};

const GeodesicEditorView = (
	{earth, userState, obj, onUpdate, onUserStateUpdate}: {
		earth: EarthModel,
		userState: UserState,
		obj: ResolvedGeomGeodesicSpec,
		onUpdate: (upd: StateUpd) => void,
		onUserStateUpdate: (newState: UserState) => void,
	}
) => {
	let arcDist = null;

	const posStart = getGeomObjPos(obj.ptStart);
	const posEnd = getGeomObjPos(obj.ptEnd);
	if (posStart != null && posEnd != null) {
		arcDist = (
			obj.useFarArc ? getFarDist : getNearDist
		)(earth, posStart, posEnd);
	}
	const destPtStartPos = (posEnd != null) ? posEnd : posStart;

	const handleCommitPtStart = (newVal: string) => {
		onUpdate({
			t: 'geodesicStart',
			uniqName: obj.uniqName,
			newPtRef: newGeomObjName(newVal),
		});
	};

	const handleCommitPtEnd = (newVal: string) => {
		onUpdate({
			t: 'geodesicEnd',
			uniqName: obj.uniqName,
			newPtRef: newGeomObjName(newVal),
		});
	};

	const handleClickSelectStart = (
		e: React.MouseEvent<HTMLButtonElement>
	) => {
		onUserStateUpdate({
			t: 'geodesicStart',
			uniqName: obj.uniqName,
			doPtEndNext: false,
		});
	};

	const handleClickSelectTo = (
		e: React.MouseEvent<HTMLButtonElement>
	) => {
		onUserStateUpdate({
			t: 'geodesicEnd',
			uniqName: obj.uniqName,
		});
	};

	const useFarOptButtonTexts = ['Near', 'Far'];
	const handleChangeUseFarArc = (newVal: number) => {
		onUpdate({
			t: 'geodesicUseFarArc',
			uniqName: obj.uniqName,
			newVal: newVal == 1,
		});
	};

	const handleChangeDestPtEnabled = (newVal: boolean) => {
		onUpdate({
			t: 'geodesicDestPtEnabled',
			uniqName: obj.uniqName,
			newVal: newVal,
		});
	};

	const handleCommitDestPtTurnAngle = (newVal: string) => {
		onUpdate({
			t: 'geodesicDestPtTurnAngle',
			uniqName: obj.uniqName,
			newVal: parseFloat(newVal) / 180 * Math.PI,
		});
	};

	const handleCommitDestPtDist = (newVal: string) => {
		onUpdate({
			t: 'geodesicDestPtDist',
			uniqName: obj.uniqName,
			newVal: parseFloat(newVal),
		});
	};

	const commitDestPtPos = (pos: LatLngLiteral) => {
		const destPtParams = invertGeodesicDestPt(earth, obj, pos);
		if (destPtParams == null) {
			return;
		}
		onUpdate({
			t: 'geodesicDestPt',
			uniqName: obj.uniqName,
			newTurnAngle: destPtParams.turnAngle,
			newDist: destPtParams.dist,
		});
	};

	const handleCommitDestPtLat = (newVal: string) => {
		if (!obj.destPtPos) {
			throw new Error('expected dest pt pos to be defined');
		}
		commitDestPtPos({
			lat: parseFloat(newVal), lng: obj.destPtPos.lng
		});
	};

	const handleCommitDestPtLng = (newVal: string) => {
		if (!obj.destPtPos) {
			throw new Error('expected dest pt pos to be defined');
		}
		commitDestPtPos({
			lat: obj.destPtPos.lat, lng: parseFloat(newVal)
		});
	};

	const handleCommitDestPtMapLabel = (newVal: string) => {
		onUpdate({
			t: 'geodesicDestPtMapLabel',
			uniqName: obj.uniqName,
			newVal: newVal,
		});
	};

	const destPtParamsDom = obj.destPtEnabled ? <>
		{' '}(Turn: <ReactiveTextInput
			val={angleToString(obj.destPtTurnAngle)}
			disabled={userState.t != 'free'}
			className="coord-input"
			onCommit={handleCommitDestPtTurnAngle}
		/>°, Distance: <ReactiveTextInput
			val={distToKmString(obj.destPtDist)}
			disabled={userState.t != 'free'}
			className="coord-input"
			onCommit={handleCommitDestPtDist}
		/> km)
	</> : null;
	const destPtPosDom = (obj.destPtPos == null) ? null : <div>
		Lat: <ReactiveTextInput
			val={coordToString(obj.destPtPos.lat)}
			disabled={userState.t != 'free'}
			className="coord-input"
			onCommit={handleCommitDestPtLat}
		/>, Lng: <ReactiveTextInput
			val={coordToString(obj.destPtPos.lng)}
			disabled={userState.t != 'free'}
			className="coord-input"
			onCommit={handleCommitDestPtLng}
		/>, Label: <ReactiveTextInput
			val={obj.destPtMapLabel}
			disabled={userState.t != 'free'}
			className="name-input"
			onCommit={handleCommitDestPtMapLabel}
		/>
	</div>;
	const destPtEditorDom = obj.destPtEnabled ? <>
		{ destPtPosDom }
	</> : null;

	return <>
		<div>
			Start: <ReactiveTextInput
				val={(obj.ptStart != null) ? obj.ptStart.uniqName : ''}
				disabled={userState.t != 'free'}
				className="name-input"
				onCommit={handleCommitPtStart}
			/> <button
				className="shortcut-button"
				disabled={userState.t != 'free'}
				onClick={handleClickSelectStart}
			>
				S
			</button> (Bearing: {angleToString(obj.bearingStart)}°)
		</div>
		<div>
			End: <ReactiveTextInput
				val={(obj.ptEnd != null) ? obj.ptEnd.uniqName : ''}
				disabled={userState.t != 'free'}
				className="name-input"
				onCommit={handleCommitPtEnd}
			/> <button
				className="shortcut-button"
				disabled={userState.t != 'free'}
				onClick={handleClickSelectTo}
			>
				S
			</button> (Bearing: {angleToString(obj.bearingEnd)}°)
		</div>
		<div>
			<ReactiveButtonGroup
				buttonTexts={useFarOptButtonTexts}
				val={obj.useFarArc ? 1 : 0}
				disabled={userState.t != 'free'}
				onChange={handleChangeUseFarArc}
			/> {
				(arcDist == null) ? '' :
				`(Distance: ${distToString(arcDist)})`
			}
		</div>
		<div>
			<ReactiveCheckbox
				val={obj.destPtEnabled}
				disabled={userState.t != 'free'}
				className={''}
				onChange={handleChangeDestPtEnabled}
			/> Dest Pt
			{ destPtParamsDom }
		</div>
		{ destPtEditorDom }
	</>;
};

const ObjEditorView = (
	{earth, userState, obj, onUpdate, onUserStateUpdate}: {
		earth: EarthModel,
		userState: UserState,
		obj: ResolvedGeomObjSpec,
		onUpdate: (upd: StateUpd) => void,
		onUserStateUpdate: (newState: UserState) => void,
	}
) => {
	const getInnerEditor = (): JSX.Element => {
		switch (obj.t) {
			case 'point': {
				return <PointEditorView
					userState={userState}
					obj={obj}
					onUpdate={onUpdate}
				/>;
			}
			case 'geodesic': {
				return <GeodesicEditorView
					earth={earth}
					userState={userState}
					obj={obj}
					onUpdate={onUpdate}
					onUserStateUpdate={onUserStateUpdate}
				/>;
			}
		}
		assertUnhandledType(obj);
	};

	const handleCommitName = (newVal: string) => {
		onUpdate({
			t: 'name',
			uniqName: obj.uniqName,
			newName: newGeomObjName(newVal),
		});
	};

	const handleDelete = () => {
		onUpdate({
			t: 'delete',
			uniqName: obj.uniqName,
		});
	};

	return <div
		className="obj-editor"
	>
		<div>
			<ReactiveTextInput
				val={obj.uniqName}
				disabled={userState.t != 'free'}
				className="name-input"
				onCommit={handleCommitName}
			/>
			&nbsp; ({obj.t})
			&nbsp;<button
				className="shortcut-button del-shortcut-button"
				disabled={userState.t != 'free'}
				onClick={handleDelete}
			>
				X
			</button>
		</div>
		{getInnerEditor()}
	</div>;
};

const ObjsEditorView = (
	{earth, userState, objs, onUpdate, onUserStateUpdate}: {
		earth: EarthModel,
		userState: UserState,
		objs: GeomObjSpec[],
		onUpdate: (upd: StateUpd) => void,
		onUserStateUpdate: (newState: UserState) => void,
	}
) => {
	const resolvedObjs = resolveGeomObjs(earth, objs);
	const domObjs = resolvedObjs.map((obj) => {
		return <ObjEditorView
			key={obj.uniqName}
			earth={earth}
			userState={userState}
			obj={obj}
			onUpdate={onUpdate}
			onUserStateUpdate={onUserStateUpdate}
		/>;
	});

	return <>
		{domObjs}
	</>;
};

export default ObjsEditorView;
export type { GeomObjSpec };
