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
import './global.css';

const LOCATION_TASK_NAME = 'location-task';

type RootStackParamList = {
  Onboarding: undefined;
  Map: undefined;
  BeachSafety: undefined;
  NotificationSettings: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

// Define the location task for background location updates
TaskManager.defineTask(LOCATION_TASK_NAME, async ({ data, error }) => {
  if (error) {
    console.error('Location task error:', error);
    return;
  }
  const { locations } = data as { locations: Location.LocationObject[] };
  console.log('Received location:', locations);
  const essaouiraCoords = { latitude: 31.5085, longitude: -9.7595 };
  const { latitude, longitude } = locations[0].coords;
  const distance = Math.sqrt(
    Math.pow(latitude - essaouiraCoords.latitude, 2) +
    Math.pow(longitude - essaouiraCoords.longitude, 2)
  );
  if (distance < 0.01) {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: 'Beach Safety Alert',
        body: 'You are near Essaouira Beach. Stay safe!',
        sound: 'default',
        vibrate: [0, 300],
      },
      trigger: null,
    });
  }
});

export default function App() {
  useEffect(() => {
    (async () => {
      try {
        if (!Device.isDevice) {
          console.warn('Notifications require a physical device');
          return;
        }

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
          distanceInterval: 10, // Update every 10 meters
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