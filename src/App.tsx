import React, { useRef, useState, useEffect } from 'react';
import { useImmer } from 'use-immer';
import { Wrapper, Status } from "@googlemaps/react-wrapper";
import './App.css'
import { createGMapsComponent } from './GMapsComponents'

import LatLngLiteral = google.maps.LatLngLiteral;

type MapObjectSpecBase = {
	name: string;
};

type MarkerSpec = MapObjectSpecBase & {
	t: 'marker';
	pos: LatLngLiteral;
};

type PolylineSpec = MapObjectSpecBase & {
	t: 'polyline';
	path: LatLngLiteral[];
};

type MapObjectSpec =
	MarkerSpec |
	PolylineSpec
;

const MapView = (
	{objs, handleClick}: {
		objs: MapObjectSpec[],
		handleClick: any,
	}
): JSX.Element => {
	const Marker = createGMapsComponent(google.maps.Marker);
	const Polyline = createGMapsComponent(google.maps.Polyline);

	const divRef = useRef<HTMLDivElement>(null);
	const [map, setMap] = useState<google.maps.Map>();

	useEffect(() => {
		if (divRef.current && !map) {
			setMap(new google.maps.Map(divRef.current, {}));
		}
	}, [divRef, map]);

	useEffect(() => {
		if (map) {
			map.setOptions({
				center: new google.maps.LatLng(-25.344, 131.031 ),
				zoom: 4,
			});

			map.addListener('click', (e) => {
				handleClick(e.latLng);
			});
		}
	}, [map]);

	const domObjs = objs.map((obj) => {
		switch (obj.t) {
			case 'marker': {
				return <Marker
					map={map}
					key={obj.name}
					opts={{
						position: obj.pos,
					}}
				/>;
			}
			case 'polyline': {
				return <Polyline
					map={map}
					key={obj.name}
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

type AppState = {
	mapObjs: MapObjectSpec[];
};

const App = () => {
	const initObjs: MapObjectSpec[] = [
		{
			t: 'marker',
			name: 'm1',
			pos: {lat: -25.344, lng: 131.031},
		},
		{
			t: 'polyline',
			name: 'p1',
			path: [
				{ lat: 37.772, lng: -122.214 },
				{ lat: 21.291, lng: -157.821 },
				{ lat: -18.142, lng: 178.431 },
				{ lat: -27.467, lng: 153.027 },
			],
		}
	];
	const [appState, setAppState] = useImmer<AppState>({
		mapObjs: initObjs,
	});

	const renderErr = (status: Status) => {
		return <h2>{status}</h2>;
	};

	const handleMapClick = (pos: LatLngLiteral) => {
		setAppState((draftAppState) => {
			const mapObjs = draftAppState.mapObjs;
			mapObjs.push({
				t: 'marker',
				name: `m${mapObjs.length}`,
				pos: pos,
			});
		});
	};

	return <Wrapper
		apiKey={import.meta.env.VITE_GOOGLE_MAPS_API_KEY}
		render={renderErr}
	>
		<MapView
			objs={appState.mapObjs}
			handleClick={handleMapClick}
		/>
	</Wrapper>;
};

export default App;
