import {
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import {
  addMember,
  checkAccess,
  createCategory,
  createCheckout,
  createItem,
  createPassHolder,
  deleteCategory,
  deleteCheckout,
  deleteItem,
  listCategories,
  listCheckouts,
  listItems,
  listMembers,
  listPassHolders,
  reorderCategories,
  reorderItems,
  removeMember,
  updateCategory,
  updateCheckout,
  updateItem,
} from './firestore';
import type { CategoryInput, ItemInput } from './types';

/** Centralized query keys so cache invalidation stays consistent. */
export const queryKeys = {
  categories: ['categories'] as const,
  items: ['items'] as const,
  members: ['members'] as const,
  access: (email: string) => ['access', email] as const,
  passHolders: (passItemId: string) => ['passHolders', passItemId] as const,
  checkouts: (range?: { from: Date; to: Date }) =>
    range
      ? (['checkouts', range.from.toISOString(), range.to.toISOString()] as const)
      : (['checkouts'] as const),
};

// ------------------------------------------------------------------ Members

/** Whether the given email is allowed to use the app (drives the access gate). */
export function useAccess(email: string | null | undefined) {
  return useQuery({
    queryKey: queryKeys.access(email ?? ''),
    queryFn: () => checkAccess(email as string),
    enabled: !!email,
    retry: false,
    staleTime: 5 * 60_000,
  });
}

export function useMembers() {
  return useQuery({ queryKey: queryKeys.members, queryFn: listMembers });
}

export function useMemberMutations() {
  const qc = useQueryClient();
  const invalidate = () => {
    qc.invalidateQueries({ queryKey: queryKeys.members });
    qc.invalidateQueries({ queryKey: ['access'] });
  };

  return {
    add: useMutation({
      mutationFn: ({ email, addedBy }: { email: string; addedBy: string }) =>
        addMember(email, addedBy),
      onSuccess: invalidate,
    }),
    remove: useMutation({ mutationFn: removeMember, onSuccess: invalidate }),
  };
}

// --------------------------------------------------------------- Categories

export function useCategories() {
  return useQuery({ queryKey: queryKeys.categories, queryFn: listCategories });
}

export function useCategoryMutations() {
  const qc = useQueryClient();
  const invalidate = () =>
    qc.invalidateQueries({ queryKey: queryKeys.categories });

  return {
    create: useMutation({ mutationFn: createCategory, onSuccess: invalidate }),
    update: useMutation({
      mutationFn: ({ id, input }: { id: string; input: Partial<CategoryInput> }) =>
        updateCategory(id, input),
      onSuccess: invalidate,
    }),
    remove: useMutation({ mutationFn: deleteCategory, onSuccess: invalidate }),
    reorder: useMutation({
      mutationFn: (orderedIds: string[]) => reorderCategories(orderedIds),
      onSuccess: invalidate,
    }),
  };
}

// -------------------------------------------------------------- Pass holders

export function usePassHolders(passItemId: string | null) {
  return useQuery({
    queryKey: queryKeys.passHolders(passItemId ?? ''),
    queryFn: () => listPassHolders(passItemId as string),
    enabled: !!passItemId,
  });
}

export function usePassHolderMutations() {
  const qc = useQueryClient();
  return {
    create: useMutation({
      mutationFn: createPassHolder,
      onSuccess: () => qc.invalidateQueries({ queryKey: ['passHolders'] }),
    }),
  };
}

// -------------------------------------------------------------------- Items

export function useItems() {
  return useQuery({ queryKey: queryKeys.items, queryFn: listItems });
}

export function useItemMutations() {
  const qc = useQueryClient();
  const invalidate = () => qc.invalidateQueries({ queryKey: queryKeys.items });

  return {
    create: useMutation({ mutationFn: createItem, onSuccess: invalidate }),
    update: useMutation({
      mutationFn: ({ id, input }: { id: string; input: Partial<ItemInput> }) =>
        updateItem(id, input),
      onSuccess: invalidate,
    }),
    remove: useMutation({ mutationFn: deleteItem, onSuccess: invalidate }),
    reorder: useMutation({
      mutationFn: (orderedIds: string[]) => reorderItems(orderedIds),
      onSuccess: invalidate,
    }),
  };
}

// ----------------------------------------------------------------- Checkouts

export function useCheckouts(range?: { from: Date; to: Date }) {
  return useQuery({
    queryKey: queryKeys.checkouts(range),
    queryFn: () => listCheckouts(range),
  });
}

export function useCheckoutMutations() {
  const qc = useQueryClient();
  const invalidate = () => qc.invalidateQueries({ queryKey: ['checkouts'] });

  return {
    create: useMutation({ mutationFn: createCheckout, onSuccess: invalidate }),
    update: useMutation({
      mutationFn: ({
        id,
        input,
      }: {
        id: string;
        input: Parameters<typeof updateCheckout>[1];
      }) => updateCheckout(id, input),
      onSuccess: invalidate,
    }),
    remove: useMutation({ mutationFn: deleteCheckout, onSuccess: invalidate }),
  };
}
