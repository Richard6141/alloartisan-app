import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, StyleProp, ViewStyle } from 'react-native';
import { WebView } from 'react-native-webview';
import { colors, radii } from '../theme/tokens';

export interface MapPoint {
    latitude: number;
    longitude: number;
}

export interface MapMarker extends MapPoint {
    id: string;
    /** Étiquette affichée sous le marqueur (nom de l'artisan) */
    label?: string;
}

interface LiveMapProps {
    /** Position de l'artisan (marqueur bleu animé) */
    artisan?: MapPoint | null;
    /** Lieu d'intervention (marqueur rouge) */
    destination?: MapPoint | null;
    /** Marqueur simple (aperçu « ma position ») */
    point?: MapPoint | null;
    /** Marqueurs multiples cliquables (artisans autour de moi) */
    markers?: MapMarker[];
    onMarkerPress?: (id: string) => void;
    style?: StyleProp<ViewStyle>;
    rounded?: boolean;
}

// Cotonou par défaut tant qu'aucune coordonnée n'est connue
const DEFAULT_CENTER: MapPoint = { latitude: 6.3654, longitude: 2.4183 };

/**
 * Carte OpenStreetMap rendue dans une WebView (Leaflet).
 *
 * Pourquoi pas react-native-maps ? Retiré d'Expo Go sur Android depuis le
 * SDK 53 — écran noir garanti. Cette carte fonctionne partout (Expo Go,
 * builds), sans clé API et sans coût, avec les tuiles OpenStreetMap.
 */
export function LiveMap({
    artisan,
    destination,
    point,
    markers,
    onMarkerPress,
    style,
    rounded = false,
}: LiveMapProps) {
    const webRef = useRef<WebView>(null);
    const markersJson = JSON.stringify(markers ?? []);

    const pushState = () => {
        const payload = JSON.stringify({ artisan, destination, point, markers: markers ?? [] });
        webRef.current?.injectJavaScript(`window.updateMap(${payload}); true;`);
    };

    useEffect(pushState, [
        artisan?.latitude,
        artisan?.longitude,
        destination?.latitude,
        destination?.longitude,
        point?.latitude,
        point?.longitude,
        markersJson,
    ]);

    return (
        <View style={[styles.container, rounded && styles.rounded, style]}>
            <WebView
                ref={webRef}
                source={{ html: buildHtml(artisan ?? point ?? destination ?? DEFAULT_CENTER) }}
                onLoadEnd={pushState}
                onMessage={(event) => {
                    try {
                        const data = JSON.parse(event.nativeEvent.data) as {
                            type?: string;
                            id?: string;
                        };
                        if (data.type === 'marker' && data.id) onMarkerPress?.(data.id);
                    } catch {
                        // message inattendu : ignorer
                    }
                }}
                javaScriptEnabled
                domStorageEnabled
                originWhitelist={['*']}
                setSupportMultipleWindows={false}
                overScrollMode="never"
                style={{ backgroundColor: colors.surfaceMuted }}
            />
        </View>
    );
}

function buildHtml(center: MapPoint): string {
    return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0" />
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"
  integrity="sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY=" crossorigin="" />
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"
  integrity="sha256-20nQCchB9co0qIjJZRGuk2/Z9VM+kNiyxNV1lvTlZBo=" crossorigin=""></script>
<style>
  html, body, #map { margin: 0; padding: 0; height: 100%; width: 100%; background: #E2E8F0; }
  .marker-artisan {
    width: 22px; height: 22px; border-radius: 50%;
    background: #1E3A8A; border: 3px solid #fff;
    box-shadow: 0 0 0 6px rgba(30,58,138,0.25), 0 2px 6px rgba(0,0,0,0.3);
  }
  .marker-dest {
    width: 20px; height: 20px; border-radius: 50% 50% 50% 0;
    background: #DC2626; border: 3px solid #fff;
    transform: rotate(-45deg);
    box-shadow: 0 2px 6px rgba(0,0,0,0.3);
  }
  .marker-point {
    width: 20px; height: 20px; border-radius: 50%;
    background: #059669; border: 3px solid #fff;
    box-shadow: 0 0 0 6px rgba(5,150,105,0.25), 0 2px 6px rgba(0,0,0,0.3);
  }
  .marker-pro {
    width: 24px; height: 24px; border-radius: 50%;
    background: #1E3A8A; border: 3px solid #fff;
    box-shadow: 0 2px 8px rgba(0,0,0,0.35);
    display: flex; align-items: center; justify-content: center;
    color: #fff; font: 700 11px sans-serif;
  }
  .marker-label {
    background: #fff; color: #0F172A;
    font: 600 10px sans-serif;
    border-radius: 8px; padding: 1px 6px;
    box-shadow: 0 1px 4px rgba(0,0,0,0.25);
    white-space: nowrap;
  }
  .leaflet-control-attribution { font-size: 8px; }
</style>
</head>
<body>
<div id="map"></div>
<script>
  var map = L.map('map', { zoomControl: false }).setView([${center.latitude}, ${center.longitude}], 14);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; OpenStreetMap'
  }).addTo(map);

  function mk(className) {
    return L.divIcon({ className: '', html: '<div class="' + className + '"></div>', iconSize: [22, 22], iconAnchor: [11, 11] });
  }

  var artisanMarker = null, destMarker = null, pointMarker = null, routeLine = null;
  var proLayer = L.layerGroup().addTo(map);
  var lastMarkersKey = '';

  window.updateMap = function (state) {
    try {
      if (state.artisan) {
        var a = [state.artisan.latitude, state.artisan.longitude];
        if (!artisanMarker) { artisanMarker = L.marker(a, { icon: mk('marker-artisan') }).addTo(map); }
        else { artisanMarker.setLatLng(a); }
      }
      if (state.destination) {
        var d = [state.destination.latitude, state.destination.longitude];
        if (!destMarker) { destMarker = L.marker(d, { icon: mk('marker-dest') }).addTo(map); }
        else { destMarker.setLatLng(d); }
      }
      if (state.point) {
        var p = [state.point.latitude, state.point.longitude];
        if (!pointMarker) { pointMarker = L.marker(p, { icon: mk('marker-point') }).addTo(map); }
        else { pointMarker.setLatLng(p); }
        if (!(state.markers && state.markers.length)) { map.setView(p, 16); }
      }

      // Artisans autour de moi : marqueurs cliquables + étiquette nom
      if (state.markers) {
        var key = JSON.stringify(state.markers.map(function (m) { return m.id; }));
        if (key !== lastMarkersKey) {
          lastMarkersKey = key;
          proLayer.clearLayers();
          var bounds = [];
          if (state.point) { bounds.push([state.point.latitude, state.point.longitude]); }
          state.markers.forEach(function (m) {
            if (m.latitude == null || m.longitude == null) return;
            var pos = [m.latitude, m.longitude];
            bounds.push(pos);
            var marker = L.marker(pos, {
              icon: L.divIcon({
                className: '',
                html: '<div class="marker-pro">' + (m.label ? m.label.charAt(0).toUpperCase() : '•') + '</div>',
                iconSize: [24, 24], iconAnchor: [12, 12]
              })
            }).addTo(proLayer);
            if (m.label) {
              marker.bindTooltip(m.label, {
                permanent: true, direction: 'bottom', offset: [0, 10], className: 'marker-label'
              });
            }
            marker.on('click', function () {
              if (window.ReactNativeWebView) {
                window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'marker', id: m.id }));
              }
            });
          });
          if (bounds.length > 1) { map.fitBounds(bounds, { padding: [50, 50], maxZoom: 15 }); }
          else if (bounds.length === 1) { map.setView(bounds[0], 14); }
        }
      }

      if (state.artisan && state.destination) {
        var pts = [[state.artisan.latitude, state.artisan.longitude], [state.destination.latitude, state.destination.longitude]];
        if (!routeLine) { routeLine = L.polyline(pts, { color: '#1E3A8A', weight: 3, dashArray: '8 6' }).addTo(map); }
        else { routeLine.setLatLngs(pts); }
        map.fitBounds(pts, { padding: [60, 60] });
      } else if (state.artisan) {
        map.setView([state.artisan.latitude, state.artisan.longitude], 16);
      } else if (state.destination && !state.point) {
        map.setView([state.destination.latitude, state.destination.longitude], 15);
      }
    } catch (e) {}
  };
</script>
</body>
</html>`;
}

const styles = StyleSheet.create({
    container: {
        overflow: 'hidden',
        backgroundColor: colors.surfaceMuted,
    },
    rounded: {
        borderRadius: radii.lg,
        borderWidth: 1,
        borderColor: colors.border,
    },
});
