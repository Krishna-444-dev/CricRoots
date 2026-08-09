// iOS-specific testing utilities for the CricSync mobile application
import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { Button } from 'react-native-paper';
import { colors } from '../theme';
import IOSComponents from './ios-components';
import IOSNavigation from './ios-navigation';
import IOSAnimations from './ios-animations';

// Test screen for iOS-specific components
export const IOSComponentsTestScreen = ({ navigation }) => {
  return (
    <ScrollView style={styles.container}>
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>iOS Button Variants</Text>
        <IOSComponents.Button 
          title="Contained Button" 
          onPress={() => console.log('Contained button pressed')} 
          style={styles.buttonSpacing}
        />
        <IOSComponents.Button 
          title="Outlined Button" 
          mode="outlined"
          onPress={() => console.log('Outlined button pressed')} 
          style={styles.buttonSpacing}
        />
        <IOSComponents.Button 
          title="Text Button" 
          mode="text"
          onPress={() => console.log('Text button pressed')} 
          style={styles.buttonSpacing}
        />
        <IOSComponents.Button 
          title="Disabled Button" 
          disabled
          onPress={() => console.log('Disabled button pressed')} 
          style={styles.buttonSpacing}
        />
        <IOSComponents.Button 
          title="Loading Button" 
          loading
          onPress={() => console.log('Loading button pressed')} 
          style={styles.buttonSpacing}
        />
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>iOS Card Component</Text>
        <IOSComponents.Card style={styles.card}>
          <View style={styles.cardContent}>
            <Text style={styles.cardTitle}>iOS Card Title</Text>
            <Text style={styles.cardText}>This is an iOS-styled card component with rounded corners and subtle shadows that match iOS design patterns.</Text>
          </View>
        </IOSComponents.Card>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>iOS Text Input</Text>
        <IOSComponents.TextInput
          label="iOS Text Input"
          placeholder="Enter text here"
          style={styles.textInput}
        />
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>iOS Segmented Control</Text>
        <IOSComponents.SegmentedControl
          values={['Day', 'Week', 'Month']}
          selectedIndex={0}
          onChange={(index) => console.log('Selected index:', index)}
          style={styles.segmentedControl}
        />
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>iOS Action Sheet Buttons</Text>
        <IOSComponents.ActionSheetButton
          title="Default Action"
          onPress={() => console.log('Default action pressed')}
          style={styles.actionButton}
        />
        <IOSComponents.ActionSheetButton
          title="Destructive Action"
          destructive
          onPress={() => console.log('Destructive action pressed')}
          style={styles.actionButton}
        />
        <IOSComponents.ActionSheetButton
          title="Cancel"
          cancel
          onPress={() => console.log('Cancel pressed')}
          style={styles.actionButton}
        />
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>iOS Navigation Components</Text>
        <IOSNavigation.BackButton
          title="Back"
          onPress={() => console.log('Back button pressed')}
        />
        <View style={styles.headerContainer}>
          <Text style={styles.headerText}>iOS Header Example</Text>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>iOS Animations</Text>
        <Button 
          mode="contained" 
          onPress={() => navigation.navigate('IOSAnimationsTest')}
          style={styles.animationButton}
        >
          Test iOS Animations
        </Button>
      </View>

      <View style={styles.spacer} />
    </ScrollView>
  );
};

// Test screen for iOS-specific animations
export const IOSAnimationsTestScreen = () => {
  return (
    <ScrollView style={styles.container}>
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>iOS Fade In Animation</Text>
        <IOSAnimations.FadeIn duration={800}>
          <View style={styles.animationBox}>
            <Text style={styles.animationText}>Fade In</Text>
          </View>
        </IOSAnimations.FadeIn>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>iOS Slide In Animation</Text>
        <IOSAnimations.SlideIn direction="right" duration={800}>
          <View style={styles.animationBox}>
            <Text style={styles.animationText}>Slide In (Right)</Text>
          </View>
        </IOSAnimations.SlideIn>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>iOS Scale Animation</Text>
        <IOSAnimations.Scale duration={800}>
          <View style={styles.animationBox}>
            <Text style={styles.animationText}>Scale</Text>
          </View>
        </IOSAnimations.Scale>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>iOS Spring Animation</Text>
        <IOSAnimations.Spring duration={800}>
          <View style={styles.animationBox}>
            <Text style={styles.animationText}>Spring</Text>
          </View>
        </IOSAnimations.Spring>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>iOS Staggered List Animation</Text>
        <IOSAnimations.StaggeredList initialDelay={300}>
          {[1, 2, 3, 4, 5].map((item) => (
            <View key={item} style={styles.listItem}>
              <Text style={styles.listItemText}>List Item {item}</Text>
            </View>
          ))}
        </IOSAnimations.StaggeredList>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>iOS Pull to Refresh Animation</Text>
        <IOSAnimations.PullToRefreshIndicator refreshing={true} />
      </View>

      <View style={styles.spacer} />
    </ScrollView>
  );
};

// iOS-specific test navigation
export const IOSTestNavigator = () => {
  const Stack = createNativeStackNavigator();
  
  return (
    <Stack.Navigator>
      <Stack.Screen 
        name="IOSComponentsTest" 
        component={IOSComponentsTestScreen} 
        options={{ title: 'iOS Components Test' }}
      />
      <Stack.Screen 
        name="IOSAnimationsTest" 
        component={IOSAnimationsTestScreen} 
        options={{ title: 'iOS Animations Test' }}
      />
    </Stack.Navigator>
  );
};

// Styles
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9f9f9',
  },
  section: {
    marginHorizontal: 16,
    marginVertical: 12,
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 16,
  },
  buttonSpacing: {
    marginBottom: 12,
  },
  card: {
    marginVertical: 8,
  },
  cardContent: {
    padding: 16,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 8,
  },
  cardText: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  textInput: {
    marginVertical: 8,
  },
  segmentedControl: {
    marginVertical: 8,
  },
  actionButton: {
    marginVertical: 4,
  },
  headerContainer: {
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
    marginTop: 16,
  },
  headerText: {
    fontSize: 17,
    fontWeight: '600',
  },
  animationButton: {
    backgroundColor: colors.primary,
  },
  animationBox: {
    backgroundColor: colors.primary,
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  animationText: {
    color: 'white',
    fontWeight: '600',
  },
  listItem: {
    backgroundColor: 'white',
    padding: 16,
    borderRadius: 8,
    marginVertical: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 1,
  },
  listItemText: {
    fontSize: 16,
  },
  spacer: {
    height: 60,
  },
});

export default {
  ComponentsTestScreen: IOSComponentsTestScreen,
  AnimationsTestScreen: IOSAnimationsTestScreen,
  TestNavigator: IOSTestNavigator,
};
