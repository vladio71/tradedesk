import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';
/** Marks a route as open: no access token needed. */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
