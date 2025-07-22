import { NavigationAction, NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import OnboardingScreen from 'components/OnboardingScreen';

import './global.css';

const Stack = createNativeStackNavigator();


export default function App() {
  return (
    <NavigationContainer>
        <Stack.Navigator>
          <Stack.Screen name="Home" component={OnboardingScreen} options={{headerShown: false}}/>
        </Stack.Navigator>
    </NavigationContainer>
  );
}
