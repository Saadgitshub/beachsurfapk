import React, { useState, useEffect } from 'react';
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
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

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

interface SafetyInfo {
  id: number;
  title: string;
  content: string;
  category: string;
}

const { width } = Dimensions.get('window');
const BASE_URL = 'http://192.168.1.6:8080';

// Fallback emoji mapping for unsupported platforms
const emojiFallbacks: { [key: string]: string } = {
  '🚨': Platform.OS === 'android' ? '⚠️' : '🚨', // SAMU
  '🚓': Platform.OS === 'android' ? '🚔' : '🚓', // Police
  '🚒': Platform.OS === 'android' ? '🔥' : '🚒', // Pompiers/Fire Department
  '🆘': Platform.OS === 'android' ? '❗' : '🆘', // Urgence EU/EU Emergency
  '🌊': Platform.OS === 'android' ? '💧' : '🌊'  // Sauvetage mer/Sea Rescue
};

function EmergencyModal({ visible, onClose, isDarkMode = false, language = 'fr', emergencyContacts = [] }: {
  visible: boolean;
  onClose: () => void;
  isDarkMode?: boolean;
  language?: 'fr' | 'en';
  emergencyContacts: EmergencyContact[];
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
                      {contact.name}
                    </Text>
                  </View>
                </View>
                
                <View 
                  className="w-12 h-12 rounded-full items-center justify-center"
                  style={{ backgroundColor: contact.color }}
                >
                  <Text className="text-white font-bold">
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
  const [safetyRules, setSafetyRules] = useState<SafetyRule[]>([]);
  const [lifeguardStations, setLifeguardStations] = useState<LifeguardStation[]>([]);
  const [facilities, setFacilities] = useState<Facility[]>([]);
  const [emergencyContacts, setEmergencyContacts] = useState<EmergencyContact[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const navigation = useNavigation<NavigationProp>();

  const fetchSafetyInfo = async (retryCount = 3, delay = 2000, timeout = 10000) => {
    const url = `${BASE_URL}/api/safety-info/beach/1?lang=${language}`;
    console.log(`Fetching safety info from: ${url}`);
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
          throw new Error(`HTTP error! Status: ${response.status}, Body: ${errorText.substring(0, 200)}`);
        }

        const text = await response.text();
        console.log(`Raw response for attempt ${attempt}: ${text.substring(0, 200)}...`);
        let data: SafetyInfo[];
        try {
          data = JSON.parse(text);
        } catch (parseError: any) {
          console.error(`JSON parse error on attempt ${attempt}: ${parseError.message}`);
          throw new Error(`JSON parse error: ${parseError.message}`);
        }

        console.log('Parsed safety info data:', JSON.stringify(data, null, 2));

        const rules: SafetyRule[] = data
          .filter(item => item.category === 'SAFETY')
          .map(item => {
            try {
              console.log('Parsing SAFETY content for ID', item.id, ':', item.content);
              return { id: item.id, title: item.title, ...JSON.parse(item.content) };
            } catch (e: any) {
              console.error('Failed to parse SAFETY content for ID', item.id, ':', e.message);
              return null;
            }
          })
          .filter(item => item !== null) as SafetyRule[];

        const lifeguards: LifeguardStation[] = data
          .filter(item => item.category === 'LIFEGUARD')
          .map(item => {
            try {
              console.log('Parsing LIFEGUARD content for ID', item.id, ':', item.content);
              return { id: item.id, name: item.title, ...JSON.parse(item.content) };
            } catch (e: any) {
              console.error('Failed to parse LIFEGUARD content for ID', item.id, ':', e.message);
              return null;
            }
          })
          .filter(item => item !== null) as LifeguardStation[];

        const facilitiesData: Facility[] = data
          .filter(item => item.category === 'FACILITY')
          .map(item => {
            try {
              console.log('Parsing FACILITY content for ID', item.id, ':', item.content);
              return { id: item.id, name: item.title, ...JSON.parse(item.content) };
            } catch (e: any) {
              console.error('Failed to parse FACILITY content for ID', item.id, ':', e.message);
              return null;
            }
          })
          .filter(item => item !== null) as Facility[];

        const emergencies: EmergencyContact[] = data
          .filter(item => item.category === 'EMERGENCY')
          .map(item => {
            try {
              const parsedContent = JSON.parse(item.content);
              console.log('Parsing EMERGENCY content for ID', item.id, ':', item.content, 'Parsed emoji:', parsedContent.emoji);
              return { id: item.id, name: item.title, ...parsedContent };
            } catch (e: any) {
              console.error('Failed to parse EMERGENCY content for ID', item.id, ':', e.message);
              return null;
            }
          })
          .filter(item => item !== null) as EmergencyContact[];

        setSafetyRules(rules);
        setLifeguardStations(lifeguards);
        setFacilities(facilitiesData);
        setEmergencyContacts(emergencies);
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

  useEffect(() => {
    fetchSafetyInfo();
  }, [language]);

  const toggleTheme = () => {
    setIsDarkMode(!isDarkMode);
  };

  const toggleLanguage = () => {
    setLanguage(language === 'fr' ? 'en' : 'fr');
  };

  const toggleSection = (sectionId: string) => {
    setExpandedSection(expandedSection === sectionId ? null : sectionId);
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
            onPress={() => fetchSafetyInfo()}
            className="mt-4 bg-blue-500 px-4 py-2 rounded-lg"
          >
            <Text className="text-white font-bold">
              {language === 'fr' ? 'Réessayer' : 'Retry'}
            </Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
          <View className="px-6 mb-6">
            <View className={`${cardBgColor} rounded-3xl p-6`}>
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
                  {language === 'fr' ? 'Photo aérienne de la plage\navec annotations' : 'Aerial beach photo\nwith annotations'}
                </Text>
              </View>
            </View>
          </View>

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

          {safetyRules.length > 0 && (
            <View className="px-6 mb-6">
              <View className={`${cardBgColor} rounded-3xl p-6`}>
                <View className="flex-row items-center mb-4">
                  <View
                    className="w-10 h-10 rounded-full items-center justify-center mr-3"
                    style={{ backgroundColor: '#ef4444' + '20' }}
                  >
                    <Ionicons name="shield-checkmark-outline" size={20} color="#ef4444" />
                  </View>
                  <Text className={`text-lg font-bold ${textColor}`}>
                    🛟 {language === 'fr' ? 'Règles de sécurité' : 'Beach Safety Rules'}
                  </Text>
                </View>
                
                {safetyRules.map((rule, index) => (
                  <View key={rule.id}>
                    <TouchableOpacity
                      onPress={() => toggleSection(`rule-${rule.id}`)}
                      className="flex-row items-center justify-between py-3"
                    >
                      <View className="flex-row items-center flex-1">
                        <Ionicons name={rule.icon} size={20} color={iconColor} />
                        <Text className={`ml-3 font-medium ${textColor} flex-1`}>
                          {rule.title}
                        </Text>
                      </View>
                      <Ionicons
                        name={expandedSection === `rule-${rule.id}` ? 'chevron-up' : 'chevron-down'}
                        size={20}
                        color={secondaryTextColor}
                      />
                    </TouchableOpacity>
                    
                    {expandedSection === `rule-${rule.id}` && (
                      <View className="pl-8 pb-3">
                        <Text className={`${secondaryTextColor} leading-5`}>
                          {rule.description}
                        </Text>
                      </View>
                    )}
                    
                    {index < safetyRules.length - 1 && (
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

          {lifeguardStations.length > 0 && (
            <View className="px-6 mb-6">
              <View className={`${cardBgColor} rounded-3xl p-6`}>
                <View className="flex-row items-center mb-4">
                  <View
                    className="w-10 h-10 rounded-full items-center justify-center mr-3"
                    style={{ backgroundColor: '#10b981' + '20' }}
                  >
                    <Ionicons name="people-outline" size={20} color="#10b981" />
                  </View>
                  <Text className={`text-lg font-bold ${textColor}`}>
                    ⛱️ {language === 'fr' ? 'Postes de secours' : 'Lifeguard Stations'}
                  </Text>
                </View>
                
                {lifeguardStations.map((station, index) => (
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
                    
                    {index < lifeguardStations.length - 1 && (
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

          {facilities.length > 0 && (
            <View className="px-6 mb-8">
              <View className={`${cardBgColor} rounded-3xl p-6`}>
                <View className="flex-row items-center mb-4">
                  <View
                    className="w-10 h-10 rounded-full items-center justify-center mr-3"
                    style={{ backgroundColor: '#8b5cf6' + '20' }}
                  >
                    <Ionicons name="business-outline" size={20} color="#8b5cf6" />
                  </View>
                  <Text className={`text-lg font-bold ${textColor}`}>
                    💧🅿️ {language === 'fr' ? 'Équipements' : 'Facilities'}
                  </Text>
                </View>
                
                <View className="flex-row flex-wrap">
                  {facilities.map((facility) => (
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

          {emergencyContacts.length > 0 && (
            <View className="px-6 mb-8">
              <View className={`${cardBgColor} rounded-3xl p-6`}>
                <View className="flex-row items-center mb-4">
                  <View
                    className="w-10 h-10 rounded-full items-center justify-center mr-3"
                    style={{ backgroundColor: '#ef4444' + '20' }}
                  >
                    <Ionicons name="medical-outline" size={20} color="#ef4444" />
                  </View>
                  <Text className={`text-lg font-bold ${textColor}`}>
                    🚨 {language === 'fr' ? 'Contacts d\'urgence' : 'Emergency Contacts'}
                  </Text>
                </View>
                
                <View className="space-y-3">
                  {emergencyContacts.slice(0, 2).map((contact) => (
                    <View key={contact.id} className="flex-row items-center justify-between py-2">
                      <View className="flex-row items-center">
                        <Text className="text-2xl mr-3">{emojiFallbacks[contact.emoji] || contact.emoji}</Text>
                        <Text className={`font-medium ${textColor}`}>
                          {contact.name}
                        </Text>
                      </View>
                      <TouchableOpacity
                        onPress={() => Linking.openURL(`tel:${contact.number}`)}
                        className="px-4 py-2 rounded-full"
                        style={{ backgroundColor: contact.color }}
                      >
                        <Text className="text-white font-bold">{contact.number}</Text>
                      </TouchableOpacity>
                    </View>
                  ))}
                  <TouchableOpacity
                    onPress={() => setShowEmergencyModal(true)}
                    className="mt-3 py-3 px-4 rounded-2xl border-2 border-dashed"
                    style={{ borderColor: isDarkMode ? '#6b7280' : '#d1d5db' }}
                  >
                    <Text className={`text-center ${secondaryTextColor} font-medium`}>
                      {language === 'fr' ? 'Voir tous les numéros d\'urgence' : 'View all emergency numbers'}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          )}
        </ScrollView>
      )}

      <EmergencyModal
        visible={showEmergencyModal}
        onClose={() => setShowEmergencyModal(false)}
        isDarkMode={isDarkMode}
        language={language}
        emergencyContacts={emergencyContacts}
      />
    </SafeAreaView>
  );
}