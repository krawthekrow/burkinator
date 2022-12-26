import React, { useRef, useState, useEffect } from 'react';
import { GMap, Marker, Polyline } from './GMapsComponents';
import { assertUnhandledType } from './Misc';
import { flattenLatLng } from './Misc';
import { MapObjName, MapObjSpec } from './MapObj';
import { GeomObjName } from './GeomObj';

import LatLngLiteral = google.maps.LatLngLiteral;

const MapView = (
	{
		objs,
		center, zoom,
		markersDraggable,
		onMapClick,
		onMarkerDrag, onMarkerDragEnd,
		onMarkerClick, onMarkerRightClick,
	}: {
		objs: MapObjSpec[],
		center: LatLngLiteral,
		zoom: number,
		markersDraggable: boolean,
		onMapClick: (pos: LatLngLiteral) => void,
		onMarkerDrag: (
			markerName: MapObjName,
			geomObjName: GeomObjName,
			pos: LatLngLiteral
		) => void,
		onMarkerDragEnd: (
			markerName: MapObjName,
			geomObjName: GeomObjName,
			pos: LatLngLiteral
		) => void,
		onMarkerClick: (
			markerName: MapObjName,
			geomObjName: GeomObjName,
		) => void,
		onMarkerRightClick: (
			markerName: MapObjName,
			geomObjName: GeomObjName,
		) => void,
	}
): JSX.Element => {
	const [map, setMap] = useState<google.maps.Map>();

	const domObjs = objs.map((obj) => {
		switch (obj.t) {
			case 'dragMarker': {
				const handleDrag = (pos: LatLngLiteral) => {
					onMarkerDrag(obj.uniqName, obj.geomObjName, pos);
				};
				const handleDragEnd = (pos: LatLngLiteral) => {
					onMarkerDragEnd(obj.uniqName, obj.geomObjName, pos);
				};
				const handleClick = () => {
					onMarkerClick(obj.uniqName, obj.geomObjName);
				};
				const handleRightClick = () => {
					onMarkerRightClick(obj.uniqName, obj.geomObjName);
				};
				return <Marker
					map={map}
					key={obj.uniqName}
					opts={{
						position: obj.pos,
						draggable: markersDraggable,
						label: {
							text: obj.mapLabel,
						},
					}}
					onDrag={handleDrag}
					onDragEnd={handleDragEnd}
					onClick={handleClick}
					onRightClick={handleRightClick}
				/>;
			}
			case 'polyline': {
				return <Polyline
					map={map}
					key={obj.uniqName}
					opts={{
						path: obj.path,
						geodesic: true,
						strokeColor: '#FF0000',
						strokeOpacity: 1.0,
						strokeWeight: 2,
					}}
				/>;
			}
			default: {
				assertUnhandledType(obj);
			}
		}
	});

	const handleMapInit = (map: google.maps.Map) => {
		setMap(map);
	};

	return <div className="map-pane-inner">
		<GMap
			center={center}
			zoom={zoom}
			onMapInit={handleMapInit}
			onClick={onMapClick}
		/>
		{domObjs}
	</div>;
};

export default MapView;
export type { MapObjSpec };
