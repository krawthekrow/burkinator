import React, { useRef, useState, useEffect } from 'react';

import LatLngLiteral = google.maps.LatLngLiteral;
import LatLng = google.maps.LatLng;

const flattenLatLng = (pos: LatLng): LatLngLiteral => {
	return { lat: pos.lat(), lng: pos.lng() };
}

const GMap = (
	{center, zoom, onMapInit, onClick}: {
		center: LatLngLiteral,
		zoom: number,
		onMapInit: (map: google.maps.Map) => void,
		onClick: (pos: LatLngLiteral) => void,
	}
) => {
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
				zoom: zoom,
			});
		}
	}, [map, center.lat, center.lng, zoom]);

	useEffect(() => {
		if (map) {
			onMapInit(map);
		}
	}, [map]);

	return <div ref={divRef} className="map" />;
};

const Marker = (
	{map, opts, onDrag, onDragEnd, onClick, onRightClick}: {
		map?: google.maps.Map,
		opts: google.maps.MarkerOptions,
		onDrag?: (pos: LatLngLiteral) => void,
		onDragEnd?: (pos: LatLngLiteral) => void,
		onClick?: () => void,
		onRightClick?: () => void,
	}
) => {
	const [marker, setMarker] = React.useState<google.maps.Marker>();

	useEffect(() => {
		if (!marker) {
			setMarker(new google.maps.Marker());
		}

		return () => {
			if (marker) {
				marker.setMap(null);
			}
		};
	}, [marker]);

	useEffect(() => {
		if (!marker) {
			return;
		}

		const dragListener = marker.addListener('drag', (e) => {
			if (onDrag) {
				onDrag(flattenLatLng(e.latLng));
			}
		});
		const dragEndListener = marker.addListener('dragend', (e) => {
			if (onDragEnd) {
				onDragEnd(flattenLatLng(e.latLng));
			}
		});
		const clickListener = marker.addListener('click', (e) => {
			if (onClick) {
				onClick();
			}
		});
		const rightClickListener = marker.addListener('contextmenu', (e) => {
			if (onRightClick) {
				onRightClick();
			}
		});

		return () => {
			google.maps.event.removeListener(dragListener);
			google.maps.event.removeListener(dragEndListener);
			google.maps.event.removeListener(clickListener);
			google.maps.event.removeListener(rightClickListener);
		};
	}, [marker, onDrag, onDragEnd, onClick, onRightClick]);

	useEffect(() => {
		if (marker) {
			marker.setOptions(opts);
		}
	}, [marker, opts]);

	useEffect(() => {
		if (marker && map) {
			marker.setMap(map);
		}
	}, [marker, map]);

	return null;
};

const Polyline = (
	{map, opts}: {
		map?: google.maps.Map,
		opts: google.maps.PolylineOptions,
	}
) => {
	const [polyline, setPolyline] = React.useState<google.maps.Polyline>();

	useEffect(() => {
		if (!polyline) {
			setPolyline(new google.maps.Polyline());
		}

		return () => {
			if (polyline) {
				polyline.setMap(null);
			}
		};
	}, [polyline]);

	useEffect(() => {
		if (polyline) {
			polyline.setOptions(opts);
		}
	}, [polyline, opts]);

	useEffect(() => {
		if (polyline && map) {
			polyline.setMap(map);
		}
	}, [polyline, map]);

	return null;
};

export { GMap, Marker, Polyline };
