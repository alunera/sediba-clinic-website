import React, { useState, useMemo } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useGetAvailability, getGetAvailabilityQueryKey } from '@workspace/api-client-react';
import { useColors } from '@/hooks/useColors';

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTH_NAMES = [
  'Jan','Feb','Mar','Apr','May','Jun',
  'Jul','Aug','Sep','Oct','Nov','Dec',
];

function toDateString(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function formatDisplayDate(dateStr: string): string {
  const [year, month, day] = dateStr.split('-').map(Number);
  const d = new Date(year, month - 1, day);
  return `${DAY_NAMES[d.getDay()]}, ${day} ${MONTH_NAMES[month - 1]} ${year}`;
}

function formatTime(time: string): string {
  const [h, m] = time.split(':').map(Number);
  const ampm = h < 12 ? 'am' : 'pm';
  const hour = h % 12 === 0 ? 12 : h % 12;
  return `${hour}:${m.toString().padStart(2, '0')}${ampm}`;
}

// Build next 60 calendar days starting today
function buildCalendarDays(): { dateStr: string; dayName: string; dayNum: number; monthAbbr: string }[] {
  const days = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  for (let i = 0; i < 60; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    days.push({
      dateStr: toDateString(d),
      dayName: DAY_NAMES[d.getDay()],
      dayNum: d.getDate(),
      monthAbbr: MONTH_NAMES[d.getMonth()],
    });
  }
  return days;
}

export default function ScheduleScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{
    serviceId: string;
    serviceName: string;
    serviceCategory: string;
    serviceDuration: string;
    servicePrice: string;
  }>();

  const [selectedDate, setSelectedDate] = useState<string>('');
  const [selectedTime, setSelectedTime] = useState<string>('');

  const calendarDays = useMemo(() => buildCalendarDays(), []);

  const availParams = { date: selectedDate || '', serviceId: Number(params.serviceId) };
  const { data: slots, isLoading: slotsLoading } = useGetAvailability(
    availParams,
    { query: { enabled: !!selectedDate, queryKey: getGetAvailabilityQueryKey(availParams) } }
  );

  const canContinue = !!selectedDate && !!selectedTime;
  const webTop = Platform.OS === 'web' ? 67 : 0;
  const webBottom = Platform.OS === 'web' ? 34 : 0;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View
        style={[
          styles.header,
          {
            backgroundColor: colors.background,
            borderBottomColor: colors.border,
            paddingTop: insets.top + 8 + webTop,
          },
        ]}
      >
        <Pressable onPress={() => router.back()} style={styles.backButton} hitSlop={12}>
          <Feather name="arrow-left" size={22} color={colors.foreground} />
        </Pressable>
        <View style={styles.headerText}>
          <Text style={[styles.headerTitle, { color: colors.foreground }]} numberOfLines={1}>
            {params.serviceName}
          </Text>
          <Text style={[styles.headerSub, { color: colors.mutedForeground }]}>
            {params.serviceCategory} · {params.serviceDuration} min · R{' '}
            {(Number(params.servicePrice) / 100).toFixed(0)}
          </Text>
        </View>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: insets.bottom + webBottom + 100 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* Date Picker */}
        <View style={styles.section}>
          <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>
            SELECT DATE
          </Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.dateScrollContent}
          >
            {calendarDays.map((day) => {
              const isSelected = day.dateStr === selectedDate;
              return (
                <Pressable
                  key={day.dateStr}
                  onPress={() => {
                    setSelectedDate(day.dateStr);
                    setSelectedTime('');
                  }}
                  style={[
                    styles.dayCell,
                    {
                      backgroundColor: isSelected ? colors.primary : colors.card,
                      borderColor: isSelected ? colors.primary : colors.border,
                    },
                  ]}
                  testID={`date-${day.dateStr}`}
                >
                  <Text
                    style={[
                      styles.dayName,
                      { color: isSelected ? colors.primaryForeground : colors.mutedForeground },
                    ]}
                  >
                    {day.dayName}
                  </Text>
                  <Text
                    style={[
                      styles.dayNum,
                      { color: isSelected ? colors.primaryForeground : colors.foreground },
                    ]}
                  >
                    {day.dayNum}
                  </Text>
                  <Text
                    style={[
                      styles.monthAbbr,
                      { color: isSelected ? colors.primaryForeground : colors.mutedForeground },
                    ]}
                  >
                    {day.monthAbbr}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>

        {/* Time Slots */}
        {selectedDate ? (
          <View style={styles.section}>
            <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>
              SELECT TIME — {formatDisplayDate(selectedDate)}
            </Text>
            {slotsLoading ? (
              <View style={styles.slotsLoading}>
                <ActivityIndicator color={colors.primary} />
              </View>
            ) : !slots || slots.length === 0 ? (
              <View style={styles.noSlots}>
                <Feather name="calendar" size={32} color={colors.muted} />
                <Text style={[styles.noSlotsText, { color: colors.mutedForeground }]}>
                  No slots available
                </Text>
              </View>
            ) : (
              <View style={styles.slotsGrid}>
                {slots.map((slot) => {
                  const isSelected = slot.time === selectedTime;
                  const isAvailable = slot.available;
                  return (
                    <Pressable
                      key={slot.time}
                      onPress={() => isAvailable && setSelectedTime(slot.time)}
                      style={[
                        styles.slotCell,
                        {
                          backgroundColor: isSelected
                            ? colors.primary
                            : isAvailable
                            ? colors.card
                            : colors.muted,
                          borderColor: isSelected ? colors.primary : colors.border,
                          opacity: isAvailable ? 1 : 0.45,
                        },
                      ]}
                      disabled={!isAvailable}
                      testID={`slot-${slot.time}`}
                    >
                      <Text
                        style={[
                          styles.slotText,
                          {
                            color: isSelected
                              ? colors.primaryForeground
                              : isAvailable
                              ? colors.foreground
                              : colors.mutedForeground,
                          },
                        ]}
                      >
                        {formatTime(slot.time)}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            )}
          </View>
        ) : (
          <View style={styles.promptContainer}>
            <Feather name="calendar" size={36} color={colors.muted} />
            <Text style={[styles.promptText, { color: colors.mutedForeground }]}>
              Choose a date to see available times
            </Text>
          </View>
        )}
      </ScrollView>

      {/* Continue Button */}
      <View
        style={[
          styles.footer,
          {
            backgroundColor: colors.background,
            borderTopColor: colors.border,
            paddingBottom: insets.bottom + webBottom + 16,
          },
        ]}
      >
        {selectedDate && selectedTime ? (
          <View style={[styles.selectionSummary, { borderColor: colors.border }]}>
            <Text style={[styles.selectionText, { color: colors.foreground }]}>
              {formatDisplayDate(selectedDate)} · {formatTime(selectedTime)}
            </Text>
          </View>
        ) : null}
        <Pressable
          onPress={() =>
            router.push({
              pathname: '/details',
              params: {
                serviceId: params.serviceId,
                serviceName: params.serviceName,
                serviceCategory: params.serviceCategory,
                serviceDuration: params.serviceDuration,
                servicePrice: params.servicePrice,
                date: selectedDate,
                time: selectedTime,
              },
            })
          }
          disabled={!canContinue}
          style={[
            styles.continueButton,
            {
              backgroundColor: canContinue ? colors.primary : colors.muted,
            },
          ]}
          testID="continue-button"
        >
          <Text
            style={[
              styles.continueButtonText,
              { color: canContinue ? colors.primaryForeground : colors.mutedForeground },
            ]}
          >
            Continue
          </Text>
          <Feather
            name="arrow-right"
            size={18}
            color={canContinue ? colors.primaryForeground : colors.mutedForeground}
          />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingHorizontal: 20,
    paddingBottom: 14,
    borderBottomWidth: 1,
  },
  backButton: { padding: 4 },
  headerText: { flex: 1, gap: 2 },
  headerTitle: {
    fontSize: 17,
    fontFamily: 'PlusJakartaSans_700Bold',
    letterSpacing: -0.3,
  },
  headerSub: {
    fontSize: 12,
    fontFamily: 'PlusJakartaSans_400Regular',
  },
  scroll: { flex: 1 },
  scrollContent: { paddingTop: 8 },
  section: { marginTop: 28, paddingHorizontal: 24, gap: 14 },
  sectionLabel: {
    fontSize: 10,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  dateScrollContent: { paddingRight: 24, gap: 8 },
  dayCell: {
    width: 58,
    alignItems: 'center',
    paddingVertical: 12,
    borderWidth: 1,
    gap: 2,
  },
  dayName: {
    fontSize: 10,
    fontFamily: 'PlusJakartaSans_500Medium',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  dayNum: {
    fontSize: 22,
    fontFamily: 'PlusJakartaSans_700Bold',
    lineHeight: 28,
  },
  monthAbbr: {
    fontSize: 10,
    fontFamily: 'PlusJakartaSans_400Regular',
    letterSpacing: 0.3,
  },
  slotsLoading: {
    height: 120,
    alignItems: 'center',
    justifyContent: 'center',
  },
  noSlots: {
    height: 120,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  noSlotsText: {
    fontSize: 14,
    fontFamily: 'PlusJakartaSans_400Regular',
  },
  slotsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  slotCell: {
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 10,
    minWidth: 80,
    alignItems: 'center',
  },
  slotText: {
    fontSize: 14,
    fontFamily: 'PlusJakartaSans_500Medium',
  },
  promptContainer: {
    marginTop: 60,
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 32,
  },
  promptText: {
    fontSize: 14,
    fontFamily: 'PlusJakartaSans_400Regular',
    textAlign: 'center',
  },
  footer: {
    borderTopWidth: 1,
    paddingTop: 14,
    paddingHorizontal: 24,
    gap: 10,
  },
  selectionSummary: {
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 10,
    alignItems: 'center',
  },
  selectionText: {
    fontSize: 14,
    fontFamily: 'PlusJakartaSans_500Medium',
  },
  continueButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 15,
    gap: 8,
  },
  continueButtonText: {
    fontSize: 16,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    letterSpacing: 0.3,
  },
});
