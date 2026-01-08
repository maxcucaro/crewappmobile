import { Capacitor } from '@capacitor/core';

export const isNativePlatform = (): boolean => {
  return Capacitor.isNativePlatform();
};

export const getPlatform = (): string => {
  return Capacitor.getPlatform();
};

export const isAndroid = (): boolean => {
  return Capacitor.getPlatform() === 'android';
};

export const isIOS = (): boolean => {
  return Capacitor.getPlatform() === 'ios';
};

export const isWeb = (): boolean => {
  return Capacitor.getPlatform() === 'web';
};
