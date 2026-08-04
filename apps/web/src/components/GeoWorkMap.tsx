import { useEffect, useMemo } from 'react';
import L from 'leaflet';
import { Circle, MapContainer, Marker, Popup, TileLayer, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';

type GeoPoint = {
  latitude: number;
  longitude: number;
  label: string;
};

type GeoWorkMapProps = {
  workSite: {
    address: string;
    latitude: number;
    longitude: number;
    radiusMeters?: number | null;
  };
  workerPoint?: GeoPoint | null;
  heightClassName?: string;
};

let iconInitialized = false;

function buildMarkerIcon(color: string, label: string) {
  return L.divIcon({
    className: '',
    html: `
      <div style="width: 28px; height: 28px; display: flex; align-items: center; justify-content: center; transform: translate(-50%, -50%);">
        <div style="width: 18px; height: 18px; border-radius: 999px; background: ${color}; border: 3px solid rgba(255,255,255,0.95); box-shadow: 0 0 0 7px ${color}33; position: relative;">
          <span style="position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; color: rgba(255,255,255,0.96); font-size: 10px; font-weight: 700; line-height: 1;">${label}</span>
        </div>
      </div>
    `,
    iconSize: [28, 28],
    iconAnchor: [14, 14],
    popupAnchor: [0, -12]
  });
}

function ensureDefaultIcons() {
  if (iconInitialized) {
    return;
  }

  iconInitialized = true;
}

function MapBounds({ points }: { points: Array<[number, number]> }) {
  const map = useMap();

  useEffect(() => {
    if (points.length === 0) {
      return;
    }

    if (points.length === 1) {
      map.setView(points[0], 17);
      return;
    }

    map.fitBounds(points, { padding: [40, 40] });
  }, [map, points]);

  return null;
}

export default function GeoWorkMap({ workSite, workerPoint, heightClassName = 'h-72' }: GeoWorkMapProps) {
  ensureDefaultIcons();
  const siteIcon = useMemo(() => buildMarkerIcon('#22d3ee', 'О'), []);
  const workerIcon = useMemo(() => buildMarkerIcon('#fb7185', 'W'), []);

  const points = useMemo<Array<[number, number]>>(() => {
    const list: Array<[number, number]> = [[workSite.latitude, workSite.longitude]];
    if (workerPoint) {
      list.push([workerPoint.latitude, workerPoint.longitude]);
    }
    return list;
  }, [workSite.latitude, workSite.longitude, workerPoint]);

  return (
    <div className={`overflow-hidden rounded-[1.5rem] border border-white/10 ${heightClassName}`}>
      <MapContainer center={[workSite.latitude, workSite.longitude]} zoom={17} className="h-full w-full">
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <MapBounds points={points} />
        <Marker position={[workSite.latitude, workSite.longitude]} icon={siteIcon}>
          <Popup>
            <div className="space-y-1">
              <p className="font-semibold">Объект работ</p>
              <p>{workSite.address}</p>
              <p>Радиус: {workSite.radiusMeters ?? 5} м</p>
            </div>
          </Popup>
        </Marker>
        <Circle
          center={[workSite.latitude, workSite.longitude]}
          radius={Number(workSite.radiusMeters ?? 5)}
          pathOptions={{ color: '#22d3ee', fillColor: '#22d3ee', fillOpacity: 0.12 }}
        />
        {workerPoint ? (
          <Marker position={[workerPoint.latitude, workerPoint.longitude]} icon={workerIcon}>
            <Popup>
              <div className="space-y-1">
                <p className="font-semibold">{workerPoint.label}</p>
                <p>Координаты: {workerPoint.latitude.toFixed(6)}, {workerPoint.longitude.toFixed(6)}</p>
              </div>
            </Popup>
          </Marker>
        ) : null}
      </MapContainer>
    </div>
  );
}