import React, { useEffect, useRef } from 'react';
import {
  Animated,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { router, useLocalSearchParams } from 'expo-router';
import { useColors } from '@/hooks/useColors';

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTH_NAMES = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December',
];

function formatDisplayDate(dateStr: string): string {
  const [year, month, day] = dateStr.split('-').map(Number);
  const d = new Date(year, month - 1, day);
  return `${DAY_NAMES[d.getDay()]}, ${day} ${MONTH_NAMES[month - 1]} ${year}`;
}

function formatTime(time: string): string {
  const [h, m] = time.split(':').map(Number);
  const ampm = h < 12 ? 'am' : 'pm';
  const hour = h % 12 === 0 ? 12 : h % 12;
  return `${hour}:${m.toString().padStart(2, '0')} ${ampm}`;
}

function formatPrice(cents: string): string {
  return `R ${(Number(cents) / 100).toFixed(0)}`;
}

export default function ConfirmationScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{
    bookingRef: string;
    serviceName: string;
    date: string;
    time: string;
    clientName: string;
    totalAmountCents: string;
    status: string;
  }>();

  const checkScale = useRef(new Animated.Value(0)).current;
  const cardOpacity = useRef(new Animated.Value(0)).current;
  const cardTranslate = useRef(new Animated.Value(30)).current;

  const webTop = Platform.OS === 'web' ? 67 : 0;
  const webBottom = Platform.OS === 'web' ? 34 : 0;

  useEffect(() => {
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    Animated.sequence([
      Animated.spring(checkScale, {
        toValue: 1,
        tension: 60,
        friction: 7,
        useNativeDriver: true,
      }),
      Animated.parallel([
        Animated.timing(cardOpacity, {
          toValue: 1,
          duration: 350,
          useNativeDriver: true,
        }),
        Animated.spring(cardTranslate, {
          toValue: 0,
          tension: 60,
          friction: 8,
          useNativeDriver: true,
        }),
      ]),
    ]).start();
  }, []);

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: colors.background,
          paddingTop: insets.top + webTop,
          paddingBottom: insets.bottom + webBottom,
        },
      ]}
    >
      {/* Success Icon */}
      <View style={styles.topSection}>
        <Animated.View
          style={[
            styles.checkCircle,
            { backgroundColor: colors.primary, transform: [{ scale: checkScale }] },
          ]}
        >
          <Feather name="check" size={36} color={colors.primaryForeground} />
        </Animated.View>

        <View style={styles.titleBlock}>
          <Text style={[styles.confirmedText, { color: colors.foreground }]}>
            Booking Confirmed
          </Text>
          <Text style={[styles.confirmedSub, { color: colors.mutedForeground }]}>
            Your appointment has been reserved
          </Text>
        </View>
      </View>

      {/* Booking Card — screenshot-friendly */}
      <Animated.View
        style={[
          styles.bookingCard,
          {
            backgroundColor: colors.card,
            borderColor: colors.border,
            opacity: cardOpacity,
            transform: [{ translateY: cardTranslate }],
          },
        ]}
        testID="booking-card"
      >
        {/* Clinic brand strip */}
        <View style={[styles.cardBrand, { backgroundColor: colors.secondary }]}>
          <Text style={[styles.cardBrandText, { color: colors.secondaryForeground }]}>
            SEDIBA AESTHETIC &amp; WELLNESS
          </Text>
        </View>

        {/* Reference */}
        <View style={styles.refSection}>
          <Text style={[styles.refLabel, { color: colors.mutedForeground }]}>
            BOOKING REFERENCE
          </Text>
          <Text style={[styles.refNumber, { color: colors.foreground }]}>
            {params.bookingRef}
          </Text>
        </View>

        {/* Divider */}
        <View style={[styles.divider, { backgroundColor: colors.border }]} />

        {/* Details grid */}
        <View style={styles.detailsGrid}>
          <DetailRow
            icon="scissors"
            label="Treatment"
            value={params.serviceName}
            colors={colors}
          />
          <DetailRow
            icon="calendar"
            label="Date"
            value={formatDisplayDate(params.date)}
            colors={colors}
          />
          <DetailRow
            icon="clock"
            label="Time"
            value={formatTime(params.time)}
            colors={colors}
          />
          <DetailRow
            icon="user"
            label="Client"
            value={params.clientName}
            colors={colors}
          />
          <DetailRow
            icon="credit-card"
            label="Amount"
            value={formatPrice(params.totalAmountCents)}
            colors={colors}
          />
        </View>

        {/* Divider */}
        <View style={[styles.divider, { backgroundColor: colors.border }]} />

        {/* Status badge */}
        <View style={styles.statusRow}>
          <View style={[styles.statusBadge, { backgroundColor: colors.primary }]}>
            <Feather name="check-circle" size={12} color={colors.primaryForeground} />
            <Text style={[styles.statusText, { color: colors.primaryForeground }]}>
              CONFIRMED
            </Text>
          </View>
          <Text style={[styles.cardNote, { color: colors.mutedForeground }]}>
            Screenshot this for your records
          </Text>
        </View>
      </Animated.View>

      {/* Actions */}
      <View style={styles.actions}>
        <Pressable
          onPress={() => {
            void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            router.dismissAll();
          }}
          style={[styles.bookAnotherButton, { borderColor: colors.border }]}
          testID="book-another-button"
        >
          <Feather name="plus" size={16} color={colors.foreground} />
          <Text style={[styles.bookAnotherText, { color: colors.foreground }]}>
            Book Another
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

type Colors = ReturnType<typeof useColors>;

function DetailRow({
  icon,
  label,
  value,
  colors,
}: {
  icon: React.ComponentProps<typeof Feather>['name'];
  label: string;
  value: string;
  colors: Colors;
}) {
  return (
    <View style={styles.detailRow}>
      <View style={styles.detailLeft}>
        <Feather name={icon} size={14} color={colors.mutedForeground} />
        <Text style={[styles.detailLabel, { color: colors.mutedForeground }]}>{label}</Text>
      </View>
      <Text style={[styles.detailValue, { color: colors.foreground }]} numberOfLines={2}>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 24,
    justifyContent: 'center',
    gap: 28,
  },
  topSection: {
    alignItems: 'center',
    gap: 16,
  },
  checkCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  titleBlock: {
    alignItems: 'center',
    gap: 4,
  },
  confirmedText: {
    fontSize: 26,
    fontFamily: 'PlusJakartaSans_700Bold',
    letterSpacing: -0.5,
    textAlign: 'center',
  },
  confirmedSub: {
    fontSize: 14,
    fontFamily: 'PlusJakartaSans_400Regular',
    textAlign: 'center',
  },
  bookingCard: {
    borderWidth: 1,
    overflow: 'hidden',
  },
  cardBrand: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  cardBrandText: {
    fontSize: 10,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    letterSpacing: 2.5,
    textTransform: 'uppercase',
  },
  refSection: {
    alignItems: 'center',
    paddingVertical: 18,
    gap: 4,
  },
  refLabel: {
    fontSize: 10,
    fontFamily: 'PlusJakartaSans_500Medium',
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  refNumber: {
    fontSize: 28,
    fontFamily: 'PlusJakartaSans_700Bold',
    letterSpacing: 3,
  },
  divider: { height: 1, marginHorizontal: 0 },
  detailsGrid: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 10,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  detailLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minWidth: 90,
  },
  detailLabel: {
    fontSize: 12,
    fontFamily: 'PlusJakartaSans_500Medium',
  },
  detailValue: {
    fontSize: 13,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    textAlign: 'right',
    flex: 1,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  statusText: {
    fontSize: 10,
    fontFamily: 'PlusJakartaSans_700Bold',
    letterSpacing: 1.5,
  },
  cardNote: {
    fontSize: 10,
    fontFamily: 'PlusJakartaSans_400Regular',
    fontStyle: 'italic',
  },
  actions: {
    alignItems: 'center',
  },
  bookAnotherButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 28,
    paddingVertical: 14,
    borderWidth: 1,
  },
  bookAnotherText: {
    fontSize: 15,
    fontFamily: 'PlusJakartaSans_500Medium',
  },
});
