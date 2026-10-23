import { useState } from 'react';
import { apiClient } from '@campus-verse/mobile-shared/api/client';
import { View, ScrollView, TouchableOpacity, TextInput, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Text, Pill, Button, color } from '@campus-verse/mobile-shared/design';

/**
 * Communications composer — the wire.
 *
 * A teacher's keyboard for sending an announcement to a section, class, or
 * the whole branch. The form treats the title and body like an editorial
 * layout: kicker + display headline + body, with a live preview card.
 */

type Audience = 'section' | 'class' | 'parents' | 'branch';
type Channel = 'push' | 'sms' | 'email';

export default function Composer() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [audience, setAudience] = useState<Audience>('section');
  const [section] = useState<string>('IX-B');
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [channels, setChannels] = useState<Channel[]>(['push']);
  const [urgent, setUrgent] = useState(false);
  const [sending, setSending] = useState(false);

  const toggleChannel = (c: Channel) =>
    setChannels((ch) => (ch.includes(c) ? ch.filter((x) => x !== c) : [...ch, c]));

  const valid = title.length > 2 && body.length > 10 && channels.length > 0;

  return (
    <View style={{ flex: 1, backgroundColor: color.paper }}>
      <StatusBar style="dark" />
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingTop: insets.top + 18,
          paddingBottom: 80,
          paddingHorizontal: 22,
        }}
      >
        <TouchableOpacity onPress={() => router.back()} hitSlop={10}>
          <Text variant="micro" tone="inkMute">
            ← Cancel
          </Text>
        </TouchableOpacity>
        <View style={{ height: 18 }} />
        <Text variant="eyebrow" tone="marigold">
          New broadcast · Form C-3
        </Text>
        <View style={{ height: 10 }} />
        <Text variant="hero" tone="ink">
          Send a
        </Text>
        <Text variant="hero" tone="ink" italic>
          notice.
        </Text>
        <View style={{ height: 24 }} />

        {/* Audience */}
        <Text variant="eyebrow" tone="inkFaint">
          01 · Audience
        </Text>
        <View style={{ height: 10 }} />
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {(['section', 'class', 'parents', 'branch'] as Audience[]).map((a) => {
            const sel = audience === a;
            return (
              <TouchableOpacity
                key={a}
                activeOpacity={0.7}
                onPress={() => setAudience(a)}
                style={{
                  paddingHorizontal: 14,
                  paddingVertical: 10,
                  borderRadius: 999,
                  backgroundColor: sel ? color.ink : 'transparent',
                  borderWidth: 1.5,
                  borderColor: sel ? color.ink : color.ruleStrong,
                }}
              >
                <Text variant="micro" tone={sel ? 'onInk' : 'ink'}>
                  {a === 'section'
                    ? 'My section'
                    : a === 'class'
                      ? 'Whole class'
                      : a === 'parents'
                        ? 'Parents'
                        : 'Branch-wide'}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
        {audience === 'section' && (
          <Text variant="caption" tone="inkMute" style={{ marginTop: 10 }}>
            Sending to{' '}
            <Text variant="caption" tone="ink" italic>
              {section}
            </Text>{' '}
            · 32 students · 28 parents
          </Text>
        )}

        {/* Title */}
        <View style={{ marginTop: 26 }}>
          <Text variant="eyebrow" tone="inkFaint">
            02 · Title
          </Text>
          <TextInput
            value={title}
            onChangeText={setTitle}
            placeholder="A short, plain title."
            placeholderTextColor={color.inkFaint}
            style={{
              fontFamily: title ? 'Fraunces_700Bold_Italic' : 'DMSans_500Medium',
              fontSize: 26,
              color: color.ink,
              paddingVertical: 12,
            }}
          />
          <View style={{ height: 1, backgroundColor: color.ink }} />
        </View>

        {/* Body */}
        <View style={{ marginTop: 22 }}>
          <Text variant="eyebrow" tone="inkFaint">
            03 · Message
          </Text>
          <TextInput
            value={body}
            onChangeText={setBody}
            placeholder="Write clearly. Parents and students will read this on their phones."
            placeholderTextColor={color.inkFaint}
            multiline
            style={{
              fontFamily: 'DMSans_400Regular',
              fontSize: 15,
              lineHeight: 22,
              color: color.ink,
              paddingVertical: 14,
              minHeight: 160,
              textAlignVertical: 'top',
            }}
          />
          <View style={{ height: 1, backgroundColor: color.ruleStrong }} />
        </View>

        {/* Channels */}
        <View style={{ marginTop: 26 }}>
          <Text variant="eyebrow" tone="inkFaint">
            04 · Send via
          </Text>
          <View style={{ height: 10 }} />
          <View style={{ flexDirection: 'row', gap: 10 }}>
            {(['push', 'sms', 'email'] as Channel[]).map((c) => {
              const sel = channels.includes(c);
              return (
                <TouchableOpacity
                  key={c}
                  activeOpacity={0.7}
                  onPress={() => toggleChannel(c)}
                  style={{
                    flex: 1,
                    paddingVertical: 14,
                    alignItems: 'center',
                    borderWidth: 1.5,
                    borderColor: sel ? color.marigold : color.rule,
                    backgroundColor: sel ? color.marigoldWash : 'transparent',
                    borderRadius: 8,
                  }}
                >
                  <Text
                    variant="h3"
                    italic={sel}
                    style={{ color: sel ? color.marigoldDeep : color.ink }}
                  >
                    {c === 'push' ? 'Push' : c.toUpperCase()}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Urgent */}
        <TouchableOpacity
          activeOpacity={0.7}
          onPress={() => setUrgent(!urgent)}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            marginTop: 22,
            paddingVertical: 12,
            paddingHorizontal: 14,
            borderRadius: 8,
            backgroundColor: urgent ? color.brickWash : 'transparent',
            borderWidth: 1,
            borderColor: urgent ? color.brick : color.rule,
          }}
        >
          <View
            style={{
              width: 18,
              height: 18,
              borderRadius: 4,
              borderWidth: 1.5,
              borderColor: urgent ? color.brick : color.ruleStrong,
              backgroundColor: urgent ? color.brick : 'transparent',
              marginRight: 12,
            }}
          />
          <View style={{ flex: 1 }}>
            <Text variant="bodyStrong" italic tone={urgent ? 'brick' : 'ink'}>
              Mark as urgent
            </Text>
            <Text variant="caption" tone="inkMute" style={{ marginTop: 2 }}>
              Overrides recipients' quiet hours.
            </Text>
          </View>
        </TouchableOpacity>

        {/* Preview */}
        {(title || body) && (
          <View style={{ marginTop: 30 }}>
            <Text variant="eyebrow" tone="inkFaint">
              Preview · how recipients see it
            </Text>
            <View style={{ height: 12 }} />
            <View
              style={{
                padding: 18,
                backgroundColor: color.card,
                borderRadius: 10,
                borderWidth: 1,
                borderColor: color.rule,
              }}
            >
              {urgent && (
                <View style={{ marginBottom: 8 }}>
                  <Pill label="Urgent" tone="brick" size="xs" />
                </View>
              )}
              <Text variant="eyebrow" tone="marigold">
                From your class teacher
              </Text>
              <View style={{ height: 6 }} />
              <Text variant="h2" tone="ink" italic>
                {title || 'Your title appears here'}
              </Text>
              <Text variant="body" tone="inkMute" style={{ marginTop: 6 }}>
                {body || 'Your message appears here.'}
              </Text>
            </View>
          </View>
        )}

        <View style={{ height: 30 }} />
        <Button
          label={valid ? 'Send now' : 'Fill the form to send'}
          variant={valid ? 'marigold' : 'ink'}
          size="lg"
          full
          disabled={!valid}
          loading={sending}
          onPress={async () => {
            // Create the announcement, then publish it — it really goes out now.
            setSending(true);
            try {
              const target = audience === 'parents' ? 'parents' : audience === 'branch' ? 'all' : 'students';
              const created = await apiClient.post('/communications/announcements', {
                title: title.trim(),
                content: body.trim(),
                type: urgent ? 'urgent' : 'general',
                priority: urgent ? 'high' : 'medium',
                audience: { type: target },
              });
              const id = (created.data?.data as { _id?: string } | undefined)?._id;
              if (id) await apiClient.put(`/communications/announcements/${id}/publish`);
              Alert.alert('Notice published', urgent ? 'Sent as urgent.' : 'It is live for its audience now.');
              router.back();
            } catch (e: unknown) {
              const msg = (e as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error?.message;
              Alert.alert('Not sent', msg ?? 'The notice could not be published. Try again.');
            } finally {
              setSending(false);
            }
          }}
        />
      </ScrollView>
    </View>
  );
}
