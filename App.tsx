import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import OnboardingScreen from 'components/OnboardingScreen';
import MapScreen from 'components/MapScreen';
import BeachSafetyScreen from 'components/BeachSafety';
import NotificationSettingsScreen from 'components/NotificationSettingsScreen';
import './global.css';

const Stack = createNativeStackNavigator();

export default function App() {
  return (
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
  );
}