import React, { useRef, useState, useEffect } from 'react';

import LatLngLiteral = google.maps.LatLngLiteral;
import LatLng = google.maps.LatLng;

const flattenLatLng = (pos: LatLng) => {
	return { lat: pos.lat(), lng: pos.lng() };
}

const Marker = (
	{map, opts, onDrag, onDragEnd}: {
		map?: google.maps.Map,
		opts: google.maps.MarkerOptions,
		onDrag?: (pos: LatLngLiteral) => void,
		onDragEnd?: (pos: LatLngLiteral) => void,
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

		return () => {
			google.maps.event.removeListener(dragListener);
			google.maps.event.removeListener(dragEndListener);
		};
	}, [marker, onDrag, onDragEnd]);

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

export { Marker, Polyline };
