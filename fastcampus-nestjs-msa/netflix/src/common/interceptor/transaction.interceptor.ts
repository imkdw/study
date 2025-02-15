import { Injectable, NestInterceptor } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { catchError, Observable, tap } from 'rxjs';
import { CallHandler, ExecutionContext } from '@nestjs/common';

@Injectable()
export class TransactionInterceptor implements NestInterceptor {
  constructor(private readonly dataSoruce: DataSource) {}

  async intercept(context: ExecutionContext, next: CallHandler): Promise<Observable<any>> {
    const req = context.switchToHttp().getRequest<Request>();

    const queryRunner = this.dataSoruce.createQueryRunner();

    const qr = this.dataSoruce.createQueryRunner();

    await qr.connect();

    await qr.startTransaction();

    return next.handle().pipe(
      catchError(async (error) => {
        await qr.rollbackTransaction();
        await qr.release();
        throw error;
      }),
      tap(async () => {
        await qr.commitTransaction();
        await qr.release();
      }),
    );
  }
}
