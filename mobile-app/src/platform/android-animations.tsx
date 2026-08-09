// Android-specific animations for the CricSync mobile application
import { Animated, Easing } from 'react-native';

// Standard Android Material Design timing and easing
export const androidTiming = {
  standard: 300,
  accelerate: 200,
  decelerate: 250,
  easing: Easing.out(Easing.poly(4)), // Material Design deceleration easing
};

// Android-style fade in animation
export const androidFadeIn = (value, duration = androidTiming.standard) => {
  return Animated.timing(value, {
    toValue: 1,
    duration: duration,
    easing: androidTiming.easing,
    useNativeDriver: true,
  });
};

// Android-style slide up animation (fade + translate)
export const androidSlideUp = (translateY, opacity, duration = androidTiming.standard) => {
  return Animated.parallel([
    Animated.timing(translateY, {
      toValue: 0,
      duration: duration,
      easing: androidTiming.easing,
      useNativeDriver: true,
    }),
    Animated.timing(opacity, {
      toValue: 1,
      duration: duration,
      easing: androidTiming.easing,
      useNativeDriver: true,
    }),
  ]);
};

// Android-style scale animation (for FABs or buttons)
export const androidScaleIn = (scale, duration = androidTiming.accelerate) => {
  return Animated.spring(scale, {
    toValue: 1,
    friction: 8,
    tension: 40,
    useNativeDriver: true,
  });
};

// Android-style ripple-like expansion animation
export const androidRippleExpand = (scale, opacity, duration = androidTiming.standard) => {
  return Animated.parallel([
    Animated.timing(scale, {
      toValue: 1,
      duration: duration,
      easing: Easing.out(Easing.ease),
      useNativeDriver: true,
    }),
    Animated.timing(opacity, {
      toValue: 0,
      duration: duration,
      easing: Easing.out(Easing.ease),
      useNativeDriver: true,
    }),
  ]);
};

export default {
  timing: androidTiming,
  fadeIn: androidFadeIn,
  slideUp: androidSlideUp,
  scaleIn: androidScaleIn,
  rippleExpand: androidRippleExpand,
};
