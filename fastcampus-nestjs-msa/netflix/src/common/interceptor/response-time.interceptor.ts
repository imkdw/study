import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Request } from 'express';
import { Observable, tap } from 'rxjs';

@Injectable()
export class ResponseTimeInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> | Promise<Observable<any>> {
    const req = context.switchToHttp().getRequest<Request>();

    const reqTime = Date.now();

    return next.handle().pipe(
      tap(() => {
        const responseTime = Date.now();
        const diff = responseTime - reqTime;

        console.log(`${req.url} 처리 시간: ${diff}ms`);
      }),
    );
  }
}
