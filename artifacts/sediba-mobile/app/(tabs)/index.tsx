import React, { useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useListServices, useListServiceCategories } from '@workspace/api-client-react';
import { useColors } from '@/hooks/useColors';

type Service = {
  id: number;
  name: string;
  category: string;
  description: string;
  duration: number;
  price: number;
  imageUrl?: string | null;
};

function formatPrice(priceCents: number): string {
  return `R ${(priceCents / 100).toFixed(0)}`;
}

function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h}h ${m}min` : `${h}h`;
}

function ServiceCard({ service, onPress }: { service: Service; onPress: () => void }) {
  const colors = useColors();
  const [pressed, setPressed] = useState(false);

  return (
    <Pressable
      onPress={onPress}
      onPressIn={() => setPressed(true)}
      onPressOut={() => setPressed(false)}
      style={[
        styles.card,
        {
          backgroundColor: colors.card,
          borderColor: colors.border,
          opacity: pressed ? 0.88 : 1,
        },
      ]}
      testID={`service-card-${service.id}`}
    >
      <View style={styles.cardContent}>
        <View style={styles.cardHeader}>
          <View style={[styles.categoryBadge, { backgroundColor: colors.muted }]}>
            <Text style={[styles.categoryText, { color: colors.mutedForeground }]}>
              {service.category}
            </Text>
          </View>
        </View>
        <Text style={[styles.serviceName, { color: colors.foreground }]} numberOfLines={2}>
          {service.name}
        </Text>
        <Text style={[styles.serviceDescription, { color: colors.mutedForeground }]} numberOfLines={2}>
          {service.description}
        </Text>
        <View style={styles.cardFooter}>
          <View style={styles.metaRow}>
            <Feather name="clock" size={13} color={colors.mutedForeground} />
            <Text style={[styles.metaText, { color: colors.mutedForeground }]}>
              {formatDuration(service.duration)}
            </Text>
          </View>
          <Text style={[styles.priceText, { color: colors.primary }]}>
            {formatPrice(service.price)}
          </Text>
        </View>
      </View>
      <View style={styles.cardArrow}>
        <Feather name="chevron-right" size={18} color={colors.muted} />
      </View>
    </Pressable>
  );
}

function CategorySection({
  category,
  services,
}: {
  category: string;
  services: Service[];
}) {
  const colors = useColors();
  return (
    <View style={styles.categorySection}>
      <Text style={[styles.categoryHeading, { color: colors.foreground }]}>
        {category}
      </Text>
      {services.map((service) => (
        <ServiceCard
          key={service.id}
          service={service}
          onPress={() =>
            router.push({
              pathname: '/schedule',
              params: {
                serviceId: String(service.id),
                serviceName: service.name,
                serviceCategory: service.category,
                serviceDuration: String(service.duration),
                servicePrice: String(service.price),
              },
            })
          }
        />
      ))}
    </View>
  );
}

export default function ServicesScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { data: services, isLoading, error, refetch } = useListServices();

  const webTop = Platform.OS === 'web' ? 67 : 0;
  const webBottom = Platform.OS === 'web' ? 34 : 0;

  // Group services by category
  const grouped: Record<string, Service[]> = {};
  if (services) {
    for (const svc of services) {
      if (!grouped[svc.category]) grouped[svc.category] = [];
      grouped[svc.category].push(svc);
    }
  }
  const categories = Object.keys(grouped);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View
        style={[
          styles.header,
          {
            backgroundColor: colors.background,
            borderBottomColor: colors.border,
            paddingTop: insets.top + 12 + webTop,
          },
        ]}
      >
        <View style={styles.headerContent}>
          <Text style={[styles.logoText, { color: colors.primary }]}>SEDIBA</Text>
          <Text style={[styles.tagline, { color: colors.mutedForeground }]}>
            Aesthetic &amp; Wellness
          </Text>
        </View>
      </View>

      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : error ? (
        <View style={styles.center}>
          <Feather name="wifi-off" size={40} color={colors.mutedForeground} />
          <Text style={[styles.errorText, { color: colors.mutedForeground }]}>
            Could not load services
          </Text>
          <Pressable
            onPress={() => refetch()}
            style={[styles.retryButton, { borderColor: colors.primary }]}
          >
            <Text style={[styles.retryButtonText, { color: colors.primary }]}>Try Again</Text>
          </Pressable>
        </View>
      ) : (
        <FlatList
          data={categories}
          keyExtractor={(cat) => cat}
          renderItem={({ item: cat }) => (
            <CategorySection category={cat} services={grouped[cat]} />
          )}
          ListHeaderComponent={
            <View style={styles.listHeader}>
              <Text style={[styles.listTitle, { color: colors.foreground }]}>Our Services</Text>
              <Text style={[styles.listSubtitle, { color: colors.mutedForeground }]}>
                Book your treatment below
              </Text>
            </View>
          }
          ListFooterComponent={<View style={{ height: insets.bottom + webBottom + 24 }} />}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          scrollEnabled={!!services && services.length > 0}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    borderBottomWidth: 1,
    paddingHorizontal: 24,
    paddingBottom: 16,
  },
  headerContent: { gap: 2 },
  logoText: {
    fontSize: 22,
    fontFamily: 'PlusJakartaSans_700Bold',
    letterSpacing: 6,
  },
  tagline: {
    fontSize: 11,
    fontFamily: 'PlusJakartaSans_400Regular',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    paddingHorizontal: 32,
  },
  errorText: {
    fontSize: 15,
    fontFamily: 'PlusJakartaSans_400Regular',
    textAlign: 'center',
  },
  retryButton: {
    borderWidth: 1,
    paddingHorizontal: 24,
    paddingVertical: 10,
  },
  retryButtonText: {
    fontSize: 14,
    fontFamily: 'PlusJakartaSans_600SemiBold',
  },
  listContent: { paddingTop: 8 },
  listHeader: {
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 8,
    gap: 4,
  },
  listTitle: {
    fontSize: 26,
    fontFamily: 'PlusJakartaSans_700Bold',
    letterSpacing: -0.5,
  },
  listSubtitle: {
    fontSize: 14,
    fontFamily: 'PlusJakartaSans_400Regular',
  },
  categorySection: {
    paddingHorizontal: 24,
    marginTop: 24,
    gap: 10,
  },
  categoryHeading: {
    fontSize: 11,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    letterSpacing: 2,
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  card: {
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 16,
    gap: 8,
  },
  cardContent: { flex: 1, gap: 6 },
  cardHeader: { flexDirection: 'row' },
  categoryBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  categoryText: {
    fontSize: 10,
    fontFamily: 'PlusJakartaSans_500Medium',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  serviceName: {
    fontSize: 16,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    letterSpacing: -0.2,
  },
  serviceDescription: {
    fontSize: 13,
    fontFamily: 'PlusJakartaSans_400Regular',
    lineHeight: 18,
  },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  metaText: {
    fontSize: 13,
    fontFamily: 'PlusJakartaSans_400Regular',
  },
  priceText: {
    fontSize: 16,
    fontFamily: 'PlusJakartaSans_700Bold',
  },
  cardArrow: { paddingLeft: 4 },
});
