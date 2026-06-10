import {
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import {
  createCategory,
  createCheckout,
  createItem,
  deleteCategory,
  deleteCheckout,
  deleteItem,
  listCategories,
  listCheckouts,
  listItems,
  updateCategory,
  updateCheckout,
  updateItem,
} from './firestore';
import type { CategoryInput, ItemInput } from './types';

/** Centralized query keys so cache invalidation stays consistent. */
export const queryKeys = {
  categories: ['categories'] as const,
  items: ['items'] as const,
  checkouts: (range?: { from: Date; to: Date }) =>
    range
      ? (['checkouts', range.from.toISOString(), range.to.toISOString()] as const)
      : (['checkouts'] as const),
};

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
