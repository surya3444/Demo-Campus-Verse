import { Pressable, TextInput, View, type TextInputProps } from 'react-native';
import { Text, brand, color } from '@campus-verse/mobile-shared/design';

/** A labelled CampusVerse input. */
export function Field({ label, required, error, ...input }: TextInputProps & { label: string; required?: boolean; error?: string }) {
  return (
    <View style={{ marginBottom: 14 }}>
      <Text variant="eyebrow" tone="inkMute" style={{ marginBottom: 7 }}>
        {label}
        {required ? <Text variant="eyebrow" style={{ color: brand.danger }}> *</Text> : null}
      </Text>
      <TextInput
        placeholderTextColor={color.inkGhost}
        {...input}
        style={[
          {
            minHeight: input.multiline ? 84 : 50,
            borderRadius: 14,
            borderWidth: 1.5,
            borderColor: error ? brand.danger : color.ruleStrong,
            backgroundColor: color.card,
            paddingHorizontal: 14,
            paddingVertical: 12,
            fontFamily: 'DMSans_500Medium',
            fontSize: 15,
            color: brand.navy800,
            textAlignVertical: input.multiline ? 'top' : 'center',
          },
        ]}
      />
      {error ? (
        <Text variant="caption" style={{ color: brand.danger, marginTop: 5 }}>
          {error}
        </Text>
      ) : null}
    </View>
  );
}

/** Single-choice chips. */
export function Choice<T extends string>({ label, options, value, onChange }: { label: string; options: Array<{ value: T; label: string }>; value: T | null; onChange: (v: T) => void }) {
  return (
    <View style={{ marginBottom: 14 }}>
      <Text variant="eyebrow" tone="inkMute" style={{ marginBottom: 7 }}>
        {label}
      </Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {options.map((o) => {
          const on = value === o.value;
          return (
            <Pressable key={o.value} onPress={() => onChange(o.value)}>
              <View style={{ paddingHorizontal: 14, height: 36, borderRadius: 999, justifyContent: 'center', borderWidth: 1.5, borderColor: on ? brand.navy700 : color.ruleStrong, backgroundColor: on ? brand.navy50 : color.card }}>
                <Text variant="micro" style={{ color: on ? brand.navy700 : color.inkMute, fontFamily: 'DMSans_700Bold', fontSize: 12.5 }}>
                  {o.label}
                </Text>
              </View>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
