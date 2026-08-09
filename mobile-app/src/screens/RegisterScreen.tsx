// Registration screen for the mobile application
import React, { useState } from 'react';
import { View, StyleSheet, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { TextInput, Button, Text, HelperText } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../hooks/useAuth';
import { colors, commonStyles } from '../theme';

const RegisterScreen = ({ navigation }) => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [nameError, setNameError] = useState('');
  const [emailError, setEmailError] = useState('');
  const [phoneError, setPhoneError] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [confirmPasswordError, setConfirmPasswordError] = useState('');
  
  const { register, isLoading, error, clearError } = useAuth();

  const validateEmail = (email) => {
    const re = /\S+@\S+\.\S+/;
    return re.test(email);
  };

  const validatePhone = (phone) => {
    const re = /^\d{10}$/;
    return re.test(phone);
  };

  const handleRegister = async () => {
    // Reset errors
    setNameError('');
    setEmailError('');
    setPhoneError('');
    setPasswordError('');
    setConfirmPasswordError('');
    clearError();
    
    // Validate inputs
    let isValid = true;
    
    if (!name.trim()) {
      setNameError('Name is required');
      isValid = false;
    }
    
    if (!email.trim()) {
      setEmailError('Email is required');
      isValid = false;
    } else if (!validateEmail(email)) {
      setEmailError('Please enter a valid email address');
      isValid = false;
    }
    
    if (phone && !validatePhone(phone)) {
      setPhoneError('Please enter a valid 10-digit phone number');
      isValid = false;
    }
    
    if (!password.trim()) {
      setPasswordError('Password is required');
      isValid = false;
    } else if (password.length < 6) {
      setPasswordError('Password must be at least 6 characters');
      isValid = false;
    }
    
    if (password !== confirmPassword) {
      setConfirmPasswordError('Passwords do not match');
      isValid = false;
    }
    
    if (isValid) {
      try {
        const userData = {
          name,
          email,
          phone: phone || undefined,
          role: 'Player',
          teams: []
        };
        
        await register(userData, password);
        // Navigation will be handled by the auth state change
      } catch (error) {
        console.error('Registration error:', error);
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
            <Text style={styles.headerTitle}>Create Account</Text>
            <Text style={styles.headerSubtitle}>Join CricSync today</Text>
          </View>
          
          <View style={styles.formContainer}>
            <TextInput
              label="Full Name"
              value={name}
              onChangeText={setName}
              mode="outlined"
              style={commonStyles.textInput}
              error={!!nameError}
            />
            {nameError ? <HelperText type="error">{nameError}</HelperText> : null}
            
            <TextInput
              label="Email"
              value={email}
              onChangeText={setEmail}
              mode="outlined"
              keyboardType="email-address"
              autoCapitalize="none"
              style={commonStyles.textInput}
              error={!!emailError}
            />
            {emailError ? <HelperText type="error">{emailError}</HelperText> : null}
            
            <TextInput
              label="Phone (optional)"
              value={phone}
              onChangeText={setPhone}
              mode="outlined"
              keyboardType="phone-pad"
              style={commonStyles.textInput}
              error={!!phoneError}
            />
            {phoneError ? <HelperText type="error">{phoneError}</HelperText> : null}
            
            <TextInput
              label="Password"
              value={password}
              onChangeText={setPassword}
              mode="outlined"
              secureTextEntry
              style={commonStyles.textInput}
              error={!!passwordError}
            />
            {passwordError ? <HelperText type="error">{passwordError}</HelperText> : null}
            
            <TextInput
              label="Confirm Password"
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              mode="outlined"
              secureTextEntry
              style={commonStyles.textInput}
              error={!!confirmPasswordError}
            />
            {confirmPasswordError ? <HelperText type="error">{confirmPasswordError}</HelperText> : null}
            
            {error ? <Text style={styles.errorText}>{error}</Text> : null}
            
            <Button
              mode="contained"
              onPress={handleRegister}
              style={styles.registerButton}
              loading={isLoading}
              disabled={isLoading}
            >
              Register
            </Button>
            
            <View style={styles.loginContainer}>
              <Text style={styles.loginText}>Already have an account?</Text>
              <Button
                mode="text"
                onPress={() => navigation.navigate('Login')}
                style={styles.loginButton}
              >
                Log In
              </Button>
            </View>
          </View>
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
  registerButton: {
    marginTop: 16,
    backgroundColor: colors.primary,
  },
  loginContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 16,
    marginBottom: 24,
  },
  loginText: {
    color: colors.textSecondary,
  },
  loginButton: {
    marginLeft: 4,
  },
  errorText: {
    color: colors.error,
    textAlign: 'center',
    marginTop: 8,
  },
});

export default RegisterScreen;
