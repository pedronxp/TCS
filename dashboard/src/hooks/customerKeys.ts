export const customerKeys = {
  all: ['internal-customers'] as const,
  list: (search: string, status: string, page: number) =>
    [...customerKeys.all, 'list', { search, status, page }] as const,
  detail: (customerId: string) => [...customerKeys.all, 'detail', customerId] as const,
};
