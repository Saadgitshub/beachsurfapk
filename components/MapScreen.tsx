import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  SafeAreaView,
  StatusBar,
  Dimensions,
  Animated,
  Modal,
  Platform,
  Linking,
  StyleSheet,
} from 'react-native';
import MapView, { Marker, Polygon, PROVIDER_GOOGLE } from 'react-native-maps';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import * as Notifications from 'expo-notifications';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSettings } from '../SettingsContext';

type ZoneType = 'safe' | 'sport' | 'danger';
type LanguageType = 'fr' | 'en';
type IoniconName = 'checkmark-circle' | 'fitness' | 'warning' | 'notifications-outline' | 'shield-checkmark' | 'moon' | 'sunny' | 'locate' | 'menu' | 'close' | 'shield-checkmark-outline' | 'call-outline' | 'book-outline' | 'notifications';

type RootStackParamList = {
  Onboarding: undefined;
  Map: undefined;
  BeachSafety: undefined;
  NotificationSettings: undefined;
};
type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

interface UserLocation {
  latitude: number;
  longitude: number;
}

interface LocationCoords {
  latitude: number;
  longitude: number;
}

interface Zone {
  id: number;
  type: ZoneType;
  coordinates: LocationCoords[];
  name?: string;
  color?: string;
  rules?: string[];
}

interface Beach {
  id: number;
  name: string;
  city: string;
  description: string;
  zones: Zone[];
}

interface Alert {
  id: number;
  type: string;
  message: string;
  beachId: number;
}

const { width } = Dimensions.get('window');
const BASE_URL = 'http://192.168.1.6:8080';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export default function MapScreen() {
  const { settings } = useSettings();
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [language, setLanguage] = useState<LanguageType>('fr');
  const [userLocation, setUserLocation] = useState<UserLocation | null>(null);
  const [currentZone, setCurrentZone] = useState<ZoneType>('safe');
  const [showLegend, setShowLegend] = useState<boolean>(false);
  const [showQuickActions, setShowQuickActions] = useState<boolean>(false);
  const [beaches, setBeaches] = useState<Beach[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [showAlertModal, setShowAlertModal] = useState<boolean>(false);
  const [currentAlert, setCurrentAlert] = useState<Alert | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const mapRef = useRef<MapView>(null);
  const legendAnimation = useRef(new Animated.Value(0)).current;
  const quickActionsAnimation = useRef(new Animated.Value(0)).current;
  const navigation = useNavigation<NavigationProp>();
  const previousZoneRef = useRef<ZoneType | null>(null);

  const initialRegion = {
    latitude: 31.500289,
    longitude: -9.76368,
    latitudeDelta: 0.01,
    longitudeDelta: 0.01,
  };

  useEffect(() => {
    const setupNotifications = async () => {
      if (!settings.notifications) return;
      const { status } = await Notifications.requestPermissionsAsync();
      if (status !== 'granted') {
        console.warn('Notification permissions denied');
      }
      if (Platform.OS === 'android' && settings.sounds) {
        await Notifications.setNotificationChannelAsync('default', {
          name: 'default',
          importance: Notifications.AndroidImportance.HIGH,
          vibrationPattern: settings.vibrations ? [0, 250, 250, 250] : undefined,
          lightColor: '#FF231F7C',
        });
      }
    };
    setupNotifications();
  }, [settings.notifications, settings.sounds, settings.vibrations]);

  const mapZoneType = (backendType: string): ZoneType => {
    switch (backendType.toUpperCase()) {
      case 'BATHING':
        return 'safe';
      case 'SPORTS':
        return 'sport';
      default:
        return 'danger';
    }
  };

  const mapAlertTypeToZoneType = (alertType: string): ZoneType => {
    switch (alertType.toUpperCase()) {
      case 'BATHING':
        return 'safe';
      case 'SPORTS':
        return 'sport';
      case 'DANGER':
        return 'danger';
      default:
        return 'danger';
    }
  };

  const parseGeoJSONCoordinates = (geoJsonString: string): LocationCoords[] => {
    try {
      const geoJson = JSON.parse(geoJsonString);
      if (geoJson.type !== 'Polygon' || !Array.isArray(geoJson.coordinates) || geoJson.coordinates.length === 0) {
        console.warn('Invalid GeoJSON format');
        return [];
      }
      const coords = geoJson.coordinates[0];
      if (!Array.isArray(coords) || coords.length < 3) {
        console.warn('Invalid coordinates: must be an array with at least 3 points');
        return [];
      }
      return coords.map(([longitude, latitude]: [number, number]) => ({
        latitude,
        longitude,
      }));
    } catch (e) {
      console.warn('Error parsing GeoJSON:', e);
      return [];
    }
  };

  const validateCoordinates = (coords: LocationCoords[]): boolean => {
    if (!Array.isArray(coords) || coords.length < 3) {
      console.warn('Invalid coordinates: must be an array with at least 3 points');
      return false;
    }
    return coords.every(coord => {
      if (!coord || typeof coord.latitude !== 'number' || typeof coord.longitude !== 'number') {
        console.warn(`Invalid coordinate: ${JSON.stringify(coord)}`);
        return false;
      }
      return true;
    });
  };

  const fetchBeaches = async (retryCount = 3, delay = 2000, timeout = 10000) => {
    const url = `${BASE_URL}/api/beaches`;
    console.log(`Fetching beaches from: ${url}`);
    let attempt = 1;
    while (attempt <= retryCount || retryCount === 0) {
      try {
        setLoading(true);
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeout);
        const response = await fetch(url, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
          },
          signal: controller.signal,
        });
        clearTimeout(timeoutId);
        if (!response.ok) {
          const errorText = await response.text();
          console.error(`Fetch attempt ${attempt} failed. Status: ${response.status}, Body: ${errorText.substring(0, 200)}`);
          throw new Error(`HTTP error! Status: ${response.status}`);
        }
        const data: Beach[] = await response.json();
        console.log('Raw beach data:', JSON.stringify(data, null, 2));
        const mappedData = data
          .filter(beach => beach.name === 'Essaouira Beach')
          .map(beach => ({
            ...beach,
            zones: beach.zones.map(zone => {
              const coordinates = typeof zone.coordinates === 'string'
                ? parseGeoJSONCoordinates(zone.coordinates)
                : Array.isArray(zone.coordinates)
                  ? zone.coordinates.map(coord => ({
                      latitude: Number(coord.latitude),
                      longitude: Number(coord.longitude),
                    }))
                  : [];
              if (!validateCoordinates(coordinates)) {
                console.warn(`Invalid coordinates for zone ${zone.id}, using empty array`);
                return { ...zone, type: mapZoneType(zone.type), coordinates: [] };
              }
              return { ...zone, type: mapZoneType(zone.type), coordinates };
            }),
          }));
        console.log('Mapped beach data:', JSON.stringify(mappedData, null, 2));
        setBeaches(mappedData);
        setError(null);
        setLoading(false);
        return;
      } catch (err: any) {
        console.error(`Fetch attempt ${attempt} error: ${err.message}, Name: ${err.name}, Code: ${err.code || 'N/A'}`);
        if (retryCount !== 0 && attempt === retryCount) {
          console.warn('All fetch attempts failed');
          setError(
            language === 'fr'
              ? `Échec de connexion à ${url} après ${retryCount} tentatives (${err.message}).`
              : `Failed to connect to ${url} after ${retryCount} attempts (${err.message}).`
          );
          setLoading(false);
          return;
        }
        attempt++;
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  };

  const fetchAlerts = async (beachId: number, retryCount = 3, delay = 2000, timeout = 10000) => {
    const url = `${BASE_URL}/api/alerts/beach/${beachId}`;
    console.log(`Fetching alerts from: ${url}`);
    let attempt = 1;
    while (attempt <= retryCount || retryCount === 0) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeout);
        const response = await fetch(url, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
          },
          signal: controller.signal,
        });
        clearTimeout(timeoutId);
        if (!response.ok) {
          const errorText = await response.text();
          console.error(`Fetch attempt ${attempt} failed. Status: ${response.status}, Body: ${errorText.substring(0, 200)}`);
          throw new Error(`HTTP error! Status: ${response.status}`);
        }
        const data: Alert[] = await response.json();
        console.log('Raw alert data:', JSON.stringify(data, null, 2));
        setAlerts(data);
        setLoading(false);
        return;
      } catch (err: any) {
        console.error(`Fetch attempt ${attempt} error: ${err.message}, Name: ${err.name}, Code: ${err.code || 'N/A'}`);
        if (retryCount !== 0 && attempt === retryCount) {
          console.warn('All alert fetch attempts failed');
          setError(
            language === 'fr'
              ? `Échec de récupération des alertes après ${retryCount} tentatives.`
              : `Failed to fetch alerts after ${retryCount} attempts.`
          );
          setLoading(false);
          return;
        }
        attempt++;
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  };

  useEffect(() => {
    fetchBeaches();
    fetchAlerts(1); // Essaouira Beach ID
    getUserLocation();
  }, []);

  useEffect(() => {
    if (showLegend) {
      Animated.spring(legendAnimation, {
        toValue: 1,
        useNativeDriver: true,
        tension: 100,
        friction: 8,
      }).start();
    } else {
      Animated.spring(legendAnimation, {
        toValue: 0,
        useNativeDriver: true,
        tension: 100,
        friction: 8,
      }).start();
    }
  }, [showLegend]);

  useEffect(() => {
    if (showQuickActions) {
      Animated.spring(quickActionsAnimation, {
        toValue: 1,
        useNativeDriver: true,
        tension: 100,
        friction: 8,
      }).start();
    } else {
      Animated.spring(quickActionsAnimation, {
        toValue: 0,
        useNativeDriver: true,
        tension: 100,
        friction: 8,
      }).start();
    }
  }, [showQuickActions]);

  const getUserLocation = async () => {
    try {
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        console.log('Permission to access location was denied');
        setError(
          language === 'fr'
            ? 'Permission d\'accès à la localisation refusée.'
            : 'Permission to access location denied.'
        );
        return;
      }

      let location = await Location.getCurrentPositionAsync({});
      const newLocation = {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
      };
      setUserLocation(newLocation);
      await determineCurrentZone(newLocation);
    } catch (error) {
      console.log('Error getting location:', error);
      setError(
        language === 'fr'
          ? 'Échec de l\'obtention de la localisation.'
          : 'Failed to get user location.'
      );
    }
  };

  const determineCurrentZone = async (coords: LocationCoords): Promise<void> => {
    if (!settings.notifications || !settings.locationAlerts) {
      setCurrentZone('safe');
      return;
    }

    let foundZone: ZoneType = 'danger';
    for (const beach of beaches) {
      for (const zone of beach.zones) {
        if (zone.coordinates.length >= 3 && isPointInPolygon(coords, zone.coordinates)) {
          foundZone = zone.type;
          break;
        }
      }
      if (foundZone !== 'danger') break;
    }

    if (foundZone !== previousZoneRef.current) {
      console.log(`Zone changed from ${previousZoneRef.current} to ${foundZone}`);
      const alert = alerts.find(a => mapAlertTypeToZoneType(a.type) === foundZone);
      if (alert && settings.notifications && settings.locationAlerts) {
        console.log(`Triggering alert for ${foundZone}: ${alert.message}`);
        await Notifications.scheduleNotificationAsync({
          content: {
            title: language === 'fr' ? 'Alerte Plage' : 'Beach Alert',
            body: alert.message,
            data: { zone: foundZone },
            sound: settings.sounds ? 'default' : undefined,
            vibrate: settings.vibrations ? [0, 250, 250, 250] : undefined,
            priority: foundZone === 'danger' ? Notifications.AndroidNotificationPriority.HIGH : Notifications.AndroidNotificationPriority.DEFAULT,
          },
          trigger: { seconds: 1 },
        });
        setCurrentAlert(alert);
        setShowAlertModal(true);
      }
      previousZoneRef.current = foundZone;
    }
    setCurrentZone(foundZone);
  };

  const isPointInPolygon = (point: LocationCoords, polygon: LocationCoords[]): boolean => {
    let inside = false;
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
      const xi = polygon[i].latitude;
      const yi = polygon[i].longitude;
      const xj = polygon[j].latitude;
      const yj = polygon[j].longitude;
      const intersect =
        ((yi > point.longitude) !== (yj > point.longitude)) &&
        point.latitude < ((xj - xi) * (point.longitude - yi)) / (yj - yi) + xi;
      if (intersect) inside = !inside;
    }
    return inside;
  };

  const centerMapOnUser = (): void => {
    if (userLocation && mapRef.current) {
      mapRef.current.animateToRegion(
        {
          ...userLocation,
          latitudeDelta: 0.01,
          longitudeDelta: 0.01,
        },
        1000
      );
    }
  };

  const toggleLegend = () => {
    setShowLegend(!showLegend);
  };

  const toggleQuickActions = () => {
    setShowQuickActions(!showQuickActions);
  };

  const navigateToSafety = () => {
    setShowQuickActions(false);
    navigation.navigate('BeachSafety');
  };

  const navigateToNotifications = () => {
    setShowQuickActions(false);
    setShowLegend(false);
    navigation.navigate('NotificationSettings');
  };

  const getZoneMessage = (): string => {
    const messages: Record<ZoneType, Record<LanguageType, string>> = {
      safe: { fr: 'Zone de baignade sécurisée', en: 'Safe swimming zone' },
      sport: { fr: 'Zone de sports nautiques', en: 'Water sports zone' },
      danger: { fr: 'Zone dangereuse - Évitez', en: 'Dangerous zone - Avoid' },
    };
    return messages[currentZone][language];
  };

  const getZoneIcon = (): IoniconName => {
    const icons: Record<ZoneType, IoniconName> = {
      safe: 'checkmark-circle',
      sport: 'fitness',
      danger: 'warning',
    };
    return icons[currentZone];
  };

  const getZoneColor = (zoneType: ZoneType): string => {
    const colors: Record<ZoneType, string> = {
      safe: '#3b82f6', // Blue for BATHING
      sport: '#ef4444', // Red for SPORTS
      danger: '#ff0000', // Bright red for DANGER
    };
    return colors[zoneType];
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: isDarkMode ? '#111827' : '#ffffff' }]}>
      <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} backgroundColor={isDarkMode ? '#111827' : '#ffffff'} />
      <View style={styles.header}>
        <View style={styles.headerContent}>
          <Ionicons name={getZoneIcon()} size={24} color={getZoneColor(currentZone)} style={styles.headerIcon} />
          <Text style={[styles.headerText, { color: isDarkMode ? '#ffffff' : '#111827' }]} numberOfLines={1}>
            {loading ? (language === 'fr' ? 'Chargement...' : 'Loading...') : error || getZoneMessage()}
          </Text>
        </View>
        <View style={styles.headerButtons}>
          <TouchableOpacity onPress={navigateToNotifications} style={[styles.iconButton, { backgroundColor: isDarkMode ? '#374151' : '#f3f4f6' }]}>
            <Ionicons name="notifications-outline" size={20} color={isDarkMode ? '#ffffff' : '#6b7280'} />
          </TouchableOpacity>
          <TouchableOpacity onPress={navigateToSafety} style={[styles.safetyButton, { backgroundColor: '#ef4444' }]}>
            <Ionicons name="shield-checkmark" size={16} color="#ffffff" />
            <Text style={styles.safetyButtonText}>{language === 'fr' ? 'Sécurité' : 'Safety'}</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setIsDarkMode(!isDarkMode)} style={[styles.iconButton, { backgroundColor: isDarkMode ? '#374151' : '#f3f4f6' }]}>
            <Ionicons name={isDarkMode ? 'sunny' : 'moon'} size={20} color={isDarkMode ? '#fbbf24' : '#6b7280'} />
          </TouchableOpacity>
        </View>
      </View>
      <MapView
        ref={mapRef}
        style={styles.map}
        provider={PROVIDER_GOOGLE}
        initialRegion={initialRegion}
        userInterfaceStyle={isDarkMode ? 'dark' : 'light'}
        showsUserLocation={true}
        showsMyLocationButton={false}
        followsUserLocation={false}
        customMapStyle={isDarkMode ? darkMapStyle : []}
      >
        {beaches.map((beach) =>
          beach.zones.map((zone) =>
            zone.coordinates.length >= 3 ? (
              <Polygon
                key={`${beach.id}-${zone.id}`}
                coordinates={zone.coordinates}
                fillColor={`rgba(${zone.type === 'safe' ? '59, 130, 246' : zone.type === 'sport' ? '239, 68, 68' : '255, 0, 0'}, 0.3)`}
                strokeColor={getZoneColor(zone.type)}
                strokeWidth={2}
              />
            ) : null
          )
        )}
        {userLocation && (
          <Marker coordinate={userLocation} anchor={{ x: 0.5, y: 0.5 }}>
            <View style={styles.marker} />
          </Marker>
        )}
      </MapView>
      <View style={styles.floatingButtons}>
        <TouchableOpacity onPress={centerMapOnUser} style={styles.floatingButton}>
          <Ionicons name="locate" size={24} color="#ffffff" />
        </TouchableOpacity>
        <TouchableOpacity onPress={toggleLegend} style={[styles.floatingButton, { backgroundColor: isDarkMode ? '#1f2937' : '#ffffff', borderWidth: isDarkMode ? 0 : 1, borderColor: '#e5e7eb' }]}>
          <Ionicons name="information-circle" size={24} color={isDarkMode ? '#ffffff' : '#374151'} />
        </TouchableOpacity>
        <TouchableOpacity onPress={toggleQuickActions} style={[styles.floatingButton, { backgroundColor: '#10b981', width: 64, height: 64, borderRadius: 32 }]}>
          <Ionicons name={showQuickActions ? 'close' : 'menu'} size={28} color="#ffffff" />
        </TouchableOpacity>
      </View>
      {showQuickActions && (
        <Animated.View style={[styles.quickActions, { transform: [{ scale: quickActionsAnimation.interpolate({ inputRange: [0, 1], outputRange: [0.8, 1] }) }, { translateY: quickActionsAnimation.interpolate({ inputRange: [0, 1], outputRange: [20, 0] }) }], opacity: quickActionsAnimation }]}>
          <TouchableOpacity onPress={navigateToSafety} style={[styles.quickActionButton, { backgroundColor: '#ef4444' }]}>
            <Ionicons name="shield-checkmark-outline" size={20} color="#ffffff" />
            <Text style={styles.quickActionText}>{language === 'fr' ? 'Infos Sécurité' : 'Safety Info'}</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={navigateToNotifications} style={[styles.quickActionButton, { backgroundColor: '#8b5cf6' }]}>
            <Ionicons name="notifications-outline" size={20} color="#ffffff" />
            <Text style={styles.quickActionText}>{language === 'fr' ? 'Notifications' : 'Notifications'}</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => Linking.openURL('tel:112')} style={[styles.quickActionButton, { backgroundColor: '#f59e0b' }]}>
            <Ionicons name="call-outline" size={20} color="#ffffff" />
            <Text style={styles.quickActionText}>{language === 'fr' ? 'Urgence' : 'Emergency'}</Text>
          </TouchableOpacity>
        </Animated.View>
      )}
      <View style={styles.footer}>
        <View style={styles.footerContent}>
          <Text style={[styles.footerText, { color: isDarkMode ? '#ffffff' : '#111827', opacity: 0.7 }]}>
            {language === 'fr' ? 'Besoin d\'aide?' : 'Need help?'}
          </Text>
          <Text style={[styles.footerText, { color: isDarkMode ? '#ffffff' : '#111827', fontWeight: '600' }]}>
            {language === 'fr' ? 'Consultez nos conseils de sécurité' : 'Check our safety guidelines'}
          </Text>
        </View>
        <TouchableOpacity onPress={navigateToSafety} style={styles.guideButton}>
          <Ionicons name="book-outline" size={16} color="#ffffff" />
          <Text style={styles.guideButtonText}>{language === 'fr' ? 'Guide' : 'Guide'}</Text>
        </TouchableOpacity>
      </View>
      {error && (
        <Modal transparent={true} animationType="fade" visible={!!error}>
          <View style={styles.modalContainer}>
            <View style={[styles.modalContent, { backgroundColor: isDarkMode ? '#1f2937' : '#ffffff' }]}>
              <Ionicons name="warning" size={40} color="#ef4444" style={styles.modalIcon} />
              <Text style={[styles.modalText, { color: isDarkMode ? '#ffffff' : '#111827' }]}>{error}</Text>
              <View style={styles.modalButtons}>
                <TouchableOpacity onPress={() => { setError(null); fetchBeaches(); fetchAlerts(1); }} style={[styles.modalButton, { backgroundColor: '#3b82f6' }]}>
                  <Text style={styles.modalButtonText}>{language === 'fr' ? 'Réessayer' : 'Retry'}</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => setError(null)} style={[styles.modalButton, { backgroundColor: '#6b7280' }]}>
                  <Text style={styles.modalButtonText}>{language === 'fr' ? 'Fermer' : 'Close'}</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      )}
      {showAlertModal && currentAlert && (
        <Modal transparent={true} animationType="fade" visible={showAlertModal}>
          <View style={styles.modalContainer}>
            <View style={[styles.modalContent, { backgroundColor: isDarkMode ? '#1f2937' : '#ffffff' }]}>
              <Ionicons
                name={mapAlertTypeToZoneType(currentAlert.type) === 'danger' ? 'warning' : 'checkmark-circle'}
                size={40}
                color={mapAlertTypeToZoneType(currentAlert.type) === 'danger' ? '#ef4444' : '#3b82f6'}
                style={styles.modalIcon}
              />
              <Text style={[styles.modalTitle, { color: isDarkMode ? '#ffffff' : '#111827' }]}>
                {language === 'fr' ? 'Alerte Plage' : 'Beach Alert'}
              </Text>
              <Text style={[styles.modalText, { color: isDarkMode ? '#ffffff' : '#111827' }]}>{currentAlert.message}</Text>
              <TouchableOpacity onPress={() => { setShowAlertModal(false); setCurrentAlert(null); }} style={[styles.modalButton, { backgroundColor: '#3b82f6' }]}>
                <Text style={styles.modalButtonText}>{language === 'fr' ? 'OK' : 'OK'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      )}
      {showLegend && (
        <View style={styles.legendContainer}>
          <TouchableOpacity style={{ flex: 1 }} onPress={() => setShowLegend(false)} />
          <Animated.View style={[styles.legendContent, { backgroundColor: isDarkMode ? '#1f2937' : '#ffffff', transform: [{ translateY: legendAnimation.interpolate({ inputRange: [0, 1], outputRange: [300, 0] }) }] }]}>
            <View style={[styles.legendHandle, { backgroundColor: isDarkMode ? '#4b5563' : '#d1d5db' }]} />
            <Text style={[styles.legendTitle, { color: isDarkMode ? '#ffffff' : '#111827' }]}>
              {language === 'fr' ? 'Légende des zones' : 'Zone Legend'}
            </Text>
            <View style={styles.legendItems}>
              <View style={styles.legendItem}>
                <View style={[styles.legendColor, { backgroundColor: '#3b82f6' }]} />
                <Text style={[styles.legendText, { color: isDarkMode ? '#ffffff' : '#111827' }]}>
                  {language === 'fr' ? 'Zone de baignade (sécurisée)' : 'Swimming zone (safe)'}
                </Text>
              </View>
              <View style={styles.legendItem}>
                <View style={[styles.legendColor, { backgroundColor: '#ef4444' }]} />
                <Text style={[styles.legendText, { color: isDarkMode ? '#ffffff' : '#111827' }]}>
                  {language === 'fr' ? 'Zone de sports nautiques (kite, windsurf)' : 'Water sports zone (kite, windsurf)'}
                </Text>
              </View>
              <View style={styles.legendItem}>
                <View style={[styles.legendColor, { backgroundColor: '#ff0000' }]} />
                <Text style={[styles.legendText, { color: isDarkMode ? '#ffffff' : '#111827' }]}>
                  {language === 'fr' ? 'Zone dangereuse (éviter)' : 'Dangerous zone (avoid)'}
                </Text>
              </View>
            </View>
            <View style={styles.legendButtons}>
              <TouchableOpacity onPress={navigateToSafety} style={[styles.legendButton, { backgroundColor: '#ef4444' }]}>
                <Ionicons name="shield-checkmark" size={16} color="#ffffff" />
                <Text style={styles.legendButtonText}>{language === 'fr' ? 'Sécurité' : 'Safety'}</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={navigateToNotifications} style={[styles.legendButton, { backgroundColor: '#8b5cf6' }]}>
                <Ionicons name="notifications" size={16} color="#ffffff" />
                <Text style={styles.legendButtonText}>{language === 'fr' ? 'Alertes' : 'Alerts'}</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setShowLegend(false)} style={[styles.legendButton, { backgroundColor: '#3b82f6' }]}>
                <Text style={styles.legendButtonText}>{language === 'fr' ? 'Fermer' : 'Close'}</Text>
              </TouchableOpacity>
            </View>
          </Animated.View>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#1f2937',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerIcon: { marginRight: 8 },
  headerText: {
    fontSize: 16,
    fontWeight: '600',
    flex: 1,
  },
  headerButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  iconButton: {
    padding: 8,
    borderRadius: 20,
  },
  safetyButton: {
    padding: 8,
    borderRadius: 20,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
  },
  safetyButtonText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 4,
  },
  map: { flex: 1 },
  marker: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#3b82f6',
    borderWidth: 3,
    borderColor: '#ffffff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
  floatingButtons: {
    position: 'absolute',
    bottom: 120,
    right: 16,
    gap: 12,
  },
  floatingButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#3b82f6',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  quickActions: {
    position: 'absolute',
    bottom: 200,
    right: 16,
    gap: 12,
  },
  quickActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 6,
    minWidth: 140,
  },
  quickActionText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 8,
  },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#1f2937',
    paddingHorizontal: 20,
    paddingVertical: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 8,
    borderTopWidth: 1,
    borderTopColor: '#374151',
  },
  footerContent: { flex: 1 },
  footerText: { fontSize: 14 },
  guideButton: {
    backgroundColor: '#3b82f6',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 20,
    flexDirection: 'row',
    alignItems: 'center',
  },
  guideButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 6,
  },
  modalContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  modalContent: {
    borderRadius: 12,
    padding: 20,
    width: width * 0.8,
    alignItems: 'center',
  },
  modalIcon: { marginBottom: 10 },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    textAlign: 'center',
  },
  modalText: {
    fontSize: 16,
    textAlign: 'center',
    marginVertical: 10,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 20,
  },
  modalButton: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
  },
  modalButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
  },
  legendContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  legendContent: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 20,
    paddingVertical: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 8,
  },
  legendHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 20,
  },
  legendTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center',
  },
  legendItems: { gap: 16 },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  legendColor: {
    width: 20,
    height: 20,
    borderRadius: 4,
    marginRight: 12,
  },
  legendText: { fontSize: 16 },
  legendButtons: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 24,
  },
  legendButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
  },
  legendButtonText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 4,
  },
});

const darkMapStyle = [
  { elementType: 'geometry', stylers: [{ color: '#212121' }] },
  { elementType: 'labels.icon', stylers: [{ visibility: 'off' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#757575' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#212121' }] },
  { featureType: 'administrative', elementType: 'geometry', stylers: [{ color: '#757575' }] },
  { featureType: 'administrative.country', elementType: 'labels.text.fill', stylers: [{ color: '#9e9e9e' }] },
  { featureType: 'administrative.locality', elementType: 'labels.text.fill', stylers: [{ color: '#bdbdbd' }] },
  { featureType: 'poi', elementType: 'labels.text.fill', stylers: [{ color: '#757575' }] },
  { featureType: 'poi.park', elementType: 'geometry', stylers: [{ color: '#181818' }] },
  { featureType: 'poi.park', elementType: 'labels.text.fill', stylers: [{ color: '#616161' }] },
  { featureType: 'poi.park', elementType: 'labels.text.stroke', stylers: [{ color: '#1b1b1b' }] },
  { featureType: 'road', elementType: 'geometry.fill', stylers: [{ color: '#2c2c2c' }] },
  { featureType: 'road', elementType: 'labels.text.fill', stylers: [{ color: '#8a8a8a' }] },
  { featureType: 'road.arterial', elementType: 'geometry', stylers: [{ color: '#373737' }] },
  { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#3c3c3c' }] },
  { featureType: 'road.highway.controlled_access', elementType: 'geometry', stylers: [{ color: '#4e4e4e' }] },
  { featureType: 'road.local', elementType: 'labels.text.fill', stylers: [{ color: '#616161' }] },
  { featureType: 'transit', elementType: 'labels.text.fill', stylers: [{ color: '#757575' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#000000' }] },
  { featureType: 'water', elementType: 'labels.text.fill', stylers: [{ color: '#3d3d3d' }] },
];