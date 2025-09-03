import React, { useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { SettingsProvider } from './SettingsContext';
import OnboardingScreen from './components/OnboardingScreen';
import MapScreen from './components/MapScreen';
import BeachSafetyScreen from './components/BeachSafety';
import NotificationSettingsScreen from './components/NotificationSettingsScreen';
import * as TaskManager from 'expo-task-manager';
import * as Location from 'expo-location';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { Platform, Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import './global.css';

const LOCATION_TASK_NAME = 'location-task';

interface BeachAlert {
  id: number;
  type: string;
  message: string;
  beachId: number;
  zoneId?: number;
}

TaskManager.defineTask(LOCATION_TASK_NAME, async ({ data, error }) => {
  if (error) {
    console.error('Location task error:', error);
    return;
  }
  const { locations } = data as { locations: Location.LocationObject[] };
  console.log('Received background location:', locations);
  const { latitude, longitude } = locations[0].coords;
  const deviceId = Constants.installationId || `test-device-${Math.random().toString(36).substring(2, 8)}`;
  const BASE_URL = 'http://192.168.1.11:8080';

  try {
    const updateResponse = await fetch(`${BASE_URL}/api/users/update-location`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify({
        deviceId,
        latitude,
        longitude,
      }),
    });
    if (!updateResponse.ok) {
      console.error('Failed to update user location:', updateResponse.status);
      return;
    }

    const checkResponse = await fetch(`${BASE_URL}/api/users/check-location`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify({
        deviceId,
        latitude,
        longitude,
      }),
    });
    const responseText = await checkResponse.text();
    if (!checkResponse.ok) {
      console.error('Failed to check zone:', checkResponse.status);
      return;
    }
    const result = JSON.parse(responseText);
    if (result.inside) {
      const alertsResponse = await fetch(`${BASE_URL}/api/alerts/beach/${result.beachId}`, {
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      });
      if (alertsResponse.ok) {
        const alerts: BeachAlert[] = await alertsResponse.json();
        const alert = alerts.find(a => a.zoneId === result.zoneId && a.type.toUpperCase() === result.zoneType.toUpperCase());
        if (alert) {
          await AsyncStorage.setItem('latestAlert', JSON.stringify({
            message: `${result.beachName}: ${alert.message}`,
            zoneType: result.zoneType,
            zoneId: result.zoneId,
            beachId: result.beachId,
          }));
          await Notifications.scheduleNotificationAsync({
            content: {
              title: 'Beach Safety Alert',
              body: `${result.beachName}: ${alert.message}`,
              sound: 'default',
              vibrate: [0, 300],
            },
            trigger: null,
          });
        } else {
          await AsyncStorage.setItem('latestAlert', JSON.stringify({
            message: `${result.beachName}: No active alerts`,
            zoneType: result.zoneType,
            zoneId: result.zoneId,
            beachId: result.beachId,
          }));
        }
      }
    } else {
      await AsyncStorage.setItem('latestAlert', JSON.stringify({
        message: 'No beach zones nearby',
        zoneType: 'unknown',
        zoneId: null,
        beachId: null,
      }));
    }
  } catch (err) {
    console.error('Background task error:', err);
  }
});

type RootStackParamList = {
  Onboarding: undefined;
  Map: undefined;
  BeachSafety: undefined;
  NotificationSettings: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function App() {
  useEffect(() => {
    (async () => {
      try {
        if (!Device.isDevice) {
          console.warn('Notifications require a physical device');
          return;
        }

        // Wrap notification-related code to suppress Firebase errors
        try {
          if (Platform.OS === 'android') {
            await Notifications.setNotificationChannelAsync('beach-safety-channel', {
              name: 'Beach Safety Notifications',
              importance: Notifications.AndroidImportance.HIGH,
              sound: 'default',
              vibrationPattern: [0, 300],
            });
          }

          Notifications.setNotificationHandler({
            handleNotification: async () => ({
              shouldShowAlert: true,
              shouldPlaySound: true,
              shouldSetBadge: true,
              shouldShowBanner: true,
              shouldShowList: true,
            }),
          });

          const { status: notifStatus } = await Notifications.requestPermissionsAsync();
          if (notifStatus !== 'granted') {
            console.warn('Notification permission denied');
            Alert.alert('Permission Denied', 'Please enable notifications in settings.');
          }

          const projectId = Constants.expoConfig?.extra?.eas?.projectId;
          if (projectId) {
            const token = await Notifications.getExpoPushTokenAsync({ projectId });
            console.log('Expo push token:', token);
          } else {
            console.warn('Project ID not found in app.json');
          }
        } catch (error) {
          console.warn('Notification setup suppressed:', error);
          // Silently suppress Firebase-related errors
        }

        const { status: fgStatus } = await Location.requestForegroundPermissionsAsync();
        if (fgStatus !== 'granted') {
          console.warn('Foreground location permission denied');
          Alert.alert('Permission Denied', 'Please enable location permissions in settings.');
          return;
        }

        const { status: bgStatus } = await Location.requestBackgroundPermissionsAsync();
        if (bgStatus !== 'granted') {
          console.warn('Background location permission denied');
          Alert.alert('Permission Denied', 'Please enable background location in settings.');
          return;
        }

        if (await TaskManager.isTaskRegisteredAsync(LOCATION_TASK_NAME)) {
          await Location.stopLocationUpdatesAsync(LOCATION_TASK_NAME);
        }

        await Location.startLocationUpdatesAsync(LOCATION_TASK_NAME, {
          accuracy: Location.Accuracy.High,
          distanceInterval: 10,
          foregroundService: {
            notificationTitle: 'Beach Safety',
            notificationBody: 'Tracking your location for safety alerts.',
          },
        });
      } catch (error) {
        console.error('Initialization error:', error);
        Alert.alert('Error', 'Failed to initialize app: ' + (error as Error).message);
      }
    })();
  }, []);

  return (
    <SettingsProvider>
      <NavigationContainer>
        <Stack.Navigator initialRouteName="Onboarding">
          <Stack.Screen
            name="Onboarding"
            component={OnboardingScreen}
            options={{ headerShown: false }}
          />
          <Stack.Screen
            name="Map"
            component={MapScreen}
            options={{ headerShown: false }}
          />
          <Stack.Screen
            name="BeachSafety"
            component={BeachSafetyScreen}
            options={{ headerShown: false }}
          />
          <Stack.Screen
            name="NotificationSettings"
            component={NotificationSettingsScreen}
            options={{ headerShown: false }}
          />
        </Stack.Navigator>
      </NavigationContainer>
    </SettingsProvider>
  );
}