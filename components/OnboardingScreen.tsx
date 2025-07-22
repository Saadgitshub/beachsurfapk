import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  StatusBar,
  Dimensions,
  Image
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const { width, height } = Dimensions.get('window');

export default function OnboardingScreen() {
  const [currentSlide, setCurrentSlide] = useState(0);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [language, setLanguage] = useState('fr'); // fr or en

  const slides = [
    {
      icon: 'location-outline',
      title: language === 'fr' ? 'Localisez-vous pour voir les zones' : 'Locate yourself to see zones',
      description: language === 'fr' 
        ? 'Découvrez les zones importantes autour de vous en temps réel'
        : 'Discover important zones around you in real time'
    },
    {
      icon: 'shield-checkmark-outline',
      title: language === 'fr' ? 'Restez dans la bonne zone pour votre sécurité' : 'Stay in the right zone for your safety',
      description: language === 'fr'
        ? 'Recevez des alertes pour rester en sécurité en permanence'
        : 'Receive alerts to stay safe at all times'
    },
    {
      icon: 'bulb-outline',
      title: language === 'fr' ? 'Recevez des conseils utiles chaque jour' : 'Get useful tips every day',
      description: language === 'fr'
        ? 'Des conseils personnalisés pour améliorer votre expérience'
        : 'Personalized tips to improve your experience'
    }
  ];

  const nextSlide = () => {
    if (currentSlide < slides.length - 1) {
      setCurrentSlide(currentSlide + 1);
    }
  };

  const prevSlide = () => {
    if (currentSlide > 0) {
      setCurrentSlide(currentSlide - 1);
    }
  };

  const toggleTheme = () => {
    setIsDarkMode(!isDarkMode);
  };

  const toggleLanguage = () => {
    setLanguage(language === 'fr' ? 'en' : 'fr');
  };

  const handleStart = () => {
    // Handle start button press - request location permissions, navigate to main app
    console.log('Starting app...');
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
      
      {/* Header with controls */}
      <View className="flex-row justify-between items-center px-6 py-4">
        <TouchableOpacity
          onPress={toggleTheme}
          className="p-2 rounded-full"
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

      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        {/* Logo and App Name */}
        <View className="items-center mt-2 mb-12">
          {/* TODO: Replace this View with your custom app icon/logo component */}
          {/* Example: <YourCustomIcon width={80} height={80} /> */}
          <Image source={require('../assets/beachsafelogo.png')} style={{width: 150, height: 150}} />
          <Text className={`text-base ${secondaryTextColor} mt-1`}>
            {language === 'fr' ? 'Votre sécurité, notre priorité' : 'Your safety, our priority'}
          </Text>
        </View>

        {/* Current Slide */}
        <View className="px-6 mb-8">
          <View className={`${cardBgColor} rounded-3xl p-8 items-center`}>
            <View
              className="w-24 h-24 rounded-full items-center justify-center mb-6"
              style={{ backgroundColor: iconColor + '20' }}
            >
              <Ionicons
                name={slides[currentSlide].icon}
                size={48}
                color={iconColor}
              />
            </View>
            
            <Text className={`text-xl font-bold ${textColor} text-center mb-4`}>
              {slides[currentSlide].title}
            </Text>
            
            <Text className={`text-base ${secondaryTextColor} text-center leading-6`}>
              {slides[currentSlide].description}
            </Text>
          </View>
        </View>

        {/* Slide Indicators */}
        <View className="flex-row justify-center mb-8">
          {slides.map((_, index) => (
            <TouchableOpacity
              key={index}
              onPress={() => setCurrentSlide(index)}
              className="mx-2"
            >
              <View
                className={`rounded-full ${
                  index === currentSlide ? 'w-8 h-3' : 'w-3 h-3'
                }`}
                style={{
                  backgroundColor: index === currentSlide 
                    ? iconColor 
                    : isDarkMode ? '#4b5563' : '#d1d5db',
                  ...(index === currentSlide && {
                    shadowColor: iconColor,
                    shadowOffset: { width: 0, height: 2 },
                    shadowOpacity: 0.4,
                    shadowRadius: 4,
                    elevation: 3,
                  }),
                }}
              />
            </TouchableOpacity>
          ))}
        </View>

        {/* Navigation */}
        <View className="px-6 mb-8">
          {currentSlide < slides.length - 1 ? (
            <View className="flex-row justify-between">
              <TouchableOpacity
                onPress={prevSlide}
                disabled={currentSlide === 0}
                className={`flex-1 mr-2 py-4 rounded-2xl items-center ${
                  currentSlide === 0
                    ? 'opacity-50'
                    : isDarkMode ? 'bg-gray-700' : 'bg-gray-100'
                }`}
                style={{
                  backgroundColor: currentSlide === 0 
                    ? (isDarkMode ? '#374151' : '#f3f4f6')
                    : (isDarkMode ? '#374151' : '#f3f4f6')
                }}
              >
                <Text className={`font-semibold ${secondaryTextColor}`}>
                  {language === 'fr' ? 'Précédent' : 'Previous'}
                </Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                onPress={nextSlide}
                className="flex-1 ml-2 py-4 rounded-2xl items-center"
                style={{ backgroundColor: iconColor }}
              >
                <Text className="font-semibold text-white">
                  {language === 'fr' ? 'Suivant' : 'Next'}
                </Text>
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity
              onPress={handleStart}
              className="py-4 rounded-2xl items-center"
              style={{ backgroundColor: iconColor }}
            >
              <View className="flex-row items-center">
                <Text className="font-bold text-white text-lg mr-2">
                  {language === 'fr' ? 'Commencer' : 'Get Started'}
                </Text>
                <Ionicons name="arrow-forward" size={20} color="white" />
              </View>
            </TouchableOpacity>
          )}
        </View>

        {/* Footer */}
        <View className="items-center pb-8">
          <Text className={`text-sm ${secondaryTextColor} text-center px-6`}>
            {language === 'fr'
              ? 'En continuant, vous acceptez nos conditions d\'utilisation et notre politique de confidentialité.'
              : 'By continuing, you agree to our terms of service and privacy policy.'
            }
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}