import { useEffect, useMemo } from 'react';
import L from 'leaflet';
import { Circle, MapContainer, Marker, Popup, TileLayer, useMap, useMapEvents } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';

type GeoPoint = {
  latitude: number;
  longitude: number;
};

type WorkSitePickerMapProps = {
  selectedPoint?: GeoPoint | null;
  selectedAddress?: string;
  workerPoint?: GeoPoint | null;
  radiusMeters?: number;
  onSelectPoint?: (latitude: number, longitude: number) => void;
  heightClassName?: string;
};

const defaultCenter: [number, number] = [59.9139, 10.7522];

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

function MapBounds({ points }: { points: Array<[number, number]> }) {
  const map = useMap();

  useEffect(() => {
    if (points.length === 0) {
      map.setView(defaultCenter, 13);
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

function ClickSelector({ onSelectPoint }: { onSelectPoint?: (latitude: number, longitude: number) => void }) {
  useMapEvents({
    click(event) {
      onSelectPoint?.(event.latlng.lat, event.latlng.lng);
    }
  });

  return null;
}

export default function WorkSitePickerMap({
  selectedPoint,
  selectedAddress,
  workerPoint,
  radiusMeters = 5,
  onSelectPoint,
  heightClassName = 'h-80'
}: WorkSitePickerMapProps) {
  const siteIcon = useMemo(() => buildMarkerIcon('#22d3ee', 'О'), []);
  const workerIcon = useMemo(() => buildMarkerIcon('#fb7185', 'W'), []);

  const points = useMemo<Array<[number, number]>>(() => {
    const list: Array<[number, number]> = [];
    if (selectedPoint) {
      list.push([selectedPoint.latitude, selectedPoint.longitude]);
    }
    if (workerPoint) {
      list.push([workerPoint.latitude, workerPoint.longitude]);
    }
    return list;
  }, [selectedPoint, workerPoint]);

  const center = selectedPoint ? [selectedPoint.latitude, selectedPoint.longitude] as [number, number] : defaultCenter;

  return (
    <div className={`overflow-hidden rounded-[1.5rem] border border-white/10 ${heightClassName}`}>
      <MapContainer center={center} zoom={selectedPoint ? 17 : 13} className="h-full w-full">
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <ClickSelector onSelectPoint={onSelectPoint} />
        <MapBounds points={points} />

        {selectedPoint ? (
          <>
            <Marker position={[selectedPoint.latitude, selectedPoint.longitude]} icon={siteIcon}>
              <Popup>
                <div className="space-y-1">
                  <p className="font-semibold">Точка объекта</p>
                  <p>{selectedAddress || 'Адрес будет заполнен автоматически или вручную.'}</p>
                  <p>Радиус: {radiusMeters} м</p>
                </div>
              </Popup>
            </Marker>
            <Circle
              center={[selectedPoint.latitude, selectedPoint.longitude]}
              radius={Number(radiusMeters)}
              pathOptions={{ color: '#22d3ee', fillColor: '#22d3ee', fillOpacity: 0.12 }}
            />
          </>
        ) : null}

        {workerPoint ? (
          <Marker position={[workerPoint.latitude, workerPoint.longitude]} icon={workerIcon}>
            <Popup>
              <div className="space-y-1">
                <p className="font-semibold">Последняя точка работника</p>
                <p>Координаты: {workerPoint.latitude.toFixed(6)}, {workerPoint.longitude.toFixed(6)}</p>
              </div>
            </Popup>
          </Marker>
        ) : null}
      </MapContainer>
    </div>
  );
}
