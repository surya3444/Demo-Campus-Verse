import { View, ScrollView, TouchableOpacity, Linking, RefreshControl } from 'react-native';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useState, useCallback } from 'react';
import { Text, Rule, Pill, Card, EmptyState, color } from '@campus-verse/mobile-shared/design';
import { transportApi } from '@/api/transport';

/**
 * Transport · Live map (route diary).
 *
 * The page is set like a hand-drawn route diary. Stops are arranged on a
 * vertical rail with kilometre marks, the student's stop in marigold. A
 * status ribbon at the top shows whether the bus has set out, and where.
 *
 * Live GPS streaming is wired through the bus-tracking topic on the realtime
 * socket; the current version shows the planned route with placeholder
 * "current position" inferred from time-of-day until the GPS feed lands.
 */

function formatDistance(m?: number) {
  if (!m) return '—';
  return m >= 1000 ? `${(m / 1000).toFixed(1)} km` : `${m} m`;
}

function formatDuration(s?: number) {
  if (!s) return '—';
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return h > 0 ? `${h}h ${m}m` : `${m} min`;
}

// Phase ribbons based on time-of-day. Real GPS will replace this.
function inferPhase(now: Date, pickupTime?: string, dropTime?: string) {
  if (!pickupTime || !dropTime) return { phase: 'planned', label: 'Awaiting schedule' };
  const [ph, pm] = pickupTime.split(':').map(Number);
  const [dh, dm] = dropTime.split(':').map(Number);
  const pickup = ph * 60 + pm;
  const drop = dh * 60 + dm;
  const cur = now.getHours() * 60 + now.getMinutes();
  if (cur < pickup - 30) return { phase: 'planned', label: 'Garage · departs soon' };
  if (cur < pickup) return { phase: 'en_route', label: 'On the way to your stop' };
  if (cur < drop - 30) return { phase: 'school', label: 'At school' };
  if (cur < drop) return { phase: 'returning', label: 'Heading home' };
  return { phase: 'finished', label: 'Today’s service has ended' };
}

export default function TransportLive() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [refreshing, setRefreshing] = useState(false);

  const { data, refetch } = useQuery({
    queryKey: ['transport-detail'],
    queryFn: () => transportApi.getMyEnrollment(),
  });

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  }, [refetch]);

  if (!data?.enrollment) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: color.paper,
          paddingTop: insets.top + 40,
          paddingHorizontal: 22,
        }}
      >
        <StatusBar style="dark" />
        <TouchableOpacity onPress={() => router.back()} hitSlop={10}>
          <Text variant="micro" tone="inkMute">
            ← Back
          </Text>
        </TouchableOpacity>
        <View style={{ height: 30 }} />
        <EmptyState
          eyebrow="Not enrolled"
          title="No bus assigned."
          description="Visit the transport office to enrol your child on a route."
        />
      </View>
    );
  }

  const { enrollment, bus } = data;
  const phase = inferPhase(new Date(), enrollment.pickupTime, enrollment.dropTime);
  const myStopIndex = bus?.stops?.findIndex((s) => s._id === enrollment.stopId) ?? -1;

  return (
    <View style={{ flex: 1, backgroundColor: color.paper }}>
      <StatusBar style="light" />

      {/* Masthead — ink ribbon */}
      <View
        style={{
          backgroundColor: color.ink,
          paddingTop: insets.top + 14,
          paddingBottom: 28,
          paddingHorizontal: 22,
        }}
      >
        <TouchableOpacity onPress={() => router.back()} hitSlop={10}>
          <Text variant="micro" tone="onInkMute">
            ← Back
          </Text>
        </TouchableOpacity>
        <View style={{ height: 18 }} />
        <Text variant="eyebrow" tone="marigold">
          Route diary · Live
        </Text>
        <View style={{ height: 10 }} />
        <View style={{ flexDirection: 'row', alignItems: 'flex-end' }}>
          <Text variant="display" tone="onInk" italic>
            {enrollment.busNumber}
          </Text>
          <View style={{ flex: 1 }} />
          <Pill
            label={phase.phase === 'en_route' ? 'En route' : phase.phase.replace('_', ' ')}
            tone={
              phase.phase === 'en_route'
                ? 'marigold'
                : phase.phase === 'finished'
                  ? 'neutral'
                  : 'sage'
            }
            variant="solid"
            size="sm"
          />
        </View>
        <Text variant="caption" tone="onInkMute" style={{ marginTop: 8 }}>
          {enrollment.busName} · {phase.label}
        </Text>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={color.ink} />
        }
        contentContainerStyle={{ padding: 22, paddingBottom: 60 }}
      >
        {/* Times ledger */}
        <View style={{ flexDirection: 'row' }}>
          <View style={{ flex: 1 }}>
            <Text variant="eyebrow" tone="inkFaint">
              Pickup
            </Text>
            <View style={{ height: 6 }} />
            <Text variant="numLarge" tone="ink">
              {enrollment.pickupTime ?? '—'}
            </Text>
          </View>
          <View style={{ width: 1, backgroundColor: color.rule, marginHorizontal: 14 }} />
          <View style={{ flex: 1 }}>
            <Text variant="eyebrow" tone="inkFaint">
              Drop
            </Text>
            <View style={{ height: 6 }} />
            <Text variant="numLarge" tone="ink">
              {enrollment.dropTime ?? '—'}
            </Text>
          </View>
        </View>
        <View style={{ height: 18 }} />
        <Rule />

        {/* Route */}
        <View style={{ marginTop: 22 }}>
          <View style={{ flexDirection: 'row', alignItems: 'baseline' }}>
            <Text variant="eyebrow" tone="inkFaint">
              01 · The route
            </Text>
            <View style={{ flex: 1 }} />
            <Text variant="micro" tone="inkFaint">
              {formatDistance(bus?.totalDistanceMeters)} ·{' '}
              {formatDuration(bus?.totalDurationSeconds)}
            </Text>
          </View>
          <View style={{ height: 18 }} />

          {bus?.stops && bus.stops.length > 0 ? (
            <View>
              {bus.stops.map((stop, i) => {
                const isMine = stop._id === enrollment.stopId;
                const isPast = myStopIndex !== -1 && i < myStopIndex && phase.phase === 'en_route';
                const isCurrent =
                  phase.phase === 'en_route' &&
                  myStopIndex !== -1 &&
                  i === Math.max(0, myStopIndex - 1);
                return (
                  <View key={stop._id} style={{ flexDirection: 'row' }}>
                    {/* Rail */}
                    <View style={{ alignItems: 'center', width: 36 }}>
                      <View
                        style={{
                          width: isMine ? 14 : 10,
                          height: isMine ? 14 : 10,
                          borderRadius: 7,
                          backgroundColor: isMine
                            ? color.marigold
                            : isPast
                              ? color.ink
                              : color.paper,
                          borderWidth: isMine ? 0 : 1.5,
                          borderColor: isCurrent ? color.marigold : color.ruleStrong,
                        }}
                      />
                      {i < bus.stops.length - 1 && (
                        <View
                          style={{
                            flex: 1,
                            width: 1,
                            backgroundColor: isPast ? color.ink : color.rule,
                            marginVertical: 4,
                          }}
                        />
                      )}
                    </View>
                    {/* Stop */}
                    <View style={{ flex: 1, paddingBottom: 22 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'baseline' }}>
                        <Text variant="kicker" tone={isMine ? 'marigold' : 'inkFaint'}>
                          Stop {String(stop.sequence).padStart(2, '0')}
                        </Text>
                        {isMine && (
                          <Text variant="micro" tone="marigold" style={{ marginLeft: 8 }}>
                            · YOU
                          </Text>
                        )}
                      </View>
                      <View style={{ height: 4 }} />
                      <Text variant={isMine ? 'h2' : 'h3'} tone="ink" italic={isMine}>
                        {stop.name}
                      </Text>
                      {stop.address && (
                        <Text variant="caption" tone="inkMute" style={{ marginTop: 2 }}>
                          {stop.address}
                        </Text>
                      )}
                      <View style={{ flexDirection: 'row', marginTop: 6, alignItems: 'center' }}>
                        {stop.pickupTime && (
                          <Text variant="numSmall" tone="ink">
                            ↑ {stop.pickupTime}
                          </Text>
                        )}
                        {stop.pickupTime && stop.dropTime && (
                          <Text variant="micro" tone="inkGhost" style={{ marginHorizontal: 6 }}>
                            ·
                          </Text>
                        )}
                        {stop.dropTime && (
                          <Text variant="numSmall" tone="ink">
                            ↓ {stop.dropTime}
                          </Text>
                        )}
                      </View>
                    </View>
                  </View>
                );
              })}
            </View>
          ) : (
            <Text variant="body" tone="inkMute" italic>
              Stops will appear once the route is published.
            </Text>
          )}
        </View>

        {/* Crew */}
        {bus && (bus.driverName || bus.conductorName) && (
          <View style={{ marginTop: 16 }}>
            <Text variant="eyebrow" tone="inkFaint">
              02 · The crew
            </Text>
            <View style={{ height: 14 }} />
            {bus.driverName && (
              <CrewRow role="Driver" name={bus.driverName} phone={bus.driverPhone} />
            )}
            {bus.conductorName && (
              <CrewRow role="Conductor" name={bus.conductorName} phone={bus.conductorPhone} />
            )}
          </View>
        )}

        {/* Safety */}
        <View style={{ marginTop: 30 }}>
          <Card variant="ink" rounded="md" padded={20}>
            <Text variant="eyebrow" tone="marigold">
              Safety note
            </Text>
            <View style={{ height: 10 }} />
            <Text variant="body" tone="onInk" italic style={{ lineHeight: 22 }}>
              If the bus is more than 10 minutes late or the route appears wrong, please call the
              transport office on the number above.
            </Text>
          </Card>
        </View>
      </ScrollView>
    </View>
  );
}

function CrewRow({ role, name, phone }: { role: string; name: string; phone?: string }) {
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 14,
        borderBottomWidth: 1,
        borderBottomColor: color.rule,
      }}
    >
      <View style={{ flex: 1 }}>
        <Text variant="kicker" tone="inkFaint">
          {role}
        </Text>
        <View style={{ height: 4 }} />
        <Text variant="h3" tone="ink" italic>
          {name}
        </Text>
      </View>
      {phone && (
        <TouchableOpacity
          activeOpacity={0.7}
          onPress={() => Linking.openURL(`tel:${phone}`)}
          style={{
            paddingHorizontal: 14,
            paddingVertical: 8,
            borderRadius: 999,
            borderWidth: 1.5,
            borderColor: color.ink,
          }}
        >
          <Text variant="micro" tone="ink">
            Call →
          </Text>
        </TouchableOpacity>
      )}
    </View>
  );
}
