// Forgot Password screen for the mobile application
import React, { useState } from 'react';
import { View, StyleSheet, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { TextInput, Button, Text, HelperText } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, commonStyles } from '../theme';

const ForgotPasswordScreen = ({ navigation }: any) => {
  const [email, setEmail] = useState('');
  const [emailError, setEmailError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  const validateEmail = (email: string) => {
    const re = /\S+@\S+\.\S+/;
    return re.test(email);
  };

  const handleResetPassword = async () => {
    // Reset errors and success
    setEmailError('');
    setError('');
    setSuccess(false);
    
    // Validate email
    let isValid = true;
    
    if (!email.trim()) {
      setEmailError('Email is required');
      isValid = false;
    } else if (!validateEmail(email)) {
      setEmailError('Please enter a valid email address');
      isValid = false;
    }
    
    if (isValid) {
      setIsLoading(true);
      
      try {
        // In a real app, this would call an API endpoint
        // await api.auth.resetPassword(email);
        
        // Simulate API call
        await new Promise(resolve => setTimeout(resolve, 1500));
        
        setSuccess(true);
      } catch (error) {
        console.error('Reset password error:', error);
        setError('Failed to send reset password email. Please try again.');
      } finally {
        setIsLoading(false);
      }
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardAvoidingView}
      >
        <ScrollView contentContainerStyle={styles.scrollView}>
          <View style={styles.headerContainer}>
            <Text style={styles.headerTitle}>Forgot Password</Text>
            <Text style={styles.headerSubtitle}>
              Enter your email address and we'll send you instructions to reset your password.
            </Text>
          </View>
          
          {success ? (
            <View style={styles.successContainer}>
              <Text style={styles.successText}>
                Password reset email sent! Please check your inbox and follow the instructions.
              </Text>
              <Button
                mode="contained"
                onPress={() => navigation.navigate('Login')}
                style={styles.backToLoginButton}
              >
                Back to Login
              </Button>
            </View>
          ) : (
            <View style={styles.formContainer}>
              <TextInput
                label="Email"
                value={email}
                onChangeText={(text) => {
                  setEmail(text);
                  if (emailError) setEmailError('');
                  if (error) setError('');
                }}
                mode="outlined"
                keyboardType="email-address"
                autoCapitalize="none"
                style={commonStyles.textInput}
                error={!!emailError}
              />
              {emailError ? <HelperText type="error">{emailError}</HelperText> : null}
              
              {error ? <Text style={styles.errorText}>{error}</Text> : null}
              
              <Button
                mode="contained"
                onPress={handleResetPassword}
                style={styles.resetButton}
                loading={isLoading}
                disabled={isLoading}
              >
                Reset Password
              </Button>
              
              <Button
                mode="text"
                onPress={() => navigation.navigate('Login')}
                style={styles.backButton}
              >
                Back to Login
              </Button>
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  keyboardAvoidingView: {
    flex: 1,
  },
  scrollView: {
    flexGrow: 1,
    padding: 16,
  },
  headerContainer: {
    marginTop: 24,
    marginBottom: 24,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: colors.primary,
  },
  headerSubtitle: {
    fontSize: 16,
    color: colors.textSecondary,
    marginTop: 8,
  },
  formContainer: {
    width: '100%',
  },
  resetButton: {
    marginTop: 16,
    backgroundColor: colors.primary,
  },
  backButton: {
    marginTop: 8,
  },
  errorText: {
    color: colors.error,
    textAlign: 'center',
    marginTop: 8,
  },
  successContainer: {
    padding: 16,
    backgroundColor: colors.success + '20', // 20% opacity
    borderRadius: 8,
    marginBottom: 16,
  },
  successText: {
    color: colors.success,
    textAlign: 'center',
    marginBottom: 16,
  },
  backToLoginButton: {
    backgroundColor: colors.primary,
  },
});

export default ForgotPasswordScreen;
