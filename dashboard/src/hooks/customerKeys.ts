export const customerKeys = {
  all: ['internal-customers'] as const,
  list: (filtersOrSearch: { search: string; status: string; municipio: string; uf: string; activityFrom: string; activityTo: string; page: number } | string, status = '', page = 0) =>
    [...customerKeys.all, 'list', typeof filtersOrSearch === 'string'
      ? { search: filtersOrSearch, status, page }
      : filtersOrSearch] as const,
  detail: (customerId: string) => [...customerKeys.all, 'detail', customerId] as const,
};
