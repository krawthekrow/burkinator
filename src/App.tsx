import React, { useRef, useState, useEffect } from 'react';
import { Wrapper, Status } from "@googlemaps/react-wrapper";
import './App.css'
import { createGMapsComponent } from './GMapsComponents'

type MapObjectSpecBase = {
	name: string;
};

type MarkerSpec = MapObjectSpecBase & {
	t: 'marker';
	pos: google.maps.LatLngLiteral;
};

type PolylineSpec = MapObjectSpecBase & {
	t: 'polyline';
	path: google.maps.LatLngLiteral[];
};

type MapObjectSpec =
	MarkerSpec |
	PolylineSpec
;

const MapView = ({objs}: {objs: MapObjectSpec[]}): JSX.Element => {
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

const App = () => {
	const render = (status: Status) => {
		return <h2>{status}</h2>;
	};

	const objs: MapObjectSpec[] = [
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

	return <Wrapper
		apiKey={import.meta.env.VITE_GOOGLE_MAPS_API_KEY}
		render={render}
	>
		<MapView objs={objs} />
	</Wrapper>;
};

export default App;
