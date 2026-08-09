# CricSync Mobile Application Installation and Testing Guide

This guide provides detailed instructions for installing and testing the CricSync mobile application on both iOS and Android devices.

## Table of Contents
1. [iOS Installation and Testing](#ios-installation-and-testing)
2. [Android Installation and Testing](#android-installation-and-testing)
3. [Expo Go Quick Testing](#expo-go-quick-testing)
4. [Troubleshooting](#troubleshooting)
5. [Testing Guidelines](#testing-guidelines)

## iOS Installation and Testing

### Prerequisites
- An Apple Developer account ($99/year)
- A Mac computer with Xcode 15 or later installed
- An iOS device running iOS 16 or later
- TestFlight app installed on your iOS device

### Step 1: Prepare the App for Distribution

1. Clone the repository and navigate to the project directory:
   ```bash
   git clone https://github.com/your-repo/cricsync.git
   cd cricsync/mobile-app/CricketApp-manual
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Generate the iOS project files:
   ```bash
   npx expo prebuild --platform ios
   ```

4. Install CocoaPods dependencies:
   ```bash
   cd ios
   pod install
   cd ..
   ```

5. Open the Xcode project:
   ```bash
   open ios/CricketApp.xcworkspace
   ```

### Step 2: Configure Signing in Xcode

1. In Xcode, select the project in the Project Navigator
2. Select the "CricketApp" target
3. Go to the "Signing & Capabilities" tab
4. Select your Team (Apple Developer account)
5. Ensure "Automatically manage signing" is checked
6. Verify that a provisioning profile is generated

### Step 3: Archive and Upload to App Store Connect

1. In Xcode, select "Generic iOS Device" as the build destination
2. Select Product > Archive from the menu
3. When archiving completes, the Organizer window will appear
4. Click "Distribute App"
5. Select "App Store Connect" and click "Next"
6. Choose "Upload" and click "Next"
7. Select options for distribution and click "Next"
8. Review the information and click "Upload"
9. Wait for the upload to complete (15-30 minutes for processing)

### Step 4: Configure TestFlight

1. Log in to [App Store Connect](https://appstoreconnect.apple.com)
2. Navigate to "Apps" and select your app
3. Click on the "TestFlight" tab
4. Under "Testers and Groups", click "Internal Testing"
5. Click the "+" button to add testers
6. Enter the Apple ID email addresses of your testers
7. Click "Add" to send invitations

### Step 5: Install on Your iOS Device

1. On your iOS device, check your email for a TestFlight invitation
2. Tap the invitation link in the email
3. The TestFlight app will open
4. Tap "Accept" to accept the invitation
5. Tap "Install" to install the CricSync app
6. The app will be installed on your home screen
7. Open the app and begin testing

## Android Installation and Testing

### Prerequisites
- Android Studio installed on your computer
- An Android device running Android 8.0 (API level 26) or later
- USB debugging enabled on your Android device

### Step 1: Generate an APK

1. Clone the repository and navigate to the project directory:
   ```bash
   git clone https://github.com/your-repo/cricsync.git
   cd cricsync/mobile-app/CricketApp-manual
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Generate the Android project files:
   ```bash
   npx expo prebuild --platform android
   ```

4. Build the release APK:
   ```bash
   cd android
   ./gradlew assembleRelease
   ```

5. The APK will be generated at:
   ```
   android/app/build/outputs/apk/release/app-release.apk
   ```

### Step 2: Enable Installation from Unknown Sources

1. On your Android device, go to Settings
2. Navigate to Security or Privacy (varies by device)
3. Find and enable "Install from Unknown Sources" or "Install Unknown Apps"
4. If prompted to select an app, choose your file manager or browser

### Step 3: Transfer and Install the APK

#### Option 1: Using a File Sharing Service

1. Upload the APK to Google Drive, Dropbox, or similar service
2. On your Android device, download the APK from the service
3. Tap the downloaded APK file
4. Follow the prompts to install the app

#### Option 2: Using USB Transfer

1. Connect your Android device to your computer via USB
2. Enable file transfer mode on your device if prompted
3. Copy the APK file to your device's storage
4. On your device, use a file manager to navigate to the APK
5. Tap the APK file and follow the prompts to install

#### Option 3: Using ADB (Advanced)

1. Connect your Android device to your computer via USB
2. Enable USB debugging on your device
3. Open a terminal or command prompt
4. Navigate to the directory containing the APK
5. Run the following command:
   ```bash
   adb install app-release.apk
   ```

### Step 4: Launch and Test

1. Once installed, the CricSync app will appear on your home screen
2. Tap the icon to launch the app
3. Begin testing according to the test plan

## Expo Go Quick Testing

For rapid development testing without building native binaries:

### Prerequisites
- Expo Go app installed on your iOS or Android device
- Your device and development computer on the same network

### Step 1: Start the Expo Development Server

1. Navigate to the project directory:
   ```bash
   cd cricsync/mobile-app/CricketApp-manual
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Start the Expo development server:
   ```bash
   npx expo start
   ```

4. A QR code will be displayed in the terminal

### Step 2: Connect Your Device

#### For iOS:
1. Open the Camera app on your iOS device
2. Point it at the QR code in the terminal
3. Tap the notification that appears
4. The app will open in Expo Go

#### For Android:
1. Open the Expo Go app on your Android device
2. Tap "Scan QR Code"
3. Scan the QR code in the terminal
4. The app will open in Expo Go

### Step 3: Development Testing

1. The app will load in Expo Go
2. Changes made to the code will automatically reload
3. Shake your device to open the developer menu
4. Use the developer menu for debugging options

## Troubleshooting

### iOS Installation Issues

| Issue | Solution |
|-------|----------|
| "Untrusted Developer" error | Go to Settings > General > Profiles & Device Management, then trust the developer |
| TestFlight invitation not received | Check spam folder, verify email address in App Store Connect |
| App crashes on launch | Check device logs in Xcode, verify minimum iOS version |
| Provisioning profile errors | Refresh provisioning profiles in Xcode, verify Apple Developer account status |

### Android Installation Issues

| Issue | Solution |
|-------|----------|
| "App not installed" error | Check device storage space, verify Android version compatibility |
| APK not downloading | Try a different browser or file sharing service |
| Installation blocked | Verify "Install from Unknown Sources" is enabled for the correct app |
| App crashes on launch | Check logcat output, verify minimum Android version |

### Expo Go Issues

| Issue | Solution |
|-------|----------|
| QR code not scanning | Ensure good lighting, try manual entry of the Expo URL |
| Connection errors | Verify devices are on the same network, check firewall settings |
| JS bundle not loading | Restart Expo server, clear cache with `expo start -c` |
| Metro bundler errors | Delete node_modules and reinstall dependencies |

## Testing Guidelines

When testing the CricSync application, focus on these key areas:

### Functional Testing
- Team creation and management
- Player registration
- Match scoring functionality
- Tournament management
- Marketplace browsing and checkout
- Communication features

### Performance Testing
- App launch time
- Screen transition smoothness
- Scrolling performance in lists
- Image loading speed
- Network request handling

### UI/UX Testing
- Verify all UI elements are properly sized and positioned
- Test on different screen sizes
- Check dark/light mode if implemented
- Verify text is readable and not truncated
- Test accessibility features

### Device-Specific Testing
- Test on both phones and tablets
- Verify orientation changes work correctly
- Test with different system font sizes
- Check behavior with system interruptions (calls, notifications)

### Reporting Issues
When reporting issues, include:
1. Device model and OS version
2. Steps to reproduce
3. Expected behavior
4. Actual behavior
5. Screenshots or screen recordings
6. Crash logs if applicable

Submit issues through the project's issue tracking system or directly to the development team.

---

For additional support or questions about the installation and testing process, please contact the development team at support@cricsync.com.
