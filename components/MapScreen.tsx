import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  SafeAreaView,
  StatusBar,
  Dimensions,
  Modal,
  Animated
} from 'react-native';
import MapView, { Marker, Polygon, PROVIDER_GOOGLE } from 'react-native-maps';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

type ZoneType = 'safe' | 'sport' | 'danger';
type LanguageType = 'fr' | 'en';

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

const { width, height } = Dimensions.get('window');

export default function MapScreen() {
  const [isDarkMode, setIsDarkMode] = useState<boolean>(false);
  const [language, setLanguage] = useState<LanguageType>('fr'); // fr or en
  const [userLocation, setUserLocation] = useState<UserLocation | null>(null);
  const [currentZone, setCurrentZone] = useState<ZoneType>('safe'); // safe, sport, danger
  const [showLegend, setShowLegend] = useState<boolean>(false);
  const [showQuickActions, setShowQuickActions] = useState<boolean>(false);
  const mapRef = useRef<MapView>(null);
  const legendAnimation = useRef(new Animated.Value(0)).current;
  const quickActionsAnimation = useRef(new Animated.Value(0)).current;
  const navigation = useNavigation<NavigationProp>();

  // Beach zones coordinates (example coordinates for Casablanca beach)
  const beachZones = {
    swimming: [
      {
        latitude: 33.5975,
        longitude: -7.6162,
      },
      {
        latitude: 33.5985,
        longitude: -7.6152,
      },
      {
        latitude: 33.5980,
        longitude: -7.6140,
      },
      {
        latitude: 33.5970,
        longitude: -7.6150,
      },
    ],
    sports: [
      {
        latitude: 33.5990,
        longitude: -7.6170,
      },
      {
        latitude: 33.6000,
        longitude: -7.6160,
      },
      {
        latitude: 33.5995,
        longitude: -7.6145,
      },
      {
        latitude: 33.5985,
        longitude: -7.6155,
      },
    ]
  };

  const initialRegion = {
    latitude: 33.5980,
    longitude: -7.6155,
    latitudeDelta: 0.005,
    longitudeDelta: 0.005,
  };

  useEffect(() => {
    getUserLocation();
  }, []);

  useEffect(() => {
    if (showLegend) {
      Animated.spring(legendAnimation, {
        toValue: 1,
        useNativeDriver: true,
        tension: 100,
        friction: 8,
      }).start();
    } else {
      Animated.spring(legendAnimation, {
        toValue: 0,
        useNativeDriver: true,
        tension: 100,
        friction: 8,
      }).start();
    }
  }, [showLegend]);

  useEffect(() => {
    if (showQuickActions) {
      Animated.spring(quickActionsAnimation, {
        toValue: 1,
        useNativeDriver: true,
        tension: 100,
        friction: 8,
      }).start();
    } else {
      Animated.spring(quickActionsAnimation, {
        toValue: 0,
        useNativeDriver: true,
        tension: 100,
        friction: 8,
      }).start();
    }
  }, [showQuickActions]);

  const getUserLocation = async () => {
    try {
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        console.log('Permission to access location was denied');
        return;
      }

      let location = await Location.getCurrentPositionAsync({});
      setUserLocation({
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
      });
      
      // Simulate zone detection based on location
      determineCurrentZone(location.coords);
    } catch (error) {
      console.log('Error getting location:', error);
    }
  };

  const determineCurrentZone = (coords: LocationCoords): void => {
    // Simple logic to determine which zone the user is in
    // In a real app, you'd use proper geofencing
    const { latitude, longitude } = coords;
    
    if (latitude >= 33.597 && latitude <= 33.599 && longitude >= -7.617 && longitude <= -7.614) {
      setCurrentZone('safe');
    } else if (latitude >= 33.598 && latitude <= 33.601 && longitude >= -7.618 && longitude <= -7.615) {
      setCurrentZone('sport');
    } else {
      setCurrentZone('danger');
    }
  };

  const centerMapOnUser = (): void => {
    if (userLocation && mapRef.current) {
      mapRef.current.animateToRegion({
        ...userLocation,
        latitudeDelta: 0.005,
        longitudeDelta: 0.005,
      }, 1000);
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

  const getZoneMessage = (): string => {
    const messages: Record<ZoneType, Record<LanguageType, string>> = {
      safe: {
        fr: 'Zone de baignade sécurisée',
        en: 'Safe swimming zone'
      },
      sport: {
        fr: 'Zone de sports nautiques',
        en: 'Water sports zone'
      },
      danger: {
        fr: 'Zone dangereuse - Évitez',
        en: 'Dangerous zone - Avoid'
      }
    };
    return messages[currentZone][language];
  };

  const getZoneIcon = (): string => {
    const icons: Record<ZoneType, string> = {
      safe: 'checkmark-circle',
      sport: 'fitness',
      danger: 'warning'
    };
    return icons[currentZone];
  };

  const getZoneColor = (): string => {
    const colors: Record<ZoneType, string> = {
      safe: '#10b981',
      sport: '#f59e0b',
      danger: '#ef4444'
    };
    return colors[currentZone];
  };

  const bgColor = isDarkMode ? '#111827' : '#ffffff';
  const textColor = isDarkMode ? '#ffffff' : '#111827';
  const cardBgColor = isDarkMode ? '#1f2937' : '#ffffff';

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: bgColor }}>
      <StatusBar
        barStyle={isDarkMode ? 'light-content' : 'dark-content'}
        backgroundColor={bgColor}
      />

      {/* Top Status Bar with Safety Button */}
      <View 
        style={{
          backgroundColor: cardBgColor,
          paddingHorizontal: 16,
          paddingVertical: 12,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.1,
          shadowRadius: 4,
          elevation: 3,
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
          <Ionicons
            name={getZoneIcon()}
            size={24}
            color={getZoneColor()}
            style={{ marginRight: 8 }}
          />
          <Text 
            style={{ 
              color: textColor, 
              fontSize: 16, 
              fontWeight: '600',
              flex: 1
            }}
            numberOfLines={1}
          >
            {getZoneMessage()}
          </Text>
        </View>
        
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          {/* Notification Settings Button */}
          <TouchableOpacity
            onPress={navigateToNotifications}
            style={{
              padding: 8,
              borderRadius: 20,
              backgroundColor: isDarkMode ? '#374151' : '#f3f4f6',
            }}
          >
            <Ionicons
              name="notifications-outline"
              size={20}
              color={isDarkMode ? '#ffffff' : '#6b7280'}
            />
          </TouchableOpacity>

          {/* Quick Safety Button in Header */}
          <TouchableOpacity
            onPress={navigateToSafety}
            style={{
              padding: 8,
              borderRadius: 20,
              backgroundColor: '#ef4444',
              flexDirection: 'row',
              alignItems: 'center',
              paddingHorizontal: 12,
            }}
          >
            <Ionicons name="shield-checkmark" size={16} color="#ffffff" />
            <Text style={{ color: '#ffffff', fontSize: 12, fontWeight: '600', marginLeft: 4 }}>
              {language === 'fr' ? 'Sécurité' : 'Safety'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => setIsDarkMode(!isDarkMode)}
            style={{
              padding: 8,
              borderRadius: 20,
              backgroundColor: isDarkMode ? '#374151' : '#f3f4f6',
            }}
          >
            <Ionicons
              name={isDarkMode ? 'sunny' : 'moon'}
              size={20}
              color={isDarkMode ? '#fbbf24' : '#6b7280'}
            />
          </TouchableOpacity>
        </View>
      </View>

      {/* Map */}
      <MapView
        ref={mapRef}
        style={{ flex: 1 }}
        provider={PROVIDER_GOOGLE}
        initialRegion={initialRegion}
        userInterfaceStyle={isDarkMode ? 'dark' : 'light'}
        showsUserLocation={true}
        showsMyLocationButton={false}
        followsUserLocation={false}
        customMapStyle={isDarkMode ? darkMapStyle : []}
      >
        {/* Swimming Zone */}
        <Polygon
          coordinates={beachZones.swimming}
          fillColor="rgba(59, 130, 246, 0.3)"
          strokeColor="#3b82f6"
          strokeWidth={2}
        />
        
        {/* Sports Zone */}
        <Polygon
          coordinates={beachZones.sports}
          fillColor="rgba(239, 68, 68, 0.3)"
          strokeColor="#ef4444"
          strokeWidth={2}
        />

        {/* User Location Marker (if available) */}
        {userLocation && (
          <Marker
            coordinate={userLocation}
            anchor={{ x: 0.5, y: 0.5 }}
          >
            <View
              style={{
                width: 20,
                height: 20,
                borderRadius: 10,
                backgroundColor: '#3b82f6',
                borderWidth: 3,
                borderColor: '#ffffff',
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.3,
                shadowRadius: 4,
                elevation: 5,
              }}
            />
          </Marker>
        )}
      </MapView>

      {/* Floating Action Buttons */}
      <View 
        style={{
          position: 'absolute',
          bottom: 120,
          right: 16,
          gap: 12,
        }}
      >
        <TouchableOpacity
          onPress={centerMapOnUser}
          style={{
            width: 56,
            height: 56,
            borderRadius: 28,
            backgroundColor: '#3b82f6',
            justifyContent: 'center',
            alignItems: 'center',
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.3,
            shadowRadius: 8,
            elevation: 8,
          }}
        >
          <Ionicons name="locate" size={24} color="#ffffff" />
        </TouchableOpacity>

        <TouchableOpacity
          onPress={toggleLegend}
          style={{
            width: 56,
            height: 56,
            borderRadius: 28,
            backgroundColor: cardBgColor,
            justifyContent: 'center',
            alignItems: 'center',
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.3,
            shadowRadius: 8,
            elevation: 8,
            borderWidth: isDarkMode ? 0 : 1,
            borderColor: '#e5e7eb',
          }}
        >
          <Ionicons 
            name="information-circle" 
            size={24} 
            color={isDarkMode ? '#ffffff' : '#374151'} 
          />
        </TouchableOpacity>

        {/* Main Action Button with expanding menu */}
        <TouchableOpacity
          onPress={toggleQuickActions}
          style={{
            width: 64,
            height: 64,
            borderRadius: 32,
            backgroundColor: '#10b981',
            justifyContent: 'center',
            alignItems: 'center',
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 6 },
            shadowOpacity: 0.3,
            shadowRadius: 12,
            elevation: 10,
          }}
        >
          <Ionicons 
            name={showQuickActions ? "close" : "menu"} 
            size={28} 
            color="#ffffff" 
          />
        </TouchableOpacity>
      </View>

      {/* Quick Actions Menu */}
      {showQuickActions && (
        <Animated.View
          style={{
            position: 'absolute',
            bottom: 200,
            right: 16,
            gap: 12,
            transform: [
              {
                scale: quickActionsAnimation.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0.8, 1],
                }),
              },
              {
                translateY: quickActionsAnimation.interpolate({
                  inputRange: [0, 1],
                  outputRange: [20, 0],
                }),
              },
            ],
            opacity: quickActionsAnimation,
          }}
        >
          <TouchableOpacity
            onPress={navigateToSafety}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              backgroundColor: '#ef4444',
              paddingVertical: 12,
              paddingHorizontal: 16,
              borderRadius: 24,
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.2,
              shadowRadius: 8,
              elevation: 6,
              minWidth: 140,
            }}
          >
            <Ionicons name="shield-checkmark-outline" size={20} color="#ffffff" />
            <Text style={{ color: '#ffffff', fontSize: 14, fontWeight: '600', marginLeft: 8 }}>
              {language === 'fr' ? 'Infos Sécurité' : 'Safety Info'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={navigateToNotifications}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              backgroundColor: '#8b5cf6',
              paddingVertical: 12,
              paddingHorizontal: 16,
              borderRadius: 24,
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.2,
              shadowRadius: 8,
              elevation: 6,
              minWidth: 140,
            }}
          >
            <Ionicons name="notifications-outline" size={20} color="#ffffff" />
            <Text style={{ color: '#ffffff', fontSize: 14, fontWeight: '600', marginLeft: 8 }}>
              {language === 'fr' ? 'Notifications' : 'Notifications'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              backgroundColor: '#f59e0b',
              paddingVertical: 12,
              paddingHorizontal: 16,
              borderRadius: 24,
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.2,
              shadowRadius: 8,
              elevation: 6,
              minWidth: 140,
            }}
          >
            <Ionicons name="call-outline" size={20} color="#ffffff" />
            <Text style={{ color: '#ffffff', fontSize: 14, fontWeight: '600', marginLeft: 8 }}>
              {language === 'fr' ? 'Urgence' : 'Emergency'}
            </Text>
          </TouchableOpacity>
        </Animated.View>
      )}

      {/* Stylish Bottom Safety Bar (Alternative Option) */}
      <View 
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          backgroundColor: cardBgColor,
          paddingHorizontal: 20,
          paddingVertical: 16,
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
          shadowColor: '#000',
          shadowOffset: { width: 0, height: -2 },
          shadowOpacity: 0.1,
          shadowRadius: 8,
          elevation: 8,
          borderTopWidth: 1,
          borderTopColor: isDarkMode ? '#374151' : '#f3f4f6',
        }}
      >
        <View style={{ flex: 1 }}>
          <Text style={{ color: textColor, fontSize: 12, opacity: 0.7 }}>
            {language === 'fr' ? 'Besoin d\'aide?' : 'Need help?'}
          </Text>
          <Text style={{ color: textColor, fontSize: 14, fontWeight: '600' }}>
            {language === 'fr' ? 'Consultez nos conseils de sécurité' : 'Check our safety guidelines'}
          </Text>
        </View>

        <TouchableOpacity
          onPress={navigateToSafety}
          style={{
            backgroundColor: '#3b82f6',
            paddingVertical: 10,
            paddingHorizontal: 20,
            borderRadius: 20,
            flexDirection: 'row',
            alignItems: 'center',
          }}
        >
          <Ionicons name="book-outline" size={16} color="#ffffff" />
          <Text style={{ color: '#ffffff', fontSize: 14, fontWeight: '600', marginLeft: 6 }}>
            {language === 'fr' ? 'Guide' : 'Guide'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Legend Modal */}
      {showLegend && (
        <View
          style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            justifyContent: 'flex-end',
          }}
        >
          <TouchableOpacity
            style={{ flex: 1 }}
            onPress={() => setShowLegend(false)}
          />
          
          <Animated.View
            style={{
              backgroundColor: cardBgColor,
              borderTopLeftRadius: 20,
              borderTopRightRadius: 20,
              paddingHorizontal: 20,
              paddingVertical: 24,
              shadowColor: '#000',
              shadowOffset: { width: 0, height: -4 },
              shadowOpacity: 0.1,
              shadowRadius: 8,
              elevation: 8,
              transform: [
                {
                  translateY: legendAnimation.interpolate({
                    inputRange: [0, 1],
                    outputRange: [300, 0],
                  }),
                },
              ],
            }}
          >
            <View 
              style={{
                width: 40,
                height: 4,
                backgroundColor: isDarkMode ? '#4b5563' : '#d1d5db',
                borderRadius: 2,
                alignSelf: 'center',
                marginBottom: 20,
              }}
            />

            <Text 
              style={{
                fontSize: 18,
                fontWeight: 'bold',
                color: textColor,
                marginBottom: 20,
                textAlign: 'center',
              }}
            >
              {language === 'fr' ? 'Légende des zones' : 'Zone Legend'}
            </Text>

            <View style={{ gap: 16 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <View
                  style={{
                    width: 20,
                    height: 20,
                    backgroundColor: '#3b82f6',
                    borderRadius: 4,
                    marginRight: 12,
                  }}
                />
                <Text style={{ color: textColor, fontSize: 16 }}>
                  {language === 'fr' 
                    ? 'Zone de baignade (sécurisée)' 
                    : 'Swimming zone (safe)'
                  }
                </Text>
              </View>

              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <View
                  style={{
                    width: 20,
                    height: 20,
                    backgroundColor: '#ef4444',
                    borderRadius: 4,
                    marginRight: 12,
                  }}
                />
                <Text style={{ color: textColor, fontSize: 16 }}>
                  {language === 'fr' 
                    ? 'Zone de sports nautiques (kite, windsurf)' 
                    : 'Water sports zone (kite, windsurf)'
                  }
                </Text>
              </View>
            </View>

            <View style={{ flexDirection: 'row', gap: 8, marginTop: 24 }}>
              <TouchableOpacity
                onPress={navigateToSafety}
                style={{
                  flex: 1,
                  backgroundColor: '#ef4444',
                  paddingVertical: 12,
                  borderRadius: 12,
                  alignItems: 'center',
                  flexDirection: 'row',
                  justifyContent: 'center',
                }}
              >
                <Ionicons name="shield-checkmark" size={16} color="#ffffff" />
                <Text style={{ color: '#ffffff', fontSize: 12, fontWeight: '600', marginLeft: 4 }}>
                  {language === 'fr' ? 'Sécurité' : 'Safety'}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={navigateToNotifications}
                style={{
                  flex: 1,
                  backgroundColor: '#8b5cf6',
                  paddingVertical: 12,
                  borderRadius: 12,
                  alignItems: 'center',
                  flexDirection: 'row',
                  justifyContent: 'center',
                }}
              >
                <Ionicons name="notifications" size={16} color="#ffffff" />
                <Text style={{ color: '#ffffff', fontSize: 12, fontWeight: '600', marginLeft: 4 }}>
                  {language === 'fr' ? 'Alertes' : 'Alerts'}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => setShowLegend(false)}
                style={{
                  flex: 1,
                  backgroundColor: '#3b82f6',
                  paddingVertical: 12,
                  borderRadius: 12,
                  alignItems: 'center',
                }}
              >
                <Text style={{ color: '#ffffff', fontSize: 12, fontWeight: '600' }}>
                  {language === 'fr' ? 'Fermer' : 'Close'}
                </Text>
              </TouchableOpacity>
            </View>
          </Animated.View>
        </View>
      )}
    </SafeAreaView>
  );
}

// Dark mode map style
const darkMapStyle = [
  {
    "elementType": "geometry",
    "stylers": [
      {
        "color": "#212121"
      }
    ]
  },
  {
    "elementType": "labels.icon",
    "stylers": [
      {
        "visibility": "off"
      }
    ]
  },
  {
    "elementType": "labels.text.fill",
    "stylers": [
      {
        "color": "#757575"
      }
    ]
  },
  {
    "elementType": "labels.text.stroke",
    "stylers": [
      {
        "color": "#212121"
      }
    ]
  },
  {
    "featureType": "administrative",
    "elementType": "geometry",
    "stylers": [
      {
        "color": "#757575"
      }
    ]
  },
  {
    "featureType": "administrative.country",
    "elementType": "labels.text.fill",
    "stylers": [
      {
        "color": "#9e9e9e"
      }
    ]
  },
  {
    "featureType": "administrative.locality",
    "elementType": "labels.text.fill",
    "stylers": [
      {
        "color": "#bdbdbd"
      }
    ]
  },
  {
    "featureType": "poi",
    "elementType": "labels.text.fill",
    "stylers": [
      {
        "color": "#757575"
      }
    ]
  },
  {
    "featureType": "poi.park",
    "elementType": "geometry",
    "stylers": [
      {
        "color": "#181818"
      }
    ]
  },
  {
    "featureType": "poi.park",
    "elementType": "labels.text.fill",
    "stylers": [
      {
        "color": "#616161"
      }
    ]
  },
  {
    "featureType": "poi.park",
    "elementType": "labels.text.stroke",
    "stylers": [
      {
        "color": "#1b1b1b"
      }
    ]
  },
  {
    "featureType": "road",
    "elementType": "geometry.fill",
    "stylers": [
      {
        "color": "#2c2c2c"
      }
    ]
  },
  {
    "featureType": "road",
    "elementType": "labels.text.fill",
    "stylers": [
      {
        "color": "#8a8a8a"
      }
    ]
  },
  {
    "featureType": "road.arterial",
    "elementType": "geometry",
    "stylers": [
      {
        "color": "#373737"
      }
    ]
  },
  {
    "featureType": "road.highway",
    "elementType": "geometry",
    "stylers": [
      {
        "color": "#3c3c3c"
      }
    ]
  },
  {
    "featureType": "road.highway.controlled_access",
    "elementType": "geometry",
    "stylers": [
      {
        "color": "#4e4e4e"
      }
    ]
  },
  {
    "featureType": "road.local",
    "elementType": "labels.text.fill",
    "stylers": [
      {
        "color": "#616161"
      }
    ]
  },
  {
    "featureType": "transit",
    "elementType": "labels.text.fill",
    "stylers": [
      {
        "color": "#757575"
      }
    ]
  },
  {
    "featureType": "water",
    "elementType": "geometry",
    "stylers": [
      {
        "color": "#000000"
      }
    ]
  },
  {
    "featureType": "water",
    "elementType": "labels.text.fill",
    "stylers": [
      {
        "color": "#3d3d3d"
      }
    ]
  }
];