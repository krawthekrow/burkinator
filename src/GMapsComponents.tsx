import React, { useRef, useState, useEffect } from 'react';

// getting types to work here is not worth it
const createGMapsComponent:
	(GMapsObject: any) => any =
(GMapsObject) => {
	return (
		{map, opts}: {map: google.maps.Map, opts: any}
	): null => {
		const [comp, setComp] = React.useState<typeof GMapsObject>();

		useEffect(() => {
			if (!comp) {
				setComp(new GMapsObject());
			}

			return () => {
				if (comp) {
					comp.setMap(null);
				}
			};
		}, [comp]);

		useEffect(() => {
			if (comp) {
				comp.setOptions(opts);
			}
		}, [comp, opts]);

		useEffect(() => {
			if (comp && map) {
				comp.setMap(map);
			}
		}, [comp, map]);

		return null;
	};
};

export { createGMapsComponent };
