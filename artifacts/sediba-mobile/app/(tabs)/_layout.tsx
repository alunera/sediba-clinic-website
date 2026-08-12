import React from 'react';
import { Stack } from 'expo-router';

// No tabs — this is a booking flow. The (tabs) group acts as a simple
// stack container so the existing scaffold routing continues to work.
export default function TabLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" options={{ headerShown: false }} />
    </Stack>
  );
}
