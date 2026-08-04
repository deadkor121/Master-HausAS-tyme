import { useEffect, useState } from 'react';
import axios from 'axios';
import { API_BASE } from '../lib/apiBase';
import { ensureAccessToken } from '../lib/auth';
import AdminShell from '../components/AdminShell';
import TeamGeoMap from '../components/TeamGeoMap';

type GeoStatusItem = {
  workerId: string;
  workerName: string;
  hasLeftSite: boolean;
  site: {
    address: string;
    latitude: number;
    longitude: number;
    geolocationEnabled?: boolean;
    geolocationDisabledAt?: string | null;
    geolocationDisabledReason?: string | null;
    geolocationResumedAt?: string | null;
    leftAt?: string | null;
    lastPingAt?: string | null;
    lastPingLatitude?: number | null;
    lastPingLongitude?: number | null;
  } | null;
  latestReport: {
    id: string;
    workDate: string;
    photoUrl: string;
    photoUrls?: string[] | null;
    note?: string | null;
  } | null;
};

export default function AdminDashboardPage() {
  const [workersGeo, setWorkersGeo] = useState<GeoStatusItem[]>([]);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<string | null>(null);

  useEffect(() => {
    const refreshMs = Number(new URLSearchParams(window.location.search).get('refreshMs') ?? 45000);
    const pollInterval = Number.isFinite(refreshMs) && refreshMs >= 1000 ? refreshMs : 45000;

    const loadDashboard = async () => {
      const token = ensureAccessToken();
      const geoResponse = await axios.get(`${API_BASE}/api/v1/workers/geo-status`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      const items = (geoResponse.data.items ?? []) as GeoStatusItem[];
      setWorkersGeo(items);
      setLastUpdatedAt(new Date().toLocaleTimeString('ru-RU'));
    };

    loadDashboard();
    const intervalId = window.setInterval(() => {
      loadDashboard().catch(() => {
        // Keep the previous dashboard state if one polling attempt fails.
      });
    }, pollInterval);

    return () => {
      window.clearInterval(intervalId);
    };
  }, []);

  const mapItems = workersGeo
    .filter((item) => item.site && Number.isFinite(item.site.latitude) && Number.isFinite(item.site.longitude))
    .map((item) => ({
      workerId: item.workerId,
      workerName: item.workerName,
      site: {
        address: item.site!.address,
        latitude: Number(item.site!.latitude),
        longitude: Number(item.site!.longitude),
        leftAt: item.site?.leftAt,
        lastPingAt: item.site?.lastPingAt
      },
      workerPoint: item.site?.lastPingLatitude !== null && item.site?.lastPingLatitude !== undefined && item.site?.lastPingLongitude !== null && item.site?.lastPingLongitude !== undefined
        ? {
            latitude: Number(item.site.lastPingLatitude),
            longitude: Number(item.site.lastPingLongitude)
          }
        : null
    }));

  return (
    <AdminShell eyebrow="Geo control" title="Где работают мастера" description="Карта геолокации мастеров, объект работ, время завершения и фотоотчет с описанием от работника.">
      <div className="space-y-6">
        <div className="rounded-[2rem] border border-white/10 bg-white/5 p-6">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-2xl font-semibold">Карта мастеров</h2>
            <p className="text-xs text-slate-500">Обновление каждые 45 сек{lastUpdatedAt ? ` • Последнее: ${lastUpdatedAt}` : ''}</p>
          </div>
          <TeamGeoMap items={mapItems} />
        </div>

        <div className="grid gap-4">
          {workersGeo.map((item) => {
            const reportPhotos = Array.isArray(item.latestReport?.photoUrls)
              ? item.latestReport?.photoUrls
              : item.latestReport?.photoUrl ? [item.latestReport.photoUrl] : [];

            return (
              <article key={item.workerId} className="rounded-[2rem] border border-white/10 bg-white/5 p-5 md:p-6">
                <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                  <h3 className="text-xl font-semibold">{item.workerName}</h3>
                  <span className={`rounded-full px-3 py-1 text-xs ${item.site?.geolocationEnabled === false ? 'bg-amber-500/20 text-amber-200' : item.site?.leftAt ? 'bg-rose-500/20 text-rose-200' : 'bg-emerald-500/20 text-emerald-200'}`}>
                    {item.site?.geolocationEnabled === false ? 'Геолокация выключена' : item.site?.leftAt ? 'Закончил работу' : 'Сейчас в работе'}
                  </span>
                </div>

                <div className="mt-4 grid gap-3 md:grid-cols-3 text-sm">
                  <p><span className="text-slate-500">Где работает:</span> {item.site?.address ?? 'адрес не задан'}</p>
                  <p><span className="text-slate-500">Когда закончил:</span> {item.site?.leftAt ? new Date(item.site.leftAt).toLocaleString('ru-RU') : 'еще на объекте'}</p>
                  <p><span className="text-slate-500">Последний пинг:</span> {item.site?.lastPingAt ? new Date(item.site.lastPingAt).toLocaleString('ru-RU') : 'нет данных'}</p>
                </div>

                {item.site?.geolocationEnabled === false ? (
                  <div className="mt-4 rounded-[1.25rem] border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-100">
                    <p><span className="text-amber-200/80">Работник отключил геолокацию:</span> {item.site.geolocationDisabledAt ? new Date(item.site.geolocationDisabledAt).toLocaleString('ru-RU') : 'время не зафиксировано'}</p>
                    <p className="mt-1"><span className="text-amber-200/80">Причина:</span> {item.site.geolocationDisabledReason ?? 'не указана'}</p>
                  </div>
                ) : null}

                <div className="mt-4 rounded-[1.25rem] border border-white/10 bg-slate-950/40 p-4">
                  <p className="text-sm text-slate-400">Фотоотчет работника</p>
                  {item.latestReport ? (
                    <>
                      <p className="mt-2 text-sm text-slate-500">Дата: {String(item.latestReport.workDate).slice(0, 10)}</p>
                      {item.latestReport.note ? <p className="mt-2 text-sm text-slate-300">Описание: {item.latestReport.note}</p> : <p className="mt-2 text-sm text-slate-500">Описание не добавлено.</p>}
                      {reportPhotos.length > 0 ? (
                        <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                          {reportPhotos.map((photoUrl, index) => (
                            <img key={`${item.workerId}-${index}`} src={photoUrl} alt={`Фотоотчет ${index + 1}`} className="h-32 w-full rounded-xl object-cover" />
                          ))}
                        </div>
                      ) : <p className="mt-2 text-sm text-slate-500">Фото не загружены.</p>}
                    </>
                  ) : (
                    <p className="mt-2 text-sm text-slate-500">Работник еще не отправлял фотоотчет.</p>
                  )}
                </div>
              </article>
            );
          })}

          {workersGeo.length === 0 ? (
            <div className="rounded-[2rem] border border-white/10 bg-white/5 p-6 text-sm text-slate-400">
              Пока нет данных по мастерам.
            </div>
          ) : null}
        </div>
      </div>
    </AdminShell>
  );
}

