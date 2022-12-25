import React, { useRef, useState, useEffect } from 'react';
import { assertUnhandledType } from './Misc';
import {
	GeomPointSpec, GeomGeodesicSpec, GeomObjSpec,
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
	{val, inputClass, onCommit}: {
		val: string,
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
		onChange={handleChange}
		onFocus={handleFocus}
		onBlur={handleBlur}
		onKeyPress={handleKeyPress}
	/>;
};

const PointEditorView = (
	{obj, onUpdate}: {
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
				inputClass="coord-input"
				onCommit={handleCommitLat}
			/>,
			Lng:&nbsp;
			<ReactiveInput
				val={obj.pos.lng.toString()}
				inputClass="coord-input"
				onCommit={handleCommitLng}
			/>
		</div>
		<div>
			Label:&nbsp;
			<ReactiveInput
				val={obj.mapLabel}
				inputClass="name-input"
				onCommit={handleCommitMapLabel}
			/>
		</div>
	</div>;
};

const GeodesicEditorView = (
	{obj, onUpdate}: {
		obj: GeomGeodesicSpec,
		onUpdate: (upd: AlterUpd) => void,
	}
) => {
	const handleCommitPtFrom = (newVal: string) => {
		onUpdate({
			t: 'geodesicFrom',
			uniqName: obj.uniqName,
			newPtRef: newVal,
		});
	};

	const handleCommitPtTo = (newVal: string) => {
		onUpdate({
			t: 'geodesicTo',
			uniqName: obj.uniqName,
			newPtRef: newVal,
		});
	};

	return <div>
		<div>
			From:&nbsp;
			<ReactiveInput
				val={(obj.ptFrom != null) ? obj.ptFrom : ''}
				inputClass="name-input"
				onCommit={handleCommitPtFrom}
			/>,
			To:&nbsp;
			<ReactiveInput
				val={(obj.ptTo != null) ? obj.ptTo : ''}
				inputClass="name-input"
				onCommit={handleCommitPtTo}
			/>
		</div>
	</div>;
};

const ObjEditorView = (
	{obj, onUpdate}: {
		obj: GeomObjSpec,
		onUpdate: (upd: AlterUpd) => void,
	}
) => {
	const getInnerEditor = () => {
		switch (obj.t) {
			case 'point': {
				return <PointEditorView
					obj={obj}
					onUpdate={onUpdate}
				/>;
			}
			case 'geodesic': {
				return <GeodesicEditorView
					obj={obj}
					onUpdate={onUpdate}
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
			newName: newVal,
		});
	};

	return <div
		className="obj-editor"
	>
		<ReactiveInput
			val={obj.uniqName}
			inputClass="name-input"
			onCommit={handleCommitName}
		/>
		{getInnerEditor()}
	</div>;
};

const ObjsEditorView = (
	{objs, onUpdate}: {
		objs: GeomObjSpec[],
		onUpdate: (upd: AlterUpd) => void,
	}
) => {
	const domObjs = objs.map((obj) => {
		return <ObjEditorView
			key={obj.uniqName}
			obj={obj}
			onUpdate={onUpdate}
		/>;
	});

	return <div>
		{domObjs}
	</div>;
};

export default ObjsEditorView;
export type { GeomObjSpec };
