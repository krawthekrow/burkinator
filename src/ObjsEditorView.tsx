import React, { useRef, useState, useEffect } from 'react';
import { assertUnhandledType } from './Misc';
import { UserState } from './UserState';
import {
	GeomPointSpec, newGeomObjName,
	GeomGeodesicSpec, GeomObjSpec,
} from './GeomObj';
import {
	AlterNameUpd, AlterPosUpd, AlterMapLabelUpd,
	AlterGeodesicFromUpd, AlterGeodesicToUpd,
	AlterUpd,
	DeleteObjUpd,
} from './StateUpd';

import LatLngLiteral = google.maps.LatLngLiteral;

// Only send updates when the user "commits" by unfocusing
const ReactiveInput = (
	{val, disabled, inputClass, onCommit}: {
		val: string,
		disabled: boolean,
		inputClass: string,
		onCommit: (newVal: string) => void,
	}
): JSX.Element => {
	const [dispVal, setDispVal] = useState<string | null>(null);

	useEffect(() => {
		setDispVal(val.toString());
	}, [val]);

	const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		setDispVal(e.target.value);
	};

	const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => {
		e.target.select();
	};

	const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
		onCommit(e.target.value);
		setDispVal(null);
	};

	const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
		if (e.key == 'Enter') {
			(e.target as HTMLInputElement).blur();
		}
	};

	return <input
		type="text"
		className={`${inputClass}`}
		value={(dispVal != null) ? dispVal : val}
		disabled={disabled}
		onChange={handleChange}
		onFocus={handleFocus}
		onBlur={handleBlur}
		onKeyPress={handleKeyPress}
	/>;
};

const PointEditorView = (
	{userState, obj, onUpdate}: {
		userState: UserState,
		obj: GeomPointSpec,
		onUpdate: (upd: AlterUpd) => void,
	}
) => {
	const makeUpdatePos = (pos: LatLngLiteral): AlterUpd => {
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

	return <div>
		<div>
			Lat:&nbsp;
			<ReactiveInput
				val={obj.pos.lat.toString()}
				disabled={userState.t != 'free'}
				inputClass="coord-input"
				onCommit={handleCommitLat}
			/>,
			Lng:&nbsp;
			<ReactiveInput
				val={obj.pos.lng.toString()}
				disabled={userState.t != 'free'}
				inputClass="coord-input"
				onCommit={handleCommitLng}
			/>
		</div>
		<div>
			Label:&nbsp;
			<ReactiveInput
				val={obj.mapLabel}
				disabled={userState.t != 'free'}
				inputClass="name-input"
				onCommit={handleCommitMapLabel}
			/>
		</div>
	</div>;
};

const GeodesicEditorView = (
	{userState, obj, onUpdate, onUserStateUpdate}: {
		userState: UserState,
		obj: GeomGeodesicSpec,
		onUpdate: (upd: AlterUpd) => void,
		onUserStateUpdate: (newState: UserState) => void,
	}
) => {
	const handleCommitPtFrom = (newVal: string) => {
		onUpdate({
			t: 'geodesicFrom',
			uniqName: obj.uniqName,
			newPtRef: newGeomObjName(newVal),
		});
	};

	const handleCommitPtTo = (newVal: string) => {
		onUpdate({
			t: 'geodesicTo',
			uniqName: obj.uniqName,
			newPtRef: newGeomObjName(newVal),
		});
	};

	const handleSelectFromClick = (
		e: React.MouseEvent<HTMLButtonElement>
	) => {
		onUserStateUpdate({
			t: 'geodesicFrom',
			uniqName: obj.uniqName,
			doPtToNext: false,
		});
	};

	const handleSelectToClick = (
		e: React.MouseEvent<HTMLButtonElement>
	) => {
		onUserStateUpdate({
			t: 'geodesicTo',
			uniqName: obj.uniqName,
		});
	};

	return <div>
		<div>
			From:&nbsp;
			<ReactiveInput
				val={(obj.ptFrom != null) ? obj.ptFrom : ''}
				disabled={userState.t != 'free'}
				inputClass="name-input"
				onCommit={handleCommitPtFrom}
			/>
			&nbsp;
			<button
				className="shortcut-button"
				onClick={handleSelectFromClick}
			>
				S
			</button>,
			To:&nbsp;
			<ReactiveInput
				val={(obj.ptTo != null) ? obj.ptTo : ''}
				disabled={userState.t != 'free'}
				inputClass="name-input"
				onCommit={handleCommitPtTo}
			/>
			&nbsp;
			<button
				className="shortcut-button"
				onClick={handleSelectToClick}
			>
				S
			</button>,
		</div>
	</div>;
};

const ObjEditorView = (
	{userState, obj, onUpdate, onUserStateUpdate}: {
		userState: UserState,
		obj: GeomObjSpec,
		onUpdate: (upd: AlterUpd) => void,
		onUserStateUpdate: (newState: UserState) => void,
	}
) => {
	const getInnerEditor = () => {
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
					userState={userState}
					obj={obj}
					onUpdate={onUpdate}
					onUserStateUpdate={onUserStateUpdate}
				/>;
			}
			default: {
				assertUnhandledType(obj);
			}
		}
	};

	const handleCommitName = (newVal: string) => {
		onUpdate({
			t: 'name',
			uniqName: obj.uniqName,
			newName: newGeomObjName(newVal),
		});
	};

	return <div
		className="obj-editor"
	>
		<ReactiveInput
			val={obj.uniqName}
			disabled={userState.t != 'free'}
			inputClass="name-input"
			onCommit={handleCommitName}
		/>
		{getInnerEditor()}
	</div>;
};

const ObjsEditorView = (
	{userState, objs, onUpdate, onUserStateUpdate}: {
		userState: UserState,
		objs: GeomObjSpec[],
		onUpdate: (upd: AlterUpd) => void,
		onUserStateUpdate: (newState: UserState) => void,
	}
) => {
	const domObjs = objs.map((obj) => {
		return <ObjEditorView
			key={obj.uniqName}
			userState={userState}
			obj={obj}
			onUpdate={onUpdate}
			onUserStateUpdate={onUserStateUpdate}
		/>;
	});

	return <div>
		{domObjs}
	</div>;
};

export default ObjsEditorView;
export type { GeomObjSpec };
