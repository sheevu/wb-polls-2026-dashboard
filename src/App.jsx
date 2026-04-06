import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { CircleMarker, MapContainer, TileLayer, useMap, useMapEvents } from 'react-leaflet';
import { Crosshair, ExternalLink, LocateFixed, MapPin, RefreshCw, Trash2, X } from 'lucide-react';

const DEFAULT_CENTER = [22.5726, 88.3639];
const DEFAULT_ZOOM = 12;
const LONG_PRESS_MS = 500;
const POLL_INTERVAL_MS = 30000;
const MARKERS_STORAGE_KEY = 'touch-map-markers-v1';
const WEATHER_STORAGE_KEY = 'touch-map-weather-v1';
const VISUALISER_URL = 'https://wb-polls-2026.vercel.app';

function loadPersistedMarkers() {
  if (typeof window === 'undefined') {
    return [];
  }

  try {
    const raw = window.localStorage.getItem(MARKERS_STORAGE_KEY);
    if (!raw) {
      return [];
    }

    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed.filter(
      (item) =>
        item &&
        typeof item.id === 'string' &&
        typeof item.label === 'string' &&
        typeof item.lat === 'number' &&
        typeof item.lng === 'number'
    );
  } catch {
    return [];
  }
}

function readCachedWeather() {
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    const raw = window.localStorage.getItem(WEATHER_STORAGE_KEY);
    if (!raw) {
      return null;
    }
    const parsed = JSON.parse(raw);
    if (!parsed || !parsed.data) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function vibrateFeedback() {
  if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
    navigator.vibrate(50);
  }
}

function useRealtimeWeather(coords) {
  const cachedWeather = useMemo(() => readCachedWeather(), []);
  const [weather, setWeather] = useState(cachedWeather?.data ?? null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [updatedAt, setUpdatedAt] = useState(cachedWeather?.updatedAt ?? '');

  useEffect(() => {
    if (typeof window === 'undefined' || !coords) {
      return undefined;
    }

    let isMounted = true;
    let intervalId;
    const [latitude, longitude] = coords;

    const fetchWeather = async () => {
      try {
        const url = `https://api.open-meteo.com/v1/forecast?latitude=${latitude.toFixed(4)}&longitude=${longitude.toFixed(4)}&current=temperature_2m,relative_humidity_2m,wind_speed_10m&timezone=auto`;
        const response = await fetch(url);
        if (!response.ok) {
          throw new Error(`Weather fetch failed with ${response.status}`);
        }

        const payload = await response.json();
        const current = payload?.current ?? null;

        if (!isMounted || !current) {
          return;
        }

        setWeather({
          temperature: current.temperature_2m,
          humidity: current.relative_humidity_2m,
          windSpeed: current.wind_speed_10m,
        });
        if (typeof window !== 'undefined') {
          window.localStorage.setItem(
            WEATHER_STORAGE_KEY,
            JSON.stringify({
              data: {
                temperature: current.temperature_2m,
                humidity: current.relative_humidity_2m,
                windSpeed: current.wind_speed_10m,
              },
              updatedAt: new Date().toLocaleTimeString(),
            })
          );
        }
        setError('');
        setUpdatedAt(new Date().toLocaleTimeString());
      } catch (fetchError) {
        if (!isMounted) {
          return;
        }
        const cached = readCachedWeather();
        if (cached?.data) {
          setWeather(cached.data);
          setUpdatedAt(cached.updatedAt || '');
          setError('Offline mode: showing cached weather.');
        } else {
          setError('Live data unavailable. Retry in a moment.');
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    setLoading(true);
    fetchWeather();
    intervalId = window.setInterval(fetchWeather, POLL_INTERVAL_MS);

    return () => {
      isMounted = false;
      if (intervalId) {
        window.clearInterval(intervalId);
      }
    };
  }, [coords]);

  return { weather, loading, error, updatedAt };
}

function MapCommands({ commandRef }) {
  const map = useMap();

  useEffect(() => {
    commandRef.current = {
      flyTo: (coords, zoom = 15) => {
        map.flyTo(coords, zoom, { duration: 0.8 });
      },
      currentCenter: () => {
        const center = map.getCenter();
        return [center.lat, center.lng];
      },
    };

    return () => {
      commandRef.current = null;
    };
  }, [commandRef, map]);

  return null;
}

function LongPressDropLayer({ onDropMarker }) {
  const timerRef = useRef(null);
  const pendingLatLngRef = useRef(null);
  const firedRef = useRef(false);

  const clearTimer = useCallback(() => {
    if (typeof window !== 'undefined' && timerRef.current) {
      window.clearTimeout(timerRef.current);
    }
    timerRef.current = null;
    pendingLatLngRef.current = null;
  }, []);

  const startLongPress = useCallback(
    (latlng) => {
      clearTimer();
      firedRef.current = false;
      pendingLatLngRef.current = [latlng.lat, latlng.lng];

      if (typeof window !== 'undefined') {
        timerRef.current = window.setTimeout(() => {
          if (pendingLatLngRef.current && !firedRef.current) {
            firedRef.current = true;
            onDropMarker(pendingLatLngRef.current);
          }
          clearTimer();
        }, LONG_PRESS_MS);
      }
    },
    [clearTimer, onDropMarker]
  );

  useMapEvents({
    mousedown: (event) => startLongPress(event.latlng),
    touchstart: (event) => startLongPress(event.latlng),
    mouseup: () => clearTimer(),
    touchend: () => clearTimer(),
    dragstart: () => clearTimer(),
    zoomstart: () => clearTimer(),
    contextmenu: (event) => {
      if (!firedRef.current) {
        onDropMarker([event.latlng.lat, event.latlng.lng]);
        firedRef.current = true;
      }
      clearTimer();
    },
  });

  useEffect(() => () => clearTimer(), [clearTimer]);

  return null;
}

function BottomSheet({ marker, weather, onClose }) {
  return (
    <AnimatePresence>
      {marker ? (
        <motion.section
          key={marker.id}
          initial={{ y: '100%' }}
          animate={{ y: 0 }}
          exit={{ y: '100%' }}
          transition={{ type: 'spring', stiffness: 320, damping: 32 }}
          drag="y"
          dragConstraints={{ top: 0, bottom: 240 }}
          dragElastic={0.25}
          onDragEnd={(_, info) => {
            if (info.offset.y > 110) {
              onClose();
            }
          }}
          className="absolute inset-x-0 bottom-0 z-[500] rounded-t-3xl border-t border-slate-700 bg-slate-950/95 px-5 pb-8 pt-3 text-slate-100 shadow-2xl backdrop-blur"
        >
          <div className="mx-auto mb-4 h-1.5 w-12 rounded-full bg-slate-600" aria-hidden="true" />
          <div className="mb-4 flex items-start justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-widest text-slate-400">Marker Details</p>
              <p className="text-lg font-semibold text-emerald-300">{marker.label}</p>
            </div>
            <button
              type="button"
              onPointerDown={onClose}
              className="min-h-11 min-w-11 rounded-full border border-slate-700 bg-slate-900/90 p-2 active:scale-95"
              aria-label="Close marker sheet"
            >
              <X className="mx-auto h-5 w-5" />
            </button>
          </div>

          <div className="space-y-3 text-sm">
            <div className="rounded-2xl border border-slate-700 bg-slate-900/90 p-3">
              <p className="text-slate-400">Latitude</p>
              <p className="font-mono text-base text-white">{marker.lat.toFixed(6)}</p>
            </div>
            <div className="rounded-2xl border border-slate-700 bg-slate-900/90 p-3">
              <p className="text-slate-400">Longitude</p>
              <p className="font-mono text-base text-white">{marker.lng.toFixed(6)}</p>
            </div>

            {weather ? (
              <div className="rounded-2xl border border-emerald-900/60 bg-emerald-950/60 p-3">
                <p className="mb-1 text-xs uppercase tracking-wide text-emerald-300">Live Conditions</p>
                <p className="text-white">{weather.temperature}°C • {weather.humidity}% Humidity • {weather.windSpeed} km/h Wind</p>
              </div>
            ) : null}
          </div>
        </motion.section>
      ) : null}
    </AnimatePresence>
  );
}

export default function App() {
  const mapCommandRef = useRef(null);
  const markerCounterRef = useRef(1);

  const [markers, setMarkers] = useState(() => loadPersistedMarkers());
  const [selectedMarkerId, setSelectedMarkerId] = useState(null);
  const [activeCoords, setActiveCoords] = useState(DEFAULT_CENTER);

  const selectedMarker = useMemo(
    () => markers.find((marker) => marker.id === selectedMarkerId) ?? null,
    [markers, selectedMarkerId]
  );

  const { weather, loading, error, updatedAt } = useRealtimeWeather(activeCoords);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }
    window.localStorage.setItem(MARKERS_STORAGE_KEY, JSON.stringify(markers));
    if (markerCounterRef.current < markers.length + 1) {
      markerCounterRef.current = markers.length + 1;
    }
  }, [markers]);

  const dropMarker = useCallback((coords) => {
    const [lat, lng] = coords;
    const marker = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      label: `Point ${markerCounterRef.current}`,
      lat,
      lng,
      createdAt: Date.now(),
    };

    markerCounterRef.current += 1;
    setMarkers((previous) => [marker, ...previous]);
    setSelectedMarkerId(marker.id);
    setActiveCoords([lat, lng]);
    vibrateFeedback();

    if (mapCommandRef.current) {
      mapCommandRef.current.flyTo([lat, lng], 15);
    }
  }, []);

  const clearMarkers = useCallback(() => {
    setMarkers([]);
    setSelectedMarkerId(null);
  }, []);

  const centerOnUser = useCallback(() => {
    if (typeof window === 'undefined' || typeof navigator === 'undefined' || !navigator.geolocation) {
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const coords = [position.coords.latitude, position.coords.longitude];
        setActiveCoords(coords);
        if (mapCommandRef.current) {
          mapCommandRef.current.flyTo(coords, 15);
        }
        vibrateFeedback();
      },
      () => {
        if (mapCommandRef.current) {
          mapCommandRef.current.flyTo(DEFAULT_CENTER, DEFAULT_ZOOM);
        }
      },
      { enableHighAccuracy: true, maximumAge: 10000 }
    );
  }, []);

  const refreshDashboard = useCallback(() => {
    const center = mapCommandRef.current?.currentCenter();
    if (center) {
      setActiveCoords(center);
      vibrateFeedback();
    }
  }, []);

  const handleVisualiserPointerDown = useCallback(() => {
    vibrateFeedback();
  }, []);

  return (
    <div className="relative h-screen w-screen overflow-hidden bg-slate-950 text-slate-100">
      <MapContainer
        center={DEFAULT_CENTER}
        zoom={DEFAULT_ZOOM}
        zoomControl={false}
        className="h-full w-full touch-none"
        attributionControl={true}
        preferCanvas={true}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        <MapCommands commandRef={mapCommandRef} />
        <LongPressDropLayer onDropMarker={dropMarker} />

        {markers.map((marker) => (
          <CircleMarker
            key={marker.id}
            center={[marker.lat, marker.lng]}
            radius={11}
            pathOptions={{
              color: marker.id === selectedMarkerId ? '#f97316' : '#14b8a6',
              fillColor: marker.id === selectedMarkerId ? '#fb923c' : '#34d399',
              fillOpacity: 0.95,
              weight: 2,
            }}
            eventHandlers={{
              click: () => {
                setSelectedMarkerId(marker.id);
                setActiveCoords([marker.lat, marker.lng]);
                vibrateFeedback();
              },
            }}
          />
        ))}
      </MapContainer>

      <div className="pointer-events-none absolute inset-x-0 top-0 z-[450] p-4">
        <motion.section
          initial={{ y: -24, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 260, damping: 24 }}
          className="pointer-events-auto rounded-2xl border border-slate-700 bg-slate-900/90 p-4 shadow-xl backdrop-blur"
        >
          <div className="mb-3 flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-emerald-300">Touch Dashboard</p>
              <p className="text-xs text-slate-400">Long-press map (0.5s) to drop marker</p>
            </div>
            <MapPin className="h-5 w-5 text-emerald-300" />
          </div>

          <a
            href={VISUALISER_URL}
            target="_blank"
            rel="noopener noreferrer"
            onPointerDown={handleVisualiserPointerDown}
            className="mb-3 inline-flex min-h-11 min-w-11 w-full items-center justify-center gap-2 rounded-xl border border-emerald-700/60 bg-emerald-600/90 px-3 py-2 text-sm font-semibold text-slate-950 active:scale-[0.99]"
            aria-label="Open Visualiser"
          >
            Open Visualiser
            <ExternalLink className="h-4 w-4" />
          </a>

          <div className="grid grid-cols-3 gap-2 text-xs">
            <div className="rounded-xl border border-slate-700 bg-slate-800/80 p-2">
              <p className="text-slate-400">Markers</p>
              <p className="font-semibold text-white">{markers.length}</p>
            </div>
            <div className="rounded-xl border border-slate-700 bg-slate-800/80 p-2">
              <p className="text-slate-400">Temp</p>
              <p className="font-semibold text-white">{loading ? '...' : weather ? `${weather.temperature}°C` : '--'}</p>
            </div>
            <div className="rounded-xl border border-slate-700 bg-slate-800/80 p-2">
              <p className="text-slate-400">Wind</p>
              <p className="font-semibold text-white">{loading ? '...' : weather ? `${weather.windSpeed} km/h` : '--'}</p>
            </div>
          </div>

          <div className="mt-3 flex items-center justify-between text-[11px] text-slate-400">
            <span>{error || 'Realtime weather via Open-Meteo'}</span>
            <span>{updatedAt ? `Updated ${updatedAt}` : ''}</span>
          </div>
        </motion.section>
      </div>

      <div className="absolute bottom-28 right-4 z-[460] flex flex-col gap-3">
        <button
          type="button"
          onPointerDown={centerOnUser}
          className="min-h-11 min-w-11 rounded-2xl border border-slate-700 bg-slate-900/90 p-2 text-slate-100 shadow-lg active:scale-95"
          aria-label="Center on current location"
        >
          <LocateFixed className="mx-auto h-5 w-5" />
        </button>
        <button
          type="button"
          onPointerDown={refreshDashboard}
          className="min-h-11 min-w-11 rounded-2xl border border-slate-700 bg-slate-900/90 p-2 text-slate-100 shadow-lg active:scale-95"
          aria-label="Refresh real-time dashboard"
        >
          <RefreshCw className="mx-auto h-5 w-5" />
        </button>
        <button
          type="button"
          onPointerDown={clearMarkers}
          className="min-h-11 min-w-11 rounded-2xl border border-slate-700 bg-slate-900/90 p-2 text-slate-100 shadow-lg active:scale-95"
          aria-label="Clear all markers"
        >
          <Trash2 className="mx-auto h-5 w-5" />
        </button>
      </div>

      <div className="pointer-events-none absolute bottom-3 left-4 z-[430] rounded-full border border-slate-700 bg-slate-900/80 px-3 py-2 text-xs text-slate-300 backdrop-blur">
        <span className="inline-flex items-center gap-2">
          <Crosshair className="h-4 w-4 text-emerald-300" />
          Pinch to zoom, drag map, tap marker for details
        </span>
      </div>

      <BottomSheet
        marker={selectedMarker}
        weather={weather}
        onClose={() => setSelectedMarkerId(null)}
      />
    </div>
  );
}
