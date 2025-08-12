import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  StatusBar,
  Dimensions,
  Linking,
  Alert,
  Modal,
  Platform
} from 'react-native';
import MapView, { Polygon, Marker } from 'react-native-maps';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { BASE_URL } from '../Constants';

type RootStackParamList = {
  Onboarding: undefined;
  Map: undefined;
  BeachSafety: undefined;
  EmergencyContacts: undefined;
};
type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

interface SafetyRule {
  id: number;
  icon: string;
  title: string;
  description: string;
}

interface LifeguardStation {
  id: number;
  name: string;
  hours: string;
  location: string;
  status: string;
}

interface Facility {
  id: number;
  icon: string;
  type: string;
  name: string;
  count: number;
  locations: string;
}

interface EmergencyContact {
  id: number;
  emoji: string;
  name: string;
  number: string;
  color: string;
}

interface Alert {
  id: number;
  type: string;
  message: string;
  beachId: number;
  language: string;
  coordinates?: { latitude: number; longitude: number }[];
}

interface SafetyInfo {
  id: number;
  title: string;
  category: string;
  content: string;
  status: string;
  lastUpdated: string;
  updatedBy: string;
  views: number;
  beach: {
    id: number;
    name: string;
    city: string;
    description: string;
    status: string;
    activeUsers: number;
    alerts: number;
    lastUpdated: string;
  };
}

interface DailyTip {
  id: number | null;
  title: string;
  content: string; // JSON string: {"lang": string, "description": string, "icon": string}
  category: string;
  status: string;
  date: string;
  updatedBy: string;
  views: number;
  likes: number;
}

interface TipContent {
  description: string;
  icon: string;
  lang: string;
}

const { width } = Dimensions.get('window');

// Static Morocco-specific emergency contacts
const MOROCCO_EMERGENCY_CONTACTS: EmergencyContact[] = [
  { id: 1, emoji: '🚓', name: 'Police', number: '19', color: '#3b82f6' },
  { id: 2, emoji: '🚨', name: 'SAMU', number: '15', color: '#ef4444' },
  { id: 3, emoji: '🚒', name: 'Pompiers', number: '15', color: '#f97316' },
  { id: 4, emoji: '🌊', name: 'Sauvetage Mer', number: '0537-71-17-17', color: '#10b981' }
];

// Fallback emoji mapping for unsupported platforms
const emojiFallbacks: { [key: string]: string } = {
  '🚨': Platform.OS === 'android' ? '⚠️' : '🚨',
  '🚓': Platform.OS === 'android' ? '🚔' : '🚓',
  '🚒': Platform.OS === 'android' ? '🔥' : '🚒',
  '🌊': Platform.OS === 'android' ? '💧' : '🌊'
};

// Predefined polygon data (empty for Essaouira to remove alerts)
const BEACH_POLYGONS: { [key: number]: Alert[] } = {
  1: [], // No alerts for Essaouira
  2: [], // No alerts for Essaouira kitesurf zone
};

// Fallback tips when API returns no data
const FALLBACK_TIPS: DailyTip[] = [
  {
    id: null,
    title: 'Stay Hydrated',
    content: JSON.stringify({ lang: 'en', description: 'Drink plenty of water to stay hydrated at the beach.', icon: 'water-outline' }),
    category: 'Safety',
    status: 'ACTIVE',
    date: '2025-08-05',
    updatedBy: 'System',
    views: 0,
    likes: 0
  },
  {
    id: null,
    title: 'Rester Hydraté',
    content: JSON.stringify({ lang: 'fr', description: 'Buvez beaucoup d\'eau pour rester hydraté à la plage.', icon: 'water-outline' }),
    category: 'Safety',
    status: 'ACTIVE',
    date: '2025-08-05',
    updatedBy: 'System',
    views: 0,
    likes: 0
  }
];

function EmergencyModal({ visible, onClose, isDarkMode = false, language = 'fr', emergencyContacts = MOROCCO_EMERGENCY_CONTACTS }: {
  visible: boolean;
  onClose: () => void;
  isDarkMode?: boolean;
  language?: 'fr' | 'en';
  emergencyContacts?: EmergencyContact[];
}) {
  const makeCall = (number: string) => {
    Alert.alert(
      language === 'fr' ? 'Appeler le ' + number : 'Call ' + number,
      language === 'fr' 
        ? `Voulez-vous composer le ${number} ?`
        : `Do you want to dial ${number}?`,
      [
        {
          text: language === 'fr' ? 'Annuler' : 'Cancel',
          style: 'cancel'
        },
        {
          text: language === 'fr' ? 'Appeler' : 'Call',
          style: 'default',
          onPress: () => {
            onClose();
            Linking.openURL(`tel:${number}`);
          }
        }
      ]
    );
  };

  const bgColor = isDarkMode ? 'bg-gray-900' : 'bg-white';
  const textColor = isDarkMode ? 'text-white' : 'text-gray-900';

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <View className="flex-1 justify-end">
        <TouchableOpacity 
          className="flex-1 bg-black bg-opacity-50" 
          onPress={onClose}
        />
        
        <View className={`${bgColor} rounded-t-3xl p-6 max-h-96`}>
          <View className="flex-row justify-between items-center mb-6">
            <Text className={`text-xl font-bold ${textColor}`}>
              🚨 {language === 'fr' ? 'Urgences' : 'Emergency'}
            </Text>
            <TouchableOpacity
              onPress={onClose}
              className="p-2"
            >
              <Ionicons name="close" size={24} color={isDarkMode ? '#d1d5db' : '#6b7280'} />
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false}>
            {emergencyContacts.map((contact) => (
              <TouchableOpacity
                key={contact.id}
                onPress={() => makeCall(contact.number)}
                className="flex-row items-center justify-between py-4 px-4 mb-2 rounded-2xl"
                style={{ backgroundColor: contact.color + '10' }}
              >
                <View className="flex-row items-center flex-1">
                  <Text className="text-2xl mr-4">{emojiFallbacks[contact.emoji] || contact.emoji}</Text>
                  <View className="flex-1">
                    <Text className={`font-bold ${textColor}`}>
                      {language === 'fr' ? contact.name : contact.name.replace('Pompiers', 'Fire Department').replace('Sauvetage Mer', 'Sea Rescue')}
                    </Text>
                  </View>
                </View>
                
                <View 
                  className="w-12 h-12 rounded-full items-center justify-center"
                  style={{ backgroundColor: contact.color }}
                >
                  <Text className="text-white font-bold text-xs">
                    {contact.number}
                  </Text>
                </View>
              </TouchableOpacity>
            ))}
          </ScrollView>

          <View className="mt-4 pt-4 border-t border-gray-200">
            <Text className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-600'} text-center`}>
              {language === 'fr' 
                ? 'En cas d\'urgence, restez calme et donnez votre position'
                : 'In emergency, stay calm and provide your location'
              }
            </Text>
          </View>
        </View>
      </View>
    </Modal>
  );
}

export default function BeachSafetyScreen() {
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [language, setLanguage] = useState<'fr' | 'en'>('fr');
  const [expandedSection, setExpandedSection] = useState<string | null>(null);
  const [showEmergencyModal, setShowEmergencyModal] = useState(false);
  const [safetyRules, setSafetyRules] = useState<{ [beachId: number]: SafetyRule[] }>({});
  const [lifeguardStations, setLifeguardStations] = useState<{ [beachId: number]: LifeguardStation[] }>({});
  const [facilities, setFacilities] = useState<{ [beachId: number]: Facility[] }>({});
  const [alerts, setAlerts] = useState<{ [beachId: number]: Alert[] }>({});
  const [beachNames, setBeachNames] = useState<{ [beachId: number]: string }>({});
  const [dailyTip, setDailyTip] = useState<DailyTip | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const navigation = useNavigation<NavigationProp>();
  const beachIds = [1]; // Only Essaouira
  const fetchAttempted = useRef(false);
  const initialized = useRef(false);

  const parseTipContent = (content: string): TipContent => {
    try {
      const parsed = JSON.parse(content);
      return {
        description: parsed.description || 'No description available',
        icon: parsed.icon || 'lightbulb-outline',
        lang: parsed.lang || 'en'
      };
    } catch {
      return { description: 'Invalid tip content', icon: 'warning-outline', lang: 'en' };
    }
  };

  const fetchSafetyInfo = async (beachId: number, retryCount = 3, delay = 2000, timeout = 10000) => {
    const url = `${BASE_URL}/api/safety-info/beach/${beachId}`;
    console.log(`Fetching safety info from: ${url}`);
    let attempt = 1;
    while (attempt <= retryCount) {
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
          console.error(`Fetch attempt ${attempt} failed for beachId ${beachId}. Status: ${response.status}, Body: ${errorText.substring(0, 200)}`);
          throw new Error(`HTTP error! Status: ${response.status}`);
        }

        const data: SafetyInfo[] = await response.json();
        console.log(`Parsed safety info data for beachId ${beachId}:`, JSON.stringify(data, null, 2));

        let filteredData = data.filter(item => {
          const isActive = item.status && item.status.toUpperCase() === 'ACTIVE';
          if (!isActive) {
            console.log(`Skipping ID ${item.id}: status is ${item.status}`);
            return false;
          }
          try {
            const content = JSON.parse(item.content);
            const contentLang = content.lang || (item.title.includes('é') || item.title.toLowerCase().includes('sauvetage') ? 'fr' : 'en');
            return contentLang === language || !contentLang;
          } catch (e) {
            console.warn(`Using fallback for ID ${item.id} due to invalid content: ${item.content}`);
            return item.title.includes('é') || item.title.toLowerCase().includes('sauvetage') ? language === 'fr' : language === 'en';
          }
        });

        if (filteredData.length === 0) {
          console.warn(`No records found for beachId ${beachId}, using all active records`);
          filteredData = data.filter(item => item.status && item.status.toUpperCase() === 'ACTIVE');
        }

        const beachName = filteredData.length > 0 ? filteredData[0].beach.name : `Beach ${beachId}`;

        const rules: SafetyRule[] = filteredData
          .filter(item => !['LIFEGUARD', 'FACILITY'].includes(item.category))
          .map(item => {
            try {
              console.log(`Parsing ${item.category} content for ID ${item.id}:`, item.content);
              return { id: item.id, title: item.title, ...JSON.parse(item.content) };
            } catch (e: any) {
              console.warn(`Using fallback for ${item.category} ID ${item.id}: ${item.content}`);
              return { id: item.id, title: item.title, icon: 'warning-outline', description: typeof item.content === 'string' ? item.content : 'Invalid content format' };
            }
          })
          .filter(item => item !== null) as SafetyRule[];

        const lifeguards: LifeguardStation[] = filteredData
          .filter(item => item.category === 'LIFEGUARD')
          .map(item => {
            try {
              console.log(`Parsing LIFEGUARD content for ID ${item.id}:`, item.content);
              return { id: item.id, name: item.title, ...JSON.parse(item.content) };
            } catch (e: any) {
              console.warn(`Using fallback for LIFEGUARD ID ${item.id}: ${item.content}`);
              return null;
            }
          })
          .filter(item => item !== null) as LifeguardStation[];

        const facilitiesData: Facility[] = filteredData
          .filter(item => item.category === 'FACILITY')
          .map(item => {
            try {
              console.log(`Parsing FACILITY content for ID ${item.id}:`, item.content);
              return { id: item.id, name: item.title, ...JSON.parse(item.content) };
            } catch (e: any) {
              console.warn(`Using fallback for FACILITY ID ${item.id}: ${item.content}`);
              return null;
            }
          })
          .filter(item => item !== null) as Facility[];

        setSafetyRules(prev => ({ ...prev, [beachId]: rules }));
        setLifeguardStations(prev => ({ ...prev, [beachId]: lifeguards }));
        setFacilities(prev => ({ ...prev, [beachId]: facilitiesData }));
        setBeachNames(prev => ({ ...prev, [beachId]: beachName }));
        return;
      } catch (err: any) {
        console.error(`Fetch attempt ${attempt} error for beachId ${beachId}: ${err.message}, Name: ${err.name}, Code: ${err.code || 'N/A'}`);
        if (attempt === retryCount) {
          console.warn(`All fetch attempts failed for beachId ${beachId}`);
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
    while (attempt <= retryCount) {
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
          console.error(`Fetch attempt ${attempt} failed for beachId ${beachId}. Status: ${response.status}, Body: ${errorText.substring(0, 200)}`);
          throw new Error(`HTTP error! Status: ${response.status}`);
        }

        const data: Alert[] = await response.json();
        console.log(`Raw alert data for beachId ${beachId}:`, JSON.stringify(data, null, 2));
        const filteredAlerts = data.length > 0 
          ? data.filter(alert => !alert.language || alert.language === language || alert.language === 'en')
          : BEACH_POLYGONS[beachId] || [];
        setAlerts(prev => ({ ...prev, [beachId]: filteredAlerts }));
        return;
      } catch (err: any) {
        console.error(`Fetch attempt ${attempt} error for beachId ${beachId}: ${err.message}`);
        if (attempt === retryCount) {
          console.warn(`All fetch attempts failed for beachId ${beachId}, using fallback polygons`);
          setAlerts(prev => ({ ...prev, [beachId]: BEACH_POLYGONS[beachId] || [] }));
          setLoading(false);
          return;
        }
        attempt++;
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  };

  const fetchDailyTip = async (retryCount = 3, delay = 2000, timeout = 10000) => {
    if (fetchAttempted.current) return;
    fetchAttempted.current = true;

    const url = `${BASE_URL}/api/tips/latest`;
    console.log(`Fetching latest tip from: ${url}`);
    let attempt = 1;

    while (attempt <= retryCount) {
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

        console.log(`Fetch attempt ${attempt} status: ${response.status}`);
        if (response.status === 204) {
          console.log(`No tip found, using fallback tip`);
          const fallbackTip = FALLBACK_TIPS.find(tip => parseTipContent(tip.content).lang === language) || FALLBACK_TIPS[0];
          setDailyTip(fallbackTip);
          setError(null);
          return;
        }

        if (!response.ok) {
          const errorText = await response.text();
          console.error(`Fetch attempt ${attempt} failed. Status: ${response.status}, Body: ${errorText.substring(0, 200)}`);
          throw new Error(`HTTP error! Status: ${response.status}`);
        }

        const data: DailyTip = await response.json();
        console.log(`Raw daily tip data:`, JSON.stringify(data, null, 2));
        try {
          const content = JSON.parse(data.content);
          if (!content.description || !content.icon) {
            throw new Error('Invalid content format: missing required fields');
          }
          const parsedTip = {
            ...data,
            language: content.lang || 'en'
          };
          if (parsedTip.status.toUpperCase() !== 'ACTIVE') {
            console.warn(`Tip ID ${parsedTip.id} is not ACTIVE, using fallback tip`);
            const fallbackTip = FALLBACK_TIPS.find(tip => parseTipContent(tip.content).lang === language) || FALLBACK_TIPS[0];
            setDailyTip(fallbackTip);
          } else {
            setDailyTip(parsedTip);
          }
          setError(null);
        } catch (e: any) {
          console.warn(`Invalid content for daily tip ID ${data.id}: ${data.content}`);
          const fallbackTip = FALLBACK_TIPS.find(tip => parseTipContent(tip.content).lang === language) || FALLBACK_TIPS[0];
          setDailyTip(fallbackTip);
          setError(language === 'fr' ? 'Format de conseil invalide, affichage du conseil par défaut.' : 'Invalid tip format, displaying fallback tip.');
        }
        return;
      } catch (err: any) {
        console.error(`Fetch attempt ${attempt} error for daily tip: ${err.message}, Name: ${err.name}, Code: ${err.code || 'N/A'}`);
        if (attempt === retryCount) {
          console.warn(`All fetch attempts failed for daily tip, using fallback tip`);
          const fallbackTip = FALLBACK_TIPS.find(tip => parseTipContent(tip.content).lang === language) || FALLBACK_TIPS[0];
          setDailyTip(fallbackTip);
          setError(language === 'fr' ? 'Échec de la récupération du conseil, affichage du conseil par défaut.' : 'Failed to fetch tip, displaying fallback tip.');
          return;
        }
        attempt++;
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  };

  const initializeBeaches = async () => {
    if (initialized.current) return;
    initialized.current = true;

    try {
      setLoading(true);
      await Promise.all([
        ...beachIds.map(beachId =>
          Promise.all([fetchSafetyInfo(beachId), fetchAlerts(beachId)])
        ),
        fetchDailyTip()
      ]);
      setLoading(false);
    } catch (err: any) {
      console.error('Initialization error:', err.message);
      setError(language === 'fr' ? 'Erreur lors de l\'initialisation, affichage des données par défaut.' : 'Error during initialization, displaying fallback data.');
      const fallbackTip = FALLBACK_TIPS.find(tip => parseTipContent(tip.content).lang === language) || FALLBACK_TIPS[0];
      setDailyTip(fallbackTip);
      setLoading(false);
    }
  };

  useEffect(() => {
    console.log('useEffect triggered with language:', language);
    initializeBeaches();
  }, [language]);

  const toggleTheme = () => {
    setIsDarkMode(!isDarkMode);
  };

  const toggleLanguage = () => {
    setLanguage(language === 'fr' ? 'en' : 'fr');
    fetchAttempted.current = false; // Reset to allow refetching tips in new language
  };

  const toggleSection = (sectionId: string) => {
    setExpandedSection(expandedSection === sectionId ? null : sectionId);
  };

  const getAlertIcon = (type: string): string => {
    switch (type.toUpperCase()) {
      case 'BATHING':
      case 'SAFE':
        return 'checkmark-circle';
      case 'SPORTS':
      case 'SPORT':
        return 'fitness';
      case 'DANGER':
        return 'warning';
      default:
        return 'warning';
    }
  };

  const getAlertColor = (type: string): string => {
    switch (type.toUpperCase()) {
      case 'BATHING':
      case 'SAFE':
        return '#3b82f6';
      case 'SPORTS':
      case 'SPORT':
        return '#ef4444';
      case 'DANGER':
        return '#ff0000';
      default:
        return '#ff0000';
    }
  };

  const getCategoryIcon = (category: string): string => {
    switch (category) {
      case 'Safety':
        return 'shield-checkmark-outline';
      case 'Swimming':
        return 'water-outline';
      case 'Environment':
        return 'leaf-outline';
      default:
        return 'information-circle-outline';
    }
  };

  const getCategoryColor = (category: string): string => {
    switch (category) {
      case 'Safety':
        return '#ef4444';
      case 'Swimming':
        return '#3b82f6';
      case 'Environment':
        return '#10b981';
      default:
        return '#6b7280';
    }
  };

  const getRegionForBeach = (beachId: number) => {
    // Return null for Essaouira to use placeholder image
    if (beachId === 1) return null;
    const polygons = BEACH_POLYGONS[beachId] || [];
    if (polygons.length === 0 || !polygons[0].coordinates) return null;

    const coordinates = polygons[0].coordinates;
    const latitudes = coordinates.map(c => c.latitude);
    const longitudes = coordinates.map(c => c.longitude);
    const minLat = Math.min(...latitudes);
    const maxLat = Math.max(...latitudes);
    const minLon = Math.min(...longitudes);
    const maxLon = Math.max(...longitudes);
    const latitude = (minLat + maxLat) / 2;
    const longitude = (minLon + maxLon) / 2;
    const latitudeDelta = (maxLat - minLat) * 1.2;
    const longitudeDelta = (maxLon - minLon) * 1.2;

    return {
      latitude,
      longitude,
      latitudeDelta: latitudeDelta || 0.01,
      longitudeDelta: longitudeDelta || 0.01
    };
  };

  const bgColor = isDarkMode ? 'bg-gray-900' : 'bg-white';
  const textColor = isDarkMode ? 'text-white' : 'text-gray-900';
  const secondaryTextColor = isDarkMode ? 'text-gray-300' : 'text-gray-600';
  const cardBgColor = isDarkMode ? 'bg-gray-800' : 'bg-gray-50';
  const iconColor = isDarkMode ? '#60a5fa' : '#3b82f6';

  return (
    <SafeAreaView className={`flex-1 ${bgColor}`}>
      <StatusBar
        barStyle={isDarkMode ? 'light-content' : 'dark-content'}
        backgroundColor={isDarkMode ? '#111827' : '#ffffff'}
      />
      
      <View className="flex-row justify-between items-center px-6 py-4">
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          className="p-2 rounded-full"
          style={{ backgroundColor: isDarkMode ? '#374151' : '#f3f4f6' }}
        >
          <Ionicons
            name="arrow-back"
            size={20}
            color={isDarkMode ? '#d1d5db' : '#6b7280'}
          />
        </TouchableOpacity>

        <Text className={`text-lg font-bold ${textColor}`}>
          {language === 'fr' ? 'Infos Sécurité' : 'Safety Info'}
        </Text>
        
        <View className="flex-row">
          <TouchableOpacity
            onPress={toggleTheme}
            className="p-2 rounded-full mr-2"
            style={{ backgroundColor: isDarkMode ? '#374151' : '#f3f4f6' }}
          >
            <Ionicons
              name={isDarkMode ? 'sunny' : 'moon'}
              size={20}
              color={isDarkMode ? '#fbbf24' : '#6b7280'}
            />
          </TouchableOpacity>
          
          <TouchableOpacity
            onPress={toggleLanguage}
            className="px-3 py-1 rounded-full"
            style={{ backgroundColor: isDarkMode ? '#374151' : '#f3f4f6' }}
          >
            <Text className={`font-medium ${secondaryTextColor}`}>
              {language === 'fr' ? 'EN' : 'FR'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {loading ? (
        <View className="flex-1 justify-center items-center">
          <Text className={`text-lg ${textColor}`}>
            {language === 'fr' ? 'Chargement...' : 'Loading...'}
          </Text>
        </View>
      ) : error ? (
        <View className="flex-1 justify-center items-center">
          <Ionicons name="warning" size={40} color="#ef4444" />
          <Text className={`text-lg ${textColor} mt-4 text-center`}>{error}</Text>
          <TouchableOpacity
            onPress={initializeBeaches}
            className="mt-4 bg-blue-500 px-4 py-2 rounded-lg"
          >
            <Text className="text-white font-bold">
              {language === 'fr' ? 'Réessayer' : 'Retry'}
            </Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
          {dailyTip && dailyTip.status.toUpperCase() === 'ACTIVE' ? (
            <View className="px-6 mb-6">
              <View className={`${cardBgColor} rounded-3xl p-6`}>
                <View className="flex-row items-center mb-4">
                  <View
                    className="w-10 h-10 rounded-full items-center justify-center mr-3"
                    style={{ backgroundColor: getCategoryColor(dailyTip.category) + '20' }}
                  >
                    <Ionicons name={getCategoryIcon(dailyTip.category)} size={20} color={getCategoryColor(dailyTip.category)} />
                  </View>
                  <Text className={`text-lg font-bold ${textColor}`}>
                    💡 {language === 'fr' ? 'Conseil du jour' : 'Daily Tip'}
                  </Text>
                </View>
                <View key={dailyTip.id || 0}>
                  <TouchableOpacity
                    onPress={() => toggleSection(`tip-global`)}
                    className="flex-row items-center justify-between py-3"
                  >
                    <View className="flex-row items-center flex-1">
                      <Ionicons name={parseTipContent(dailyTip.content).icon} size={20} color={getCategoryColor(dailyTip.category)} />
                      <View className="flex-1">
                        <Text className={`font-medium ${textColor}`}>{dailyTip.title}</Text>
                        <Text className={`${secondaryTextColor} text-sm`}>{dailyTip.category}</Text>
                      </View>
                    </View>
                    <Ionicons
                      name={expandedSection === `tip-global` ? 'chevron-up' : 'chevron-down'}
                      size={20}
                      color={secondaryTextColor}
                    />
                  </TouchableOpacity>
                  {expandedSection === `tip-global` && (
                    <View className="pl-8 pb-3">
                      <Text className={`${secondaryTextColor} leading-5`}>
                        {parseTipContent(dailyTip.content).description}
                      </Text>
                      <Text className={`${secondaryTextColor} text-sm mt-2`}>
                        {language === 'fr' ? 'Mis à jour le' : 'Updated on'} {dailyTip.date}
                      </Text>
                    </View>
                  )}
                </View>
              </View>
            </View>
          ) : (
            <View className="px-6 mb-6">
              <View className={`${cardBgColor} rounded-3xl p-6`}>
                <View className="flex-row items-center mb-4">
                  <View
                    className="w-10 h-10 rounded-full items-center justify-center mr-3"
                    style={{ backgroundColor: '#eab30820' }}
                  >
                    <Ionicons name="lightbulb-outline" size={20} color="#eab308" />
                  </View>
                  <Text className={`text-lg font-bold ${textColor}`}>
                    💡 {language === 'fr' ? 'Conseil du jour' : 'Daily Tip'}
                  </Text>
                </View>
                <Text className={`${secondaryTextColor} text-sm`}>
                  {language === 'fr' ? 'Aucun conseil disponible, affichage du conseil par défaut.' : 'No tip available, displaying fallback tip.'}
                </Text>
              </View>
            </View>
          )}

          {beachIds.map(beachId => (
            <View key={beachId} className="px-6 mb-6">
              <View className={`${cardBgColor} rounded-3xl p-6`}>
                <Text className={`text-xl font-bold ${textColor} mb-4`}>
                  {beachNames[beachId] || 'Essaouira Beach'}
                </Text>
                <View className="flex-row items-center mb-4">
                  <View
                    className="w-10 h-10 rounded-full items-center justify-center mr-3"
                    style={{ backgroundColor: iconColor + '20' }}
                  >
                    <Ionicons name="camera-outline" size={20} color={iconColor} />
                  </View>
                  <Text className={`text-lg font-bold ${textColor}`}>
                    {language === 'fr' ? 'Vue de la plage' : 'Beach Overview'}
                  </Text>
                </View>
                <View 
                  className="h-48 rounded-2xl items-center justify-center mb-4"
                  style={{ backgroundColor: isDarkMode ? '#4b5563' : '#e5e7eb' }}
                >
                  <Ionicons name="image-outline" size={48} color={iconColor} />
                  <Text className={`${secondaryTextColor} mt-2 text-center`}>
                    {language === 'fr' ? `Photo aérienne de ${beachNames[beachId] || 'Essaouira Beach'}\navec annotations` : `Aerial photo of ${beachNames[beachId] || 'Essaouira Beach'}\nwith annotations`}
                  </Text>
                </View>
              </View>

              {safetyRules[beachId]?.length > 0 && (
                <View className="mb-6">
                  <View className={`${cardBgColor} rounded-3xl p-6`}>
                    <View className="flex-row items-center mb-4">
                      <View
                        className="w-10 h-10 rounded-full items-center justify-center mr-3"
                        style={{ backgroundColor: '#ef4444' + '20' }}
                      >
                        <Ionicons name="shield-checkmark-outline" size={20} color="#ef4444" />
                      </View>
                      <Text className={`text-lg font-bold ${textColor}`}>
                        🛟 {language === 'fr' ? 'Informations sur la plage' : 'Beach Information'}
                      </Text>
                    </View>
                    
                    {safetyRules[beachId].map((rule, index) => (
                      <View key={rule.id}>
                        <TouchableOpacity
                          onPress={() => toggleSection(`rule-${beachId}-${rule.id}`)}
                          className="flex-row items-center justify-between py-3"
                        >
                          <View className="flex-row items-center flex-1">
                            <Ionicons name={rule.icon} size={20} color={iconColor} />
                            <Text className={`ml-3 font-medium ${textColor} flex-1`}>
                              {rule.title}
                            </Text>
                          </View>
                          <Ionicons
                            name={expandedSection === `rule-${beachId}-${rule.id}` ? 'chevron-up' : 'chevron-down'}
                            size={20}
                            color={secondaryTextColor}
                          />
                        </TouchableOpacity>
                        
                        {expandedSection === `rule-${beachId}-${rule.id}` && (
                          <View className="pl-8 pb-3">
                            <Text className={`${secondaryTextColor} leading-5`}>
                              {rule.description}
                            </Text>
                          </View>
                        )}
                        
                        {index < safetyRules[beachId].length - 1 && (
                          <View 
                            className="h-px ml-8"
                            style={{ backgroundColor: isDarkMode ? '#374151' : '#e5e7eb' }}
                          />
                        )}
                      </View>
                    ))}
                  </View>
                </View>
              )}

              {lifeguardStations[beachId]?.length > 0 && (
                <View className="mb-6">
                  <View className={`${cardBgColor} rounded-3xl p-6`}>
                    <View className="flex-row items-center mb-4">
                      <View
                        className="w-10 h-10 rounded-full items-center justify-center mr-3"
                        style={{ backgroundColor: '#10b98120' }}
                      >
                        <Ionicons name="people-outline" size={20} color="#10b981" />
                      </View>
                      <Text className={`text-lg font-bold ${textColor}`}>
                        ⛱️ {language === 'fr' ? 'Postes de secours' : 'Lifeguard Stations'}
                      </Text>
                    </View>
                    
                    {lifeguardStations[beachId].map((station, index) => (
                      <View key={station.id}>
                        <View className="flex-row items-center justify-between py-3">
                          <View className="flex-1">
                            <View className="flex-row items-center">
                              <Text className={`font-medium ${textColor}`}>
                                {station.name}
                              </Text>
                              <View
                                className={`ml-2 px-2 py-1 rounded-full ${
                                  station.status === 'active' ? 'bg-green-100' : 'bg-red-100'
                                }`}
                              >
                                <Text className={`text-xs font-medium ${
                                  station.status === 'active' ? 'text-green-800' : 'text-red-800'
                                }`}>
                                  {station.status === 'active' 
                                    ? (language === 'fr' ? 'Actif' : 'Active')
                                    : (language === 'fr' ? 'Fermé' : 'Closed')
                                  }
                                </Text>
                              </View>
                            </View>
                            <Text className={`${secondaryTextColor} text-sm`}>
                              {station.hours} • {station.location}
                            </Text>
                          </View>
                          <Ionicons
                            name="location-outline"
                            size={20}
                            color={station.status === 'active' ? '#10b981' : '#6b7280'}
                          />
                        </View>
                        
                        {index < lifeguardStations[beachId].length - 1 && (
                          <View 
                            className="h-px"
                            style={{ backgroundColor: isDarkMode ? '#374151' : '#e5e7eb' }}
                          />
                        )}
                      </View>
                    ))}
                  </View>
                </View>
              )}

              {facilities[beachId]?.length > 0 && (
                <View className="mb-8">
                  <View className={`${cardBgColor} rounded-3xl p-6`}>
                    <View className="flex-row items-center mb-4">
                      <View
                        className="w-10 h-10 rounded-full items-center justify-center mr-3"
                        style={{ backgroundColor: '#8b5cf620' }}
                      >
                        <Ionicons name="business-outline" size={20} color="#8b5cf6" />
                      </View>
                      <Text className={`text-lg font-bold ${textColor}`}>
                        💧🅿️ {language === 'fr' ? 'Équipements' : 'Facilities'}
                      </Text>
                    </View>
                    
                    <View className="flex-row flex-wrap">
                      {facilities[beachId].map((facility) => (
                        <View key={facility.id} className="w-1/2 p-2">
                          <View 
                            className="rounded-2xl p-4 items-center"
                            style={{ backgroundColor: isDarkMode ? '#374151' : '#ffffff' }}
                          >
                            <View
                              className="w-12 h-12 rounded-full items-center justify-center mb-3"
                              style={{ backgroundColor: iconColor + '20' }}
                            >
                              <Ionicons name={facility.icon} size={24} color={iconColor} />
                            </View>
                            <Text className={`font-medium ${textColor} text-center mb-1`}>
                              {facility.name}
                            </Text>
                            <Text className={`${secondaryTextColor} text-sm text-center font-bold`}>
                              {facility.count}
                            </Text>
                            <Text className={`${secondaryTextColor} text-xs text-center`}>
                              {facility.locations}
                            </Text>
                          </View>
                        </View>
                      ))}
                    </View>
                  </View>
                </View>
              )}
            </View>
          ))}
          
          <View className="px-6 mb-6">
            <TouchableOpacity
              onPress={() => setShowEmergencyModal(true)}
              className="rounded-3xl p-6 items-center shadow-lg"
              style={{ 
                backgroundColor: '#ef4444',
                shadowColor: '#ef4444',
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.3,
                shadowRadius: 12,
                elevation: 8,
              }}
            >
              <View className="flex-row items-center">
                <Ionicons name="call-outline" size={28} color="white" />
                <View className="ml-4">
                  <Text className="font-bold text-white text-lg">
                    🚨 {language === 'fr' ? 'Numéros d\'urgence' : 'Emergency Numbers'}
                  </Text>
                  <Text className="text-red-100 text-sm">
                    {language === 'fr' ? 'Appuyez pour accéder' : 'Tap for quick access'}
                  </Text>
                </View>
                <View className="ml-auto">
                  <Ionicons name="chevron-forward" size={20} color="white" />
                </View>
              </View>
            </TouchableOpacity>
          </View>
        </ScrollView>
      )}

      <EmergencyModal
        visible={showEmergencyModal}
        onClose={() => setShowEmergencyModal(false)}
        isDarkMode={isDarkMode}
        language={language}
        emergencyContacts={MOROCCO_EMERGENCY_CONTACTS}
      />
    </SafeAreaView>
  );
}