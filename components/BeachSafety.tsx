import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  StatusBar,
  Dimensions,
  Image,
  Linking,
  Alert,
  Modal
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

const { width, height } = Dimensions.get('window');

// Emergency Modal Component
function EmergencyModal({ visible, onClose, isDarkMode = false, language = 'fr' }) {
  const emergencyContacts = [
    {
      id: 1,
      emoji: '🚨',
      name: language === 'fr' ? 'SAMU' : 'Emergency Medical',
      number: '15',
      color: '#ef4444'
    },
    {
      id: 2,
      emoji: '🚓',
      name: language === 'fr' ? 'Police' : 'Police',
      number: '17',
      color: '#3b82f6'
    },
    {
      id: 3,
      emoji: '🚒',
      name: language === 'fr' ? 'Pompiers' : 'Fire Department',
      number: '18',
      color: '#f97316'
    },
    {
      id: 4,
      emoji: '🆘',
      name: language === 'fr' ? 'Urgence EU' : 'EU Emergency',
      number: '112',
      color: '#8b5cf6'
    },
    {
      id: 5,
      emoji: '🌊',
      name: language === 'fr' ? 'Sauvetage mer' : 'Sea Rescue',
      number: '196',
      color: '#06b6d4'
    }
  ];

  const makeCall = (number) => {
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
          {/* Header */}
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

          {/* Emergency Contacts */}
          <ScrollView showsVerticalScrollIndicator={false}>
            {emergencyContacts.map((contact, index) => (
              <TouchableOpacity
                key={contact.id}
                onPress={() => makeCall(contact.number)}
                className="flex-row items-center justify-between py-4 px-4 mb-2 rounded-2xl"
                style={{ backgroundColor: contact.color + '10' }}
              >
                <View className="flex-row items-center flex-1">
                  <Text className="text-2xl mr-4">{contact.emoji}</Text>
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

          {/* Quick Info */}
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
  const [language, setLanguage] = useState('fr'); // fr or en
  const [expandedSection, setExpandedSection] = useState(null);
  const [showEmergencyModal, setShowEmergencyModal] = useState(false);
  const navigation = useNavigation<NavigationProp>();

  // Safety rules data
  const safetyRules = [
    {
      id: 1,
      icon: 'flag-outline',
      title: language === 'fr' ? 'Respectez les drapeaux de baignade' : 'Respect swimming flags',
      description: language === 'fr' 
        ? 'Vert : baignade autorisée\nOrange : baignade surveillée\nRouge : baignade interdite'
        : 'Green: swimming allowed\nOrange: supervised swimming\nRed: swimming prohibited'
    },
    {
      id: 2,
      icon: 'people-outline',
      title: language === 'fr' ? 'Nagez près des postes de secours' : 'Swim near lifeguard stations',
      description: language === 'fr'
        ? 'Restez toujours dans les zones surveillées par les maîtres-nageurs sauveteurs'
        : 'Always stay in areas supervised by lifeguards'
    },
    {
      id: 3,
      icon: 'sunny-outline',
      title: language === 'fr' ? 'Protection solaire obligatoire' : 'Sun protection required',
      description: language === 'fr'
        ? 'Crème solaire SPF 30+, chapeau et vêtements protecteurs recommandés'
        : 'SPF 30+ sunscreen, hat and protective clothing recommended'
    },
    {
      id: 4,
      icon: 'water-outline',
      title: language === 'fr' ? 'Attention aux courants' : 'Beware of currents',
      description: language === 'fr'
        ? 'En cas de courant fort, nagez parallèlement à la côte pour en sortir'
        : 'In strong current, swim parallel to shore to escape'
    }
  ];

  // Lifeguard stations data
  const lifeguardStations = [
    {
      id: 1,
      name: language === 'fr' ? 'Poste Central' : 'Central Station',
      hours: '9h00 - 19h00',
      location: language === 'fr' ? 'Centre plage' : 'Beach center',
      status: 'active'
    },
    {
      id: 2,
      name: language === 'fr' ? 'Poste Nord' : 'North Station',
      hours: '10h00 - 18h00',
      location: language === 'fr' ? 'Extrémité nord' : 'North end',
      status: 'active'
    },
    {
      id: 3,
      name: language === 'fr' ? 'Poste Sud' : 'South Station',
      hours: '10h00 - 18h00',
      location: language === 'fr' ? 'Extrémité sud' : 'South end',
      status: 'inactive'
    }
  ];

  // Facilities data
  const facilities = [
    {
      id: 1,
      icon: 'water',
      type: 'shower',
      name: language === 'fr' ? 'Douches' : 'Showers',
      count: 6,
      locations: language === 'fr' ? 'Réparties sur la plage' : 'Distributed across beach'
    },
    {
      id: 2,
      icon: 'car',
      type: 'parking',
      name: language === 'fr' ? 'Parking' : 'Parking',
      count: 150,
      locations: language === 'fr' ? '3 zones principales' : '3 main areas'
    },
    {
      id: 3,
      icon: 'restaurant',
      type: 'food',
      name: language === 'fr' ? 'Restauration' : 'Food & Drink',
      count: 4,
      locations: language === 'fr' ? 'Bars de plage' : 'Beach bars'
    },
    {
      id: 4,
      icon: 'accessibility',
      type: 'accessibility',
      name: language === 'fr' ? 'Accessibilité' : 'Accessibility',
      count: 2,
      locations: language === 'fr' ? 'Accès PMR' : 'Wheelchair access'
    }
  ];

  const toggleTheme = () => {
    setIsDarkMode(!isDarkMode);
  };

  const toggleLanguage = () => {
    setLanguage(language === 'fr' ? 'en' : 'fr');
  };

  const toggleSection = (sectionId) => {
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
      
      {/* Header */}
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

      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        {/* Beach Aerial Photo Section */}
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
            
            {/* Placeholder for aerial photo */}
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

        {/* Emergency Quick Access */}
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

        {/* Safety Rules Section */}
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

        {/* Lifeguard Stations Section */}
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

        {/* Facilities Section */}
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

        {/* Emergency Contact Section */}
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
              <View className="flex-row items-center justify-between py-2">
                <View className="flex-row items-center">
                  <Text className="text-2xl mr-3">🚨</Text>
                  <Text className={`font-medium ${textColor}`}>SAMU</Text>
                </View>
                <TouchableOpacity
                  onPress={() => Linking.openURL('tel:15')}
                  className="px-4 py-2 rounded-full"
                  style={{ backgroundColor: '#ef4444' }}
                >
                  <Text className="text-white font-bold">15</Text>
                </TouchableOpacity>
              </View>
              
              <View className="flex-row items-center justify-between py-2">
                <View className="flex-row items-center">
                  <Text className="text-2xl mr-3">🌊</Text>
                  <Text className={`font-medium ${textColor}`}>
                    {language === 'fr' ? 'Sauvetage mer' : 'Sea Rescue'}
                  </Text>
                </View>
                <TouchableOpacity
                  onPress={() => Linking.openURL('tel:196')}
                  className="px-4 py-2 rounded-full"
                  style={{ backgroundColor: '#06b6d4' }}
                >
                  <Text className="text-white font-bold">196</Text>
                </TouchableOpacity>
              </View>

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
      </ScrollView>

      {/* Emergency Modal */}
      <EmergencyModal
        visible={showEmergencyModal}
        onClose={() => setShowEmergencyModal(false)}
        isDarkMode={isDarkMode}
        language={language}
      />
    </SafeAreaView>
  );
}