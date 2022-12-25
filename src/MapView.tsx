import React, { useRef, useState, useEffect } from 'react';
import { Marker, Polyline } from './GMapsComponents';

import LatLngLiteral = google.maps.LatLngLiteral;
import LatLng = google.maps.LatLng;

const flattenLatLng = (pos: LatLng) => {
	return { lat: pos.lat(), lng: pos.lng() };
}

type MapObjSpecBase = {
	uniqName: string;
};

type MapDragMarkerSpec = MapObjSpecBase & {
	t: 'dragMarker';
	geomObjName: string;
	pos: LatLngLiteral;
};

type MapPolylineSpec = MapObjSpecBase & {
	t: 'polyline';
	path: LatLngLiteral[];
};

type MapObjSpec =
	MapDragMarkerSpec |
	MapPolylineSpec
;

const MapView = (
	{objs, center, onClick, onMarkerDrag, onMarkerDragEnd}: {
		objs: MapObjSpec[],
		center: LatLngLiteral,
		onClick: (pos: LatLngLiteral) => void,
		onMarkerDrag: (
			markerName: string,
			geomObjName: string,
			pos: LatLngLiteral
		) => void,
		onMarkerDragEnd: (
			markerName: string,
			geomObjName: string,
			pos: LatLngLiteral
		) => void,
	}
): JSX.Element => {
	const divRef = useRef<HTMLDivElement>(null);
	const [map, setMap] = useState<google.maps.Map>();

	useEffect(() => {
		if (divRef.current && !map) {
			setMap(new google.maps.Map(divRef.current, {}));
		}
	}, [divRef, map]);

	useEffect(() => {
		if (map) {
			const clickListener = map.addListener('click', (e) => {
				onClick(flattenLatLng(e.latLng));
			});

			return () => {
				google.maps.event.removeListener(clickListener);
			};
		}
	}, [map]);

	useEffect(() => {
		if (map) {
			map.setOptions({
				center: center,
				zoom: 4,
			});
		}
	}, [map, center.lat, center.lng]);

	const domObjs = objs.map((obj) => {
		switch (obj.t) {
			case 'dragMarker': {
				const handleDrag = (pos: LatLngLiteral) => {
					onMarkerDrag(obj.uniqName, obj.geomObjName, pos);
				};
				const handleDragEnd = (pos: LatLngLiteral) => {
					onMarkerDragEnd(obj.uniqName, obj.geomObjName, pos);
				};
				return <Marker
					map={map}
					key={obj.uniqName}
					opts={{
						position: obj.pos,
						draggable: true,
					}}
					onDrag={handleDrag}
					onDragEnd={handleDragEnd}
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
				throw new Error('unrecognized map object type');
			}
		}
	});

	return <div>
		<div ref={divRef} className="map" />
		{domObjs}
	</div>;
};

export default MapView;
export type { MapObjSpec };
