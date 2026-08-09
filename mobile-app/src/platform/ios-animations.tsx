// iOS-specific animations for the CricSync mobile application
import React, { useRef, useEffect } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';
import { colors } from '../theme';

// iOS-specific fade in animation
export const IOSFadeIn = ({ children, duration = 300, delay = 0, style }) => {
  const opacity = useRef(new Animated.Value(0)).current;
  
  useEffect(() => {
    Animated.timing(opacity, {
      toValue: 1,
      duration,
      delay,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, []);
  
  return (
    <Animated.View style={[style, { opacity }]}>
      {children}
    </Animated.View>
  );
};

// iOS-specific slide in animation
export const IOSSlideIn = ({ children, direction = 'right', duration = 300, delay = 0, distance = 50, style }) => {
  const translateX = useRef(new Animated.Value(direction === 'right' ? distance : -distance)).current;
  const translateY = useRef(new Animated.Value(direction === 'down' ? distance : direction === 'up' ? -distance : 0)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  
  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration,
        delay,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(translateX, {
        toValue: 0,
        duration,
        delay,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(translateY, {
        toValue: 0,
        duration,
        delay,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start();
  }, []);
  
  return (
    <Animated.View style={[style, { opacity, transform: [{ translateX }, { translateY }] }]}>
      {children}
    </Animated.View>
  );
};

// iOS-specific scale animation
export const IOSScale = ({ children, duration = 300, delay = 0, initialScale = 0.9, style }) => {
  const scale = useRef(new Animated.Value(initialScale)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  
  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration,
        delay,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(scale, {
        toValue: 1,
        duration,
        delay,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start();
  }, []);
  
  return (
    <Animated.View style={[style, { opacity, transform: [{ scale }] }]}>
      {children}
    </Animated.View>
  );
};

// iOS-specific spring animation
export const IOSSpring = ({ children, duration = 400, delay = 0, initialScale = 0.9, style }) => {
  const scale = useRef(new Animated.Value(initialScale)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  
  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration: duration * 0.7,
        delay,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.spring(scale, {
        toValue: 1,
        friction: 8,
        tension: 40,
        delay,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);
  
  return (
    <Animated.View style={[style, { opacity, transform: [{ scale }] }]}>
      {children}
    </Animated.View>
  );
};

// iOS-specific staggered animation for lists
export const IOSStaggeredList = ({ children, itemDelay = 50, initialDelay = 0 }) => {
  return React.Children.map(children, (child, index) => (
    <IOSSlideIn delay={initialDelay + index * itemDelay} direction="right">
      {child}
    </IOSSlideIn>
  ));
};

// iOS-specific pull to refresh animation
export const IOSPullToRefreshIndicator = ({ refreshing, style }) => {
  const spinValue = useRef(new Animated.Value(0)).current;
  
  useEffect(() => {
    if (refreshing) {
      Animated.loop(
        Animated.timing(spinValue, {
          toValue: 1,
          duration: 1000,
          easing: Easing.linear,
          useNativeDriver: true,
        })
      ).start();
    } else {
      spinValue.setValue(0);
    }
  }, [refreshing]);
  
  const spin = spinValue.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });
  
  if (!refreshing) return null;
  
  return (
    <View style={[styles.refreshIndicator, style]}>
      <Animated.View style={{ transform: [{ rotate: spin }] }}>
        <View style={styles.refreshCircle} />
      </Animated.View>
    </View>
  );
};

// iOS-specific button press animation
export const useIOSButtonAnimation = () => {
  const scale = useRef(new Animated.Value(1)).current;
  
  const onPressIn = () => {
    Animated.timing(scale, {
      toValue: 0.97,
      duration: 100,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  };
  
  const onPressOut = () => {
    Animated.timing(scale, {
      toValue: 1,
      duration: 200,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  };
  
  return {
    scale,
    onPressIn,
    onPressOut,
    style: { transform: [{ scale }] },
  };
};

// iOS-specific styles
const styles = StyleSheet.create({
  refreshIndicator: {
    alignItems: 'center',
    justifyContent: 'center',
    height: 40,
    marginVertical: 10,
  },
  refreshCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: colors.primary,
    borderTopColor: 'transparent',
  },
});

export default {
  FadeIn: IOSFadeIn,
  SlideIn: IOSSlideIn,
  Scale: IOSScale,
  Spring: IOSSpring,
  StaggeredList: IOSStaggeredList,
  PullToRefreshIndicator: IOSPullToRefreshIndicator,
  useButtonAnimation: useIOSButtonAnimation,
};
