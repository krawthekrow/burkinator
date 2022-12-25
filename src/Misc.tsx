import LatLng = google.maps.LatLng;
import LatLngLiteral = google.maps.LatLngLiteral;

// common functions that don't have a canonical home yet

const assertUnhandledType = (t: never): never => {
	throw new Error(`unrecognized type ${t}`);
}

const flattenLatLng = (pos: LatLng): LatLngLiteral => {
	return { lat: pos.lat(), lng: pos.lng() };
}

export {
	assertUnhandledType,
	flattenLatLng,
};
