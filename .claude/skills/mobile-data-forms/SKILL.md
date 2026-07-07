---
name: mobile-data-forms
description: Use when building a form screen (create/edit) or a data-entry mutation in apps/mobile — react-hook-form + zod validation against @shared schemas, FlashList-backed pickers/lists, and optimistic mutation updates. Pairs with mobile-api-integration for the underlying TanStack Query mutation and shared-contracts for the zod schema.
---

# mobile-data-forms

Forms and data-entry mutations in `apps/mobile`: `react-hook-form` wired to
the same zod schema the API validates against, list-backed pickers via
`FlashList`, and optimistic updates for mutations where instant feedback
matters more than waiting on a round trip.

## Goal

A form's validation rules exist in exactly one place — the `packages/shared`
zod schema — used both to type and validate the form (mobile) and to
validate the request body (API, via `nestjs-zod`). No hand-duplicated
validation logic on either side, no drift between what the form allows and
what the API accepts.

## react-hook-form + zod

```tsx
// src/components/post/create-post-form.tsx
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { TextInput, View, Text } from "react-native";
import { createPostRequestSchema, type CreatePostRequest } from "@shared/contracts/post";
import { useCreatePost } from "@/api/hooks/use-create-post";

export function CreatePostForm({ onDone }: { onDone: () => void }) {
  const { mutate, isPending, error } = useCreatePost();
  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<CreatePostRequest>({
    resolver: zodResolver(createPostRequestSchema),
    defaultValues: { title: "", body: "" },
  });

  const onSubmit = handleSubmit((values) => {
    mutate(values, { onSuccess: onDone });
  });

  return (
    <View className="gap-4 p-4">
      <Controller
        control={control}
        name="title"
        render={({ field }) => (
          <TextInput
            className="rounded-lg border border-muted p-3 text-foreground"
            placeholder="Title"
            value={field.value}
            onChangeText={field.onChange}
            onBlur={field.onBlur}
          />
        )}
      />
      {errors.title && <Text className="text-sm text-red-500">{errors.title.message}</Text>}

      {/* body field, same pattern */}

      {error && <Text className="text-sm text-red-500">{error.message}</Text>}
      <Button label={isPending ? "Posting…" : "Post"} disabled={isPending} onPress={onSubmit} />
    </View>
  );
}
```

- `resolver: zodResolver(createPostRequestSchema)` is the whole validation
  layer — no manual `if (!title) setError(...)` logic alongside it.
- `createPostRequestSchema` and the inferred `CreatePostRequest` type both
  come from `@shared/contracts/post` (`shared-contracts`) — the exact same
  schema `nestjs-zod`'s `ZodValidationPipe` uses on the API side
  (`nestjs-backend`).
- Use `Controller` for every field rather than register-style refs — React
  Native's `TextInput` doesn't support the DOM ref API `register()` assumes.
- Disable the submit control (`disabled={isPending}`), don't hide it — a
  hidden submit button that reappears on error is more disorienting than a
  disabled one.

## List-backed pickers

A picker/select backed by a potentially large list (users, tags,
categories) uses `FlashList`, not a native `Picker` component or an
unbounded `.map()`:

```tsx
// src/components/form/list-picker.tsx
import { FlashList } from "@shopify/flash-list";
import { Pressable, Text } from "react-native";

interface ListPickerProps<T extends { id: string; label: string }> {
  items: T[];
  selectedId?: string;
  onSelect: (item: T) => void;
}

export function ListPicker<T extends { id: string; label: string }>({
  items,
  selectedId,
  onSelect,
}: ListPickerProps<T>) {
  return (
    <FlashList
      data={items}
      keyExtractor={(item) => item.id}
      estimatedItemSize={48}
      renderItem={({ item }) => (
        <Pressable
          className={`p-3 ${item.id === selectedId ? "bg-primary/10" : ""}`}
          onPress={() => onSelect(item)}
        >
          <Text className="text-foreground">{item.label}</Text>
        </Pressable>
      )}
    />
  );
}
```

- Same `FlashList` discipline as `mobile-app-agent`: always set
  `estimatedItemSize`, always `keyExtractor`.
- For a small, fixed set of options (< ~10, e.g. a status enum), a plain row
  of pressable chips is simpler and fine — reach for `FlashList` once the
  option set is data-driven or can grow.

## Optimistic updates

For mutations where perceived speed matters (liking a post, toggling a
setting, reordering a list), update the cache immediately and roll back on
error rather than waiting for the round trip:

```ts
// src/api/hooks/use-toggle-like.ts
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/api/client";
import { postSchema, type Post } from "@shared/contracts/post";

export function useToggleLike(postId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => apiClient.post(`/posts/${postId}/like`, postSchema, {}),

    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: ["post", postId] });
      const previous = queryClient.getQueryData<Post>(["post", postId]);

      // Typed via the @shared Post contract — no `any` (typescript-strict).
      queryClient.setQueryData<Post>(["post", postId], (old) =>
        old ? { ...old, liked: !old.liked, likeCount: old.likeCount + (old.liked ? -1 : 1) } : old,
      );

      return { previous }; // passed to onError as context
    },

    onError: (_err, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(["post", postId], context.previous);
      }
    },

    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["post", postId] });
    },
  });
}
```

- Always cancel in-flight queries for the same key in `onMutate`
  (`cancelQueries`) before writing the optimistic value — otherwise an
  in-flight refetch can overwrite the optimistic update with stale data.
- Always capture the previous value and restore it in `onError` — an
  optimistic update with no rollback path turns a failed request into a
  silently wrong UI.
- `onSettled`'s invalidation is what reconciles the optimistic guess with
  the server's actual state once the mutation resolves, success or failure.
- Reserve optimistic updates for actions the user expects to feel instant
  and that rarely fail (likes, toggles, reordering) — a form submission
  with real validation risk (payments, account changes) should wait for the
  server response instead (see the `CreatePostForm` example above).

## Do

- Drive every form's validation from the same `@shared` zod schema the API
  validates against.
- Use `Controller`, not `register`, for every React Native form field.
- Use `FlashList` for any data-driven or growable picker/list.
- Cancel in-flight queries and capture a rollback snapshot before writing
  an optimistic update.

## Don't

- Don't hand-write parallel validation logic alongside `zodResolver`.
- Don't use `register()`/uncontrolled refs — RN inputs aren't DOM inputs.
- Don't apply optimistic updates to submissions with real failure
  consequences (payments, destructive actions) — wait for confirmation.
- Don't skip the rollback (`onError`) half of an optimistic mutation.
