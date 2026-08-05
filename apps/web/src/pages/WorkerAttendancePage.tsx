import { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { API_BASE } from '../lib/apiBase';
import { ensureAccessToken, describeAxiosError } from '../lib/auth';
import { useAuth } from '../lib/AuthContext';
import WorkerShell from '../components/WorkerShell';
import AdminShell from '../components/AdminShell';
import { formatNokFromOre } from '../lib/currency';
import { uploadRegistrationPhoto } from '../lib/cloudinary';
import WorkSitePickerMap from '../components/WorkSitePickerMap';

type Worker = {
  id: string;
  fullName: string;
  role: string;
  hourlyRateOre?: number;
};

type WorkLog = {
  id: string;
  workDate: string;
  startedAt: string;
  endedAt: string;
  totalMinutes: number;
  earnedOre?: number;
  workDateKey?: string;
};

type WorkLogSummary = {
  workerId: string;
  workerName: string;
  month?: string;
  hourlyRateOre: number;
  totalMinutes: number;
  totalEarnedOre: number;
  earningsByDate: Record<string, { minutes: number; earnedOre: number }>;
};

type WorkSite = {
  id: string;
  workerId: string;
  address: string;
  latitude: number;
  longitude: number;
  radiusMeters: number;
  geolocationEnabled?: boolean;
  geolocationDisabledAt?: string | null;
  geolocationDisabledReason?: string | null;
  geolocationResumedAt?: string | null;
  shiftStartedAt?: string | null;
  shiftEndedAt?: string | null;
  isShiftActive?: boolean;
  leftAt?: string | null;
  lastPingAt?: string | null;
  lastPingLatitude?: number | null;
  lastPingLongitude?: number | null;
  lastDistanceMeters?: number | null;
};

type WorkerPoint = {
  latitude: number;
  longitude: number;
  label: string;
};

type WorkPhotoReport = {
  id: string;
  workDate: string;
  photoUrl: string;
  photoUrls?: string[] | null;
  reportType?: 'start' | 'end' | string;
  note?: string | null;
  createdAt: string;
};

function formatMinutes(totalMinutes: number) {
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${hours} ч ${minutes.toString().padStart(2, '0')} мин`;
}

function getDateKey(isoString: string) {
  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) return isoString.slice(0, 10);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function formatDateLabel(isoString: string) {
  return new Date(isoString).toLocaleDateString('ru-RU');
}

function formatTimeLabel(isoString: string) {
  return new Date(isoString).toLocaleTimeString('nb-NO', { hour: '2-digit', minute: '2-digit' });
}

function buildCalendarDays(month: string) {
  const [year, monthIndex] = month.split('-').map(Number);
  const firstDay = new Date(year, monthIndex - 1, 1);
  const lastDay = new Date(year, monthIndex, 0);
  const daysInMonth = lastDay.getDate();
  const mondayFirstOffset = (firstDay.getDay() + 6) % 7;
  const cells: Array<Date | null> = [];

  for (let index = 0; index < mondayFirstOffset; index += 1) cells.push(null);
  for (let day = 1; day <= daysInMonth; day += 1) cells.push(new Date(year, monthIndex - 1, day));
  return cells;
}

export default function WorkerAttendancePage() {
  const { user } = useAuth();
  const today = new Date();
  const defaultMonth = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
  const defaultDate = `${defaultMonth}-${String(today.getDate()).padStart(2, '0')}`;

  const [workers, setWorkers] = useState<Worker[]>([]);
  const [selectedWorkerId, setSelectedWorkerId] = useState(user?.role === 'worker' ? user.workerId ?? '' : '');
  const [selectedMonth, setSelectedMonth] = useState(defaultMonth);
  const [workLogs, setWorkLogs] = useState<WorkLog[]>([]);
  const [summary, setSummary] = useState<WorkLogSummary | null>(null);
  const [editingLogId, setEditingLogId] = useState<string | null>(null);
  const [form, setForm] = useState({ workDate: defaultDate, startedAt: '08:00', endedAt: '16:00' });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [workSite, setWorkSite] = useState<WorkSite | null>(null);
  const [siteForm, setSiteForm] = useState({ address: '', latitude: '', longitude: '' });
  const [isSavingSite, setIsSavingSite] = useState(false);
  const [isGeoTracking, setIsGeoTracking] = useState(false);
  const [geoDisableReason, setGeoDisableReason] = useState('');
  const [isUpdatingGeoState, setIsUpdatingGeoState] = useState(false);
  const [currentWorkerPoint, setCurrentWorkerPoint] = useState<WorkerPoint | null>(null);
  const [photoReports, setPhotoReports] = useState<WorkPhotoReport[]>([]);
  const [reportForm, setReportForm] = useState({ workDate: defaultDate, note: '', photoUrls: [] as string[] });
  const [shiftStartForm, setShiftStartForm] = useState({ note: '', photoUrls: [] as string[] });
  const [shiftEndForm, setShiftEndForm] = useState({ note: '', photoUrls: [] as string[] });
  const [isUploadingReportPhoto, setIsUploadingReportPhoto] = useState(false);
  const [isUploadingShiftPhoto, setIsUploadingShiftPhoto] = useState(false);
  const [isStartingShift, setIsStartingShift] = useState(false);
  const [isFinishingShift, setIsFinishingShift] = useState(false);
  const [isSavingReport, setIsSavingReport] = useState(false);

  const isWorkerOnly = user?.role === 'worker';

  const loadWorkers = async () => {
    const token = ensureAccessToken();
    const response = await axios.get(`${API_BASE}/api/v1/workers/directory`, {
      headers: { Authorization: `Bearer ${token}` }
    });

    const items = response.data.items ?? [];
    setWorkers(items);

    if (isWorkerOnly) {
      setSelectedWorkerId(user?.workerId ?? '');
      return;
    }

    if (!selectedWorkerId && items.length > 0) {
      setSelectedWorkerId(items[0].id);
    }
  };

  const loadWorkLogs = async (workerId: string, month: string) => {
    if (!workerId) {
      setWorkLogs([]);
      setSummary(null);
      return;
    }

    const token = ensureAccessToken();
    const response = await axios.get(`${API_BASE}/api/v1/workers/${workerId}/work-logs?month=${month}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    setWorkLogs(response.data.items ?? []);
    setSummary(response.data.summary ?? null);
  };

  const loadWorkSite = async (workerId: string) => {
    const token = ensureAccessToken();
    const response = await axios.get(`${API_BASE}/api/v1/workers/${workerId}/work-site`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    const site = response.data.site ?? null;
    setWorkSite(site);
    if (site) {
      setSiteForm({
        address: site.address,
        latitude: String(site.latitude),
        longitude: String(site.longitude)
      });

      if (site.lastPingLatitude !== null && site.lastPingLatitude !== undefined && site.lastPingLongitude !== null && site.lastPingLongitude !== undefined) {
        setCurrentWorkerPoint({
          latitude: site.lastPingLatitude,
          longitude: site.lastPingLongitude,
          label: 'Последняя точка работника'
        });
      } else {
        setCurrentWorkerPoint(null);
      }
    } else {
      setCurrentWorkerPoint(null);
    }
  };

  const loadPhotoReports = async (workerId: string, month: string) => {
    const token = ensureAccessToken();
    const response = await axios.get(`${API_BASE}/api/v1/workers/${workerId}/photo-reports?month=${month}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    setPhotoReports(response.data.items ?? []);
  };

  useEffect(() => {
    loadWorkers().catch((error) => setFeedback({ type: 'error', text: describeAxiosError(error) }));
  }, []);

  useEffect(() => {
    if (!selectedWorkerId) return;
    Promise.all([
      loadWorkLogs(selectedWorkerId, selectedMonth),
      loadWorkSite(selectedWorkerId),
      loadPhotoReports(selectedWorkerId, selectedMonth)
    ]).catch((error) => setFeedback({ type: 'error', text: describeAxiosError(error) }));
  }, [selectedWorkerId, selectedMonth]);

  useEffect(() => {
    if (workSite && workSite.geolocationEnabled === false) {
      setIsGeoTracking(false);
    }
  }, [workSite?.id, workSite?.geolocationEnabled]);

  useEffect(() => {
    if (!isGeoTracking || !workSite || !selectedWorkerId) {
      return;
    }

    if (workSite.geolocationEnabled === false) {
      setFeedback({ type: 'error', text: 'Геолокация для этой смены отключена. Для продолжения включите геолокацию.' });
      setIsGeoTracking(false);
      return;
    }

    if (!navigator.geolocation) {
      setFeedback({ type: 'error', text: 'Геолокация не поддерживается этим браузером.' });
      setIsGeoTracking(false);
      return;
    }

    const watchId = navigator.geolocation.watchPosition(
      async (position) => {
        try {
          const token = ensureAccessToken();
          const response = await axios.post(
            `${API_BASE}/api/v1/work-sites/${workSite.id}/pings`,
            {
              latitude: position.coords.latitude,
              longitude: position.coords.longitude,
              accuracyMeters: position.coords.accuracy
            },
            { headers: { Authorization: `Bearer ${token}` } }
          );

          setCurrentWorkerPoint({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            label: 'Вы здесь'
          });

          const inside = response.data.isInside ? 'внутри зоны' : 'вне зоны';
          setFeedback({
            type: response.data.isInside ? 'success' : 'error',
            text: `Геопинг отправлен: ${inside}, дистанция ${Math.round(Number(response.data.distanceMeters ?? 0))} м.`
          });

          await loadWorkSite(selectedWorkerId);
        } catch (error) {
          setFeedback({ type: 'error', text: describeAxiosError(error) });
        }
      },
      (error) => {
        setFeedback({ type: 'error', text: `Ошибка геолокации: ${error.message}` });
      },
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 10000 }
    );

    return () => {
      navigator.geolocation.clearWatch(watchId);
    };
  }, [isGeoTracking, workSite?.id, workSite?.geolocationEnabled, selectedWorkerId]);

  const geocodeAddress = async () => {
    if (!siteForm.address.trim()) {
      setFeedback({ type: 'error', text: 'Укажите адрес перед геокодированием.' });
      return;
    }

    try {
      const query = encodeURIComponent(siteForm.address.trim());
      const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${query}`);
      const data = await response.json() as Array<{ lat: string; lon: string }>;
      if (!Array.isArray(data) || data.length === 0) {
        setFeedback({ type: 'error', text: 'Адрес не найден. Уточните формулировку.' });
        return;
      }
      setSiteForm((previous) => ({ ...previous, latitude: data[0].lat, longitude: data[0].lon }));
      setFeedback({ type: 'success', text: 'Координаты по адресу найдены.' });
    } catch {
      setFeedback({ type: 'error', text: 'Не удалось получить координаты адреса.' });
    }
  };

  const reverseGeocodePoint = async (latitude: number, longitude: number) => {
    try {
      const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${latitude}&lon=${longitude}`);
      const data = await response.json() as { display_name?: string };
      if (data.display_name) {
        setSiteForm((previous) => ({
          ...previous,
          address: data.display_name ?? previous.address,
          latitude: latitude.toFixed(6),
          longitude: longitude.toFixed(6)
        }));
      }
    } catch {
      // Keep manually entered address when reverse geocoding fails.
    }
  };

  const setPointFromMap = async (latitude: number, longitude: number) => {
    setSiteForm((previous) => ({
      ...previous,
      latitude: latitude.toFixed(6),
      longitude: longitude.toFixed(6)
    }));
    setFeedback({ type: 'success', text: 'Точка на карте выбрана. При необходимости откорректируйте адрес и сохраните.' });
    await reverseGeocodePoint(latitude, longitude);
  };

  const saveWorkSite = async () => {
    if (!selectedWorkerId) {
      setFeedback({ type: 'error', text: 'Сначала выберите работника.' });
      return;
    }

    const latitude = Number(siteForm.latitude);
    const longitude = Number(siteForm.longitude);
    if (!siteForm.address.trim() || !Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      setFeedback({ type: 'error', text: 'Укажите адрес и найдите точку через карту или кнопку поиска.' });
      return;
    }

    setIsSavingSite(true);
    try {
      const token = ensureAccessToken();
      await axios.post(
        `${API_BASE}/api/v1/workers/${selectedWorkerId}/work-site`,
        {
          address: siteForm.address.trim(),
          latitude,
          longitude,
          radiusMeters: 5
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      await loadWorkSite(selectedWorkerId);
      setFeedback({ type: 'success', text: 'Адрес работ установлен, зона 5 метров активна.' });
    } catch (error) {
      setFeedback({ type: 'error', text: describeAxiosError(error) });
    } finally {
      setIsSavingSite(false);
    }
  };

  const updateGeolocationState = async (enabled: boolean) => {
    if (!workSite || !selectedWorkerId) {
      setFeedback({ type: 'error', text: 'Сначала сохраните адрес работ.' });
      return;
    }

    if (!enabled && !geoDisableReason.trim()) {
      setFeedback({ type: 'error', text: 'Укажите причину перед отключением геолокации.' });
      return;
    }

    setIsUpdatingGeoState(true);
    try {
      const token = ensureAccessToken();
      await axios.post(
        `${API_BASE}/api/v1/work-sites/${workSite.id}/geolocation-state`,
        {
          enabled,
          reason: enabled ? undefined : geoDisableReason.trim()
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      await loadWorkSite(selectedWorkerId);
      if (enabled) {
        setFeedback({ type: 'success', text: 'Геолокация включена. Можно продолжить смену.' });
      } else {
        setIsGeoTracking(false);
        setFeedback({ type: 'success', text: 'Геолокация отключена, причина сохранена и видна администратору.' });
      }
    } catch (error) {
      setFeedback({ type: 'error', text: describeAxiosError(error) });
    } finally {
      setIsUpdatingGeoState(false);
    }
  };

  const uploadReportPhotos = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    if (files.length === 0) return;
    setIsUploadingReportPhoto(true);
    try {
      const uploadedPhotoUrls = await Promise.all(files.map((file) => uploadRegistrationPhoto(file)));
      setReportForm((previous) => ({
        ...previous,
        photoUrls: [...previous.photoUrls, ...uploadedPhotoUrls]
      }));
    } catch (error) {
      setFeedback({ type: 'error', text: describeAxiosError(error) });
    } finally {
      setIsUploadingReportPhoto(false);
      event.target.value = '';
    }
  };

  const uploadShiftPhotos = async (event: React.ChangeEvent<HTMLInputElement>, phase: 'start' | 'end') => {
    const files = Array.from(event.target.files ?? []);
    if (files.length === 0) return;
    setIsUploadingShiftPhoto(true);
    try {
      const uploadedPhotoUrls = await Promise.all(files.map((file) => uploadRegistrationPhoto(file)));
      if (phase === 'start') {
        setShiftStartForm((previous) => ({
          ...previous,
          photoUrls: [...previous.photoUrls, ...uploadedPhotoUrls]
        }));
      } else {
        setShiftEndForm((previous) => ({
          ...previous,
          photoUrls: [...previous.photoUrls, ...uploadedPhotoUrls]
        }));
      }
    } catch (error) {
      setFeedback({ type: 'error', text: describeAxiosError(error) });
    } finally {
      setIsUploadingShiftPhoto(false);
      event.target.value = '';
    }
  };

  const removeShiftPhoto = (phase: 'start' | 'end', index: number) => {
    if (phase === 'start') {
      setShiftStartForm((previous) => ({
        ...previous,
        photoUrls: previous.photoUrls.filter((_, currentIndex) => currentIndex !== index)
      }));
      return;
    }

    setShiftEndForm((previous) => ({
      ...previous,
      photoUrls: previous.photoUrls.filter((_, currentIndex) => currentIndex !== index)
    }));
  };

  const startShift = async () => {
    if (!workSite || !selectedWorkerId) {
      setFeedback({ type: 'error', text: 'Сначала сохраните адрес работ и выберите работника.' });
      return;
    }
    if (workSite.geolocationEnabled === false) {
      setFeedback({ type: 'error', text: 'Перед стартом смены включите геолокацию.' });
      return;
    }
    if (shiftStartForm.photoUrls.length === 0 || shiftStartForm.note.trim().length < 3) {
      setFeedback({ type: 'error', text: 'Для начала смены добавьте фото и опишите план работ (минимум 3 символа).' });
      return;
    }

    setIsStartingShift(true);
    try {
      const token = ensureAccessToken();
      await axios.post(
        `${API_BASE}/api/v1/work-sites/${workSite.id}/start-shift`,
        {
          photoUrl: shiftStartForm.photoUrls[0],
          photoUrls: shiftStartForm.photoUrls,
          note: shiftStartForm.note.trim()
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      await Promise.all([loadWorkSite(selectedWorkerId), loadPhotoReports(selectedWorkerId, selectedMonth)]);
      setShiftStartForm({ note: '', photoUrls: [] });
      setFeedback({ type: 'success', text: 'Смена начата. Учет времени запущен.' });
      setIsGeoTracking(true);
    } catch (error) {
      setFeedback({ type: 'error', text: describeAxiosError(error) });
    } finally {
      setIsStartingShift(false);
    }
  };

  const finishShift = async () => {
    if (!workSite || !selectedWorkerId) {
      setFeedback({ type: 'error', text: 'Сначала сохраните адрес работ и выберите работника.' });
      return;
    }
    if (shiftEndForm.photoUrls.length === 0 || shiftEndForm.note.trim().length < 3) {
      setFeedback({ type: 'error', text: 'Для завершения смены добавьте фото и итог работ (минимум 3 символа).' });
      return;
    }

    setIsFinishingShift(true);
    try {
      const token = ensureAccessToken();
      await axios.post(
        `${API_BASE}/api/v1/work-sites/${workSite.id}/finish-shift`,
        {
          photoUrl: shiftEndForm.photoUrls[0],
          photoUrls: shiftEndForm.photoUrls,
          note: shiftEndForm.note.trim()
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      setIsGeoTracking(false);
      await Promise.all([
        loadWorkSite(selectedWorkerId),
        loadWorkLogs(selectedWorkerId, selectedMonth),
        loadPhotoReports(selectedWorkerId, selectedMonth)
      ]);
      setShiftEndForm({ note: '', photoUrls: [] });
      setFeedback({ type: 'success', text: 'Смена завершена. Время автоматически добавлено в календарь.' });
    } catch (error) {
      setFeedback({ type: 'error', text: describeAxiosError(error) });
    } finally {
      setIsFinishingShift(false);
    }
  };

  const removeReportPhoto = (index: number) => {
    setReportForm((previous) => ({
      ...previous,
      photoUrls: previous.photoUrls.filter((_, currentIndex) => currentIndex !== index)
    }));
  };

  const savePhotoReport = async () => {
    if (!selectedWorkerId) {
      setFeedback({ type: 'error', text: 'Сначала выберите работника.' });
      return;
    }
    if (reportForm.photoUrls.length === 0) {
      setFeedback({ type: 'error', text: 'Сначала загрузите фото отчета.' });
      return;
    }

    setIsSavingReport(true);
    try {
      const token = ensureAccessToken();
      await axios.post(
        `${API_BASE}/api/v1/workers/${selectedWorkerId}/photo-reports`,
        {
          workDate: reportForm.workDate,
          photoUrl: reportForm.photoUrls[0],
          photoUrls: reportForm.photoUrls,
          note: reportForm.note.trim() || undefined
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      await loadPhotoReports(selectedWorkerId, selectedMonth);
      setReportForm((previous) => ({ ...previous, note: '', photoUrls: [] }));
      setFeedback({ type: 'success', text: 'Фотоотчет сохранен.' });
    } catch (error) {
      setFeedback({ type: 'error', text: describeAxiosError(error) });
    } finally {
      setIsSavingReport(false);
    }
  };

  const logsByDate = useMemo(() => {
    const map = new Map<string, { minutes: number; earnedOre: number }>();
    if (summary?.earningsByDate) {
      for (const [key, value] of Object.entries(summary.earningsByDate)) {
        map.set(key, value);
      }
      return map;
    }

    for (const log of workLogs) {
      const key = log.workDateKey ?? getDateKey(log.workDate);
      const existing = map.get(key) ?? { minutes: 0, earnedOre: 0 };
      map.set(key, {
        minutes: existing.minutes + log.totalMinutes,
        earnedOre: existing.earnedOre + (log.earnedOre ?? 0)
      });
    }
    return map;
  }, [workLogs, summary]);

  const totalWorkedMinutes = summary?.totalMinutes ?? workLogs.reduce((sum, log) => sum + log.totalMinutes, 0);
  const totalEarnedOre = summary?.totalEarnedOre ?? workLogs.reduce((sum, log) => sum + (log.earnedOre ?? 0), 0);
  const workedDaysCount = logsByDate.size;
  const calendarDays = useMemo(() => buildCalendarDays(selectedMonth), [selectedMonth]);
  const draftLatitude = Number(siteForm.latitude);
  const draftLongitude = Number(siteForm.longitude);
  const draftSitePoint = Number.isFinite(draftLatitude) && Number.isFinite(draftLongitude)
    ? { latitude: draftLatitude, longitude: draftLongitude }
    : null;

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!selectedWorkerId) {
      setFeedback({ type: 'error', text: 'Сначала выберите работника.' });
      return;
    }

    setIsSubmitting(true);
    setFeedback(null);

    try {
      const token = ensureAccessToken();
      const payload = { workDate: form.workDate, startedAt: form.startedAt, endedAt: form.endedAt };

      if (editingLogId) {
        await axios.put(`${API_BASE}/api/v1/work-logs/${editingLogId}`, payload, {
          headers: { Authorization: `Bearer ${token}` }
        });
      } else {
        await axios.post(`${API_BASE}/api/v1/workers/${selectedWorkerId}/work-logs`, payload, {
          headers: { Authorization: `Bearer ${token}` }
        });
      }

      await loadWorkLogs(selectedWorkerId, selectedMonth);
      setEditingLogId(null);
      setFeedback({ type: 'success', text: 'Рабочее время сохранено.' });
    } catch (error) {
      setFeedback({ type: 'error', text: describeAxiosError(error) || 'Не удалось сохранить рабочее время.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const startEditing = (log: WorkLog) => {
    setEditingLogId(log.id);
    setForm({ workDate: getDateKey(log.workDate), startedAt: formatTimeLabel(log.startedAt), endedAt: formatTimeLabel(log.endedAt) });
    setFeedback(null);
  };

  const removeLog = async (logId: string) => {
    try {
      const token = ensureAccessToken();
      await axios.delete(`${API_BASE}/api/v1/work-logs/${logId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (editingLogId === logId) setEditingLogId(null);
      await loadWorkLogs(selectedWorkerId, selectedMonth);
    } catch (error) {
      setFeedback({ type: 'error', text: describeAxiosError(error) });
    }
  };

  const content = (
    <>
      <div className="grid gap-4 md:grid-cols-4">
        <div className="rounded-[1.75rem] border border-white/10 bg-white/5 p-5">
          <p className="text-xs uppercase tracking-[0.25em] text-slate-500">Рабочих дней</p>
          <p className="mt-3 text-4xl font-semibold text-cyan-300">{workedDaysCount}</p>
        </div>
        <div className="rounded-[1.75rem] border border-white/10 bg-white/5 p-5">
          <p className="text-xs uppercase tracking-[0.25em] text-slate-500">Всего за месяц</p>
          <p className="mt-3 text-4xl font-semibold text-emerald-300">{formatMinutes(totalWorkedMinutes)}</p>
        </div>
        <div className="rounded-[1.75rem] border border-white/10 bg-white/5 p-5">
          <p className="text-xs uppercase tracking-[0.25em] text-slate-500">Заработано</p>
          <p className="mt-3 text-3xl font-semibold text-amber-300">{formatNokFromOre(totalEarnedOre)}</p>
          {summary ? <p className="mt-2 text-xs text-slate-500">Ставка: {formatNokFromOre(summary.hourlyRateOre)}/ч</p> : null}
        </div>
        <div className="rounded-[1.75rem] border border-white/10 bg-white/5 p-5">
          <p className="text-xs uppercase tracking-[0.25em] text-slate-500">Месяц</p>
          <input className="mt-3 w-full rounded-2xl border border-white/10 bg-slate-950/60 px-3 py-3 text-sm" type="month" value={selectedMonth} onChange={(event) => setSelectedMonth(event.target.value)} />
        </div>
      </div>

      {feedback ? <div className={`mt-4 rounded-2xl border px-4 py-3 text-sm ${feedback.type === 'success' ? 'border-emerald-700/40 bg-emerald-500/10 text-emerald-200' : 'border-rose-700/40 bg-rose-500/10 text-rose-200'}`}>{feedback.text}</div> : null}

      <div className="mt-6 grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
        <div className="space-y-6">
          <div className="grid gap-4 rounded-[2rem] border border-white/10 bg-white/5 p-5 md:p-6">
            <div>
              <h2 className="text-2xl font-semibold">Геолокация рабочего места</h2>
              <p className="mt-2 text-sm text-slate-400">Карта всегда активна: укажите адрес или поставьте точку кликом по карте, затем сохраните объект.</p>
            </div>

            <div className="grid gap-3">
              <label className="text-sm text-slate-300">Адрес работ</label>
              <input className="rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-3" value={siteForm.address} onChange={(event) => setSiteForm({ ...siteForm, address: event.target.value })} placeholder="Например: Storgata 10, Oslo" />
            </div>

            <div className="flex flex-wrap gap-3">
              <button type="button" className="rounded-2xl border border-white/10 px-4 py-3" onClick={geocodeAddress}>Найти координаты по адресу</button>
              <button type="button" className="rounded-2xl bg-cyan-400 px-4 py-3 font-semibold text-slate-950 disabled:opacity-70" onClick={saveWorkSite} disabled={isSavingSite}>{isSavingSite ? 'Сохраняю...' : 'Сохранить адрес работ'}</button>
              <button type="button" className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-emerald-100 disabled:opacity-70" onClick={() => setIsGeoTracking((previous) => !previous)} disabled={!workSite || workSite.geolocationEnabled === false}>{isGeoTracking ? 'Остановить геоконтроль' : 'Запустить геоконтроль'}</button>
            </div>

            <WorkSitePickerMap
              selectedPoint={draftSitePoint}
              selectedAddress={siteForm.address}
              workerPoint={currentWorkerPoint ? { latitude: currentWorkerPoint.latitude, longitude: currentWorkerPoint.longitude } : null}
              radiusMeters={workSite?.radiusMeters ?? 5}
              onSelectPoint={(latitude, longitude) => {
                setPointFromMap(latitude, longitude).catch(() => {
                  // Ignore reverse geocoding errors and keep selected coordinates.
                });
              }}
            />

            <div className="grid gap-3 rounded-2xl border border-white/10 bg-slate-950/30 p-4">
              <p className="text-sm text-slate-300">Управление геолокацией смены</p>
              <textarea className="min-h-20 rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-3 text-sm" value={geoDisableReason} onChange={(event) => setGeoDisableReason(event.target.value)} placeholder="Причина отключения геолокации (обязательно для выключения)" />
              <div className="flex flex-wrap gap-3">
                <button type="button" className="rounded-2xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-rose-100 disabled:opacity-70" onClick={() => updateGeolocationState(false)} disabled={!workSite || isUpdatingGeoState}>Выключить геолокацию</button>
                <button type="button" className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-emerald-100 disabled:opacity-70" onClick={() => updateGeolocationState(true)} disabled={!workSite || isUpdatingGeoState}>Включить геолокацию / Продолжить смену</button>
              </div>
            </div>

            {workSite ? (
              <div className="rounded-2xl border border-white/10 bg-slate-950/40 p-4 text-sm text-slate-300">
                <p><span className="text-slate-500">Активный адрес:</span> {workSite.address}</p>
                <p><span className="text-slate-500">Радиус:</span> {workSite.radiusMeters} м</p>
                <p><span className="text-slate-500">Геолокация:</span> {workSite.geolocationEnabled === false ? 'отключена' : 'включена'}</p>
                {workSite.geolocationEnabled === false ? <p><span className="text-slate-500">Причина отключения:</span> {workSite.geolocationDisabledReason ?? 'не указана'}</p> : null}
                <p><span className="text-slate-500">Последний пинг:</span> {workSite.lastPingAt ? new Date(workSite.lastPingAt).toLocaleString('ru-RU') : 'нет данных'}</p>
                <p><span className="text-slate-500">Дистанция до точки:</span> {workSite.lastDistanceMeters !== null && workSite.lastDistanceMeters !== undefined ? `${Math.round(workSite.lastDistanceMeters)} м` : 'нет данных'}</p>
                <p><span className="text-slate-500">Статус:</span> {workSite.leftAt ? `вышел из зоны в ${new Date(workSite.leftAt).toLocaleString('ru-RU')}` : 'в зоне / не зафиксирован выход'}</p>
              </div>
            ) : null}
          </div>

          <div className="grid gap-4 rounded-[2rem] border border-white/10 bg-white/5 p-5 md:p-6">
            <div>
              <h2 className="text-2xl font-semibold">Смена и фотоотчеты</h2>
              <p className="mt-2 text-sm text-slate-400">Старт смены: фото + план на день. Завершение смены: фото + итог. Время попадет в календарь автоматически.</p>
            </div>

            <div className="rounded-2xl border border-white/10 bg-slate-950/40 p-4 text-sm text-slate-300">
              <p><span className="text-slate-500">Статус смены:</span> {workSite?.isShiftActive ? 'активна' : 'не активна'}</p>
              <p><span className="text-slate-500">Начало:</span> {workSite?.shiftStartedAt ? new Date(workSite.shiftStartedAt).toLocaleString('ru-RU') : 'еще не начата'}</p>
              <p><span className="text-slate-500">Окончание:</span> {workSite?.shiftEndedAt ? new Date(workSite.shiftEndedAt).toLocaleString('ru-RU') : 'еще не завершена'}</p>
            </div>

            <div className="grid gap-3 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4">
              <p className="text-sm text-emerald-100">Начать работу</p>
              <input className="rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-3" type="file" accept="image/*" multiple onChange={(event) => uploadShiftPhotos(event, 'start')} />
              {shiftStartForm.photoUrls.length > 0 ? (
                <div className="grid gap-2 sm:grid-cols-2">
                  {shiftStartForm.photoUrls.map((photoUrl, index) => (
                    <div key={`${photoUrl}-${index}`} className="overflow-hidden rounded-xl border border-white/10 bg-slate-950/40">
                      <img src={photoUrl} alt={`Start report ${index + 1}`} className="h-28 w-full object-cover" />
                      <button type="button" className="w-full px-3 py-2 text-xs text-rose-200" onClick={() => removeShiftPhoto('start', index)}>Удалить</button>
                    </div>
                  ))}
                </div>
              ) : null}
              <textarea className="min-h-24 rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-3" value={shiftStartForm.note} onChange={(event) => setShiftStartForm({ ...shiftStartForm, note: event.target.value })} placeholder="Что планируете сделать сегодня?" />
              <button type="button" className="rounded-2xl bg-emerald-400 px-4 py-3 font-semibold text-slate-950 disabled:opacity-70" onClick={startShift} disabled={!workSite || workSite.isShiftActive || isStartingShift || isUploadingShiftPhoto}>{isStartingShift ? 'Запускаю...' : 'Начать работу'}</button>
            </div>

            <div className="grid gap-3 rounded-2xl border border-rose-500/30 bg-rose-500/10 p-4">
              <p className="text-sm text-rose-100">Закончить работу</p>
              <input className="rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-3" type="file" accept="image/*" multiple onChange={(event) => uploadShiftPhotos(event, 'end')} />
              {shiftEndForm.photoUrls.length > 0 ? (
                <div className="grid gap-2 sm:grid-cols-2">
                  {shiftEndForm.photoUrls.map((photoUrl, index) => (
                    <div key={`${photoUrl}-${index}`} className="overflow-hidden rounded-xl border border-white/10 bg-slate-950/40">
                      <img src={photoUrl} alt={`End report ${index + 1}`} className="h-28 w-full object-cover" />
                      <button type="button" className="w-full px-3 py-2 text-xs text-rose-200" onClick={() => removeShiftPhoto('end', index)}>Удалить</button>
                    </div>
                  ))}
                </div>
              ) : null}
              <textarea className="min-h-24 rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-3" value={shiftEndForm.note} onChange={(event) => setShiftEndForm({ ...shiftEndForm, note: event.target.value })} placeholder="Что сделано по итогам дня?" />
              <button type="button" className="rounded-2xl bg-rose-300 px-4 py-3 font-semibold text-slate-950 disabled:opacity-70" onClick={finishShift} disabled={!workSite || !workSite.isShiftActive || isFinishingShift || isUploadingShiftPhoto}>{isFinishingShift ? 'Завершаю...' : 'Закончил работу'}</button>
            </div>

            <p className="text-xs text-slate-500">{isUploadingShiftPhoto ? 'Фото загружаются...' : 'В оба отчета можно добавить несколько фото.'}</p>

            <div className="space-y-3">
              {photoReports.map((report) => (
                <div key={report.id} className="rounded-2xl border border-white/10 bg-slate-950/40 p-3">
                  <p className="text-sm text-slate-400">{String(report.workDate).slice(0, 10)} • {report.reportType === 'start' ? 'Старт смены' : 'Завершение/дневной отчет'}</p>
                  {report.photoUrls && report.photoUrls.length > 0 ? (
                    <div className="mt-2 grid gap-2 sm:grid-cols-2">
                      {report.photoUrls.map((photoUrl, index) => (
                        <img key={`${report.id}-${index}`} src={photoUrl} alt={`Worker report ${index + 1}`} className="h-28 w-full rounded-xl object-cover" />
                      ))}
                    </div>
                  ) : (
                    <img src={report.photoUrl} alt="Worker report" className="mt-2 h-32 w-full rounded-xl object-cover" />
                  )}
                  {report.note ? <p className="mt-2 text-sm text-slate-300">{report.note}</p> : null}
                </div>
              ))}
              {photoReports.length === 0 ? <p className="text-sm text-slate-400">Фотоотчетов за выбранный период пока нет.</p> : null}
            </div>
          </div>

          {!isWorkerOnly ? (
            <>
              <form onSubmit={submit} className="grid gap-4 rounded-[2rem] border border-white/10 bg-white/5 p-5 md:p-6">
                <div>
                  <h2 className="text-2xl font-semibold">{editingLogId ? 'Редактировать смену' : 'Добавить смену'}</h2>
                  <p className="mt-2 text-sm text-slate-400">Админский режим для управления табелями сотрудников.</p>
                </div>

                <div className="grid gap-1">
                  <label className="text-sm text-slate-300">Сотрудник</label>
                  <select className="rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-3" value={selectedWorkerId} onChange={(event) => setSelectedWorkerId(event.target.value)}>
                    {workers.map((worker) => <option key={worker.id} value={worker.id}>{worker.fullName} ({worker.role})</option>)}
                  </select>
                </div>

                <div className="grid gap-4 md:grid-cols-3">
                  <div className="grid gap-1 md:col-span-1">
                    <label className="text-sm text-slate-300">Дата</label>
                    <input className="rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-3" type="date" value={form.workDate} onChange={(event) => setForm({ ...form, workDate: event.target.value })} required />
                  </div>
                  <div className="grid gap-1">
                    <label className="text-sm text-slate-300">Начало</label>
                    <input className="rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-3" type="time" value={form.startedAt} onChange={(event) => setForm({ ...form, startedAt: event.target.value })} required />
                  </div>
                  <div className="grid gap-1">
                    <label className="text-sm text-slate-300">Конец</label>
                    <input className="rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-3" type="time" value={form.endedAt} onChange={(event) => setForm({ ...form, endedAt: event.target.value })} required />
                  </div>
                </div>

                <div className="flex flex-wrap gap-3">
                  <button className="rounded-2xl bg-cyan-400 px-4 py-3 font-semibold text-slate-950 disabled:opacity-70" type="submit" disabled={isSubmitting}>{isSubmitting ? 'Сохраняю...' : editingLogId ? 'Сохранить изменения' : 'Добавить смену'}</button>
                  {editingLogId ? <button type="button" className="rounded-2xl border border-white/10 px-4 py-3" onClick={() => { setEditingLogId(null); setForm({ workDate: defaultDate, startedAt: '08:00', endedAt: '16:00' }); setFeedback(null); }}>Отмена</button> : null}
                </div>
              </form>

              <div className="rounded-[2rem] border border-white/10 bg-white/5 p-5 md:p-6">
                <h2 className="text-2xl font-semibold">Журнал смен</h2>
                <div className="mt-4 space-y-3">
                  {workLogs.map((log) => (
                    <div key={log.id} className="flex flex-col gap-4 rounded-[1.5rem] border border-white/10 bg-slate-950/40 p-4 md:flex-row md:items-center md:justify-between">
                      <div>
                        <p className="font-medium text-cyan-300">{formatDateLabel(log.workDate)}</p>
                        <p className="mt-1 text-sm text-slate-400">{formatTimeLabel(log.startedAt)} - {formatTimeLabel(log.endedAt)}</p>
                        <p className="mt-1 text-sm text-slate-500">Потрачено: {formatMinutes(log.totalMinutes)}</p>
                        <p className="mt-1 text-sm text-amber-300">Заработано: {formatNokFromOre(log.earnedOre ?? 0)}</p>
                      </div>
                      <div className="flex gap-2">
                        <button className="rounded-2xl border border-white/10 px-4 py-2 text-sm" onClick={() => startEditing(log)}>Изменить</button>
                        <button className="rounded-2xl border border-rose-500/30 bg-rose-500/10 px-4 py-2 text-sm text-rose-100" onClick={() => removeLog(log.id)}>Удалить</button>
                      </div>
                    </div>
                  ))}
                  {workLogs.length === 0 ? <p className="text-sm text-slate-400">За выбранный месяц смен пока нет.</p> : null}
                </div>
              </div>
            </>
          ) : null}
        </div>

        <div className="rounded-[2rem] border border-white/10 bg-white/5 p-5 md:p-6">
          <h2 className="text-2xl font-semibold">Календарь</h2>
          <p className="mt-2 text-sm text-slate-400">Нажми на день, чтобы быстро подставить дату в форму. Теперь здесь видно и время, и сколько работник заработал за день.</p>
          {workSite ? (
            <div className="mt-4 overflow-hidden rounded-2xl border border-white/10">
              <iframe
                title="Work site map"
                src={`https://www.openstreetmap.org/export/embed.html?bbox=${workSite.longitude - 0.002}%2C${workSite.latitude - 0.002}%2C${workSite.longitude + 0.002}%2C${workSite.latitude + 0.002}&layer=mapnik&marker=${workSite.latitude}%2C${workSite.longitude}`}
                className="h-56 w-full"
              />
            </div>
          ) : null}
          <div className="mt-5 grid grid-cols-7 gap-2 text-center text-xs uppercase tracking-[0.2em] text-slate-500">
            <div>Пн</div><div>Вт</div><div>Ср</div><div>Чт</div><div>Пт</div><div>Сб</div><div>Вс</div>
          </div>
          <div className="mt-3 grid grid-cols-7 gap-2">
            {calendarDays.map((day, index) => {
              if (!day) return <div key={`empty-${index}`} className="min-h-28 rounded-2xl border border-transparent" />;
              const dateKey = `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, '0')}-${String(day.getDate()).padStart(2, '0')}`;
              const dayData = logsByDate.get(dateKey) ?? { minutes: 0, earnedOre: 0 };
              const isSelected = form.workDate === dateKey;
              return (
                <button key={dateKey} type="button" onClick={() => setForm({ ...form, workDate: dateKey })} className={`min-h-28 rounded-2xl border p-3 text-left transition ${isSelected ? 'border-cyan-400 bg-cyan-500/10' : 'border-white/10 bg-slate-950/40'} ${dayData.minutes > 0 ? 'shadow-[inset_0_0_0_1px_rgba(16,185,129,0.45)]' : ''}`}>
                  <div className="text-sm font-medium text-slate-100">{day.getDate()}</div>
                  {dayData.minutes > 0 ? (
                    <>
                      <div className="mt-3 text-xs text-emerald-300">{formatMinutes(dayData.minutes)}</div>
                      <div className="mt-2 text-[11px] leading-4 text-amber-300">{formatNokFromOre(dayData.earnedOre)}</div>
                    </>
                  ) : <div className="mt-3 text-xs text-slate-500">Нет смены</div>}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </>
  );

  return isWorkerOnly ? (
    <WorkerShell title="Мои смены" description="Личная страница работника: начни смену по адресу/геолокации, завершай с фотоотчетом и смотри учет времени в календаре.">{content}</WorkerShell>
  ) : (
    <AdminShell title="Учёт рабочего времени" eyebrow="Attendance" description="Админский обзор смен сотрудников с датой, временем и расчётом заработка.">{content}</AdminShell>
  );
}
