import React, { useRef, useState, useEffect } from 'react';
import {
	GeomPointSpec, GeomGeodesicSpec, GeomObjSpec,
	GeomObjUpdPoint, GeomObjUpdDelete, GeomObjUpd,
} from './GeomObj';

import LatLngLiteral = google.maps.LatLngLiteral;

// Only send updates when the user "commits" by unfocusing
const CoordInput = (
	{val, onCommit}: {
		val: number,
		onCommit: (newVal: number) => void,
	}
): JSX.Element => {
	const [textVal, setTextVal] = useState<string>(val.toString());

	useEffect(() => {
		setTextVal(val.toString());
	}, [val]);

	const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		setTextVal(e.target.value);
	};

	const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
		onCommit(parseFloat(e.target.value));
	};

	const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
		if (e.key == 'Enter') {
			(e.target as HTMLInputElement).blur();
		}
	};

	return <input
		type="text"
		className="coord-input"
		value={textVal}
		onChange={handleChange}
		onBlur={handleBlur}
		onKeyPress={handleKeyPress}
	/>;
};

const PointEditorView = (
	{obj, onUpdate}: {
		obj: GeomPointSpec,
		onUpdate: (upd: GeomObjUpd) => void,
	}
) => {
	const makeUpdatePoint = (pos: LatLngLiteral): GeomObjUpd => {
		return {
			t: 'point',
			uniqName: obj.uniqName,
			pos: pos,
		};
	};

	const handleCommitLat = (newVal: number) => {
		onUpdate(makeUpdatePoint({ lat: newVal, lng: obj.pos.lng }));
	};

	const handleCommitLng = (newVal: number) => {
		onUpdate(makeUpdatePoint({ lat: obj.pos.lat, lng: newVal }));
	};

	return <div>
		Lat:&nbsp;
		<CoordInput
			val={obj.pos.lat}
			onCommit={handleCommitLat}
		/>,
		Lng:&nbsp;
		<CoordInput
			val={obj.pos.lng}
			onCommit={handleCommitLng}
		/>
	</div>;
};

const ObjsEditorView = (
	{objs, onUpdate}: {
		objs: GeomObjSpec[],
		onUpdate: (upd: GeomObjUpd) => void,
	}
) => {
	const domObjs = objs.map((obj) => {
		switch (obj.t) {
			case 'point': {
				return <PointEditorView
					key={obj.uniqName}
					obj={obj}
					onUpdate={onUpdate}
				/>;
			}
			case 'geodesic': {
				return <div
					key={obj.uniqName}
				>
					<p>Polyline</p>
				</div>;
			}
			default: {
				throw new Error('unrecognized geom object type');
			}
		}
	});

	return <div>
		{domObjs}
	</div>;
};

export default ObjsEditorView;
export type { GeomObjSpec };
