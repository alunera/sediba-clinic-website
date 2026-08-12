import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { router, useLocalSearchParams } from 'expo-router';
import { useCreateAppointment } from '@workspace/api-client-react';
import { useColors } from '@/hooks/useColors';
import { KeyboardAwareScrollViewCompat } from '@/components/KeyboardAwareScrollViewCompat';

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December'];

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

type FieldName = 'name' | 'email' | 'phone' | 'whatsapp' | 'notes';

export default function DetailsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{
    serviceId: string;
    serviceName: string;
    serviceCategory: string;
    serviceDuration: string;
    servicePrice: string;
    date: string;
    time: string;
  }>();

  const [form, setForm] = useState({
    name: '',
    email: '',
    phone: '',
    whatsapp: '',
    notes: '',
  });
  const [policyAgreed, setPolicyAgreed] = useState(false);
  const [errors, setErrors] = useState<Partial<Record<FieldName, string>>>({});

  const { mutate: createAppointment, isPending } = useCreateAppointment();

  const webTop = Platform.OS === 'web' ? 67 : 0;
  const webBottom = Platform.OS === 'web' ? 34 : 0;

  function validate(): boolean {
    const newErrors: Partial<Record<FieldName, string>> = {};
    if (!form.name.trim()) newErrors.name = 'Full name is required';
    if (!form.email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email))
      newErrors.email = 'Valid email is required';
    if (!form.phone.trim() || form.phone.trim().length < 7)
      newErrors.phone = 'Valid phone number is required';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }

  function handleSubmit() {
    if (!validate()) {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return;
    }
    if (!policyAgreed) {
      Alert.alert('Policy', 'Please agree to the cancellation policy to continue.');
      return;
    }
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    createAppointment(
      {
        data: {
          clientName: form.name.trim(),
          clientEmail: form.email.trim(),
          clientPhone: form.phone.trim(),
          clientWhatsapp: form.whatsapp.trim() || undefined,
          serviceId: Number(params.serviceId),
          date: params.date,
          time: params.time,
          notes: form.notes.trim() || undefined,
          policyAgreed: true,
        },
      },
      {
        onSuccess: (appointment) => {
          void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          router.replace({
            pathname: '/confirmation',
            params: {
              bookingRef: appointment.bookingRef,
              serviceName: appointment.serviceName,
              date: appointment.date,
              time: appointment.time,
              clientName: appointment.clientName,
              totalAmountCents: String(appointment.totalAmountCents),
              status: appointment.status,
            },
          });
        },
        onError: (err) => {
          void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
          Alert.alert(
            'Booking Failed',
            'We could not confirm your booking. Please try again.',
            [{ text: 'OK' }]
          );
        },
      }
    );
  }

  function Field({
    label,
    field,
    placeholder,
    keyboardType = 'default',
    optional = false,
    multiline = false,
  }: {
    label: string;
    field: FieldName;
    placeholder: string;
    keyboardType?: 'default' | 'email-address' | 'phone-pad';
    optional?: boolean;
    multiline?: boolean;
  }) {
    const hasError = !!errors[field];
    return (
      <View style={styles.fieldContainer}>
        <View style={styles.fieldLabelRow}>
          <Text style={[styles.fieldLabel, { color: colors.foreground }]}>{label}</Text>
          {optional && (
            <Text style={[styles.optionalTag, { color: colors.mutedForeground }]}>Optional</Text>
          )}
        </View>
        <TextInput
          value={form[field]}
          onChangeText={(v) => {
            setForm((f) => ({ ...f, [field]: v }));
            if (errors[field]) setErrors((e) => ({ ...e, [field]: undefined }));
          }}
          placeholder={placeholder}
          placeholderTextColor={colors.mutedForeground}
          keyboardType={keyboardType}
          autoCapitalize={field === 'email' ? 'none' : 'words'}
          multiline={multiline}
          numberOfLines={multiline ? 3 : 1}
          style={[
            styles.input,
            multiline && styles.multilineInput,
            {
              color: colors.foreground,
              backgroundColor: colors.background,
              borderColor: hasError ? colors.destructive : colors.border,
              fontFamily: 'PlusJakartaSans_400Regular',
            },
          ]}
          testID={`field-${field}`}
        />
        {hasError && (
          <Text style={[styles.errorText, { color: colors.destructive }]}>{errors[field]}</Text>
        )}
      </View>
    );
  }

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
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>Your Details</Text>
      </View>

      <KeyboardAwareScrollViewCompat
        bottomOffset={24}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: insets.bottom + webBottom + 32 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* Booking Summary */}
        <View style={[styles.summary, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={styles.summaryRow}>
            <Feather name="scissors" size={14} color={colors.primary} />
            <Text style={[styles.summaryService, { color: colors.foreground }]} numberOfLines={1}>
              {params.serviceName}
            </Text>
          </View>
          <View style={styles.summaryMeta}>
            <View style={styles.summaryRow}>
              <Feather name="calendar" size={13} color={colors.mutedForeground} />
              <Text style={[styles.summaryText, { color: colors.mutedForeground }]}>
                {formatDisplayDate(params.date)}
              </Text>
            </View>
            <View style={styles.summaryRow}>
              <Feather name="clock" size={13} color={colors.mutedForeground} />
              <Text style={[styles.summaryText, { color: colors.mutedForeground }]}>
                {formatTime(params.time)} · {params.serviceDuration} min
              </Text>
            </View>
          </View>
          <Text style={[styles.summaryPrice, { color: colors.primary }]}>
            R {(Number(params.servicePrice) / 100).toFixed(0)}
          </Text>
        </View>

        {/* Form */}
        <View style={styles.form}>
          <Field label="Full Name" field="name" placeholder="Your full name" />
          <Field label="Email Address" field="email" placeholder="your@email.com" keyboardType="email-address" />
          <Field label="Phone Number" field="phone" placeholder="+27 12 345 6789" keyboardType="phone-pad" />
          <Field label="WhatsApp Number" field="whatsapp" placeholder="+27 12 345 6789" keyboardType="phone-pad" optional />
          <Field label="Special Requests" field="notes" placeholder="Any notes for your therapist..." optional multiline />
        </View>

        {/* Policy */}
        <View style={styles.policyContainer}>
          <Pressable
            onPress={() => setPolicyAgreed((v) => !v)}
            style={styles.policyRow}
            testID="policy-checkbox"
          >
            <View
              style={[
                styles.checkbox,
                {
                  backgroundColor: policyAgreed ? colors.primary : colors.background,
                  borderColor: policyAgreed ? colors.primary : colors.border,
                },
              ]}
            >
              {policyAgreed && (
                <Feather name="check" size={12} color={colors.primaryForeground} />
              )}
            </View>
            <Text style={[styles.policyText, { color: colors.foreground }]}>
              I agree to the{' '}
              <Text style={{ color: colors.primary }}>cancellation policy</Text>. Cancellations
              must be made 24 hours in advance.
            </Text>
          </Pressable>
        </View>

        {/* Submit */}
        <Pressable
          onPress={handleSubmit}
          disabled={isPending}
          style={[
            styles.submitButton,
            { backgroundColor: isPending ? colors.muted : colors.secondary },
          ]}
          testID="submit-button"
        >
          {isPending ? (
            <ActivityIndicator color={colors.card} />
          ) : (
            <>
              <Text style={[styles.submitButtonText, { color: colors.secondaryForeground }]}>
                Confirm Booking
              </Text>
              <Feather name="check" size={18} color={colors.secondaryForeground} />
            </>
          )}
        </Pressable>
      </KeyboardAwareScrollViewCompat>
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
  headerTitle: {
    fontSize: 18,
    fontFamily: 'PlusJakartaSans_700Bold',
    letterSpacing: -0.3,
  },
  scrollContent: { paddingTop: 20, paddingHorizontal: 24, gap: 24 },
  summary: {
    borderWidth: 1,
    padding: 16,
    gap: 10,
  },
  summaryRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  summaryService: {
    fontSize: 16,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    flex: 1,
  },
  summaryMeta: { gap: 4 },
  summaryText: {
    fontSize: 13,
    fontFamily: 'PlusJakartaSans_400Regular',
  },
  summaryPrice: {
    fontSize: 20,
    fontFamily: 'PlusJakartaSans_700Bold',
  },
  form: { gap: 16 },
  fieldContainer: { gap: 6 },
  fieldLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  fieldLabel: {
    fontSize: 13,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    letterSpacing: 0.3,
  },
  optionalTag: {
    fontSize: 11,
    fontFamily: 'PlusJakartaSans_400Regular',
  },
  input: {
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
  },
  multilineInput: {
    height: 80,
    textAlignVertical: 'top',
    paddingTop: 12,
  },
  errorText: {
    fontSize: 12,
    fontFamily: 'PlusJakartaSans_400Regular',
  },
  policyContainer: { gap: 8 },
  policyRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
    flexShrink: 0,
  },
  policyText: {
    fontSize: 13,
    fontFamily: 'PlusJakartaSans_400Regular',
    lineHeight: 20,
    flex: 1,
  },
  submitButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    gap: 10,
    marginTop: 8,
  },
  submitButtonText: {
    fontSize: 16,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    letterSpacing: 0.3,
  },
});
