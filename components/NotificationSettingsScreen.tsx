import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  StatusBar,
  Switch,
  Alert,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSettings } from '../SettingsContext';
import Constants from 'expo-constants';
import * as Location from 'expo-location';
import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';

type RootStackParamList = {
  Onboarding: undefined;
  Map: undefined;
  BeachSafety: undefined;
  NotificationSettings: undefined;
};
type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

const BASE_URL = 'http://192.168.1.11:8080';

export default function NotificationSettingsScreen() {
  const { settings, updateSettings } = useSettings();
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [language, setLanguage] = useState<'fr' | 'en'>('fr');
  const [loading, setLoading] = useState(true);
  const navigation = useNavigation<NavigationProp>();

  // Fetch initial settings from backend or AsyncStorage
  const fetchSettings = async () => {
    try {
      const deviceId = Constants.installationId || 'test-device';
      const response = await fetch(`${BASE_URL}/api/settings?deviceId=${deviceId}`);
      if (!response.ok) {
        throw new Error(`Failed to fetch settings: ${response.status}`);
      }
      const data = await response.json();
      const newSettings = {
        notifications: data.notifications ?? true,
        locationAlerts: data.locationAlerts ?? true,
        sounds: data.sounds ?? true,
        vibrations: data.vibrations ?? true,
      };
      updateSettings(newSettings);
      await AsyncStorage.setItem('settings', JSON.stringify(newSettings));
    } catch (error) {
      console.warn('Failed to fetch settings from backend, trying AsyncStorage:', error);
      try {
        const stored = await AsyncStorage.getItem('settings');
        const newSettings = stored
          ? JSON.parse(stored)
          : {
              notifications: true,
              locationAlerts: true,
              sounds: true,
              vibrations: true,
            };
        updateSettings(newSettings);
      } catch (storageError) {
        console.warn('Failed to fetch settings from AsyncStorage, using defaults:', storageError);
        updateSettings({
          notifications: true,
          locationAlerts: true,
          sounds: true,
          vibrations: true,
        });
      }
    } finally {
      setLoading(false);
    }
  };

  // Save settings to backend and AsyncStorage
  const saveSettings = async (newSettings: typeof settings) => {
    try {
      const deviceId = Constants.installationId || 'test-device';
      const response = await fetch(`${BASE_URL}/api/settings`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify({ deviceId, ...newSettings }),
      });
      if (!response.ok) {
        throw new Error(`Failed to save settings: ${response.status}`);
      }
      console.log('Settings saved to backend:', newSettings);
    } catch (error) {
      console.error('Error saving settings to backend:', error);
      Alert.alert(
        language === 'fr' ? 'Erreur' : 'Error',
        language === 'fr'
          ? 'Échec de la sauvegarde des paramètres. Ils sont enregistrés localement.'
          : 'Failed to save settings. Saved locally.',
      );
    }
    try {
      await AsyncStorage.setItem('settings', JSON.stringify(newSettings));
      console.log('Settings saved to AsyncStorage:', newSettings);
    } catch (storageError) {
      console.error('Error saving settings to AsyncStorage:', storageError);
    }
  };

  // Request notification permissions
  const requestNotificationPermissions = async () => {
    try {
      const { status } = await Notifications.requestPermissionsAsync({
        ios: {
          allowAlert: true,
          allowBadge: true,
          allowSound: true,
        },
      });
      if (status !== 'granted') {
        Alert.alert(
          language === 'fr' ? 'Permission refusée' : 'Permission Denied',
          language === 'fr'
            ? 'Les notifications ne peuvent pas être activées sans permission.'
            : 'Notifications cannot be enabled without permission.',
        );
        return false;
      }
      if (Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync('beach-safety-channel', {
          name: 'Beach Safety Notifications',
          importance: Notifications.AndroidImportance.HIGH,
          sound: 'default',
          vibrationPattern: [0, 300],
        });
      }
      return true;
    } catch (error) {
      console.error('Error requesting notification permissions:', error);
      return false;
    }
  };

  // Request location permissions
  const requestLocationPermissions = async () => {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert(
        language === 'fr' ? 'Permission refusée' : 'Permission Denied',
        language === 'fr'
          ? 'Les alertes de localisation ne peuvent pas être activées sans permission.'
          : 'Location alerts cannot be enabled without permission.',
      );
      return false;
    }
    return true;
  };

  // Configure notifications
  const configureNotifications = async (enable: boolean, sounds: boolean, vibrations: boolean) => {
    if (enable) {
      const hasPermission = await requestNotificationPermissions();
      if (!hasPermission) return false;
      Notifications.setNotificationHandler({
        handleNotification: async () => ({
          shouldShowAlert: true,
          shouldPlaySound: sounds,
          shouldSetBadge: true,
          shouldShowBanner: true,
          shouldShowList: true,
        }),
      });
    } else {
      Notifications.setNotificationHandler({
        handleNotification: async () => ({
          shouldShowAlert: false,
          shouldPlaySound: false,
          shouldSetBadge: false,
          shouldShowBanner: false,
          shouldShowList: false,
        }),
      });
    }
    return true;
  };

  // Configure location alerts
  const configureLocationAlerts = async (enable: boolean) => {
    if (enable) {
      const hasPermission = await requestLocationPermissions();
      if (!hasPermission) return false;
      await Location.startLocationUpdatesAsync('location-task', {
        accuracy: Location.Accuracy.Balanced,
        distanceInterval: 100,
      });
    } else {
      if (await Location.hasStartedLocationUpdatesAsync('location-task')) {
        await Location.stopLocationUpdatesAsync('location-task');
      }
    }
    return true;
  };

  useEffect(() => {
    fetchSettings();
    // Initialize notification and location handlers based on current settings
    configureNotifications(settings.notifications, settings.sounds, settings.vibrations);
    configureLocationAlerts(settings.locationAlerts);
  }, []);

  const toggleSetting = async (key: keyof typeof settings) => {
    const newValue = !settings[key];
    let canUpdate = true;

    if (key === 'notifications' && newValue) {
      canUpdate = await requestNotificationPermissions();
    } else if (key === 'locationAlerts' && newValue) {
      canUpdate = await requestLocationPermissions();
    }

    if (!canUpdate) return;

    const newSettings = { ...settings, [key]: newValue };
    updateSettings(newSettings);
    await saveSettings(newSettings);

    if (key === 'notifications' || key === 'sounds' || key === 'vibrations') {
      await configureNotifications(newSettings.notifications, newSettings.sounds, newSettings.vibrations);
    } else if (key === 'locationAlerts') {
      await configureLocationAlerts(newSettings.locationAlerts);
    }
  };

  const toggleTheme = () => {
    setIsDarkMode(!isDarkMode);
  };

  const toggleLanguage = () => {
    setLanguage(language === 'fr' ? 'en' : 'fr');
  };

  const showHelp = () => {
    Alert.alert(
      language === 'fr' ? 'Aide' : 'Help',
      language === 'fr'
        ? 'Cette section vous permet de gérer vos préférences de notifications pour une expérience personnalisée.'
        : 'This section allows you to manage your notification preferences for a personalized experience.',
    );
  };

  const showAbout = () => {
    Alert.alert(
      language === 'fr' ? 'À propos' : 'About',
      language === 'fr'
        ? 'Application de sécurité plage\nVersion 1.0.0\n\nDéveloppée pour assurer votre sécurité sur les plages.'
        : 'Beach Safety App\nVersion 1.0.0\n\nDeveloped to ensure your safety on beaches.',
    );
  };

  const resetSettings = () => {
    Alert.alert(
      language === 'fr' ? 'Réinitialiser les paramètres' : 'Reset Settings',
      language === 'fr'
        ? 'Êtes-vous sûr de vouloir réinitialiser tous les paramètres aux valeurs par défaut ?'
        : 'Are you sure you want to reset all settings to default values?',
      [
        {
          text: language === 'fr' ? 'Annuler' : 'Cancel',
          style: 'cancel',
        },
        {
          text: language === 'fr' ? 'Réinitialiser' : 'Reset',
          style: 'destructive',
          onPress: async () => {
            const defaultSettings = {
              notifications: true,
              locationAlerts: true,
              sounds: true,
              vibrations: true,
            };
            updateSettings(defaultSettings);
            await saveSettings(defaultSettings);
            await configureNotifications(true, true, true);
            await configureLocationAlerts(true);
          },
        },
      ],
    );
  };

  const toggleSettings = [
    {
      id: 'notifications',
      icon: 'notifications-outline',
      emoji: '🔔',
      title: language === 'fr' ? 'Recevoir les notifications' : 'Receive notifications',
      description: language === 'fr'
        ? 'Recevez des alertes importantes sur la sécurité'
        : 'Receive important safety alerts',
      value: settings.notifications,
      key: 'notifications' as keyof typeof settings,
    },
    {
      id: 'locationAlerts',
      icon: 'location-outline',
      emoji: '📍',
      title: language === 'fr' ? 'Alertes de zone' : 'Location alerts',
      description: language === 'fr'
        ? 'Alertes basées sur votre position actuelle'
        : 'Alerts based on your current location',
      value: settings.locationAlerts,
      key: 'locationAlerts' as keyof typeof settings,
    },
    {
      id: 'sounds',
      icon: 'volume-high-outline',
      emoji: '🔊',
      title: language === 'fr' ? 'Sons' : 'Sounds',
      description: language === 'fr'
        ? 'Sons pour les notifications et alertes'
        : 'Sounds for notifications and alerts',
      value: settings.sounds,
      key: 'sounds' as keyof typeof settings,
    },
    {
      id: 'vibrations',
      icon: 'phone-portrait-outline',
      emoji: '📳',
      title: language === 'fr' ? 'Vibrations' : 'Vibrations',
      description: language === 'fr'
        ? 'Vibrations pour les notifications importantes'
        : 'Vibrations for important notifications',
      value: settings.vibrations,
      key: 'vibrations' as keyof typeof settings,
    },
  ];

  const actionButtons = [
    {
      id: 'help',
      icon: 'help-circle-outline' as const,
      emoji: 'ℹ️',
      title: language === 'fr' ? 'Aide' : 'Help',
      color: '#3b82f6',
      onPress: showHelp,
    },
    {
      id: 'about',
      icon: 'information-circle-outline' as const,
      emoji: '💡',
      title: language === 'fr' ? 'À propos' : 'About',
      color: '#8b5cf6',
      onPress: showAbout,
    },
    {
      id: 'reset',
      icon: 'refresh-outline' as const,
      emoji: '♻️',
      title: language === 'fr' ? 'Réinitialiser' : 'Reset',
      color: '#ef4444',
      onPress: resetSettings,
    },
  ];

  const bgColor = isDarkMode ? 'bg-gray-900' : 'bg-white';
  const textColor = isDarkMode ? 'text-white' : 'text-gray-900';
  const secondaryTextColor = isDarkMode ? 'text-gray-300' : 'text-gray-600';
  const cardBgColor = isDarkMode ? 'bg-gray-800' : 'bg-gray-50';

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
          {language === 'fr' ? 'Notifications' : 'Notifications'}
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
      ) : (
        <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
          <View className="px-6 mb-6">
            <View className={`${cardBgColor} rounded-3xl p-6`}>
              <View className="flex-row items-center mb-4">
                <View
                  className="w-10 h-10 rounded-full items-center justify-center mr-3"
                  style={{ backgroundColor: '#3b82f6' + '20' }}
                >
                  <Ionicons name="settings-outline" size={20} color="#3b82f6" />
                </View>
                <Text className={`text-lg font-bold ${textColor}`}>
                  {language === 'fr' ? 'Préférences' : 'Preferences'}
                </Text>
              </View>
              {toggleSettings.map((setting, index) => (
                <View key={setting.id}>
                  <View className="flex-row items-center justify-between py-4">
                    <View className="flex-row items-center flex-1">
                      <Text className="text-xl mr-3">{setting.emoji}</Text>
                      <View className="flex-1">
                        <Text className={`font-medium ${textColor}`}>
                          {setting.title}
                        </Text>
                        <Text className={`${secondaryTextColor} text-sm mt-1`}>
                          {setting.description}
                        </Text>
                      </View>
                    </View>
                    <Switch
                      value={setting.value}
                      onValueChange={() => toggleSetting(setting.key)}
                      trackColor={{
                        false: isDarkMode ? '#374151' : '#e5e7eb',
                        true: '#3b82f6' + '40',
                      }}
                      thumbColor={setting.value ? '#3b82f6' : '#9ca3af'}
                      ios_backgroundColor={isDarkMode ? '#374151' : '#e5e7eb'}
                    />
                  </View>
                  {index < toggleSettings.length - 1 && (
                    <View
                      className="h-px"
                      style={{ backgroundColor: isDarkMode ? '#374151' : '#e5e7eb' }}
                    />
                  )}
                </View>
              ))}
            </View>
          </View>
          <View className="px-6 mb-6">
            <View className={`${cardBgColor} rounded-3xl p-6`}>
              <View className="flex-row items-center mb-4">
                <View
                  className="w-10 h-10 rounded-full items-center justify-center mr-3"
                  style={{ backgroundColor: '#10b981' + '20' }}
                >
                  <Ionicons name="checkmark-circle-outline" size={20} color="#10b981" />
                </View>
                <Text className={`text-lg font-bold ${textColor}`}>
                  {language === 'fr' ? 'État actuel' : 'Current Status'}
                </Text>
              </View>
              <View className="flex-row flex-wrap">
                {Object.entries(settings).map(([key, value]) => {
                  const setting = toggleSettings.find((s) => s.key === key);
                  if (!setting) return null;
                  return (
                    <View key={key} className="w-1/2 p-1">
                      <View
                        className={`rounded-2xl p-3 flex-row items-center ${
                          value ? 'bg-green-100' : 'bg-red-100'
                        }`}
                      >
                        <Text className="mr-2">{setting.emoji}</Text>
                        <Text
                          className={`text-sm font-medium ${
                            value ? 'text-green-800' : 'text-red-800'
                          }`}
                        >
                          {value
                            ? language === 'fr'
                              ? 'Activé'
                              : 'On'
                            : language === 'fr'
                              ? 'Désactivé'
                              : 'Off'}
                        </Text>
                      </View>
                    </View>
                  );
                })}
              </View>
            </View>
          </View>
          <View className="px-6 mb-8">
            <View className={`${cardBgColor} rounded-3xl p-6`}>
              <View className="flex-row items-center mb-4">
                <View
                  className="w-10 h-10 rounded-full items-center justify-center mr-3"
                  style={{ backgroundColor: '#f59e0b' + '20' }}
                >
                  <Ionicons name="options-outline" size={20} color="#f59e0b" />
                </View>
                <Text className={`text-lg font-bold ${textColor}`}>
                  {language === 'fr' ? 'Actions' : 'Actions'}
                </Text>
              </View>
              {actionButtons.map((button, index) => (
                <View key={button.id}>
                  <TouchableOpacity
                    onPress={button.onPress}
                    className="flex-row items-center py-4"
                  >
                    <Text className="text-xl mr-3">{button.emoji}</Text>
                    <Text className={`font-medium ${textColor} flex-1`}>
                      {button.title}
                    </Text>
                    <Ionicons name={button.icon} size={20} color={button.color} />
                  </TouchableOpacity>
                  {index < actionButtons.length - 1 && (
                    <View
                      className="h-px ml-12"
                      style={{ backgroundColor: isDarkMode ? '#374151' : '#e5e7eb' }}
                    />
                  )}
                </View>
              ))}
            </View>
          </View>
          <View className="px-6 mb-8">
            <View
              className="rounded-3xl p-4 items-center"
              style={{ backgroundColor: isDarkMode ? '#1f2937' : '#f8fafc' }}
            >
              <Ionicons
                name="shield-checkmark"
                size={24}
                color={isDarkMode ? '#60a5fa' : '#3b82f6'}
              />
              <Text className={`${secondaryTextColor} text-sm text-center mt-2`}>
                {language === 'fr'
                  ? 'Vos paramètres sont automatiquement sauvegardés'
                  : 'Your settings are automatically saved'}
              </Text>
            </View>
          </View>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}