import { ExecutionContext, Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';

/** Disables rate limiting under Jest (NODE_ENV=test) so e2e suites that
 * legitimately call auth endpoints many times per file aren't throttled. */
@Injectable()
export class AppThrottlerGuard extends ThrottlerGuard {
  canActivate(context: ExecutionContext): Promise<boolean> {
    if (process.env.NODE_ENV === 'test') {
      return Promise.resolve(true);
    }
    return super.canActivate(context);
  }
}
