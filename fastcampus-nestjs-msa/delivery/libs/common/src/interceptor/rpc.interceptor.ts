import { CallHandler, ExecutionContext, NestInterceptor } from '@nestjs/common';
import { RpcException } from '@nestjs/microservices';
import { catchError, map, Observable, throwError } from 'rxjs';

export class RpcInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    return next.handle().pipe(
      map((data) => {
        const response = { status: 'success', data };
        console.log(response);
        return response;
      }),
      catchError((err) => {
        const response = { status: 'error', message: err.message };
        console.error(response);
        return throwError(() => new RpcException(err));
      }),
    );
  }
}
