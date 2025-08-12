import React, { useState, useRef, useEffect, Component } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  SafeAreaView,
  StatusBar,
  Dimensions,
  Animated,
  Platform,
  Linking,
  StyleSheet,
  Modal,
  Alert,
  FlatList,
} from 'react-native';
import MapView, { Marker, Polygon, PROVIDER_GOOGLE } from 'react-native-maps';
import MapViewDirections from 'react-native-maps-directions';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSettings } from '../SettingsContext';

type ZoneType = 'safe' | 'sport' | 'danger' | 'unknown';
type LanguageType = 'fr' | 'en';
type IoniconName = 'checkmark-circle' | 'fitness' | 'warning' | 'notifications-outline' | 'shield-checkmark' | 'moon' | 'sunny' | 'locate' | 'menu' | 'close' | 'shield-checkmark-outline' | 'call-outline' | 'book-outline' | 'notifications' | 'information-circle' | 'map-outline';

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
  zoneId?: number;
}

interface User {
  id?: number;
  deviceId: string;
  latitude: number;
  longitude: number;
}

const { width } = Dimensions.get('window');
const BASE_URL = 'http://192.168.1.2:8080';
const GOOGLE_MAPS_API_KEY = 'AIzaSyCt3UNCLRLs9Q9rEhZygVBwrKIpyiZFp48';
const USE_MOCK_LOCATION = false;

interface ErrorBoundaryProps {
  children: React.ReactNode;
}

class ErrorBoundary extends Component<ErrorBoundaryProps, { hasError: boolean; error: Error | null }> {
  state = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  render() {
    if (this.state.hasError) {
      return (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#ffffff' }}>
          <Ionicons name="warning" size={48} color="#ef4444" />
          <Text style={{ fontSize: 16, color: '#1f2937', marginVertical: 10 }}>
            An error occurred: {this.state.error?.message || 'Unknown error'}
          </Text>
          <TouchableOpacity
            style={{ backgroundColor: '#3b82f6', padding: 10, borderRadius: 8 }}
            onPress={() => this.setState({ hasError: false, error: null })}
          >
            <Text style={{ color: '#ffffff', fontWeight: '600' }}>Retry</Text>
          </TouchableOpacity>
        </View>
      );
    }
    return this.props.children;
  }
}

export default function MapScreen() {
  const { settings } = useSettings();
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [language, setLanguage] = useState<LanguageType>('fr');
  const [userLocation, setUserLocation] = useState<UserLocation | null>(null);
  const [currentZone, setCurrentZone] = useState<ZoneType>('unknown');
  const [currentZoneId, setCurrentZoneId] = useState<number | null>(null);
  const [currentBeach, setCurrentBeach] = useState<Beach | null>(null);
  const [currentAlertMessage, setCurrentAlertMessage] = useState<string | null>(null);
  const [showLegend, setShowLegend] = useState<boolean>(false);
  const [showQuickActions, setShowQuickActions] = useState<boolean>(false);
  const [showBeachSelector, setShowBeachSelector] = useState<boolean>(false);
  const [showZoneSelector, setShowZoneSelector] = useState<boolean>(false);
  const [selectedBeach, setSelectedBeach] = useState<Beach | null>(null);
  const [showDirections, setShowDirections] = useState<boolean>(false);
  const [destination, setDestination] = useState<LocationCoords | null>(null);
  const [beaches, setBeaches] = useState<Beach[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [mapError, setMapError] = useState<string | null>(null);
  const [deviceId] = useState<string>(Constants.installationId || `test-device-${Math.random().toString(36).substring(2, 8)}`);
  const mapRef = useRef<MapView>(null);
  const legendAnimation = useRef(new Animated.Value(0)).current;
  const quickActionsAnimation = useRef(new Animated.Value(0)).current;
  const navigation = useNavigation<NavigationProp>();
  const previousZoneRef = useRef<ZoneType | null>(null);

  const initialRegion = {
    latitude: 32.299507,
    longitude: -9.237183,
    latitudeDelta: 0.01,
    longitudeDelta: 0.01,
  };

  useEffect(() => {
    console.log('Settings:', settings);
    console.log('Device ID:', deviceId);
    // Check FCM token
    async function checkFCMToken() {
      try {
        const token = await Notifications.getDevicePushTokenAsync();
        console.log('FCM Token:', token);
      } catch (error) {
        console.error('FCM Token Error:', error);
        setError(language === 'fr' ? 'Échec de récupération du jeton FCM.' : 'Failed to fetch FCM token.');
      }
    }
    checkFCMToken();
    fetchBeaches();
  }, [language, settings.locationAlerts]);

  // Real-time user tracking
  useEffect(() => {
    let subscription;
    const startWatching = async () => {
      if (USE_MOCK_LOCATION) {
        console.log('Using mock location for Safi Bathing Zone');
        const mockLocation = { latitude: 32.299507, longitude: -9.237183 };
        setUserLocation(mockLocation);
        await updateUserLocation(mockLocation);
        await determineCurrentZone(mockLocation);
        return;
      }

      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        console.warn('Permission to access location denied');
        setError(language === 'fr' ? 'Permission d\'accès à la localisation refusée.' : 'Permission to access location denied.');
        await fetchUserLocation();
        return;
      }

      subscription = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.High,
          timeInterval: 5000, // Update every 5 seconds (Android)
          distanceInterval: 10, // Update if moved 10 meters
        },
        (location) => {
          const newLocation = {
            latitude: location.coords.latitude,
            longitude: location.coords.longitude,
          };
          console.log('Updated user location:', newLocation);
          setUserLocation(newLocation);
          updateUserLocation(newLocation);
          determineCurrentZone(newLocation);
        }
      );
    };

    startWatching();

    return () => {
      if (subscription) {
        subscription.remove();
      }
    };
  }, [language, settings.locationAlerts]);

  const mapZoneType = (backendType: string): ZoneType => {
    const type = backendType.toUpperCase();
    console.log('Mapping zone type:', type);
    switch (type) {
      case 'BATHING': return 'safe';
      case 'SPORTS': return 'sport';
      default: return 'danger';
    }
  };

  const mapAlertTypeToZoneType = (alertType: string): ZoneType => {
    const type = alertType.toUpperCase();
    console.log('Mapping alert type:', type);
    switch (type) {
      case 'BATHING': return 'safe';
      case 'SPORTS': return 'sport';
      case 'DANGER': return 'danger';
      default: return 'danger';
    }
  };

  const parseGeoJSONCoordinates = (geoJsonString: string): LocationCoords[] => {
    try {
      const geoJson = JSON.parse(geoJsonString);
      console.log('Parsing GeoJSON:', geoJson);
      if (geoJson.type !== 'Polygon' || !Array.isArray(geoJson.coordinates) || geoJson.coordinates.length === 0) {
        console.warn('Invalid GeoJSON format:', geoJson);
        return [];
      }
      const coords = geoJson.coordinates[0];
      if (!Array.isArray(coords) || coords.length < 3) {
        console.warn('Invalid coordinates:', coords);
        return [];
      }
      const parsedCoords = coords.map(([longitude, latitude]: [number, number], index: number) => {
        if (isNaN(latitude) || isNaN(longitude)) {
          console.error(`Invalid coordinate at index ${index}: [${longitude}, ${latitude}]`);
          return null;
        }
        return { latitude, longitude };
      }).filter((coord): coord is LocationCoords => coord !== null);
      console.log('Parsed coordinates:', parsedCoords);
      return parsedCoords;
    } catch (e) {
      console.warn('Error parsing GeoJSON:', e, 'for string:', geoJsonString);
      return [];
    }
  };

  const fetchBeaches = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${BASE_URL}/api/beaches?language=${language}`, {
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      });
      if (!response.ok) throw new Error(`HTTP error: ${response.status}`);
      const data: Beach[] = await response.json();
      console.log('Fetched beaches:', JSON.stringify(data, null, 2));
      const mappedData = data.map(beach => ({
        ...beach,
        zones: beach.zones.map(zone => ({
          ...zone,
          coordinates: typeof zone.coordinates === 'string'
            ? parseGeoJSONCoordinates(zone.coordinates)
            : Array.isArray(zone.coordinates)
              ? zone.coordinates.map(coord => ({
                  latitude: Number(coord.latitude),
                  longitude: Number(coord.longitude),
                }))
              : [],
          type: mapZoneType(zone.type),
        })),
      }));
      setBeaches(mappedData);
      setError(null);
    } catch (err: any) {
      console.error('Fetch beaches error:', err);
      setError(language === 'fr' ? 'Échec de chargement des plages.' : 'Failed to load beaches.');
    } finally {
      setLoading(false);
    }
  };

  const fetchAlerts = async (beachId: number, retryCount = 0): Promise<Alert[]> => {
    const maxRetries = 3;
    try {
      console.log(`Fetching alerts for beachId ${beachId} (Attempt ${retryCount + 1}/${maxRetries})`);
      const response = await fetch(`${BASE_URL}/api/alerts/beach/${beachId}`, {
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      });
      if (response.status === 204) {
        console.log(`No alerts for beachId ${beachId}`);
        setAlerts([]);
        return [];
      }
      if (!response.ok) throw new Error(`HTTP error: ${response.status}`);
      const data: Alert[] = await response.json();
      console.log('Fetched alerts:', JSON.stringify(data, null, 2));
      setAlerts(data);
      return data;
    } catch (err: any) {
      console.error('Fetch alerts error:', err);
      if (retryCount < maxRetries - 1) {
        await new Promise(resolve => setTimeout(resolve, 1000));
        return fetchAlerts(beachId, retryCount + 1);
      }
      setError(language === 'fr' ? 'Échec de récupération des alertes.' : 'Failed to fetch alerts.');
      return [];
    }
  };

  const updateUserLocation = async (coords: LocationCoords) => {
    try {
      console.log(`Updating user location for deviceId ${deviceId}:`, coords);
      const response = await fetch(`${BASE_URL}/api/users/update-location`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify({
          deviceId,
          latitude: coords.latitude,
          longitude: coords.longitude,
        }),
      });
      if (!response.ok) throw new Error(`HTTP error: ${response.status}`);
      const updatedUser: User = await response.json();
      console.log('Updated user location:', updatedUser);
      setUserLocation({ latitude: updatedUser.latitude, longitude: updatedUser.longitude });
      return updatedUser;
    } catch (err: any) {
      console.error('Update user location error:', err);
      setError(language === 'fr' ? 'Échec de mise à jour de la localisation.' : 'Failed to update location.');
      await fetchUserLocation();
    }
  };

  const fetchUserLocation = async () => {
    try {
      console.log(`Fetching user location for deviceId ${deviceId}`);
      const response = await fetch(`${BASE_URL}/api/users/location/${deviceId}`, {
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      });
      if (!response.ok) {
        if (response.status === 404) {
          console.log('No user location found for deviceId:', deviceId);
          return null;
        }
        throw new Error(`HTTP error: ${response.status}`);
      }
      const user: User = await response.json();
      console.log('Fetched user location:', user);
      if (user.latitude && user.longitude) {
        const coords = { latitude: user.latitude, longitude: user.longitude };
        setUserLocation(coords);
        await determineCurrentZone(coords);
        return coords;
      }
      return null;
    } catch (err: any) {
      console.error('Fetch user location error:', err);
      setError(language === 'fr' ? 'Échec de récupération de la localisation.' : 'Failed to fetch location.');
      return null;
    }
  };

  const centerMapOnUser = async (): Promise<void> => {
    try {
      console.log('Centering map on user location...');
      if (USE_MOCK_LOCATION) {
        console.log('Using mock location for Safi Bathing Zone');
        const mockLocation = { latitude: 32.299507, longitude: -9.237183 };
        setUserLocation(mockLocation);
        await updateUserLocation(mockLocation);
        await determineCurrentZone(mockLocation);
        if (mapRef.current) {
          mapRef.current.animateToRegion(
            {
              ...mockLocation,
              latitudeDelta: 0.01,
              longitudeDelta: 0.01,
            },
            1000
          );
        }
        return;
      }

      const isLocationAvailable = await Location.hasServicesEnabledAsync();
      console.log('Location services enabled:', isLocationAvailable);
      if (!isLocationAvailable) {
        console.warn('Location services are disabled on the device');
        setError(language === 'fr' ? 'Les services de localisation sont désactivés sur votre appareil.' : 'Location services are disabled on your device.');
        const backendLocation = await fetchUserLocation();
        if (backendLocation && mapRef.current) {
          mapRef.current.animateToRegion(
            {
              ...backendLocation,
              latitudeDelta: 0.01,
              longitudeDelta: 0.01,
            },
            1000
          );
        }
        return;
      }

      const permissionStatus = await Location.getForegroundPermissionsAsync();
      console.log('Current permission status:', permissionStatus);
      if (permissionStatus.status !== 'granted') {
        const { status } = await Location.requestForegroundPermissionsAsync();
        console.log('Requested permission status:', status);
        if (status !== 'granted') {
          console.warn('Permission to access location denied');
          setError(language === 'fr' ? 'Permission d\'accès à la localisation refusée. Vérifiez les paramètres de votre appareil.' : 'Permission to access location denied. Check your device settings.');
          const backendLocation = await fetchUserLocation();
          if (backendLocation && mapRef.current) {
            mapRef.current.animateToRegion(
              {
                ...backendLocation,
                latitudeDelta: 0.01,
                longitudeDelta: 0.01,
              },
              1000
            );
          }
          return;
        }
      }

      console.log('Attempting to get current position...');
      let location;
      try {
        location = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.BestForNavigation,
          timeInterval: 1000,
          distanceInterval: 0,
          maximumAge: 10000,
          timeout: 15000,
        });
      } catch (locationError) {
        console.error('Location error details:', locationError);
        throw new Error(`Failed to get current position: ${locationError.message}`);
      }

      if (!location || !location.coords) {
        console.error('No location data received');
        throw new Error('No location data received');
      }

      const newLocation = {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
      };
      console.log('Device location:', newLocation);
      setUserLocation(newLocation);
      await updateUserLocation(newLocation);
      await determineCurrentZone(newLocation);
      if (mapRef.current) {
        mapRef.current.animateToRegion(
          {
            ...newLocation,
            latitudeDelta: 0.01,
            longitudeDelta: 0.01,
          },
          1000
        );
      }
    } catch (error) {
      console.error('Center map error:', error);
      setError(
        language === 'fr'
          ? 'Échec de la localisation. Vérifiez le GPS, les permissions et la connexion réseau.'
          : 'Failed to locate user. Check GPS, permissions, and network connection.'
      );
      const backendLocation = await fetchUserLocation();
      if (backendLocation && mapRef.current) {
        mapRef.current.animateToRegion(
          {
            ...backendLocation,
            latitudeDelta: 0.01,
            longitudeDelta: 0.01,
          },
          1000
        );
      }
    }
  };

  const determineCurrentZone = async (coords: LocationCoords): Promise<void> => {
    console.log('Determining current zone for coords:', coords);
    if (!settings.locationAlerts) {
      console.log('Location alerts disabled. Setting zone to unknown.');
      setCurrentZone('unknown');
      setCurrentZoneId(null);
      setCurrentBeach(null);
      setCurrentAlertMessage(language === 'fr' ? 'Aucune zone de plage à proximité' : 'No beach zones nearby');
      return;
    }

    try {
      console.log('Sending check-location request to:', `${BASE_URL}/api/users/check-location`);
      const response = await fetch(`${BASE_URL}/api/users/check-location`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify({
          deviceId,
          latitude: coords.latitude,
          longitude: coords.longitude,
        }),
      });
      console.log('Response status:', response.status, 'Status text:', response.statusText);
      const responseText = await response.text();
      console.log('Raw response:', responseText);
      if (!response.ok) {
        console.error('Backend check-location failed:', response.status, response.statusText);
        throw new Error(`HTTP error: ${response.status} - ${responseText}`);
      }
      const result = JSON.parse(responseText);
      console.log('Parsed zone check result:', result);

      if (result.inside) {
        const zoneType = mapZoneType(result.zoneType);
        setCurrentZone(zoneType);
        setCurrentZoneId(result.zoneId);
        setCurrentBeach({ id: result.beachId, name: result.beachName, city: result.beachName.includes('Essaouira') ? 'Essaouira' : 'Safi', description: '', zones: [] });
        console.log(`Fetching alerts for beachId: ${result.beachId}`);
        const alerts = await fetchAlerts(result.beachId);
        console.log(`Alerts received:`, alerts);
        const alert = alerts.find(a => {
          const mappedType = mapAlertTypeToZoneType(a.type);
          console.log(`Checking alert: ID=${a.id}, type=${a.type}, mappedType=${mappedType}, zoneId=${a.zoneId}`);
          return mappedType === zoneType && a.zoneId === result.zoneId;
        });
        if (alert) {
          console.log(`Found alert: ${alert.message} (ID: ${alert.id}, ZoneID: ${alert.zoneId})`);
          setCurrentAlertMessage(alert.message);
          if (settings.locationAlerts) {
            Alert.alert(
              language === 'fr' ? 'Alerte Plage' : 'Beach Alert',
              alert.message
            );
          }
        } else {
          console.warn(`No specific alert found for ${zoneType} (zoneId: ${result.zoneId}) in beach ${result.beachName}`);
          const zoneMessage = zoneType === 'safe'
            ? (language === 'fr' ? 'Conditions de baignade sécurisées' : 'Safe swimming conditions')
            : zoneType === 'sport'
            ? (language === 'fr' ? 'Zone de surf. Prudence recommandée.' : 'Surfing zone. Exercise caution.')
            : (language === 'fr' ? 'Conditions de baignade dangereuses. Évitez de nager.' : 'Dangerous swimming conditions. Avoid swimming.');
          setCurrentAlertMessage(zoneMessage);
          if (settings.locationAlerts && previousZoneRef.current !== zoneType) {
            Alert.alert(
              language === 'fr' ? 'Alerte Plage' : 'Beach Alert',
              zoneMessage
            );
          }
        }
        previousZoneRef.current = zoneType;
      } else {
        console.log('User not inside any known zone');
        setCurrentZone('unknown');
        setCurrentZoneId(null);
        setCurrentBeach(null);
        setCurrentAlertMessage(language === 'fr' ? 'Aucune zone de plage à proximité' : 'No beach zones nearby');
        previousZoneRef.current = 'unknown';
      }
    } catch (error: any) {
      console.error('Zone check error details:', error.message);
      setError(language === 'fr' ? `Échec de la vérification de la zone: ${error.message}. Vérifiez la connexion réseau.` : `Failed to check zone: ${error.message}. Check network connection.`);
      setCurrentZone('unknown');
      setCurrentZoneId(null);
      setCurrentBeach(null);
      setCurrentAlertMessage(language === 'fr' ? 'Aucune zone de plage à proximité' : 'No beach zones nearby');
      previousZoneRef.current = 'unknown';
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

  const toggleLanguage = () => {
    setLanguage(language === 'fr' ? 'en' : 'fr');
  };

  const testFetchAlerts = () => {
    console.log('Manually triggering fetchAlerts for Safi Beach (ID: 2)');
    fetchAlerts(2);
  };

  const selectBeach = (beach: Beach) => {
    setSelectedBeach(beach);
    if (beach.zones.length > 1) {
      setShowZoneSelector(true);
    } else if (beach.zones.length === 1) {
      getItineraryToZone(beach.zones[0]);
    } else {
      Alert.alert(
        language === 'fr' ? 'Erreur' : 'Error',
        language === 'fr' ? 'Aucune zone disponible pour cette plage.' : 'No zones available for this beach.'
      );
    }
    setShowBeachSelector(false);
  };

  const getItineraryToZone = (zone: Zone) => {
    if (!zone.coordinates[0]) {
      Alert.alert(
        language === 'fr' ? 'Erreur' : 'Error',
        language === 'fr' ? 'Aucune coordonnée disponible pour cette zone.' : 'No coordinates available for this zone.'
      );
      return;
    }
    if (!userLocation) {
      Alert.alert(
        language === 'fr' ? 'Erreur' : 'Error',
        language === 'fr' ? 'Localisation de l\'utilisateur non disponible.' : 'User location not available.'
      );
      return;
    }

    const zoneCoord = zone.coordinates[0];
    setDestination(zoneCoord);
    setShowDirections(true);
    setShowZoneSelector(false);

    if (mapRef.current) {
      mapRef.current.fitToCoordinates([userLocation, zoneCoord], {
        edgePadding: { top: 50, right: 50, bottom: 50, left: 50 },
        animated: true,
      });
    }
  };

  const getZoneIcon = (): IoniconName => {
    const icons: Record<ZoneType, IoniconName> = {
      safe: 'checkmark-circle',
      sport: 'fitness',
      danger: 'warning',
      unknown: 'information-circle',
    };
    return icons[currentZone];
  };

  const getZoneColor = (zoneType: ZoneType): string => {
    const colors: Record<ZoneType, string> = {
      safe: '#3b82f6',
      sport: '#ef4444',
      danger: '#ff0000',
      unknown: '#6b7280',
    };
    return colors[zoneType];
  };

  useEffect(() => {
    if (currentBeach?.id) {
      fetchAlerts(currentBeach.id);
      const alertInterval = setInterval(() => fetchAlerts(currentBeach.id), 5 * 60 * 1000);
      return () => clearInterval(alertInterval);
    }
  }, [currentBeach?.id]);

  useEffect(() => {
    if (showLegend) {
      Animated.spring(legendAnimation, { toValue: 1, useNativeDriver: true, tension: 100, friction: 8 }).start();
    } else {
      Animated.spring(legendAnimation, { toValue: 0, useNativeDriver: true, tension: 100, friction: 8 }).start();
    }
  }, [showLegend]);

  useEffect(() => {
    if (showQuickActions) {
      Animated.spring(quickActionsAnimation, { toValue: 1, useNativeDriver: true, tension: 100, friction: 8 }).start();
    } else {
      Animated.spring(quickActionsAnimation, { toValue: 0, useNativeDriver: true, tension: 100, friction: 8 }).start();
    }
  }, [showQuickActions]);

  return (
    <ErrorBoundary>
      <SafeAreaView className={`flex-1 ${isDarkMode ? 'bg-gray-900' : 'bg-white'}`}>
        <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} backgroundColor={isDarkMode ? '#111827' : '#ffffff'} />
        <View className={`flex-row items-center justify-between px-4 py-2 ${isDarkMode ? 'bg-gray-800/80' : 'bg-gray-50'} shadow-sm`}>
          <View className="flex-row items-center flex-1">
            <Ionicons name={getZoneIcon()} size={20} color={getZoneColor(currentZone)} className="mr-2" />
            <Text className={`text-sm font-medium ${isDarkMode ? 'text-white' : 'text-gray-900'}`} numberOfLines={1}>
              {loading ? (language === 'fr' ? 'Chargement...' : 'Loading...') : currentAlertMessage || (language === 'fr' ? 'Aucune zone de plage à proximité' : 'No beach zones nearby')}
            </Text>
          </View>
          <View className="flex-row items-center gap-2">
            <TouchableOpacity onPress={navigateToNotifications} className={`p-2 rounded-full ${isDarkMode ? 'bg-gray-700' : 'bg-gray-200'}`}>
              <Ionicons name="notifications-outline" size={18} color={isDarkMode ? '#d1d5db' : '#6b7280'} />
            </TouchableOpacity>
            <TouchableOpacity onPress={navigateToSafety} className="flex-row items-center bg-red-500 px-3 py-1 rounded-full">
              <Ionicons name="shield-checkmark" size={14} color="#ffffff" />
              <Text className="text-white text-xs font-medium ml-1">{language === 'fr' ? 'Sécurité' : 'Safety'}</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setIsDarkMode(!isDarkMode)} className={`p-2 rounded-full ${isDarkMode ? 'bg-gray-700' : 'bg-gray-200'}`}>
              <Ionicons name={isDarkMode ? 'sunny' : 'moon'} size={18} color={isDarkMode ? '#fbbf24' : '#6b7280'} />
            </TouchableOpacity>
            <TouchableOpacity onPress={toggleLanguage} className={`px-3 py-1 rounded-full ${isDarkMode ? 'bg-gray-700' : 'bg-gray-200'}`}>
              <Text className={`text-xs font-medium ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>
                {language === 'fr' ? 'EN' : 'FR'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
        {mapError ? (
          <View style={styles.map}>
            <Ionicons name="warning" size={48} color="#ef4444" style={{ alignSelf: 'center', marginTop: 100 }} />
            <Text style={{ textAlign: 'center', fontSize: 16, color: isDarkMode ? '#ffffff' : '#1f2937', marginVertical: 10 }}>
              {language === 'fr' ? 'Échec du chargement de la carte : ' : 'Failed to load map: '} {mapError}
            </Text>
            <TouchableOpacity
              style={{ backgroundColor: '#3b82f6', padding: 10, borderRadius: 8, alignSelf: 'center' }}
              onPress={() => {
                setMapError(null);
                fetchBeaches();
              }}
            >
              <Text style={{ color: '#ffffff', fontWeight: '600' }}>{language === 'fr' ? 'Réessayer' : 'Retry'}</Text>
            </TouchableOpacity>
          </View>
        ) : (
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
            onMapReady={() => console.log('Map initialized successfully')}
            onError={(error) => {
              console.error('MapView error:', error);
              setMapError(error.message || (language === 'fr' ? 'Erreur inconnue de la carte.' : 'Unknown map error.'));
            }}
          >
            {beaches.map((beach) =>
              beach.zones.map((zone) => {
                console.log(`Rendering polygon for ${beach.name} - ${zone.name || zone.type} (ID: ${zone.id}, Type: ${zone.type}):`, zone.coordinates);
                return zone.coordinates.length >= 3 ? (
                  <Polygon
                    key={`${beach.id}-${zone.id}`}
                    coordinates={zone.coordinates}
                    fillColor={`rgba(${zone.type === 'safe' ? '59, 130, 246' : zone.type === 'sport' ? '239, 68, 68' : '255, 0, 0'}, 0.5)`}
                    strokeColor={getZoneColor(zone.type)}
                    strokeWidth={3}
                  />
                ) : (
                  console.warn(`Skipping polygon for ${beach.name} - ${zone.name || zone.type}: invalid coordinates`) || null
                );
              })
            )}
            {userLocation && (
              <Marker coordinate={userLocation} anchor={{ x: 0.5, y: 0.5 }}>
                <View className="w-5 h-5 rounded-full bg-blue-500 border-2 border-white shadow-md" />
              </Marker>
            )}
            {showDirections && userLocation && destination && (
              <MapViewDirections
                origin={userLocation}
                destination={destination}
                apikey={GOOGLE_MAPS_API_KEY}
                strokeWidth={4}
                strokeColor="blue"
                mode="DRIVING"
                onReady={(result) => {
                  console.log(`Route: ${result.distance} km, ${result.duration} min`);
                }}
                onError={(errorMessage) => {
                  console.error('Directions error:', errorMessage);
                  setError(language === 'fr' ? `Échec de l'itinéraire: ${errorMessage}` : `Directions failed: ${errorMessage}`);
                  setShowDirections(false);
                  setDestination(null);
                }}
              />
            )}
          </MapView>
        )}
        <View className="absolute bottom-28 right-4 gap-2">
          <TouchableOpacity onPress={centerMapOnUser} className="w-12 h-12 rounded-full bg-blue-500 justify-center items-center shadow-lg">
            <Ionicons name="locate" size={22} color="#ffffff" />
          </TouchableOpacity>
          <TouchableOpacity onPress={toggleLegend} className={`w-12 h-12 rounded-full ${isDarkMode ? 'bg-gray-800' : 'bg-white'} border ${isDarkMode ? 'border-gray-700' : 'border-gray-200'} justify-center items-center shadow-lg`}>
            <Ionicons name="information-circle" size={22} color={isDarkMode ? '#ffffff' : '#374151'} />
          </TouchableOpacity>
          <TouchableOpacity onPress={testFetchAlerts} className={`w-12 h-12 rounded-full ${isDarkMode ? 'bg-gray-800' : 'bg-white'} border ${isDarkMode ? 'border-gray-700' : 'border-gray-200'} justify-center items-center shadow-lg`}>
            <Ionicons name="notifications" size={22} color={isDarkMode ? '#ffffff' : '#374151'} />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setShowBeachSelector(true)} className={`w-12 h-12 rounded-full ${isDarkMode ? 'bg-gray-800' : 'bg-white'} border ${isDarkMode ? 'border-gray-700' : 'border-gray-200'} justify-center items-center shadow-lg`}>
            <Ionicons name="map-outline" size={22} color={isDarkMode ? '#ffffff' : '#374151'} />
          </TouchableOpacity>
          <TouchableOpacity onPress={toggleQuickActions} className="w-14 h-14 rounded-full bg-emerald-500 justify-center items-center shadow-lg">
            <Ionicons name={showQuickActions ? 'close' : 'menu'} size={24} color="#ffffff" />
          </TouchableOpacity>
        </View>
        {showQuickActions && (
          <Animated.View
            className="absolute bottom-44 right-4 gap-2"
            style={{
              transform: [
                { scale: quickActionsAnimation.interpolate({ inputRange: [0, 1], outputRange: [0.8, 1] }) },
                { translateY: quickActionsAnimation.interpolate({ inputRange: [0, 1], outputRange: [20, 0] }) },
              ],
              opacity: quickActionsAnimation,
            }}
          >
            <TouchableOpacity onPress={navigateToSafety} className="flex-row items-center bg-red-500 px-4 py-2 rounded-xl shadow-md min-w-32">
              <Ionicons name="shield-checkmark-outline" size={18} color="#ffffff" />
              <Text className="text-white font-medium text-sm ml-2">{language === 'fr' ? 'Infos Sécurité' : 'Safety Info'}</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={navigateToNotifications} className="flex-row items-center bg-purple-500 px-4 py-2 rounded-xl shadow-md min-w-32">
              <Ionicons name="notifications-outline" size={18} color="#ffffff" />
              <Text className="text-white font-medium text-sm ml-2">{language === 'fr' ? 'Notifications' : 'Notifications'}</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => Linking.openURL('tel:112')} className="flex-row items-center bg-amber-500 px-4 py-2 rounded-xl shadow-md min-w-32">
              <Ionicons name="call-outline" size={18} color="#ffffff" />
              <Text className="text-white font-medium text-sm ml-2">{language === 'fr' ? 'Urgence' : 'Emergency'}</Text>
            </TouchableOpacity>
          </Animated.View>
        )}
        <View className={`absolute bottom-0 left-0 right-0 px-4 py-2 ${isDarkMode ? 'bg-gray-800/80' : 'bg-gray-50'} flex-row justify-between items-center shadow-sm`}>
          <View>
            <Text className={`text-xs ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>
              {language === 'fr' ? 'Besoin d\'aide?' : 'Need help?'}
            </Text>
            <Text className={`text-xs font-medium ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
              {language === 'fr' ? 'Consultez nos conseils de sécurité' : 'Check our safety guidelines'}
            </Text>
          </View>
          <TouchableOpacity onPress={navigateToSafety} className="flex-row items-center bg-blue-500 px-3 py-1 rounded-xl">
            <Ionicons name="book-outline" size={14} color="#ffffff" />
            <Text className="text-white font-medium text-xs ml-1">{language === 'fr' ? 'Guide' : 'Guide'}</Text>
          </TouchableOpacity>
        </View>
        {error && (
          <Modal transparent={true} animationType="fade" visible={!!error}>
            <View className="flex-1 justify-center items-center bg-black/50">
              <View className={`rounded-xl p-4 w-4/5 ${isDarkMode ? 'bg-gray-800' : 'bg-white'}`}>
                <Ionicons name="warning" size={32} color="#ef4444" className="mb-2 self-center" />
                <Text className={`text-sm text-center ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>{error}</Text>
                <View className="flex-row gap-2 mt-4">
                  <TouchableOpacity onPress={() => { fetchBeaches(); if (currentBeach?.id) fetchAlerts(currentBeach.id); setError(null); }} className="flex-1 bg-blue-500 py-2 rounded-lg">
                    <Text className="text-white text-xs font-medium text-center">{language === 'fr' ? 'Réessayer Tout' : 'Retry All'}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => { if (currentBeach?.id) fetchAlerts(currentBeach.id); setError(null); }} className="flex-1 bg-emerald-500 py-2 rounded-lg">
                    <Text className="text-white text-xs font-medium text-center">{language === 'fr' ? 'Réessayer Alertes' : 'Retry Alerts'}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => setError(null)} className="flex-1 bg-gray-500 py-2 rounded-lg">
                    <Text className="text-white text-xs font-medium text-center">{language === 'fr' ? 'Fermer' : 'Close'}</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </Modal>
        )}
        {showBeachSelector && (
          <Modal transparent={true} animationType="slide" visible={showBeachSelector}>
            <View className="flex-1 justify-end bg-black/50">
              <View className={`rounded-t-2xl px-4 py-5 ${isDarkMode ? 'bg-gray-800' : 'bg-white'}`}>
                <View className={`w-8 h-1 rounded-full ${isDarkMode ? 'bg-gray-600' : 'bg-gray-300'} self-center mb-4`} />
                <Text className={`text-base font-medium text-center ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                  {language === 'fr' ? 'Sélectionner une plage' : 'Select a Beach'}
                </Text>
                <FlatList
                  data={beaches}
                  keyExtractor={(item) => item.id.toString()}
                  renderItem={({ item }) => (
                    <TouchableOpacity
                      className={`p-3 rounded-lg ${isDarkMode ? 'bg-gray-700' : 'bg-gray-100'} mb-2`}
                      onPress={() => selectBeach(item)}
                    >
                      <Text className={`text-sm ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                        {item.name} ({item.city})
                      </Text>
                    </TouchableOpacity>
                  )}
                  ListEmptyComponent={
                    <Text className={`text-sm text-center ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>
                      {language === 'fr' ? 'Aucune plage disponible' : 'No beaches available'}
                    </Text>
                  }
                />
                <TouchableOpacity
                  onPress={() => setShowBeachSelector(false)}
                  className="bg-blue-500 py-2 rounded-lg mt-4"
                >
                  <Text className="text-white text-sm font-medium text-center">
                    {language === 'fr' ? 'Fermer' : 'Close'}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </Modal>
        )}
        {showZoneSelector && selectedBeach && (
          <Modal transparent={true} animationType="slide" visible={showZoneSelector}>
            <View className="flex-1 justify-end bg-black/50">
              <View className={`rounded-t-2xl px-4 py-5 ${isDarkMode ? 'bg-gray-800' : 'bg-white'}`}>
                <View className={`w-8 h-1 rounded-full ${isDarkMode ? 'bg-gray-600' : 'bg-gray-300'} self-center mb-4`} />
                <Text className={`text-base font-medium text-center ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                  {language === 'fr' ? 'Sélectionner une zone pour ' : 'Select a Zone for '} {selectedBeach.name}
                </Text>
                <FlatList
                  data={selectedBeach.zones}
                  keyExtractor={(item) => item.id.toString()}
                  renderItem={({ item }) => (
                    <TouchableOpacity
                      className={`p-3 rounded-lg ${isDarkMode ? 'bg-gray-700' : 'bg-gray-100'} mb-2`}
                      onPress={() => getItineraryToZone(item)}
                    >
                      <Text className={`text-sm ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                        {item.name || item.type} ({item.type === 'safe' ? (language === 'fr' ? 'Baignade' : 'Swimming') : item.type === 'sport' ? (language === 'fr' ? 'Surf' : 'Surfing') : (language === 'fr' ? 'Danger' : 'Danger')})
                      </Text>
                    </TouchableOpacity>
                  )}
                  ListEmptyComponent={
                    <Text className={`text-sm text-center ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>
                      {language === 'fr' ? 'Aucune zone disponible' : 'No zones available'}
                    </Text>
                  }
                />
                <TouchableOpacity
                  onPress={() => setShowZoneSelector(false)}
                  className="bg-blue-500 py-2 rounded-lg mt-4"
                >
                  <Text className="text-white text-sm font-medium text-center">
                    {language === 'fr' ? 'Fermer' : 'Close'}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </Modal>
        )}
        {showLegend && (
          <View className="absolute bottom-0 left-0 right-0 bg-black/50 justify-end">
            <Animated.View
              className={`rounded-t-2xl px-4 py-5 ${isDarkMode ? 'bg-gray-800' : 'bg-white'}`}
              style={{ transform: [{ translateY: legendAnimation.interpolate({ inputRange: [0, 1], outputRange: [300, 0] }) }] }}
            >
              <View className={`w-8 h-1 rounded-full ${isDarkMode ? 'bg-gray-600' : 'bg-gray-300'} self-center mb-4`} />
              <Text className={`text-base font-medium text-center ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                {language === 'fr' ? 'Légende des zones' : 'Zone Legend'}
              </Text>
              <View className="gap-3 mt-4">
                <View className="flex-row items-center">
                  <View className="w-4 h-4 rounded bg-blue-500 mr-2" />
                  <Text className={`text-sm ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                    {language === 'fr' ? 'Zone de baignade (sécurisée)' : 'Swimming zone (safe)'}
                  </Text>
                </View>
                <View className="flex-row items-center">
                  <View className="w-4 h-4 rounded bg-red-500 mr-2" />
                  <Text className={`text-sm ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                    {language === 'fr' ? 'Zone de sports nautiques (kite, windsurf)' : 'Water sports zone (kite, windsurf)'}
                  </Text>
                </View>
                <View className="flex-row items-center">
                  <View className="w-4 h-4 rounded bg-red-600 mr-2" />
                  <Text className={`text-sm ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                    {language === 'fr' ? 'Zone dangereuse (éviter)' : 'Dangerous zone (avoid)'}
                  </Text>
                </View>
              </View>
              <View className="flex-row gap-2 mt-5">
                <TouchableOpacity onPress={navigateToSafety} className="flex-1 bg-red-500 py-2 rounded-lg flex-row justify-center items-center">
                  <Ionicons name="shield-checkmark" size={14} color="#ffffff" />
                  <Text className="text-white text-xs font-medium ml-1">{language === 'fr' ? 'Sécurité' : 'Safety'}</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={navigateToNotifications} className="flex-1 bg-purple-500 py-2 rounded-lg flex-row justify-center items-center">
                  <Ionicons name="notifications" size={14} color="#ffffff" />
                  <Text className="text-white text-xs font-medium ml-1">{language === 'fr' ? 'Alertes' : 'Alerts'}</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => setShowLegend(false)} className="flex-1 bg-blue-500 py-2 rounded-lg">
                  <Text className="text-white text-xs font-medium text-center">{language === 'fr' ? 'Fermer' : 'Close'}</Text>
                </TouchableOpacity>
              </View>
            </Animated.View>
          </View>
        )}
      </SafeAreaView>
    </ErrorBoundary>
  );
}

const styles = StyleSheet.create({
  map: { flex: 1 },
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