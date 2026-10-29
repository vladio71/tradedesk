export interface PageRequest {
  page: number;
  pageSize: number;
}

export interface Page<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export function offsetOf(request: PageRequest): number {
  return (request.page - 1) * request.pageSize;
}

export function buildPage<T>(items: T[], total: number, request: PageRequest): Page<T> {
  return {
    items,
    total,
    page: request.page,
    pageSize: request.pageSize,
    totalPages: Math.ceil(total / request.pageSize),
  };
}

export function mapPage<T, R>(page: Page<T>, mapper: (item: T) => R): Page<R> {
  return { ...page, items: page.items.map(mapper) };
}
