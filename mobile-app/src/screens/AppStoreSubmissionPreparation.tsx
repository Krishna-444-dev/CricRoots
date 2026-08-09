// App Store submission preparation for the CricSync mobile application
import React from 'react';
import { View, ScrollView, StyleSheet, Image, TouchableOpacity } from 'react-native';
import { Text, Divider } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from '../theme';
import { PlatformCard, PlatformButton } from '../IntegratedApp';

const AppStoreSubmissionPreparation = () => {
  const insets = useSafeAreaInsets();
  
  // App Store submission requirements
  const requirements = [
    {
      id: '1',
      title: 'App Icon Set',
      description: 'Create app icons in all required sizes for iOS',
      status: 'Completed',
      details: 'App icons created in 20x20, 29x29, 40x40, 60x60, 76x76, 83.5x83.5, and 1024x1024 sizes with proper scaling for different display densities.'
    },
    {
      id: '2',
      title: 'App Store Screenshots',
      description: 'Create screenshots for all required device sizes',
      status: 'In Progress',
      details: 'Screenshots needed for iPhone (5.5", 6.5", and 6.7" displays) and iPad (12.9" display) in portrait and landscape orientations.'
    },
    {
      id: '3',
      title: 'App Store Listing',
      description: 'Prepare app metadata for App Store listing',
      status: 'In Progress',
      details: 'Need to prepare app name, subtitle, description, keywords, support URL, marketing URL, and privacy policy URL.'
    },
    {
      id: '4',
      title: 'App Privacy',
      description: 'Complete App Privacy questionnaire',
      status: 'Not Started',
      details: 'Need to identify all data types collected by the app and how they are used.'
    },
    {
      id: '5',
      title: 'Export Compliance',
      description: 'Complete export compliance documentation',
      status: 'Not Started',
      details: 'Need to determine if the app uses encryption and if it qualifies for exemptions.'
    },
    {
      id: '6',
      title: 'Content Rights',
      description: 'Verify all content rights',
      status: 'In Progress',
      details: 'Need to ensure all content (images, text, etc.) is either original or properly licensed.'
    },
    {
      id: '7',
      title: 'Age Rating',
      description: 'Complete age rating questionnaire',
      status: 'Not Started',
      details: 'Need to determine appropriate age rating based on app content.'
    },
    {
      id: '8',
      title: 'TestFlight Setup',
      description: 'Configure TestFlight for beta testing',
      status: 'Not Started',
      details: 'Need to set up TestFlight and add beta testers.'
    }
  ];
  
  // App Store assets
  const assets = [
    {
      id: '1',
      title: 'App Icon',
      description: '1024x1024 App Icon',
      status: 'Completed',
      path: '/assets/app-icon.png'
    },
    {
      id: '2',
      title: 'iPhone Screenshots',
      description: '6.5" iPhone Screenshots',
      status: 'In Progress',
      path: '/assets/iphone-screenshots/'
    },
    {
      id: '3',
      title: 'iPad Screenshots',
      description: '12.9" iPad Screenshots',
      status: 'Not Started',
      path: '/assets/ipad-screenshots/'
    },
    {
      id: '4',
      title: 'App Preview Video',
      description: '30-second App Preview Video',
      status: 'Not Started',
      path: '/assets/app-preview.mp4'
    },
    {
      id: '5',
      title: 'Promotional Text',
      description: 'Promotional text for App Store',
      status: 'In Progress',
      path: '/assets/promotional-text.txt'
    }
  ];
  
  // Render status badge
  const renderStatusBadge = (status) => {
    let backgroundColor;
    let textColor;
    
    switch (status) {
      case 'Completed':
        backgroundColor = '#e6f7ed';
        textColor = '#00a651';
        break;
      case 'In Progress':
        backgroundColor = '#e6f0f7';
        textColor = '#0078d4';
        break;
      case 'Not Started':
        backgroundColor = '#f7e6e6';
        textColor = '#d40000';
        break;
      default:
        backgroundColor = '#f0f0f0';
        textColor = '#666666';
    }
    
    return (
      <View style={[styles.statusBadge, { backgroundColor }]}>
        <Text style={[styles.statusText, { color: textColor }]}>{status}</Text>
      </View>
    );
  };
  
  return (
    <ScrollView 
      style={[styles.container, { paddingTop: insets.top > 0 ? 0 : 16 }]}
      contentInsetAdjustmentBehavior="automatic"
    >
      {/* Header Section */}
      <View style={styles.headerSection}>
        <Text style={styles.headerTitle}>App Store Submission</Text>
        <Text style={styles.headerSubtitle}>Preparation Checklist</Text>
      </View>
      
      {/* Requirements Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Submission Requirements</Text>
        <Text style={styles.sectionDescription}>
          Complete the following requirements before submitting to the App Store.
        </Text>
        
        {requirements.map((item) => (
          <PlatformCard key={item.id} style={styles.card}>
            <View style={styles.cardHeader}>
              <Text style={styles.cardTitle}>{item.title}</Text>
              {renderStatusBadge(item.status)}
            </View>
            <Text style={styles.cardDescription}>{item.description}</Text>
            <Divider style={styles.divider} />
            <Text style={styles.cardDetails}>{item.details}</Text>
            <View style={styles.cardActions}>
              <PlatformButton
                title={item.status === 'Completed' ? 'View' : 'Complete'}
                mode={item.status === 'Completed' ? 'outlined' : 'contained'}
                onPress={() => {}}
                style={styles.cardButton}
              />
            </View>
          </PlatformCard>
        ))}
      </View>
      
      {/* Assets Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>App Store Assets</Text>
        <Text style={styles.sectionDescription}>
          Prepare the following assets for your App Store listing.
        </Text>
        
        {assets.map((item) => (
          <PlatformCard key={item.id} style={styles.card}>
            <View style={styles.cardHeader}>
              <Text style={styles.cardTitle}>{item.title}</Text>
              {renderStatusBadge(item.status)}
            </View>
            <Text style={styles.cardDescription}>{item.description}</Text>
            <Divider style={styles.divider} />
            <Text style={styles.cardDetails}>Path: {item.path}</Text>
            <View style={styles.cardActions}>
              <PlatformButton
                title={item.status === 'Completed' ? 'View' : 'Create'}
                mode={item.status === 'Completed' ? 'outlined' : 'contained'}
                onPress={() => {}}
                style={styles.cardButton}
              />
            </View>
          </PlatformCard>
        ))}
      </View>
      
      {/* Submission Button */}
      <View style={styles.submissionSection}>
        <PlatformButton
          title="Prepare for Submission"
          mode="contained"
          onPress={() => {}}
          style={styles.submissionButton}
        />
        <Text style={styles.submissionNote}>
          Note: All requirements must be completed before submission.
        </Text>
      </View>
      
      {/* Bottom Spacer */}
      <View style={{ height: 20 }} />
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9f9f9',
  },
  headerSection: {
    paddingHorizontal: 16,
    paddingVertical: 24,
    backgroundColor: colors.primary,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: 'white',
    marginBottom: 8,
  },
  headerSubtitle: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.8)',
  },
  section: {
    paddingHorizontal: 16,
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: 8,
  },
  sectionDescription: {
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: 16,
  },
  card: {
    marginBottom: 16,
    borderRadius: 12,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
    padding: 16,
    paddingBottom: 8,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '500',
  },
  cardDescription: {
    fontSize: 14,
    color: colors.textSecondary,
    paddingHorizontal: 16,
  },
  divider: {
    marginVertical: 12,
  },
  cardDetails: {
    fontSize: 14,
    color: colors.text,
    paddingHorizontal: 16,
    paddingTop: 4,
  },
  cardActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    padding: 16,
    paddingTop: 12,
  },
  cardButton: {
    minWidth: 100,
  },
  submissionSection: {
    paddingHorizontal: 16,
    marginBottom: 24,
    alignItems: 'center',
  },
  submissionButton: {
    width: '100%',
    marginBottom: 12,
  },
  submissionNote: {
    fontSize: 12,
    color: colors.textSecondary,
    textAlign: 'center',
  },
});

export default AppStoreSubmissionPreparation;
