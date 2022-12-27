import LatLngLiteral = google.maps.LatLngLiteral;

// Various formulas taken from
// https://www.movable-type.co.uk/scripts/latlong.html

type EarthModel = {
	rad: number;
}

const DEFAULT_EARTH_MODEL: EarthModel = {
	// disclaimer that we treat earth as a perfect sphere
	rad: 6371,
};

type Coord3D = {
	x: number;
	y: number;
	z: number;
};

// x and y axis of a tangent plane
type TangentBasis = [Coord3D, Coord3D];

const latLngToRad = (pos: LatLngLiteral): [number, number] => {
	return [
		pos.lat / 180 * Math.PI,
		pos.lng / 180 * Math.PI,
	];
};

const radToLatLng = (radLatLng: [number, number]): LatLngLiteral => {
	return {
		lat: radLatLng[0] / Math.PI * 180,
		lng: radLatLng[1] / Math.PI * 180,
	};
};

const latLngToCart = (pos: LatLngLiteral): Coord3D => {
	const [latRad, lngRad] = latLngToRad(pos);
	return {
		x: Math.cos(latRad) * Math.cos(lngRad),
		y: Math.cos(latRad) * Math.sin(lngRad),
		z: Math.sin(latRad),
	};
};

const cartToLatLng = (cart: Coord3D): LatLngLiteral => {
	return radToLatLng([
		Math.atan2(
			cart.z,
			Math.sqrt(cart.x * cart.x + cart.y * cart.y)
		),
		Math.atan2(cart.y, cart.x),
	]);
};

const NORTH_POLE_CART = { x: 0, y: 0, z: 1 };
const SOUTH_POLE_CART = { x: 0, y: 0, z: -1 };

const normLng = (lng: number): number => {
	return (lng + 180) % 360 - 180;
};

const normAngle = (x: number): number => {
	const m = 2 * Math.PI;
	return (x % m + m) % m;
};

const getAntipode = (
	earth: EarthModel, pos: LatLngLiteral
): LatLngLiteral => {
	return {
		lat: -pos.lat,
		lng: normLng(pos.lng + 180),
	};
};

// prevent NaNs when taking inverse trig functions
const clampTrig = (x: number): number => {
	return Math.min(Math.max(x, -1), 1);
}

const scaleCart = (cart: Coord3D, mul: number): Coord3D => {
	return {
		x: cart.x * mul,
		y: cart.y * mul,
		z: cart.z * mul,
	};
};

const addCart = (cart1: Coord3D, cart2: Coord3D): Coord3D => {
	return {
		x: cart1.x + cart2.x,
		y: cart1.y + cart2.y,
		z: cart1.z + cart2.z,
	};
};

const negCart = (cart: Coord3D): Coord3D => {
	return scaleCart(cart, -1);
};

const lenCart = (cart: Coord3D): number => {
	return Math.sqrt(dotCart(cart, cart));
};

const normCart = (cart: Coord3D): Coord3D => {
	return scaleCart(cart, 1 / lenCart(cart));
};

const dotCart = (cart1: Coord3D, cart2: Coord3D): number => {
	return cart1.x * cart2.x + cart1.y * cart2.y + cart1.z * cart2.z;
};

const crossCart = (cart1: Coord3D, cart2: Coord3D): Coord3D => {
	return {
		x: cart1.y * cart2.z - cart1.z * cart2.y,
		y: cart1.z * cart2.x - cart1.x * cart2.z,
		z: cart1.x * cart2.y - cart1.y * cart2.x,
	};
};

const crossNormCart = (cart1: Coord3D, cart2: Coord3D): Coord3D => {
	return normCart(crossCart(cart1, cart2));
};

const getAngleCart = (cart1: Coord3D, cart2: Coord3D): number => {
	// use atan2 for stability
	const cosAngle = dotCart(cart1, cart2);
	const sinAngle = lenCart(crossCart(cart1, cart2));
	return Math.atan2(sinAngle, cosAngle);
};

// binormal and tangent vector at cart1 going to cart2
const getTangentBasisCart = (
	cart1: Coord3D, cart2: Coord3D
): TangentBasis | null => {
	const crossProd = crossCart(cart2, cart1);
	if (lenCart(crossProd) == 0) {
		return null;
	}
	return [
		normCart(crossProd), // binormal
		crossNormCart(cart1, crossProd), // tangent
	];
};

const getTangentCart = (
	cart1: Coord3D, cart2: Coord3D
): Coord3D | null => {
	const crossProd = crossCart(cart2, cart1);
	if (lenCart(crossProd) == 0) {
		return null;
	}
	return crossNormCart(cart1, crossProd);
};

const flipBasis = (basis: TangentBasis): TangentBasis => {
	return [negCart(basis[0]), negCart(basis[1])];
};

const getAngleInBasis = (
	cart: Coord3D, basis: TangentBasis
): number => {
	return Math.atan2(
		dotCart(cart, basis[0]),
		dotCart(cart, basis[1])
	);
};

const getNearBearingCart = (cart1: Coord3D, cart2: Coord3D): number => {
	const tangent = getTangentCart(cart1, cart2);
	if (tangent == null) {
		return 0;
	}
	const basis = getTangentBasisCart(cart1, NORTH_POLE_CART);
	if (basis == null) {
		return (cart1.z > 0) ? Math.PI : 0;
	}
	return normAngle(getAngleInBasis(tangent, basis));
};

const getFarBearingCart = (cart1: Coord3D, cart2: Coord3D): number => {
	const tangent = getTangentCart(cart1, cart2);
	if (tangent == null) {
		return 0;
	}
	const basis = getTangentBasisCart(cart1, NORTH_POLE_CART);
	if (basis == null) {
		return (cart1.z > 0) ? Math.PI : 0;
	}
	return normAngle(getAngleInBasis(tangent, basis) + Math.PI);
};

// tangent basis at the end of a geodesic, taking into account
// edge cases specific to this application
const getGeodesicEndBasisCart = (
	cart1: Coord3D, cart2: Coord3D, useFarArc: boolean
): TangentBasis => {
	let basis = getTangentBasisCart(cart2, cart1);
	if (basis != null && !useFarArc) {
		basis = flipBasis(basis);
	}
	if (basis == null) {
		// take turnAngle as bearing from north
		basis = getTangentBasisCart(cart2, NORTH_POLE_CART);
		if (basis == null) {
			const tangent = { x: 1, y: 0, z: 0};
			return [
				crossCart(tangent, cart2),
				tangent,
			];
		}
	}
	return basis;
};

const getTurnAngleDistDestCart = (
	cart1: Coord3D, cart2: Coord3D, useFarArc: boolean,
	turnAngle: number, distAngle: number
): Coord3D => {
	const basis = getGeodesicEndBasisCart(cart1, cart2, useFarArc);
	const tangent = addCart(
		scaleCart(basis[0], Math.sin(turnAngle)),
		scaleCart(basis[1], Math.cos(turnAngle))
	);
	return addCart(
		scaleCart(tangent, Math.sin(distAngle)),
		scaleCart(cart2, Math.cos(distAngle))
	);
};

const getTurnAngleCart = (
	cart1: Coord3D, cart2: Coord3D, useFarArc: boolean,
	cart3: Coord3D
): number => {
	const tangent = getTangentCart(cart2, cart3);
	if (tangent == null) {
		return 0;
	}
	const basis = getGeodesicEndBasisCart(cart1, cart2, useFarArc);
	return normAngle(getAngleInBasis(tangent, basis));
};

const eulerRotateCart = (
	pos: Coord3D, alpha: number, beta: number, gamma: number
): Coord3D => {
	const rot1: Coord3D = {
		x: pos.x,
		y: pos.y * Math.cos(alpha) - pos.z * Math.sin(alpha),
		z: pos.y * Math.sin(alpha) + pos.z * Math.cos(alpha),
	};
	const rot2: Coord3D = {
		x: rot1.x * Math.cos(beta) + rot1.z * Math.sin(beta),
		y: rot1.y,
		z: -rot1.x * Math.sin(beta) + rot1.z * Math.cos(beta),
	};
	const rot3: Coord3D = {
		x: rot2.x * Math.cos(gamma) - rot2.y * Math.sin(gamma),
		y: rot2.x * Math.sin(gamma) + rot2.y * Math.cos(gamma),
		z: rot2.z,
	};
	return rot3;
};

const getNearDist = (
	earth: EarthModel, ptStart: LatLngLiteral, ptEnd: LatLngLiteral
): number => {
	const cart1 = latLngToCart(ptStart);
	const cart2 = latLngToCart(ptEnd);
	return getAngleCart(cart1, cart2) * earth.rad;
};

const getFarDist = (
	earth: EarthModel, ptStart: LatLngLiteral, ptEnd: LatLngLiteral
): number => {
	const cart1 = latLngToCart(ptStart);
	const cart2 = latLngToCart(ptEnd);
	return (2 * Math.PI - getAngleCart(cart1, cart2)) * earth.rad;
};

const getNearBearing = (
	earth: EarthModel, ptStart: LatLngLiteral, ptEnd: LatLngLiteral
): number => {
	const cart1 = latLngToCart(ptStart);
	const cart2 = latLngToCart(ptEnd);
	return getNearBearingCart(cart1, cart2);
};

const getFarBearing = (
	earth: EarthModel, ptStart: LatLngLiteral, ptEnd: LatLngLiteral
): number => {
	const cart1 = latLngToCart(ptStart);
	const cart2 = latLngToCart(ptEnd);
	return getFarBearingCart(cart1, cart2);
};

// start at posStart facing posEnd, turn by turnAngle, then go forward
// by dist km
const getTurnAngleDistDest = (
	earth: EarthModel,
	posStart: LatLngLiteral, posEnd: LatLngLiteral, useFarArc: boolean,
	turnAngle: number, dist: number
): LatLngLiteral => {
	const cart1 = latLngToCart(posStart);
	const cart2 = latLngToCart(posEnd);
	return cartToLatLng(getTurnAngleDistDestCart(
		cart1, cart2, useFarArc,
		turnAngle, dist / earth.rad
	));
};

const getTurnAngle = (
	earth: EarthModel,
	pos1: LatLngLiteral, pos2: LatLngLiteral, useFarArc: boolean,
	pos3: LatLngLiteral
): number => {
	const cart1 = latLngToCart(pos1);
	const cart2 = latLngToCart(pos2);
	const cart3 = latLngToCart(pos3);
	return getTurnAngleCart(cart1, cart2, useFarArc, cart3);
};

export type { EarthModel };
export {
	DEFAULT_EARTH_MODEL,
	getAntipode,
	getNearDist,
	getFarDist,
	getNearBearing,
	getFarBearing,
	getTurnAngleDistDest,
	getTurnAngle,
};
